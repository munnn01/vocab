create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('instructor', 'student')),
  username text,
  display_name text,
  instructor_id uuid references public.profiles(user_id) on delete set null,
  class_name text,
  created_at timestamptz not null default now(),
  check (username is null or char_length(username) between 3 and 40),
  check (class_name is null or char_length(class_name) between 1 and 80),
  check (role = 'student' or instructor_id is null)
);

create unique index profiles_username_lower_idx
  on public.profiles (lower(username)) where username is not null;
create index profiles_instructor_idx on public.profiles (instructor_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, username, display_name)
  values (
    new.id,
    'student',
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (user_id, role, display_name)
select id, 'student', coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(email, '@', 1))
from auth.users
on conflict (user_id) do nothing;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$ select role from public.profiles where user_id = auth.uid() $$;

create or replace function public.current_instructor_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$ select instructor_id from public.profiles where user_id = auth.uid() $$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_instructor_id() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_instructor_id() to authenticated;

alter table public.profiles enable row level security;

create policy "Users can read their profile and instructors can read students" on public.profiles
  for select to authenticated using (
    user_id = (select auth.uid())
    or (instructor_id = (select auth.uid()) and public.current_user_role() = 'instructor')
  );

drop policy if exists "Owners can read decks" on public.decks;
drop policy if exists "Owners can create decks" on public.decks;
drop policy if exists "Owners can update decks" on public.decks;
drop policy if exists "Owners can delete decks" on public.decks;

create policy "Instructors and assigned students can read decks" on public.decks
  for select to authenticated using (
    owner_id = (select auth.uid())
    or owner_id = public.current_instructor_id()
  );
create policy "Instructors can create decks" on public.decks
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  );
create policy "Instructors can update decks" on public.decks
  for update to authenticated using (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  ) with check (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  );
create policy "Instructors can delete decks" on public.decks
  for delete to authenticated using (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  );

drop policy if exists "Owners can read words" on public.words;
drop policy if exists "Owners can create words" on public.words;
drop policy if exists "Owners can update words" on public.words;
drop policy if exists "Owners can delete words" on public.words;

create policy "Instructors and assigned students can read words" on public.words
  for select to authenticated using (
    owner_id = (select auth.uid())
    or owner_id = public.current_instructor_id()
  );
create policy "Instructors can create words" on public.words
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and public.current_user_role() = 'instructor'
    and exists (select 1 from public.decks where decks.id = words.deck_id and decks.owner_id = (select auth.uid()))
  );
create policy "Instructors can update words" on public.words
  for update to authenticated using (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  ) with check (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  );
create policy "Instructors can delete words" on public.words
  for delete to authenticated using (
    owner_id = (select auth.uid()) and public.current_user_role() = 'instructor'
  );

drop policy if exists "Owners can read sessions" on public.study_sessions;
drop policy if exists "Owners can create sessions" on public.study_sessions;
drop policy if exists "Owners can update sessions" on public.study_sessions;
drop policy if exists "Owners can delete sessions" on public.study_sessions;

create policy "Users can read their sessions and instructors can read student sessions" on public.study_sessions
  for select to authenticated using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles
      where profiles.user_id = study_sessions.owner_id
        and profiles.instructor_id = (select auth.uid())
        and public.current_user_role() = 'instructor'
    )
  );
create policy "Users can create their sessions" on public.study_sessions
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.decks
      where decks.id = study_sessions.deck_id
        and (decks.owner_id = (select auth.uid()) or decks.owner_id = public.current_instructor_id())
    )
  );
create policy "Users can update their sessions" on public.study_sessions
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Users can delete their sessions" on public.study_sessions
  for delete to authenticated using (owner_id = (select auth.uid()));

grant select on public.profiles to authenticated;
