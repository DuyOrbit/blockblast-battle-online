# BlockBlast Arena ⚔️
### Real-Time 1v1 PvP Competitive "Block Blast" with Elo, Custom Rooms & Dynamic RNG Engine

**BlockBlast Arena** is a real-time, competitive 1v1 multiplayer & classic solo game built with an authoritative Node.js/TypeScript backend, HTML5 Canvas 2D rendering pipeline, procedural Web Audio API sound synthesis, and mobile touch support.

---

## 🌟 Key Features

### 1. Authoritative Server & Anti-Cheat
- The client **never** calculates final scores, line clears, or game-over conditions on its own.
- Moves are submitted as authoritative action packets: `{ type: "PLACE_PIECE", pieceIndex, x, y }`.
- The server validates whether the piece exists in the player's active pool and legally fits on the 8x8 board.
- The server updates the board, computes line clears, applies combo multipliers, ages garbage blocks, checks Knockout (KO) conditions, and synchronizes state updates to both players in real-time.

### 2. Block Spawner / RNG Engine (`shared/blockSpawner.ts`)
- **35 chuẩn khối cố định (7 nhóm cổ điển)**: Dot (1x1), Lines (1x2 đến 5x1), Squares (2x2, 3x3), Corner 3 ô, L-shapes (4 ô & 5 ô), T-shapes, Z/S-shapes.
- **Dynamic Weighted Balancing (Cân bằng trọng số động)**:
  - Bàn cờ trống nhiều (>= 40 ô): Tăng trọng số xuất hiện khối lớn (3x3, thanh 5, L lớn 5).
  - Bàn cờ trung bình (20 đến 39 ô): Trọng số phân bổ đều khối vừa và nhỏ.
  - Bàn cờ nguy cấp (< 20 ô): Tăng mạnh trọng số khối nhỏ linh hoạt (1x1, 1x2, 2x1, corner 3) và đè khối 3x3, thanh 5 về mức cực thấp (weight = 1).
- **Hạn chế trùng lặp**: Trong 1 lượt 3 khối, tuyệt đối không xuất hiện 2 khối 3x3 hoặc 2 khối thanh 5.
- **Nguyên tắc sống còn (Solvability Guarantee)**: Đảm bảo 100% trong 3 khối luôn có ít nhất 1 khối đặt vừa vào bàn cờ hiện tại.

### 3. Fair Shared RNG Seed
- Both PvP players receive the **exact same sequence of 3-piece sets** generated deterministically using Mulberry32 32-bit PRNG.
- Neither player receives an unfair piece advantage—victory is purely based on skill, placement efficiency, and combo chaining!

### 4. 1v1 Attack Mechanic (Garbage Blocks)
- **Multi-Line Clears**: Clearing 2 lines sends 1 garbage block; clearing 3 lines sends 2; 4+ lines sends 3.
- **Combo Streaks**: Chaining consecutive clears (Combo >= 2) sends additional garbage blocks.
- **Garbage Stone Blocks**: Rendered as heavy stone blocks with a **2-turn countdown**. While active, they block row and column clears. After 2 turns, they crack and turn into regular clearable blocks.

### 5. Custom Friend Rooms & Live Spectator Mode
- **Tạo phòng bạn bè riêng tư**: Mã phòng 5 ký tự ngẫu nhiên (ví dụ: `32FT8`) kèm liên kết mời nhanh `?room=CODE`.
- **Chế độ Khán giả (Spectator Mode)**: Cho phép bạn bè vào xem trực tiếp góc nhìn kép (Dual-Board View), cập nhật real-time mọi nước đi, combo, hiệu ứng nổ hạt.
- **Host Migration**: Tự động chuyển quyền Host nếu trưởng phòng rời phòng. Trận đấu phòng bạn bè bảo lưu điểm Elo xếp hạng.

### 6. Competitive Elo Matchmaking & AI Bot Fallback
- **Elo Rating**: Starts at default 1000 Elo with dynamic K-Factor (K=32). Rating delta calculated upon match resolution.
- **Dynamic Queue**: Matches players within `|Elo_A - Elo_B| <= 150`, expanding the radius by 50 Elo every 5 seconds.
- **AI Bot Fallback**: If no human opponent is matched within 15 seconds, a simulated AI player (`ZeroCool [AI]`) challenges the player, utilizing heuristic board evaluations to autonomously place blocks.

