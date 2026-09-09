# 3กอง — ระบบออนไลน์ฉบับแก้ไข

วันที่ 8 กันยายน 2026
สถานะ: แก้ source และผ่านการทดสอบ Auth/Firestore Emulator; ยังไม่ deploy และยังไม่รับรองการเล่นหลายเครื่องจริง
Checkpoint ก่อนแก้: checkpoint/before-online-repair (1c8e357)

## สิ่งที่เปลี่ยน

- บัญชีเดิมใช้ชื่อผู้ใช้และรหัสผ่านเดิมได้: ตรวจรหัสบน server แล้วออก Firebase custom token โดยใช้ memberId เดิม ไม่ย้ายยอดชิปไปบัญชีใหม่
- แต่ละบัญชีมี sessionKey ผูกกับ signed token; เมื่อชื่อเดิมถูกนำมาสมัครใหม่ token เก่าจะไม่ผ่านทั้ง rules และ server และตรวจซ้ำใน game transaction
- passwordHash แบบเก่าจะถูกตรวจบน server และย้ายเป็น salted scrypt ใน `_credentials` หลัง login สำเร็จ ฟิลด์ hash เก่าถูกลบจากเอกสารสมาชิก สมาชิกอ่านข้อมูลของตนเองเท่านั้น; leaderboard ส่งกลับเฉพาะฟิลด์ที่แสดง
- บัญชีแอดมินเดิมใช้ custom token ที่มี admin claim; sessionStorage ไม่ใช่หลักฐานสิทธิ์อีกต่อไป การตั้งแอดมินครั้งแรกต้องมี ADMIN_SETUP_TOKEN ฝั่ง server การล็อกอิน/สมัครถูกจำกัดอัตราต่อ IP และบัญชี
- การแจกไพ่ ส่ง/ดึงไพ่กลับ เริ่มรอบ ปิดห้อง พร้อมเล่น เข้าร่วม/ออก และ emoji ใช้ server actions ที่ตรวจตัวตนและสถานะ
- ไพ่แจกอยู่ `rooms/{roomId}/deals/{memberId}` และไพ่จัดอยู่ `hands/{memberId}` เฉพาะเจ้าของอ่านได้ room.deals เป็น marker และ room.hands มีเฉพาะ done ระหว่างจัดไพ่
- เมื่อทุกคนส่งครบ server คิดผลและบันทึก balances, สถิติ, XP, ledger, ประวัติ และ results ใน transaction เดียวกัน ก่อนเปิดไพ่เต็มให้หน้าผลลัพธ์/Showdown
- Ledger ต่อห้อง/รอบช่วยไม่ให้จ่ายซ้ำ; request มี round เพื่อกันคำสั่งจากรอบเก่า การบันทึกล้มเหลวไม่ทิ้งสถานะ results ที่ยังไม่จ่ายชิป
- เก็บสูตรคะแนน/โบนัส/ฟาวล์เดิม โดย deploy สำเนา ruleEngine.js ที่ตรวจว่า byte-identical ไม่ใช้สูตรที่ต่างกันใน Cloud Functions เก่า; aiEngine.js ไม่เปลี่ยน
- การหามือไพ่ยึด memberId ก่อนแปลงเข้าข้อมูล engine ป้องกันชื่อผู้เล่นที่บังเอิญเหมือน memberId ของอีกคน
- ห้อง maxRounds=0 เล่นต่อได้ไม่จำกัดและ UI แสดงตรงกัน
- หัวห้องส่ง heartbeat ทุก 20 วินาที หากหายเกิน 75 วินาที ผู้ร่วมเล่นที่ยังเชื่อมต่อสามารถรับสิทธิ์หัวห้องผ่าน transaction ได้ การคิดคะแนนไม่ต้องรอเครื่องหัวห้อง
- การเชื่อมต่อกลับ/เปิดหลายแท็บรับสถานะส่งไพ่จาก server; ข้อมูลไพ่รอบเก่าไม่ถูกนำมาใช้ในรอบใหม่
- ประวัติรอบแยกเป็นเอกสารใน rounds และแอดมินอ่านประวัติใหม่นี้ด้วย
- เติม/ถอน/รีเซ็ตชิปอ่านยอดล่าสุดใน transaction ชุดรีเซ็ตทั้งหมดแบ่งไม่เกิน 400 บัญชีต่อ transaction

## สิ่งที่รักษาไว้และพฤติกรรมที่ต้องรู้

