# 3กอง — Project Audit และแผนยกระดับ UI

วันที่ตรวจ: 5 กันยายน 2026 • ขอบเขต: Audit / เสนอแผนเท่านั้น

## ข้อสรุป

โปรเจกต์นี้เหมาะกับการปรับ UI บน React + Vite เดิม ไม่จำเป็นต้องเขียนเกมใหม่หรือย้าย framework แต่ ZIP ที่แนบมายัง build ไม่ผ่านเพราะขาด `src/utils/sha256.js` และมีความไม่สอดคล้องระหว่าง client, Rules, Cloud Functions และข้อความกติกา ต้องเก็บประเด็นเหล่านี้แยกจากการ redesign

ยังไม่ได้แก้ source code, กฎเกม, คะแนน, Firebase, authentication, Cloud Functions หรือ deploy ใด ๆ ตรวจเทียบไฟล์ต้นฉบับกับ ZIP แล้วทั้ง 21 ไฟล์ตรงกันทุกไบต์

ภาพอ้างอิงที่แนบเป็นเป้าหมายทางศิลป์ ไม่ใช่หลักฐานว่า UI เดิมมีหน้าหรือฟังก์ชันทุกอย่างตามภาพ

## 1. โครงสร้างและสถาปัตยกรรมปัจจุบัน

ZIP มี 29 entries รวม directory และไฟล์จริง 21 ไฟล์ รวม 271,901 bytes ไม่รวม dependencies ภายหลังติดตั้ง

| ส่วน | ไฟล์ | หน้าที่ |
|---|---|---|
| Entry | index.html, src/main.jsx | HTML ภาษาไทย, โหลด Kanit จาก Google Fonts, React StrictMode, CSS รวม |
| App | src/App.jsx | เริ่ม Firebase compat, export db/firebase, สลับหน้าด้วย useState |
| Authentication | src/components/Login.jsx, Register.jsx | อ่าน/เขียน members, SHA-256 ใน client, sessionStorage |
| Lobby | src/components/Lobby.jsx | โปรไฟล์ย่อ, XP, ชิป, leaderboard, รายชื่อห้อง/ตัวกรอง, ทางเข้าห้องซ้อม |
| Multiplayer | src/components/GameRoom.jsx | รอเล่น, จัดไพ่, ผลลัพธ์, Firestore listeners, แจก/ส่ง/สรุปคะแนน, ชิป, ประวัติ, chat/emoji, เสียง |
| Practice | src/components/PracticeRoom.jsx | เล่นคนเดียวกับบอท 3 คน, ชิปฝึก, จัดไพ่, undo/reset, ผลลัพธ์ |
| Admin | src/components/AdminPanel.jsx | ห้อง, สมาชิก, อนุมัติ/ระงับ, ชิป, ประวัติและรายงาน |
| Rule Engine | src/utils/ruleEngine.js | สำรับ, เรียง/เทียบไพ่, validity, bonus, dragon detection, คะแนน, matchup |
| AI | src/utils/aiEngine.js | ค้นหาชุด 3-5-5, presets, heuristic analysis |
| Tests | src/utils/testEngine.js | ทดสอบพื้นฐาน 4 กรณี |
| Styling | src/styles/premium.css | tokens, global CSS, cards, table, lobby, motion, breakpoint มือถือ |
| Server | functions/index.js, functions/package.json | callable dealCards / submitPlayerHand / settleRound |
| Firebase | firestore.rules, firebase.json | access rules; hosting config |
| Build/CI | package.json, vite.config.js, .github/workflows/main.yml | Vite, npm, GitHub Actions deploy hosting |
| Documentation | README.md | วิธีติดตั้งและสรุปกติกา |

Framework: React 18 + JavaScript JSX + Vite 5; ไม่ใช่ Next.js, Expo หรือ native app

Navigation: `screen` ใน App.jsx มี login/register/lobby/game-room/practice/admin ไม่มี URL router ที่ใช้งานจริง แม้ติดตั้ง react-router-dom ไว้

State: useState/useRef/useEffect ภายใน component; ไม่มี Redux/Zustand ข้อมูลเกมกับ UI อยู่ในไฟล์เดียวกันเป็นส่วนใหญ่ และ component หลายตัว import db จาก App.jsx ซึ่งเป็น parent ที่ import component เหล่านั้นกลับ

Game lifecycle ฝั่ง client: lobby → playing → results → lobby; จัดไพ่พร้อมกันตามสถานะการส่ง ไม่พบระบบผลัดตาหรือนับถอยหลังจริงที่ควรนำ timer จากภาพเรฟมาแทน

### Dependencies

| Package | package.json | เวอร์ชันที่ติดตั้งในการตรวจ |
|---|---|---|
| react / react-dom | ^18.3.1 | 18.3.1 |
| firebase | ^10.12.0 | 10.14.1 |
| react-router-dom | ^6.23.1 | 6.30.6 |
| lucide-react | ^0.379.0 | 0.379.0 |
| html2canvas | ^1.4.1 | 1.4.1 |
| vite | ^5.2.11 | 5.4.21 |
| @vitejs/plugin-react | ^4.3.0 | 4.7.0 |
| eslint | ^8.57.0 | 8.57.1 |

