# ⚽ Hệ Thống Đặt Cược World Cup 2026 (Angular + Node.js + Excel DB)

Hệ thống đặt cược World Cup 2026 sử dụng cơ sở dữ liệu bằng các tệp **Excel (.xlsx)** lưu tại `backend-excel/data/`. Bạn có thể trực tiếp mở, xem hoặc chỉnh sửa các tệp Excel này rất dễ dàng.

---

## 📋 Luật Chơi & Tính Điểm

1. **Số tiền cược**: Mỗi lượt cược mặc định là **10.000 ₫** (hệ thống tự động áp dụng).
2. **Số lần cược**: Mỗi người chơi chỉ được đặt cược **tối đa 1 lần / trận**. Giao diện sẽ hiển thị nút cược là **ĐÃ CƯỢC** và bị vô hiệu hóa sau khi đặt cược thành công.
3. **Khóa kèo**: Hệ thống tự động khóa cược khi trận đấu đang diễn ra (**LIVE**) hoặc đã kết thúc (**FT**).
4. **Quy tắc cửa cược (cột `BETTYPE`)**:
   - Cược đội nhà hoặc đội khách thắng: Lưu tên đội tuyển bằng tiếng Anh (Ví dụ: `USA`, `France`).
   - Chọn cửa Hòa: Lưu chữ `Draw` (không sử dụng chữ "hòa" hoặc "hóa").
5. **Cách tính điểm**:
   - **Đoán Đúng**: Nhận `0 ₫` (không bị trừ điểm).
   - **Đoán Sai**: Trừ **-10.000 ₫** vào điểm xếp hạng.
6. **Vòng loại trực tiếp (Knockout)**: Không có kết quả Hòa. Nếu trận đấu có tỉ số hòa sau 90 phút, hệ thống sẽ tạm dừng kết toán tự động để Admin cập nhật tỉ số hiệp phụ/luân lưu và phân định đội thắng thủ công.

---

## 📊 Cấu Trúc Database Excel

Các file Excel đặt tại thư mục `backend-excel/data/`. Tất cả **tiêu đề cột** đều được viết bằng **CHỮ IN HOA**.

* **`accounts.xlsx`**: Lưu tài khoản người dùng.
  * Các cột: `ID`, `USERNAME`, `PASSWORD`, `FULLNAME`, `ROLE`.
* **`matches.xlsx`**: Lịch thi đấu (đồng bộ tự động từ FIFA API).
  * Các cột: `ID`, `GROUPKEY`, `ROUND`, `TIME` (Giờ VN), `HOMETEAMNAME`, `HOMETEAMFLAG`, `AWAYTEAMNAME`, `AWAYTEAMFLAG`, `STATUS`, `HOMETEAMGOALS`, `AWAYTEAMGOALS`, `ELAPSEDMINUTES`, `STADIUM`.
* **`bets.xlsx`**: Danh sách đơn đặt cược.
  * Các cột: `ID`, `DATE`, `NAME`, `USERNAME`, `MATCHID`, `MATCHNAME`, `BETTYPE`, `STAKE`, `STATUS` (`pending`/`won`/`lost`), `PAYOUT`.

---

## 🚀 Hướng Dẫn Chạy Dự Án

### Cách 1: Chạy trực tiếp trên máy (Khuyên dùng khi Dev)
Yêu cầu đã cài đặt **Node.js (v20+)**:

1. **Cài đặt & Build:**
   ```bash
   npm run build
   ```
2. **Khởi tạo dữ liệu ban đầu:**
   ```bash
   npm run init-data
   ```
3. **Khởi động server:**
   ```bash
   npm run start
   ```
4. **Truy cập:** [http://localhost:3000](http://localhost:3000) (Trang web tự động chuyển hướng sang `/bet-wc/`).

---

### Cách 2: Chạy qua Docker
1. **Khởi chạy container:**
   ```bash
   docker-compose up --build -d
   ```
2. **Khởi tạo dữ liệu Excel ban đầu:**
   ```bash
   docker compose exec backend npm run init
   ```
3. **Truy cập:**
   - **Giao diện Web:** [http://localhost:80](http://localhost:80)
   - **API Backend:** [http://localhost:3000/api](http://localhost:3000/api)

---

## 👤 Tài Khoản Đăng Nhập Mặc Định

| Username | Mật Khẩu | Vai Trò (Role) | Họ Tên | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Admin | Administrator | Quản lý trận đấu, cập nhật tỉ số, phân định kết quả |
| **lctran** | `lctran123` | Admin | Tran Chanh Luan | Quản lý trận đấu, cập nhật tỉ số, phân định kết quả |
| **cam** | `cam123` | User | Nguyễn Thị Cam | Tham gia đặt cược, xem bảng xếp hạng, lịch sử cược |

---

## 📂 Sơ Đồ Thư Mục
* `backend-excel/`: Mã nguồn API Node.js & thư mục lưu Excel Database `data/`.
* `frontend/`: Ứng dụng client viết bằng Angular 21 (quản lý đặt cược, dashboard thống kê & phân trang lịch sử cược 4 đơn/trang).
* `docker-compose.yml`: Cấu hình Docker để chạy Backend và Frontend song song.
