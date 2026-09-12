import React, { useState, useRef, useEffect } from 'react';
import { evalHand, validArr, calcScores, SUIT_RANK } from '../utils/ruleEngine.js';
import ArrangementBoard from './game/ArrangementBoard.jsx';
import AnimatedScore from './game/AnimatedScore.jsx';
import Showdown from './game/Showdown.jsx';
import FoulConfirmation from './game/FoulConfirmation.jsx';
import {aiArrange} from '../utils/aiEngine.js';
import TableSurface from './game/TableSurface.jsx';
import '../styles/practice-gameplay.css';
import GameHeader from './game/GameHeader.jsx';
import {GameButton, Sheet} from './ui/GameUI.jsx';

const BOTS = [
  { name: 'Bot สมศรี', avatar: '👾', id: 'bot1' },
  { name: 'Bot สมศักดิ์', avatar: '🤖', id: 'bot2' },
  { name: 'Bot วันชัย', avatar: '👽', id: 'bot3' },
];

const RULES_TEXT = `🎯 กติกา 3 กอง กาญ

📌 แต้มปกติ:
• กองหน้า (3 ใบ) = 2 แต้ม
• กองกลาง (5 ใบ) = 1 แต้ม
• กองหลัง (5 ใบ) = 1 แต้ม

🔥 โบนัสกองหน้า:
• คู่ AA = 2 แต้ม
• ตองธรรมดา = 5 แต้ม
• ตอง AAA = 8 แต้ม

🔥 โบนัสกองหลัง:
• ฟูลเฮาส์ AAA = 2 แต้ม
• โฟร์การ์ดธรรมดา = 6 แต้ม
• โฟร์การ์ด AAAA = 8 แต้ม
• สตรีทฟลัช = 7 แต้ม

🔥 โบนัสกองกลาง (x2 จากกองหลัง):
• ฟูลเฮาส์ AAA = 4 แต้ม
• โฟร์การ์ดธรรมดา = 12 แต้ม
• โฟร์การ์ด AAAA = 16 แต้ม
• สตรีทฟลัช = 14 แต้ม

⚡ ทะลุ (กวาด 3 กอง):
รวมแต้มทุกกอง x2

👑 ดาร์บี้ (ชนะทุกคู่ทุกกอง):
คะแนน x2 อีกรอบ

📋 ลำดับมือจากต่ำ→สูง:
ไฮการ์ด → คู่ → สองคู่ → ตอง → สตรีท → ฟลัช → ฟูลเฮาส์ → โฟร์การ์ด → สตรีทฟลัช → รอยัลฟลัช`;