มี ESLint plugins และ React type packages เพิ่มเติม; Functions ระบุ firebase-admin ^12, firebase-functions ^5, Node 18 ส่วน CI ใช้ Node 20 และเครื่องตรวจเป็น Node 24.19.0/npm 11.9.0 ไม่ได้รัน Functions emulator หรือ install dependencies ของ Functions

ไม่พบการ import ใช้งาน react-router-dom/html2canvas ใน src จึงเป็น dependency ที่ควรทบทวนภายหลัง ไม่ใช่ข้อสรุปว่าถูกบรรจุใน bundle ทั้งหมด

Assets: ไม่มีภาพโต๊ะ, สำรับไพ่, avatar images, font files หรือ audio files อยู่ใน ZIP; ไพ่เป็น DOM/CSS, avatars ส่วนใหญ่เป็น emoji, icons ใช้ Lucide

Audio: GameRoom ใช้ oscillator ของ Web Audio และ speechSynthesis ภาษาไทย ไม่พบไฟล์เพลงพื้นหลัง ไม่พบหน้าตั้งค่าเสียงที่เชื่อมใช้งานครบ แม้มี state volume/mute

README เรียกโปรเจกต์ว่า PWA แต่ไม่พบ manifest/service worker ในชุดนี้ จึงยังยืนยัน offline/install experience ไม่ได้

## 2. Baseline ที่ตรวจได้จริง

| การตรวจ | ผล |
|---|---|
| แตกไฟล์และตรวจ relative imports | พบ AdminPanel import ../utils/sha256.js แต่ไม่มีไฟล์ |
| npm install --ignore-scripts --no-audit --no-fund --package-lock=false | สำเร็จ ติดตั้ง 370 packages; ไม่สร้าง lockfile ให้โปรเจกต์ |
| npm run build | ไม่ผ่าน: Could not resolve "../utils/sha256.js" from "src/components/AdminPanel.jsx" |
| npm run lint | ไม่ผ่าน: ESLint couldn't find a configuration file |
| node src/utils/testEngine.js | ผ่าน 4 กรณี: สำรับ 52 ใบ, ตอง, royal flush, foul arrangement |
| node --check functions/index.js | ผ่าน syntax check เท่านั้น ไม่ยืนยัน runtime |
| npm run dev -- --host 0.0.0.0 | ติดข้อจำกัด environment: uv_interface_addresses |
| npm run dev -- --host 127.0.0.1 --open false | dev server พร้อมใช้งาน port 3000 |
| เปิด browser ไป localhost | ถูก browser URL policy ปฏิเสธ: ERR_BLOCKED_BY_CLIENT |
| ตรวจ screenshot / console ของเกมจริง | ยังทำไม่ได้ เพราะ browser เปิด local app ไม่ได้ และ source ยังมี missing import |
| เล่นออนไลน์ / login / registration / multiplayer | ยังไม่ยืนยัน; ไม่สร้างผู้ใช้ ไม่เปลี่ยนชิป ไม่ส่งข้อมูลเกมเข้าสู่ฐานข้อมูลจริง |
| JS bundle size / Lighthouse / FPS / mobile touch | ยังวัดไม่ได้; ไม่อ้างผล performance บน iPhone/Android |

การเรียก build/lint ก่อน install เสร็จพบ vite/eslint not found; หลัง install สำเร็จได้ผลสุดท้ายด้านบน จึงไม่ถือว่าการขาดเครื่องมือช่วงแรกเป็นข้อบกพร่องของ source

Warnings ที่พบระหว่างติดตั้ง: npm http-proxy config, deprecation ของ ESLint 8 และ dependencies บางตัว เช่น inflight/glob/rimraf/humanwhocodes ไม่ได้ทำ dependency security audit ในงานนี้

ข้อจำกัด test เดิม: มี 4 กรณีเท่านั้น ไม่ทดสอบคะแนน, derby, dragon, bonus หลายแบบ, multiplayer หรือ parity กับ Functions และ catch error โดยไม่กำหนด exit code ล้มเหลว ข้อความ “100% PARITY CONFIRMED” ที่สคริปต์พิมพ์ไม่ใช่หลักฐาน coverage 100%

### Diagnostic เพิ่มเติมโดยไม่แก้โค้ด

- เรียก bonus ของ AAA กองหน้าได้ 5; AAAA กองหลังได้ 6 ซึ่งต่างจากข้อความกติกา 8 ทั้งสองกรณี
- เทียบ Broadway กับ wheel ด้วยไพ่ตัวอย่างชุดเดียวกัน: client คืน +1 แต่ pure comparator ใน Functions คืน -1 ยืนยันว่าทั้งสอง comparator ไม่เหมือนกันในกรณีนี้ ไม่ได้ตัดสินว่ากติกาไหนควรถูกใช้
- aiArrange กับมือไพ่คงที่หนึ่งมือ ใช้ประมาณ 2,155 ms ใน Node ของเครื่องตรวจ และคืน arrangement ที่ valid นี่เป็นเพียงหนึ่ง sample ไม่ใช่ benchmark มือถือหรือค่าเฉลี่ย
- ฟังก์ชัน AI ทำ 1,287 × 56 = 72,072 candidate layouts ก่อนกรอง โดยทำ synchronous จาก handler ใน GameRoom มีความเสี่ยงบล็อก main thread

