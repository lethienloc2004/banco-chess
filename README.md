<div align="center">

<img src="public/icon.svg" width="88" alt="Bàn Cờ logo" />

# Bàn Cờ

**Chơi Cờ vua · Cờ tướng · Cờ tướng úp ngay trên trình duyệt: với máy, với bạn, hoặc ghép ngẫu nhiên online.**

Không quảng cáo · không bắt buộc đăng ký · cài lên điện thoại như app · mã nguồn mở MIT

[**▶ Chơi ngay**](#) · [English](#english) · [Báo lỗi / góp ý](../../issues)

![Demo](docs/demo.gif)

</div>

## ✨ Tính năng

- ♟️ **3 loại cờ trong một app**: Cờ vua, Cờ tướng, và **Cờ tướng úp (Jieqi / 揭棋)**. Rất hiếm có bản mã nguồn mở nào chơi được cờ úp.
- ⚡ **Ghép ngẫu nhiên có xếp hạng (Elo)**: app tìm đối thủ có điểm gần nhất. Mỗi ván 10 phút, cộng 5 giây sau mỗi nước.
- 🔗 **Chơi với bạn qua link**: tạo phòng, chọn màu quân và thời gian (không giới hạn, 3+2, 5+3, 10+5, 15+10), rồi gửi link qua Zalo hay Messenger. Ai vào khi phòng đã đủ người sẽ được xem ván.
- 🛡️ **Máy chủ giữ ván cờ**:
  - Kiểm tra mọi nước đi, nên không thể gian lận bằng cách sửa code trên trình duyệt.
  - Mất mạng hay tải lại trang vẫn vào lại được ván.
  - Ở cờ úp, trình duyệt **không biết trước** quân úp là gì. Máy chủ chỉ báo khi quân được lật.
- ⏱️ **Đồng hồ thi đấu**, cầu hòa, đầu hàng, chơi lại (tự đổi màu quân), biểu tượng cảm xúc.
- 🚪 **Đối thủ bỏ đi**: sau 60 giây bạn được bấm xử thắng. Sau 5 phút máy chủ tự xử.
- 🚩 **Báo cáo người chơi**: gian lận, xúc phạm, cố tình kéo dài, tên không phù hợp.
- 👤 **Tài khoản**: chơi ngay với tư cách khách. Đăng nhập Google nếu muốn giữ điểm và lịch sử khi đổi máy.
- 🧑‍⚖️ **Trang quản trị toàn quyền**:
  - Thống kê: người online, số ván, biểu đồ 7 ngày.
  - Xem ván đang chơi và xem lại từng nước, kể cả quân úp.
  - Hủy ván, xử thắng/hòa.
  - Xử lý báo cáo.
  - Cảnh cáo, khóa có thời hạn hoặc vĩnh viễn, đổi tên, chỉnh điểm, cấp quyền quản trị, xóa tài khoản.
  - Đăng thông báo toàn hệ thống, hiện ngay trên máy người chơi.
  - Nhật ký mọi thao tác của quản trị viên.
- 🤖 **Máy chơi cùng** với 3 mức Dễ / Vừa / Khó (alpha-beta, quiescence, bảng chuyển vị), chạy trong Web Worker nên không giật.
- 🎭 **Bot cờ úp không ăn gian**: máy không biết quân úp là gì. Nó thử nhiều cách xếp ngẫu nhiên rồi chọn nước tốt nhất tính trung bình.
- ✅ **Đúng luật**:
  - Cờ vua: nhập thành, bắt tốt qua đường, phong cấp, hòa theo FIDE.
  - Cờ tướng: lộ mặt tướng, cản mã, cản tượng, pháo ngòi.
  - **Luật cấm chiếu dai và đuổi dai** theo luật châu Á (bản giản lược).
- 🎨 **Đổi màu thoải mái**:
  - Cờ vua: 16 kiểu bàn và 10 bộ màu quân.
  - Cờ tướng: 13 kiểu bàn và 10 bộ màu quân.
  - Thêm chế độ **tùy chỉnh** với bảng chọn màu bất kỳ.
- 🔊 Âm thanh tổng hợp bằng Web Audio. Có hiệu ứng chuyển cảnh, chế độ tối, tiếng Việt và English, giao diện dùng tốt trên điện thoại.

<table>
  <tr>
    <td><img src="docs/home.png" alt="Trang chủ" /></td>
    <td><img src="docs/modes.png" alt="Chọn cách chơi" /></td>
  </tr>
  <tr>
    <td><img src="docs/online.png" alt="Chơi online: cầu hòa, đồng hồ" /></td>
    <td align="center"><img src="docs/online-mobile.png" width="260" alt="Chơi online trên điện thoại" /></td>
  </tr>
  <tr>
    <td><img src="docs/admin.png" alt="Trang quản trị" /></td>
    <td><img src="docs/admin-game.png" alt="Quản trị: xem lại ván" /></td>
  </tr>
  <tr>
    <td><img src="docs/xiangqi.png" alt="Cờ tướng với máy" /></td>
    <td><img src="docs/colors.png" alt="Đổi màu bàn và quân" /></td>
  </tr>
</table>

## 🀄 Luật cờ tướng úp

1. Xếp quân như cờ tướng, nhưng mọi quân trừ Tướng đều **úp mặt và bị xáo trộn ngẫu nhiên**. Mỗi bên xáo quân của mình.
2. Quân úp đi theo luật của quân **vốn đứng ở ô đó**. Ví dụ: quân úp ở chỗ Pháo thì đi như Pháo.
3. Sau nước đi đầu tiên, quân được **lật lên**. Từ đó nó đi đúng theo loại thật của mình.
4. Sĩ và Tượng đã lật được đi khắp bàn, không bị giới hạn trong cung hay bên sông.
5. Bị chiếu hết hoặc hết nước đi là thua.

## 🏗️ Kiến trúc

```
Trình duyệt (Vite + TypeScript, không framework)
  │  REST /api/*  +  WebSocket
  ▼
Cloudflare Worker (server/index.ts): API, đăng nhập, phục vụ app
  ├─ Durable Object "GameRoom" (mỗi phòng một bản): giữ ván, kiểm tra nước đi bằng chính bộ luật của app,
  │   đồng hồ, giấu quân úp, ghi kết quả
  ├─ Durable Object "Lobby" (một bản): người online, hàng chờ ghép trận, thông báo trực tiếp
  └─ D1 (SQLite): users · games · reports · announcements · audit
```

Chế độ chơi với máy và 2 người chạy hoàn toàn trên trình duyệt, không cần máy chủ.

## 🚀 Chạy trên máy

Cần [Node.js](https://nodejs.org) 20 trở lên.

```bash
npm install
cp .dev.vars.example .dev.vars   # bí mật cho máy chủ chạy thử
npm run build                     # build app vào dist/
npm run dev:server                # máy chủ game + app tại http://localhost:8787
```

Muốn sửa giao diện với tính năng tự tải lại trang, chạy thêm `npm run dev` (Vite, http://localhost:5173). Vite chuyển tiếp `/api` sang máy chủ ở cổng 8787.

```bash
npm test             # luật cờ (perft), luật chiếu dai, đăng nhập, bot
npm run test:server  # kiểm tra máy chủ: phòng, ghép trận, xếp hạng, quản trị (cần npm run dev:server)
```

Khi chạy thử trên máy, trong **Cài đặt** có nút "Đăng nhập quản trị (chỉ khi phát triển)" để vào trang quản trị mà không cần Google. Nút này chỉ hiện khi biến `DEV=1` có trong `.dev.vars`.

## ☁️ Triển khai lên Cloudflare (miễn phí)

1. Tạo tài khoản [Cloudflare](https://dash.cloudflare.com/sign-up), rồi đăng nhập trên máy:
   ```bash
   npx wrangler login
   ```
2. Tạo cơ sở dữ liệu:
   ```bash
   npx wrangler d1 create ban-co
   ```
   Lệnh này in ra `database_id`. Dán giá trị đó vào `wrangler.toml`, thay cho dòng `00000000-...`.
3. Đặt khóa bí mật để ký phiên đăng nhập (một chuỗi ngẫu nhiên dài):
   ```bash
   npx wrangler secret put AUTH_SECRET
   ```
4. *(Tùy chọn)* Đăng nhập Google:
   - Tạo **OAuth Client ID** loại *Web application* tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   - Thêm tên miền của app vào *Authorized JavaScript origins*.
   - Điền `GOOGLE_CLIENT_ID` trong `wrangler.toml`.
5. **Quản trị viên:** điền email Google của bạn vào `ADMIN_EMAILS` trong `wrangler.toml` (nhiều email thì cách nhau bằng dấu phẩy). Đăng nhập Google bằng email đó là thành quản trị viên. Sau đó bạn có thể cấp quyền cho người khác ngay trong trang quản trị.
6. Triển khai:
   ```bash
   npm run deploy
   ```
   App và máy chủ chạy tại `https://ban-co.<tên-bạn>.workers.dev`.

**Tự động deploy từ GitHub:** thêm 2 secret `CLOUDFLARE_API_TOKEN` (token có quyền *Edit Cloudflare Workers* và *D1*) và `CLOUDFLARE_ACCOUNT_ID` vào **Settings → Secrets and variables → Actions**. Từ đó, mỗi lần push lên `main`, GitHub Actions sẽ chạy test rồi deploy.

## 🧠 Cấu trúc mã nguồn

```
src/
  engine/         Luật cờ vua (0x88), cờ tướng + cờ úp, tìm kiếm alpha-beta, bot
  game.ts         Ván cờ: lịch sử, đi lại, lặp thế, chiếu dai/đuổi dai, lật quân úp theo máy chủ
  shared/         Giao thức và kiểu dữ liệu dùng chung cho app và máy chủ
  net.ts          Gọi API, tài khoản, WebSocket tự kết nối lại
  ui/             Màn hình: trang chủ, chọn cách chơi, ván cờ, ghép trận, quản trị, hộp thoại, màu
server/
  index.ts        API: đăng nhập khách/Google, phòng, báo cáo
  room.ts         Durable Object phòng chơi
  lobby.ts        Durable Object sảnh chờ / ghép trận
  admin.ts        API quản trị
  auth.ts         Ký phiên (HMAC) và xác minh Google ID token
migrations/       Lược đồ cơ sở dữ liệu D1
tests/            Perft chuẩn, luật, đăng nhập, bot; tests/e2e: kiểm tra máy chủ
```

## 🔒 Bảo mật & giới hạn hiện tại

- Mọi nước đi online đều được máy chủ kiểm tra. Quân úp chỉ được tiết lộ khi lật. Tên người chơi được làm sạch và luôn được escape khi hiển thị.
- Tài khoản khách gắn với trình duyệt. Người bị khóa có thể tạo tài khoản khách mới. Muốn chặn chặt hơn, có thể chỉ cho tài khoản Google chơi xếp hạng; đây là một ý tưởng đóng góp.
- Luật cấm đuổi dai là bản giản lược: chỉ xét quân vừa đi tấn công một quân không được bảo vệ, hoặc quân có giá trị lớn hơn. Các trường hợp đặc biệt của luật châu Á đầy đủ chưa được xử lý.
- Chống dùng máy hỗ trợ trong lúc chơi chỉ dựa vào báo cáo và xem lại ván. App chưa tự động phát hiện.

## 📚 Nguồn tham khảo & ghi công

Toàn bộ mã nguồn được viết mới, **không dùng thư viện cờ nào**. Kiến thức và dữ liệu tham khảo:

- **Luật cờ vua**: [Luật cờ vua FIDE (FIDE Laws of Chess)](https://handbook.fide.com): nhập thành, bắt tốt qua đường, phong cấp, lặp thế cờ, hòa.
- **Luật cờ tướng**: luật thi đấu phổ biến (châu Á / WXF), kể cả cấm chiếu dai và đuổi dai (bản giản lược). Luật cờ úp theo cách chơi Jieqi phổ biến.
- **Kỹ thuật lập trình cờ** từ [Chess Programming Wiki](https://www.chessprogramming.org):
  - [bàn cờ 0x88](https://www.chessprogramming.org/0x88)
  - [alpha-beta](https://www.chessprogramming.org/Alpha-Beta)
  - [quiescence search](https://www.chessprogramming.org/Quiescence_Search)
  - [Zobrist hashing](https://www.chessprogramming.org/Zobrist_Hashing)
  - [killer heuristic](https://www.chessprogramming.org/Killer_Heuristic) và [history heuristic](https://www.chessprogramming.org/History_Heuristic)
  - MVV-LVA
- **Bảng điểm vị trí quân cờ vua** (piece-square tables) dựa trên [Simplified Evaluation Function](https://www.chessprogramming.org/Simplified_Evaluation_Function) của Tomasz Michniewski.
- **Số liệu perft để kiểm tra luật**:
  - Cờ vua: từ trang [Perft Results](https://www.chessprogramming.org/Perft_Results).
  - Cờ tướng: số liệu thế khởi đầu được các engine cờ tướng công bố (44 / 1 920 / 79 666).
- **Bot cờ úp** dùng ý tưởng [Perfect Information Monte Carlo](https://www.chessprogramming.org/Monte-Carlo_Tree_Search): lấy mẫu các cách xếp quân úp rồi tìm kiếm trên từng mẫu.
- **Xếp hạng**: [hệ số Elo](https://en.wikipedia.org/wiki/Elo_rating_system), K = 32.
- **Máy chủ**: [Cloudflare Workers, Durable Objects và D1](https://developers.cloudflare.com/).
- **Đăng nhập Google**: [Google Identity Services](https://developers.google.com/identity/gsi/web).
- **Font** chữ Hán trên quân: [Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) (SIL Open Font License), tải qua Google Fonts.
- Quân cờ vua hiển thị bằng ký tự Unicode (♔♕♖♗♘♙), dùng font có sẵn trên máy.

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh! Một vài ý tưởng:

- [ ] Phân tích ván sau khi chơi, gợi ý nước đi
- [ ] Bảng xếp hạng công khai, trang hồ sơ người chơi
- [ ] Giải đấu / phòng chờ nhiều bàn
- [ ] Phát hiện dùng máy hỗ trợ (so độ chính xác với bot)
- [ ] Thêm biến thể: Chess960, cờ úp với luật biến thể…
- [ ] Bot mạnh hơn (bitboard, NNUE…)

Fork → tạo nhánh → `npm test` → mở Pull Request.

Nếu thấy hay, hãy cho dự án một ⭐ nhé!

---

## English

**Bàn Cờ** ("chess board" in Vietnamese) is a web app to play **Chess**, **Xiangqi** (Chinese chess) and **Jieqi**
(揭棋, xiangqi with face-down pieces): against a built-in bot, with a friend on the same device, or online.

- **Online on Cloudflare** (Workers + Durable Objects + D1): rated quick matchmaking (Elo), friend rooms via link,
  spectators, clocks, draw offers, rematch, emotes, reports, reconnect after reloads, abandonment claims.
- **Authoritative server**: every move is validated with the same rules engine; in Jieqi the client never learns a
  hidden piece before it is revealed.
- **Accounts**: play instantly as a guest, optionally sign in with Google.
- **Full admin dashboard**:
  - Stats, live games and replays.
  - Cancel games or set results.
  - Handle reports.
  - Manage players: warn, ban, rename, set rating, change roles, delete.
  - Post live announcements.
  - Audit log of every admin action.
- **Rules**: castling, en passant, promotion, FIDE draws; flying general, blocked horse/elephant, cannon screens,
  Asian-rules perpetual check / chase (simplified). Verified with standard perft counts.
- Many board/piece colour themes plus a custom colour picker, sound, dark mode, Vietnamese / English, PWA.

```bash
npm install && cp .dev.vars.example .dev.vars && npm run build && npm run dev:server
```

See **Triển khai lên Cloudflare** above for deployment (D1 database, `AUTH_SECRET`, optional Google client id,
`ADMIN_EMAILS`, then `npm run deploy`).

All code is original (no chess libraries). Techniques from the [Chess Programming Wiki](https://www.chessprogramming.org);
chess piece-square tables based on Tomasz Michniewski's *Simplified Evaluation Function*; perft reference numbers from
the wiki's *Perft Results* page. See *Nguồn tham khảo & ghi công* above for the full list.

Licensed under the [MIT License](LICENSE).
