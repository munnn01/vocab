-- Thêm cột danh sách các lớp được mở quyền học cho bộ từ
-- Nếu unlocked_classes là null: Mở cho tất cả các lớp (mặc định)
-- Nếu unlocked_classes là mảng text[] (ví dụ: ARRAY['12A1', '12A2']): Chỉ các lớp trong mảng mới được học
alter table public.decks
  add column if not exists unlocked_classes text[] default null;
