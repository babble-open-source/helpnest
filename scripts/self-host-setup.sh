#!/usr/bin/env bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}🪺  HelpNest Self-Host Setup${NC}"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required.${NC} Install from https://docs.docker.com/get-docker/"; exit 1; }
command -v git     >/dev/null 2>&1 || { echo -e "${RED}❌ Git is required.${NC}"; exit 1; }

echo -e "${GREEN}✓${NC} Prerequisites OK"
echo ""

# ── .env setup ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}📋 Created .env from .env.example${NC}"
fi

# Prompt for required secrets if not already set
if grep -q "^AUTH_SECRET=$" .env || grep -q "^AUTH_SECRET=run-openssl" .env; then
  echo -n "Enter a random secret for AUTH_SECRET (or press Enter to auto-generate): "
  read -r SECRET
  if [ -z "$SECRET" ]; then
    SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
  fi
  sed -i.bak "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env && rm -f .env.bak
  echo -e "${GREEN}✓${NC} AUTH_SECRET set"
fi

if grep -q "^POSTGRES_PASSWORD=$" .env 2>/dev/null; then
  PG_PASS=$(openssl rand -base64 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 16)
  sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env && rm -f .env.bak
  echo -e "${GREEN}✓${NC} POSTGRES_PASSWORD auto-generated"
fi

echo ""

# ── Build & start ─────────────────────────────────────────────────────────────
echo "🐳 Building Docker image (this may take a few minutes on first run)..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Waiting for database to be ready..."
until docker exec helpnest_postgres_prod pg_isready -U helpnest >/dev/null 2>&1; do
  printf '.'
  sleep 2
done
echo ""
echo -e "${GREEN}✓${NC} Database ready"

# ── Migrations ────────────────────────────────────────────────────────────────
echo ""
echo "🗄️  Running database migrations..."
docker exec helpnest_app node -e "
const { execSync } = require('child_process');
execSync('npx prisma migrate deploy', { cwd: '/app/packages/db', stdio: 'inherit' });
" 2>/dev/null || echo -e "${YELLOW}⚠️  Run migrations manually if needed: docker exec helpnest_app npx prisma migrate deploy${NC}"

echo ""
echo -e "${GREEN}${BOLD}✅ HelpNest is running!${NC}"
echo ""
echo "   🌐 Help center:  http://localhost:3000"
echo "   ⚙️  Dashboard:   http://localhost:3000/dashboard"
echo "   📊 Health:       http://localhost:3000/api/health"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Add your domain to .env: NEXTAUTH_URL=https://help.yourdomain.com"
echo "   2. Set up a reverse proxy (nginx/Caddy) for HTTPS"
echo "   3. Run 'helpnest init' to create your first workspace"
echo ""
