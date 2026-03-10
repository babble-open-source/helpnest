#!/usr/bin/env bash
set -e

# Use color only when connected to a terminal — safe in Docker log aggregators.
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; RED=''; NC=''
fi

echo ""
echo -e "${BOLD}🪺  HelpNest Self-Host Setup${NC}"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required.${NC} Install from https://docs.docker.com/get-docker/"; exit 1; }
command -v git    >/dev/null 2>&1 || { echo -e "${RED}❌ Git is required.${NC}"; exit 1; }

echo -e "${GREEN}✓${NC} Prerequisites OK"
echo ""

# ── .env setup ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}📋 Created .env from .env.example${NC}"
fi

# Helper: generate a random secret using openssl (falls back to /dev/urandom)
gen_secret() {
  openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n'
}

# Helper: set or replace a value in .env
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" .env && rm -f .env.bak
  else
    echo "${key}=${val}" >> .env
  fi
}

# AUTH_SECRET
if grep -qE "^AUTH_SECRET=$|^AUTH_SECRET=run-openssl" .env; then
  SECRET=$(gen_secret)
  set_env AUTH_SECRET "$SECRET"
  echo -e "${GREEN}✓${NC} AUTH_SECRET generated"
fi

# POSTGRES_PASSWORD — required by docker-compose.prod.yml
if ! grep -qE "^POSTGRES_PASSWORD=.+" .env 2>/dev/null; then
  PG_PASS=$(gen_secret | tr -dc 'a-zA-Z0-9' | head -c 24)
  set_env POSTGRES_PASSWORD "$PG_PASS"
  echo -e "${GREEN}✓${NC} POSTGRES_PASSWORD generated"
else
  PG_PASS=$(grep "^POSTGRES_PASSWORD=" .env | cut -d= -f2-)
fi

# REDIS_PASSWORD
if ! grep -qE "^REDIS_PASSWORD=.+" .env 2>/dev/null; then
  REDIS_PASS=$(gen_secret | tr -dc 'a-zA-Z0-9' | head -c 24)
  set_env REDIS_PASSWORD "$REDIS_PASS"
  echo -e "${GREEN}✓${NC} REDIS_PASSWORD generated"
else
  REDIS_PASS=$(grep "^REDIS_PASSWORD=" .env | cut -d= -f2-)
fi

# ADMIN_SEED_EMAIL — default to admin@helpnest.cloud if not set.
# The email is public in the OSS repo; security depends on ADMIN_SEED_PASSWORD.
if ! grep -qE "^ADMIN_SEED_EMAIL=.+" .env 2>/dev/null; then
  set_env ADMIN_SEED_EMAIL "admin@helpnest.cloud"
fi
SEED_EMAIL=$(grep "^ADMIN_SEED_EMAIL=" .env | cut -d= -f2-)

# ADMIN_SEED_PASSWORD — prevents well-known dev credentials in production
if ! grep -qE "^ADMIN_SEED_PASSWORD=.+" .env 2>/dev/null; then
  SEED_PASS=$(gen_secret | tr -dc 'a-zA-Z0-9' | head -c 24)
  set_env ADMIN_SEED_PASSWORD "$SEED_PASS"
  echo -e "${GREEN}✓${NC} ADMIN_SEED_PASSWORD generated"
else
  SEED_PASS=$(grep "^ADMIN_SEED_PASSWORD=" .env | cut -d= -f2-)
fi

# DATABASE_URL — rewrite to Docker service name if it still points to localhost
CURRENT_DB_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2-)
if echo "$CURRENT_DB_URL" | grep -qE "localhost|127\.0\.0\.1"; then
  set_env DATABASE_URL "postgresql://helpnest:${PG_PASS}@postgres:5432/helpnest"
  echo -e "${GREEN}✓${NC} DATABASE_URL updated to use Docker service name (postgres)"
fi

# REDIS_URL — rewrite to Docker service name with password
CURRENT_REDIS_URL=$(grep "^REDIS_URL=" .env 2>/dev/null | cut -d= -f2- || true)
if echo "$CURRENT_REDIS_URL" | grep -qE "localhost|127\.0\.0\.1"; then
  set_env REDIS_URL "redis://:${REDIS_PASS}@redis:6379"
  echo -e "${GREEN}✓${NC} REDIS_URL updated to use Docker service name (redis)"
fi

echo ""

# ── Build & start ─────────────────────────────────────────────────────────────
echo "🐳 Building Docker image (this may take a few minutes on first run)..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

# ── Wait for the database ──────────────────────────────────────────────────────
echo ""
echo "⏳ Waiting for database to be ready..."
POSTGRES_USER=$(grep "^POSTGRES_USER=" .env 2>/dev/null | cut -d= -f2- || echo "helpnest")
until docker exec helpnest_postgres_prod pg_isready -U "${POSTGRES_USER:-helpnest}" >/dev/null 2>&1; do
  printf '.'
  sleep 2
done
echo ""
echo -e "${GREEN}✓${NC} Database ready"

# ── Wait for migrations to complete ───────────────────────────────────────────
# The "migrate" service in docker-compose.prod.yml runs prisma migrate deploy
# automatically before the app starts. We just need to wait for it to finish.
echo ""
echo "⏳ Waiting for migrations to complete..."
until [ "$(docker inspect -f '{{.State.Status}}' helpnest_migrate 2>/dev/null)" = "exited" ]; do
  printf '.'
  sleep 2
done
MIGRATE_EXIT=$(docker inspect -f '{{.State.ExitCode}}' helpnest_migrate 2>/dev/null || echo "1")
if [ "$MIGRATE_EXIT" != "0" ]; then
  echo ""
  echo -e "${RED}❌ Migration failed (exit code ${MIGRATE_EXIT}).${NC}"
  echo "   Check logs: docker logs helpnest_migrate"
  exit 1
fi
echo ""
echo -e "${GREEN}✓${NC} Migrations applied"

# ── Seed demo data ─────────────────────────────────────────────────────────────
echo ""
echo "🌱 Seeding database with demo workspace and articles..."
docker exec helpnest_app node /app/packages/db/prisma/seed.js
echo -e "${GREEN}✓${NC} Database seeded"

echo ""
echo -e "${GREEN}${BOLD}✅ HelpNest is running!${NC}"
echo ""
echo "   🌐 Help center:  http://localhost:3000"
echo "   ⚙️  Dashboard:   http://localhost:3000/dashboard"
echo "   📊 Health:       http://localhost:3000/api/health"
echo ""
echo -e "${YELLOW}Default login credentials:${NC}"
echo "   Email:    ${SEED_EMAIL}"
echo "   Password: ${SEED_PASS}"
echo ""
echo -e "${YELLOW}⚠️  Save these credentials — they won't be shown again.${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Set NEXTAUTH_URL and NEXT_PUBLIC_APP_URL to your public domain in .env"
echo "   2. Set up a reverse proxy (nginx/Caddy) for HTTPS"
echo "   3. Rebuild and restart after changing .env: docker compose -f docker-compose.prod.yml up -d --build"
echo ""
