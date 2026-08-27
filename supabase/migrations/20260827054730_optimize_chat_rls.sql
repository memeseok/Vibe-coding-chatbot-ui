-- Combine equivalent permissive SELECT policies to avoid repeated checks.
drop policy "Users can read their own profile" on public.profiles;
drop policy "Admins can read all profiles" on public.profiles;

create policy "Users can read their profile and admins can read all"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'app_role') = 'admin'
  );

drop policy "Users can read their own chat rooms" on public.chat_rooms;
drop policy "Admins can read all chat rooms" on public.chat_rooms;

create policy "Users can read their rooms and admins can read all"
  on public.chat_rooms
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'app_role') = 'admin'
  );

drop policy "Users can read their own chat messages" on public.chat_messages;
drop policy "Admins can read all chat messages" on public.chat_messages;

create policy "Users can read their messages and admins can read all"
  on public.chat_messages
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or ((select auth.jwt()) -> 'app_metadata' ->> 'app_role') = 'admin'
  );
