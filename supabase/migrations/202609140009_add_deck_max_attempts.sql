-- Them cot so lan lam bai toi da cho moi bo tu / bai kiem tra
alter table public.decks add column if not exists max_attempts integer default null;
