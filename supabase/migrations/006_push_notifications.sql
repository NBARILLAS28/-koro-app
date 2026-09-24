-- ============================================================
-- KORO — Migración: Notificaciones push
-- Ejecutar DESPUÉS de 005_song_search_index.sql
-- ============================================================

alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists notify_new_song boolean not null default true;
alter table public.profiles add column if not exists notify_live_session boolean not null default true;
alter table public.profiles add column if not exists notify_comment boolean not null default true;

-- pg_net permite hacer llamadas HTTP salientes desde triggers de Postgres.
-- Disponible en Supabase por defecto; si tu plan no lo tiene habilitado,
-- actívalo desde Database > Extensions en el dashboard.
create extension if not exists pg_net;

-- Guarda aquí la URL de tu Edge Function una vez que la despliegues (ver supabase/functions/send-push).
-- Reemplaza <PROJECT_REF> antes de correr esta migración, o corre el UPDATE manualmente después.
create table if not exists public.app_config (
  key text primary key,
  value text
);

insert into public.app_config (key, value)
values ('push_function_url', 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push')
on conflict (key) do nothing;

-- Función genérica: llama a la Edge Function con un payload de evento.
create or replace function notify_push(p_event text, p_payload jsonb) returns void as $$
declare
  v_url text;
begin
  select value into v_url from public.app_config where key = 'push_function_url';
  if v_url is null or v_url like '%<PROJECT_REF>%' then
    return; -- no configurado todavía, no falla la transacción principal
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('event', p_event, 'payload', p_payload)
  );
end;
$$ language plpgsql security definer;

-- Evento: nuevo tema agregado a un setlist
create or replace function trg_notify_new_song() returns trigger as $$
declare
  v_community_id uuid;
  v_song_title text;
begin
  select community_id into v_community_id from public.setlists where id = new.setlist_id;
  select title into v_song_title from public.songs where id = new.song_id;

  perform notify_push('new_song', jsonb_build_object(
    'community_id', v_community_id,
    'song_title', v_song_title,
    'actor_id', auth.uid()
  ));
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_new_setlist_song
after insert on public.setlist_songs
for each row execute function trg_notify_new_song();

-- Evento: se inició una transmisión en vivo (is_active pasa de false/null a true)
create or replace function trg_notify_live_session() returns trigger as $$
begin
  if new.is_active and (old.is_active is distinct from true) then
    perform notify_push('live_session_started', jsonb_build_object(
      'community_id', new.community_id,
      'actor_id', new.started_by
    ));
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_live_session_change
after insert or update on public.live_sessions
for each row execute function trg_notify_live_session();

-- Evento: nuevo comentario
create or replace function trg_notify_comment() returns trigger as $$
declare
  v_community_id uuid;
  v_song_title text;
begin
  select community_id into v_community_id from public.songs where id = new.song_id;
  select title into v_song_title from public.songs where id = new.song_id;

  perform notify_push('new_comment', jsonb_build_object(
    'community_id', v_community_id,
    'song_title', v_song_title,
    'actor_id', new.profile_id
  ));
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_new_comment
after insert on public.comments
for each row execute function trg_notify_comment();