- หน้าตา premium, animation แจกไพ่/เทียบไพ่, ห้องซ้อม, กติกา, สูตรคะแนน และ AI เดิมยังอยู่
- ไม่เพิ่มเงื่อนไขว่าทุกคนต้อง ready จึงเริ่มได้ เพราะตัวเริ่มเกมเดิมอนุญาตโฮสต์เริ่มเมื่อมีผู้เล่นพอ; ready ยังคงเป็นสถานะให้เห็น
- ผู้เล่นหลุดระหว่างจัดไพ่ยังต้องกลับมาจัดต่อ ไม่ตัดสินแพ้อัตโนมัติหรือหักคะแนนเพิ่มเอง การย้ายหัวห้องไม่ได้แก้กรณีผู้เล่นคนหนึ่งไม่กลับมาเลย
- ปิดห้องแบบ archive (`status: closed`) แทนลบเอกสารทันที เพื่อรักษาประวัติและไม่ให้ subcollection เก่าไปผูกกับห้องใหม่โดยบังเอิญ หน้ารายการเล่นไม่แสดงห้องที่ปิด
- แอดมินยังจัดการสมาชิก/ชิป/ห้องได้ การเตะผู้เล่นและแก้/ลบห้องระหว่าง playing ถูกปฏิเสธเพื่อไม่ให้ชุดผู้รับผลเปลี่ยนกลางการจ่าย ต้องรอจบรอบ
- approved ยังใช้ตามพฤติกรรมเดิม ไม่เพิ่มกฎห้าม login ให้สมาชิกที่ยังรออนุมัติ; active=false ปฏิเสธทั้ง API และ Firestore
- ห้ามปล่อย client เก่าร่วมกับ backend ใหม่ระหว่างรอบ ต้องใช้ maintenance window

## ผลทดสอบ

| การตรวจ | ผล |
|---|---|
| npm test | ผ่าน: baseline engine 4 cases, SHA-256 2 vectors, hash ของ rules/AI เดิม, server/client engine byte parity, private snapshot/ชื่อชน id |
| npm run test:online | ผ่าน 14 กลุ่ม ด้วย Auth + Firestore Emulator จริง |
| npm run lint | ผ่านทั้งโปรเจกต์ ไม่มี errors/warnings |
| npm run build | ผ่าน; entry 854.71 kB / gzip 208.98 kB มีคำเตือน >500 kB; Auth/Functions SDK ทำให้ bundle เพิ่ม |
| Browser 390×844 | เปิดและตรวจ Home/Practice จริง; เริ่มแจก 13 ใบและจัดครบ 3–5–5 ได้ |
| npm run test:http | ผ่าน: Firebase SDK สอง clients เรียก exported onCall ผ่าน HTTP พร้อมตรวจ token จริงกับ Auth Emulator ตั้งแต่สมัครจนจบรอบและเริ่มรอบใหม่ |
| CLI Functions runtime / Browser multiplayer | ยังยืนยันไม่ได้: CLI Functions Emulator ถูกปฏิเสธ Unix socket (EPERM); browser preview แยกจาก emulator |
| Deploy, live IAM, production migration, สองโทรศัพท์จริง | ยังไม่ได้ทำ |

14 กลุ่มครอบคลุม: สมัคร/ล็อกอิน/รหัสผิด, ย้ายบัญชีเดิม, แอดมิน/กันตั้งค่าโดยไม่มีสิทธิ์, เริ่มห้องไม่จำกัด/กันแจกซ้ำ, Firestore rules ปกป้องไพ่/บัญชี/ยอด, แชทปลอมตัว, ไพ่ปลอมและยกเลิก, rollback และ retry ไม่จ่ายซ้ำ, payout เทียบ engine, รอบใหม่/คำสั่งเก่า, ส่งพร้อมกัน 4 คน/ไพ่ไม่ซ้ำ 52 ใบ, หัวห้องหลุด, บัญชีถูกระงับ และ token จากบัญชีรุ่นเก่า

Test:online เรียก exported account handler และ game service ด้วย auth context ทดสอบ แล้วรัน transactions กับ emulator จริง; การตรวจ rules ใช้ Firebase clients ที่ authenticated แยกคน ไม่ควรเรียกผลนี้ว่า callable HTTP end-to-end ผ่านแล้ว

ตัวทดสอบ transport ใน tests/callable-emulator.mjs ผ่านด้วย npm run test:http โดย tests/run-http-tests.cjs mount exported onCall wrappers บน Express HTTP server ตาม API ปกติ ไม่ patch Firebase runtime และไม่ข้ามการตรวจ token ผลนี้รับรอง SDK/HTTP/auth/transaction flow แต่ไม่ทดแทนการทดสอบ npm run test:transport ด้วย CLI Functions runtime ก่อน deploy

เครื่องนี้ทดสอบด้วย Node 24 / Java 17; Functions ตั้ง runtime Node 22 จึงเพิ่ม GitHub verification workflow Node 22 / Java 21 เพื่อรันซ้ำ รวม CLI Functions transport โดยไม่ deploy อัตโนมัติ Full-project lint ผ่านแล้ว และมี regression test ยืนยัน subscription callback รับ UI state ล่าสุดโดยไม่ subscribe ซ้ำ

## รันทดสอบบนเครื่อง

```bash
npm ci
npm --prefix functions ci
npm test
npm run test:online
npm run test:transport
npm run build
```

สำหรับลองหน้าเกมสองหน้าต่าง ให้เปิด emulator:

```bash
npx firebase emulators:start --project demo-3kong-online --only auth,firestore,functions
```

อีก terminal สร้างข้อมูลทดสอบ (สคริปต์ปฏิเสธ project ที่ไม่ใช่ demo):

```bash
GCLOUD_PROJECT=demo-3kong-online FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed:online
```

