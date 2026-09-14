-- Đảm bảo cột violation_reason tồn tại trên bảng study_sessions
alter table public.study_sessions
  add column if not exists violation_reason text;

-- Cập nhật ràng buộc kiểm tra
alter table public.study_sessions
  drop constraint if exists study_sessions_violation_reason_check;

alter table public.study_sessions
  add constraint study_sessions_violation_reason_check
  check (violation_reason is null or violation_reason in ('fullscreen_exit', 'left_early'));
