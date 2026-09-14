-- Add time_limit_minutes and is_exam_mode columns to decks table
alter table public.decks
  add column if not exists time_limit_minutes integer default null,
  add column if not exists is_exam_mode boolean default true;