## 3. Core ที่ต้องล็อกไว้

| ไฟล์/ระบบ | สิ่งที่ต้องรักษา |
|---|---|
| ruleEngine.js ทั้งไฟล์ | ranks, suits/tie break, straightKey, validArr, bonus, dragon, calcScores, buildMatchups และรูปแบบ output |
| aiEngine.js ทั้งไฟล์ | scoring weights, search order, preset/fallback และผลลัพธ์; ย้ายไปรัน worker ต้องเทียบ output ก่อน |
| GameRoom.jsx ส่วน behavior | autoFillInto/dropCard, undo, shuffle/deal, submit/cancel, host/ready/presence, settleScores, commission, rounding, XP, next round, exit/rejoin, history migration |
| PracticeRoom.jsx ส่วน behavior | สำรับ/สุ่ม, botArrange 80 attempts, move/swap/autofill, undo/reset, submission, score/chip updates |
| Login/Register และ App.jsx ส่วน session | hash, member id, session keys, callbacks, existing login behavior |
| Firebase / functions / rules | schema, collections, nested paths, payloads, callable names, deployed contracts |
| AdminPanel business handlers | สมาชิก, ชิป, อัตรา/ค่าต๋ง, การสร้าง/ปิดห้อง, ประวัติ |

UI ที่แยกออกใหม่รับข้อมูลและ callback เดิมเท่านั้น ไม่คำนวณคะแนนใหม่ ไม่ส่ง Firestore writes เอง ไม่เปลี่ยน identity ของ card objects ที่ระบบ selectedCard/indexOf ใช้อยู่โดยไม่ตรวจ regression

หากการปรับ UI ต้องเปลี่ยนโค้ด behavior ในรายการนี้ ให้หยุดอธิบายเหตุผลและขออนุมัติเฉพาะเรื่องก่อน ตามข้อกำหนดของผู้ใช้

## 4. 10 ประเด็น UI/UX สำคัญที่สุด

ทั้งหมดนี้มีหลักฐานจาก source แต่ยังไม่ใช่ผลยืนยันจาก screenshot ของเกมเดิม จัดอันดับเพื่อใช้ตรวจและปรับเมื่อ baseline เปิดได้

| อันดับ | หลักฐาน/ปัญหา | ผลกระทบและข้อเสนอ |
|---|---|---|
| 1 | GameRoom/PracticeRoom ใช้ 100vh + overflow hidden, โต๊ะ flex:1 และ my-hand flex-shrink:0; ไพ่บนมือ wrap หลายแถว | เสี่ยงเบียดโต๊ะ/avatars หรือทำให้ปุ่มพ้นพื้นที่จอสั้น; แบ่งพื้นที่โต๊ะ, arranger และ action bar ตามความสูงจริง |
| 2 | breakpoint 430px ลดปุ่มใน my-hand เป็น padding 5px 6px และตัวอักษร 10px | พื้นที่แตะและข้อความเล็กใน interaction หลัก; ปุ่มหลักสูง 48–52px, icon target อย่างน้อย 44px |
| 3 | กอง 5 ใบใช้ flex-wrap พร้อม label และ badge ข้างกอง | ความสูงอาจกระโดดเมื่อไพ่ครบ/มีชื่อมือ; กำหนด layout 5 ช่องและพื้นที่ label แยกไว้ล่วงหน้า |
| 4 | ชื่อกอง writing-mode vertical-lr, 10px; empty hint opacity .15 | อ่านภาษาไทยและหาตำแหน่งวางยาก; ใช้หัวข้อแนวนอนพร้อมจำนวน 0/3, 0/5 และสัญลักษณ์สถานะ |
| 5 | ปุ่ม chat fixed bottom/right ทับระดับเดียวกับ action; emoji 7 ปุ่มอยู่ใต้ arranger | เครื่องมือสังคมแย่งพื้นที่นิ้วโป้ง/อาจทับปุ่ม; เก็บใน dock เล็กและ drawer ที่จัด safe area |
| 6 | Lobby วาง mission placeholders + leaderboard ก่อน room list | งาน “เข้าห้อง” อยู่ลึกและกลายเป็นหน้าสถิติ; ให้เล่นต่อ/เลือกห้องนำ ส่วน leaderboard พับเปิดได้โดยคงฟีเจอร์ |
| 7 | drop-zone/ไพ่เป็น div ไม่มี keyboard semantics; pointermove ใด ๆ ถือว่า drag, ไม่มี pointercancel cleanup | การแตะสั่นเล็กน้อยอาจกลายเป็นลาก; เพิ่ม drag threshold/cancel handling และ accessible controls หลังอนุมัติ interaction changes |
| 8 | ผลลัพธ์ออนไลน์แสดงไพ่ 20px แล้ว scale .85; practice 28×38px | รายละเอียดชนะ–แพ้อ่านยาก; เปิดผลย่อก่อนแล้วขยายเทียบทีละคู่ ให้ไพ่เป็นจุดเด่น |
| 9 | ธีมผสม navy/ชมพู/ม่วง/ทอง, glass panels และ inline styles จำนวนมาก | ภาษาภาพไม่สม่ำเสมอ; ใช้ emerald/charcoal/wood/ivory และทองเฉพาะจุดนำสายตา |
| 10 | alert/confirm ของ browser, error บางส่วนถูกกลืน; outline none, ไม่พบ reduced-motion; safe-area ถูก shorthand padding ที่มาทีหลัง/inline ทับบางจุด | สถานะผิดพลาดและ accessibility ไม่ต่อเนื่อง; ใช้ modal/toast ที่เข้าถึงได้, focus visible, reduced motion และ safe-area tokens |

