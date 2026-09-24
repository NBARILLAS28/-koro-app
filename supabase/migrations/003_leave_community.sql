-- ============================================================
-- KORO — Migración: Salir de la comunidad
-- Ejecutar DESPUÉS de 002_live_session.sql
-- ============================================================

-- Permite que cualquier miembro elimine su PROPIA fila de community_members
-- (es decir, "salir" de la comunidad), sin necesitar rol admin/director.
create policy "members_leave_self" on public.community_members
  for delete using (profile_id = auth.uid());

-- Nota: esto convive con la política existente "members_admin_manage",
-- que ya permite a admin/director borrar la fila de OTROS (expulsar).
-- Postgres evalúa políticas permisivas con OR, así que ambas coexisten sin conflicto.
