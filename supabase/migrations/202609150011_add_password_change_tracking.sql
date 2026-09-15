-- Thêm cột theo dõi mật khẩu hiện tại và trạng thái đổi mật khẩu lần đầu
alter table public.profiles
  add column if not exists current_password text,
  add column if not exists has_changed_password boolean default false;

-- Cho phép người dùng cập nhật hồ sơ của chính họ (ví dụ: đổi mật khẩu lần đầu)
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
  for update to authenticated using (
    user_id = (select auth.uid())
  ) with check (
    user_id = (select auth.uid())
  );