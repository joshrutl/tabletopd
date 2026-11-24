-- Tabletopd schema. Paste into the Supabase SQL editor and run (safe to re-run).

-- ---------------------------------------------------------------------------
-- profiles: one row per user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique,
  bio         text not null default '',
  -- 4-slot array, in order, of full Game objects or nulls
  top_four    jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$')
);

-- Usernames are unique regardless of case ("Josh" and "josh" collide).
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- user_games: a user's relationship to a game
--
-- `status` is the single summary value the spec asks for (owned > wishlist >
-- played). Because one game can be owned AND rated AND wishlisted at once, the
-- `owned` / `wishlist` booleans are the source of truth the app reads; `status`
-- is kept in sync by the app for easy querying.
-- ---------------------------------------------------------------------------
create table if not exists public.user_games (
  user_id      uuid    not null references auth.users (id) on delete cascade,
  bgg_id       integer not null,
  game_data    jsonb   not null,
  status       text    not null check (status in ('owned', 'wishlist', 'played')),
  owned        boolean not null default false,
  wishlist     boolean not null default false,
  rating       numeric(2, 1) check (rating is null or (rating >= 0.5 and rating <= 5.0)),
  review_text  text,
  played_date  date,
  updated_at   timestamptz not null default now(),
  primary key (user_id, bgg_id)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_games_set_updated_at on public.user_games;
create trigger user_games_set_updated_at
  before update on public.user_games
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile whenever someone signs up.
-- The username comes from the sign-up metadata; if it is missing, taken or
-- invalid we fall back to a generated one so sign-up never fails.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  begin
    insert into public.profiles (id, username) values (new.id, wanted);
  exception when unique_violation or check_violation then
    insert into public.profiles (id, username)
    values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 8));
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone can read (public profiles later);
-- users can only write their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_games enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "user_games are readable by everyone" on public.user_games;
create policy "user_games are readable by everyone"
  on public.user_games for select using (true);

drop policy if exists "users insert their own user_games" on public.user_games;
create policy "users insert their own user_games"
  on public.user_games for insert with check (auth.uid() = user_id);

drop policy if exists "users update their own user_games" on public.user_games;
create policy "users update their own user_games"
  on public.user_games for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own user_games" on public.user_games;
create policy "users delete their own user_games"
  on public.user_games for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- game_images: shared cache of box-art URLs (one row per BGG game)
-- Written by the /api/bgg/image route. With SUPABASE_SERVICE_ROLE_KEY set the
-- route bypasses RLS; without it, signed-in users' sessions can insert (never
-- update) rows, and only for URLs on BGG's image CDN.
-- ---------------------------------------------------------------------------
create table if not exists public.game_images (
  bgg_id      integer primary key,
  image_url   text not null,
  updated_at  timestamptz not null default now(),
  constraint game_images_url_is_geekdo
    check (image_url ~ '^https://([a-z0-9-]+\.)*geekdo-images\.com/')
);

alter table public.game_images enable row level security;

drop policy if exists "game_images are readable by everyone" on public.game_images;
create policy "game_images are readable by everyone"
  on public.game_images for select using (true);

drop policy if exists "signed-in users can cache new game images" on public.game_images;
create policy "signed-in users can cache new game images"
  on public.game_images for insert to authenticated with check (true);