-- Family Trip 2026 — run this once in Supabase → SQL Editor.

-- 1. Members (one row per signed-up family member)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Sign-up gate: correct invite code AND max 10 members.
-- Runs inside the database, so it can't be bypassed from the browser.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'invite_code', '') <> 'FAMILY10' then
    raise exception 'Wrong invite code';
  end if;
  if (select count(*) from public.profiles) >= 10 then
    raise exception 'This trip is full (max 10 members)';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. The one main record: an Idea
create table public.ideas (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('Eat', 'Go', 'Do')),
  note text,
  link text,
  trip_day int check (trip_day between 1 and 60),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. The one shared action: "I'm in" votes (one per person per idea)
create table public.votes (
  idea_id bigint references public.ideas on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  primary key (idea_id, user_id)
);

-- 4. The one rule: members see everything; only the author edits/deletes an idea.
alter table public.profiles enable row level security;
alter table public.ideas    enable row level security;
alter table public.votes    enable row level security;

create policy "members read profiles" on public.profiles for select to authenticated using (true);

create policy "members read ideas"    on public.ideas for select to authenticated using (true);
create policy "members add ideas"     on public.ideas for insert to authenticated with check (author_id = auth.uid());
create policy "author edits idea"     on public.ideas for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author deletes idea"   on public.ideas for delete to authenticated using (author_id = auth.uid());

create policy "members read votes"    on public.votes for select to authenticated using (true);
create policy "vote as yourself"      on public.votes for insert to authenticated with check (user_id = auth.uid());
create policy "unvote yourself"       on public.votes for delete to authenticated using (user_id = auth.uid());
