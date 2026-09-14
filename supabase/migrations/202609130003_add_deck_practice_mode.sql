alter table public.decks
  add column practice_mode text not null default 'typing'
  check (practice_mode in ('typing', 'quiz'));