### 7. Single-Player Classic Mode (Chơi Đơn) & Global Leaderboard
- **Chế độ Chơi Đơn (Classic)**: Trải nghiệm xếp gạch Block Blast truyền thống không giới hạn thời gian.
- **Bảng Xếp Hạng**:
  - Tab 1: **Chơi Đơn (Điểm Cao)**: Xếp hạng top điểm kỷ lục, chuỗi combo tối đa và tổng số dòng đã xóa, lưu trực tiếp qua REST API (`/api/leaderboard/solo`).
  - Tab 2: **Đấu Hạng (Elo PvP)**: Xếp hạng tuyển thủ theo điểm Elo, số trận thắng và tổng số trận.

### 8. Cyberpunk Neon Visuals & Mobile Touch Support (60 FPS)
- Dark slate canvas theme (`#0f172a`) with high-contrast neon pieces (Cyan, Amber, Emerald, Purple, Rose).
- Particle burst system, screen shake on multi-clears, floating combat text (`+300 DOUBLE!`, `+COMBO x3!`).
- **Mobile Touch Engine**: Hỗ trợ cảm ứng với offset -40px giúp ngón tay không che tầm nhìn khối gạch.
- Dual controls: Drag-and-drop & Tap-to-pick / Tap-to-place.
- 100% procedural Web Audio sound synthesis (zero external audio file dependencies).

---

## 📁 Project Structure

```
blockblastonline/
├── client/                     # Frontend SPA
│   ├── index.html              # Cyberpunk battle HUD, PWA meta tags & layout
│   ├── style.css               # Neon cyberpunk styles, responsive mobile queries
│   ├── main.ts                 # WebSocket synchronization, state machine & rooms
│   ├── renderer.ts             # HTML5 Canvas 2D engine & particle systems
│   ├── input.ts                # Drag & drop / touch pointer handling with offset
│   └── sound.ts                # Procedural Web Audio API sound synthesizer
├── server/                     # Authoritative Backend
│   ├── server.ts               # HTTP & WebSocket server orchestration
│   ├── gameEngine.ts           # Deterministic validation, line clears & garbage
│   ├── roomManager.ts          # Custom friend rooms & spectator management
│   ├── matchmaker.ts           # Dynamic Elo queue & rating calculations
│   ├── botPlayer.ts            # Heuristic autonomous AI bot
│   ├── handSolver.ts           # Multi-step clear depth solver & rescue logic
│   ├── prng.ts                 # Mulberry32 deterministic shared RNG
│   └── store.ts                # Player stats & leaderboard in-memory store
├── shared/                     # Shared Types & Constants
│   ├── blockSpawner.ts         # BlockSpawner RNG Engine (35 shapes, dynamic weights, solvability guarantee)
│   ├── pieces.ts               # Danh mục 7 nhóm khối cốt lõi chuẩn Block Blast cổ điển
│   └── types.ts                # Shared network envelopes, room messages & board types
├── test/                       # Automated End-to-End Test Suite
│   ├── block_spawner_test.ts   # Kiểm thử BlockSpawner (35 khối, canPlace, solvability, dynamic weights)
│   ├── room_spectator_test.ts  # Kiểm thử phòng riêng bạn bè & spectator live view
│   ├── classic_pieces_test.ts  # Kiểm thử 35 khối chuẩn 7 nhóm cổ điển
│   ├── solvability_test.ts     # Kiểm thử tỷ lệ sống 100% trên bàn cờ thế bí
│   ├── step_depth_test.ts      # Kiểm thử phân bổ nước ăn ở bước 1, 2, 3
│   ├── e2e_game_test.ts        # 2-player real-time PvP match & placement test
│   ├── bot_match_test.ts       # 15-second bot fallback & AI move test
│   └── solo_leaderboard_test.ts# REST API test cho bảng xếp hạng chơi đơn
├── package.json
├── tsconfig.json               # Client TypeScript config
├── tsconfig.server.json        # Server TypeScript config
└── vite.config.ts              # Vite dev server configuration
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode
Run both backend server and Vite frontend concurrently:
```bash
npm run dev
```
- Client dev server: `http://localhost:3000`
- Authoritative WebSocket server: `http://localhost:3001`

### 3. Production Build & Start
```bash
npm run build
npm start
```
Open `http://localhost:3001` in your browser.

### 4. Run Automated E2E Tests
```bash
# Test BlockSpawner RNG Engine:
npx tsx test/block_spawner_test.ts

# Test Dopamine Combo Catalyst Spawner:
npx tsx test/dopamine_combo_test.ts

# Test 1v1 PvP HP Combat & Damage:
npx tsx test/combat_hp_test.ts

# Test Custom Friend Room & Live Spectator:
npx tsx test/room_spectator_test.ts

# Test PvP Matchmaking & Placement:
npx tsx test/e2e_game_test.ts

# Test 15s Bot Queue Fallback:
npx tsx test/bot_match_test.ts

# Test Solo Leaderboard REST API:
npx tsx test/solo_leaderboard_test.ts
```
