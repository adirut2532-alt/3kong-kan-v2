import React, { useState } from 'react';
import { ArrowRight, Users, Bot, HelpCircle } from 'lucide-react';
import { Brand, GameButton, Sheet } from '../ui/GameUI.jsx';
export default function HomeView({ onStart, onPractice }) {
  const [help, setHelp] = useState(false);
  return <main className="home-scene">
    <div className="home-scene__art" aria-hidden="true"/>
    <header className="home-topline"><span>วงไพ่ของเรา</span><GameButton variant="icon" aria-label="วิธีเล่น" onClick={()=>setHelp(true)}><HelpCircle size={22}/></GameButton></header>
    <div className="home-title"><Brand/><p>จัดไพ่ให้ลงตัว แล้วเจอกันที่โต๊ะ</p></div>
    <div className="home-hand" aria-hidden="true">{[['A','♠'],['K','♥'],['Q','♣']].map(([rank,suit],i)=><div className={`home-card ${i===1?'is-red':''}`} key={rank}><b>{rank}<small>{suit}</small></b><span>{suit}</span></div>)}</div>
    <section className="home-actions" aria-label="เริ่มเล่น">
      <GameButton onClick={onStart}><Users size={22}/><span>เล่นกับเพื่อน</span><ArrowRight size={22}/></GameButton>
      <GameButton variant="secondary" onClick={onPractice}><Bot size={22}/><span>ฝึกกับ AI</span><ArrowRight size={20}/></GameButton>
      <p>3 กอง · 13 ใบ · วงเดียวกัน</p>
    </section>
    {help && <Sheet title="จัดไพ่ 3 กอง" onClose={()=>setHelp(false)}><div className="how-piles"><p><b>หน้า</b><span>3 ใบ</span></p><p><b>กลาง</b><span>5 ใบ</span></p><p><b>หลัง</b><span>5 ใบ</span></p></div><p>จัดกองหลังให้แข็งกว่าหรือเท่ากับกองกลาง และกองกลางให้แข็งกว่าหรือเท่ากับกองหน้า ตามกติกาของห้อง</p><p>แตะเลือกไพ่แล้วแตะกองเพื่อย้าย หรือลากไพ่ทับกันเพื่อสลับ ใช้ปุ่มย้อนกลับเพื่อแก้การจัด ก่อนยืนยันส่งไพ่</p><GameButton onClick={()=>{setHelp(false);onPractice();}}>ไปฝึกกับ AI</GameButton></Sheet>}
  </main>;
}
