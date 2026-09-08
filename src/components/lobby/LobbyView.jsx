import React, { useState } from 'react';
import { ArrowRight, Bot, RefreshCw, Trophy, LogOut, Users, Eye, Star } from 'lucide-react';
import { Avatar, Badge, Brand, GameButton, Sheet } from '../ui/GameUI.jsx';
const fmt = n => Number(n || 0).toLocaleString('th-TH', {maximumFractionDigits:2});
function RoomListItem({ room:r, player, chips, onJoin }) {
  const list=Object.values(r.players||{}), active=list.filter(p=>!p.isSpectator&&!p.isQueue);
  const mine=list.some(p=>p.name===player.name), playing=r.status==='playing'||r.status==='results';
  const rate=r.rate||1, need=35*rate, canJoin=(!r.status||r.status==='lobby')&&active.length<4;
  return <article className="room-entry">
    <div className="room-entry__heading"><div><span className="eyebrow">โต๊ะ {r.code}</span><h3>{r.adminName||r.name||'ห้องเกม'}</h3></div><Badge tone={playing?'gold':'green'}>{playing?'กำลังเล่น':active.length?'รอผู้เล่น':'ว่าง'}</Badge></div>
    <div className="room-entry__meta"><span>อัตรา <strong>{fmt(rate)}</strong></span><span>ชิปขั้นต่ำ {fmt(need)}</span>{!!r.commission&&<span>ค่าต๋ง {r.commission}%</span>}</div>
    <div className="room-entry__footer"><div className="room-seating" aria-label={`ผู้เล่น ${active.length} จาก 4 คน`}>{Array.from({length:4},(_,i)=>active[i]?<Avatar key={i} value={active[i].avatar} size="tiny"/>:<span key={i} className="seat-empty"><Users size={14}/></span>)}<small>{active.length}/4</small></div><GameButton variant={mine||canJoin?'primary':'secondary'} onClick={()=>onJoin(r.code,rate,mine)}>{mine?'เล่นต่อ':canJoin?'เข้าเล่น':'นั่งชม'}{canJoin||mine?<ArrowRight size={18}/>:<Eye size={18}/>}</GameButton></div>
    {!mine&&chips<need&&<p className="room-entry__note">ชิปยังไม่ถึงขั้นต่ำสำหรับร่วมเล่น</p>}
  </article>;
}
export default function LobbyView({player,chips,level,xp,games,wins,winRate,rooms,leaderboard,loadingRooms,loadingLeaders,filter,setFilter,loadRooms,onEnterPractice,onLogout,onJoin}) {
  const [panel,setPanel]=useState(null);
  return <main className="lobby-scene">
    <header className="lobby-header"><Brand small/><GameButton variant="icon" aria-label="ออกจากระบบ" onClick={onLogout}><LogOut size={20}/></GameButton></header>
    <button className="player-strip" onClick={()=>setPanel('profile')}><Avatar value={player.avatar}/><span className="player-strip__name"><strong>{player.name}</strong><small>เลเวล {level} · ชนะ {winRate}%</small></span><span className="chip-balance"><small>ชิปของคุณ</small><b>{fmt(chips)}</b></span><ArrowRight size={18}/></button>
    <div className="lobby-heading"><div><span className="eyebrow">วงไพ่ของเรา</span><h1>เลือกโต๊ะเล่น</h1></div><GameButton variant="icon" aria-label="รีเฟรชห้อง" onClick={loadRooms}><RefreshCw size={21} className={loadingRooms?'is-spinning':''}/></GameButton></div>
    <nav className="room-filters" aria-label="กรองห้อง">{[['all','ทั้งหมด'],['waiting','รอเล่น'],['playing','กำลังเล่น'],['mine','ของฉัน']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</nav>
    <section className="room-list" aria-label="ห้องเล่น" aria-busy={loadingRooms}>{loadingRooms?<div className="room-loading" role="status">กำลังโหลดห้อง…</div>:rooms.length?rooms.map(r=><RoomListItem key={r.code} room={r} player={player} chips={chips} onJoin={onJoin}/>):<div className="empty-rooms"><Users size={32}/><h2>ยังไม่มีโต๊ะในรายการนี้</h2><p>ลองเปลี่ยนตัวกรองหรือรีเฟรชห้อง</p><GameButton variant="secondary" onClick={loadRooms}>รีเฟรชห้อง</GameButton></div>}</section>
    <div className="lobby-side-actions"><GameButton variant="secondary" onClick={onEnterPractice}><Bot size={22}/><span>ฝึกกับ AI<small>ห้องซ้อม · ใช้ชิปฝึก</small></span><ArrowRight size={18}/></GameButton><GameButton variant="secondary" onClick={()=>setPanel('leaders')}><Trophy size={22}/><span>อันดับผู้เล่น<small>กำไรสะสมสูงสุด</small></span><ArrowRight size={18}/></GameButton></div>
    <details className="mission-details"><summary><Star size={16}/> เป้าหมายการเล่น</summary><div><p>Daily · เล่นครบ 3 รอบ</p><p>Derby · กวาดดาร์บี้</p><p>Dragon · สะสมมังกร</p></div></details>
    {panel==='profile'&&<Sheet title="โปรไฟล์ผู้เล่น" onClose={()=>setPanel(null)}><div className="profile-summary"><Avatar value={player.avatar} size="large"/><h2>{player.name}</h2><Badge tone="gold">เลเวล {level}</Badge></div><div className="xp-meter"><div style={{width:`${(xp%250)/250*100}%`}}/></div><p className="muted center">{xp%250} / 250 XP</p><div className="profile-stats"><div><b>{fmt(games)}</b><span>รอบที่เล่น</span></div><div><b>{fmt(wins)}</b><span>รอบที่ชนะ</span></div><div><b>{winRate}%</b><span>อัตราชนะ</span></div></div><div className="profile-chips"><span>ชิปคงเหลือ</span><b>{fmt(chips)}</b></div></Sheet>}
    {panel==='leaders'&&<Sheet title="อันดับกำไรสะสม" onClose={()=>setPanel(null)}>{loadingLeaders?<p role="status">กำลังโหลดอันดับ…</p>:!leaderboard.length?<p>ยังไม่มีประวัติจัดอันดับ</p>:leaderboard.map((p,i)=><div className="leader-row" key={p.id}><span>{i+1}</span><Avatar value={p.avatar} size="tiny"/><b>{p.name||p.id}</b><strong>{p.totalProfit>0?'+':''}{fmt(p.totalProfit)}</strong></div>)}</Sheet>}
  </main>;
}