ตัวอย่าง safe-area conflict: .safe-area-top ประกาศก่อน .app-header ที่มี padding shorthand; .lobby-layout มี padding หลัง .safe-area-bottom; Practice menu ใช้ inline padding ทับ safe-area-bottom การมี class อยู่จึงยังไม่รับประกันว่า inset มีผล

## 5. Technical debt ที่กระทบ redesign

### ต้องรับรู้ก่อนเริ่ม implementation

1. **Missing module:** sha256.js ขาด ทำให้ whole app build ไม่ผ่าน เพราะ App import AdminPanel แบบ eager ขอไฟล์ต้นฉบับที่ขาดจะปลอดภัยกว่าสร้าง behavior authentication ใหม่
2. **Client / backend คนละเส้นทาง:** หน้าเว็บใช้ Firebase compat Firestore ตรง ไม่พบ Firebase Auth sign-in หรือ callable invocation แต่ firestore.rules ต้องมี request.auth; client เขียน scores/deals/chips ซึ่ง Rules ชุดนี้ห้าม และไม่มี match สำหรับ admin/config/history paths ที่หน้าเว็บใช้ จึงยังใช้ ZIP นี้ยืนยัน backend ที่ deploy จริงไม่ได้ ห้ามแก้ Rules ให้ permissive เพื่อให้หน้าเว็บผ่าน
3. **Cloud Functions ไม่ได้เป็น backend ที่ frontend นี้เรียก:** Functions ใช้ subcollections deals/hands แต่ client ใช้ maps บน room document; callable submit เขียน brief hand ตามชื่อ ส่วน client ต้องการ full arrangement ไม่ควรสลับเส้นทาง backend ระหว่าง redesign
4. **Functions runtime issue จาก static inspection:** settleRound อ้าง isDragonHand โดยไม่มี definition/import; node --check ไม่สามารถตรวจ unresolved runtime name นี้ได้
5. **คะแนนกับคู่มือไม่ตรงกัน:** กองหน้าปกติใน calcScores ใช้ 1 เมื่อไม่มีโบนัส แต่คู่มือระบุ 2; AAA หน้า 5 vs คู่มือ 8; AAAA หลัง 6 vs คู่มือ 8; derby code คูณ 4 หลังทะลุ แต่คู่มือบอกคูณ 2 อีกครั้ง; UI ประกาศ dragon ชนะอัตโนมัติ แต่ calcScores ไม่มี dragon override เรื่องทั้งหมดต้องตกลงกติกาแยก ไม่แก้ตามความเห็นนักพัฒนา
6. **สอง comparator ต่างกัน:** ได้ทดสอบ client/server straight comparison ที่ให้ผลต่างจริงแล้ว ไม่ควรเรียกสิ่งนี้ว่า parity
7. **Build reproducibility:** ไม่มี lockfile และ ESLint config, ไม่มี npm test script; Node Functions/CI/local ต่างรุ่น

### ความเสี่ยง behavior ที่ต้องมี regression cases

