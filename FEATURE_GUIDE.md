# Hướng dẫn sử dụng tính năng Import Time Ranges

## Vị trí của tính năng

Sau khi build và chạy ứng dụng, bạn sẽ thấy nút mới trong **thanh menu trên cùng**:

```
┌─────────────────────────────────────────────────────────────┐
│  [Tracks] [Filter] [Working Dir] [Format] [Mode] 🌙 ✂️ ⚙️   │  <- TopMenu
└─────────────────────────────────────────────────────────────┘
```

**Nút ✂️ (Scissors)** - Click vào đây để mở dialog nhập khoảng thời gian

## Cách chạy ứng dụng để test

### 1. Cài đặt dependencies (chỉ cần làm 1 lần):
```bash
yarn install
```

### 2. Chạy ứng dụng ở chế độ development:
```bash
yarn dev
```

Hoặc:

```bash
npm run dev
```

## Cách sử dụng tính năng

### Bước 1: Mở video
- Kéo thả một video dài vào ứng dụng (ví dụ: video dài 1 tiếng)

### Bước 2: Click nút ✂️ (Scissors)
- Vị trí: Thanh menu trên cùng, bên cạnh nút Settings (⚙️)

### Bước 3: Nhập khoảng thời gian
- Nhập theo định dạng: `HH:MM:SS-HH:MM:SS|MM:SS-MM:SS|...`
- **Ví dụ cụ thể:**
  ```
  03:05-03:10|40:05-40:10|1:03:05-1:04:05
  ```

  Nghĩa là:
  - Cắt từ 3 phút 5 giây đến 3 phút 10 giây (5 giây)
  - Cắt từ 40 phút 5 giây đến 40 phút 10 giây (5 giây)
  - Cắt từ 1 giờ 3 phút 5 giây đến 1 giờ 4 phút 5 giây (60 giây)
  - **Tổng cộng: 1 phút 10 giây**

### Bước 4: Xem preview
- Dialog sẽ tự động hiển thị:
  - Số lượng segment: 3 segment(s)
  - Chi tiết từng segment và thời lượng
  - Tổng thời lượng: 1:10

### Bước 5: Import
- Click nút "Import Segments"
- Các segment sẽ được tạo tự động
- Export như bình thường để ghép các đoạn lại

## Định dạng thời gian được hỗ trợ

Bạn có thể dùng nhiều định dạng linh hoạt:

| Định dạng | Ví dụ | Ý nghĩa |
|-----------|-------|---------|
| `HH:MM:SS` | `1:30:45` | 1 giờ 30 phút 45 giây |
| `MM:SS` | `30:45` | 30 phút 45 giây |
| `SS` | `45` | 45 giây |

## Ví dụ thực tế

### Ví dụ 1: Cắt intro và outro
```
0:00-0:10|1:30:00-1:30:30
```
- Giữ lại: 10 giây đầu + 30 giây cuối

### Ví dụ 2: Cắt nhiều highlight
```
5:30-6:00|12:15-13:00|25:30-26:15
```
- Giữ lại 3 đoạn highlight từ video dài

### Ví dụ 3: Cắt từng phút
```
0:00-1:00|5:00-6:00|10:00-11:00
```
- Cắt phút 1, 6, và 11

## Lưu ý

- **Thời gian phải hợp lệ**: Start < End
- **Phân cách bằng dấu `|`**: Giữa các khoảng thời gian
- **Không giới hạn số lượng**: Có thể nhập nhiều khoảng (trong giới hạn của app)
- **Preview tự động**: Bạn sẽ thấy kết quả trước khi import

## Troubleshooting

### Không thấy nút ✂️?
- Đảm bảo bạn đã pull code mới nhất
- Chạy `yarn dev` để build lại ứng dụng
- Nút nằm ở TopMenu (thanh trên cùng), bên trái nút Settings

### Báo lỗi "Invalid time range format"?
- Kiểm tra định dạng: phải là `start-end|start-end|...`
- Đảm bảo thời gian start < end
- Ví dụ đúng: `1:00-2:00|5:00-6:00`
- Ví dụ sai: `2:00-1:00` (start > end)

### Không import được?
- Đảm bảo đã mở một video trước
- Kiểm tra định dạng thời gian có hợp lệ không
- Xem preview có hiển thị đúng không

---

**Chúc bạn sử dụng tính năng hiệu quả! 🎬✂️**
