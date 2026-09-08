import React, {useEffect,useRef,useState} from 'react';
import '../../styles/game-motion.css';
import { Undo2, RotateCcw, ArrowDownUp, Sparkles, Check, CornerUpLeft } from 'lucide-react';
import {evalHand,validArr} from '../../utils/ruleEngine.js';
import {GameButton,Badge} from '../ui/GameUI.jsx';
export default function ArrangementBoard({hand,selectedCard,renderCard,moveCardTo,onUndo,onReset,onSwap,onAuto,onSubmit,onCancel,undoCount=0}) {
  const [dealing,setDealing]=useState(false);
  const dealStarted=useRef(false);
  const total=hand.front.length+hand.mid.length+hand.back.length+hand.unplaced.length;
  useEffect(()=>{
    if(dealStarted.current||total!==13||hand.done) return;
    dealStarted.current=true;
    if(hand.unplaced.length===13&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setDealing(true);
  },[total,hand.done,hand.unplaced.length]);
  useEffect(()=>{
    if(!dealing) return;
    const timer=setTimeout(()=>setDealing(false),800);
    return ()=>clearTimeout(timer);
  },[dealing]);
  const cardView = (card, index, zone) => {
    const original = renderCard(card, index, zone);
    return React.cloneElement(original, {'aria-label': `${card.rank} ${card.suit}`,style:{...original.props.style,'--deal-index':index}}, original.props.children, <span key="center" className="card-center-pip" aria-hidden="true">{card.suit}</span>);
  };
  const filled=hand.front.length===3&&hand.mid.length===5&&hand.back.length===5;
  const valid=filled&&validArr(hand.front,hand.mid,hand.back);
  return <section className={`arrangement-board ${dealing?'is-dealing':''}`} aria-label="จัดไพ่ 3 กอง" onPointerDownCapture={()=>{if(dealing)setDealing(false);}} onKeyDownCapture={()=>{if(dealing)setDealing(false);}}>
    <header className="arrangement-heading"><h2>จัดไพ่ 3 กอง</h2><Badge tone={hand.done?'green':valid?'green':'neutral'}>{hand.done?'ส่งไพ่แล้ว':filled?(valid?'พร้อมส่ง':'ไพ่ฟาวล์'):`เหลือ ${hand.unplaced.length} ใบ`}</Badge></header>
    <div className="arrangement-scroll"><div className="pile-stack">{[['front','หน้า',3],['mid','กลาง',5],['back','หลัง',5]].map(([zone,label,max])=><div className="pile-row" key={zone}><div className="pile-row__label"><span>กอง{label} <small>{hand[zone].length}/{max}</small></span><span>{hand[zone].length===max?evalHand(hand[zone]).name:''}</span></div><div data-zone={zone} role="group" aria-label={`กอง${label}`} className={`pile-slots ${selectedCard?'pile-slots--target':''} ${hand[zone].length===max?'pile-slots--full':''}`} onClick={e=>{if(!e.target.closest('[data-card-zone], [data-source]'))moveCardTo(zone);}}>{hand[zone].map((c,i)=>cardView(c,i,zone))}{Array.from({length:Math.max(0,max-hand[zone].length)},(_,i)=><span className="card-slot" aria-hidden="true" key={`empty-${i}`}>◇</span>)}</div></div>)}</div>
    <div className="hand-tray-wrap"><span className="tray-label">{selectedCard?'แตะกองเพื่อวาง หรือแตะไพ่อีกใบเพื่อสลับ':'แตะเลือกไพ่ หรือลากไปวางในกอง'}</span><div data-zone="unplaced" role="group" aria-label="ไพ่ในมือ" className="hand-tray" onClick={e=>{if(!e.target.closest('[data-card-zone], [data-source]'))moveCardTo('unplaced');}}>{hand.unplaced.map((c,i)=>cardView(c,i,'unplaced'))}{!hand.unplaced.length&&<span className="hand-tray__empty">{hand.done?'รอผู้เล่นร่วมโต๊ะ':'จัดครบ 13 ใบแล้ว'}</span>}</div></div>
    </div><div className="arrangement-tools"><GameButton variant="icon" aria-label="ย้อนการจัดไพ่" title="ย้อนการจัดไพ่" onClick={onUndo} disabled={!undoCount||hand.done}><Undo2 size={20}/></GameButton><GameButton variant="icon" aria-label="เริ่มจัดใหม่" title="เริ่มจัดใหม่" onClick={onReset} disabled={hand.done}><RotateCcw size={20}/></GameButton><GameButton variant="secondary" onClick={onSwap}><ArrowDownUp size={18}/><span>กลาง / หลัง</span></GameButton><GameButton variant="secondary" onClick={onAuto} disabled={hand.done}><Sparkles size={18}/><span>จัดให้</span></GameButton></div>
    <div className="arrangement-confirm">{hand.done?<><div className="submitted-status" role="status"><Check size={18}/> ส่งไพ่เรียบร้อย</div>{onCancel&&<GameButton variant="secondary" onClick={onCancel}><CornerUpLeft size={18}/> ดึงไพ่มาจัดใหม่</GameButton>}</>:<GameButton onClick={onSubmit}><Check size={20}/> ยืนยันการจัดไพ่</GameButton>}</div>
  </section>;
}
