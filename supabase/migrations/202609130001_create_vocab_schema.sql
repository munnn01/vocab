create extension if not exists pgcrypto;

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  source_file_name text,
  word_count integer not null default 0 check (word_count >= 0),
  created_at timestamptz not null default now()
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  term text not null check (char_length(term) between 1 and 120),
  part_of_speech text not null check (part_of_speech in ('adj', 'n', 'v', 'adv', 'prep', 'pron', 'conj', 'phrase', 'other')),
  meaning text not null check (char_length(meaning) between 1 and 300),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index words_deck_term_pos_idx
  on public.words (deck_id, lower(term), part_of_speech);
create index words_deck_position_idx on public.words (deck_id, position);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  mode text not null check (mode in ('flashcard', 'typing', 'quiz')),
  score integer not null default 0,
  correct_count integer not null default 0 check (correct_count >= 0),
  total_count integer not null default 0 check (total_count >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index study_sessions_owner_created_idx
  on public.study_sessions (owner_id, created_at desc);

alter table public.decks enable row level security;
alter table public.words enable row level security;
alter table public.study_sessions enable row level security;

create policy "Owners can read decks" on public.decks
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners can create decks" on public.decks
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners can update decks" on public.decks
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete decks" on public.decks
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "Owners can read words" on public.words
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners can create words" on public.words
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.decks
      where decks.id = words.deck_id and decks.owner_id = (select auth.uid())
    )
  );
create policy "Owners can update words" on public.words
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete words" on public.words
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "Owners can read sessions" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners can create sessions" on public.study_sessions
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.decks
      where decks.id = study_sessions.deck_id and decks.owner_id = (select auth.uid())
    )
  );
create policy "Owners can update sessions" on public.study_sessions
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners can delete sessions" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = owner_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.decks to authenticated;
grant select, insert, update, delete on public.words to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;
