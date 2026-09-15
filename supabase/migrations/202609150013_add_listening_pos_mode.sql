-- Migration to support listening_pos practice mode in decks table

do $\$
begin
  if exists (
    select 1
    from information_schema.constraint_column_usage
    where table_name = 'decks' and column_name = 'practice_mode'
  ) then
    alter table public.decks drop constraint if exists decks_practice_mode_check;
  end if;

  alter table public.decks add constraint decks_practice_mode_check
    check (practice_mode in ('typing', 'quiz', 'listening', 'listening_pos'));
exception
  when others then
    null;
end $\$;