function makeDeck() {
  const d = [];
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const valMap = {}; ranks.forEach((r, i) => valMap[r] = i + 2);
  for (const s of suits) for (const r of ranks) d.push({ suit: s, rank: r, val: valMap[r] });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function botArrange(cards) {
  return {...aiArrange(cards),done:true,foul:false};
}

export default function PracticeRoom({ player, onExit }) {
  const [phase, setPhase] = useState('menu');
  const [hand, setHand] = useState({ front:[], mid:[], back:[], unplaced:[], done:false, foul:false });
  const [selectedCard, setSelectedCard] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [botHands, setBotHands] = useState({});
  const [scores, setScores] = useState(null);
  const [matchups, setMatchups] = useState([]);
  const [botChips, setBotChips] = useState({ bot1:1000, bot2:1000, bot3:1000 });
  const [myChips, setMyChips] = useState(1000);
  const [showRules, setShowRules] = useState(false);
  const handRef = useRef(hand);
  const ghostRef = useRef(null);
  const ghostNumRef = useRef(null);
  const ghostSuitRef = useRef(null);
  const MAX = { front:3, mid:5, back:5 };

  useEffect(() => { handRef.current = hand; }, [hand]);

  function autoArrange() {
    const allCards = [...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced];
    if (allCards.length !== 13) return;
    setUndoStack(u => [...u.slice(-19), { front:[...hand.front], mid:[...hand.mid], back:[...hand.back], unplaced:[...hand.unplaced] }]);
    const result = botArrange(allCards);
    setHand({ front:result.front, mid:result.mid, back:result.back, unplaced:[], done:false, foul:result.foul||false });
  }

  function startPractice() {
    const deck = makeDeck();
    const myCards = deck.slice(0, 13).sort((a,b) => a.val - b.val || (SUIT_RANK[a.suit]||0) - (SUIT_RANK[b.suit]||0));
    const bh = {};
    BOTS.forEach((bot, i) => {
      bh[bot.name] = botArrange(deck.slice((i+1)*13, (i+2)*13));
    });
    setBotHands(bh);
    setHand({ front:[], mid:[], back:[], unplaced:myCards, done:false, foul:false });
    setSelectedCard(null);
    setUndoStack([]);
    setScores(null);
    setMatchups([]);
    setPhase('playing');
  }

  function resetChips() {
    setMyChips(1000);
    setBotChips({ bot1:1000, bot2:1000, bot3:1000 });
  }

  function autoFillInto(h) {
    const empty = ['front','mid','back'].filter(r => h[r].length === 0);
    const partial = ['front','mid','back'].filter(r => h[r].length > 0 && h[r].length < MAX[r]);
    if (empty.length === 1 && partial.length === 0) {
      const r = empty[0];
      if (h.unplaced.length === MAX[r]) { h[r] = [...h.unplaced]; h.unplaced = []; }
    }
  }

  function dropCard(fromZone, fromIdx, toZone, toIdx) {
    setHand(prev => {
      const h = { front:[...prev.front], mid:[...prev.mid], back:[...prev.back], unplaced:[...prev.unplaced], done:prev.done, foul:prev.foul };
      const fromArr = h[fromZone]; const toArr = h[toZone];
      const card = fromArr[fromIdx]; if (!card) return prev;

      if (fromZone === toZone) {
        // Same zone reorder
        if (toIdx !== undefined && toIdx !== fromIdx && toIdx < fromArr.length) {
          const tmp = fromArr[toIdx];
          fromArr[toIdx] = card;
          fromArr[fromIdx] = tmp;
        }
        return h;
      }

      // Different zones
      if (toIdx !== undefined && toIdx < toArr.length) {
        // Drop onto a specific card → swap them
        const targetCard = toArr[toIdx];
        fromArr[fromIdx] = targetCard;
        toArr[toIdx] = card;
      } else if (toZone !== 'unplaced' && toArr.length >= MAX[toZone]) {
        // Zone full, no specific target → swap with last
        const d = toArr.pop();
        fromArr.splice(fromIdx, 1, d);
        toArr.push(card);
      } else {
        // Zone has space → just move
        fromArr.splice(fromIdx, 1);
        toArr.push(card);
      }
      autoFillInto(h);
      return h;
    });
  }

  function moveCardTo(targetZone) {
    if (!selectedCard) return;
    let src=null, srcIdx=-1;
    for (const k of ['front','mid','back','unplaced']) {
      const i = hand[k].indexOf(selectedCard);
      if (i >= 0) { src=k; srcIdx=i; break; }
    }
    if (!src || src === targetZone) { setSelectedCard(null); return; }
    setUndoStack(u => [...u.slice(-19), { front:[...hand.front], mid:[...hand.mid], back:[...hand.back], unplaced:[...hand.unplaced] }]);
    dropCard(src, srcIdx, targetZone);
    setSelectedCard(null);
  }

  function handleCardTap(card, zone, idx) {
    if (hand.done) return;
    if (selectedCard && selectedCard !== card) {
      let prevZone=null, prevIdx=-1;
      for (const k of ['front','mid','back','unplaced']) {
        const pi = hand[k].indexOf(selectedCard);
        if (pi >= 0) { prevZone=k; prevIdx=pi; break; }
      }
      if (prevZone) {
        setUndoStack(u => [...u.slice(-19), { front:[...hand.front], mid:[...hand.mid], back:[...hand.back], unplaced:[...hand.unplaced] }]);
        setHand(prev => {
          const h = { front:[...prev.front], mid:[...prev.mid], back:[...prev.back], unplaced:[...prev.unplaced], done:prev.done, foul:prev.foul };
          const a = h[prevZone]; const b = h[zone];
          if (prevZone === zone) { const tmp = a[prevIdx]; a[prevIdx] = a[idx]; a[idx] = tmp; }
          else { const tmp = b[idx]; b[idx] = a[prevIdx]; a[prevIdx] = tmp; }
          return h;
        });
      }
      setSelectedCard(null);
    } else {
      setSelectedCard(selectedCard === card ? null : card);
    }
  }

  function handleUndo() {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setHand(h => ({ ...h, front:prev.front, mid:prev.mid, back:prev.back, unplaced:prev.unplaced }));
    setUndoStack(u => u.slice(0,-1));
  }

  function handleReset() {
    setUndoStack(u => [...u.slice(-19), { front:[...hand.front], mid:[...hand.mid], back:[...hand.back], unplaced:[...hand.unplaced] }]);
    setHand(h => ({ front:[], mid:[], back:[], unplaced:[...h.front,...h.mid,...h.back,...h.unplaced], done:false, foul:false }));
  }

  function handleSwapMidBack() {
    setUndoStack(u => [...u.slice(-19), { front:[...hand.front], mid:[...hand.mid], back:[...hand.back], unplaced:[...hand.unplaced] }]);
    setHand(h => ({ ...h, mid:[...h.back], back:[...h.mid] }));
  }

  const [confirmFoul, setConfirmFoul] = useState(false);
  function handleSubmit(foulConfirmed = false) {
    if (hand.front.length !== 3 || hand.mid.length !== 5 || hand.back.length !== 5) {
      alert('กรุณาจัดไพ่ให้ครบ 3 กอง (3-5-5) ก่อนส่ง'); return;
    }
    const isFoul = !validArr(hand.front, hand.mid, hand.back);
    if (isFoul && foulConfirmed !== true) { setConfirmFoul(true); return; }
    setConfirmFoul(false);

    const allHands = { [player.name]: { front:hand.front, mid:hand.mid, back:hand.back, foul:isFoul, done:true }, ...botHands };
    const allPlayers = [{ name:player.name, avatar:player.avatar||'🦊', id:'me' }, ...BOTS];
    const sc = calcScores(allPlayers, allHands);
    setScores(sc);

    // Update chips
    const newMyChips = myChips + (sc.find(s=>s.name===player.name)?.roundScore||0);
    setMyChips(Math.round(newMyChips*100)/100);
    const newBotChips = {...botChips};
    BOTS.forEach(b => { newBotChips[b.id] = Math.round(((newBotChips[b.id]||1000) + (sc.find(s=>s.name===b.name)?.roundScore||0))*100)/100; });
    setBotChips(newBotChips);

    // Build matchup details
    const mu = [];
    BOTS.forEach(bot => {
      const bh = botHands[bot.name];
      const rows = [
        { label:'กองหน้า', a:hand.front, b:bh.front },
        { label:'กองกลาง', a:hand.mid, b:bh.mid },
        { label:'กองหลัง', a:hand.back, b:bh.back },
      ].map(r => {
        const ha = evalHand(r.a), hb = evalHand(r.b);
        const w = ha.rank > hb.rank ? 1 : ha.rank < hb.rank ? -1 : 0;
        return { ...r, aName:ha.name, bName:hb.name, winner:w };
      });
      mu.push({ bot, rows });
    });
    setMatchups(mu);
    setHand(h => ({...h, done:true}));
    setPhase('results');
  }

  function onCardPointerDown(e, card, zone, idx) {
    if (hand.done) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const isRed = card.suit === '♥' || card.suit === '♦';
    el.style.opacity = '0.3';
    const g = ghostRef.current;
    if (g) {
      g.className = `poker-card ${isRed ? 'red-card' : 'black-card'}`;
      if (ghostNumRef.current) ghostNumRef.current.textContent = card.rank;
      if (ghostSuitRef.current) ghostSuitRef.current.textContent = card.suit;
      g.style.display = 'flex';
      g.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -55%) scale(1.1) rotate(5deg)`;
    }
    let moved = false;
    let lastZoneEl = null;
    function clearHover() { if (lastZoneEl) { lastZoneEl.style.outline = ''; lastZoneEl.style.background = ''; lastZoneEl = null; } }
    function onMove(ev) {
      ev.preventDefault(); moved = true;
      if (g) g.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -55%) scale(1.1) rotate(5deg)`;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const dz = under ? under.closest('[data-zone]') : null;
      if (lastZoneEl && lastZoneEl !== dz) { lastZoneEl.style.outline = ''; lastZoneEl.style.background = ''; }
      if (dz) { dz.style.outline = '2px solid #40e880'; dz.style.background = 'rgba(64,232,128,0.13)'; lastZoneEl = dz; }
    }
    function onUp(ev) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (g) g.style.opacity = '0';
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (g) { g.style.opacity = ''; g.style.display = 'none'; }
      clearHover();
      el.style.opacity = '';
      if (!moved) {
        handleCardTap(card, zone, idx);
        return;
      }

      // Detect target card or zone
      const targetCard = under ? under.closest('[data-card-zone]') : null;
      const dzEl = under ? under.closest('[data-zone]') : null;

      let toZone, toIdx;
      if (targetCard) {
        toZone = targetCard.dataset.cardZone;
        toIdx = parseInt(targetCard.dataset.cardIdx, 10);
      } else if (dzEl) {
        toZone = dzEl.dataset.zone;
        toIdx = undefined;
      }

      if (!toZone) return;
      if (toZone === zone && toIdx === idx) return; // same card, do nothing

      const cur = handRef.current;
      setUndoStack(prev => [...prev.slice(-19), { front:[...cur.front], mid:[...cur.mid], back:[...cur.back], unplaced:[...cur.unplaced] }]);
      dropCard(zone, idx, toZone, toIdx);
    }
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
  }

  function renderCard(c, i, zone) {
    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div key={zone+i} data-card-zone={zone} data-card-idx={i}
        className={`poker-card ${selectedCard===c?'glow-bonus':''} ${isRed?'red-card':'black-card'}`}
        onPointerDown={(e) => onCardPointerDown(e, c, zone, i)}
        style={{ touchAction:'none', userSelect:'none', cursor:'grab' }}>
        <span className="card-num" style={{ fontSize:'20px', fontWeight:900, lineHeight:1 }}>{c.rank}</span>
        <span className="card-suit" style={{ fontSize:'26px', lineHeight:1 }}>{c.suit}</span>
      </div>
    );
  }

  const tableSeats = BOTS.map((bot,i)=>({player:{...bot,chips:botChips[bot.id]},pos:['felt-pos-top','felt-pos-left','felt-pos-right'][i]}));
  const self = {...player,chips:myChips};
  if (phase === 'menu') return <main className="game-session">
    <GameHeader title="ห้องซ้อม" subtitle="เล่นกับบอท 3 คน · ชิปฝึก" onBack={onExit}/>
    <TableSurface seats={tableSeats} self={self} status="พร้อมเมื่อไหร่ เริ่มได้เลย"/>
    <div className="waiting-actions"><GameButton onClick={startPractice}>เริ่มฝึกจัดไพ่</GameButton><GameButton variant="secondary" onClick={()=>setShowRules(true)}>กติกาการเล่น</GameButton><button className="text-button" onClick={resetChips}>รีเซ็ตชิปฝึกเป็น 1,000</button></div>
    {showRules&&<Sheet title="กติกาการเล่นเดิม" onClose={()=>setShowRules(false)}><div className="rules-copy">{RULES_TEXT}</div></Sheet>}
  </main>;
  if (phase === 'playing') return <main className="game-session practice-gameplay">
    {confirmFoul && <FoulConfirmation onCancel={()=>setConfirmFoul(false)} onConfirm={()=>handleSubmit(true)}/>}
    <GameHeader title="ห้องซ้อม" subtitle={`ชิปฝึก ${myChips.toLocaleString('th-TH')}`} onBack={()=>setPhase('menu')}/>
    <div ref={ghostRef} className="poker-card" style={{position:'fixed',left:0,top:0,display:'none',pointerEvents:'none',zIndex:9999,opacity:.95,willChange:'transform',transition:'none'}}><span ref={ghostNumRef} className="card-num"/><span ref={ghostSuitRef} className="card-suit"/></div>
    <div className="game-play-layout"><TableSurface seats={tableSeats} self={self} hands={botHands} compact status="กำลังจัดไพ่"/><ArrangementBoard hand={hand} selectedCard={selectedCard} renderCard={renderCard} moveCardTo={moveCardTo} onUndo={handleUndo} onReset={handleReset} onSwap={handleSwapMidBack} onAuto={autoArrange} onSubmit={handleSubmit} undoCount={undoStack.length}/></div>
  </main>;

  // ── RESULTS SCREEN ──
  return (
    <div className="game-session">
      <GameHeader title="ผลห้องซ้อม" subtitle="ชิปฝึก · ไม่มีผลต่อยอดออนไลน์" onBack={()=>setPhase('menu')}/>
      <div className="results-view" style={{ flex:1, padding:'10px 12px', overflowY:'auto', overflowX:'hidden' }}>
        <h2 style={{ fontSize:'18px', fontWeight:900, color:'var(--primary)', textAlign:'center', marginBottom:'10px' }}>🏆 ผลการปะทะฝีมือรอบนี้</h2>

        <Showdown players={scores||[]} hands={{...botHands,[player.name]:{...hand,foul:!validArr(hand.front,hand.mid,hand.back)}}} focusName={player.name}/>
        {/* Score summary */}
        <div className="glass-panel" style={{ padding:'10px', marginBottom:'12px' }}>
          <div style={{ fontSize:'12px', fontWeight:900, color:'var(--primary)', marginBottom:'6px' }}>📊 ตารางคะแนนรวม</div>
          {scores && scores.map((s,i) => {
            const isMe = s.name === player.name;
            const isWin = s.roundScore > 0;
            return (
              <div key={s.id||s.name} className="score-reveal" style={{'--score-index':i,'--score-glow':isWin?'#78d49a':s.roundScore<0?'#d58d95':'#d4b779', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', marginBottom:'4px', borderRadius:'8px', borderLeft:`3px solid ${isWin?'#40e880':s.roundScore<0?'#ff6d86':'var(--line)'}`, background: isMe ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.2)' }}>
                <span style={{ fontWeight:800, fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{s.avatar} {s.name} {isMe?'(คุณ)':''}</span>
                <span style={{ fontWeight:900, fontSize:'15px', color:isWin?'#40e880':s.roundScore<0?'#ff6d86':'#fff', marginLeft:'8px', flexShrink:0 }}>
                  <AnimatedScore value={s.roundScore} unit="คะแนน" delay={i*110}/>
                </span>
              </div>
            );
          })}
        </div>

        <button className="btn-premium" style={{ width:'100%', padding:'14px', fontSize:'16px', fontWeight:900, marginBottom:'10px' }} onClick={startPractice}>
          🎴 ฝึกฝนซ้อมมือ
        </button>
        <button className="btn-secondary" style={{ width:'100%', padding:'10px', fontSize:'13px', marginBottom:'10px' }} onClick={() => setShowRules(!showRules)}>
          📖 กติกาการเล่นเบื้องต้น
        </button>
        {showRules && (
          <div className="glass-panel" style={{ padding:'14px', whiteSpace:'pre-wrap', fontSize:'12px', lineHeight:1.7, color:'var(--text-main)', marginBottom:'10px' }}>
            {RULES_TEXT}
          </div>
        )}

        <details className="result-details"><summary>ดูรายละเอียดเทียบไพ่</summary>
        {/* Matchup details */}
        <div style={{ fontSize:'12px', fontWeight:900, color:'var(--primary)', marginBottom:'8px' }}>⚔️ รายละเอียดเทียบไพ่ (คุณ ปะทะ บอท)</div>
        {matchups.map((mu, mi) => (
          <div key={mi} className="glass-panel" style={{ padding:'10px', marginBottom:'10px', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', justifyContent:'center', flexWrap:'wrap' }}>
              {mu.rows.every(r=>r.winner===1) && <span style={{ background:'rgba(212,175,55,0.2)', color:'var(--primary)', padding:'2px 6px', borderRadius:'6px', fontSize:'10px', fontWeight:900 }}>🔥 ทะลุ</span>}
              <span style={{ fontWeight:800, fontSize:'12px' }}>{player.avatar} {player.name}</span>
              <span style={{ background:'var(--glass)', padding:'1px 6px', borderRadius:'4px', fontWeight:900, fontSize:'10px' }}>VS</span>
              <span style={{ fontWeight:800, fontSize:'12px' }}>{mu.bot.avatar} {mu.bot.name}</span>
            </div>
            {mu.rows.map((r,ri) => (
              <div key={ri} style={{ marginBottom:'8px', background:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'6px 8px' }}>
                {/* Row header: label + hand names + result */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11px', fontWeight:800, color:'var(--primary)' }}>{r.label}</span>
                  <span style={{ fontSize:'9px', color:'var(--text-muted)' }}>{r.aName} vs {r.bName}</span>
                  <span style={{ fontSize:'10px', padding:'1px 6px', borderRadius:'4px', fontWeight:800, background: r.winner===1?'rgba(64,232,128,0.2)':r.winner===-1?'rgba(255,109,134,0.2)':'rgba(255,255,255,0.1)', color: r.winner===1?'#40e880':r.winner===-1?'#ff6d86':'#fff' }}>
                    {r.winner===1?'ชนะ':r.winner===-1?'แพ้':'เสมอ'}
                  </span>
                </div>
                {/* Cards row */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                  <div style={{ display:'flex', gap:'1px', flexShrink:0 }}>
                    {r.a.map((c,ci) => {
                      const isRed = c.suit==='♥'||c.suit==='♦';
                      return <div key={ci} style={{ width:'28px', height:'38px', background:'#fff', borderRadius:'4px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1px solid #ddd', flexShrink:0 }}>
                        <span style={{ fontSize:'12px', fontWeight:900, color:isRed?'#e53935':'#222', lineHeight:1 }}>{c.rank}</span>
                        <span style={{ fontSize:'12px', color:isRed?'#e53935':'#222', lineHeight:1 }}>{c.suit}</span>
                      </div>;
                    })}
                  </div>
                  <span style={{ fontSize:'10px', color:'var(--text-muted)', margin:'0 2px' }}>vs</span>
                  <div style={{ display:'flex', gap:'1px', flexShrink:0 }}>
                    {r.b.map((c,ci) => {
                      const isRed = c.suit==='♥'||c.suit==='♦';
                      return <div key={ci} style={{ width:'28px', height:'38px', background:'#fff', borderRadius:'4px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1px solid #ddd', flexShrink:0 }}>
                        <span style={{ fontSize:'12px', fontWeight:900, color:isRed?'#e53935':'#222', lineHeight:1 }}>{c.rank}</span>
                        <span style={{ fontSize:'12px', color:isRed?'#e53935':'#222', lineHeight:1 }}>{c.suit}</span>
                      </div>;
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        </details>
        <div style={{ textAlign:'center', marginTop:'16px', paddingBottom:'40px' }}>
          <button className="btn-premium" style={{ padding:'14px 40px', fontSize:'16px', fontWeight:900 }} onClick={startPractice}>
            🎴 เริ่มรอบใหม่!
          </button>
        </div>
      </div>
    </div>
  );
}
