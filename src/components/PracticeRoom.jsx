import React, { useState, useRef, useEffect } from 'react';
import { evalHand, validArr, calcScores, SUIT_RANK } from '../utils/ruleEngine.js';
import { Undo2, RotateCcw } from 'lucide-react';

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
  const sorted = [...cards].sort((a, b) => b.val - a.val || (SUIT_RANK[b.suit]||0) - (SUIT_RANK[a.suit]||0));
  let best = null, bestRank = -1;
  for (let t = 0; t < 80; t++) {
    const sh = [...sorted];
    if (t > 0) for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [sh[i],sh[j]]=[sh[j],sh[i]]; }
    const back = sh.slice(0, 5).sort((a,b) => b.val - a.val);
    const mid = sh.slice(5, 10).sort((a,b) => b.val - a.val);
    const front = sh.slice(10, 13).sort((a,b) => b.val - a.val);
    if (validArr(front, mid, back)) {
      const r = evalHand(back).rank * 100 + evalHand(mid).rank * 10 + evalHand(front).rank;
      if (r > bestRank) { bestRank = r; best = { front, mid, back }; }
    }
  }
  if (!best) {
    const back = sorted.slice(0, 5);
    const mid = sorted.slice(5, 10);
    const front = sorted.slice(10, 13);
    best = { front, mid, back, foul: true };
  }
  return { ...best, done: true, foul: best.foul || false };
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

  function dropCard(fromZone, fromIdx, toZone) {
    setHand(prev => {
      const h = { front:[...prev.front], mid:[...prev.mid], back:[...prev.back], unplaced:[...prev.unplaced], done:prev.done, foul:prev.foul };
      const fromArr = h[fromZone]; const toArr = h[toZone];
      const card = fromArr[fromIdx]; if (!card) return prev;
      if (fromZone !== toZone) {
        if (toZone !== 'unplaced' && h[toZone].length >= MAX[toZone]) {
          const d = h[toZone].pop(); fromArr.splice(fromIdx,1); h[toZone].push(card); fromArr.splice(fromIdx,0,d);
        } else { fromArr.splice(fromIdx,1); toArr.push(card); }
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

  function handleSubmit() {
    if (hand.front.length !== 3 || hand.mid.length !== 5 || hand.back.length !== 5) {
      alert('กรุณาจัดไพ่ให้ครบ 3 กอง (3-5-5) ก่อนส่ง'); return;
    }
    const isFoul = !validArr(hand.front, hand.mid, hand.back);
    if (isFoul) { if (!confirm('⚠️ ไพ่ฟาวล์! ยืนยันส่ง?')) return; }

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
      const dzEl = under ? under.closest('[data-zone]') : null;
      const toZone = dzEl ? dzEl.dataset.zone : null;
      clearHover();
      el.style.opacity = '';
      if (!moved) {
        handleCardTap(card, zone, idx);
        return;
      }
      if (!toZone || toZone === zone) return;
      const cur = handRef.current;
      setUndoStack(prev => [...prev.slice(-19), { front:[...cur.front], mid:[...cur.mid], back:[...cur.back], unplaced:[...cur.unplaced] }]);
      dropCard(zone, idx, toZone);
    }
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
  }

  function renderCard(c, i, zone) {
    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div key={zone+i} className={`poker-card ${selectedCard===c?'glow-bonus':''} ${isRed?'red-card':'black-card'}`}
        onPointerDown={(e) => onCardPointerDown(e, c, zone, i)}
        style={{ touchAction:'none', userSelect:'none', cursor:'grab' }}>
        <span className="card-num" style={{ fontSize:'20px', fontWeight:900, lineHeight:1 }}>{c.rank}</span>
        <span className="card-suit" style={{ fontSize:'26px', lineHeight:1 }}>{c.suit}</span>
      </div>
    );
  }

  function renderSmallCard(c, i) {
    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div key={i} className={`poker-card ${isRed?'red-card':'black-card'}`} style={{ transform:'scale(0.75)', margin:'-4px -2px' }}>
        <span className="card-num" style={{ fontSize:'16px', fontWeight:900, lineHeight:1 }}>{c.rank}</span>
        <span className="card-suit" style={{ fontSize:'20px', lineHeight:1 }}>{c.suit}</span>
      </div>
    );
  }

  // ── MENU SCREEN ──
  if (phase === 'menu') return (
    <div className="screen active" style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <div className="app-header safe-area-top">
        <button className="btn-secondary" style={{ padding:'6px 12px' }} onClick={onExit}>← กลับ</button>
        <div className="header-logo">🤖 โหมดซ้อมกับ AI</div>
        <button className="btn-secondary" style={{ padding:'6px 12px', fontSize:'11px', color:'#40e880' }} onClick={resetChips}>รีเซ็ตชิป</button>
      </div>

      {/* TABLE — fills most of the screen */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'12px', minHeight:0 }}>
        <div style={{ position:'relative', width:'100%', maxWidth:'420px', aspectRatio:'1/1.1' }}>
          {/* Green felt */}
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, #1a6b3a 0%, #0d4a25 60%, #082e16 100%)', borderRadius:'24px', border:'4px solid #8B6914', boxShadow:'inset 0 0 40px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ position:'absolute', inset:'12px', border:'2px dashed rgba(212,175,55,0.25)', borderRadius:'18px' }}></div>
            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:'20px', fontWeight:900, color:'rgba(255,255,255,0.06)', whiteSpace:'nowrap', letterSpacing:'8px' }}>3 กอง กาญ</div>
          </div>

          {/* Player: Top (Bot สมศรี) */}
          <div style={{ position:'absolute', top:'-8px', left:'50%', transform:'translateX(-50%)', textAlign:'center', zIndex:2 }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:'3px solid var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', background:'var(--card-bg)', margin:'0 auto' }}>{BOTS[0].avatar}</div>
            <div style={{ fontWeight:800, fontSize:'12px', marginTop:'2px' }}>{BOTS[0].name}</div>
            <div style={{ fontSize:'11px', color:'var(--primary)' }}>🪙 {botChips.bot1}</div>
          </div>

          {/* Player: Left (Bot สมศักดิ์) */}
          <div style={{ position:'absolute', left:'-4px', top:'50%', transform:'translateY(-50%)', textAlign:'center', zIndex:2 }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:'3px solid var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', background:'var(--card-bg)', margin:'0 auto' }}>{BOTS[1].avatar}</div>
            <div style={{ fontWeight:800, fontSize:'12px', marginTop:'2px' }}>{BOTS[1].name}</div>
            <div style={{ fontSize:'11px', color:'var(--primary)' }}>🪙 {botChips.bot2}</div>
          </div>

          {/* Player: Right (Bot วันชัย) */}
          <div style={{ position:'absolute', right:'-4px', top:'50%', transform:'translateY(-50%)', textAlign:'center', zIndex:2 }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:'3px solid var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', background:'var(--card-bg)', margin:'0 auto' }}>{BOTS[2].avatar}</div>
            <div style={{ fontWeight:800, fontSize:'12px', marginTop:'2px' }}>{BOTS[2].name}</div>
            <div style={{ fontSize:'11px', color:'var(--primary)' }}>🪙 {botChips.bot3}</div>
          </div>

          {/* Player: Bottom (Me) */}
          <div style={{ position:'absolute', bottom:'-8px', left:'50%', transform:'translateX(-50%)', textAlign:'center', zIndex:2 }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:'3px solid var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', background:'var(--card-bg)', margin:'0 auto' }}>{player.avatar||'🦊'}</div>
            <div style={{ fontWeight:800, fontSize:'12px', marginTop:'2px', color:'var(--primary)' }}>{player.name} (คุณ)</div>
            <div style={{ fontSize:'11px', color:'var(--primary)' }}>🪙 {myChips}</div>
          </div>
        </div>
      </div>

      {/* BUTTONS — fixed at bottom */}
      <div className="safe-area-bottom" style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
        <button className="btn-premium" style={{ width:'100%', padding:'16px', fontSize:'16px', fontWeight:900 }} onClick={startPractice}>
          🎴 ฝึกฝนซ้อมมือ
        </button>
        <button className="btn-secondary" style={{ width:'100%', padding:'14px', fontSize:'14px' }} onClick={() => setShowRules(!showRules)}>
          📖 กติกาการเล่นเบื้องต้น
        </button>
        {showRules && (
          <div className="glass-panel" style={{ padding:'16px', whiteSpace:'pre-wrap', fontSize:'13px', lineHeight:1.7, color:'var(--text-main)', maxHeight:'40vh', overflowY:'auto' }}>
            {RULES_TEXT}
          </div>
        )}
      </div>
    </div>
  );

  // ── PLAYING SCREEN ──
  if (phase === 'playing') return (
    <div className="screen active" style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <div className="app-header safe-area-top">
        <button className="btn-secondary" style={{ padding:'6px 12px' }} onClick={() => setPhase('menu')}>← กลับ</button>
        <div className="header-logo">🤖 โหมดซ้อมกับ AI</div>
        <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>🪙 {myChips}</span>
      </div>

      {/* GHOST CARD for drag */}
      <div ref={ghostRef} className="poker-card" style={{ position:'fixed', left:0, top:0, display:'none', pointerEvents:'none', zIndex:9999, opacity:0.95, boxShadow:'0 14px 36px rgba(0,0,0,0.55)', willChange:'transform', transition:'none' }}>
        <span ref={ghostNumRef} className="card-num" style={{ fontSize:'20px', fontWeight:900, lineHeight:1 }}></span>
        <span ref={ghostSuitRef} className="card-suit" style={{ fontSize:'26px', lineHeight:1 }}></span>
      </div>

      <div className="table-felt">
        <div className="table-oval">
          <div className="table-logo-text">3 กอง กาญ</div>
          {BOTS.map((bot, idx) => {
            const posClass = idx===0?'felt-pos-top':idx===1?'felt-pos-left':'felt-pos-right';
            return (
              <div key={bot.id} className={`felt-player-box ${posClass}`}>
                <div className="felt-av">{bot.avatar}</div>
                <div className="felt-nm">{bot.name}</div>
                <div className="felt-chips">🪙 {botChips[bot.id]}</div>
                <span style={{ fontSize:'9px', background:'rgba(50,232,117,0.2)', color:'#60e890', padding:'1px 5px', borderRadius:'4px', marginTop:'2px' }}>จัดเสร็จแล้ว</span>
              </div>
            );
          })}
          <div className="felt-player-box felt-pos-bottom">
            <div className="felt-av">{player.avatar||'🦊'}</div>
            <div className="felt-nm">{player.name} (คุณ)</div>
            <div className="felt-chips">🪙 {myChips}</div>
            {hand.done && <span style={{ fontSize:'9px', background:'rgba(50,232,117,0.2)', color:'#60e890', padding:'1px 5px', borderRadius:'4px', marginTop:'2px' }}>จัดเสร็จแล้ว</span>}
            {!hand.done && <span style={{ fontSize:'9px', color:'var(--primary)', marginTop:'2px' }}>กำลังจัดไพ่...</span>}
          </div>
        </div>
      </div>

      <div className="my-hand safe-area-bottom" style={{ overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <span style={{ color:'var(--text-muted)', fontSize:'10px' }}>ลาก/จิ้มการ์ด เพื่อวางแต่ละกอง</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'8px' }}>
          {['front','mid','back'].map(zone => {
            const label = zone==='front'?'หน้า (3)':zone==='mid'?'กลาง (5)':'หลัง (5)';
            const cards = hand[zone];
            const full = cards.length === MAX[zone];
            return (
              <div key={zone} className="hand-pile-container">
                <span className="hand-pile-label">{label}</span>
                <div data-zone={zone} className={`drop-zone ${selectedCard?'active-hover':''} ${full?'pile-full':''}`} onClick={() => moveCardTo(zone)}>
                  {cards.map((c,i) => renderCard(c,i,zone))}
                  {cards.length === 0 && <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.15)', margin:'auto' }}>จิ้มไพ่เพื่อวาง{label}</span>}
                </div>
                {full && <span style={{ alignSelf:'center', fontSize:'9px', background:'var(--glass)', border:'1px solid var(--line)', padding:'2px 4px', borderRadius:'4px', color:'var(--primary)' }}>{evalHand(cards).name}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ marginBottom:'8px' }}>
          <div data-zone="unplaced" className="drop-zone" style={{ minHeight:'66px', display:'flex', gap:'3px', flexWrap:'wrap' }} onClick={() => moveCardTo('unplaced')}>
            {hand.unplaced.map((c,i) => renderCard(c,i,'unplaced'))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px', marginBottom:'4px' }}>
          <button className="btn-secondary" style={{ flex:1, padding:'10px', fontSize:'13px', fontWeight:800, background:'rgba(64,232,128,0.1)', border:'1px solid rgba(64,232,128,0.3)', color:'#40e880' }} onClick={autoArrange}>🤖 จัดไพ่ให้</button>
          <button className="btn-secondary" style={{ flex:1, padding:'10px', fontSize:'13px', fontWeight:800, whiteSpace:'nowrap' }} onClick={handleSwapMidBack}>⇅ สลับกลาง/หลัง</button>
        </div>
        <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
          <button className="btn-secondary" style={{ padding:'10px' }} onClick={handleUndo}><Undo2 size={14} /></button>
          <button className="btn-secondary" style={{ padding:'10px' }} onClick={handleReset}><RotateCcw size={14} /></button>
          <button className="btn-premium" style={{ flex:1, padding:'10px', fontSize:'15px' }} onClick={handleSubmit} disabled={hand.done}>
            {hand.done ? '✓ ส่งแล้ว' : '⚔️ ส่งไพ่สู้!'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── RESULTS SCREEN ──
  return (
    <div className="screen active" style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <div className="app-header safe-area-top">
        <button className="btn-secondary" style={{ padding:'6px 12px' }} onClick={() => setPhase('menu')}>← กลับ</button>
        <div className="header-logo">🤖 โหมดซ้อมกับ AI</div>
        <button className="btn-secondary" style={{ padding:'6px 12px', fontSize:'11px', color:'#40e880' }} onClick={resetChips}>รีเซ็ตชิป</button>
      </div>
      <div style={{ flex:1, padding:'14px', overflowY:'auto' }}>
        <button className="btn-premium" style={{ width:'100%', padding:'14px', fontSize:'16px', fontWeight:900, marginBottom:'14px' }} onClick={startPractice}>
          🎴 ฝึกฝนซ้อมมือ
        </button>
        <button className="btn-secondary" style={{ width:'100%', padding:'10px', fontSize:'13px', marginBottom:'14px' }} onClick={() => setShowRules(!showRules)}>
          📖 กติกาการเล่นเบื้องต้น
        </button>
        {showRules && (
          <div className="glass-panel" style={{ padding:'16px', whiteSpace:'pre-wrap', fontSize:'13px', lineHeight:1.7, color:'var(--text-main)', marginBottom:'14px' }}>
            {RULES_TEXT}
          </div>
        )}

        <h2 style={{ fontSize:'20px', fontWeight:900, color:'var(--primary)', textAlign:'center', marginBottom:'14px' }}>🏆 ผลการปะทะฝีมือรอบนี้</h2>

        {/* Score summary */}
        <div className="glass-panel" style={{ padding:'14px', marginBottom:'14px' }}>
          <div style={{ fontSize:'13px', fontWeight:900, color:'var(--primary)', marginBottom:'8px' }}>📊 ตารางคะแนนรวม</div>
          {scores && scores.map((s,i) => {
            const isMe = s.name === player.name;
            const isWin = s.roundScore > 0;
            return (
              <div key={i} className="glass-panel" style={{ padding:'10px', marginBottom:'6px', borderLeft:`3px solid ${isWin?'#40e880':s.roundScore<0?'#ff6d86':'var(--line)'}`, background: isMe ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.2)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:800, fontSize:'14px' }}>{s.avatar} {s.name} {isMe?'(คุณ)':''}</span>
                  <span style={{ fontWeight:900, fontSize:'16px', color:isWin?'#40e880':s.roundScore<0?'#ff6d86':'#fff' }}>
                    {isWin?'+':''}{s.roundScore} คะแนน
                  </span>
                </div>
                {s.bonusLabel && <div style={{ fontSize:'10px', color:'var(--primary)', marginTop:'4px' }}>🌟 {s.bonusLabel}</div>}
              </div>
            );
          })}
        </div>

        {/* Matchup details */}
        <div style={{ fontSize:'13px', fontWeight:900, color:'var(--primary)', marginBottom:'8px' }}>⚔️ รายละเอียดการเทียบไพ่รายคู่ (คุณ ปะทะ บอท)</div>
        {matchups.map((mu, mi) => (
          <div key={mi} className="glass-panel" style={{ padding:'14px', marginBottom:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', justifyContent:'center' }}>
              {mu.rows.every(r=>r.winner===1) && <span style={{ background:'rgba(212,175,55,0.2)', color:'var(--primary)', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:900 }}>🔥 กิน ทะลุ</span>}
              <span style={{ fontWeight:800 }}>{player.avatar} {player.name} (คุณ)</span>
              <span style={{ background:'var(--glass)', padding:'2px 8px', borderRadius:'6px', fontWeight:900, fontSize:'12px' }}>VS</span>
              <span style={{ fontWeight:800 }}>{mu.bot.avatar} {mu.bot.name}</span>
            </div>
            {mu.rows.map((r,ri) => (
              <div key={ri} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px', marginBottom:'6px', background:'rgba(0,0,0,0.2)', borderRadius:'8px' }}>
                <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', fontWeight:800, background: r.winner===1?'rgba(64,232,128,0.2)':r.winner===-1?'rgba(255,109,134,0.2)':'rgba(255,255,255,0.1)', color: r.winner===1?'#40e880':r.winner===-1?'#ff6d86':'#fff' }}>
                  {r.winner===1?'ชนะ':r.winner===-1?'แพ้':'เสมอ'}
                </span>
                <div style={{ display:'flex', gap:'1px' }}>{r.a.map((c,ci) => renderSmallCard(c,ci))}</div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'11px', fontWeight:800, color:'var(--primary)' }}>{r.label}</div>
                  <div style={{ fontSize:'9px', color:'var(--text-muted)' }}>{r.aName} vs {r.bName}</div>
                </div>
                <div style={{ display:'flex', gap:'1px' }}>{r.b.map((c,ci) => renderSmallCard(c,ci))}</div>
                <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', fontWeight:800, background: r.winner===-1?'rgba(64,232,128,0.2)':r.winner===1?'rgba(255,109,134,0.2)':'rgba(255,255,255,0.1)', color: r.winner===-1?'#40e880':r.winner===1?'#ff6d86':'#fff' }}>
                  {r.winner===-1?'ชนะ':r.winner===1?'แพ้':'เสมอ'}
                </span>
              </div>
            ))}
          </div>
        ))}

        <div style={{ textAlign:'center', marginTop:'20px', paddingBottom:'40px' }}>
          <button className="btn-premium" style={{ padding:'14px 40px', fontSize:'16px', fontWeight:900 }} onClick={startPractice}>
            🎴 เริ่มรอบใหม่!
          </button>
        </div>
      </div>
    </div>
  );
}