สร้าง `.env.development.local` เฉพาะการทดสอบ:

```dotenv
VITE_FIREBASE_EMULATORS=true
VITE_FIREBASE_PROJECT_ID=demo-3kong-online
VITE_FIREBASE_API_KEY=demo-key
```

จากนั้น `npm run dev` และเปิด `/qa.html` เลือก “ออนไลน์ emulator ผู้เล่น 1” ในหน้าต่างแรกและผู้เล่น 2 ในอีกหน้าต่าง หน้านี้ใช้บัญชีจำลองและ GameRoom controller จริง ไม่ใช่ view fixture ควรแยก browser profiles เพื่อทดสอบพฤติกรรมเหมือนสองเครื่องด้วย

QA route ไม่ถูก build เข้า dist; ห้าม deploy source root หรือส่ง .env ที่มีข้อมูลลับ

## แผน staging / ย้ายข้อมูลจริง

1. เลือก Firebase staging project ที่แยกจากระบบจริง ตั้ง VITE_FIREBASE_PROJECT_ID, API_KEY, AUTH_DOMAIN และ FUNCTIONS_REGION ให้ตรงกัน; production build ต้องไม่มี VITE_FIREBASE_EMULATORS=true
2. เปิดใช้ Firebase Authentication และตรวจสิทธิ์ออก custom token ของ service account ฝั่ง Functions โดยเฉพาะ `iam.serviceAccounts.signBlob` — ตาม [Firebase custom token documentation](https://firebase.google.com/docs/auth/admin/create-custom-tokens) ต้องตั้ง IAM ให้ runtime service account ที่ใช้งานจริง ไม่ใส่ private key ลง client หรือ Git
3. Deploy Functions และ Rules ชุดใหม่เฉพาะ staging ทดสอบ login เก่า/ใหม่และแอดมินให้ผ่านจริง; ADMIN_SETUP_TOKEN จำเป็นเฉพาะระบบใหม่ที่ยังไม่มีแอดมิน เก็บฝั่ง server เท่านั้น
4. นำข้อมูลตัวอย่างที่ไม่ใช่บัญชีจริงมาทดสอบ migration และดูยอดก่อน/หลัง รันชุด transport ด้วย runtime ที่ตรงกับ deploy
5. ก่อนแตะ production: export/สำรอง Firestore พร้อม rules/functions/client รุ่นเก่า, หยุดรับรอบใหม่, รอรอบเดิมจบ และตรวจยอดจ่ายเดิมที่อาจค้างจากระบบก่อนหน้า การ migration นี้ไม่เดายอดหรือจ่ายย้อนหลังให้อัตโนมัติ
6. สคริปต์ `scripts/migrate-online.cjs` อ่านอย่างเดียวโดยค่าเริ่มต้น ต้องระบุ GCLOUD_PROJECT เอง; ปฏิเสธหากมี legacy room ที่กำลัง playing

```bash
GCLOUD_PROJECT=YOUR_STAGING_PROJECT_ID node scripts/migrate-online.cjs
```

หลังตรวจยอดและผล dry-run แล้วจึงใช้:

```bash
GCLOUD_PROJECT=YOUR_STAGING_PROJECT_ID node scripts/migrate-online.cjs --apply --balances-reconciled
```

สคริปต์เปิด room.onlineVersion=1 หลังซ่อนไพ่และย้ายประวัติเป็นรายรอบใน transaction เท่านั้น; หากห้องมีประวัติเกิน 400 รอบจะหยุดให้ย้ายประวัติแบบแบ่งชุดก่อน ไม่ข้ามข้อมูลเงียบ ๆ

7. เปิด client ใหม่เมื่อระบบทั้งชุดตรงกัน ทดสอบ 2 และ 4 เครื่องจริง: เข้าห้อง→แจก→จัด→ดึงกลับ→ส่งพร้อมกัน→เปิดเทียบ→ยอดตรงกัน→รอบต่อไป รวมถึงสลับแอป/เน็ตหลุด/หัวห้องหลุดและ spectator
8. การ rollback หลัง migration ต้องคืนทั้งข้อมูลและระบบที่เข้าคู่กันใน maintenance window ห้าม rollback เฉพาะหน้าเว็บ เพราะข้อมูล private/public และ credentials เปลี่ยนแล้ว

## ขอบเขตข้อมูลที่เพิ่ม

- `members/{memberId}.sessionKey`: รุ่นบัญชีที่ผูกกับ token
- `_credentials/{memberId|admin_owner}`: salted password verifier, server-only
- `_authLimits/{hash}`: login throttling, server-only; วางแผน TTL/cleanup สำหรับ record หมดอายุในระบบจริง
- `rooms/{roomId}.onlineVersion`: version ของ contract
- `rooms/{roomId}/deals/{memberId}` และ `/hands/{memberId}`: private current-round data
- `/settlements/{round}`: immutable payout receipt ต่อรอบ, server-only
- `/rounds/{round}`: completed round history

ยังต้องตรวจ live configuration, billing/quota, token signing, session revocation policy และ deployment permissions ใน staging ไม่ได้ปรับหรือเข้าถึงสิ่งเหล่านี้ในงานนี้
