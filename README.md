# Hệ Thống Đặt Cược World Cup 2026 (Angular + Node.js + Excel Database + Docker)

Dự án là một hệ thống Full-Stack (Monorepo) hỗ trợ đặt cược các trận đấu World Cup 2026. Thay vì sử dụng các cơ sở dữ liệu truyền thống, hệ thống sử dụng các tệp **Excel (.xlsx)** làm cơ sở dữ liệu trực quan, giúp người dùng dễ dàng mở trực tiếp bằng Microsoft Excel hoặc Google Sheets để xem và quản lý.

## 🛠️ Công Nghệ & Tính Năng Nổi Bật

- **Frontend**: [Angular (v21)](./frontend) - Sử dụng Standalone Components, giao diện tối ưu hóa hiển thị trên mọi thiết bị di động (Responsive), các stylesheet tùy chỉnh đặt tại `frontend/src/styles.css`.
- **Backend**: [Node.js & Express](./backend-excel) - Cung cấp RESTful API, tự động đồng bộ lịch thi đấu từ FIFA API và cập nhật kết toán điểm thắng/thua tự động cho người chơi.
- **Database**: **Excel (.xlsx)** - Lưu trữ tài khoản, lịch thi đấu, và các lượt đặt cược trong thư mục `backend-excel/data/`.
  - Toàn bộ tên cột (headers) trong các tệp Excel được ghi ở dạng **CHỮ IN HOA** (ví dụ: `ID`, `DATE`, `MATCHID`, `BETTYPE`, `STAKE`, `STATUS`, `PAYOUT`) để tăng độ rõ ràng.
  - Cửa cược của người dùng được lưu trực tiếp dưới dạng **tên đội tuyển cược thắng** (ví dụ: `USA`, `France`) hoặc chữ `Draw` nếu chọn kết quả hòa.
- **Containerization**: Docker & Docker Compose để đóng gói chạy đa dịch vụ dễ dàng.

### 🌟 Các Tính Năng Giao Diện
1. **Lịch Thi Đấu & Đặt Cược**: Đồng bộ trực tiếp từ FIFA API, tự động hiển thị tỉ số trực tiếp (LIVE) và hết giờ (FT). Cho phép đặt cược nhanh 10.000đ cho các trận chưa đấu.
2. **Bảng Điều Khiển & Phân Tích (Dashboard)**: Thống kê tổng số đơn cược, tỉ lệ dự đoán chính xác, tổng điểm đã cược, và tính toán điểm lợi nhuận ròng trực quan.
3. **Lịch Sử Cược Responsive**: Tự động chuyển đổi từ dạng bảng sang dạng thẻ (Card Grid) khi xem trên thiết bị di động để tránh bị tràn màn hình. Cho phép hủy đơn cược của các trận chưa đấu.
4. **Bảng Xếp Hạng Cao Thủ (Leaderboard)**: Thống kê hiệu suất dự đoán của tất cả thành viên, trao huy chương danh dự cho Top 3 người chơi dẫn đầu.
5. **Hỗ Trợ Song Ngữ**: Nút chuyển đổi ngôn ngữ linh hoạt giữa tiếng Việt (VI) và tiếng Anh (EN).

---

## 📋 Luật Chơi & Quy Tắc Hệ Thống

Hệ thống áp dụng các quy tắc đặt cược và tính điểm tối giản, công bằng và dễ hiểu như sau:

### 1. Số Tiền Đặt Cược (Stake)
- **Cố định:** Mỗi đơn cược luôn mặc định là **10.000 ₫**.
- Người chơi không cần (và không thể) tự nhập số tiền khác. Quy định này giúp người chơi cạnh tranh công bằng dựa trên tỷ lệ đoán trúng.

### 2. Thời Gian Khóa Kèo (Lock Time)
- **Thời gian hợp lệ:** Chỉ được phép **Đặt cược** hoặc **Hủy cược** đối với các trận đấu đang ở trạng thái **Chưa diễn ra** (`scheduled`).
- **Khóa cược:** Ngay khi trận đấu bắt đầu (trạng thái **Trực tiếp - LIVE**) hoặc kết thúc (**Hết giờ - FT**), kèo cược sẽ tự động bị **KHÓA**. Bạn không thể đặt cược mới hoặc hủy đơn cược đã đặt cho trận đấu đó.

