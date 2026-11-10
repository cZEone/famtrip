-- Migration 001: fixes for issues #1, #2 and #3.
-- Run once in Supabase → SQL Editor on a project that already ran the ORIGINAL schema.sql.
-- (New projects: just run the current schema.sql, which already includes all of this.)

-- ---------------------------------------------------------------
-- #1  Invite code lives in a private table, never in source control
-- ---------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

-- Sign-up gate: secret invite code + required display name + max 10 members.
-- The advisory lock serialises sign-ups so parallel requests can't exceed the cap.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  v_expected text;
  v_name     text := btrim(coalesce(new.raw_user_meta_data->>'display_name', ''));
begin
  perform pg_advisory_xact_lock(hashtext('family_trip_signup'));

  select value into v_expected from private.settings where key = 'invite_code';
  if v_expected is null
     or upper(btrim(coalesce(new.raw_user_meta_data->>'invite_code', ''))) <> upper(btrim(v_expected)) then
    raise exception 'Wrong invite code';
  end if;

  -- #3: never fall back to the email address as a public name
  if v_name = '' or char_length(v_name) > 40 then
    raise exception 'Display name is required (max 40 characters)';
  end if;

  if (select count(*) from public.profiles) >= 10 then
    raise exception 'This trip is full (max 10 members)';
  end if;

  insert into public.profiles (id, display_name) values (new.id, v_name);
  return new;
end $$;

-- ---------------------------------------------------------------
-- #2  Server-side validation for link and note
-- ---------------------------------------------------------------
alter table public.ideas drop constraint if exists link_is_http;
alter table public.ideas drop constraint if exists link_len;
alter table public.ideas drop constraint if exists note_len;
alter table public.ideas
  add constraint link_is_http check (link is null or link ~* '^https?://[^\s]+$'),
  add constraint link_len     check (link is null or char_length(link) <= 2048),
  add constraint note_len     check (note is null or char_length(note) <= 2000);

-- ---------------------------------------------------------------
-- #3  Members can delete their own account and everything they posted
-- ---------------------------------------------------------------
-- Deleting the auth user cascades to profiles → ideas and votes.
create or replace function public.leave_trip()
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.leave_trip() from public, anon;
grant execute on function public.leave_trip() to authenticated;

-- ---------------------------------------------------------------
-- AFTER running the above: set a NEW invite code (the old one is public in git history).
-- Run this separately, with your own code, and do NOT commit it:
--
--   insert into private.settings (key, value) values ('invite_code', 'YOUR-NEW-CODE')
--   on conflict (key) do update set value = excluded.value;
--
-- Until you do, every sign-up is refused (fails closed).
-- ---------------------------------------------------------------
