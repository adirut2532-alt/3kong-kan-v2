import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../App.jsx';
import {
  evalHand,
  bonus,
  validArr,
  isDragonHand,
  calcScores,
  buildMatchups,
  SUIT_RANK
} from '../utils/ruleEngine.js';
import {
  aiArrange,
  aiAnalysis,
  handPower,
  gradeFromPower
} from '../utils/aiEngine.js';
import { 
  ShieldAlert, Undo2, RotateCcw, Sparkles, MessageCircle, 
  Send, Users, Award, Play, Home, Volume2, VolumeX, Eye
} from 'lucide-react';

export default function GameRoom({ player, memberId, roomId, onExit }) {
  // Live Room State
  const [room, setRoom]       = useState(null);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId]       = useState('');
  const [isHost, setIsHost]   = useState(false);

  // Player Hand State
  const [hand, setHand]                 = useState({ front: [], mid: [], back: [], unplaced: [], done: false, foul: false });
  const [selectedCard, setSelectedCard] = useState(null);
  const [undoStack, setUndoStack]       = useState([]);
  const [aiMode, setAiMode]             = useState('balanced');

  // Keep a live ref to hand so the drag handlers (attached to document) always
  // read the freshest hand without re-subscribing.
  const handRef = useRef(hand);
  useEffect(() => { handRef.current = hand; }, [hand]);

  // Drag ghost refs
  const ghostRef     = useRef(null);
  const ghostNumRef  = useRef(null);
  const ghostSuitRef = useRef(null);

  // Sound & Speech
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [speechMuted, setSpeechMuted] = useState(false);
  const audioCtx = useRef(null);

  // Live chip balance for the current member (header display)
  const [myChips, setMyChips] = useState(0);

  // Chat & Emoji
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatMsg, setChatMsg]         = useState('');
  const [chatList, setChatList]       = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  // Subscriptions
  const unsubRoom = useRef(null);
  const unsubChat = useRef(null);

  const MAX = { front: 3, mid: 5, back: 5 };

  // ── autoFill: if exactly one row is empty and unplaced holds exactly its size, drop them in (v1) ──
  function autoFillInto(h) {
    const empty   = ['front', 'mid', 'back'].filter(r => h[r].length === 0);
    const partial = ['front', 'mid', 'back'].filter(r => h[r].length > 0 && h[r].length < MAX[r]);
    if (empty.length === 1 && partial.length === 0) {
      const r = empty[0];
      if (h.unplaced.length === MAX[r]) { h[r] = [...h.unplaced]; h.unplaced = []; }
    }
  }

  // ── dropCard: ported 1:1 from v1 — exact card swap, index-preserving, bump-when-full ──
  function dropCard(fromZone, fromIdx, toZone, toIdx) {
    setHand(prev => {
      const h = {
        front:    [...prev.front],
        mid:      [...prev.mid],
        back:     [...prev.back],
        unplaced: [...prev.unplaced],
        done:     prev.done,
        foul:     prev.foul
      };
      const fromArr = fromZone === 'unplaced' ? h.unplaced : h[fromZone];
      const card = fromArr[fromIdx];
      if (!card) return prev;

      // dropped directly onto a card in the target → swap those two, keep positions
      if (toZone !== 'unplaced' && toIdx !== undefined && toIdx >= 0) {
        const target = h[toZone][toIdx];
        if (target) {
          fromArr.splice(fromIdx, 1);
          fromArr.splice(fromIdx, 0, target);
          h[toZone][toIdx] = card;
          autoFillInto(h);
          return h;
        }
      }

      // target full → push its last card back into the source slot
      if (toZone !== 'unplaced' && h[toZone].length >= MAX[toZone]) {
        const d = h[toZone].pop();
        fromArr.splice(fromIdx, 1);
        h[toZone].push(card);
        fromArr.splice(fromIdx, 0, d);
      } else {
        fromArr.splice(fromIdx, 1);
        if (toZone === 'unplaced') h.unplaced.push(card);
        else h[toZone].push(card);
      }
      autoFillInto(h);
      return h;
    });
  }

  // ── Start drag (v1-style, pointer events). Ghost moves via DOM; React renders once on drop. ──
  function onCardPointerDown(e, card, zone, idx) {
    if (hand.done) return;
    e.preventDefault();
    e.stopPropagation();

    const el    = e.currentTarget;
    const isRed = card.suit === '♥' || card.suit === '♦';
    el.style.opacity = '0.3';

    const g = ghostRef.current;
    if (g) {
      g.className = `poker-card ${isRed ? 'red-card' : 'black-card'}`;
      if (ghostNumRef.current)  ghostNumRef.current.textContent  = card.rank;
      if (ghostSuitRef.current) ghostSuitRef.current.textContent = card.suit;
      g.style.display   = 'flex';
      g.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -55%) scale(1.1) rotate(5deg)`;
    }

    let moved = false;
    let lastZoneEl = null;

    function clearHover() {
      if (lastZoneEl) { lastZoneEl.style.outline = ''; lastZoneEl.style.background = ''; lastZoneEl = null; }
    }

    function onMove(ev) {
      ev.preventDefault();
      moved = true;
      if (g) g.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -55%) scale(1.1) rotate(5deg)`;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const dz = under ? under.closest('[data-zone]') : null;
      if (lastZoneEl && lastZoneEl !== dz) { lastZoneEl.style.outline = ''; lastZoneEl.style.background = ''; }
      if (dz) { dz.style.outline = '2px solid #40e880'; dz.style.background = 'rgba(64,232,128,0.13)'; lastZoneEl = dz; }
    }

    function onUp(ev) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);

      if (g) g.style.opacity = '0';
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (g) { g.style.opacity = ''; g.style.display = 'none'; }

      const cardEl = under ? under.closest('.poker-card[data-source]') : null;
      const dzEl   = under ? under.closest('[data-zone]') : null;
      const toZone = dzEl ? dzEl.dataset.zone : null;

      clearHover();
      el.style.opacity = '';

      if (!moved) {                                  // tap → toggle select
        setSelectedCard(prev => (prev === card ? null : card));
        playSound('click');
        return;
      }
      if (!toZone || toZone === zone) return;        // no valid / same zone

      const toIdx = (cardEl && cardEl.dataset.source === toZone)
        ? parseInt(cardEl.dataset.idx, 10)
        : undefined;

      const cur = handRef.current;
      setUndoStack(prev => [...prev.slice(-19), {
        front: [...cur.front], mid: [...cur.mid], back: [...cur.back], unplaced: [...cur.unplaced]
      }]);
      dropCard(zone, idx, toZone, toIdx);
      playSound('flip');
    }

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup',   onUp);
  }

  function renderCard(c, i, zone) {
    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div
        key={zone + i}
        className={`poker-card ${selectedCard === c ? 'glow-bonus' : ''} ${isRed ? 'red-card' : 'black-card'}`}
        data-source={zone}
        data-idx={i}
        onPointerDown={(e) => onCardPointerDown(e, c, zone, i)}
        style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
      >
        <span className="card-num" style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1 }}>{c.rank}</span>
        <span className="card-suit" style={{ fontSize: '26px', lineHeight: 1 }}>{c.suit}</span>
      </div>
    );
  }

  // 1. Web Audio
  function playSound(type = 'click') {
    if (soundVolume <= 0) return;
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx  = audioCtx.current;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const now  = ctx.currentTime;
      const soundMap = {
        click:   [520, 0.05, 'triangle'],
        deal:    [740, 0.08, 'square'],
        flip:    [440, 0.09, 'triangle'],
        ready:   [880, 0.12, 'sine'],
        talu:    [190, 0.22, 'sawtooth'],
        derby:   [330, 0.25, 'triangle'],
        dragon:  [120, 0.35, 'sawtooth'],
        victory: [980, 0.25, 'sine']
      };
      const [freq, dur, wave] = soundMap[type] || soundMap.click;
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(soundVolume * 0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) {}
  }

  // 2. TTS
  function announce(text) {
    if (speechMuted) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'th-TH'; u.rate = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  // 3. Firestore subscriptions
  useEffect(() => {
    if (!roomId) return;
    unsubRoom.current = db.collection('rooms').doc(roomId).onSnapshot(async snap => {
      if (!snap.exists) { alert('ห้องนี้ถูกปิดแล้วครับ'); onExit(); return; }
      const d = snap.data();
      setRoom(d);
      const pList = Object.entries(d.players || {}).map(([id, val]) => ({ id, ...val }));
      const me = pList.find(x => x.name === player.name);
      if (me) { setMyId(me.id); setIsHost(me.isHost || false); }
      setPlayers(pList);

      if (d.status === 'playing' && me) {
        const myDeal = (d.deals || {})[me.id] || [];
        const submitted = (d.hands || {})[me.name] || (d.hands || {})[me.id];
        if (myDeal.length > 0 && !submitted && hand.unplaced.length === 0 && hand.front.length === 0 && hand.mid.length === 0 && hand.back.length === 0) {
          setHand({ front: [], mid: [], back: [], unplaced: myDeal, done: false, foul: false });
          playSound('deal');
        }
        if (me.isHost) {
          const activeP = pList.filter(p => !p.isSpectator && !p.isQueue);
          const allDone = activeP.length >= 2 && activeP.every(p => (d.hands || {})[p.name]?.done);
          if (allDone && d.status === 'playing' && d.settledRound !== d.round) {
            settleScores();
          }
        }
      }

      pList.forEach(p => {
        if (p.emojiReaction && p.name !== player.name) {
          triggerFloatingEmoji(p.avatar || '🎴', p.emojiReaction);
          db.collection('rooms').doc(roomId).update({
            [`players.${p.id}.emojiReaction`]: firebase.firestore.FieldValue.delete()
          }).catch(() => {});
        }
      });
    });
    unsubChat.current = db.collection('rooms').doc(roomId)
      .collection('chat').orderBy('timestamp', 'asc').limit(50)
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setChatList(list);
        if (!chatOpen) setUnreadCount(prev => prev + 1);
      });
    return () => {
      if (unsubRoom.current) unsubRoom.current();
      if (unsubChat.current) unsubChat.current();
    };
  }, [roomId]);

  function triggerFloatingEmoji(avatar, emoji) {
    const id = Math.random();
    setFloatingEmojis(prev => [...prev, { id, avatar, emoji }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(x => x.id !== id)), 1500);
  }

  // Live chip balance subscription for header
  useEffect(() => {
    if (!memberId) return;
    const unsub = db.collection('members').doc(memberId).onSnapshot(
      s => { if (s.exists) setMyChips(s.data().chips || 0); },
      () => {}
    );
    return () => unsub();
  }, [memberId]);

  // ── Settle round: compute scores + update chips atomically (host only) ──
  async function settleScores() {
    const roomRef = db.collection('rooms').doc(roomId);
    try {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(roomRef);
        if (!fresh.exists) return;
        const fd = fresh.data();
        if (fd.status !== 'playing') return;
        if (fd.settledRound === fd.round) return;

        const playingP = Object.entries(fd.players || {})
          .map(([id, v]) => ({ id, ...v }))
          .filter(p => !p.isSpectator && !p.isQueue);

        if (playingP.length < 2) return;
        if (!playingP.every(p => (fd.hands || {})[p.name]?.done)) return;

        const memberSnaps = {};
        for (const p of playingP) {
          memberSnaps[p.id] = await tx.get(db.collection('members').doc(p.id));
        }

        const scores = calcScores(playingP, fd.hands || {});
        const newScores = { ...(fd.scores || {}) };

        for (const p of playingP) {
          const sc  = scores.find(s => s.name === p.name);
          const amt = Math.round((sc?.roundScore || 0) * 100) / 100;
          const mSnap = memberSnaps[p.id];
          const cur   = mSnap.exists ? (mSnap.data().chips || 0) : 0;
          const finalChips = Math.round((cur + amt) * 100) / 100;

          tx.set(db.collection('members').doc(p.id), {
            chips: finalChips,
            txns: firebase.firestore.FieldValue.arrayUnion({
              t: Date.now(),
              ty: amt >= 0 ? 'win' : 'lose',
              amt: Math.abs(amt),
              bal: finalChips,
              note: `รอบ ${fd.round} ห้อง #${roomId}`
            })
          }, { merge: true });

          newScores[p.id] = Math.round(((fd.scores?.[p.id] || 0) + amt) * 100) / 100;
        }

        tx.update(roomRef, { scores: newScores, status: 'results', settledRound: fd.round });
      });
    } catch (e) {}
  }

  // 4. Presence
  async function joinActive() {
    if (!room) return;
    const tempId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const myCode = myId || tempId;
    const hasHost = players.some(p => p.isHost);
    await db.collection('rooms').doc(roomId).update({
      [`players.${myCode}`]: { name: player.name, avatar: player.avatar, isSpectator: false, isQueue: false, isHost: !hasHost, ready: false }
    });
    setMyId(myCode);
  }

  async function setReadyState() {
    if (!myId) return;
    await db.collection('rooms').doc(roomId).update({ [`players.${myId}.ready`]: true });
    playSound('ready');
  }

  async function handleHostStart() {
    const deck = [];
    const suits = ['♠','♥','♦','♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const valMap = {}; ranks.forEach((r, i) => valMap[r] = i + 2);
    for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r, val: valMap[r] });
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const active = players.filter(p => !p.isSpectator && !p.isQueue);
    const deals = {};
    active.forEach((p, idx) => { deals[p.id] = shuffled.slice(idx * 13, (idx + 1) * 13); });
    await db.collection('rooms').doc(roomId).update({ status: 'playing', deals, hands: {}, scores: {}, round: (room.round || 0) + 1 });
  }

  // 5. Arranger helpers
  function pushUndo() {
    setUndoStack(prev => [...prev.slice(-19), {
      front: [...hand.front], mid: [...hand.mid], back: [...hand.back], unplaced: [...hand.unplaced]
    }]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setHand({ ...hand, front: prev.front, mid: prev.mid, back: prev.back, unplaced: prev.unplaced });
    setUndoStack(prev => prev.slice(0, -1));
    playSound('click');
  }

  function handleReset() {
    pushUndo();
    setHand({ front: [], mid: [], back: [], unplaced: [...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced], done: false, foul: false });
    playSound('click');
  }

  // Tap-to-move (zone onClick) — uses dropCard's swap logic via selected card
  function moveCardTo(targetZone) {
    if (!selectedCard) return;
    const c = selectedCard;
    let src = null, srcIdx = -1;
    for (const k of ['front', 'mid', 'back', 'unplaced']) {
      const i = hand[k].indexOf(c);
      if (i >= 0) { src = k; srcIdx = i; break; }
    }
    if (src === null || src === targetZone) { setSelectedCard(null); return; }
    pushUndo();
    dropCard(src, srcIdx, targetZone, undefined);
    setSelectedCard(null);
    playSound('click');
  }

  // Swap middle ↔ bottom rows (v1 convenience)
  function handleSwapMidBack() {
    pushUndo();
    setHand(prev => ({ ...prev, mid: [...prev.back], back: [...prev.mid] }));
    playSound('flip');
  }

  function handleAutoArrange() {
    const all = [...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced];
    if (all.length < 13) return;
    pushUndo();
    const arranged = aiArrange(all, aiMode);
    setHand({ front: arranged.front, mid: arranged.mid, back: arranged.back, unplaced: [], done: false, foul: false });
    playSound('ready');
  }

  async function handleSubmitHand() {
    if (hand.front.length !== 3 || hand.mid.length !== 5 || hand.back.length !== 5) {
      alert('กรุณาจัดไพ่ให้ครบทั้ง 3 กอง (3-5-5) ก่อนส่งครับ'); return;
    }
    const isFoul = !validArr(hand.front, hand.mid, hand.back);
    if (isFoul) {
      const ok = confirm('⚠️ ไพ่ของคุณฟาวล์อยู่ขณะนี้! ยืนยันการส่งไพ่แบบฟาวล์หรือไม่? (คนฟาวล์ต้องจ่ายให้ผู้เล่นอื่นคนละ 6 คะแนน)');
      if (!ok) return;
    }
    await db.collection('rooms').doc(roomId).update({
      [`hands.${player.name}`]: { front: hand.front, mid: hand.mid, back: hand.back, foul: isFoul, done: true }
    });
    setHand({ ...hand, done: true });
    playSound('ready');
  }

  // Memoized AI analysis → recomputes ONLY when hand or mode changes
  const cardLab = useMemo(() => aiAnalysis(hand, hand.unplaced, aiMode), [hand, aiMode]);

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    await db.collection('rooms').doc(roomId).collection('chat').add({ name: player.name, avatar: player.avatar, text: chatMsg.trim(), timestamp: Date.now() });
    setChatMsg('');
  }

  async function handleSendEmoji(emoji) {
    if (!myId) return;
    await db.collection('rooms').doc(roomId).update({ [`players.${myId}.emojiReaction`]: emoji });
    triggerFloatingEmoji(player.avatar, emoji);
  }

  async function handleNextRound() {
    await db.collection('rooms').doc(roomId).update({ status: 'lobby', hands: {}, deals: {}, scores: {} });
  }

  const activeOpponents = players.filter(p => !p.isSpectator && !p.isQueue);
  const seats = Array(4).fill(null).map((_, i) => activeOpponents[i]);

  if (!room) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>กำลังเชื่อมต่อห้องเกม...</div>;
  }

  return (
    <div className="screen active" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* HEADER */}
      <div className="app-header safe-area-top">
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={onExit}>🚪</button>
        <div className="header-logo">🃏 3 กอง กาญ</div>
        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>ห้อง: #{roomId} • อัตรา {room.rate} • รอบ {room.round || 0}</div>
      </div>

      {/* PERSISTENT GHOST CARD */}
      <div
        ref={ghostRef}
        className="poker-card"
        style={{
          position: 'fixed', left: 0, top: 0, display: 'none',
          pointerEvents: 'none', zIndex: 9999, opacity: 0.95,
          boxShadow: '0 14px 36px rgba(0,0,0,0.55)', willChange: 'transform', transition: 'none'
        }}
      >
        <span ref={ghostNumRef} className="card-num" style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1 }}></span>
        <span ref={ghostSuitRef} className="card-suit" style={{ fontSize: '26px', lineHeight: 1 }}></span>
      </div>

      {/* FLOATING EMOJIS */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
        {floatingEmojis.map(x => (
          <div key={x.id} className="table-emoji">
            <span style={{ fontSize: '18px', marginRight: '6px' }}>{x.avatar}</span>
            <span>{x.emoji}</span>
          </div>
        ))}
      </div>

      {/* LOBBY */}
      {room.status === 'lobby' && (
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--primary)', marginBottom: '8px' }}>⏳ ยินดีต้อนรับสู่ห้อง #{roomId}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>แชร์โค้ดห้องนี้ให้เพื่อนเพื่อเริ่มการต่อสู้ 3 กองสุดมัน!</p>
            <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '4px', margin: '14px 0' }}>{roomId}</div>
            <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.18)', padding: '12px', marginTop: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px' }}>👤 ผู้เล่นในห้อง ({players.length} คน)</div>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '4px 0' }}>
                  <span>{p.avatar || '🎴'}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {p.isHost && <span style={{ fontSize: '10px', background: 'rgba(212,175,55,0.2)', color: 'var(--primary)', padding: '1px 5px', borderRadius: '4px' }}>หัวห้อง</span>}
                  {p.ready && <span style={{ color: '#40e880', fontSize: '11px', fontWeight: '800' }}>✓ พร้อม</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!myId && <button className="btn-premium" style={{ width: '100%', padding: '12px' }} onClick={joinActive}>เข้าร่วมเป็นผู้เล่น</button>}
              {myId && !players.find(p => p.id === myId)?.ready && !isHost && <button className="btn-premium" style={{ width: '100%', padding: '12px' }} onClick={setReadyState}>✅ เตรียมตัวพร้อม!</button>}
              {isHost && players.filter(p => !p.isSpectator).length >= 2 && <button className="btn-premium" style={{ width: '100%', padding: '12px' }} onClick={handleHostStart}>🎮 เริ่มเกมแจกไพ่!</button>}
            </div>
          </div>
        </div>
      )}

      {/* PLAYING */}
      {room.status === 'playing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Felt Table */}
          <div className="table-felt">
            <div className="table-oval">
              <div className="table-logo-text">3 KONG KAN 2.0</div>
              {seats.map((s, idx) => {
                if (!s) return null;
                const submitted = (room.hands || {})[s.name]?.done;
                let posClass = 'felt-pos-top';
                if (idx === 1) posClass = 'felt-pos-left';
                if (idx === 3) posClass = 'felt-pos-right';
                return (
                  <div key={idx} className={`felt-player-box ${posClass}`}>
                    <div className="felt-av">{s.avatar || '🦊'}</div>
                    <div className="felt-nm">{s.name}</div>
                    <div className="felt-chips">🪙 {(room.scores || {})[s.id] || 0}</div>
                    {submitted && <span style={{ fontSize: '9px', background: 'rgba(50,232,117,0.2)', color: '#60e890', padding: '1px 5px', borderRadius: '4px', marginTop: '2px' }}>จัดเสร็จแล้ว</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* My Hand */}
          <div className="my-hand safe-area-bottom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '20px' }}>{player.avatar}</span>
                <b style={{ color: 'var(--primary)', fontSize: '15px' }}>{player.name}</b>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ชิป: {Math.round(myChips * 10) / 10}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ลากไพ่ทับกันเพื่อสลับ</span>
            </div>

            {/* 3 Drop Zones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>

              {/* FRONT (3) — บนสุด */}
              <div className="hand-pile-container">
                <span className="hand-pile-label">หน้า (3)</span>
                <div
                  data-zone="front"
                  className={`drop-zone ${selectedCard ? 'active-hover' : ''} ${hand.front.length === 3 ? 'pile-full' : ''}`}
                  onClick={() => moveCardTo('front')}
                >
                  {hand.front.map((c, i) => renderCard(c, i, 'front'))}
                  {hand.front.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', margin: 'auto' }}>ลาก/จิ้มเพื่อจัดกองหน้า</span>}
                </div>
                {hand.front.length === 3 && (
                  <span style={{ alignSelf: 'center', fontSize: '9px', background: 'var(--glass)', border: '1px solid var(--line)', padding: '2px 4px', borderRadius: '4px', color: 'var(--primary)' }}>
                    {evalHand(hand.front).name}
                  </span>
                )}
              </div>

              {/* MID (5) */}
              <div className="hand-pile-container">
                <span className="hand-pile-label">กลาง (5)</span>
                <div
                  data-zone="mid"
                  className={`drop-zone ${selectedCard ? 'active-hover' : ''} ${hand.mid.length === 5 ? 'pile-full' : ''}`}
                  onClick={() => moveCardTo('mid')}
                >
                  {hand.mid.map((c, i) => renderCard(c, i, 'mid'))}
                  {hand.mid.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', margin: 'auto' }}>ลาก/จิ้มเพื่อจัดกองกลาง</span>}
                </div>
                {hand.mid.length === 5 && (
                  <span style={{ alignSelf: 'center', fontSize: '9px', background: 'var(--glass)', border: '1px solid var(--line)', padding: '2px 4px', borderRadius: '4px', color: 'var(--primary)' }}>
                    {evalHand(hand.mid).name}
                  </span>
                )}
              </div>

              {/* BACK (5) — ล่างสุด */}
              <div className="hand-pile-container">
                <span className="hand-pile-label">หลัง (5)</span>
                <div
                  data-zone="back"
                  className={`drop-zone ${selectedCard ? 'active-hover' : ''} ${hand.back.length === 5 ? 'pile-full' : ''}`}
                  onClick={() => moveCardTo('back')}
                >
                  {hand.back.map((c, i) => renderCard(c, i, 'back'))}
                  {hand.back.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', margin: 'auto' }}>ลาก/จิ้มเพื่อจัดกองหลัง</span>}
                </div>
                {hand.back.length === 5 && (
                  <span style={{ alignSelf: 'center', fontSize: '9px', background: 'var(--glass)', border: '1px solid var(--line)', padding: '2px 4px', borderRadius: '4px', color: 'var(--primary)' }}>
                    {evalHand(hand.back).name}
                  </span>
                )}
              </div>
            </div>

            {/* UNPLACED */}
            <div style={{ marginBottom: '8px' }}>
              <div
                data-zone="unplaced"
                className="drop-zone"
                style={{ minHeight: '66px', display: 'flex', gap: '3px', flexWrap: 'wrap' }}
                onClick={() => moveCardTo('unplaced')}
              >
                {hand.unplaced.map((c, i) => renderCard(c, i, 'unplaced'))}
              </div>
            </div>

            {/* AI CARD LAB */}
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.15)', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '8px' }}>
                <span style={{ color: 'var(--primary)' }}>🧠 AI CARD LAB GAUGE</span>
                <select value={aiMode} onChange={e => setAiMode(e.target.value)} style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--primary)', borderRadius: '6px', fontSize: '11px', padding: '2px 6px', fontFamily: 'Kanit' }}>
                  <option value="balanced">Auto EV Mode</option>
                  <option value="safe">Safe Mode</option>
                  <option value="derby">Derby Mode</option>
                  <option value="dragon">Dragon Hunter</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', textAlign: 'center', marginBottom: '6px' }}>
                {cardLab.powers.map(x => (
                  <div key={x.key} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '5px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>{x.label} • {x.name}</span>
                    <b style={{ color: 'var(--primary)', fontSize: '15px' }}>{gradeFromPower(x.power)}</b>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '6px' }}>
                <span>ชนะ: <b>{cardLab.winProb}%</b></span>
                <span>ดาร์บี้: <b>{cardLab.derbyProb}%</b></span>
                <span>มังกร: <b>{cardLab.dragonProb}%</b></span>
              </div>
              <p style={{ fontSize: '11px', color: '#ffeab2', marginTop: '6px', fontStyle: 'italic' }}>{cardLab.hint}</p>
            </div>

            {/* BUTTONS */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={handleAutoArrange}><Sparkles size={14} style={{ marginRight: '3px' }} /> จัดให้</button>
              <button className="btn-secondary" style={{ padding: '10px', fontSize: '13px', fontWeight: '800', whiteSpace: 'nowrap' }} onClick={handleSwapMidBack} title="สลับไพ่กองกลาง ↔ กองหลัง">⇅ กลาง/หลัง</button>
              <button className="btn-secondary" style={{ padding: '10px' }} onClick={handleUndo}><Undo2 size={14} /></button>
              <button className="btn-secondary" style={{ padding: '10px' }} onClick={handleReset}><RotateCcw size={14} /></button>
              <button className="btn-premium" style={{ flex: 2, padding: '10px', fontSize: '15px' }} onClick={handleSubmitHand} disabled={hand.done}>
                {hand.done ? '✓ ส่งไพ่แล้ว' : '⚔️ ส่งไพ่สู้!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMOJI DOCK */}
      {room.status === 'playing' && (
        <div className="quick-emoji-row" style={{ position: 'static', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px', padding: '8px 10px', margin: '0 0 8px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px' }}>
          {['😂','😭','🔥','💸','🐉','👑','🎉'].map(emoji => (
            <button key={emoji} className="quick-emoji-btn" onClick={() => handleSendEmoji(emoji)}>{emoji}</button>
          ))}
        </div>
      )}

      {/* RESULTS */}
      {room.status === 'results' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#081708', padding: '14px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--primary)', textAlign: 'center', marginBottom: '14px' }}>🏆 ผลรวมรอบการเล่นนี้</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {calcScores(players.filter(p => !p.isSpectator), room.hands || {}).map((s, idx) => {
              const isWin = s.roundScore > 0;
              return (
                <div key={idx} className="glass-panel animate-pop-up" style={{ padding: '12px', borderLeft: '4px solid ' + (isWin ? '#40e880' : s.roundScore < 0 ? '#ff6d86' : 'var(--line)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px' }}>
                    <span>{s.avatar} {s.name}</span>
                    <span style={{ color: isWin ? '#40e880' : s.roundScore < 0 ? '#ff6d86' : '#fff' }}>{isWin ? '+' : ''}{s.roundScore}</span>
                  </div>
                  {s.bonusLabel && <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', marginTop: '4px' }}>🌟 โบนัสพิเศษ: {s.bonusLabel}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isHost && <button className="btn-premium" style={{ flex: 1, padding: '12px' }} onClick={handleNextRound}>▶ เริ่มรอบถัดไป</button>}
            <button className="btn-secondary" style={{ padding: '12px 20px' }} onClick={onExit}>ออกห้อง</button>
          </div>
        </div>
      )}

      {/* CHAT BUTTON */}
      <button className="btn-premium" style={{ position: 'fixed', bottom: '16px', right: '16px', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setChatOpen(!chatOpen)}>
        <MessageCircle size={20} />
      </button>

      {/* CHAT DRAWER */}
      {chatOpen && (
        <div style={{ position: 'fixed', inset: 'auto 0 0 0', zIndex: 200, display: 'flex', flexDirection: 'column', maxHeight: '50vh', background: '#1c1c28', borderTop: '2px solid var(--line)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '13px' }}>💬 แชทส่งข่าวกันร่วมโต๊ะ</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer' }} onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {chatList.map(msg => (
              <div key={msg.id} style={{ alignSelf: msg.name === player.name ? 'flex-end' : 'flex-start', background: msg.name === player.name ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: msg.name === player.name ? '#23180a' : '#fff', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%', fontSize: '13px' }}>
                <span style={{ fontSize: '10px', opacity: 0.6, display: 'block' }}>{msg.name}</span>
                {msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '6px', padding: '8px' }}>
            <input type="text" className="form-input" placeholder="พิมพ์ข้อความ..." value={chatMsg} onChange={e => setChatMsg(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-premium" style={{ padding: '8px 12px' }}><Send size={14} /></button>
          </form>
        </div>
      )}
    </div>
  );
}
