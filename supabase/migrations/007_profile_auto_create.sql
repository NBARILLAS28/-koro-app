-- ============================================================
-- KORO — Migración: creación automática de perfil al registrarse
-- Ejecutar DESPUÉS de 006_push_notifications.sql
--
-- Problema que arregla: el insert de "profiles" se hacía desde la app
-- justo después de auth.signUp(), pero si la sesión aún no estaba
-- completamente activa en ese instante (algo común, sobre todo con
-- confirmación de correo), la política de seguridad (RLS) rechazaba
-- el insert en silencio y la cuenta quedaba sin fila en "profiles".
-- Esto rompía cualquier acción que dependiera de ese perfil (crear
-- comunidad, etc. con error "violates foreign key constraint").
--
-- La solución correcta: crear el perfil automáticamente en el
-- servidor con un trigger sobre auth.users, que no depende de RLS
-- ni de que la sesión del cliente ya esté lista.
-- ============================================================

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill: crea el perfil para cualquier cuenta que ya exista en
-- auth.users pero que se haya quedado sin fila en profiles (como la
-- tuya, creada antes de este arreglo).
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
