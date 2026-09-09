import React,{useEffect,useRef,useState} from 'react';
import {RotateCcw,ChevronRight,X,Swords} from 'lucide-react';
import {handsByPlayerName} from '../../utils/roomSnapshot.js';
import {buildMatchups,calcScores} from '../../utils/ruleEngine.js';
import {Avatar,GameButton} from '../ui/GameUI.jsx';
import '../../styles/showdown.css';

function Cards({cards,revealed}) {
  return <div className={`showdown-cards ${revealed?'is-open':''}`} aria-label={revealed?cards.map(c=>`${c.rank}${c.suit}`).join(' '):'ไพ่คว่ำ'}>
    {cards.map((c,i)=><div className="showdown-card" key={`${c.rank}${c.suit}`} style={{'--card-i':i}} aria-hidden="true"><div className="showdown-card__turn"><div className="showdown-card__back"/><div className={`showdown-card__face ${c.suit==='♥'||c.suit==='♦'?'is-red':''}`}><b>{c.rank}</b><small>{c.suit}</small><span>{c.suit}</span></div></div></div>)}
  </div>;
}

function Reveal({pairs,players,hands,scores,onClose}) {
  const ref=useRef(null);
  const pairIndex=0;
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
    return ()=>{clearTimeout(open);clearTimeout(result);};
  },[rowIndex,pairIndex,replay,reduced,summary]);
  const restart=()=>{setRevealed(false);setSettled(false);setRowIndex(0);setReplay(n=>n+1);};
  return <dialog ref={ref} className="showdown-dialog" aria-label="เปิดไพ่เทียบกัน" onCancel={onClose}>
    <header className="showdown-header"><div><small>ครบทั้งโต๊ะ · {players.length} คน</small><h2>เปิดไพ่เทียบกัน</h2></div><GameButton variant="icon" aria-label="ปิดการเทียบไพ่" onClick={onClose}><X size={22}/></GameButton></header>
    <div className="showdown-progress" aria-label={summary?'เทียบครบแล้ว':`กำลังเทียบกอง${row.label}`}>{['หน้า','กลาง','หลัง'].map((name,i)=><span key={name} className={rowIndex>=i?'is-current':''}>กอง{name}</span>)}</div>
    <div className="showdown-stage showdown-four-stage">
      <div className="showdown-all-players">{players.map(person=>{
        const hand=hands[person.name];
        const matches=pairs.filter(p=>p.a===person||p.b===person);
        const results=matches.map(p=>({r:p.rows[Math.min(rowIndex,2)],side:p.a===person?1:-1}));
        const wins=results.filter(x=>x.r.winner*x.side>0).length;
        const losses=results.filter(x=>x.r.winner*x.side<0).length;
        const score=scores.find(s=>s.id&&person.id?s.id===person.id:s.name===person.name);
        const value=score?.roundScore;
        const handName=results.length?(results[0].side===1?results[0].r.aName:results[0].r.bName):'';
        return <section key={person.id||person.name} className="showdown-side showdown-seat" aria-label={person.name}>
          <div className="showdown-person"><Avatar value={person.avatar}/><strong>{person.name}</strong><div className={`showdown-total ${value>0?'positive':value<0?'negative':'neutral'}`}><b>{Number.isFinite(value)?`${value>0?'+':''}${value.toLocaleString('th-TH')}`:'—'}</b><small>คะแนนรวมรอบ</small></div></div>
          {!summary&&<Cards cards={hand?.[row.key]||[]} revealed={revealed}/>}
          <div className="showdown-row-result"><span>{summary?(score?.bonusLabel||'เทียบครบ 3 กอง'):settled?(hand?.foul?'ไพ่ฟาวล์':handName):'กำลังเปิดไพ่…'}</span>{!summary&&settled&&<span>ชนะ {wins} · แพ้ {losses} · เสมอ {results.length-wins-losses}</span>}</div>
        </section>;
      })}</div>
      <p className="showdown-announcement">{summary?'สีเขียว = ได้คะแนน · สีแดง = เสียคะแนน':`กอง${row.label} · เปิดพร้อมกันทั้งโต๊ะ`}</p>
    </div>
    <footer className="showdown-controls">{summary?<><GameButton variant="secondary" onClick={restart}><RotateCcw size={18}/> เปิดไพ่ซ้ำ</GameButton><GameButton onClick={onClose}>กลับหน้าผลรวม</GameButton></>:<><GameButton variant="secondary" onClick={()=>setRowIndex(3)}>ดูคะแนนรวม</GameButton><GameButton onClick={()=>{setRevealed(false);setSettled(false);setRowIndex(i=>Math.min(3,i+1));}}>{rowIndex===2?'สรุปทั้งโต๊ะ':'กองถัดไป'} <ChevronRight size={18}/></GameButton></>}</footer>
  </dialog>;
}

export default function Showdown({players,hands}) {
  // Snapshot of completed hands; animations never write back to game state.
  const [snapshot]=useState(()=>{const mapped=handsByPlayerName(players,hands);return {players,hands:mapped,pairs:buildMatchups(players,mapped),scores:calcScores(players,mapped)};});
  const pairs=snapshot.pairs;
  const [open,setOpen]=useState(true);
  if(!pairs.length)return null;
  return <><GameButton className="showdown-replay" variant="secondary" onClick={()=>setOpen(true)}><Swords size={19}/> ดูเปิดไพ่ทั้งโต๊ะ</GameButton>{open&&<Reveal {...snapshot} onClose={()=>setOpen(false)}/>}</>;
}
