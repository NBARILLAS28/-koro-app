-- ============================================================
-- KORO — Esquema de base de datos (Supabase / PostgreSQL)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  instrument text, -- ej: "guitarra", "voz", "bajo"
  created_at timestamptz not null default now()
);

-- ---------- COMMUNITIES ----------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_url text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique, -- código corto, ej: "KORO-7F3A"
  max_members int not null default 30,
  created_at timestamptz not null default now()
);

create index on public.communities (invite_code);

-- ---------- COMMUNITY MEMBERS ----------
create type member_role as enum ('admin', 'director', 'member');

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, profile_id)
);

-- ---------- SONGS (biblioteca de temas de la comunidad) ----------
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  artist text,
  original_key text not null default 'C', -- tonalidad original
  bpm int,
  lyrics_chordpro text, -- letra + acordes en formato ChordPro-like: [G]Amazing [C]grace
  youtube_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.songs (community_id);

-- ---------- SETLISTS ----------
create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null, -- ej: "Ensayo martes", "Domingo 14/09"
  event_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index on public.setlists (community_id);

-- ---------- SETLIST SONGS (orden + tonalidad ajustada por setlist) ----------
create table public.setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position int not null default 0,
  transposed_key text, -- si es null, se usa songs.original_key
  notes text,
  unique (setlist_id, song_id)
);

create index on public.setlist_songs (setlist_id);

-- ---------- COMMENTS ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.comments (song_id);

-- ============================================================
-- FUNCIÓN: generar código de invitación único y legible
-- ============================================================
create or replace function generate_invite_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin O/0/I/1 para evitar confusión
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$ language plpgsql;

create or replace function set_invite_code() returns trigger as $$
begin
  if new.invite_code is null or new.invite_code = '' then
    new.invite_code := generate_invite_code();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_invite_code
before insert on public.communities
for each row execute function set_invite_code();

-- Al crear una comunidad, el creador se vuelve admin automáticamente
create or replace function add_owner_as_admin() returns trigger as $$
begin
  insert into public.community_members (community_id, profile_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$ language plpgsql;

create trigger trg_add_owner_as_admin
after insert on public.communities
for each row execute function add_owner_as_admin();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_songs enable row level security;
alter table public.comments enable row level security;

-- Perfiles: cada quien ve/edita el suyo, todos pueden leer perfiles básicos
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Helper: ¿el usuario es miembro de esta comunidad?
create or replace function is_member(cid uuid) returns boolean as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and profile_id = auth.uid()
  );
$$ language sql stable security definer;

create or replace function is_admin_or_director(cid uuid) returns boolean as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and profile_id = auth.uid()
      and role in ('admin', 'director')
  );
$$ language sql stable security definer;

-- Communities: solo miembros ven la comunidad; cualquiera autenticado puede crear una
create policy "communities_select_members" on public.communities
  for select using (is_member(id));
create policy "communities_insert_any_auth" on public.communities
  for insert with check (auth.uid() = owner_id);
create policy "communities_update_admin" on public.communities
  for update using (is_admin_or_director(id));

-- Members: solo miembros de la comunidad ven la lista de miembros
create policy "members_select_same_community" on public.community_members
  for select using (is_member(community_id));
create policy "members_admin_manage" on public.community_members
  for all using (is_admin_or_director(community_id));

-- Songs / Setlists / SetlistSongs / Comments: visibles y editables por miembros
create policy "songs_all_members" on public.songs
  for all using (is_member(community_id)) with check (is_member(community_id));

create policy "setlists_all_members" on public.setlists
  for all using (is_member(community_id)) with check (is_member(community_id));

create policy "setlist_songs_all_members" on public.setlist_songs
  for all using (
    is_member((select community_id from public.setlists where id = setlist_id))
  );

create policy "comments_all_members" on public.comments
  for all using (
    is_member((select community_id from public.songs where id = song_id))
  ) with check (auth.uid() = profile_id);

-- ============================================================
-- FUNCIÓN: unirse a una comunidad por código de invitación
-- ============================================================
create or replace function join_community_by_code(p_code text)
returns uuid as $$
declare
  v_community_id uuid;
  v_member_count int;
  v_max_members int;
begin
  select id, max_members into v_community_id, v_max_members
  from public.communities where invite_code = upper(p_code);

  if v_community_id is null then
    raise exception 'Código de invitación inválido';
  end if;

  select count(*) into v_member_count
  from public.community_members where community_id = v_community_id;

  if v_member_count >= v_max_members then
    raise exception 'Esta comunidad alcanzó el máximo de % integrantes', v_max_members;
  end if;

  insert into public.community_members (community_id, profile_id, role)
  values (v_community_id, auth.uid(), 'member')
  on conflict do nothing;

  return v_community_id;
end;
$$ language plpgsql security definer;

-- Habilitar Realtime en las tablas clave
alter publication supabase_realtime add table public.setlist_songs;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.songs;
