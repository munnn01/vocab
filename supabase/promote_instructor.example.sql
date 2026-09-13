-- 1. Tạo người dùng bằng Supabase Dashboard: Authentication > Users > Add user.
-- 2. Đổi email và tên bên dưới, rồi chạy câu lệnh này trong SQL Editor.
-- Không lưu mật khẩu giảng viên trong file SQL hoặc GitHub.

insert into public.profiles (user_id, role, display_name)
select id, 'instructor', 'Giảng viên'
from auth.users
where lower(email) = lower('giangvien@example.com')
on conflict (user_id) do update
set role = 'instructor',
    display_name = excluded.display_name,
    instructor_id = null,
    username = null,
    class_name = null;
