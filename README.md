# Hệ Thống Đặt Cược World Cup 2026 (Angular + Spring Boot + PostgreSQL + Docker)

Dự án đã được chuyển đổi thành công từ một trang web tĩnh sang kiến trúc Full-Stack hoàn chỉnh:
- **Frontend**: Angular 17+ (Vite + esbuild, standalone components)
- **Backend**: Spring Boot 3 REST API
- **Database**: PostgreSQL 16
- **Containerization**: Docker & Docker Compose

---

## 1. Khởi Chạy Dự Án Bằng Docker (Local)

Để chạy toàn bộ hệ thống (Database, API, và Frontend), bạn chỉ cần chạy một lệnh duy nhất ở thư mục gốc của dự án:

```bash
docker-compose up --build -d
```

### Các Cổng Truy Cập:
- **Frontend Client**: [http://localhost:80](http://localhost:80)
- **Backend API**: [http://localhost:8080/api](http://localhost:8080/api)
- **PostgreSQL Database**: `localhost:5432` (User: `postgres`, Password: `postgres`, DB: `wc2026_betting`)

Để dừng và xóa các container:
```bash
docker-compose down
```

---

## 2. Công Cụ Công Khai Ứng Dụng (Public Exposing)

Để mọi người có thể truy cập trang web của bạn từ bất kỳ đâu trên Internet ngay lập tức từ máy tính cá nhân của bạn, bạn có thể sử dụng các công cụ đường hầm (tunneling tools) hoàn toàn miễn phí.

### Cách 1: Sử dụng Localtunnel (Không cần đăng ký tài khoản)
Chạy lệnh sau trong Command Prompt / PowerShell:
```bash
npx localtunnel --port 80
```
Hệ thống sẽ tạo ra một URL công khai dạng: `https://xxxx.localtunnel.me`. Bất kỳ ai cũng có thể truy cập URL này để sử dụng trang web của bạn.

### Cách 2: Sử dụng Ngrok (Bảo mật và ổn định cao)
1. Tải và cài đặt [Ngrok](https://ngrok.com/).
2. Đăng ký tài khoản miễn phí và lấy token cấu hình.
3. Chạy lệnh:
```bash
ngrok http 80
```
URL công khai dạng `https://xxxx.ngrok-free.app` sẽ được hiển thị trên console.

---

## 3. Triển Khai Lên Máy Chủ Đám Mây (Cloud Production Hosting)

Nếu bạn muốn ứng dụng hoạt động 24/7 độc lập mà không cần bật máy tính của mình, bạn có thể triển khai lên các dịch vụ đám mây hỗ trợ Docker.

### Tùy chọn A: Railway (Được đề xuất - Tự động nhận diện docker-compose)
1. Đăng ký tài khoản tại [Railway.app](https://railway.app/).
2. Tạo một **New Project** -> chọn **Deploy from GitHub repo**.
3. Railway sẽ tự động nhận diện tệp `docker-compose.yml` và khởi tạo các service (PostgreSQL, Backend, Frontend) tương ứng.
4. Chọn Service `frontend` -> **Generate Domain** để nhận link công khai truy cập.

### Tùy chọn B: Render (Dễ cấu hình và miễn phí)
1. Đăng ký tài khoản tại [Render.com](https://render.com/).
2. **Database (PostgreSQL)**: Chọn **New PostgreSQL** -> điền tên cơ sở dữ liệu -> Tạo. Sao chép chuỗi kết nối (Internal Database URL).
3. **Backend**: Chọn **New Web Service** -> kết nối repository -> chọn môi trường **Docker** -> Cấu hình các Environment Variables:
   - `DB_HOST`: Host của Render DB vừa tạo.
   - `DB_PORT`: `5432`
   - `spring.datasource.url`: Dán URL database của Render.
4. **Frontend**: Chọn **New Static Site** (hoặc Web Service từ Dockerfile) -> Chọn thư mục `./frontend` -> build từ Dockerfile.
