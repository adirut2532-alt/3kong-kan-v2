import React,{useEffect,useRef,useState} from 'react';
import {RotateCcw,ChevronRight,X,Swords} from 'lucide-react';
import {handsByPlayerName} from '../../utils/roomSnapshot.js';
import {buildMatchups} from '../../utils/ruleEngine.js';
import {Avatar,GameButton} from '../ui/GameUI.jsx';
import '../../styles/showdown.css';

function Cards({cards,revealed}) {
  return <div className={`showdown-cards ${revealed?'is-open':''}`} aria-label={revealed?cards.map(c=>`${c.rank}${c.suit}`).join(' '):'ไพ่คว่ำ'}>
    {cards.map((c,i)=><div className="showdown-card" key={`${c.rank}${c.suit}`} style={{'--card-i':i}} aria-hidden="true"><div className="showdown-card__turn"><div className="showdown-card__back"/><div className={`showdown-card__face ${c.suit==='♥'||c.suit==='♦'?'is-red':''}`}><b>{c.rank}</b><small>{c.suit}</small><span>{c.suit}</span></div></div></div>)}
  </div>;
}

function Reveal({pairs,onClose}) {
  const ref=useRef(null);
  const [pairIndex,setPairIndex]=useState(0);
  const [rowIndex,setRowIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [settled,setSettled]=useState(false);
  const [replay,setReplay]=useState(0);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pair=pairs[pairIndex];
  const summary=rowIndex===3;
  const row=pair.rows[Math.min(rowIndex,2)];
  useEffect(()=>{
    const previous=document.activeElement;
    const dialog=ref.current;dialog.showModal();
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(media.matches);
    media.addEventListener('change',update);
    return ()=>{dialog.close();media.removeEventListener('change',update);if(previous?.isConnected)previous.focus();};
  },[]);
  useEffect(()=>{
    if(summary)return;
    setRevealed(reduced);setSettled(reduced);
    if(reduced)return;
    const open=setTimeout(()=>setRevealed(true),200);
    const result=setTimeout(()=>setSettled(true),950);
    const next=setTimeout(()=>{setRevealed(false);setSettled(false);setRowIndex(r=>Math.min(3,r+1));},2200);
    return ()=>{clearTimeout(open);clearTimeout(result);clearTimeout(next);};
  },[rowIndex,pairIndex,replay,reduced,summary]);
  const restart=()=>{setRevealed(false);setSettled(false);setRowIndex(0);setReplay(n=>n+1);};
  const nextPair=()=>{setRevealed(false);setSettled(false);setRowIndex(0);setPairIndex(n=>n+1);};
  const outcome=side=>{
    if(pair.ha.foul||pair.hb.foul)return (side==='a'?pair.ha:pair.hb).foul?'ไพ่ฟาวล์':'อีกฝ่ายฟาวล์';
    return row.winner===0?'เสมอ':(side==='a'?row.winner>0:row.winner<0)?'ชนะกองนี้':'แพ้กองนี้';
  };
  return <dialog ref={ref} className="showdown-dialog" aria-label="เปิดไพ่เทียบกัน" onCancel={onClose}>
    <header className="showdown-header"><div><small>คู่ที่ {pairIndex+1} / {pairs.length}</small><h2>เปิดไพ่เทียบกัน</h2></div><GameButton variant="icon" aria-label="ปิดการเทียบไพ่" onClick={onClose}><X size={22}/></GameButton></header>
    <div className="showdown-progress" aria-label={summary?'เทียบครบแล้ว':`กำลังเทียบกอง${row.label}`}>{['หน้า','กลาง','หลัง'].map((name,i)=><span key={name} className={rowIndex>=i?'is-current':''}>กอง{name}</span>)}</div>
    <div className="showdown-stage">
      {summary?<div className="showdown-summary"><Swords size={30}/><h3>เทียบครบ 3 กอง</h3><p>{pair.a.name} <span>พบ</span> {pair.b.name}</p>{pair.rows.map(r=><div key={r.key}><span>กอง{r.label}</span><strong>{pair.ha.foul||pair.hb.foul?'มีไพ่ฟาวล์':r.winner===0?'เสมอ':`${r.winner>0?pair.a.name:pair.b.name} ชนะ`}</strong></div>)}<p className="showdown-note">คะแนนรวมและโบนัส ดูได้ในหน้าผลลัพธ์</p></div>:<div key={`${pairIndex}-${rowIndex}-${replay}`}>
        <h3 className="showdown-pile-title">กอง{row.label} <small>{row.aCards.length} ใบ</small></h3>
        {['a','b'].map(side=>{const person=pair[side];const won=side==='a'?row.winner>0:row.winner<0;return <section key={side} className={`showdown-side ${settled&&won?'is-winner':''}`} aria-label={person.name}><div className="showdown-person"><Avatar value={person.avatar}/><strong>{person.name}</strong><span className={settled?'showdown-outcome':'showdown-outcome is-hidden'}>{outcome(side)}</span></div><Cards cards={side==='a'?row.aCards:row.bCards} revealed={revealed}/><p className="showdown-hand-name">{settled?(side==='a'?row.aName:row.bName):'เปิดไพ่พร้อมกัน'}</p></section>;})}
        <p className="showdown-announcement" role="status">{settled?(pair.ha.foul||pair.hb.foul?'มีไพ่ฟาวล์ · ใช้ผลตัดสินตามกติกาเดิม':row.winner===0?'กองนี้เสมอกัน':`${row.winner>0?pair.a.name:pair.b.name} ชนะกอง${row.label}`):'กำลังเปิดไพ่'}</p>
      </div>}
    </div>
    <footer className="showdown-controls">{summary?<><GameButton variant="secondary" onClick={restart}><RotateCcw size={18}/> ดูคู่นี้ซ้ำ</GameButton>{pairIndex<pairs.length-1?<GameButton onClick={nextPair}>คู่ถัดไป <ChevronRight size={18}/></GameButton>:<GameButton onClick={onClose}>ดูคะแนนรวม</GameButton>}</>:<><GameButton variant="secondary" onClick={onClose}>ข้ามไปผลรวม</GameButton><GameButton onClick={()=>{setRevealed(false);setSettled(false);setRowIndex(i=>Math.min(3,i+1));}}>{rowIndex===2?'สรุปคู่นี้':'กองถัดไป'} <ChevronRight size={18}/></GameButton></>}</footer>
  </dialog>;
}

export default function Showdown({players,hands,focusName}) {
  // Snapshot of completed hands; animations never write back to game state.
  const [pairs]=useState(()=>buildMatchups(players,handsByPlayerName(players,hands)).filter(p=>!focusName||p.a.name===focusName||p.b.name===focusName));
  const [open,setOpen]=useState(true);
  if(!pairs.length)return null;
  return <><GameButton className="showdown-replay" variant="secondary" onClick={()=>setOpen(true)}><Swords size={19}/> ดูเปิดไพ่เทียบกัน</GameButton>{open&&<Reveal pairs={pairs} onClose={()=>setOpen(false)}/>}</>;
}
