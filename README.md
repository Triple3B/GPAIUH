# IUH GradeTrack

**IUH GradeTrack** là MVP web app hỗ trợ sinh viên IUH quản lý học phần, tính điểm theo cấu trúc điểm được nghiên cứu, theo dõi GPA và mô phỏng mục tiêu học kỳ.

## Chạy ứng dụng

Yêu cầu: Python 3 (để chạy web server) và Node.js 18+ (chỉ cần nếu muốn chạy test).

```bash
cd iuh-gradetrack
python3 -m http.server 8000
```

Mở trình duyệt tại: `http://localhost:8000`.

Trên Windows có thể nhấp đúp `start.bat` (cần cài Python 3). Trên macOS/Linux chạy `./start.sh`.

Không cần `npm install`, không cần backend và không cần API key. Ứng dụng dùng JavaScript module gốc của trình duyệt, CSS và HTML; phù hợp triển khai static hosting/GitHub Pages.

## Deploy lên GitHub Pages

Repository đã có workflow tại `.github/workflows/pages.yml`. Đưa source lên nhánh `main`, vào **Settings → Pages** và chọn **GitHub Actions** làm build/deploy source. Workflow sẽ tự triển khai website sau mỗi lần push vào `main`.

## Chạy kiểm thử

```bash
npm test
```

Bộ kiểm thử dùng `node:test`, không cần cài thư viện bên ngoài.

## Chức năng trong MVP

- Dashboard: ĐTBHL học kỳ, ĐTBCTL, tín chỉ, tiến độ mục tiêu, tình trạng học phần.
- Quản lý học phần: tạo, cập nhật, xóa học phần; tìm kiếm; khai báo loại học phần và loại đánh giá.
- Tính điểm lý thuyết: thường kỳ 20%, giữa kỳ 30%, cuối kỳ 50%; xử lý điều kiện giữa kỳ bằng 0 và điểm thi cuối kỳ dưới 3.0.
- Tính điểm thực hành: 3 cột với học phần 1–2 tín chỉ; 5 cột với học phần từ 3 tín chỉ.
- Tính điểm học phần tích hợp: xử lý riêng điểm lý thuyết, thực hành, tỷ trọng tín chỉ và điều kiện thực hành.
- Thực tập/khóa luận: một cột điểm tổng kết.
- Quy đổi điểm hệ 10 → điểm chữ → hệ 4.
- GPA học kỳ và GPA tích lũy được tính riêng.
- Mô phỏng GPA: đặt mục tiêu và chọn điểm dự kiến cho từng học phần chưa có kết quả.
- Tính ngược điểm cuối kỳ tối thiểu để đạt một ngưỡng điểm tổng kết (đối với môn lý thuyết và tích hợp đủ dữ liệu).
- Theo dõi học phần không đạt và tỷ lệ tín chỉ không đạt.
- Lưu tự động trên `localStorage`; xuất/nhập bản sao lưu JSON.
- Có dữ liệu demo được gắn nhãn rõ ràng để người dùng xem luồng hoạt động.
- Quản lý nhiều học kỳ: mỗi học phần gắn với một học kỳ; dashboard tách ĐTBHL học kỳ đang chọn và ĐTBCTL trên toàn bộ dữ liệu đã nhập.
- Có cấu hình quy tắc có phiên bản tại `src/domain/regulations/iuh-k22-2025.js`.
- Có workflow deploy GitHub Pages.

## Cấu trúc

```text
.
├── index.html
├── styles.css
├── src/
│   ├── app.js
│   ├── domain/
│   │   ├── grade-engine.js
│   │   └── regulations/
│   │       └── iuh-k22-2025.js
│   └── storage/
│       └── store.js
├── tests/
│   └── grade-engine.test.js
├── package.json
├── start.bat
├── start.sh
├── .github/workflows/pages.yml
└── README.md
```

## Quy tắc tính điểm được mã hóa

Các công thức và bảng quy đổi hiện dựa trên tài liệu nghiên cứu IUH K22 do người dùng cung cấp trong phiên làm việc (đối chiếu Quy chế đào tạo tín chỉ 2025, các Điều 18, 19, 21 và 12 theo nội dung bản nghiên cứu).