### 3. Cách Kết Toán & Tính Điểm (Payout)
Sau khi trận đấu có tỉ số chính thức, hệ thống sẽ tự động cập nhật kết quả của đơn cược:

| Kết Quả Dự Đoán | Trạng Thái Đơn | Số Điểm Thay Đổi (Lợi Nhuận) | Ý Nghĩa |
| :--- | :--- | :--- | :--- |
| **Đoán Đúng** | Thắng cược (`won`) | `0 ₫` | Giữ nguyên điểm, không bị trừ tiền. |
| **Đoán Sai** | Thua cược (`lost`) | `-10.000 ₫` | Bị trừ đi số tiền cược của trận đó. |

*Bảng xếp hạng (Leaderboard) sẽ xếp hạng người chơi dựa trên tổng điểm lợi nhuận ròng này (ai bị trừ ít điểm nhất/thắng nhiều nhất sẽ đứng đầu).*

### 4. Quy Tắc Đối Với Trận Hòa Ở Vòng Loại Trực Tiếp (Knockout)
- Ở vòng đấu loại trực tiếp (knockout, chung kết), trận đấu bắt buộc phải có đội thắng/thua (thông qua hiệp phụ hoặc sút luân lưu).
- Nếu hai đội hòa nhau sau thời gian đá chính, hệ thống API tự động sẽ **tạm dừng kết toán tự động** đối với trận đấu đó để tránh trừ nhầm điểm của người chơi. Quản trị viên (Admin) sẽ phân định kết quả đi tiếp cuối cùng và kết toán thủ công sau.

---

## 📂 Cấu Trúc Mã Nguồn Thực Tế

```text
bet-wc2026/
├── backend-excel/               # Mã nguồn Backend (Node.js + Express)
│   ├── data/                    # Thư mục chứa các tệp Excel Database (.xlsx)
│   │   ├── accounts.xlsx        # Danh sách tài khoản người dùng & Admin (tiêu đề cột IN HOA)
│   │   ├── matches.xlsx         # Chi tiết các trận đấu từ FIFA API (tiêu đề cột IN HOA)
│   │   └── bets.xlsx            # Danh sách chi tiết các đơn đặt cược (tiêu đề cột IN HOA)
│   ├── init-data.js             # Script khởi tạo dữ liệu mẫu và đồng bộ lịch thi đấu ban đầu
│   ├── server.js                # Điểm khởi chạy API Express và phục vụ các file tĩnh của Angular
│   ├── Dockerfile               # Cấu hình Docker cho Backend
│   └── package.json             # Khai báo thư viện Backend (express, xlsx, bcryptjs...)
├── frontend/                    # Mã nguồn Frontend (Angular 21)
│   ├── src/                     # Cấu trúc mã nguồn Angular
│   │   ├── app/
│   │   │   ├── services/        # Các service tương tác API và xử lý ngôn ngữ
│   │   │   ├── app.ts           # Logic thành phần chính
│   │   │   └── app.html         # Giao diện Angular (gồm trang đặt cược và Dashboard mới)
│   │   ├── index.html           # File HTML gốc của ứng dụng
│   │   ├── main.ts              # Điểm khởi động của Angular Application
│   │   └── styles.css           # File stylesheet tùy chỉnh của toàn bộ giao diện (chứa CSS responsive)
│   ├── nginx.conf               # Cấu hình Nginx phục vụ tệp tĩnh trong Docker
│   ├── Dockerfile               # Đóng gói và build Angular tĩnh
│   └── package.json             # Khai báo thư viện Frontend
├── docker-compose.yml           # File cấu hình khởi chạy Docker đa container
├── package.json                 # Cấu hình Monorepo (Scripts cài đặt & Build chung)
└── railway_deployment.md        # Hướng dẫn chi tiết triển khai lên Railway Cloud
```

---

## 🚀 Hướng Dẫn Khởi Chạy Dự Án

Chọn một trong hai cách dưới đây để chạy ứng dụng của bạn:

