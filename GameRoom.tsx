import React, { useState, useEffect, useRef } from 'react';
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
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState('');
  const [isHost, setIsHost] = useState(false);
  
  // Player Hand Sorting State
  const [hand, setHand] = useState({ front: [], mid: [], back: [], unplaced: [], done: false, foul: false });
  const [selectedCard, setSelectedCard] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [aiMode, setAiMode] = useState('balanced');

  // Drag-and-drop State (free dragging)
  const [dragging, setDragging] = useState(null);   // card object being dragged
  const [ghost, setGhost] = useState(null);         // { x, y, card } floating ghost following finger
  const [hoverZone, setHoverZone] = useState(null); // zone currently hovered while dragging
  const dragInfo = useRef(null);                    // { startX, startY, moved, card }

  // Sound & Speech State
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [speechMuted, setSpeechMuted] = useState(false);
  const audioCtx = useRef(null);

  // Chat & Emoji State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatList, setChatList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState([]);

  // Subscriptions & Timers
  const unsubRoom = useRef(null);
  const unsubChat = useRef(null);

  // 1. Initialize Web Audio Engine
  function playSound(type = 'click') {
    if (soundVolume <= 0) return;
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      
      const soundMap = {
        click: [520, 0.05, 'triangle'],
        deal: [740, 0.08, 'square'],
        flip: [440, 0.09, 'triangle'],
        ready: [880, 0.12, 'sine'],
        talu: [190, 0.22, 'sawtooth'],
        derby: [330, 0.25, 'triangle'],
        dragon: [120, 0.35, 'sawtooth'],
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

  // 2. TTS Voice Announcements (Thai Female)
  function announce(text) {
    if (speechMuted) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  // 3. Connect to Firestore Room
  useEffect(() => {
    if (!roomId) return;
    
    // Subscribe to Room details
    unsubRoom.current = db.collection('rooms').doc(roomId).onSnapshot(async snap => {
      if (!snap.exists) {
        alert('ห้องนี้ถูกปิดแล้วครับ');
        onExit();
        return;
      }
      
      const d = snap.data();
      setRoom(d);
      
      // Determine myId from players mapping
      const pList = Object.entries(d.players || {}).map(([id, val]) => ({ id, ...val }));
      const me = pList.find(x => x.name === player.name);
      if (me) {
        setMyId(me.id);
        setIsHost(me.isHost || false);
      }
      
      setPlayers(pList);
      
      // Handle deal distribution
      if (d.status === 'playing' && me) {
        const myDeal = (d.deals || {})[me.id] || [];
        // If my unplaced area is empty and no piles are set, populate unplaced
        const submitted = (d.hands || {})[me.name] || (d.hands || {})[me.id];
        if (myDeal.length > 0 && !submitted && hand.unplaced.length === 0 && hand.front.length === 0 && hand.mid.length === 0 && hand.back.length === 0) {
          setHand({
            front: [],
            mid: [],
            back: [],
            unplaced: myDeal,
            done: false,
            foul: false
          });
          playSound('deal');
        }
      }
      
      // Floating quick emoji reactions trigger logic
      pList.forEach(p => {
        if (p.emojiReaction && p.name !== player.name) {
          triggerFloatingEmoji(p.avatar || '🎴', p.emojiReaction);
          // Clear reaction in Firestore
          db.collection('rooms').doc(roomId).update({
            [`players.${p.id}.emojiReaction`]: firebase.firestore.FieldValue.delete()
          }).catch(() => {});
        }
      });
    });

    // Subscribe to Chats
    unsubChat.current = db.collection('rooms').doc(roomId)
      .collection('chat')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setChatList(list);
        if (!chatOpen) {
          setUnreadCount(prev => prev + 1);
        }
      });

    return () => {
      if (unsubRoom.current) unsubRoom.current();
      if (unsubChat.current) unsubChat.current();
    };
  }, [roomId]);

  // Floating reaction effect
  function triggerFloatingEmoji(avatar, emoji) {
    const id = Math.random();
    setFloatingEmojis(prev => [...prev, { id, avatar, emoji }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(x => x.id !== id));
    }, 1500);
  }

  // 4. Presence Management: Join room, Spectate room, or Claim host
  async function joinActive() {
    if (!room) return;
    const tempId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const myCode = myId || tempId;
    
    // Check if room has host, else claim it
    const activeOpps = players.filter(p => !p.isSpectator && !p.isQueue);
    const hasHost = players.some(p => p.isHost);
    
    await db.collection('rooms').doc(roomId).update({
      [`players.${myCode}`]: {
        name: player.name,
        avatar: player.avatar,
        isSpectator: false,
        isQueue: false,
        isHost: !hasHost,
        ready: false
      }
    });
    setMyId(myCode);
  }

  async function setReadyState() {
    if (!myId) return;
    await db.collection('rooms').doc(roomId).update({
      [`players.${myId}.ready`]: true
    });
    playSound('ready');
  }

  async function handleHostStart() {
    // Generate secure deck
    const deck = [];
    const suits = ['♠','♥','♦','♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const valMap = {}; ranks.forEach((r, i) => valMap[r] = i + 2);
    
    for (const s of suits) {
      for (const r of ranks) {
        deck.push({ suit: s, rank: r, val: valMap[r] });
      }
    }
    
    // Shuffle
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Deal 13 cards to each player
    const active = players.filter(p => !p.isSpectator && !p.isQueue);
    const deals = {};
    active.forEach((p, idx) => {
      deals[p.id] = shuffled.slice(idx * 13, (idx + 1) * 13);
    });

    await db.collection('rooms').doc(roomId).update({
      status: 'playing',
      deals,
      hands: {},
      scores: {},
      round: (room.round || 0) + 1
    });
  }

  // 5. Card Arranger Handlers
  function pushUndo() {
    setUndoStack(prev => [...prev.slice(-19), {
      front: [...hand.front],
      mid: [...hand.mid],
      back: [...hand.back],
      unplaced: [...hand.unplaced]
    }]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setHand({
      ...hand,
      front: prev.front,
      mid: prev.mid,
      back: prev.back,
      unplaced: prev.unplaced
    });
    setUndoStack(prev => prev.slice(0, -1));
    playSound('click');
  }

  function handleReset() {
    pushUndo();
    setHand({
      front: [],
      mid: [],
      back: [],
      unplaced: [...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced],
      done: false,
      foul: false
    });
    playSound('click');
  }

  function selectCard(card) {
    if (selectedCard && selectedCard === card) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
      playSound('click');
    }
  }

  // Core: move a specific card to a target zone
  function moveCardToZone(card, targetZone) {
    pushUndo();

    const newHand = {
      front: hand.front.filter(c => c !== card),
      mid: hand.mid.filter(c => c !== card),
      back: hand.back.filter(c => c !== card),
      unplaced: hand.unplaced.filter(c => c !== card)
    };

    const limit = targetZone === 'front' ? 3 : targetZone === 'unplaced' ? 52 : 5;
    if (newHand[targetZone].length < limit) {
      newHand[targetZone] = [...newHand[targetZone], card];
      setHand({ ...hand, ...newHand });
      setSelectedCard(null);
    } else {
      alert('กองนี้เต็มแล้วครับ!');
    }
  }

  // Tap-to-move (fallback): move the currently selected card
  function moveCardTo(targetZone) {
    if (!selectedCard) return;
    moveCardToZone(selectedCard, targetZone);
    playSound('click');
  }

  // ── FREE DRAG: Pointer handlers (works on mobile touch + desktop mouse) ──
  function zoneFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const zoneEl = el.closest('[data-zone]');
    return zoneEl ? zoneEl.getAttribute('data-zone') : null;
  }

  function onCardPointerDown(e, card) {
    if (hand.done) return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    dragInfo.current = { startX: e.clientX, startY: e.clientY, moved: false, card };
    setDragging(card);
    setGhost({ x: e.clientX, y: e.clientY, card });
  }

  function onCardPointerMove(e) {
    if (!dragInfo.current) return;
    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragInfo.current.moved = true;
    setGhost(g => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    setHoverZone(zoneFromPoint(e.clientX, e.clientY));
  }

  function onCardPointerUp(e) {
    const info = dragInfo.current;
    dragInfo.current = null;
    setDragging(null);
    setGhost(null);
    setHoverZone(null);
    if (!info) return;

    if (info.moved) {
      // Real drag → drop into the zone under the finger
      const zone = zoneFromPoint(e.clientX, e.clientY);
      if (zone) {
        moveCardToZone(info.card, zone);
        playSound('flip');
      }
    } else {
      // Just a tap → toggle selection (keeps the tap-to-place flow)
      selectCard(info.card);
    }
  }

  // Reusable card renderer with drag handlers
  function renderCard(c, i) {
    const isRed = c.suit === '♥' || c.suit === '♦';
    return (
      <div
        key={i}
        className={`poker-card ${selectedCard === c ? 'glow-bonus' : ''} ${isRed ? 'red-card' : 'black-card'}`}
        onPointerDown={(e) => onCardPointerDown(e, c)}
        onPointerMove={onCardPointerMove}
        onPointerUp={onCardPointerUp}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          cursor: 'grab',
          opacity: dragging === c ? 0.3 : 1,
          transition: 'opacity 0.1s'
        }}
      >
        <span className="card-num">{c.rank}</span>
        <span className="card-suit">{c.suit}</span>
      </div>
    );
  }

  // Highlight style for a zone being hovered during drag
  function zoneHoverStyle(zoneName) {
    return hoverZone === zoneName
      ? { outline: '2px solid #40e880', background: 'rgba(64, 232, 128, 0.12)', borderRadius: '8px' }
      : undefined;
  }

  // AI Helpers
  function handleAutoArrange() {
    const all = [...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced];
    if (all.length < 13) return;
    
    pushUndo();
    const arranged = aiArrange(all, aiMode);
    setHand({
      front: arranged.front,
      mid: arranged.mid,
      back: arranged.back,
      unplaced: [],
      done: false,
      foul: false
    });
    playSound('ready');
  }

  function handleSuggest() {
    const all = [...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced];
    if (all.length < 13) return;
    
    const suggestion = aiArrange(all, aiMode);
    const before = aiAnalysis(hand, hand.unplaced, aiMode);
    
    pushUndo();
    setHand({
      front: suggestion.front,
      mid: suggestion.mid,
      back: suggestion.back,
      unplaced: [],
      done: false,
      foul: false
    });
    
    const after = aiAnalysis({
      front: suggestion.front,
      mid: suggestion.mid,
      back: suggestion.back
    }, [], aiMode);
    
    alert(`AI Suggestion (${aiMode === 'balanced' ? 'Auto EV' : aiMode})\n\nระดับพลังไพ่: ${before.winProb}% → ${after.winProb}%\nดาร์บี้: ${before.derbyProb}% → ${after.derbyProb}%\n\nเหตุผล: AI เลือกจัดวางกองให้สมดุลและปลอดภัยที่สุดตามทฤษฎี EV`);
    playSound('ready');
  }

  // Submitted arranged hands
  async function handleSubmitHand() {
    if (hand.front.length !== 3 || hand.mid.length !== 5 || hand.back.length !== 5) {
      alert('กรุณาจัดไพ่ให้ครบทั้ง 3 กอง (3-5-5) ก่อนส่งครับ');
      return;
    }
    
    const isFoul = !validArr(hand.front, hand.mid, hand.back);
    if (isFoul) {
      const confirmFoul = confirm('⚠️ ไพ่ของคุณฟาวล์อยู่ขณะนี้! ยืนยันการส่งไพ่แบบฟาวล์หรือไม่? (คนฟาวล์ต้องจ่ายให้ผู้เล่นอื่นคนละ 6 คะแนน)');
      if (!confirmFoul) return;
    }

    const payload = {
      front: hand.front,
      mid: hand.mid,
      back: hand.back,
      foul: isFoul,
      done: true
    };

    await db.collection('rooms').doc(roomId).update({
      [`hands.${player.name}`]: payload
    });
    setHand({ ...hand, done: true });
    playSound('ready');
  }

  // Dynamic Card lab updates
  const cardLab = aiAnalysis(hand, hand.unplaced, aiMode);

  // Chat sender
  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    
    await db.collection('rooms').doc(roomId).collection('chat').add({
      name: player.name,
      avatar: player.avatar,
      text: chatMsg.trim(),
      timestamp: Date.now()
    });
    setChatMsg('');
  }

  async function handleSendEmoji(emoji) {
    if (!myId) return;
    await db.collection('rooms').doc(roomId).update({
      [`players.${myId}.emojiReaction`]: emoji
    });
    triggerFloatingEmoji(player.avatar, emoji);
  }

  // Next round initializer
  async function handleNextRound() {
    await db.collection('rooms').doc(roomId).update({
      status: 'lobby',
      hands: {},
      deals: {},
      scores: {}
    });
  }

  // Render variables
  const activeOpponents = players.filter(p => !p.isSpectator && !p.isQueue);
  const seats = Array(4).fill(null).map((_, i) => activeOpponents[i]);
  const myChips = (room && (room.scores || {})[myId]) || 0;

  if (!room) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        กำลังเชื่อมต่อห้องเกม...
      </div>
    );
  }

  return (
    <div className="screen active" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div className="app-header safe-area-top">
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={onExit}>🚪</button>
        <div className="header-logo">🃏 3 กอง กาญ</div>
        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700' }}>
          ห้อง: #{roomId} • อัตรา {room.rate} • รอบ {room.round || 0}
        </div>
      </div>

      {/* FLOATING DRAG GHOST CARD (follows finger / mouse) */}
      {ghost && (
        <div
          className={`poker-card ${ghost.card.suit === '♥' || ghost.card.suit === '♦' ? 'red-card' : 'black-card'}`}
          style={{
            position: 'fixed',
            left: ghost.x,
            top: ghost.y,
            transform: 'translate(-50%, -55%) scale(1.12) rotate(-3deg)',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.97,
            boxShadow: '0 14px 36px rgba(0,0,0,0.55)'
          }}
        >
          <span className="card-num">{ghost.card.rank}</span>
          <span className="card-suit">{ghost.card.suit}</span>
        </div>
      )}

      {/* FLOATING QUICK EMOJI ANIMATIONS CONTAINER */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
        {floatingEmojis.map(x => (
          <div key={x.id} className="table-emoji">
            <span style={{ fontSize: '18px', marginRight: '6px' }}>{x.avatar}</span>
            <span>{x.emoji}</span>
          </div>
        ))}
      </div>

      {/* GAME LOBBY WAIT STATE */}
      {room.status === 'lobby' && (
        <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--primary)', marginBottom: '8px' }}>⏳ ยินดีต้อนรับสู่ห้อง #{roomId}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>แชร์โค้ดห้องนี้ให้เพื่อนเพื่อเริ่มการต่อสู้ 3 กองสุดมัน!</p>
            
            <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '4px', margin: '14px 0' }}>
              {roomId}
            </div>

            {/* Players presence */}
            <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.18)', padding: '12px', marginTop: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px' }}>👤 ผู้เล่นในห้อง ({players.length} คน)</div>
              {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '4px 0' }}>
                  <span>{p.avatar || '🎴'}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {p.isHost && <span style={{ fontSize: '10px', background: 'rgba(212, 175, 55, 0.2)', color: 'var(--primary)', padding: '1px 5px', borderRadius: '4px' }}>หัวห้อง</span>}
                  {p.ready && <span style={{ color: '#40e880', fontSize: '11px', fontWeight: '800' }}>✓ พร้อม</span>}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!myId && (
                <button className="btn-premium" style={{ width: '100%', padding: '12px' }} onClick={joinActive}>
                  เข้าร่วมเป็นผู้เล่น
                </button>
              )}
              
              {myId && !players.find(p => p.id === myId)?.ready && !isHost && (
                <button className="btn-premium" style={{ width: '100%', padding: '12px' }} onClick={setReadyState}>
                  ✅ เตรียมตัวพร้อม!
                </button>
              )}

              {isHost && players.filter(p => !p.isSpectator).length >= 2 && (
                <button className="btn-premium" style={{ width: '100%', padding: '12px' }} onClick={handleHostStart}>
                  🎮 เริ่มเกมแจกไพ่!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE CASINO FELT GAME BOARD */}
      {room.status === 'playing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Felt Table Top */}
          <div className="table-felt">
            <div className="table-oval">
              <div className="table-logo-text">3 KONG KAN 2.0</div>
              
              {/* Other players absolute seats */}
              {seats.map((s, idx) => {
                if (!s) return null;
                const isMe = s.name === player.name;
                const submitted = (room.hands || {})[s.name]?.done;
                
                // Seat layouts
                let posClass = 'felt-pos-top';
                if (idx === 1) posClass = 'felt-pos-left';
                if (idx === 3) posClass = 'felt-pos-right';

                return (
                  <div key={idx} className={`felt-player-box ${posClass}`}>
                    <div className="felt-av">{s.avatar || '🦊'}</div>
                    <div className="felt-nm">{s.name}</div>
                    <div className="felt-chips">🪙 {(room.scores || {})[s.id] || 0}</div>
                    {submitted && (
                      <span style={{ fontSize: '9px', background: 'rgba(50, 232, 117, 0.2)', color: '#60e890', padding: '1px 5px', borderRadius: '4px', marginTop: '2px' }}>
                        จัดเสร็จแล้ว
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player Hand Sorting Felt */}
          <div className="my-hand safe-area-bottom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '20px' }}>{player.avatar}</span>
                <b style={{ color: 'var(--primary)', fontSize: '15px' }}>{player.name}</b>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ชิป: {Math.round(myChips * 10) / 10}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ลากไพ่ไปวางในกอง หรือจิ้มเลือกแล้วจิ้มกอง</span>
            </div>

            {/* Drag-or-tap Piles zones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              <div className="hand-pile-container">
                <span className="hand-pile-label">หลัง (5)</span>
                <div 
                  data-zone="back"
                  className={`drop-zone ${selectedCard ? 'active-hover' : ''} ${hand.back.length === 5 ? 'pile-full' : ''}`}
                  onClick={() => moveCardTo('back')}
                  style={zoneHoverStyle('back')}
                >
                  {hand.back.map((c, i) => renderCard(c, i))}
                  {hand.back.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: 'auto' }}>ลาก/จิ้มเพื่อจัดกองหลัง</span>}
                </div>
                {hand.back.length === 5 && (
                  <span style={{ alignSelf: 'center', fontSize: '9px', background: 'var(--glass)', border: '1px solid var(--line)', padding: '2px 4px', borderRadius: '4px', color: 'var(--primary)' }}>
                    {evalHand(hand.back).name}
                  </span>
                )}
              </div>

              <div className="hand-pile-container">
                <span className="hand-pile-label">กลาง (5)</span>
                <div 
                  data-zone="mid"
                  className={`drop-zone ${selectedCard ? 'active-hover' : ''} ${hand.mid.length === 5 ? 'pile-full' : ''}`}
                  onClick={() => moveCardTo('mid')}
                  style={zoneHoverStyle('mid')}
                >
                  {hand.mid.map((c, i) => renderCard(c, i))}
                  {hand.mid.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: 'auto' }}>ลาก/จิ้มเพื่อจัดกองกลาง</span>}
                </div>
                {hand.mid.length === 5 && (
                  <span style={{ alignSelf: 'center', fontSize: '9px', background: 'var(--glass)', border: '1px solid var(--line)', padding: '2px 4px', borderRadius: '4px', color: 'var(--primary)' }}>
                    {evalHand(hand.mid).name}
                  </span>
                )}
              </div>

              <div className="hand-pile-container">
                <span className="hand-pile-label">หน้า (3)</span>
                <div 
                  data-zone="front"
                  className={`drop-zone ${selectedCard ? 'active-hover' : ''} ${hand.front.length === 3 ? 'pile-full' : ''}`}
                  onClick={() => moveCardTo('front')}
                  style={zoneHoverStyle('front')}
                >
                  {hand.front.map((c, i) => renderCard(c, i))}
                  {hand.front.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', alignSelf: 'center', margin: 'auto' }}>ลาก/จิ้มเพื่อจัดกองหน้า</span>}
                </div>
                {hand.front.length === 3 && (
                  <span style={{ alignSelf: 'center', fontSize: '9px', background: 'var(--glass)', border: '1px solid var(--line)', padding: '2px 4px', borderRadius: '4px', color: 'var(--primary)' }}>
                    {evalHand(hand.front).name}
                  </span>
                )}
              </div>
            </div>

            {/* Unplaced cards pool area */}
            <div style={{ marginBottom: '8px' }}>
              <div 
                data-zone="unplaced"
                className="drop-zone" 
                style={{ minHeight: '66px', display: 'flex', gap: '3px', ...(zoneHoverStyle('unplaced') || {}) }}
                onClick={() => moveCardTo('unplaced')}
              >
                {hand.unplaced.map((c, i) => renderCard(c, i))}
              </div>
            </div>

            {/* AI CARD LAB GAUGE PANEL */}
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.15)', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '8px' }}>
                <span style={{ color: 'var(--primary)' }}>🧠 AI CARD LAB GAUGE</span>
                <select
                  value={aiMode}
                  onChange={e => setAiMode(e.target.value)}
                  style={{
                    background: 'var(--glass)',
                    border: '1px solid var(--line)',
                    color: 'var(--primary)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    padding: '2px 6px',
                    fontFamily: 'Kanit'
                  }}
                >
                  <option value="balanced">Auto EV Mode</option>
                  <option value="safe">Safe Mode</option>
                  <option value="derby">Derby Mode</option>
                  <option value="dragon">Dragon Hunter</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>

              {/* EV Gauges */}
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

              <p style={{ fontSize: '11px', color: '#ffeab2', marginTop: '6px', fontStyle: 'italic' }}>
                {cardLab.hint}
              </p>
            </div>

            {/* Action buttons footer */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={handleAutoArrange}>
                <Sparkles size={14} style={{ marginRight: '3px' }} /> Auto Arr
              </button>
              <button className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={handleSuggest}>
                Suggest
              </button>
              <button className="btn-secondary" style={{ padding: '10px' }} onClick={handleUndo}>
                <Undo2 size={14} />
              </button>
              <button className="btn-secondary" style={{ padding: '10px' }} onClick={handleReset}>
                <RotateCcw size={14} />
              </button>
              <button 
                className="btn-premium" 
                style={{ flex: 2, padding: '10px', fontSize: '15px' }} 
                onClick={handleSubmitHand}
                disabled={hand.done}
              >
                {hand.done ? '✓ ส่งไพ่แล้ว' : '⚔️ ส่งไพ่สู้!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK EMOJI FLOATING DOCK */}
      {room.status === 'playing' && (
        <div className="quick-emoji-row">
          {['😂', '😭', '🔥', '💸', '🐉', '👑', '🎉'].map(emoji => (
            <button key={emoji} className="quick-emoji-btn" onClick={() => handleSendEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* BATTLE OPEN SHOWDOWN VIEW */}
      {room.status === 'results' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#081708', padding: '14px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--primary)', textAlign: 'center', marginBottom: '14px' }}>🏆 ผลรวมรอบการเล่นนี้</h2>
          
          {/* Results compiler */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {calcScores(players.filter(p => !p.isSpectator), room.hands || {}).map((s, idx) => {
              const isWin = s.roundScore > 0;
              return (
                <div key={idx} className="glass-panel animate-pop-up" style={{ padding: '12px', borderLeft: '4px solid ' + (isWin ? '#40e880' : s.roundScore < 0 ? '#ff6d86' : 'var(--line)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px' }}>
                    <span>{s.avatar} {s.name}</span>
                    <span style={{ color: isWin ? '#40e880' : s.roundScore < 0 ? '#ff6d86' : '#fff' }}>
                      {isWin ? '+' : ''}{s.roundScore}
                    </span>
                  </div>
                  {s.bonusLabel && (
                    <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', marginTop: '4px' }}>
                      🌟 โบนัสพิเศษ: {s.bonusLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {isHost && (
              <button className="btn-premium" style={{ flex: 1, padding: '12px' }} onClick={handleNextRound}>
                ▶ เริ่มรอบถัดไป
              </button>
            )}
            <button className="btn-secondary" style={{ padding: '12px 20px' }} onClick={onExit}>
              ออกห้อง
            </button>
          </div>
        </div>
      )}

      {/* REAL-TIME COLLAPSIBLE CHAT DRAWER */}
      <button 
        className="btn-premium" 
        style={{ position: 'fixed', bottom: '16px', right: '16px', width: '48px', height: '48px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100 }}
        onClick={() => setChatOpen(!chatOpen)}
      >
        <MessageCircle size={20} />
      </button>

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
            <input 
              type="text" 
              className="form-input" 
              placeholder="พิมพ์ข้อความ..." 
              value={chatMsg} 
              onChange={e => setChatMsg(e.target.value)} 
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-premium" style={{ padding: '8px 12px' }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
