-- ============================================================
-- KORO — Migración: índice de búsqueda de canciones
-- Ejecutar DESPUÉS de 004_admin_safety.sql
-- ============================================================

create extension if not exists pg_trgm;

create index if not exists idx_songs_title_trgm on public.songs using gin (title gin_trgm_ops);
create index if not exists idx_songs_artist_trgm on public.songs using gin (artist gin_trgm_ops);
