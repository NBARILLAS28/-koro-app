-- ============================================================
-- KORO — Migración: no borrar la comunidad si su creador borra su cuenta
-- Ejecutar DESPUÉS de 008_fix_admin_trigger_security.sql
--
-- Problema que arregla: communities.owner_id apuntaba a profiles(id) con
-- ON DELETE CASCADE. Eso significa que si el creador de una comunidad
-- borraba su cuenta, la comunidad ENTERA se borraba en cascada —
-- afectando a todos los demás integrantes, no solo al que se fue.
-- Esto se vuelve peligroso en cuanto se habilita que cualquiera pueda
-- borrar su propia cuenta desde la app (ver "Eliminar cuenta" en el perfil).
--
-- El permiso real de administrar una comunidad ya vive en
-- community_members.role ('admin'/'director'), no en owner_id — así que
-- owner_id es solo un dato histórico de quién la creó. Cambiarlo a
-- ON DELETE SET NULL es seguro: la comunidad y sus datos sobreviven,
-- simplemente se queda sin ese dato de "creador original".
-- ============================================================

alter table public.communities drop constraint if exists communities_owner_id_fkey;
alter table public.communities alter column owner_id drop not null;
alter table public.communities
  add constraint communities_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;
