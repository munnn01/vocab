-- Cấp đầy đủ quyền cho service_role và authenticated trên tất cả các bảng
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all routines in schema public to postgres, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant select, insert, update, delete on public.student_rosters to authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.decks to authenticated, service_role;
grant select, insert, update, delete on public.words to authenticated, service_role;
grant select, insert, update, delete on public.study_sessions to authenticated, service_role;
