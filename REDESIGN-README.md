# 3กอง — UI redesign checkpoint

ส่งมอบต้นแบบ UI ที่เชื่อมกับระบบเกมเดิม พร้อม source, production build, ภาพ browser และหลักฐานทดสอบ ไม่ใช่การรับรองว่าระบบออนไลน์พร้อมเปิด production

## เริ่มใช้งาน

ต้องมี Node.js 20+ และ npm:

```sh
npm ci
npm run dev
```

เปิด URL ที่ Vite แสดง หน้า Home → เล่นกับเพื่อน/ฝึกกับ AI → เข้าสู่ระบบเดิม ไม่ได้ข้ามระบบบัญชี

```sh
npm test
npm run lint:ui
npm run build
npm run preview
```

`dist/` คือ production build; ต้องเสิร์ฟผ่าน HTTP ไม่ใช่เปิด index.html ด้วย file://
`/qa.html` ใช้เฉพาะ dev server สำหรับตรวจหน้าจอต่างขนาด ห้องซ้อมใช้ PracticeRoom จริงกับผู้เล่นจำลอง ส่วน Lobby/โต๊ะออนไลน์ใช้ข้อมูล fixture และไม่ต่อ Firebase หน้า QA ไม่รวมใน production build

## สิ่งที่เปลี่ยน

- Home ใหม่: โต๊ะผ้าสักหลาดสีเขียวเข้ม ขอบไม้ลายไทยร่วมสมัย ไพ่เป็นจุดเด่น ใช้ WebP 150,680 bytes
- Login/Register: จัดลำดับข้อมูลใหม่ ฟอร์มมี label และปุ่มแตะง่าย โดยคง SHA-256/session/registration handlers เดิม
- Lobby/เลือกห้อง: ให้รายชื่อโต๊ะเด่นก่อนข้อมูลรอง มี filter, profile และ leaderboard ที่อิงข้อมูลเดิม ไม่มีร้านค้าหรือรางวัลปลอมเพิ่ม
- ห้องออนไลน์: แยก GameRoomView จาก controller; โต๊ะมีตำแหน่งผู้เล่น/ชื่อ/ชิป/สถานะ รองรับที่นั่งว่าง
- ห้องซ้อมและห้องออนไลน์ใช้ ArrangementBoard เดียวกัน; 3–5–5, เลือก/ลาก/สลับ/ย้อน/จัดใหม่/จัดให้/ส่ง ใช้ handlers เดิม
- แยก click ของไพ่จาก click ของช่องว่างในกอง เพื่อไม่ให้เหตุการณ์ที่ไหลขึ้นไปล้างการเลือกไพ่
- ปักปุ่มจัดไพ่และยืนยันไว้ใน viewport; บนจอเล็กเลื่อนเฉพาะพื้นที่ไพ่ แนวตั้งเป็นรูปแบบหลัก แนวนอนแสดงโต๊ะซ้าย/ไพ่ขวา
- หน้าผลแสดงคะแนนก่อน รายละเอียดเปิดได้ด้วย disclosure; คำนวณคะแนน/ต๋ง/เงื่อนไขรอบถัดไปเดิม
- Settings เชื่อม soundVolume/speechMuted เดิม เป็นค่าของการเข้าห้องครั้งนั้น
- Loading ใช้ Suspense; แยกโหลด Login/Register/Lobby/Practice/Game/Admin ตามหน้าที่เข้า
- ลดน้ำหนักฟอนต์ที่ร้องขอเหลือ 400/500/600/700 เปิด browser zoom และใช้ safe-area/dvh
- Motion: card enter/select/lift, button press และ emoji feedback ด้วย transform/opacity; เคารพ reduced-motion ไม่มี animation library ใหม่

## ขอบเขตที่ล็อก

`ruleEngine.js`, `aiEngine.js`, `functions/index.js`, `firestore.rules` ตรงต้นฉบับทุก byte ตรวจด้วย `npm test` และ `qa/core-preservation.json`

เปรียบเทียบ source ของ named helper/handler ใน GameRoom 27, PracticeRoom 19, Lobby 3, Login 2, Register 2 รวม 53 ฟังก์ชัน: ไม่เปลี่ยน ทุกฟังก์ชันนี้รวม renderCard เดิมด้วย การตรวจนี้ไม่ใช่หลักฐานว่า integration ทุกสถานการณ์ถูกต้อง

ไม่มีการแก้ Firebase config, database schema, API contract, auth, scoring, commission, dealing หรือ AI algorithm ไม่มีการ deploy และไม่มีการทดสอบเขียนข้อมูลบัญชี/ชิปจริง

Build blocker เดิม: AdminPanel import `src/utils/sha256.js` ที่ไม่มีใน ZIP จึงคืน helper ด้วยโค้ดเดียวกับ Login และตรวจ SHA-256 สอง standard vectors

## Design system

