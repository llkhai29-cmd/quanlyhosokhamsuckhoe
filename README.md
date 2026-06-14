# Hệ thống Quản lý Số liệu Hồ sơ Khám sức khỏe định kỳ

Hệ thống ứng dụng web hiện đại xây dựng trên nền tảng **React (TypeScript)**, **Vite**, **Tailwind CSS** và **Firebase (Firestore + Authentication)**, tích hợp xuất báo cáo trực tiếp sang **Google Sheets (qua Google OAuth)**.

---

## 🚀 Hướng dẫn Xuất mã nguồn lên GitHub trực tiếp từ AI Studio

Google AI Studio cung cấp tính năng xuất mã nguồn trực tiếp sang tài khoản GitHub của bạn:

1. **Tìm nút Cài đặt (Settings)**: Ở góc trên bên phải hoặc thanh điều hướng của Google AI Studio.
2. **Chọn Export to GitHub**: 
   - Nhấp chọn **Export to GitHub** (hoặc Download ZIP nếu bạn muốn tải về máy tính trước).
   - Tiến hành liên kết tài khoản GitHub của bạn nếu đây là lần đầu thực hiện.
3. **Tạo Repository mới**: Đặt tên kho lưu trữ mong muốn và nhấn xuất bản. Toàn bộ mã nguồn hoàn chỉnh này sẽ được đẩy lên GitHub của bạn trong vài giây.

---

## 🛠️ Hướng dẫn Chạy ứng dụng dưới máy cục bộ (Local)

Sau khi clone dự án từ GitHub về máy tính cá nhân của bạn, hãy làm theo các bước sau:

### 1. Cài đặt môi trường Node.js
Đảm bảo máy tính của bạn đã cài đặt **Node.js** (Khuyến nghị phiên bản 18 trở lên).

### 2. Cài đặt các thư viện phụ thuộc (Dependencies)
Mở terminal tại thư mục dự án và chạy lệnh:
```bash
npm install
```

### 3. Thiết lập biến môi trường (Environment Variables)
Sao chép tệp cấu hình mẫu thành một tệp cục bộ:
```bash
cp .env.example .env
```
Mở tệp `.env` vừa tạo và điền các khóa cấu hình Firebase cũng như Google OAuth của bạn (nếu có):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- ...

### 4. Chạy chế độ Phát triển (Development Mode)
Khởi động máy chủ phát triển cục bộ bằng lệnh:
```bash
npm run dev
```
Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000` (hoặc cổng được hiển thị trong terminal).

### 5. Biên dịch sản phẩm (Build for Production)
Để nén và biên dịch mã nguồn tối ưu cho việc triển khai thật:
```bash
npm run build
```
Thư mục sản phẩm `/dist` sẽ được tạo ra chứa toàn bộ mã nguồn tĩnh sẵn sàng triển khai.

---

## 🌐 Hướng dẫn Triển khai miễn phí lên GitHub Pages

Vì đây là ứng dụng chạy hoàn toàn phía Client (Single Page Application - SPA), bạn có thể dễ dàng tải lên **GitHub Pages** hoàn toàn miễn phí:

### Cách nhanh nhất bằng thư viện `gh-pages`:

1. **Cài đặt thư viện phát triển:**
   ```bash
   npm install -D gh-pages
   ```

2. **Cấu hình `vite.config.ts`:**
   Mở tệp `vite.config.ts` và đảm bảo thuộc tính `base` trỏ tới tên repository của bạn trên GitHub để khớp đường dẫn tĩnh:
   ```typescript
   export default defineConfig({
     base: '/<ten-repository-cua-ban>/',
     // ... các cấu hình khác
   });
   ```

3. **Thêm kịch bản triển khai vào `package.json`:**
   Mở `package.json`, thêm 2 dòng lệnh dưới phần `"scripts"`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist",
     ...
   }
   ```

4. **Kích hoạt triển khai lên Internet:**
   Chạy lệnh sau tại terminal:
   ```bash
   npm run deploy
   ```
   Hệ thống sẽ tự động build ứng dụng và đẩy nhánh lên GitHub. Ứng dụng của bạn sẽ hoạt động trực tiếp tại địa chỉ:  
   `https://<ten-user-cua-ban>.github.io/<ten-repository-cua-ban>/`
