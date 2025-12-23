# Cập nhật phân quyền xem thông tin nhân viên

## Ngày thực hiện: 2025-12-30

## Mô tả thay đổi

Thêm quyền xem thông tin toàn bộ nhân viên cho các mã nhân viên đặc biệt (NV011, NV001).

## Chi tiết thay đổi

### 1. Dashboard.jsx
- **Thêm biến:** `MANAGER_CODES = ['NV011', 'NV001']`
- **Cập nhật hàm:** `handleEmployeeClick()`
  - Kiểm tra xem user hiện tại có employee_code trong danh sách MANAGER_CODES không
  - Nếu có, cho phép xem thông tin chi tiết của tất cả nhân viên

### 2. EmployeeDirectory.jsx
- **Thêm biến:** `MANAGER_CODES = ['NV011', 'NV001']`
- **Cập nhật hàm:** `fetchEmployees()`
  - Trước khi filter danh sách nhân viên, kiểm tra employee_code của user
  - Nếu là manager (NV011 hoặc NV001), fetch toàn bộ danh sách
  - Nếu không, chỉ fetch thông tin của chính họ

## Phân quyền hiện tại

### Cấp 1: Admin (Toàn quyền)
- Email: `admin@nhtc.com.vn`
- Quyền: Xem và chỉnh sửa tất cả thông tin

### Cấp 2: Manager (Xem toàn bộ)
- Mã NV: `NV011`, `NV001`
- Quyền: Xem thông tin tất cả nhân viên

### Cấp 3: User thường
- Quyền: Chỉ xem thông tin của chính mình

## Cách thêm manager mới

Để thêm mã nhân viên mới vào danh sách manager, cập nhật biến `MANAGER_CODES` trong cả 2 file:

```javascript
const MANAGER_CODES = ['NV011', 'NV001', 'NV_MỚI'];
```

## Testing

Để test tính năng này:
1. Đăng nhập bằng tài khoản có employee_code = 'NV011' hoặc 'NV001'
2. Vào trang Dashboard hoặc Nhân sự
3. Kiểm tra xem có thể xem thông tin của tất cả nhân viên không
4. Click vào bất kỳ nhân viên nào để xem chi tiết

## Lưu ý

- Danh sách MANAGER_CODES được hardcode trong code
- Nếu cần quản lý động hơn, nên lưu danh sách này vào database
- Hiện tại chỉ có quyền XEM, chưa có quyền CHỈNH SỬA cho manager
