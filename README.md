<div align="center">

<img src="public/icon.svg" width="88" alt="Bàn Cờ logo" />

# Bàn Cờ

**Chơi Cờ vua · Cờ tướng · Cờ tướng úp ngay trên trình duyệt: với máy, với bạn, hoặc ghép ngẫu nhiên online.**

Không quảng cáo · không bắt buộc đăng ký · cài lên điện thoại như app · mã nguồn mở MIT

[**▶ Chơi ngay**](https://lethienloc2004.github.io/banco-chess/) · [🚀 Tự chạy / Deploy](#-bắt-đầu-nhanh) · [English](#english) · [Báo lỗi / góp ý](../../issues)

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
- ⏱️ **Đồng hồ thi đấu cho mọi chế độ** (cả chơi với máy và 2 người cùng máy): không giới hạn, 1+0, 3+2, 5+3, 10+5, 15+10, 30+20. Có cộng giờ sau mỗi nước, nút tạm dừng và tiếng cảnh báo khi còn dưới 10 giây. **Hết giờ là thua, trừ khi đối thủ không còn cách nào thắng thì hòa** (luật FIDE 6.9; cờ tướng: đối thủ không còn quân tấn công).
- 🤝 Online có thêm: cầu hòa, đầu hàng, chơi lại (tự đổi màu quân), biểu tượng cảm xúc.
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

## 🚀 Bắt đầu nhanh

Cần cài [Node.js](https://nodejs.org) bản 20 trở lên. Tải code về bằng nút **Code → Download ZIP** hoặc `git clone`, rồi mở terminal trong thư mục đó.

### 0. Chơi thử không cần cài gì

Mở **https://lethienloc2004.github.io/banco-chess/**. Bản này chạy trên GitHub Pages: chơi với máy và 2 người cùng máy hoạt động đầy đủ. Các tính năng online (ghép trận, phòng bạn bè, quản trị) cần máy chủ Cloudflare ở bước 2.

### 1. Chơi thử trên máy: 2 lệnh, không cần cấu hình

```bash
npm install
```

```bash
npm start
```

Mở **http://localhost:8787**. Có đủ tất cả: chơi với máy, chơi online, ghép trận và trang quản trị.
Muốn thử trang quản trị, vào **Cài đặt → Đăng nhập quản trị (chỉ khi phát triển)**. Muốn thử chơi online, mở thêm một cửa sổ ẩn danh làm người chơi thứ hai.

### 2. Đưa lên mạng thành bản của riêng bạn (miễn phí)

Bạn cần một tài khoản [Cloudflare](https://dash.cloudflare.com/sign-up) miễn phí. Sau đó chọn **một** trong hai cách.

#### Cách A: một lệnh, trả lời 3 câu hỏi *(khuyên dùng)*

```bash
npm run setup
```

| Câu hỏi | Điền gì | Ví dụ |
|---|---|---|
| **Tên app** | Tên dùng trong địa chỉ web: chữ thường, số, dấu gạch ngang | `co-tuong-cua-toi` |
| **Email quản trị** | Email Google của bạn. Đăng nhập bằng email này là có trang quản trị | `ban@gmail.com` |
| **Google Client ID** | Có thể bỏ trống (bấm Enter). Chỉ cần nếu muốn có nút "Đăng nhập Google", xem [mục bên dưới](#đăng-nhập-google-tùy-chọn) | `1234-abc.apps.googleusercontent.com` |

Phần còn lại script tự làm:
- Mở trình duyệt để bạn đăng nhập Cloudflare.
- Tạo cơ sở dữ liệu.
- Tạo khóa bí mật ngẫu nhiên.
- Build và đưa app lên mạng.
- In ra link dạng `https://co-tuong-cua-toi.<tài-khoản>.workers.dev`.

Chạy lại `npm run setup` bao nhiêu lần cũng được: script dùng lại những gì đã có và **không** làm người chơi bị đăng xuất.

#### Cách B: nút bấm, không cần cài gì trên máy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lethienloc2004/banco-chess)

1. Bấm nút trên và đăng nhập Cloudflare. Cloudflare sẽ tạo một bản sao của dự án trên GitHub của bạn, kèm cơ sở dữ liệu.
2. Khi được hỏi **AUTH_SECRET**, điền một chuỗi ngẫu nhiên dài bất kỳ, ví dụ gõ bừa khoảng 40 ký tự. Đừng chia sẻ chuỗi này cho ai.
3. Muốn làm quản trị viên: trong bản sao trên GitHub của bạn, sửa file `wrangler.toml`, điền email vào dòng `ADMIN_EMAILS = ""` rồi commit. Cloudflare sẽ tự deploy lại.

> Nút này là tính năng của Cloudflare. Nếu bước tự tạo cơ sở dữ liệu báo lỗi, hãy dùng Cách A.

### 3. Tùy chỉnh và cập nhật

| Muốn… | Làm thế nào |
|---|---|
| Thêm / bớt quản trị viên | Sửa `ADMIN_EMAILS` trong `wrangler.toml` rồi `npm run deploy`. Hoặc vào **Trang quản trị → Người chơi → Cấp quyền quản trị** |
| Bật đăng nhập Google | Điền `GOOGLE_CLIENT_ID` trong `wrangler.toml` (hoặc chạy lại `npm run setup`) |
| Nút GitHub trong app trỏ về repo của bạn | Sửa `"repository"` trong `package.json` |
| Dùng tên miền riêng | Cloudflare Dashboard → **Workers & Pages** → app của bạn → **Settings → Domains & Routes** |
| Cập nhật code mới lên mạng | `npm run deploy` |
| Bản demo trên GitHub Pages (không cần Cloudflare) | Bật một lần: **Settings → Pages → Source: GitHub Actions**. Từ đó mỗi lần push lên `main`, app tự cập nhật tại `https://<tên>.github.io/<repo>/` |
| Bật chơi online cho bản GitHub Pages | Sau khi có app trên Cloudflare: thêm biến `API_URL` (link Cloudflare của bạn) ở **Settings → Secrets and variables → Actions → Variables**, rồi chạy lại workflow |
| Tự deploy mỗi khi push lên GitHub | Thêm 2 secret `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` vào **Settings → Secrets and variables → Actions** của repo. Token tạo tại [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) bằng mẫu *Edit Cloudflare Workers*, thêm quyền *D1 Edit* |

#### Đăng nhập Google (tùy chọn)

1. Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID** → chọn loại **Web application**.
2. Ở **Authorized JavaScript origins**, thêm link app của bạn, ví dụ `https://co-tuong-cua-toi.ten-ban.workers.dev`. Muốn đăng nhập khi chạy thử trên máy thì thêm cả `http://localhost:8787`.
3. Copy **Client ID**, điền vào `GOOGLE_CLIENT_ID` trong `wrangler.toml`, rồi chạy `npm run deploy`.

#### Gặp lỗi?

| Hiện tượng | Cách xử lý |
|---|---|
| App báo "Không kết nối được máy chủ" | Máy chủ chưa có khóa bí mật: chạy lại `npm run setup` |
| Không thấy biểu tượng khiên 🛡️ | Bạn phải **đăng nhập Google** bằng đúng email trong `ADMIN_EMAILS`, và email đó đã được deploy (`npm run deploy`) |
| Nút "Đăng nhập Google" không hiện | `GOOGLE_CLIENT_ID` đang trống |
| Bấm đăng nhập Google báo lỗi | Link app chưa có trong *Authorized JavaScript origins* |
| `npm run setup` báo lỗi đăng nhập | Chạy `npx wrangler login` rồi chạy lại setup |

Gói miễn phí của Cloudflare thường đủ cho một cộng đồng nhỏ. Giới hạn cụ thể xem tại [trang giá Workers](https://developers.cloudflare.com/workers/platform/pricing/).

### Dành cho người đóng góp code

```bash
npm run dev          # Vite tự tải lại khi sửa giao diện (http://localhost:5173), chạy cùng: npm run dev:server
npm test             # luật cờ (perft), chiếu dai, đăng nhập, bot, script cài đặt
npm run test:server  # kiểm tra máy chủ: phòng, ghép trận, xếp hạng, quản trị (khi npm start đang chạy)
```

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
scripts/          npm start (chạy trên máy) và npm run setup (cài lên Cloudflare)
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
npm install
npm start          # play locally at http://localhost:8787
npm run setup      # put your own copy online on Cloudflare: answers 3 questions, does the rest
```

Or use the **Deploy to Cloudflare** button above. Details (Google sign-in, admins, custom domain, troubleshooting)
are in the *Bắt đầu nhanh* section.

All code is original (no chess libraries). Techniques from the [Chess Programming Wiki](https://www.chessprogramming.org);
chess piece-square tables based on Tomasz Michniewski's *Simplified Evaluation Function*; perft reference numbers from
the wiki's *Perft Results* page. See *Nguồn tham khảo & ghi công* above for the full list.

Licensed under the [MIT License](LICENSE).