- GameRoom 1,671 บรรทัด, AdminPanel 1,216, PracticeRoom 593, CSS 956; มี inline style={{ รวม 453 จุด ทำให้การเปลี่ยน global CSS กระทบหลายหน้าพร้อมกัน
- GameRoom history ใช้ snap.exists() แต่ Firebase compat DocumentSnapshot ใช้ property exists ในส่วนอื่นของโค้ด จุดนี้เสี่ยง runtime TypeError เมื่อ callback ทำงาน
- Lobby refresh: listener ผูก admin/data แล้ว get room documents; การเปลี่ยน room occupancy อย่างเดียวไม่ได้ trigger listener นี้ จึงมีโอกาสรายชื่อผู้เล่น/สถานะค้าง
- Room maxRounds ค่า 0 ถูก UI admin ระบุว่าไม่จำกัด แต่ handleHostStart ตรวจ round >= maxRounds โดยไม่กัน 0 จึงมีเส้นทางปฏิเสธเริ่มเกม
- Practice matchup winner เทียบเฉพาะ rank แต่คะแนนใช้ cmpH ที่รวม key/suit จึงอาจขึ้นเสมอทั้งที่คะแนนมีผู้ชนะ
- GameRoom settleScores อัปเดต status/settledRound ก่อน batch ยอดสมาชิก หาก batch ภายหลังล้มเหลว อาจแสดงผลแล้วแต่ยอดไม่ครบ ห้ามเปลี่ยนใน UI phase
- ประวัติถูกย้ายไป history/details โดย host effect แต่ Admin ยังอ่าน room.roundHistory และ Rules ไม่มี history match; mount ห้องจริงเพื่อ preview อาจมีผลเขียนข้อมูล จึงควรทดสอบด้วย fixtures/emulator ที่แยกจากข้อมูลจริง
- effects บางตัวผูกแค่ roomId แต่ใช้ myId/chatOpen/closures อื่น ต้องทดสอบ reconnect, leave/rejoin และ unread states
- selectedCard อาศัย object identity; การ clone ทุกครั้งเพื่อสร้าง view model อาจเปลี่ยน tap/swap behavior
- บอทฝึกใช้ heuristic สุ่ม 80 ครั้ง ต่างจาก exhaustive AI ออนไลน์ ต้องคงความแตกต่างเดิมไว้
- aiAnalysis/presets มีในไฟล์ แต่ไม่พบเรียก aiAnalysis หรือ setter เปลี่ยน mode ใน UI; อย่าอ้างว่าทุก AI mode มีให้เล่นแล้ว

## 6. Visual Direction ที่เสนอ

**“วงไพ่ไทยร่วมสมัยในห้องไม้แสงอุ่น”**

ใช้ภาพอ้างอิงเป็นทิศทางเรื่องวัสดุ แสง และสัดส่วน ไพ่สี ivory คมชัดบนผ้าสักหลาด emerald; ฉากไม้และลายไทยใช้เป็นชั้นรอง ไม่แย่งไพ่ ลดกองเหรียญ มงกุฎ และกรอบทองซ้ำ ๆ เพื่อให้บรรยากาศเป็น social card game ตาม brief

Home: โลโก้ 3กอง มีพื้นที่หายใจ, ภาพโต๊ะเป็นฉากนำ, ปุ่มหลักหนึ่งปุ่ม “เลือกห้องเล่น” และทางรอง “ฝึกกับ AI”; ถ้ามีห้องเดิมให้ใช้ callback กลับเข้าห้องเดิม แสดงข้อมูลจริงเท่านั้น

Game Room: ผู้เล่นอยู่ตำแหน่งสัมพันธ์กันบนโต๊ะ, avatars 44–56px, ชื่อ/ชิป/สถานะรวมเป็นหนึ่งกลุ่ม; แสดง “กำลังจัด / ส่งแล้ว / รอผู้เล่น” จาก state จริง ไม่สร้าง turn timer หรือระบบยอมแพ้จากภาพเรฟโดยไม่มี logic เดิม

Arranger: ให้ไพ่เป็นส่วนใหญ่ของพื้นที่ใช้งาน แถวหน้า 3 ใบ กลางและหลัง 5 ใบ; labels แนวนอนเหนือแต่ละแถว; มือที่ยังไม่วางแยกชัด; confirm อยู่ในระยะนิ้วโป้ง; undo/reset/swap เดิมอยู่ครบ เครื่องมือเสริมพับเปิดได้

ภาพเรฟมี “แต้มรวม” เป็นผลบวกหน้าไพ่ ซึ่งไม่ควรนำมาใช้กับ engine นี้ ให้แสดงชื่อมือ/จำนวนไพ่/สถานะ valid ตาม engine ปัจจุบัน ไม่สร้างวิธีคิดคะแนนจาก artwork

Identity ไทย: โลโก้ไทยเฉพาะเกม, ลายหลังไพ่แบบเรขาคณิตไทยเส้นบาง, ภูมิทัศน์ริมน้ำ/แสงโคมใน Home แบบภาพบีบอัด; ฉากเล่นใช้ texture เล็ก tile ซ้ำ ลดภาระโหลด

Portrait เป็นรูปแบบหลักสำหรับจัด 3 กอง; landscape/tablet ใช้โต๊ะกับ arranger แบ่งพื้นที่เมื่อความสูงจำกัด ไม่บังคับหมุนจอจนกว่าจะพิสูจน์ความจำเป็นด้วย prototype

## 7. Design System เบื้องต้น

ตัวเลขต่อไปนี้เป็นค่าออกแบบเสนอ ยังไม่ได้ implement หรือทดสอบ contrast/อุปกรณ์จริง

| Token | ค่าเสนอ / การใช้ |
|---|---|
| Background | #101713 — ฉากหลัก |
| Surface | #1B211C — เมนู/แผง |
| Felt | #0B503B — โต๊ะ |
| Felt deep | #06372A — ขอบ/เงาโต๊ะ |
| Wood | #39271D — วัสดุขอบ |
| Gold | #C7AA70 — primary action/ขอบบาง |
| Text | #F4EEDF — ivory |
| Muted | #B7BDAF — ข้อความรอง |
| Success / warning / error | #70C39B / #E4BB72 / #EC8585; ใช้ icon/text ร่วมกับสี |
| Typography | Kanit เดิม 400/500/600/700; ข้อความ 14–16px, รอง 12–13px, หัวข้อ 20–24px, card rank 24–30px; tabular numbers สำหรับคะแนน |
| Spacing | 4, 8, 12, 16, 24, 32px; gutter 12–16px |
| Radius | ไพ่ 6px, ปุ่ม 10–12px, แผง 16px, sheet 24px; ไม่ใช้ radius เดียวทุกอย่าง |
| Shadows | ไพ่ 0 2px 6px rgba(0,0,0,.25); ยกไพ่ 0 8px 16px rgba(0,0,0,.32); จำกัด glow |
| Buttons | primary สูง 48–52px, secondary 44–48px, icon target ≥44×44px, destructive แยกจาก confirm |
| Cards | Mobile เริ่มทดลอง 48×68px; กอง 5 ใบต้องไม่ wrap; select ยก 6–8px; rank/suit อ่านได้โดยไม่ต้องขยาย |
| Avatars | 44/52/64px, status ring และชื่อแยกชั้น; emoji เดิมยังรองรับ |
| Panels / Modals | ใช้กับข้อมูลรอง; bottom sheet สำหรับ chat/history; focus trap/restore, keyboard, safe-area |
| Badges | waiting / arranging / submitted / spectator / host / disconnected แสดงเฉพาะ state ที่มีหลักฐาน |
| Icons | Lucide เดิม 20–24px, stroke สม่ำเสมอ และ accessible labels |
| Game states | empty, selected, dragging, target, full, incomplete, foul, submitting, submitted, result; UI-only loading/error ไม่เขียน schema ใหม่ |

Contrast gate: ตรวจข้อความปกติเป้าหมายอย่างน้อย 4.5:1 และไม่ใช้สีอย่างเดียวสื่อสถานะ; input 16px, focus visible, ไม่ปิดการซูมโดยไม่จำเป็น

### Motion specification

| เหตุการณ์ | แนวทาง |
|---|---|
| Deal | transform/opacity 180–240ms ต่อชุด + stagger 25–35ms; ไม่หน่วง gameplay state |
| Select / lift | 100–140ms, translateY -6px, ไม่เปลี่ยน layout |
| Move / reorder | 160–220ms; FLIP เมื่อจำเป็น; logical swap ยังเหมือนเดิม |
| Drag | ghost ตาม pointer; render React เมื่อปล่อย; pointercancel/threshold ต้องทดสอบ |
| Status change | ring/opacity 160–200ms; ไม่สร้าง turn ใหม่ |
| Button press | 80–120ms, scale .97 หรือยุบ 1–2px |
| Room transition | 180–240ms fade/slide ระยะสั้น |
| Win | highlight 500–700ms, effect จำกัดจำนวน |
| Lose | ลดแสงสั้น 200–300ms, ผลคะแนนยังอ่านง่าย |
| Score update | 300–450ms, animate display เท่านั้น ค่าคะแนน authoritative ไม่เปลี่ยน |

รองรับ prefers-reduced-motion; ไม่ animate box-shadow ต่อเนื่อง; ไม่เพิ่ม animation library ขนาดใหญ่ 60 FPS เป็นเป้าหมายที่ต้องวัดจริง ไม่ใช่คำรับประกันจาก CSS

## 8. Architecture ของ UI ใหม่ที่เสนอ

คง App navigation, React/Vite, state/handlers/backend เดิมไว้ก่อน แล้วแยกชั้นแสดงผลทีละส่วน

| กลุ่มใหม่ | Components ที่เสนอ | ขอบเขต |
|---|---|---|
| ui | GameButton, IconButton, Avatar, Badge, Sheet, Toast | รูปแบบ, focus, accessibility |
| cards | PlayingCard, CardBack, PileRow, HandTray | รับไพ่/selected state และ callbacks เดิม |
| table | TableSurface, PlayerSeat, RoomStatus | render ผู้เล่นและสถานะ ไม่มี Firestore writes |
| arrangement | ArrangementBoard, ArrangementActions | ประกอบกองและปุ่ม ใช้ move/swap/undo/submit เดิม |
| lobby | HomeView, RoomList, RoomListItem, PlayerSummary | render ข้อมูลจาก Lobby container |
| results | RoundResultView, MatchupDetail | แสดงผลจาก engine เดิม ไม่คำนวณสูตรใหม่ |
| styling | tokens.css, ui.css, table.css, cards.css, lobby.css | scope class ใหม่ ลดผลต่อ Admin และ legacy views |

ต้นแบบใช้ fixture props แยกจาก production containers ที่มี effects เขียนข้อมูล ห้ามใช้การปลอม session เพื่อข้าม authentication หรือเพิ่ม mock fallback ที่เงียบ ๆ แทนข้อมูลจริง

การแยก handlers ไป hooks/เปลี่ยน state management ยังไม่ทำใน phase visual เพราะเพิ่มความเสี่ยงโดยไม่จำเป็น

### หน้าจอที่ต้องครอบคลุม

| หน้า | มีใน ZIP หรือไม่ | งานเสนอ |
|---|---|---|
| Splash / Loading | มี loading รายส่วน ไม่มี splash เต็มหน้า | สร้าง loading shell เบา ไม่บังคับรอโลโก้ |
| Home | ไม่มี standalone | แยกทางเข้าหลักจาก Lobby โดยใช้ callback เดิม |
| Login / Register | มี | จัด composition/forms ใหม่ คง authentication |
| Lobby | มี | ให้ entry และสถานะผู้เล่นนำ |
| Room selection | อยู่ใน Lobby | room list อ่านง่าย แสดง capacity/rate/chips ตามจริง |
| Game Room | มี waiting/playing/results | โต๊ะและสถานะที่นั่งชัดเจน |
| Practice Room | มี menu/playing/results | ภาษา UI ร่วมกับออนไลน์ คง bot algorithm |
| Card arrangement | อยู่ในสองห้อง | component แสดงผลร่วม คง interaction semantics |
| Game result | อยู่ในสองห้อง | ผลย่อก่อนและขยายเทียบรายคู่ |
| Player profile | มี summary ใน Lobby ไม่มีหน้าเต็ม | ขยายข้อมูลเดิมแบบ read-only ก่อน ไม่มีระบบ achievement ใหม่ |
| Settings | ไม่พบหน้าเต็ม | เสนอหน้าควบคุมเสียง/ลด motion; wiring ใหม่ต้องระบุขอบเขต ไม่อ้างว่าของเดิมพร้อมแล้ว |
| Chat / Emoji / History | มีใน GameRoom | ปรับ drawer/dock และ readability |
| Leaderboard | มีใน Lobby | คงข้อมูล/อันดับเดิม เปิดจากทางรอง |
| Admin / chip / room history | มี | คง flow บริหารไว้ ทดสอบ CSS ไม่ให้กระทบ; visual polish ลำดับท้าย |

ร้านค้า, gifting, weekly tournaments และ achievements ตามภาพเรฟไม่พบระบบใช้งานใน ZIP จึงไม่รวมเป็นฟีเจอร์ที่สร้างแฝงในงาน redesign

## 9. แผนเป็น Phase และเกณฑ์ผ่าน

| Phase | งาน | Gate ก่อนเดินต่อ |
|---|---|---|
| A — Audit/baseline | รายงานนี้; กู้ไฟล์ที่ขาด, ทำ build/lint reproducible, หาทางรัน browser ที่ได้รับอนุญาต | Build/lint ผ่าน, มี baseline ภาพจริง; ระบุ backend/version ที่ใช้ได้ |
| B — Art direction | ตรวจ composition และ tokens จาก brief/เรฟ | เห็น direction ที่ไพ่เด่นและไทยร่วมสมัย |
| C — UI architecture | กำหนด pure views/props/callbacks และ scope CSS | Core/contracts คงเดิม, ตรวจ diff ได้ |
| D — Home/Lobby prototype | Home, Room list, auth shell; fixtures ที่แยกชัด | เปิด/ดูภาพจริง 320–430px และ desktop, entry flow ครบ |
| E — Game Room prototype | waiting/table/seats/status/chat/history composition | ไม่บังไพ่/ปุ่ม, สถานะ 2–4 คน/ผู้ชมอ่านชัด |
| F — 3-pile interaction | card/piles/actions ใหม่ เชื่อม callbacks เดิมทีละส่วน | tap/move/swap/full-pile/autofill/undo/reset/cancel-submit ผ่าน |
| G — Motion/sound | transform animations, เสียงเดิมและ feedback | ไม่หน่วง input, reduced motion, audio ไม่ซ้อนรบกวน |
| H — Mobile optimization | safe-area, dynamic viewport, keyboard, short screens, landscape | ภาพจริง/อุปกรณ์จริง iOS Safari และ Android Chrome; ไพ่/ปุ่มไม่ถูกตัด |
| I — Regression | compare baseline, rules/AI, practice, multiplayer staging | ไม่เปลี่ยนผลคะแนน/chips/XP/host/rejoin; แก้ regression ก่อนต่อ |
| J — Production polish | asset compression, lazy chunks, a11y, console, final review | Build ผ่าน, ไม่มี error ใหม่ใน flow ที่ทดสอบ, performance มีตัวเลข, ส่ง diff/rollback |

แต่ละ milestone: implement → build/run → inspect rendered UI/console → test critical flow → fix → verify ถ้า browser ใช้ไม่ได้ให้ถือว่า visual gate ยังไม่ผ่าน ห้ามประกาศ production-ready

ก่อนแก้จริงสร้าง branch/checkpoint ในสำเนาที่ครบ เก็บ ZIP และ checksum; commit ทีละ milestone ไม่เปลี่ยน global theme ทุกหน้าในครั้งเดียว

### Regression matrix ที่ควรเพิ่มหลังอนุมัติ

- Engine: tie-break/suits, straight ตามกติกาเดิม, AA/AAA/AAAA, foul, sweep, derby, dragon และคะแนนรวม เทียบกับ baseline ไม่บังคับ conventional poker rules
- Practice: เริ่ม/จัด/สลับ/undo/reset/submit/result/next round และ 13 ใบไม่หายไม่ซ้ำ
- Online: 2–4 players, host/non-host/spectator, ready/start, submit/cancel, reconnect/rejoin, round cap, room closed, chips/commission/XP/history, write failure
- Layout: 320×568, 375×667, 390×844, 430×932, landscape, tablet 768px, desktop; card ranks ไทย/ชื่อยาว/เลขชิปยาว
- Accessibility: focus/keyboard, zoom, icon names, drag alternative, modal focus, reduced motion

## 10. Performance strategy และไฟล์ที่เริ่มก่อน

เก็บ Kanit เดิมแต่ลดจำนวน weights หลังตรวจภาพ; ใช้ SVG สำหรับ logos/card backs/icons, texture เล็ก tile ซ้ำ, ภาพ Home WebP/AVIF มี fallback ตามการรองรับจริง, ไม่มีภาพ full-screen หนักขณะจัดไพ่

แยก lazy load ตามหน้าถ้ามีประโยชน์ เช่น Admin/Practice/ผลละเอียด แต่ตรวจวงจร imports App ↔ components ก่อน เปลี่ยน loader อย่างเดียวไม่ใช่วิธีซ่อนไฟล์ sha256 ที่ขาด

AI: พิจารณา Web Worker เพื่อใช้ algorithm เดิมโดยไม่ค้าง UI หลังอนุมัติการเปลี่ยน execution boundary; ส่งผลพร้อม request id เพื่อกันผลเก่าทับมือใหม่และ re-associate card identities ต้องมี output parity test

ยังไม่มี baseline bundle ที่ build สำเร็จ จึงไม่ตั้ง claim ว่าจะลดได้กี่เปอร์เซ็นต์ เป้าหมายเพิ่ม assets ที่จำเป็นให้น้อยที่สุดและเปรียบเทียบ bytes/long tasks จริงทุก milestone

### Phase แรกหลังอนุมัติ: กู้ baseline ก่อน

| ไฟล์ | งานที่เสนอ | ข้อจำกัด |
|---|---|---|
| src/utils/sha256.js | กู้ไฟล์ต้นฉบับที่หายจากชุดที่ใช้งานจริง | ไม่สร้าง hash behavior ใหม่โดยพลการ |
| package-lock.json | เก็บ resolution ของ dependencies หลังเลือก environment baseline | ไม่อัปเกรด framework พร้อม redesign |
| .eslintrc.cjs หรือ config ที่ใช้จริง | กู้/กำหนด config ให้ lint รันได้และแยก legacy findings | ไม่ปิด rule เพื่อกลบปัญหา |
| package.json | เพิ่ม test script ถ้าอนุมัติ; บันทึก runtime ที่ทดสอบ | dependency changes เท่าที่จำเป็น |
| src/utils/testEngine.js | ให้ test failure ส่ง exit code ที่ถูกต้องและเพิ่ม score characterization แยก | ไม่แก้สูตรคะแนนเพื่อให้ test ผ่าน |

ถ้าไฟล์จากชุดที่ deploy จริงแตกต่างจาก ZIP ให้ใช้ชุดที่ครบเป็น baseline ใหม่และตรวจซ้ำเฉพาะส่วนที่ต่างก่อนเริ่ม B–D

### ไฟล์ UI ชุดแรกหลัง baseline ผ่านและ direction อนุมัติ

เพิ่ม `src/styles/tokens.css`, `src/styles/ui.css`, `src/styles/lobby.css`; เพิ่ม `src/components/ui/GameButton.jsx`, `Avatar.jsx`, `Badge.jsx`; เพิ่ม `src/components/lobby/HomeView.jsx`, `RoomList.jsx`, `RoomListItem.jsx`

แก้ `src/components/Lobby.jsx` เฉพาะส่วน render เพื่อเชื่อม views ใหม่; `src/main.jsx` เฉพาะ imports styles; `src/App.jsx` เฉพาะการประกอบหน้า Home เมื่อจำเป็นและคง callbacks/session เดิม; `src/styles/premium.css` ลด/ย้ายเฉพาะ selectors ที่ถูกแทนและมี visual regression coverage

**ยังไม่เริ่ม implementation ใด ๆ ตามแผนนี้ รอผู้ใช้อนุมัติแผนตามคำสั่งเดิม**
