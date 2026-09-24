-- ============================================================
-- KORO — Migración: arregla el trigger de "admin automático"
-- Ejecutar DESPUÉS de 007_profile_auto_create.sql
--
-- Problema que arregla: al crear una comunidad, un trigger debía
-- insertar automáticamente al creador como "admin" en
-- community_members. Ese trigger NO tenía SECURITY DEFINER, así que
-- corría con los permisos limitados del usuario normal (RLS activo).
-- Como en ese instante todavía no existe ninguna fila que acredite al
-- usuario como miembro de esa comunidad, la política de seguridad
-- rechazaba el insert con "new row violates row-level security
-- policy for table community_members" y la comunidad quedaba
-- huérfana (creada, pero sin ningún admin).
-- ============================================================

create or replace function add_owner_as_admin() returns trigger as $$
begin
  insert into public.community_members (community_id, profile_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill: por si alguien ya se topó con este bug y le quedó una
-- comunidad creada sin ningún admin (huérfana), esto la repara.
insert into public.community_members (community_id, profile_id, role)
select c.id, c.owner_id, 'admin'
from public.communities c
left join public.community_members m
  on m.community_id = c.id and m.profile_id = c.owner_id
where m.profile_id is null;
