# 3 กอง กาญ 2.0 (3kong-kan-v2)

Premium Chinese Poker Online — React + Firebase

## รุ่นปรับปรุง UI และระบบออนไลน์

อ่าน [ผลตรวจล่าสุด](FINAL-VERIFICATION.md) และ [การเตรียมระบบออนไลน์](ONLINE-REPAIR.md) ก่อนใช้งานจริง

รุ่นนี้ต้องใช้ Cloud Functions และ Firestore rules ที่เข้าคู่กัน พร้อมตรวจ migration ของห้องเดิม การอัป source ขึ้น GitHub ยังไม่ใช่การ deploy ระบบออนไลน์

ทดสอบ: `npm ci`, `npm ci --prefix functions`, `npm test`, `npm run lint`, `npm run build`, `npm run test:online`, `npm run test:transport`

GitHub verification ใช้ Node 22 และข้อมูล emulator เท่านั้น ไม่มีการ deploy จาก branch ตรวจงาน


## โครงสร้างโปรเจกต์

```
3kong-kan-v2/
├── index.html
├── package.json
├── vite.config.js
├── firebase.json
├── firestore.rules
├── .github/workflows/main.yml    # auto-deploy to Firebase Hosting
├── functions/                     # Firebase Cloud Functions
│   ├── index.js
│   └── package.json
└── src/
    ├── App.jsx                    # main router (login/lobby/game/practice/admin)
    ├── main.jsx
    ├── components/
    │   ├── Login.jsx
    │   ├── Register.jsx
    │   ├── Lobby.jsx              # ล็อบบี้ + ปุ่มห้องซ้อม
    │   ├── GameRoom.jsx           # ห้องเล่นจริง (multiplayer)
    │   ├── PracticeRoom.jsx       # ห้องซ้อมกับ AI bot
    │   └── AdminPanel.jsx         # จัดการห้อง/สมาชิก/rake
    ├── styles/
    │   └── premium.css
    └── utils/
        ├── ruleEngine.js          # กติกาคิดคะแนน + เทียบไพ่
        ├── aiEngine.js            # AI จัดไพ่สำหรับ bot
        └── testEngine.js

```

## การติดตั้ง

```bash
npm install
npm run dev      # dev server
npm run build    # production build → dist/
```

## Deploy

Push to `main` branch → GitHub Actions auto-deploy to Firebase Hosting (poker-kan.web.app)

## กติกาคิดคะแนน (สรุป)

- กองหน้า = 2 แต้ม, กองกลาง = 1 แต้ม, กองหลัง = 1 แต้ม
- โบนัสกองหน้า: คู่ AA = 2, ตอง = 5, ตอง AAA = 8
- โบนัสกองหลัง: Full House AAA = 2, โฟร์การ์ด = 6, โฟร์การ์ด AAAA = 8, สตรีทฟลัช = 7
- โบนัสกองกลาง = โบนัสกองหลัง x2
- ทะลุ (กวาด 3 กอง) = รวมแต้มทุกกอง x2
- ดาร์บี้ (ชนะทุกคู่ทุกกอง) = คะแนน x2 อีกรอบ