| Quy tắc | Đang áp dụng |
|---|---|
| Lý thuyết | 20% thường kỳ + 30% giữa kỳ + 50% cuối kỳ |
| Cuối kỳ dưới 3.0 | Điểm tổng kết bằng điểm cuối kỳ |
| Giữa kỳ bằng 0 | Hiển thị không đủ điều kiện dự thi cuối kỳ |
| Thực hành | 3 hoặc 5 cột theo tín chỉ; trung bình cộng |
| Tích hợp | Tính riêng LT/TH rồi bình quân theo số tín chỉ từng phần |
| Làm tròn thành phần | Phần lẻ dưới 0.25 → .0; từ .25 đến dưới .75 → .5; từ .75 → lên số nguyên kế tiếp |
| Điểm tổng kết | Làm tròn đến một chữ số thập phân |
| Quy đổi hệ 4 | A+ 4.0; A 3.8; B+ 3.5; B 3.0; C+ 2.5; C 2.0; D+ 1.5; D 1.0; F 0.0 |
| GPA học kỳ | Bao gồm học phần có điểm số đã hoàn thành, kể cả điểm F; không gồm học phần P/F và miễn học |
| GPA tích lũy | Trong MVP chỉ tính các học phần có điểm số đạt từ 4.0 trở lên đã nhập; không gồm P/F và miễn học |

## Giới hạn và điểm cần xác minh trước khi phát hành chính thức

1. **Làm tròn điểm thành phần:** MVP áp dụng đúng diễn giải trong tài liệu nghiên cứu người dùng cung cấp: làm tròn từng cột về bước 0.5 trước khi tính điểm tổng kết. Cần đối chiếu lại trực tiếp với văn bản gốc/Phòng Đào tạo, đặc biệt việc làm tròn trước hay sau phép tính trọng số.
2. **Điểm thi cuối kỳ dưới 3.0:** MVP kiểm tra điểm người dùng nhập (chưa làm tròn) nhỏ hơn 3.0, sau đó dùng điểm thành phần đã làm tròn làm điểm tổng kết. Cách hiểu này cần xác nhận từ quy chế gốc.
3. **Học phần tích hợp:** Cần xác nhận số cột thực hành và số tín chỉ từng phần theo đề cương học phần cụ thể. MVP yêu cầu người dùng khai báo tín chỉ LT/TH và số cột thực hành.
4. **ĐTBHL và ĐTBCTL:** Tài liệu nghiên cứu mô tả phạm vi hai chỉ số khác nhau. MVP tính ĐTBHL trên các học phần có điểm số đã có kết quả trong danh sách hiện tại; ĐTBCTL trên các học phần đạt đã nhập. Không thể tự suy ra điểm học lực của các học kỳ trước nếu chưa nhập dữ liệu.
5. **Học lại/cải thiện điểm:** Chưa tự động xử lý việc điểm cũ bị thay thế hay cách đưa điểm lần học lại vào GPA vì tài liệu nguồn chưa kết luận đầy đủ. Nếu nhập lặp một mã học phần ở nhiều học kỳ, MVP hiện vẫn có thể cộng cả các lần đạt vào ĐTBCTL/tín chỉ; giao diện sẽ cảnh báo mã lặp nhưng chưa tự chọn lần điểm thay thế. Không dùng chỉ số tích lũy làm kết luận chính thức khi còn mã học phần lặp.
6. **Cảnh báo học vụ/học bổng/tốt nghiệp:** Chỉ hiển thị chỉ số tham khảo. Chưa tự kết luận đủ điều kiện học bổng, cảnh báo hay tốt nghiệp.
7. **Học phần P/F và miễn học:** Tách riêng, không tham gia GPA theo tài liệu nghiên cứu. Điểm F của một học phần có thang điểm số khác với ký hiệu F của học phần không phân mức P/F. Ký hiệu I và X được giữ ở trạng thái chưa đưa vào GPA.

## Lưu trữ và quyền riêng tư

MVP lưu dữ liệu trên trình duyệt đang sử dụng (`localStorage`). Dữ liệu không tự đồng bộ giữa các thiết bị, không gửi lên máy chủ và có thể mất khi người dùng xóa dữ liệu trang web. Dùng chức năng **Xuất bản sao lưu** định kỳ.

## Trạng thái kiểm chứng

- Đã viết: giao diện và các module tính điểm chính.
- Đã kiểm tra: chạy unit test với Node.js.
- Chưa triển khai: chưa có repository GitHub hoặc hosting công khai.
- Chưa xác nhận: các điểm pháp lý/diễn giải được liệt kê ở phần giới hạn.
