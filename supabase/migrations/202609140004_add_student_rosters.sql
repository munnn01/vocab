create table public.student_rosters (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null check (char_length(class_name) between 1 and 80),
  original_file_name text not null check (char_length(original_file_name) between 1 and 180),
  original_file_base64 text not null,
  sheet_name text not null check (char_length(sheet_name) between 1 and 120),
  worksheet_path text not null check (char_length(worksheet_path) between 1 and 240),
  header_row integer not null check (header_row > 0),
  name_column integer not null check (name_column > 0),
  class_column integer check (class_column is null or class_column > 0),
  student_count integer not null check (student_count between 1 and 100),
  created_at timestamptz not null default now()
);

create index student_rosters_instructor_created_idx
  on public.student_rosters (instructor_id, created_at desc);

alter table public.student_rosters enable row level security;

create policy "Instructors can read their rosters" on public.student_rosters
  for select to authenticated using (
    instructor_id = (select auth.uid())
    and public.current_user_role() = 'instructor'
  );

create policy "Instructors can create their rosters" on public.student_rosters
  for insert to authenticated with check (
    instructor_id = (select auth.uid())
    and public.current_user_role() = 'instructor'
  );

create policy "Instructors can delete their rosters" on public.student_rosters
  for delete to authenticated using (
    instructor_id = (select auth.uid())
    and public.current_user_role() = 'instructor'
  );

grant select, insert, delete on public.student_rosters to authenticated;

alter table public.profiles
  add column roster_id uuid references public.student_rosters(id) on delete set null,
  add column roster_row integer check (roster_row is null or roster_row > 0);

create index profiles_roster_idx on public.profiles (roster_id, roster_row);

alter table public.study_sessions
  add column violation_reason text
  check (violation_reason is null or violation_reason in ('fullscreen_exit', 'left_early'));
