-- Add a GIN index for full-text search on Article.
--
-- Without this index, every search query recomputes to_tsvector() over the
-- entire title + content of all published articles. With the index, Postgres
-- uses the precomputed tsvector and a GIN bitmap scan, which is orders of
-- magnitude faster at scale.
--
-- The expression in this index must match the to_tsvector() call in
-- apps/web/src/app/api/search/route.ts exactly for Postgres to use it.
--
-- For large existing tables, consider running this outside a transaction with
-- CREATE INDEX CONCURRENTLY to avoid locking writes during the build.

CREATE INDEX IF NOT EXISTS "Article_fts_idx"
  ON "Article"
  USING GIN (to_tsvector('english', title || ' ' || content));