| รายการ | แนวทาง |
|---|---|
| สี | พื้น #101713, felt #0B503B, wood #39271D, gold #C7AA70, ivory #F4EEDF, card #F8F3E8, suit red #BA273C |
| ตัวอักษร | Kanit 400–700, ตัวเลขไพ่ Georgia; ข้อความหลัก 15–18px, หัวข้อ 18–26px, metadata 12–13px |
| ระยะ | ฐาน 4px, เนื้อหาขอบ 16–20px, กลุ่ม 12–24px |
| รูปทรง | ไพ่ 6px, กอง 10px, ปุ่ม 12px, sheet 24px, avatar วงกลม |
| ปุ่ม | primary ทองอุ่นใช้กับการตัดสินใจหลัก; secondary เขียวเข้ม; icon 44px ขึ้นไป |
| ไพ่ | งาช้าง สัญลักษณ์แดง/ดำ, เงาบาง, ยก 6px เมื่อเลือก; ช่องว่างกองมีเส้นประ |
| สถานะ | รอเล่น/พร้อม/จัดไพ่/ส่งแล้ว; จำนวนไพ่/ฟาวล์/พร้อมส่ง ไม่เพิ่มตัวจับเวลาหรือระบบเทิร์นที่ไม่มีในเกม |
| Motion | press 120ms, select 140ms, enter 220ms; ไม่มีเอฟเฟกต์ฉลองบังผลคะแนน |

Reusable components: `ui/GameUI.jsx`, `lobby/HomeView.jsx`, `lobby/LobbyView.jsx`, `game/TableSurface.jsx`, `game/GameHeader.jsx`, `game/ArrangementBoard.jsx`, `game/GameRoomView.jsx`.

## ผลทดสอบ

- Build production ผ่าน; baseline หลังคืน missing helper JS 754KB/gzip197.47KB → entry หลังแยกโหลด 635.68KB/gzip166.47KB; ยอดรวมทุก chunk ไม่ได้ลดตามสัดส่วนนี้
- CSS ประมาณ40KB/gzip9.3KB; artwork147KiB; ไม่มีการวัดเวลาโหลดบนเครือข่ายมือถือหรือรับรอง60FPS
- ยังมีคำเตือน entry chunk >500KB เพราะ Firebase compat ยังคงโหลดตั้งแต่ App; ไม่แก้ SDK/auth ในงาน UI
- `npm test`: 4 rule-engine baseline cases + 4 locked-file hashes + 2 SHA-256 vectors ผ่าน
- `npm run lint:ui`: ผ่าน
- `npm run lint`: ยังไม่ผ่าน 18 errors/3 warnings ของระบบเดิม เช่น undefined isDragonHand ใน Cloud Functions, no-empty, unused declarations และ hook dependencies; ไม่ปิดกฎ lint เพื่อซ่อนปัญหา
- Browser: Home/Login/Register, Lobby fixture/filter/profile, Practice, GameRoomView fixture waiting/playing/results, Settings ถูกเปิดและตรวจจาก DOM/screenshot
- Practice flow จริง: เริ่มแจก → แตะ/วางกอง → undo → auto → swap กลาง/หลังแสดงฟาวล์ → undo → submit → results; คะแนนตัวอย่าง +3,-3,-6,+6 รวม0
- Practice รอบถัดมา: ลาก 2♦ จากมือไปกองหน้าได้ เหลือ12 → reset เหลือ13 → auto ได้3/5/5
- Viewports ตรวจ 390×844,320×568,844×390; เก็บภาพสำคัญใน `qa/` การทดสอบนี้เป็น Chrome iframe ขนาดมือถือ ไม่ใช่ iOS Safari/Android hardware หรือ notch จริง
- Console ตรวจพบ browser-extension metadata errors; ไม่ใช้สิ่งนี้เป็นหลักฐานว่าเกมผิดพลาด และไม่ได้รับรอง console ทุกหน้าหลัง login

## สถานะ Phase / งานก่อนเปิดจริง

A audit เสร็จ, B design system เสร็จ, C UI architecture เสร็จ, D Home/Lobby prototype เสร็จ, E GameRoom presentation prototype เสร็จ, F interaction ทดสอบใน Practice, G motion/sound UI เชื่อมแล้วแต่ยังต้องฟังบนอุปกรณ์จริง, H ตรวจ viewport แล้วแต่ยังต้อง hardware QA, I local regression ผ่านตามขอบเขตข้างบน ส่วน multiplayer integration ยังรอ, J visual polish รอบนี้เสร็จ แต่ production sign-off ยังไม่ผ่าน

ต้องทดสอบด้วยบัญชีและห้อง staging ที่แยกจากข้อมูลจริง: login/register/admin, ผู้เล่น2–4คน, ready/deal, submit/cancel, reconnect, spectator/queue, settle chips/commission, history/chat, next round/close room และเสียงบน Safari/Android

ปัญหาเดิมที่ต้องตัดสินใจแยกจาก UI: Firebase rules ต้อง request.auth แต่ client เป็น custom members/session; Cloud Function undefined isDragonHand; เอกสารกติกา/โบนัสไม่ตรงบางจุด; Practice matchup labels เทียบเฉพาะ rank ต่างจากคะแนนจริง; maxRounds0 และ history compat snap.exists(); settlement ordering; AI synchronous อาจบล็อก main thread ไม่แก้สิ่งเหล่านี้โดยอาศัยการ redesign

ไม่เพิ่มร้านค้า/เติมเงิน/รางวัล/โปรไฟล์ปลอมตามภาพอ้างอิง และไม่แสดงมังกรว่า auto win ในข้อความ UI เพราะ audit พบ client scoring ไม่รองรับคำอธิบายนั้นอย่างชัดเจน โดยไม่ได้เปลี่ยนการคำนวณมังกร

## Checkpoints

เก็บต้นฉบับแยกก่อนแก้ มี git checkpoints ระหว่าง baseline/Home-Lobby/gameplay และไฟล์ `changes.patch` สำหรับดู diff จากต้นฉบับ `23b72fb` ได้ ต้นฉบับแนบไม่ได้ถูกแทนที่
