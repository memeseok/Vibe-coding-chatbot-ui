-- Store authenticated user profiles, chat rooms, and messages with RLS.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamp with time zone not null default now()
);

create table public.chat_rooms (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint chat_rooms_title_length check (
    char_length(title) between 1 and 120
  ),
  constraint chat_rooms_id_user_id_key unique (id, user_id)
);

create table public.chat_messages (
  id uuid primary key,
  room_id uuid not null,
  user_id uuid not null,
  role text not null,
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  web_search_used boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint chat_messages_room_owner_fkey
    foreign key (room_id, user_id)
    references public.chat_rooms (id, user_id)
    on delete cascade,
  constraint chat_messages_role_check check (
    role in ('user', 'assistant', 'notice')
  ),
  constraint chat_messages_content_length check (
    char_length(content) between 1 and 32000
  ),
  constraint chat_messages_sources_array check (
    jsonb_typeof(sources) = 'array'
  )
);

create index chat_rooms_user_updated_id_idx
  on public.chat_rooms (user_id, updated_at desc, id desc);

create index chat_messages_room_owner_created_id_idx
  on public.chat_messages (room_id, user_id, created_at, id);

create index chat_messages_user_created_id_idx
  on public.chat_messages (user_id, created_at desc, id desc);

alter table public.profiles enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (
    ((select auth.jwt()) -> 'app_metadata' ->> 'app_role') = 'admin'
  );

create policy "Users can read their own chat rooms"
  on public.chat_rooms
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Admins can read all chat rooms"
  on public.chat_rooms
  for select
  to authenticated
  using (
    ((select auth.jwt()) -> 'app_metadata' ->> 'app_role') = 'admin'
  );

create policy "Users can create their own chat rooms"
  on public.chat_rooms
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own chat rooms"
  on public.chat_rooms
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own chat rooms"
  on public.chat_rooms
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own chat messages"
  on public.chat_messages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Admins can read all chat messages"
  on public.chat_messages
  for select
  to authenticated
  using (
    ((select auth.jwt()) -> 'app_metadata' ->> 'app_role') = 'admin'
  );

create policy "Users can create their own chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own chat messages"
  on public.chat_messages
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.chat_rooms from anon;
revoke all on table public.chat_messages from anon;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.chat_rooms to authenticated;
grant select, insert, delete on table public.chat_messages to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.chat_rooms to service_role;
grant all on table public.chat_messages to service_role;

create or replace function private.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, created_at)
  values (
    new.id,
    coalesce(new.email, new.phone, new.id::text),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '사용자'
    ),
    new.created_at
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name;

  return new;
end;
$$;

revoke execute on function private.sync_user_profile()
  from public, anon, authenticated;

create trigger sync_user_profile_after_auth_change
  after insert or update of email, phone, raw_user_meta_data
  on auth.users
  for each row
  execute function private.sync_user_profile();

insert into public.profiles (id, email, display_name, created_at)
select
  users.id,
  coalesce(users.email, users.phone, users.id::text),
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    '사용자'
  ),
  users.created_at
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name;
