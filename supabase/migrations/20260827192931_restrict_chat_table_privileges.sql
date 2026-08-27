-- Supabase public-schema defaults are broader than this application requires.
revoke all on table public.profiles from authenticated;
revoke all on table public.chat_rooms from authenticated;
revoke all on table public.chat_messages from authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.chat_rooms to authenticated;
grant select, insert, delete on table public.chat_messages to authenticated;
