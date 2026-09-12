import {useEvent} from '../hooks/useEvent.js';
import React, { useState, useEffect, useRef } from 'react';
import GameRoomView from './game/GameRoomView.jsx';
import FoulConfirmation from './game/FoulConfirmation.jsx';
import { db, firebase, call } from '../online.js';
import {handsByPlayerName} from '../utils/roomSnapshot.js';
import {subscribeRoom} from '../room-stream.js';
import {
  validArr,
  buildMatchups,
  SUIT_RANK
} from '../utils/ruleEngine.js';
import { aiArrange } from '../utils/aiEngine.js';


 
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
  const [aiMode]             = useState('balanced');
 
  // Keep a live ref to hand so the drag handlers (attached to document) always
  // read the freshest hand without re-subscribing.
  const handRef = useRef(hand);
  useEffect(() => { handRef.current = hand; }, [hand]);

  const roomDataRef = useRef(null);
  useEffect(() => { roomDataRef.current = room; }, [room]);
 
  // Drag ghost refs
  const ghostRef     = useRef(null);
  const ghostNumRef  = useRef(null);
  const ghostSuitRef = useRef(null);
 
  // Sound & Speech
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [speechMuted, setSpeechMuted] = useState(false);
  const audioCtx = useRef(null);
 
  // Live chip balance for the current member (header display)
  const [myChips, setMyChips] = useState(player?.chips || 0);
 
  // Chat & Emoji
  const [chatOpen, setChatOpen]       = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [chatMsg, setChatMsg]         = useState('');
  const [chatList, setChatList]       = useState([]);
  const [, setUnreadCount] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
 
  // Subscriptions
  const unsubRoom = useRef(null);
  const unsubChat = useRef(null);
  const initializedRoundRef = useRef(0);
  const prevStatusRef = useRef('');
  const settlingRef = useRef(false);
  const pendingSubmission=useRef(false);

  const [connectionError,setConnectionError]=useState('');
  const [streamAttempt,setStreamAttempt]=useState(0);
  const seenEmoji=useRef({});
  const roomAction=useEvent(async (action,extra={}) => {
    const result=await call('gameAction',{roomId,round:roomDataRef.current?.round||0,action,...extra});
    setConnectionError('');return result;
  });
  async function safeAction(action,extra) {
    try{return await roomAction(action,extra);}catch(e){setConnectionError(e.message||'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');return null;}
  }
  useEffect(()=>{
    if(!roomId||!myId)return;
    let pending=false;
    const beat=async()=>{if(pending)return;pending=true;try{await roomAction('heartbeat');}catch(e){setConnectionError(e.message);}finally{pending=false;}};
    beat();const timer=setInterval(beat,20000);return ()=>clearInterval(timer);
  },[roomId,myId,roomAction]);
  useEffect(()=>{
    const offline=()=>setConnectionError('ขาดการเชื่อมต่อ กำลังรออินเทอร์เน็ต');
    const online=()=>setStreamAttempt(x=>x+1);
    window.addEventListener('offline',offline);window.addEventListener('online',online);
    return ()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',online);};
  },[]);
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
 
  // ── dropCard: exact card swap, index-preserving, bump-when-full ──
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
      const toArr = toZone === 'unplaced' ? h.unplaced : h[toZone];
      const card = fromArr[fromIdx];
      if (!card) return prev;
 
      // dropped directly onto a card in the target → swap those two, keep positions
      if (toIdx !== undefined && toIdx >= 0 && toIdx < toArr.length) {
        const target = toArr[toIdx];
        if (target && target !== card) {
          if (fromZone === toZone) {
            fromArr[fromIdx] = target;
            fromArr[toIdx] = card;
          } else {
            fromArr[fromIdx] = target;
            toArr[toIdx] = card;
          }
          autoFillInto(h);
          return h;
        }
      }
 
      // target full → push its last card back into the source slot
      if (fromZone !== toZone) {
        if (toZone !== 'unplaced' && h[toZone].length >= MAX[toZone]) {
          const d = h[toZone].pop();
          fromArr.splice(fromIdx, 1);
          h[toZone].push(card);
          fromArr.splice(fromIdx, 0, d);
        } else {
          fromArr.splice(fromIdx, 1);
          toArr.push(card);
        }
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
 
      const toIdx = (cardEl && cardEl.dataset.source === toZone)
        ? parseInt(cardEl.dataset.idx, 10)
        : undefined;

      if (!moved) {                                  // tap → toggle select / swap click
        setSelectedCard(prev => {
          if (prev && prev !== card) {
            let prevZone = null, prevIdx = -1;
            for (const k of ['front', 'mid', 'back', 'unplaced']) {
              const pIdx = handRef.current[k].indexOf(prev);
              if (pIdx >= 0) { prevZone = k; prevIdx = pIdx; break; }
            }
            if (prevZone !== null) {
              setUndoStack(u => [...u.slice(-19), {
                front: [...handRef.current.front], mid: [...handRef.current.mid], back: [...handRef.current.back], unplaced: [...handRef.current.unplaced]
              }]);
              dropCard(prevZone, prevIdx, zone, idx);
              playSound('flip');
            }
            return null;
          }
          return prev === card ? null : card;
        });
        playSound('click');
        return;
      }
      if (!toZone || (toZone === zone && toIdx === idx)) return;        // no valid / same zone and same card
 
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
        <span className="card-num" style={{ fontSize: '25px', fontWeight: 900, lineHeight: 1 }}>{c.rank}</span>
        <span className="card-suit" style={{ fontSize: '26px', lineHeight: 1 }}>{c.suit}</span>
      </div>
    );
  }
 
  // 1. Web Audio
  const playSound=useEvent((type = 'click') => {
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
    } catch (e) { /* Audio is optional when the browser has not unlocked playback. */ }
  });
 
  // 2. TTS
  const announce=useEvent(text => {
    if (speechMuted) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'th-TH'; u.rate = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* Audio is optional when the browser has not unlocked playback. */ }
  });
 
  // 3. Firestore subscriptions
  const receiveRoom=useEvent(async snap => {
      if (!snap.exists || snap.data()?.status==='closed') {
        const latestRoom = roomDataRef.current;
        if (latestRoom && latestRoom.maxRounds && latestRoom.round >= latestRoom.maxRounds) {
          alert(`เกมเล่นครบ ${latestRoom.maxRounds} รอบแล้ว ระบบได้ปิดห้องนี้ลงแล้วครับ`);
        } else {
          alert('ห้องนี้ถูกปิดแล้วครับ');
        }
        onExit();
        return;
      }
      const d = snap.data();

      const oldStatus = prevStatusRef.current;
      prevStatusRef.current = d.status || '';

      if (oldStatus === 'playing' && d.status === 'results') {
        const activePlayers = Object.entries(d.players || {})
          .map(([id, val]) => ({ id, ...val }))
          .filter(p => !p.isSpectator && !p.isQueue && d.deals && d.deals[p.id]);
        
        const hasDragonHand = (cardsObj) => {
          if (!cardsObj) return false;
          const all = [...(cardsObj.front || []), ...(cardsObj.mid || []), ...(cardsObj.back || [])];
          return all.length === 13 && new Set(all.map(c => c.val)).size === 13;
        };
        const dragonUser = activePlayers.find(p => hasDragonHand((d.hands || {})[p.id]));

        if (dragonUser) {
          playSound('dragon');
          announce(`ไพ่มังกร! คุณ ${dragonUser.name} ได้ไพ่มังกร ชนะทุกคนรอบวงครับ! 🐉`);
        } else {
          const matchups = buildMatchups(activePlayers, handsByPlayerName(activePlayers,d.hands || {}));
          const hasTalu = matchups.some(m => m.talu);
          
          if (hasTalu) {
            playSound('talu');
            const winnerNames = matchups.filter(m => m.talu).map(m => m.taluWinner.name);
            const distinctWinnerNames = Array.from(new Set(winnerNames));
            announce(`กินทะลุ! ${distinctWinnerNames.join(' และ ')} กินทะลุครับ!`);
          } else {
            playSound('victory');
          }
        }
      }

      roomDataRef.current=d;
      setRoom(d);
      const pList = Object.entries(d.players || {}).map(([id, val]) => ({ id, ...val }));
      const me = pList.find(x => x.id === memberId);
      
      if (myId && !me) {
        alert('คุณถูกเตะออกจากห้อง หรือห้องนี้ถูกปิดแล้วครับ');
        onExit();
        return;
      }

      if (me) { 
        setMyId(me.id); 
        setIsHost(me.isHost || false); 
      } else {
        setMyId('');
        setIsHost(false);
      }
      setPlayers(pList);
 
      if (d.status === 'playing' && me) {
        const myDeal = Array.isArray(d.deals?.[me.id]) ? d.deals[me.id] : [];
        const currentRound = d.round || 0;
        const submitted = (d.hands || {})[me.id] || (d.hands || {})[me.name];
        
        // Populate unplaced cards only once per round
        if (myDeal.length > 0 && !submitted && initializedRoundRef.current !== currentRound) {
          const sortedDeal = [...myDeal].sort((a, b) => {
            if (a.val !== b.val) return a.val - b.val;
            return (SUIT_RANK[a.suit] || 0) - (SUIT_RANK[b.suit] || 0);
          });
          setHand({ front: [], mid: [], back: [], unplaced: sortedDeal, done: false, foul: false });
          initializedRoundRef.current = currentRound;
          playSound('deal');
          
          if (new Set(sortedDeal.map(c => c.val)).size === 13) {
            playSound('dragon');
            announce('คุณได้ไพ่มังกรครับ! ยินดีด้วยครับ! 🐉');
          }
        } else if (submitted?.front && !pendingSubmission.current && (!handRef.current.done || initializedRoundRef.current !== currentRound)) {
          setHand({
            front: submitted.front || [],
            mid: submitted.mid || [],
            back: submitted.back || [],
            unplaced: [],
            done: true,
            foul: submitted.foul || false
          });
          initializedRoundRef.current = currentRound;
        } else if(!submitted && !pendingSubmission.current && handRef.current.done && initializedRoundRef.current===currentRound){
          setHand(prev=>({...prev,done:false}));
        }
        
        const activeP = pList.filter(p => !p.isSpectator && !p.isQueue);
        // hands are stored by memberId (p.id)
        const allDone = activeP.length >= 2 && activeP.every(p => {
          const h = d.hands || {};
          return h[p.id]?.done || h[p.name]?.done;
        });
        if (allDone && d.status === 'playing' && d.settledRound !== d.round && !settlingRef.current) {
          settleScores();
        }
      }
 
      pList.forEach(p=>{
        if(p.emojiReaction&&p.name!==player.name&&seenEmoji.current[p.id]!==p.emojiAt){
          seenEmoji.current[p.id]=p.emojiAt;triggerFloatingEmoji(p.avatar||'🎴',p.emojiReaction);
        }
      });
  });
  const receiveChat=useEvent(snap=>{
    const list=[];snap.forEach(doc=>list.push({id:doc.id,...doc.data()}));
    setChatList(list);if(!chatOpen)setUnreadCount(prev=>prev+1);
  });
  useEffect(()=>{
    if(!roomId)return;
    unsubRoom.current=subscribeRoom(roomId,memberId,receiveRoom,e=>setConnectionError(e.message||'เชื่อมต่อห้องไม่สำเร็จ'));
    unsubChat.current = db.collection('rooms').doc(roomId)
      .collection('chat').orderBy('timestamp', 'asc').limit(50)
      .onSnapshot(receiveChat,e=>setConnectionError(e.message));
    return () => {
      if (unsubRoom.current) unsubRoom.current();
      if (unsubChat.current) unsubChat.current();
    };
  }, [roomId,memberId,streamAttempt,receiveRoom,receiveChat]);

  useEffect(()=>{
    if(!historyOpen||!roomId)return;
    return db.collection('rooms').doc(roomId).collection('rounds').orderBy('round','desc').limit(100).onSnapshot(s=>{
      setHistoryList(s.docs.map(d=>d.data()).reverse());
    },e=>setConnectionError(e.message));
  },[historyOpen,roomId]);

  function triggerFloatingEmoji(avatar, emoji) {
    const id = Math.random();
    setFloatingEmojis(prev => [...prev, { id, avatar, emoji }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(x => x.id !== id)), 1500);
  }
 
  useEffect(()=>{
    if(!memberId)return;
    return db.collection('members').doc(memberId).onSnapshot(s=>{if(s.exists)setMyChips(s.data().chips||0);},e=>setConnectionError(e.message));
  },[memberId]);
  const settleScores=useEvent(async () => {
    if(settlingRef.current)return;
    settlingRef.current=true;
    try{await roomAction('settle');}catch(e){setConnectionError(e.message);}finally{settlingRef.current=false;}
  });
  async function joinActive(){await safeAction('join');}
  async function setReadyState(){if(await safeAction('ready'))playSound('ready');}
  async function handleHostStart(){await safeAction('deal');}

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
    if (new Set(all.map(c => c.val)).size === 13) {
      setHand({ front: all.slice(0, 3), mid: all.slice(3, 8), back: all.slice(8, 13), unplaced: [], done: false, foul: false });
      playSound('ready');
      return;
    }
    const arranged = aiArrange(all, aiMode);
    setHand({ front: arranged.front, mid: arranged.mid, back: arranged.back, unplaced: [], done: false, foul: false });
    playSound('ready');
  }
 
  const [confirmFoul, setConfirmFoul] = useState(false);
  async function handleSubmitHand(foulConfirmed = false) {
    if (hand.done || pendingSubmission.current || room?.status !== 'playing') { setConfirmFoul(false); return; }
    if (hand.front.length !== 3 || hand.mid.length !== 5 || hand.back.length !== 5) {
      alert('กรุณาจัดไพ่ให้ครบทั้ง 3 กอง (3-5-5) ก่อนส่งครับ'); return;
    }
    const isFoul = !validArr(hand.front, hand.mid, hand.back);
    if (isFoul && foulConfirmed !== true) { setConfirmFoul(true); return; }
    setConfirmFoul(false);
    // Optimistic UI Update: Lock cards and play sound immediately for instant feel
    if(pendingSubmission.current)return;
    pendingSubmission.current=true;
    setHand(prev => ({ ...prev, done: true }));
    playSound('ready');

    try {
      await roomAction('submit',{front:hand.front,mid:hand.mid,back:hand.back});
    } catch (e) {
      // Revert state if update fails
      setHand(prev => ({ ...prev, done: false }));
      console.error('handleSubmitHand error:', e);
      alert('ส่งไพ่ไม่สำเร็จ: ' + e.message);
    } finally {pendingSubmission.current=false;}
  }

  async function handleCancelSubmit() {
    if (room.status !== 'playing') {
      alert('ไม่สามารถดึงไพ่กลับได้แล้วเนื่องจากเกมสรุปผลแล้วครับ');
      return;
    }
    if(pendingSubmission.current)return;
    pendingSubmission.current=true;
    setHand(prev => ({ ...prev, done: false }));
    playSound('click');

    try {
      await roomAction('cancel');
    } catch (e) {
      setHand(prev => ({ ...prev, done: true }));
      console.error('handleCancelSubmit error:', e);
      alert('ดึงไพ่กลับไม่สำเร็จ: ' + e.message);
    } finally {pendingSubmission.current=false;}
  }
 
  // Memoized AI analysis → recomputes ONLY when hand or mode changes
 
 
  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    try {
      await db.collection('rooms').doc(roomId).collection('chat').add({uid:memberId,name:player.name,avatar:player.avatar,text:chatMsg.trim().slice(0,200),timestamp:firebase.firestore.FieldValue.serverTimestamp()});
      setChatMsg('');
    }catch(e){setConnectionError(e.message);}
  }
  
  async function handleExitRoom() {
    if(room?.status==='playing'&&myId){
      if(!confirm('ออกจากห้องชั่วคราว? ไพ่และตำแหน่งจะเก็บไว้ให้กลับมาเล่นต่อ'))return;
      onExit();return;
    }
    if(!myId||await safeAction('leave'))onExit();
  }
  async function handleSendEmoji(emoji){if(await safeAction('emoji',{emoji}))triggerFloatingEmoji(player.avatar,emoji);}
  async function handleNextRound(){await safeAction('next');}
  async function handleCloseRoom(){if(confirm('ปิดห้องนี้เมื่อจบเกม?')){if(await safeAction('close'))onExit();}}

  const opponents = players.filter(p => !p.isSpectator && !p.isQueue && p.id !== myId && p.name !== player.name);
  let seats = [];
  if (opponents.length === 1) {
    seats = [
      { player: opponents[0], pos: 'felt-pos-top' }
    ];
  } else if (opponents.length === 2) {
    seats = [
      { player: opponents[0], pos: 'felt-pos-left' },
      { player: opponents[1], pos: 'felt-pos-right' }
    ];
  } else if (opponents.length >= 3) {
    seats = [
      { player: opponents[0], pos: 'felt-pos-left' },
      { player: opponents[1], pos: 'felt-pos-top' },
      { player: opponents[2], pos: 'felt-pos-right' }
    ];
  }
 
  if (!room) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>{connectionError||'กำลังเชื่อมต่อห้องเกม...'}{connectionError&&<button onClick={()=>setStreamAttempt(x=>x+1)}>ลองอีกครั้ง</button>}</div>;
  }
 
  return <>{confirmFoul && <FoulConfirmation onCancel={()=>setConfirmFoul(false)} onConfirm={()=>handleSubmitHand(true)}/>}<div role="status" className="online-status">{connectionError&&<span>{connectionError} <button onClick={()=>{setStreamAttempt(x=>x+1);if(myId&&room.status==='playing')settleScores();}}>ลองเชื่อมต่ออีกครั้ง</button></span>}</div><GameRoomView {...{room,players,myId,isHost,hand,selectedCard,ghostRef,ghostNumRef,ghostSuitRef,floatingEmojis,player,roomId,handleExitRoom,setHistoryOpen,joinActive,setReadyState,handleHostStart,seats,renderCard,myChips,moveCardTo,handleSwapMidBack,handleAutoArrange,handleUndo,handleReset,handleSubmitHand,handleCancelSubmit,handleSendEmoji,handleCloseRoom,handleNextRound,chatOpen,setChatOpen,chatList,chatMsg,setChatMsg,handleSendChat,historyOpen,historyList,undoStack,soundVolume,setSoundVolume,speechMuted,setSpeechMuted}}/></>;
}
