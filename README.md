# Trạm KV9 — Dashboard PWA

Ứng dụng web (PWA) cho **Trạm Chăn nuôi và Thú y Khu vực 9**. Cài được như app trên
điện thoại/máy tính, chạy offline, và có thể đóng gói lên CH Play / App Store.

## 📁 Các file trong thư mục

| File | Vai trò |
|------|---------|
| `index.html` | Toàn bộ giao diện + dữ liệu + JavaScript (1 file duy nhất) |
| `manifest.webmanifest` | Khai báo app: tên, icon, màu, chế độ hiển thị |
| `sw.js` | Service worker — giúp app chạy được khi **offline** |
| `icon.svg` / `icon-maskable.svg` | Biểu tượng ứng dụng |
| `README.md` | File hướng dẫn này |

## ✅ Có gì mới so với bản cũ

- 🌙 **Chế độ tối (dark mode)** — nút "Tối/Sáng" ở góc phải thanh menu, tự ghi nhớ lựa chọn.
- ⬇️ **Cài đặt như app** — nút "Cài app" hiện ra khi trình duyệt hỗ trợ.
- 📴 **Chạy offline** — đã xem một lần thì lần sau không có mạng vẫn mở được.
- 📱 **Responsive** đầy đủ cho điện thoại / máy tính bảng / máy tính.

---

## 🖥️ Xem nhanh tại máy

Nhấp đúp `index.html` để mở bằng trình duyệt.

> ⚠️ Lưu ý: khi mở bằng `file://` thì **nút Cài app và chạy offline sẽ KHÔNG hoạt động**
> (đó là quy định bảo mật của trình duyệt — PWA cần `http`/`https`). Muốn thử đầy đủ,
> hãy đưa lên mạng theo hướng dẫn bên dưới.

---

## 🌐 Cách 1 — Đưa lên GitHub Pages (KHUYẾN NGHỊ, miễn phí, link cố định)

GitHub Pages cho bạn một địa chỉ web `https://<tên-bạn>.github.io/kv9-app/` mà
**ai có link cũng xem được**, và đây cũng là điều kiện bắt buộc để đóng gói lên store.

1. Tạo tài khoản tại https://github.com (miễn phí) nếu chưa có.
2. Bấm **New repository** → đặt tên ví dụ `kv9-app` → chọn **Public** → **Create**.
3. Ở trang repo mới, bấm **uploading an existing file** → kéo thả **tất cả** file trong
   thư mục này (`index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`,
   `icon-maskable.svg`) → **Commit changes**.
4. Vào **Settings → Pages** → mục *Branch* chọn **main** + thư mục **/(root)** → **Save**.
5. Đợi 1–2 phút, GitHub hiện link dạng `https://<tên-bạn>.github.io/kv9-app/`.
   Gửi link này cho bất kỳ ai để xem.

## 🌐 Cách 2 — Netlify Drop (nhanh nhất, không cần tài khoản phức tạp)

1. Vào https://app.netlify.com/drop
2. Kéo thả **cả thư mục `kv9-app`** vào ô trên trang.
3. Netlify trả về link `https://...netlify.app` ngay lập tức — copy và chia sẻ.

## 🌐 Cách 3 — Chỉ gửi file

Gửi nguyên thư mục (nén `.zip`) qua Zalo/email. Người nhận giải nén và mở `index.html`.
(Cách này xem được giao diện nhưng **không cài như app / không offline** vì không có HTTPS.)

---

## 📲 Cài đặt như ứng dụng (sau khi đã có link HTTPS)

- **Android (Chrome):** mở link → bấm nút **"⬇️ Cài app"** trên trang, hoặc menu ⋮ →
  *Cài đặt ứng dụng / Thêm vào màn hình chính*.
- **iPhone/iPad (Safari):** mở link → nút **Chia sẻ** (hình vuông mũi tên) →
  *Thêm vào MH chính (Add to Home Screen)*.
- **Máy tính (Chrome/Edge):** biểu tượng cài đặt ⊕ ở thanh địa chỉ, hoặc nút "Cài app".

---

## 🏪 Đưa lên CH Play / App Store (app thật sự)

App này là PWA, nên cách đơn giản nhất để lên store là dùng **PWABuilder** (công cụ
miễn phí của Microsoft) đóng gói từ link HTTPS ở trên.

**Bắt buộc trước tiên:** hoàn thành Cách 1 hoặc Cách 2 để có link HTTPS công khai.

### Android → CH Play
1. Vào https://www.pwabuilder.com → dán link app của bạn → **Start**.
2. Công cụ chấm điểm PWA và cho tải **gói Android (.aab)** (dạng Trusted Web Activity).
3. Tạo tài khoản **Google Play Console** (phí **một lần ~25 USD**) tại
   https://play.google.com/console
4. Tạo ứng dụng mới → tải file `.aab` lên → khai báo thông tin, ảnh chụp, chính sách
   bảo mật → gửi duyệt. Google duyệt thường vài ngày.

### iOS → App Store
1. PWABuilder cũng tạo được **project Xcode** cho iOS từ cùng link.
2. Tuy nhiên iOS yêu cầu: **một máy Mac** (để build bằng Xcode) + tài khoản
   **Apple Developer** (phí **~99 USD/năm**).
3. Mở project bằng Xcode → build → tải lên App Store Connect → gửi duyệt.

> 💡 Gợi ý: nên làm **Android trước** (rẻ, không cần Mac). iOS làm sau khi cần.
> Icon trên store: PWABuilder tự sinh đủ kích thước từ `icon.svg`; nếu cần ảnh PNG
> 512×512 nét hơn, có thể xuất từ `icon.svg` bằng bất kỳ trình chỉnh sửa ảnh nào.

---

## 🔧 Cập nhật nội dung

Mọi nội dung (tin tức, giá, số liệu, văn bản) nằm trong `index.html`. Sau khi sửa,
tải lại file lên GitHub/Netlify là bản trên mạng cập nhật theo.

Khi sửa `sw.js` hoặc đổi nội dung lớn, tăng số phiên bản cache trong `sw.js`
(đổi `kv9-cache-v1` → `kv9-cache-v2`) để người dùng nhận bản mới.
