-- ============================================================
-- KORO — Migración: nunca dejar una comunidad sin admin
-- Ejecutar DESPUÉS de 003_leave_community.sql
-- ============================================================

create or replace function prevent_last_admin_removal() returns trigger as $$
declare
  v_community_id uuid;
  v_remaining_admins int;
begin
  v_community_id := coalesce(old.community_id, new.community_id);

  -- Solo nos importa si la fila afectada ERA admin
  if old.role <> 'admin' then
    return coalesce(new, old);
  end if;

  -- Si es un UPDATE que sigue siendo admin, no hay problema
  if TG_OP = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;

  select count(*) into v_remaining_admins
  from public.community_members
  where community_id = v_community_id
    and role = 'admin'
    and profile_id <> old.profile_id;

  if v_remaining_admins = 0 then
    raise exception 'No puedes quitar al único admin de la comunidad. Asigna otro admin primero.';
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger trg_prevent_last_admin_removal
before update or delete on public.community_members
for each row execute function prevent_last_admin_removal();
