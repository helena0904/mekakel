#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
ENV_BACKUP_DIR="${BACKUP_DIR:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mekakel}"
AGE_IDENTITY="${AGE_IDENTITY:-}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '%s\n' "$*"
}

usage() {
  cat <<'EOF'
Usage: ./restore.sh --confirm <backup-directory>

Restores PostgreSQL and the medical-report uploads volume from a backup
created by backup.sh.

--confirm   Required. Acknowledges that this DESTROYS current database and
            uploads data and replaces them with the backup contents.

Environment:
  ENV_FILE        Compose env file (default: .env.production)
  COMPOSE_FILE    Compose file (default: docker-compose.prod.yml)
  AGE_IDENTITY    age private key file, required for encrypted backups
EOF
}

CONFIRM=0
SOURCE=""

for arg in "$@"; do
  case "$arg" in
    --confirm)
      CONFIRM=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      [[ -z "$SOURCE" ]] || die "Only one backup directory may be provided"
      SOURCE="$arg"
      ;;
  esac
done

[[ "$CONFIRM" -eq 1 ]] || { usage; exit 1; }
[[ -n "$SOURCE" ]] || { usage; exit 1; }
[[ -d "$SOURCE" ]] || die "Backup directory not found: $SOURCE"
[[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"

SOURCE="$(cd "$SOURCE" && pwd)"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ -n "$ENV_BACKUP_DIR" ]]; then
  BACKUP_DIR="$ENV_BACKUP_DIR"
fi

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-mekakel-prod}"
POSTGRES_USER="${POSTGRES_USER:-mekakel}"
POSTGRES_DB="${POSTGRES_DB:-mekakel}"

compose() {
  docker compose \
    --project-name "$PROJECT_NAME" \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

docker_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s\n' "$1"
  fi
}

[[ -f "$SOURCE/SHA256SUMS" ]] || die "Missing SHA256SUMS in $SOURCE"
info "Verifying backup checksums..."
( cd "$SOURCE" && sha256sum -c SHA256SUMS ) || die "Backup checksum verification failed"

WORK="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

if [[ -f "$SOURCE/db.dump.age" || -f "$SOURCE/uploads.tar.gz.age" ]]; then
  command -v age >/dev/null 2>&1 \
    || die "Encrypted backup found but the age binary is not installed"
  [[ -n "$AGE_IDENTITY" ]] \
    || die "Encrypted backup found but AGE_IDENTITY is not set"
  [[ -f "$AGE_IDENTITY" ]] || die "AGE_IDENTITY file not found: $AGE_IDENTITY"

  info "Decrypting backup..."
  age --decrypt --identity "$AGE_IDENTITY" --output "$WORK/db.dump" "$SOURCE/db.dump.age"
  age --decrypt --identity "$AGE_IDENTITY" --output "$WORK/uploads.tar.gz" "$SOURCE/uploads.tar.gz.age"
else
  cp "$SOURCE/db.dump" "$WORK/db.dump"
  cp "$SOURCE/uploads.tar.gz" "$WORK/uploads.tar.gz"
fi

info "Validating backup contents..."
compose up -d --wait db
compose exec -T db pg_restore --list < "$WORK/db.dump" >/dev/null \
  || die "Database dump failed validation"
tar -tzf "$WORK/uploads.tar.gz" >/dev/null \
  || die "Uploads archive failed validation"

backend_id="$(compose ps -q backend || true)"
[[ -n "$backend_id" ]] || die "Backend container not found; start the stack once before restoring"

uploads_volume="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/private-uploads"}}{{.Name}}{{end}}{{end}}' "$backend_id")"
[[ -n "$uploads_volume" ]] || die "Could not resolve the uploads volume from the backend container"

SAFETY_BACKUP_ROOT="${SAFETY_BACKUP_ROOT:-$BACKUP_DIR/restore-safety}"
mkdir -p "$SAFETY_BACKUP_ROOT"
chmod 700 "$SAFETY_BACKUP_ROOT"

info ""
info "WARNING: This will DESTROY the current PostgreSQL data and uploads."
info "Compose project: $PROJECT_NAME"
info "Backup source:   $SOURCE"
info "Database:        $POSTGRES_DB"
info "Uploads volume:  $uploads_volume"
info ""
info "Creating a pre-restore safety backup of the current state..."
if ! BACKUP_DIR="$SAFETY_BACKUP_ROOT" \
  ENV_FILE="$ENV_FILE" \
  COMPOSE_FILE="$COMPOSE_FILE" \
  bash "$SCRIPT_DIR/backup.sh"; then
  die "Pre-restore safety backup failed. Aborting before any data was modified."
fi

SAFETY_DIR="$(ls -dt "$SAFETY_BACKUP_ROOT"/mekakel-* 2>/dev/null | head -n 1 || true)"
[[ -n "$SAFETY_DIR" ]] || die "Could not locate the pre-restore safety backup"
info "Safety backup: $SAFETY_DIR"
info ""
for remaining in 5 4 3 2 1; do
  printf 'Starting restore in %s...\n' "$remaining"
  sleep 1
done

info "Stopping application containers..."
running_services="$(compose ps --services --filter status=running || true)"
if grep -qx 'caddy' <<<"$running_services"; then
  compose stop caddy
fi
compose stop backend frontend

info "Restoring PostgreSQL database..."
if ! compose exec -T db pg_restore \
  --clean --if-exists --no-owner --no-privileges --exit-on-error -1 \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$WORK/db.dump"; then
  die "Database restore failed. The application remains stopped; current DB may be partially changed. Do not restart until this is investigated. Pre-restore safety backup: $SAFETY_DIR"
fi

info "Restoring uploads volume..."
if ! docker run --rm \
  -v "$uploads_volume":/data \
  -v "$(docker_path "$WORK")":/backup:ro \
  alpine:3.20 sh -c '
    set -e
    find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    tar -xzf /backup/uploads.tar.gz -C /data
    chown -R 1000:1000 /data
  '; then
  die "Uploads restore failed after the database restore. Application remains stopped. Recover the previous state with: ./restore.sh --confirm $SAFETY_DIR"
fi

info "Starting application containers..."
compose up -d

info ""
info "Restore complete. Verify with:"
info "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE ps"
info "  curl -fsS http://127.0.0.1:\${HTTP_PORT:-8080}/api/auth/login || true"
info ""
info "If the application does not become healthy, inspect:"
info "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs --tail=200 backend"
