-- ============================================================
-- KORO — Migración: Director en vivo
-- Ejecutar DESPUÉS de schema.sql
-- ============================================================

-- Una fila por comunidad: representa el estado de la sesión en vivo.
-- Si is_active = false, no hay sesión corriendo.
create table public.live_sessions (
  community_id uuid primary key references public.communities(id) on delete cascade,
  is_active boolean not null default false,
  setlist_id uuid references public.setlists(id) on delete set null,
  current_setlist_song_id uuid references public.setlist_songs(id) on delete set null,
  current_song_id uuid references public.songs(id) on delete set null,
  current_key text, -- tonalidad que el director está mostrando en este momento
  started_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.live_sessions enable row level security;

-- Todos los miembros de la comunidad pueden leer el estado en vivo
create policy "live_sessions_select_members" on public.live_sessions
  for select using (is_member(community_id));

-- Solo admin/director pueden crear o modificar la sesión en vivo
create policy "live_sessions_write_admin" on public.live_sessions
  for insert with check (is_admin_or_director(community_id));

create policy "live_sessions_update_admin" on public.live_sessions
  for update using (is_admin_or_director(community_id));

-- Trigger para mantener updated_at fresco (Realtime usa esto para notificar cambios)
create or replace function touch_live_session() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger trg_touch_live_session
before update on public.live_sessions
for each row execute function touch_live_session();

-- Función de conveniencia: iniciar/actualizar sesión en vivo en un solo paso (upsert)
create or replace function start_or_update_live_session(
  p_community_id uuid,
  p_setlist_id uuid,
  p_setlist_song_id uuid,
  p_song_id uuid,
  p_current_key text
) returns void as $$
begin
  if not is_admin_or_director(p_community_id) then
    raise exception 'Solo un director o admin puede controlar la sesión en vivo';
  end if;

  insert into public.live_sessions (
    community_id, is_active, setlist_id, current_setlist_song_id, current_song_id, current_key, started_by
  ) values (
    p_community_id, true, p_setlist_id, p_setlist_song_id, p_song_id, p_current_key, auth.uid()
  )
  on conflict (community_id) do update set
    is_active = true,
    setlist_id = excluded.setlist_id,
    current_setlist_song_id = excluded.current_setlist_song_id,
    current_song_id = excluded.current_song_id,
    current_key = excluded.current_key,
    started_by = excluded.started_by,
    updated_at = now();
end;
$$ language plpgsql security definer;

create or replace function stop_live_session(p_community_id uuid) returns void as $$
begin
  if not is_admin_or_director(p_community_id) then
    raise exception 'Solo un director o admin puede finalizar la sesión en vivo';
  end if;

  update public.live_sessions set is_active = false, updated_at = now()
  where community_id = p_community_id;
end;
$$ language plpgsql security definer;

-- Habilitar Realtime para esta tabla
alter publication supabase_realtime add table public.live_sessions;
