import React from 'react';
import { GameButton, Sheet } from '../ui/GameUI.jsx';

export default function FoulConfirmation({ onCancel, onConfirm }) {
  return <Sheet title="ยืนยันส่งไพ่ฟาวล์" onClose={onCancel}>
    <p role="alert">⚠️ ไพ่ของคุณฟาวล์ ต้องจ่ายให้ผู้เล่นที่ไม่ฟาวล์คนละ 6 แต้ม ยืนยันส่งไพ่หรือไม่?</p>
    <div style={{ display:'grid', gap:12, marginTop:20 }}>
      <GameButton autoFocus onClick={onCancel}>กลับไปจัดไพ่</GameButton>
      <GameButton variant="secondary" onClick={onConfirm}>ยืนยันส่งไพ่ฟาวล์</GameButton>
    </div>
  </Sheet>;
}
