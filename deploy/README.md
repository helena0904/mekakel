# MEKAKEL Production Deployment

This directory contains the Docker configuration and operational scripts for deploying MEKAKEL in a production-like environment.

The production stack is separate from the existing development setup. It uses prebuilt application artifacts, a PostgreSQL database, persistent volumes, and an Nginx frontend. An optional Caddy service provides automatic HTTPS.

**Production status:** The deployment infrastructure has passed local production-like validation, including health checks, database migrations, smoke tests, and backup/restore testing. Before accepting real donor medical information, complete the security, infrastructure, and operational checks in this guide.

## Architecture

```text
                         Internet
                            |
                            v
                    Caddy (optional TLS)
                         :80/:443
                            |
                            v
                   Frontend (Nginx)
                   Static files + /api
                            |
                            v
                   Backend (Express)
                         :3000
                            |
                            v
                    PostgreSQL 16
```

The production Compose configuration includes:

* `db`: PostgreSQL with persistent database storage.
* `migrate`: A one-shot service that applies Prisma migrations.
* `backend`: The compiled Node.js/Express API.
* `frontend`: An Nginx server serving the built frontend and proxying API requests.
* `caddy`: An optional reverse proxy that manages HTTPS certificates.

The database and backend are not intended to be publicly accessible.

PostgreSQL data and uploaded medical reports use persistent Docker volumes. Persistent volumes are not backups.

## Files

| File                      | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `backend.Dockerfile`      | Backend build, runtime, and migration targets               |
| `frontend.Dockerfile`     | Frontend build and Nginx runtime                            |
| `nginx.conf`              | SPA routing, API proxying, and request-size limits          |
| `Caddyfile`               | Optional HTTPS reverse proxy                                |
| `docker-compose.prod.yml` | Production services, networking, health checks, and volumes |
| `env.production.example`  | Production environment template                             |
| `backup.sh`               | Database and uploads backup                                 |
| `restore.sh`              | Confirmation-gated database and uploads restore             |
| `README.md`               | Deployment and operations guide                             |

## Prerequisites

Recommended server configuration for a small pilot:

* Ubuntu LTS or another supported Linux distribution.
* Docker Engine and Docker Compose v2.
* SSH access to the server.
* A domain name and DNS access when using Caddy.
* Inbound TCP ports 22, 80, and 443, as appropriate.
* Outbound HTTPS for image builds, package retrieval, and certificate management.
* Outbound SMTP access if email is required.
* `bash`, `curl`, `tar`, and `sha256sum`.
* `age` on the backup host when using encrypted backups.

Resource requirements depend on traffic, database size, and uploaded medical-report storage.

The backup and restore scripts target Bash. On Windows, use WSL or run the scripts on Linux. The scripts include handling for Git Bash bind-mount paths where required.

## 1. Prepare the deployment files

Ensure the reviewed deployment files are available on the production server.

For example, use a dedicated directory:

```bash
sudo mkdir -p /opt/mekakel
sudo chown "$USER":"$USER" /opt/mekakel
```

Place the reviewed repository files in that directory. The deployment directory must contain the Dockerfiles, Compose file, Nginx configuration, Caddy configuration, environment template, and backup scripts.

**Important:** Uncommitted files are not included in a Git clone. Commit and push the reviewed deployment files before cloning them, or transfer the files securely to the server.

Do not copy development credentials into production.

## 2. Configure the production environment

From the deployment directory:

```bash
cd /opt/mekakel/deploy
cp env.production.example .env.production
chmod 600 .env.production
```

Edit the environment file:

```bash
nano .env.production
```

Replace every placeholder with the correct production value.

Never commit `.env.production` or share its contents.

### Required configuration

Configure the variables defined by `env.production.example`, including:

* `POSTGRES_USER`
* `POSTGRES_PASSWORD`
* `POSTGRES_DB`
* `JWT_SECRET`
* `PUBLIC_URL`
* `SMTP_HOST`
* `SMTP_PORT`
* `SMTP_USER`
* `SMTP_PASSWORD`
* `SMTP_FROM`

Also review `TRUST_PROXY`, `HTTP_PORT`, `BACKUP_DIR`, `RETENTION_DAYS`, and the Compose settings.

Generate a JWT secret with:

```bash
openssl rand -hex 32
```

Generate a URL-safe database password with:

```bash
openssl rand -hex 32
```

Use the generated database password consistently in the PostgreSQL configuration and backend `DATABASE_URL`.

The database password is embedded in a connection URL. If you use URL-reserved characters, they must be encoded correctly.

Do not reuse development secrets.

### Production URLs

`PUBLIC_URL` must match the browser-facing origin exactly.

For example:

```dotenv
PUBLIC_URL=https://mekakel.example.com
```

Replace the example domain with your actual domain.

If `CORS_ORIGINS` is configured, ensure its values match the intended browser origins.

## 3. Configure HTTPS

### Option A: Caddy

Caddy is the recommended option for a single-server Compose deployment.

In `.env.production`, configure:

```dotenv
COMPOSE_PROFILES=tls
DOMAIN=mekakel.example.com
ACME_EMAIL=admin@example.com
PUBLIC_URL=https://mekakel.example.com
```

Replace the example values.

Before starting the application:

1. Create the appropriate DNS record pointing to the server.
2. Confirm the domain resolves to the server's public IP.
3. Ensure inbound TCP ports 80 and 443 are reachable.
4. Ensure another service is not occupying the required ports.
5. Verify that the configured domain matches the public application URL.

Caddy should obtain and renew certificates automatically when the domain and network configuration are correct.

See the official [Caddy automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https).

### Option B: External reverse proxy

If TLS terminates at an external load balancer or reverse proxy, do not enable the Caddy profile unless the architecture specifically requires it.

Configure the external proxy to forward requests to the frontend's loopback-bound HTTP port.

Ensure the proxy handles forwarded headers correctly and that the backend trusts only the intended proxy topology.

Do not expose the frontend's internal HTTP port publicly.

## 4. Validate and build

From the deployment directory:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

Inspect the configuration for errors.

**Do not publish the rendered configuration output:** it may contain sensitive environment values.

Build the images:

```bash
docker compose --env-file
```
