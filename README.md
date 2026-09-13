# Từ Vựng Mỗi Ngày

Ứng dụng học từ vựng từ file PDF, chạy trên Vercel và lưu dữ liệu bằng Supabase.

## Chức năng

- Đọc PDF trực tiếp trên trình duyệt theo định dạng `new(adj): mới`.
- Nhận diện các loại từ: `adj`, `n`, `v`, `adv`, `prep`, `pron`, `conj`, `phrase` và các tên tiếng Anh/tiếng Việt tương ứng.
- Xem lại danh sách từ trước khi lưu.
- Học bằng flashcard, gõ đáp án hoặc trắc nghiệm.
- Đáp án nhiễu của trắc nghiệm được lấy ngẫu nhiên từ cùng loại từ; khi bộ từ chưa đủ, ứng dụng bổ sung từ cùng loại trong ngân hàng có sẵn.
- Toàn màn hình, phím tắt và giao diện responsive.
- Cảnh báo khi back/đóng tab; xác nhận rời phiên sẽ trừ 5 điểm.
- Lưu bộ từ và lịch sử học trong Supabase với Row Level Security.
- Đăng nhập riêng cho giảng viên và sinh viên; không có đăng ký công khai.
- Giảng viên tạo tối đa 50 tài khoản sinh viên ngẫu nhiên mỗi đợt.
- Xuất tên đăng nhập và mật khẩu thành file Excel `.xlsx` để cấp cho lớp.
- Sinh viên chỉ đọc bộ từ của giảng viên đã gán và lưu tiến độ của chính mình.

## Chạy cục bộ

```bash
npm install
copy .env.example .env.local
npm run dev
```

Nếu chưa thêm biến môi trường Supabase, ứng dụng vẫn chạy ở chế độ xem thử nhưng dữ liệu PDF chỉ tồn tại trong phiên hiện tại.

## Cấu hình Supabase

1. Tạo một project Supabase.
2. Mở **SQL Editor**, chạy lần lượt:
   - `supabase/migrations/202609130001_create_vocab_schema.sql`
   - `supabase/migrations/202609130002_add_teacher_student_roles.sql`
3. Trong **Authentication → Providers**, tắt Anonymous Sign-Ins và giữ Email/Password.
4. Điền các biến vào `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` chỉ dành cho Vercel Function. Tuyệt đối không đổi tên nó thành biến bắt đầu bằng `VITE_`, không commit vào GitHub và không dùng trong frontend.

## Cấp tài khoản giảng viên

Ứng dụng không cho tự đăng ký giảng viên.

1. Vào **Supabase → Authentication → Users → Add user**, nhập email và mật khẩu do bạn chọn, rồi bật xác nhận email.
2. Mở `supabase/promote_instructor.example.sql`, đổi email và tên giảng viên.
3. Chạy câu lệnh trong **SQL Editor**.

Sau khi đăng nhập, giảng viên mở tab **Tài khoản sinh viên**, nhập tên lớp, tiền tố và số lượng. Mật khẩu sinh viên không được lưu dạng đọc được trong bảng dữ liệu; vì vậy cần tải file Excel ngay sau mỗi lần tạo.

## Deploy Vercel

1. Import repository này trong Vercel.
2. Framework Preset: **Vite**.
3. Thêm đủ bốn biến môi trường trong `.env.example`. Đánh dấu `SUPABASE_SERVICE_ROLE_KEY` là biến chỉ dùng phía máy chủ.
4. Deploy. `vercel.json` đã cấu hình fallback về `index.html`.

## Kiểm tra

```bash
npm test
npm run build
```

PDF dạng ảnh scan chưa có lớp text sẽ không đọc được; cần OCR file trước khi tải lên.
