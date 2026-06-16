import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, firebase } from '../App.jsx';
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

const CHIP_MULT = 35;
 
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
 
  // Subscriptions
  const unsubRoom = useRef(null);
  const unsubChat = useRef(null);
  const initializedRoundRef = useRef(0);
  const prevStatusRef = useRef('');
  const settlingRef = useRef(false);
 
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
      if (!snap.exists) {
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
          const matchups = buildMatchups(activePlayers, d.hands || {});
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
        const myDeal = (d.deals || {})[me.id] || [];
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
        } else if (submitted && initializedRoundRef.current !== currentRound) {
          setHand({
            front: submitted.front || [],
            mid: submitted.mid || [],
            back: submitted.back || [],
            unplaced: [],
            done: true,
            foul: submitted.foul || false
          });
          initializedRoundRef.current = currentRound;
        }
        
        const activeP = pList.filter(p => !p.isSpectator && !p.isQueue);
        // hands are stored by memberId (p.id)
        const allDone = activeP.length >= 2 && activeP.every(p => {
          const h = d.hands || {};
          return h[p.id]?.done || h[p.name]?.done;
        });
        if (allDone && d.status === 'playing' && d.settledRound !== d.round && !settlingRef.current) {
          if (me.isHost) {
            settleScores();
          }
        }
      }
 
      pList.forEach(p => {
        if (p.emojiReaction && p.name !== player.name) {
          triggerFloatingEmoji(p.avatar || '🎴', p.emojiReaction);
          // Clear emoji after showing (safe key: memberId format has no dots)
          const emojiUpdate = {};
          emojiUpdate[`players.${p.id}.emojiReaction`] = firebase.firestore.FieldValue.delete();
          db.collection('rooms').doc(roomId).update(emojiUpdate).catch(() => {});
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

  // Subscribe to separate roundHistory details document when history panel is open
  useEffect(() => {
    if (!historyOpen || !roomId) return;
    
    const historyRef = db.collection('rooms').doc(roomId).collection('history').doc('details');
    const unsubscribe = historyRef.onSnapshot(snap => {
      if (snap.exists()) {
        setHistoryList(snap.data().roundHistory || []);
      } else {
        // Fallback to room.roundHistory if separate document doesn't exist yet
        setHistoryList(room?.roundHistory || []);
      }
    }, err => {
      console.error("Error listening to history details:", err);
      setHistoryList(room?.roundHistory || []);
    });
    
    return () => unsubscribe();
  }, [historyOpen, roomId, room?.roundHistory]);

  // Auto-migration of roundHistory to separate document to prevent room document bloat/slowdown
  useEffect(() => {
    if (!room || !room.roundHistory || room.roundHistory.length === 0 || !isHost) return;
    
    const migrateHistory = async () => {
      const roomRef = db.collection('rooms').doc(roomId);
      const historyRef = roomRef.collection('history').doc('details');
      
      try {
        console.log(`Migrating ${room.roundHistory.length} rounds of history to separate document...`);
        // Save to separate document
        await historyRef.set({
          roundHistory: room.roundHistory
        }, { merge: true });
        
        // Remove from main room document
        await roomRef.update({
          roundHistory: firebase.firestore.FieldValue.delete()
        });
        console.log("Migration of roundHistory completed successfully!");
      } catch (err) {
        console.error("Failed to migrate roundHistory:", err);
      }
    };
    
    migrateHistory();
  }, [room?.roundHistory, roomId, isHost]);

  function triggerFloatingEmoji(avatar, emoji) {
    const id = Math.random();
    setFloatingEmojis(prev => [...prev, { id, avatar, emoji }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(x => x.id !== id)), 1500);
  }
 
  // Live chip balance subscription for header
  useEffect(() => {
    if (!memberId) return;
    const unsub = db.collection('members').doc(memberId).onSnapshot(
      s => {
        if (s.exists) {
          const newChips = s.data().chips || 0;
          setMyChips(newChips);
          
          // Sync chips to room.players so other players see the correct value
          const roomRef = db.collection('rooms').doc(roomId);
          roomRef.get().then(snap => {
            if (snap.exists) {
              const rData = snap.data();
              if (rData.players && rData.players[memberId]) {
                if (rData.players[memberId].chips !== newChips) {
                  const u = {};
                  u[`players.${memberId}.chips`] = newChips;
                  roomRef.update(u).catch(() => {});
                }
              }
            }
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [memberId, roomId]);

  // Keep my chips in the room document in sync with my actual chips from the member document
  useEffect(() => {
    if (!roomId || !memberId || !room || !room.players || !room.players[memberId]) return;
    const roomChips = room.players[memberId].chips || 0;
    if (roomChips !== myChips) {
      const u = {};
      u[`players.${memberId}.chips`] = myChips;
      db.collection('rooms').doc(roomId).update(u).catch(() => {});
    }
  }, [roomId, memberId, room, myChips]);
 
  // ── Settle round: compute scores + update chips (host only, non-transactional for speed) ──
  async function settleScores() {
    if (settlingRef.current) return;
    settlingRef.current = true;
    const roomRef = db.collection('rooms').doc(roomId);
    try {
      // 1. Read room data (single read, no transaction)
      const roomSnap = await roomRef.get();
      if (!roomSnap.exists) return;
      const fd = roomSnap.data();
      if (fd.status !== 'playing') return;
      if (fd.settledRound === fd.round) return;

      const playingP = Object.entries(fd.players || {})
        .map(([id, v]) => ({ id, ...v }))
        .filter(p => !p.isSpectator && !p.isQueue);

      if (playingP.length < 2) return;
      if (!playingP.every(p => {
        const h = fd.hands || {};
        return h[p.id]?.done || h[p.name]?.done;
      })) return;

      // 2. Calculate scores (pure computation, instant)
      const scores = calcScores(playingP, fd.hands || {});
      const newScores = { ...(fd.scores || {}) };
      const rate = fd.rate || 1;
      const commissionPercent = fd.commission || 0;

      // Pre-compute net chip amounts per player (no member reads needed)
      const playerAmounts = {};
      for (const p of playingP) {
        const sc = scores.find(s => s.name === p.name);
        const pts = sc?.roundScore || 0;
        const grossChips = pts * rate;
        let commDeducted = 0;
        if (grossChips > 0 && commissionPercent > 0) {
          commDeducted = grossChips * (commissionPercent / 100);
        }
        playerAmounts[p.id] = Math.round((grossChips - commDeducted) * 100) / 100;
        newScores[p.id] = Math.round(((fd.scores?.[p.id] || 0) + playerAmounts[p.id]) * 100) / 100;
      }

      const roundSummary = {
        round: fd.round,
        hands: fd.hands,
        scores: scores.map(s => ({
          id: s.id,
          name: s.name,
          avatar: s.avatar || '🎴',
          roundScore: s.roundScore,
          bonusLabel: s.bonusLabel || ''
        })),
        timestamp: Date.now()
      };

      // 3. IMMEDIATELY update room to 'results' → instant UI transition for all players
      await roomRef.update({
        scores: newScores,
        status: 'results',
        settledRound: fd.round
      });

      // Write roundSummary to the separate history details document to prevent room document bloat
      const historyRef = roomRef.collection('history').doc('details');
      try {
        await historyRef.set({
          roundHistory: firebase.firestore.FieldValue.arrayUnion(roundSummary)
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save history in separate doc, falling back to main doc:", err);
        await roomRef.update({
          roundHistory: firebase.firestore.FieldValue.arrayUnion(roundSummary)
        });
      }

      // 4. Read all member docs in PARALLEL (much faster than sequential)
      const memberSnapsList = await Promise.all(
        playingP.map(p => db.collection('members').doc(p.id).get())
      );

      // 5. Build batch write for all member updates
      const batch = db.batch();
      const roomChipsUpdates = {};
      playingP.forEach((p, idx) => {
        const mSnap = memberSnapsList[idx];
        const amt = playerAmounts[p.id];

        let currentLevel = 1, currentXp = 0, currentGames = 0, currentWins = 0;
        let currentTotalProfit = 0, currentDerbyCount = 0, currentDragonCount = 0, currentTaluCount = 0;
        let cur = 0;

        if (mSnap && mSnap.exists) {
          const mData = mSnap.data();
          cur = mData.chips || 0;
          currentLevel = mData.level || 1;
          currentXp = mData.xp || 0;
          currentGames = mData.games || 0;
          currentWins = mData.wins || 0;
          currentTotalProfit = mData.totalProfit || 0;
          currentDerbyCount = mData.derbyCount || 0;
          currentDragonCount = mData.dragonCount || 0;
          currentTaluCount = mData.taluCount || 0;
        }

        const finalChips = Math.round((cur + amt) * 100) / 100;
        const finalGames = currentGames + 1;
        const earnedWins = amt > 0 ? 1 : 0;
        const finalWins = currentWins + earnedWins;
        const finalWinRate = Math.round((finalWins / finalGames) * 100);
        const finalTotalProfit = Math.round((currentTotalProfit + amt) * 100) / 100;

        const isDragon = isDragonHand((fd.hands || {})[p.id] || (fd.hands || {})[p.name]);
        const sc = scores.find(s => s.name === p.name);
        const isDerby = sc?.isDarby || false;
        const earnedTalu = sc?.taluCount || 0;

        const finalDragonCount = currentDragonCount + (isDragon ? 1 : 0);
        const finalDerbyCount = currentDerbyCount + (isDerby ? 1 : 0);
        const finalTaluCount = currentTaluCount + earnedTalu;

        let earnedXp = 25;
        if (amt > 0) earnedXp += 25;
        if (earnedTalu > 0) earnedXp += 30;
        if (isDerby) earnedXp += 75;
        if (isDragon) earnedXp += 100;

        let newLevel = currentLevel;
        let newXp = currentXp + earnedXp;
        while (newXp >= 250) { newXp -= 250; newLevel += 1; }

        const pts = sc?.roundScore || 0;
        const grossChips = pts * rate;
        const commDeducted = (grossChips > 0 && commissionPercent > 0) ? grossChips * (commissionPercent / 100) : 0;

        batch.set(db.collection('members').doc(p.id), {
          chips: finalChips,
          games: finalGames,
          wins: finalWins,
          winRate: finalWinRate,
          totalProfit: finalTotalProfit,
          derbyCount: finalDerbyCount,
          dragonCount: finalDragonCount,
          taluCount: finalTaluCount,
          level: newLevel,
          xp: newXp,
          txns: firebase.firestore.FieldValue.arrayUnion({
            t: Date.now(),
            ty: amt >= 0 ? 'win' : 'lose',
            amt: Math.abs(amt),
            bal: finalChips,
            note: `รอบ ${fd.round} ห้อง #${roomId} (คะแนน ${pts} x ${rate}${commDeducted > 0 ? ` - ต๋ง ${commissionPercent}%` : ''})`
          })
        }, { merge: true });

        // Queue room update for this player's chips
        roomChipsUpdates[`players.${p.id}.chips`] = finalChips;
      });

      // Also update the players' chips inside the room document in the same batch
      batch.update(roomRef, roomChipsUpdates);

      // 6. Commit all member updates atomically
      await batch.commit();
      console.log('settleScores completed successfully');
    } catch (e) {
      console.error('settleScores Error:', e);
    } finally {
      settlingRef.current = false;
    }
  }
 
  // 4. Presence
  async function joinActive() {
    if (!room) return;
    const rate = room.rate || 1;
    const need = CHIP_MULT * rate;
    if (myChips < need) {
      alert(`🪙 ชิปไม่พอร่วมเล่นครับ\n\nต้องมีชิปอย่างน้อย ${need} ชิป (35 เท่าของอัตราห้อง ${rate})\nคุณมีอยู่ ${myChips} ชิป\nกรุณาติดต่อแอดมินเพื่อเติมชิปก่อนครับ`);
      return;
    }
    const myCode = memberId;
    const hasHost = players.some(p => p.isHost);
    // memberId is safe (m_username — no dots, no special chars)
    const playerUpdate = {};
    playerUpdate[`players.${myCode}`] = { name: player.name, avatar: player.avatar, isSpectator: false, isQueue: false, isHost: !hasHost, ready: false, chips: myChips };
    await db.collection('rooms').doc(roomId).update(playerUpdate);
    setMyId(myCode);
  }
 
  async function setReadyState() {
    if (!myId) return;
    const rate = room.rate || 1;
    const need = CHIP_MULT * rate;
    if (myChips < need) {
      alert(`🪙 ชิปไม่พอร่วมเล่นครับ\n\nต้องมีชิปอย่างน้อย ${need} ชิป (35 เท่าของอัตราห้อง ${rate})\nคุณมีอยู่ ${myChips} ชิป\nกรุณาติดต่อแอดมินเพื่อเติมชิปก่อนครับ`);
      return;
    }
    const readyUpdate = {};
    readyUpdate[`players.${myId}.ready`] = true;
    await db.collection('rooms').doc(roomId).update(readyUpdate);
    playSound('ready');
  }
 
  async function handleHostStart() {
    if (room.round >= room.maxRounds) {
      alert(`เกมเล่นครบ ${room.maxRounds} รอบแล้ว ระบบปิดการใช้งานห้องนี้เรียบร้อยครับ`);
      return;
    }
    const active = players.filter(p => !p.isSpectator && !p.isQueue);
    
    // Check if any active player has insufficient chips!
    const rate = room.rate || 1;
    const need = CHIP_MULT * rate;
    const poorPlayers = active.filter(p => (p.chips || 0) < need);
    if (poorPlayers.length > 0) {
      const names = poorPlayers.map(p => p.name).join(', ');
      alert(`⚠️ ไม่สามารถเริ่มเกมได้เนื่องจากมีผู้เล่นชิปไม่พอ (${need} ชิป):\n${names}\n\nรบกวนให้แอดมินช่วยเตะผู้เล่นดังกล่าวออก หรือโอนชิปเพิ่มก่อนเล่นครับ`);
      return;
    }

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
    if (new Set(all.map(c => c.val)).size === 13) {
      setHand({ front: all.slice(0, 3), mid: all.slice(3, 8), back: all.slice(8, 13), unplaced: [], done: false, foul: false });
      playSound('ready');
      return;
    }
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
    // Optimistic UI Update: Lock cards and play sound immediately for instant feel
    setHand(prev => ({ ...prev, done: true }));
    playSound('ready');

    try {
      const handKey = myId || memberId;
      const handUpdate = {};
      handUpdate['hands.' + handKey] = { front: hand.front, mid: hand.mid, back: hand.back, foul: isFoul, done: true };
      await db.collection('rooms').doc(roomId).update(handUpdate);
    } catch (e) {
      // Revert state if update fails
      setHand(prev => ({ ...prev, done: false }));
      console.error('handleSubmitHand error:', e);
      alert('ส่งไพ่ไม่สำเร็จ: ' + e.message);
    }
  }

  async function handleCancelSubmit() {
    if (room.status !== 'playing') {
      alert('ไม่สามารถดึงไพ่กลับได้แล้วเนื่องจากเกมสรุปผลแล้วครับ');
      return;
    }
    setHand(prev => ({ ...prev, done: false }));
    playSound('click');

    try {
      const handKey = myId || memberId;
      const handUpdate = {};
      handUpdate['hands.' + handKey] = firebase.firestore.FieldValue.delete();
      await db.collection('rooms').doc(roomId).update(handUpdate);
    } catch (e) {
      setHand(prev => ({ ...prev, done: true }));
      console.error('handleCancelSubmit error:', e);
      alert('ดึงไพ่กลับไม่สำเร็จ: ' + e.message);
    }
  }
 
  // Memoized AI analysis → recomputes ONLY when hand or mode changes
 
 
  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    await db.collection('rooms').doc(roomId).collection('chat').add({ name: player.name, avatar: player.avatar, text: chatMsg.trim(), timestamp: Date.now() });
    setChatMsg('');
  }
  
  async function handleExitRoom() {
    try {
      if (roomId && myId) {
        if (room && room.status === 'playing') {
          const ok = confirm('⚠️ เกมกำลังดำเนินอยู่! หากคุณออกไปยังหน้าหลัก ชิปและตำแหน่งของคุณจะยังอยู่ในห้องนี้ คุณสามารถกลับเข้าห้องมาเล่นต่อได้ทุกเมื่อ ยืนยันที่จะออกไปหน้าหลักชั่วคราวหรือไม่?');
          if (!ok) return;
          onExit();
          return;
        }
        const activeP = players.filter(p => p.id !== myId && !p.isSpectator && !p.isQueue);
        const updates = {};
        updates[`players.${myId}`] = firebase.firestore.FieldValue.delete();
        updates[`hands.${myId}`] = firebase.firestore.FieldValue.delete();
        updates[`deals.${myId}`] = firebase.firestore.FieldValue.delete();
        if (isHost && activeP.length > 0) {
          updates[`players.${activeP[0].id}.isHost`] = true;
        }
        await db.collection('rooms').doc(roomId).update(updates);
      }
    } catch (e) {
      console.error("Error leaving room:", e);
    }
    onExit();
  }
 
  async function handleSendEmoji(emoji) {
    if (!myId) return;
    const emojiUpdate = {};
    emojiUpdate[`players.${myId}.emojiReaction`] = emoji;
    await db.collection('rooms').doc(roomId).update(emojiUpdate);
    triggerFloatingEmoji(player.avatar, emoji);
  }
 
  async function handleNextRound() {
    await db.collection('rooms').doc(roomId).update({ status: 'lobby', hands: {}, deals: {}, scores: {} });
  }

  async function handleCloseRoom() {
    if (confirm(`คุณต้องการปิดห้องนี้เนื่องจากเล่นครบ ${room.maxRounds} รอบแล้วใช่หรือไม่?`)) {
      await db.collection('rooms').doc(roomId).delete();
    }
  }
 
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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>กำลังเชื่อมต่อห้องเกม...</div>;
  }
 
  return (
    <div className="screen active" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
 
      {/* HEADER */}
      <div className="app-header safe-area-top">
        <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={handleExitRoom}>🚪</button>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--primary)', fontWeight: '800' }} onClick={() => setHistoryOpen(true)}>
          📜 ประวัติ
        </button>
        <div className="header-logo" style={{ flex: 1, textAlign: 'center' }}>🃏 3 กอง กาญ</div>
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
        <span ref={ghostNumRef} className="card-num" style={{ fontSize: '25px', fontWeight: 900, lineHeight: 1 }}></span>
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
              <div className="table-logo-simple">3 กอง กาญ</div>
              
              {seats.map((s, idx) => {
                if (!s.player) return null;
                const submitted = (room.hands || {})[s.player.name]?.done || (room.hands || {})[s.player.id]?.done;
                
                return (
                  <div key={idx} className={`felt-player-box ${s.pos}`}>
                    <div className="felt-av">{s.player.avatar || '🦊'}</div>
                    <div className="felt-nm">{s.player.name}</div>
                    <div className="felt-chips">🪙 {Math.round((s.player.chips || 0) * 10) / 10}</div>
                    {submitted && <span style={{ fontSize: '9px', background: 'rgba(50,232,117,0.2)', color: '#60e890', padding: '1px 5px', borderRadius: '4px', marginTop: '2px' }}>จัดเสร็จแล้ว</span>}
                  </div>
                );
              })}
            </div>
          </div>
 
          {/* My Hand */}
          <div className="my-hand safe-area-bottom" style={{ overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '20px' }}>{player.avatar}</span>
                <b style={{ color: 'var(--primary)', fontSize: '15px' }}>{player.name}</b>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ชิป: {Math.round(myChips * 10) / 10}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ลากไพ่ทับกันเพื่อสลับ</span>
            </div>
            
            {new Set([...hand.front, ...hand.mid, ...hand.back, ...hand.unplaced].map(c => c.val)).size === 13 && (
              <div className="glass-panel" style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(184,134,11,0.35) 100%)',
                border: '1px solid #d4af37',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                textAlign: 'center',
                marginBottom: '10px',
                fontSize: '13px',
                fontWeight: 'bold',
                boxShadow: '0 0 10px rgba(212,175,55,0.4)',
              }}>
                🎉 ยินดีด้วย! คุณได้รับไพ่มังกร 🐉 (ชนะทุกรายอัตโนมัติ)
              </div>
            )}
 
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
 
            {/* BUTTONS */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '800', whiteSpace: 'nowrap' }} onClick={handleSwapMidBack}>⇅ สลับกองกลาง/หลัง</button>
              <button
                className="btn-premium"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  border: '1px solid #c084fc',
                  boxShadow: '0 0 12px rgba(168, 85, 247, 0.3)'
                }}
                onClick={handleAutoArrange}
                disabled={hand.done}
              >
                <Sparkles size={14} style={{ color: '#fff' }} /> จัดให้
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              {!hand.done ? (
                <>
                  <button className="btn-secondary" style={{ padding: '10px 14px' }} onClick={handleUndo}><Undo2 size={14} /></button>
                  <button className="btn-secondary" style={{ padding: '10px 14px' }} onClick={handleReset}><RotateCcw size={14} /></button>
                  <button className="btn-premium" style={{ flex: 1, padding: '10px', fontSize: '15px' }} onClick={handleSubmitHand}>
                    ⚔️ ส่งไพ่สู้!
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1.2, padding: '10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px dashed var(--line)', cursor: 'default' }}
                    disabled
                  >
                    ✓ ส่งไพ่เรียบร้อยแล้ว
                  </button>
                  <button
                    className="btn-premium"
                    style={{
                      flex: 0.8,
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: '800',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: '1px solid #d97706',
                      boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)'
                    }}
                    onClick={handleCancelSubmit}
                  >
                    ↩️ ดึงไพ่มาจัดใหม่
                  </button>
                </>
              )}
            </div>
 
            {/* EMOJI DOCK */}
            <div style={{ display: 'flex', justifyContent: 'space-around', paddingBottom: '4px' }}>
              {['😂','😭','🔥','💸','🐉','👑','🎉'].map(emoji => (
                <button key={emoji} className="quick-emoji-btn" onClick={() => handleSendEmoji(emoji)}>{emoji}</button>
              ))}
            </div>
          </div>
        </div>
      )}
 
      {/* RESULTS */}
      {room.status === 'results' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#081708', padding: '14px', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--primary)', textAlign: 'center', marginBottom: '14px' }}>🏆 ผลรวมรอบการเล่นนี้</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {calcScores(players.filter(p => !p.isSpectator && room.deals && room.deals[p.id]), room.hands || {}).map((s, idx) => {
              const isWin = s.roundScore > 0;
              const rate = room.rate || 1;
              const commissionPercent = room.commission || 0;
              const grossChips = s.roundScore * rate;
              const commDeducted = (grossChips > 0 && commissionPercent > 0) ? (grossChips * (commissionPercent / 100)) : 0;
              const netChips = Math.round((grossChips - commDeducted) * 100) / 100;

              return (
                <div key={idx} className="glass-panel animate-pop-up" style={{ padding: '12px', borderLeft: '4px solid ' + (isWin ? '#40e880' : s.roundScore < 0 ? '#ff6d86' : 'var(--line)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px' }}>
                    <span>{s.avatar} {s.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: netChips > 0 ? '#40e880' : netChips < 0 ? '#ff6d86' : '#fff', fontWeight: '900', fontSize: '15px' }}>
                        {netChips > 0 ? '+' : ''}{netChips} ชิป
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>
                        {s.roundScore > 0 ? '+' : ''}{s.roundScore} แต้ม (อัตรา x{rate}) {commDeducted > 0 ? `• ต๋ง ${commissionPercent}%` : ''}
                      </div>
                    </div>
                  </div>
                  {s.bonusLabel && <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', marginTop: '4px' }}>🌟 โบนัสพิเศษ: {s.bonusLabel}</div>}
                </div>
              );
            })}
          </div>

          {/* MATCHUPS DETAILED BREAKDOWN */}
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)', marginTop: '16px', marginBottom: '10px' }}>⚔️ รายละเอียดการเทียบไพ่รายคู่</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {buildMatchups(players.filter(p => !p.isSpectator && !p.isQueue && room.deals && room.deals[p.id]), room.hands || {}).map((m, mIdx) => {
              const p1 = m.a;
              const p2 = m.b;
              return (
                <div key={mIdx} className="glass-panel animate-pop-up" style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)', borderRadius: '12px' }}>
                  {/* Pair Header */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '900', fontSize: '13px' }}>
                    {m.talu && m.taluWinner && m.taluWinner.id === p1.id && (
                      <span style={{ 
                        color: '#ffd700', 
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,180,0,0.25) 100%)', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        border: '1.5px solid #ffd700', 
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 0 8px rgba(255,215,0,0.4)',
                        fontWeight: '900',
                        letterSpacing: '0.5px'
                      }}>
                        👑 กินทะลุ
                      </span>
                    )}
                    <span>{p1.avatar} {p1.name}</span>
                    <span style={{ color: 'var(--primary)', fontSize: '11px', background: 'rgba(212,175,55,0.15)', padding: '2px 8px', borderRadius: '10px' }}>VS</span>
                    <span>{p2.avatar} {p2.name}</span>
                    {m.talu && m.taluWinner && m.taluWinner.id === p2.id && (
                      <span style={{ 
                        color: '#ffd700', 
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,180,0,0.25) 100%)', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        border: '1.5px solid #ffd700', 
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 0 8px rgba(255,215,0,0.4)',
                        fontWeight: '900',
                        letterSpacing: '0.5px'
                      }}>
                        👑 กินทะลุ
                      </span>
                    )}
                  </div>

                  {/* Rows comparison */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {m.rows.map((row, rIdx) => {
                      const isFoulP1 = (room.hands || {})[p1.name]?.foul || (room.hands || {})[p1.id]?.foul;
                      const isFoulP2 = (room.hands || {})[p2.name]?.foul || (room.hands || {})[p2.id]?.foul;
                      
                      let resultLabel1 = '';
                      let resultLabel2 = '';
                      let labelColor1 = '#fff';
                      let labelColor2 = '#fff';
                      
                      if (isFoulP1 && isFoulP2) {
                        resultLabel1 = 'ฟาวล์';
                        resultLabel2 = 'ฟาวล์';
                        labelColor1 = '#ff6d86';
                        labelColor2 = '#ff6d86';
                      } else if (isFoulP1) {
                        resultLabel1 = 'ฟาวล์';
                        resultLabel2 = 'ชนะ';
                        labelColor1 = '#ff6d86';
                        labelColor2 = '#40e880';
                      } else if (isFoulP2) {
                        resultLabel1 = 'ชนะ';
                        resultLabel2 = 'ฟาวล์';
                        labelColor1 = '#40e880';
                        labelColor2 = '#ff6d86';
                      } else {
                        if (row.winner > 0) {
                          const bPts = bonus(row.aCards, row.key).pts;
                          const pts = bPts > 0 ? bPts : 1;
                          resultLabel1 = `ชนะ (+${pts})`;
                          resultLabel2 = `แพ้ (-${pts})`;
                          labelColor1 = '#40e880';
                          labelColor2 = '#ff6d86';
                        } else if (row.winner < 0) {
                          const bPts = bonus(row.bCards, row.key).pts;
                          const pts = bPts > 0 ? bPts : 1;
                          resultLabel1 = `แพ้ (-${pts})`;
                          resultLabel2 = `ชนะ (+${pts})`;
                          labelColor1 = '#ff6d86';
                          labelColor2 = '#40e880';
                        } else {
                          resultLabel1 = 'เสมอ (0)';
                          resultLabel2 = 'เสมอ (0)';
                          labelColor1 = '#aaa';
                          labelColor2 = '#aaa';
                        }
                      }

                      return (
                        <div key={rIdx} style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', alignItems: 'center' }}>
                            {/* Player 1 Result Badge on Left */}
                            <span style={{ 
                              color: labelColor1, 
                              fontWeight: '900', 
                              fontSize: '10px',
                              background: resultLabel1.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.12)' : (resultLabel1.startsWith('แพ้') || resultLabel1.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${resultLabel1.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.3)' : (resultLabel1.startsWith('แพ้') || resultLabel1.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                            }}>
                              {resultLabel1}
                            </span>

                            <span style={{ color: 'var(--text-muted)' }}>กอง{row.label}</span>

                            {/* Player 2 Result Badge on Right */}
                            <span style={{ 
                              color: labelColor2, 
                              fontWeight: '900', 
                              fontSize: '10px',
                              background: resultLabel2.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.12)' : (resultLabel2.startsWith('แพ้') || resultLabel2.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${resultLabel2.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.3)' : (resultLabel2.startsWith('แพ้') || resultLabel2.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                            }}>
                              {resultLabel2}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            {/* Player 1 Cards */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                display: 'flex', 
                                gap: '2px', 
                                flexWrap: 'nowrap', 
                                scale: '0.85', 
                                transformOrigin: 'left center', 
                                width: row.key === 'front' ? '68px' : '108px' 
                              }}>
                                {row.aCards.map((c, cIdx) => {
                                  const isRed = c.suit === '♥' || c.suit === '♦';
                                  return (
                                    <div key={cIdx} style={{ 
                                      background: '#fff', 
                                      color: isRed ? '#ff4d4d' : '#111', 
                                      padding: '2px 4px', 
                                      borderRadius: '4px', 
                                      fontSize: '11px', 
                                      fontWeight: '900', 
                                      width: '20px', 
                                      textAlign: 'center', 
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      lineHeight: 1
                                    }}>
                                      <span>{c.rank}</span>
                                      <span style={{ fontSize: '10px' }}>{c.suit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isFoulP1 ? '⚠️ ฟาวล์' : row.aName}
                              </span>
                            </div>

                            {/* VS separator */}
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', fontWeight: 'bold' }}>vs</div>

                            {/* Player 2 Cards */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, justifyContent: 'flex-end', textAlign: 'right' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isFoulP2 ? '⚠️ ฟาวล์' : row.bName}
                              </span>
                              <div style={{ 
                                display: 'flex', 
                                gap: '2px', 
                                flexWrap: 'nowrap', 
                                scale: '0.85', 
                                transformOrigin: 'right center', 
                                width: row.key === 'front' ? '68px' : '108px', 
                                justifyContent: 'flex-end' 
                              }}>
                                {row.bCards.map((c, cIdx) => {
                                  const isRed = c.suit === '♥' || c.suit === '♦';
                                  return (
                                    <div key={cIdx} style={{ 
                                      background: '#fff', 
                                      color: isRed ? '#ff4d4d' : '#111', 
                                      padding: '2px 4px', 
                                      borderRadius: '4px', 
                                      fontSize: '11px', 
                                      fontWeight: '900', 
                                      width: '20px', 
                                      textAlign: 'center', 
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      lineHeight: 1
                                    }}>
                                      <span>{c.rank}</span>
                                      <span style={{ fontSize: '10px' }}>{c.suit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            {room.round >= room.maxRounds && (
              <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.35)', borderRadius: '8px', color: '#ff6d86', fontSize: '12px', fontWeight: 'bold' }}>
                เล่นครบกำหนด {room.maxRounds} รอบแล้ว {isHost ? 'กรุณากดปิดห้องเพื่อจบเกมครับ' : 'กรุณารอโฮสต์ปิดห้องเพื่อจบเกมครับ'}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {!players.some(p => p.name === player.name && !p.isSpectator && !p.isQueue) && players.filter(p => !p.isSpectator && !p.isQueue).length < 4 && room.round < room.maxRounds && (
                <button className="btn-premium" style={{ flex: 1, padding: '12px' }} onClick={joinActive}>➕ เข้าร่วมเล่นรอบถัดไป</button>
              )}
              {isHost ? (
                room.round >= room.maxRounds ? (
                  <button className="btn-premium" style={{ flex: 1, padding: '12px', background: '#d11f1f', border: '1px solid #d11f1f' }} onClick={handleCloseRoom}>❌ ปิดห้องเล่นเกม</button>
                ) : (
                  <button className="btn-premium" style={{ flex: 1, padding: '12px' }} onClick={handleNextRound}>▶ เริ่มรอบถัดไป</button>
                )
              ) : null}
              <button className="btn-secondary" style={{ padding: '12px 20px' }} onClick={handleExitRoom}>ออกห้อง</button>
            </div>
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

      {/* HISTORY DRAWER */}
      {historyOpen && (
        <div style={{ 
          position: 'fixed', 
          inset: 'auto 0 0 0', 
          zIndex: 200, 
          display: 'flex', 
          flexDirection: 'column', 
          maxHeight: '75vh', 
          background: '#0d1610', 
          borderTop: '2px solid var(--primary)', 
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.8)'
        }}>
          <div style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📜 ประวัติไพ่และการเล่น (ผ่านไปแล้ว)
            </span>
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }} 
              onClick={() => setHistoryOpen(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(!historyList || historyList.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                ยังไม่มีบันทึกประวัติการเล่นในห้องนี้
              </div>
            ) : (
              [...historyList].reverse().map((hRecord, rIdx) => (
                <div key={rIdx} className="glass-panel" style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '8px', fontWeight: '900', fontSize: '13px', color: 'var(--primary)' }}>
                    <span>รอบที่ {hRecord.round}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(hRecord.timestamp || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {hRecord.scores.map((scItem, sIdx) => {
                      const pHand = (hRecord.hands || {})[scItem.id] || (hRecord.hands || {})[scItem.name] || {};
                      const netScore = scItem.roundScore;
                      return (
                        <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: sIdx === hRecord.scores.length - 1 ? 0 : '8px', borderBottom: sIdx === hRecord.scores.length - 1 ? 'none' : '1px dashed rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                            <span style={{ fontWeight: '800' }}>
                              {scItem.avatar} {scItem.name} 
                              {pHand.foul && <span style={{ color: '#ff6d86', fontSize: '10px', marginLeft: '6px' }}>⚠️ ฟาวล์</span>}
                              {scItem.bonusLabel && <span style={{ color: '#ffd700', fontSize: '10px', marginLeft: '6px', background: 'rgba(255,215,0,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,215,0,0.2)' }}>🏆 {scItem.bonusLabel}</span>}
                            </span>
                            <span style={{ fontWeight: '900', color: netScore > 0 ? '#40e880' : netScore < 0 ? '#ff6d86' : '#fff' }}>
                              {netScore > 0 ? '+' : ''}{netScore} แต้ม
                            </span>
                          </div>

                          {!pHand.foul && pHand.front && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px' }}>
                              {/* Front */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', fontWeight: '800' }}>หน้า:</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {pHand.front.map((c, cIdx) => {
                                    const isRed = c.suit === '♥' || c.suit === '♦';
                                    return (
                                      <div key={cIdx} style={{ 
                                        background: '#fff', 
                                        color: isRed ? '#d11f1f' : '#1a1a1a', 
                                        borderRadius: '4px', 
                                        fontSize: '11px', 
                                        fontWeight: '900', 
                                        width: '26px', 
                                        height: '36px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '2px 0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                        lineHeight: 1 
                                      }}>
                                        <span style={{ fontSize: '10px' }}>{c.rank}</span>
                                        <span style={{ fontSize: '9px', marginTop: '-2px' }}>{c.suit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Mid */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', fontWeight: '800' }}>กลาง:</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {pHand.mid.map((c, cIdx) => {
                                    const isRed = c.suit === '♥' || c.suit === '♦';
                                    return (
                                      <div key={cIdx} style={{ 
                                        background: '#fff', 
                                        color: isRed ? '#d11f1f' : '#1a1a1a', 
                                        borderRadius: '4px', 
                                        fontSize: '11px', 
                                        fontWeight: '900', 
                                        width: '26px', 
                                        height: '36px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '2px 0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                        lineHeight: 1 
                                      }}>
                                        <span style={{ fontSize: '10px' }}>{c.rank}</span>
                                        <span style={{ fontSize: '9px', marginTop: '-2px' }}>{c.suit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Back */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', fontWeight: '800' }}>หลัง:</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {pHand.back.map((c, cIdx) => {
                                    const isRed = c.suit === '♥' || c.suit === '♦';
                                    return (
                                      <div key={cIdx} style={{ 
                                        background: '#fff', 
                                        color: isRed ? '#d11f1f' : '#1a1a1a', 
                                        borderRadius: '4px', 
                                        fontSize: '11px', 
                                        fontWeight: '900', 
                                        width: '26px', 
                                        height: '36px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '2px 0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                        lineHeight: 1 
                                      }}>
                                        <span style={{ fontSize: '10px' }}>{c.rank}</span>
                                        <span style={{ fontSize: '9px', marginTop: '-2px' }}>{c.suit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
