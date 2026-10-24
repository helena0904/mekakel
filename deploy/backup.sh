#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
ENV_BACKUP_DIR="${BACKUP_DIR:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mekakel}"
RETENTION_DAYS="${RETENTION_DAYS:-0}"
AGE_RECIPIENT="${AGE_RECIPIENT:-}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '%s\n' "$*"
}

[[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"

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

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

info "Compose project: $PROJECT_NAME"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.backup.lock"
  flock -n 9 || die "Another backup is already running"
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$BACKUP_DIR/mekakel-$STAMP"
mkdir -p "$WORK"
chmod 700 "$WORK"

cleanup_incomplete() {
  if [[ ! -f "$WORK/MANIFEST" ]]; then
    rm -rf "$WORK"
  fi
}
trap cleanup_incomplete EXIT

backend_id="$(compose ps -q backend || true)"
[[ -n "$backend_id" ]] || die "Backend container is not running; start the stack before backing up"

uploads_volume="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/private-uploads"}}{{.Name}}{{end}}{{end}}' "$backend_id")"
[[ -n "$uploads_volume" ]] || die "Could not resolve the uploads volume from the backend container"

info "Dumping PostgreSQL database (${POSTGRES_DB})..."
compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom > "$WORK/db.dump"

[[ -s "$WORK/db.dump" ]] || die "Database dump is empty"
compose exec -T db pg_restore --list < "$WORK/db.dump" >/dev/null \
  || die "Database dump failed integrity check"
info "Database dump verified."

info "Archiving medical-report uploads volume (${uploads_volume})..."
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$uploads_volume":/data:ro \
  -v "$(docker_path "$WORK")":/backup \
  alpine:3.20 sh -c 'tar -czf /backup/uploads.tar.gz -C /data .'

[[ -s "$WORK/uploads.tar.gz" ]] || die "Uploads archive is empty"
tar -tzf "$WORK/uploads.tar.gz" >/dev/null \
  || die "Uploads archive failed integrity check"
info "Uploads archive verified."

files=(db.dump uploads.tar.gz)

if [[ -n "$AGE_RECIPIENT" ]]; then
  command -v age >/dev/null 2>&1 \
    || die "AGE_RECIPIENT is set but the age binary is not installed"
  info "Encrypting backup artifacts with age..."
  age --recipient "$AGE_RECIPIENT" --output "$WORK/db.dump.age" "$WORK/db.dump"
  age --recipient "$AGE_RECIPIENT" --output "$WORK/uploads.tar.gz.age" "$WORK/uploads.tar.gz"
  rm -f "$WORK/db.dump" "$WORK/uploads.tar.gz"
  files=(db.dump.age uploads.tar.gz.age)
else
  info "WARNING: backups are not encrypted. Set AGE_RECIPIENT to enable encryption." >&2
fi

(
  cd "$WORK"
  sha256sum "${files[@]}" > SHA256SUMS
)

GIT_COMMIT="unknown"
if command -v git >/dev/null 2>&1 && git -C "$SCRIPT_DIR/.." rev-parse --short HEAD >/dev/null 2>&1; then
  GIT_COMMIT="$(git -C "$SCRIPT_DIR/.." rev-parse --short HEAD)"
fi

{
  printf 'created_utc=%s\n' "$STAMP"
  printf 'hostname=%s\n' "$(hostname)"
  printf 'git_commit=%s\n' "$GIT_COMMIT"
  printf 'database=%s\n' "$POSTGRES_DB"
  printf 'encrypted=%s\n' "$([[ -n "$AGE_RECIPIENT" ]] && printf yes || printf no)"
} > "$WORK/MANIFEST"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS > 0 )); then
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'mekakel-*' \
    -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} +
fi

trap - EXIT

info ""
info "Backup complete: $WORK"
info "Files:"
ls -lh "$WORK"
info ""
info "Copy this directory off-server and store it encrypted with restricted access."
info "Test a restore before relying on it."
