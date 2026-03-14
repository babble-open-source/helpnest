#!/usr/bin/env bash
set -e

echo "🚀 Setting up HelpNest development environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Run: npm i -g pnpm"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }

# Copy env file if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 Created .env from .env.example — please review and update values"
fi

# Next.js reads env from apps/web/, not the repo root
if [ ! -f apps/web/.env.local ]; then
  cp .env apps/web/.env.local
  echo "📋 Created apps/web/.env.local (Next.js env)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose up -d

# Wait for postgres to be healthy
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec helpnest_postgres pg_isready -U helpnest -d helpnest_dev >/dev/null 2>&1; do
  printf '.'
  sleep 1
done
echo ""
echo "✅ PostgreSQL is ready!"

# Run migrations
# migrate deploy applies all pending migrations without prompting —
# safe to re-run on subsequent dev-setup.sh calls (idempotent).
echo "🗄️  Running database migrations..."
cd packages/db
pnpm prisma migrate deploy
echo "✅ Migrations complete!"

echo "⚙️  Generating Prisma client..."
pnpm prisma generate
echo "✅ Prisma client generated!"

# Run seed
echo "🌱 Seeding database..."
pnpm db:seed
echo "✅ Database seeded!"

cd ../..

echo ""
echo "✅ HelpNest is ready for development!"
echo ""
echo "   Run: pnpm dev"
echo "   Web: http://localhost:3000"
echo "   Docs: http://localhost:3001"
echo "   Prisma Studio: pnpm db:studio"
echo "   Qdrant UI: http://localhost:6333/dashboard"
echo ""