### Cách 1: Chạy Bằng Docker Compose (Khuyên Dùng)

Yêu cầu máy của bạn đã cài đặt **Docker** và **Docker Compose**.

1. **Khởi chạy toàn bộ dịch vụ:**
   ```bash
   docker-compose up --build -d
   ```
2. **Khởi tạo dữ liệu ban đầu (Chỉ cần chạy lần đầu tiên):**
   ```bash
   docker compose exec backend npm run init
   ```

* **Cổng truy cập ứng dụng:**
  - **Frontend Web**: [http://localhost:80](http://localhost:80)
  - **Backend API**: [http://localhost:3000/api](http://localhost:3000/api)

---

### Cách 2: Chạy Trực Tiếp Với Node.js / NPM (Local)

Yêu cầu máy của bạn đã cài đặt **Node.js (v20+)** và **NPM**.

1. **Cài đặt thư viện và build Frontend tĩnh:**
   Chạy lệnh này tại thư mục gốc của dự án:
   ```bash
   npm run build
   ```
2. **Khởi tạo dữ liệu Excel Database:**
   Tải lịch thi đấu trực tiếp từ FIFA API và tạo tài khoản Admin mặc định:
   ```bash
   npm run init-data
   ```
3. **Bắt đầu chạy Server:**
   ```bash
   npm run start
   ```

* **Cổng truy cập ứng dụng:**
  - **Ứng dụng Full-Stack**: [http://localhost:3000](http://localhost:3000) (Tự động chuyển hướng từ `/` sang `/bet-wc/`).
  - **API Backend**: `http://localhost:3000/api`

---

## 👤 Tài Khoản Đăng Nhập Mặc Định

Sau khi chạy lệnh khởi tạo dữ liệu, bạn có thể đăng nhập bằng các tài khoản sau:

| Tên Đăng Nhập (Username) | Mật Khẩu (Password) | Vai Trò (Role) | Họ Tên (Full Name) |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Quản trị viên (Admin) | Administrator |
| **lctran** | `lctran123` | Quản trị viên (Admin) | Lê Công Trân |
| **cam** | `cam123` | Người dùng (User) | Nguyễn Thị Cam |

*Tài khoản Admin có quyền cập nhật kết quả trận đấu, hệ thống sẽ tự động tính điểm thắng/thua cho các lượt cược liên quan.*

---

## 🌐 Chia Sẻ Ứng Dụng Ra Internet (Public Exposing)

Để người khác có thể truy cập vào máy local của bạn để trải nghiệm ứng dụng đặt cược, sử dụng một trong các công cụ sau:

* **Localtunnel:**
  ```bash
  # Nếu chạy Docker (cổng 80)
  npx localtunnel --port 80
  
  # Nếu chạy trực tiếp NPM (cổng 3000)
  npx localtunnel --port 3000
  ```
* **Ngrok:**
  ```bash
  ngrok http 80      # Hoặc ngrok http 3000
  ```

---

## ☁️ Triển Khai Lên Máy Chủ Đám Mây (Railway)

Dự án này đã được tối ưu hóa tối đa để chạy trên nền tảng đám mây **Railway.app**. Bạn có hai lựa chọn khi triển khai:
1. **Dịch vụ Đơn nhất (Monolithic Service - Khuyên dùng & Tiết kiệm chi phí):** Chạy toàn bộ hệ thống bằng 1 container duy nhất.
2. **Đa Dịch Vụ (Multi-Service Docker Compose):** Chạy tách biệt Frontend & Backend.

> [!IMPORTANT]
> **Lưu ý quan trọng về lưu trữ dữ liệu (Data Persistence):**
> Do dự án sử dụng các tệp Excel làm database lưu ngay trên ổ đĩa của container, bạn **bắt buộc phải gắn volume** (Persistent Volume) vào Service của mình tại thư mục `/app/backend-excel/data` (đối với Single Service) hoặc `/app/data` (đối với Docker Compose) để tránh mất mát dữ liệu khi server restart hoặc build lại.

Xem chi tiết từng bước thiết lập đám mây tại: [Hướng dẫn triển khai Railway.md](./railway_deployment.md).


