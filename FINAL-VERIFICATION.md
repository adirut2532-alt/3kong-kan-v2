# ผลตรวจรุ่นเตรียมอัป GitHub — 8 กันยายน 2026

## ขอบเขตและผล

- ตรวจเทียบ repository `adirut2532-alt/3kong-kan-v2` กับต้นฉบับแนบ: ไฟล์เดิมที่มีร่วมกันตรงกัน ไม่มีงานใหม่บน main ที่ถูกทับ
- `npm test` ผ่าน: baseline engine 4 กรณี, hash ของ ruleEngine/aiEngine เดิม, SHA-256 2 vectors, สำเนา engine ฝั่ง server, private snapshot/round filtering/name collision และ regression ของ subscription callback
- `npm run lint` ผ่านทั้งโปรเจกต์ ไม่มี errors/warnings
- `npm run build` ผ่าน; main JS 854.71 kB / gzip 208.97 kB ยังมีคำเตือน chunk >500 kB
- `npm run test:online` ผ่านซ้ำ 14 กลุ่ม: บัญชีใหม่/เดิม/admin, สิทธิ์อ่านไพ่, ป้องกันปลอมไพ่/แชท, transaction rollback, retry ไม่จ่ายซ้ำ, สูตรคะแนนเดิม, ผู้เล่น 4 คนส่งพร้อมกัน, เปลี่ยนหัวห้อง, บัญชีระงับ, รอบถัดไป และ token เก่า
- `npm run test:http` ผ่าน: Firebase SDK สองบัญชี → สมัคร/login/custom token → join/ready → แจกไพ่ส่วนตัว → submit → ผลตรงกัน → รอบถัดไป โดยเรียก exported Firebase onCall wrappers ผ่าน HTTP จริงและตรวจ token ตามปกติ
- Browser จริง: ห้องซ้อม 390×844 เริ่มแจก 13 ใบ → จัดให้อัตโนมัติ 3/5/5 → ยืนยัน → เปิดไพ่เทียบ 3 กอง → สรุปผู้แพ้ชนะ ทำงานและตรวจภาพ render แล้ว
- Browser จริง: ห้องเพื่อน fixture 4 คนที่ 320×568 แสดงที่นั่ง/สถานะครบ เริ่มเกมและเปิดพื้นผิวจัดไพ่ได้ จอเตี้ยใช้ vertical scroll เพื่อเข้าถึงปุ่มในหน้ารอ
- Console ที่ตรวจพบเป็น error ของ browser extension metadata; ไม่พบ app exception ใน flow ห้องซ้อมที่ตรวจ

## แก้เพิ่มเติมจากการตรวจ

- ตัวรับ room/chat ใช้ callback ที่อ่าน state ล่าสุด ป้องกันใช้ค่าปิดเสียง/สถานะหน้าจอ/ออกห้องเก่า โดยไม่สร้าง subscription ใหม่ทุกครั้ง
- Admin แสดงข้อผิดพลาดการโหลดข้อมูลแทนการกลืน error
- แก้ lint ของ controller, Login, Admin และโค้ดที่ไม่ได้ใช้ โดยไม่แก้กติกา/AI/สูตรคะแนน
- เพิ่ม HTTP integration harness และ regression test ของ callback
- เพิ่ม GitHub Actions ตรวจด้วย Node 22 และ CLI Functions Emulator โดยไม่ใช้ production credentials และไม่ deploy

## ข้อจำกัดที่ยังต้องผ่านก่อนใช้งานจริง

1. การทดสอบในเครื่องนี้ใช้ Node 24 / Java 17; runtime Functions ตั้ง Node 22 ต้องดูผล workflow และทดสอบ staging ด้วย runtime ตรงกัน
2. CLI Functions Emulator ในสภาพแวดล้อมนี้เปิด Unix socket ไม่ได้ (EPERM) จึงใช้ Express mount actual exported onCall wrappers สำหรับ HTTP test ผล HTTP ผ่านไม่ใช่หลักฐานว่า CLI Functions runtime ผ่าน
3. Browser preview แยกเครือข่ายจาก emulator จึงยังไม่รับรอง browser multiplayer แบบ end-to-end หรือการเล่นหลายโทรศัพท์จริง
4. ยังไม่ deploy Firebase, เปลี่ยน production rules หรือ migrate ข้อมูลจริง ขั้นตอนใน ONLINE-REPAIR.md ต้องทำตามลำดับพร้อมสำรองข้อมูลและตรวจยอด
5. หากผู้เล่นหายไปก่อนส่งไพ่ ต้องกลับมาเล่นต่อ ไม่มีการเพิ่มกฎปรับแพ้อัตโนมัติ
6. ยังไม่รับรอง 60 FPS บน iPhone/Android จริง, latency เครือข่ายมือถือ

อัปงานเป็น branch แยก ไม่ merge main: workflow เดิมของ main จะ deploy Hosting อัตโนมัติ และ Hosting อย่างเดียวไม่เพียงพอสำหรับ backend รุ่นนี้

## Dependency audit

`npm audit --omit=dev` รายงาน 12 รายการใน dependency tree ฝั่งแอป: high 1 (undici ซึ่ง Firebase SDK ฝั่ง Node ใช้), moderate 11 รวมรายการที่ส่งต่อผ่าน Firebase และ react-router ต้องติดตามอัปเดตและทดสอบ SDK/major router upgrade แยกก่อน production ไม่ถือว่าผ่าน security audit ส่วน `npm audit --omit=dev` ใน Functions พบ moderate 12 รายการ ไม่มี high/critical ตามผลตรวจครั้งนี้
