# Đóng góp cho Bàn Cờ

Cảm ơn bạn muốn góp sức! Mọi đóng góp đều quý: sửa lỗi, thêm tính năng, dịch, viết tài liệu, báo lỗi.

## Chuẩn bị

```bash
npm install
npm start        # app + máy chủ game tại http://localhost:8787
```

Khi sửa giao diện, chạy song song `npm run dev:server` và `npm run dev` (Vite tự tải lại trang tại http://localhost:5173).

## Trước khi mở Pull Request

```bash
npm test             # phải qua hết
npm run build        # kiểm tra kiểu dữ liệu (app + máy chủ) và build
npm run test:server  # nếu bạn sửa máy chủ (cần npm start đang chạy)
```

- Nếu sửa luật cờ, hãy giữ nguyên các bài test perft. Chúng bắt lỗi luật rất nhanh.
- Mọi chữ hiển thị đều nằm trong `src/i18n.ts`. Nhớ thêm cả tiếng Việt và tiếng Anh.
- Nội dung do người dùng nhập (tên, ghi chú…) phải qua hàm `esc()` trước khi đưa vào HTML.
- Đổi luồng hoạt động (phòng chơi, ghép trận, điểm Elo, quản trị…)? Hãy cập nhật sơ đồ trong `docs/diagrams/*.puml` rồi chạy `npm run diagrams` (cần Java).
- Mỗi Pull Request nên làm một việc, kèm mô tả ngắn và ảnh chụp nếu có đổi giao diện.

## Báo lỗi

Mở một [issue](../../issues/new/choose) và ghi rõ: loại cờ, chế độ chơi, các bước để gặp lỗi, trình duyệt/thiết bị.
Nếu là lỗi luật, ghi lại chuỗi nước đi (copy ở bảng "Nước đi") sẽ giúp sửa nhanh hơn nhiều.

---

## Contributing (English)

```bash
npm install
npm start          # app + game server at http://localhost:8787
npm test           # must pass
npm run build      # type-checks the app and the server
```

- Keep the perft tests green when you touch the rules.
- Every visible text lives in `src/i18n.ts`: add both Vietnamese and English.
- Escape user-provided text with `esc()` before putting it into HTML.
- Changed how rooms, matchmaking, ratings or admin work? Update `docs/diagrams/*.puml` and run `npm run diagrams` (needs Java).
- One change per pull request, with a short description and a screenshot for UI changes.
