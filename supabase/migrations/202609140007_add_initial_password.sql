-- Thêm cột initial_password cho bảng profiles nếu chưa có
alter table public.profiles
  add column if not exists initial_password text;
