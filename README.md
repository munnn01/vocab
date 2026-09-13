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

## Chạy cục bộ

```bash
npm install
copy .env.example .env.local
npm run dev
```

Nếu chưa thêm biến môi trường Supabase, ứng dụng vẫn chạy ở chế độ xem thử nhưng dữ liệu PDF chỉ tồn tại trong phiên hiện tại.

## Cấu hình Supabase

1. Tạo một project Supabase.
2. Mở **Authentication → Providers → Anonymous Sign-Ins** và bật đăng nhập ẩn danh.
3. Mở **SQL Editor**, chạy file `supabase/migrations/202609130001_create_vocab_schema.sql`.
4. Điền URL và anon key vào `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Không đưa `service_role` key vào ứng dụng frontend.

## Deploy Vercel

1. Import repository này trong Vercel.
2. Framework Preset: **Vite**.
3. Thêm hai biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
4. Deploy. `vercel.json` đã cấu hình fallback về `index.html`.

## Kiểm tra

```bash
npm test
npm run build
```

PDF dạng ảnh scan chưa có lớp text sẽ không đọc được; cần OCR file trước khi tải lên.
