const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// ── 1. Card Utilities & Rule Engine (Identical Parity) ──
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VAL = {};
RANKS.forEach((r, i) => RANK_VAL[r] = i + 2);
const SUIT_RANK = { '♠': 4, '♥': 3, '♦': 2, '♣': 1 };

function evalHand(cards) {
  if (!cards || !cards.length) return { rank: 0, name: '', key: 0, suit: 0 };
  const n = cards.length;
  const vals = cards.map(c => c.val).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const rc = {};
  vals.forEach(v => rc[v] = (rc[v] || 0) + 1);
  const cnt = Object.values(rc).sort((a, b) => b - a);
  
  const fl = n === 5 && suits.every(s => s === suits[0]);
  const isW = n === 5 && vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2;
  const isSt = n === 5 && ((vals[0] - vals[4] === 4 && new Set(vals).size === 5) || isW);
  
  let rank = 0;
  let name = 'ไฮการ์ด';
  
  if (n === 3) {
    if (cnt[0] === 3) { rank = 5; name = 'ตอง'; }
    else if (cnt[0] === 2) { rank = 2; name = 'คู่'; }
    else rank = 1;
  } else {
    if (fl && isSt) {
      const bw = vals[0] === 14 && vals[4] === 10;
      rank = bw ? 9 : 8;
      name = bw ? 'ฟลัชหลวง' : 'สตรีทฟลัช';
    }
    else if (cnt[0] === 4) { rank = 7; name = 'สี่ตัว'; }
    else if (cnt[0] === 3 && cnt[1] === 2) { rank = 6; name = 'ฟูลเฮ้าส์'; }
    else if (fl) { rank = 5; name = 'ฟลัช'; }
    else if (isSt) { rank = 4; name = 'สตรีท'; }
    else if (cnt[0] === 3) { rank = 3; name = 'ตอง'; }
    else if (cnt[0] === 2 && cnt[1] === 2) { rank = 2; name = 'สองคู่'; }
    else if (cnt[0] === 2) { rank = 1; name = 'คู่'; }
  }
  
  let key;
  if (rank === 4 && n === 5) key = vals[0]; // straight key logic simplified for server sort
  else {
    let main = [], kick = [];
    if (n === 3) {
      if (cnt[0] === 3) main = cards.slice();
      else if (cnt[0] === 2) {
        const pv = parseInt(Object.keys(rc).find(v => rc[v] === 2));
        main = cards.filter(c => c.val === pv);
        kick = cards.filter(c => c.val !== pv);
      } else kick = cards.slice();
    } else {
      if (cnt[0] === 4) {
        const qv = parseInt(Object.keys(rc).find(v => rc[v] === 4));
        main = cards.filter(c => c.val === qv);
        kick = cards.filter(c => c.val !== qv);
      } else if (cnt[0] === 3 && cnt[1] === 2) {
        const tv = parseInt(Object.keys(rc).find(v => rc[v] === 3));
        const pv = parseInt(Object.keys(rc).find(v => rc[v] === 2));
        main = [...cards.filter(c => c.val === tv), ...cards.filter(c => c.val === pv)];
      } else if (cnt[0] === 3) {
        const tv = parseInt(Object.keys(rc).find(v => rc[v] === 3));
        main = cards.filter(c => c.val === tv);
        kick = cards.filter(c => c.val !== tv);
      } else if (cnt[0] === 2 && cnt[1] === 2) {
        const pvs = Object.keys(rc).filter(v => rc[v] === 2).map(Number).sort((a, b) => b - a);
        main = cards.filter(c => pvs.includes(c.val));
        kick = cards.filter(c => !pvs.includes(c.val));
      } else if (cnt[0] === 2) {
        const pv = parseInt(Object.keys(rc).find(v => rc[v] === 2));
        main = cards.filter(c => c.val === pv);
        kick = cards.filter(c => c.val !== pv);
      } else kick = cards.slice();
    }
    if (!(n === 5 && cnt[0] === 3 && cnt[1] === 2)) main.sort((a, b) => b.val - a.val);
    kick.sort((a, b) => b.val - a.val);
    key = [...main, ...kick].reduce((acc, c) => acc * 100 + c.val, 0);
  }

  const top = [...cards].sort((a, b) => b.val - a.val || SUIT_RANK[b.suit] - SUIT_RANK[a.suit])[0];
  const suit = top ? SUIT_RANK[top.suit] : 0;
  
  return { rank, name, key, suit };
}

function cmpH(a, b) {
  const ea = evalHand(a);
  const eb = evalHand(b);
  if (ea.rank !== eb.rank) return ea.rank > eb.rank ? 1 : -1;
  if (ea.key !== eb.key) return ea.key > eb.key ? 1 : -1;
  if (ea.suit !== eb.suit) return ea.suit > eb.suit ? 1 : -1;
  return 0;
}

function validArr(f, m, b) {
  if (f.length !== 3 || m.length !== 5 || b.length !== 5) return false;
  
  function nr(cards) {
    const h = evalHand(cards);
    if (cards.length === 3) {
      if (h.rank === 5) return 3; // Three of a Kind (ตอง)
      if (h.rank === 2) return 1; // Pair
      return 0;
    }
    return h.rank;
  }
  
  const rf = nr(f);
  const rm = nr(m);
  const rb = nr(b);
  
  if (rm < rf || rb < rm) return false;
  if (rm === rf && evalHand(m).key < evalHand(f).key) return false;
  if (rb === rm && evalHand(b).key < evalHand(m).key) return false;
  return true;
}

function bonus(cards, row) {
  const h = evalHand(cards);
  const vals = cards.map(c => c.val).sort((a, b) => b - a);
  const rc = {};
  vals.forEach(v => rc[v] = (rc[v] || 0) + 1);
  const isAAA = h.name === 'ฟูลเฮ้าส์' && rc[14] === 3;
  const isAA = h.name === 'คู่' && rc[14] === 2;
  
  if (row === 'front') {
    if (h.name === 'ตอง') return { pts: 5, label: 'ตอง+5' };
    if (isAA) return { pts: 2, label: 'AA+2' };
  } else if (row === 'mid') {
    if (h.name === 'ฟลัชหลวง') return { pts: 16, label: 'RF+16' };
    if (h.name === 'สตรีทฟลัช') return { pts: 14, label: 'SF+14' };
    if (h.name === 'สี่ตัว') return { pts: 12, label: '4ตัว+12' };
    if (isAAA) return { pts: 4, label: 'AAA FH+4' };
    if (h.name === 'ฟูลเฮ้าส์') return { pts: 2, label: 'FH+2' };
  } else {
    if (h.name === 'ฟลัชหลวง') return { pts: 8, label: 'RF+8' };
    if (h.name === 'สตรีทฟลัช') return { pts: 7, label: 'SF+7' };
    if (h.name === 'สี่ตัว') return { pts: 6, label: '4ตัว+6' };
    if (isAAA) return { pts: 2, label: 'AAA FH+2' };
  }
  return { pts: 0, label: '' };
}

// ── 2. Cloud Function: Secure Deal ──
exports.dealCards = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'ต้องเข้าสู่ระบบก่อนครับ');
  const { roomId } = data;
  if (!roomId) throw new functions.https.HttpsError('invalid-argument', 'ขาดรหัสห้อง');

  const roomRef = db.collection('rooms').doc(roomId);
  
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(roomRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'ไม่พบห้องนี้ครับ');
    
    const room = snap.data();
    const playersList = Object.entries(room.players || {}).map(([id, val]) => ({ id, ...val }));
    const active = playersList.filter(p => !p.isSpectator && !p.isQueue);
    
    if (active.length < 2) {
      throw new functions.https.HttpsError('failed-precondition', 'ต้องมีผู้เล่นเล่นร่วมอย่างน้อย 2 คนครับ');
    }

    // Shuffle standard 52 deck
    const deck = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ suit: s, rank: r, val: RANK_VAL[r] });
      }
    }
    
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Deal private cards
    const batchUpdates = {};
    active.forEach((p, idx) => {
      const playerDeal = shuffled.slice(idx * 13, (idx + 1) * 13);
      // Write private deal document inside transaction
      const dealRef = roomRef.collection('deals').doc(p.id);
      transaction.set(dealRef, { cards: playerDeal, timestamp: Date.now() });
      batchUpdates[`deals.${p.id}`] = playerDeal; // Client reads from room doc or private deal subcollection
    });

    transaction.update(roomRef, {
      ...batchUpdates,
      status: 'playing',
      hands: {},
      scores: {},
      round: (room.round || 0) + 1
    });

    return { success: true };
  });
});

// ── 3. Cloud Function: Submit Player Hand ──
exports.submitPlayerHand = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'เข้าสู่ระบบก่อนครับ');
  const { roomId, front, mid, back } = data;
  const playerId = context.auth.uid;

  if (!roomId || !front || !mid || !back) {
    throw new functions.https.HttpsError('invalid-argument', 'ข้อมูลขัดข้องไม่ครบถ้วน');
  }

  const roomRef = db.collection('rooms').doc(roomId);
  const dealRef = roomRef.collection('deals').doc(playerId);
  const handRef = roomRef.collection('hands').doc(playerId);

  return db.runTransaction(async transaction => {
    const roomSnap = await transaction.get(roomRef);
    const dealSnap = await transaction.get(dealRef);
    
    if (!roomSnap.exists || !dealSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'ไม่พบบันทึกไพ่ของห้องนี้');
    }

    const officialCards = dealSnap.data().cards;
    const submittedCards = [...front, ...mid, ...back];
    
    // ANTI-CHEAT check: Prove submitted cards match exactly the dealt cards!
    const key = c => `${c.rank}${c.suit}`;
    const officialKeys = officialCards.map(key).sort().join(',');
    const submittedKeys = submittedCards.map(key).sort().join(',');

    if (officialKeys !== submittedKeys) {
      throw new functions.https.HttpsError('permission-denied', 'ตรวจพบลบล้างไพ่หรือโกงการส่ง! การส่งไพ่ถูกปฏิเสธ ⚠️');
    }

    const isFoul = !validArr(front, mid, back);
    
    // Save hand
    transaction.set(handRef, {
      front,
      mid,
      back,
      foul: isFoul,
      done: true,
      timestamp: Date.now()
    });

    // Write brief state to room hands
    const room = roomSnap.data();
    const playerName = Object.values(room.players || {}).find(p => p.name === room.players[playerId]?.name)?.name || playerId;
    
    transaction.update(roomRef, {
      [`hands.${playerName}`]: { done: true, foul: isFoul }
    });

    return { success: true };
  });
});

// ── 4. Cloud Function: Settle Round (Secure atomic payouts) ──
exports.settleRound = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'ต้องล็อกอินครับ');
  const { roomId } = data;
  if (!roomId) throw new functions.https.HttpsError('invalid-argument', 'รหัสห้องไม่ถูกต้อง');

  const roomRef = db.collection('rooms').doc(roomId);

  return db.runTransaction(async transaction => {
    const roomSnap = await transaction.get(roomRef);
    if (!roomSnap.exists) throw new functions.https.HttpsError('not-found', 'ไม่พบห้อง');

    const room = roomSnap.data();
    if (room.status !== 'playing') {
      throw new functions.https.HttpsError('failed-precondition', 'ห้องไม่ได้อยู่ในสถานะจัดไพ่');
    }

    const playersList = Object.entries(room.players || {}).map(([id, val]) => ({ id, ...val }));
    const active = playersList.filter(p => !p.isSpectator && !p.isQueue);

    // Fetch all hands documents from subcollection
    const handsData = {};
    for (const p of active) {
      const hSnap = await transaction.get(roomRef.collection('hands').doc(p.id));
      if (!hSnap.exists || !hSnap.data().done) {
        throw new functions.https.HttpsError('failed-precondition', `ผู้เล่น ${p.name} ยังส่งไพ่ไม่เสร็จสิ้น`);
      }
      handsData[p.name] = hSnap.data();
    }

    const dragon = active.find(p => isDragonHand(handsData[p.name]));
    let scores;
    
    if (dragon) {
      scores = active.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        roundScore: p.name === dragon.name ? 30 * (active.length - 1) : -30,
        bonusLabel: p.name === dragon.name ? '🐉 มังกรทองกินรอบวง' : '',
        taluCount: 0,
        isDarby: false
      }));
    } else {
      // Regular scoring cmpH comparisons
      scores = active.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        roundScore: 0,
        bonusLabel: '',
        taluCount: 0,
        isDarby: false,
        _tw: 0
      }));

      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = scores[i];
          const b = scores[j];
          const ha = handsData[a.name];
          const hb = handsData[b.name];
          
          if (ha.foul || hb.foul) continue;
          
          let ps = 0, qs = 0, aw = 0, bw = 0;
          ['front', 'mid', 'back'].forEach(row => {
            const cv = cmpH(ha[row], hb[row]);
            const ba = bonus(ha[row], row).pts;
            const bb = bonus(hb[row], row).pts;
            
            if (cv > 0) {
              ps += ba > 0 ? ba : 1;
              qs -= ba > 0 ? ba : 1;
              aw++;
            } else if (cv < 0) {
              qs += bb > 0 ? bb : 1;
              ps -= bb > 0 ? bb : 1;
              bw++;
            }
          });

          if (aw === 3) { ps *= 2; qs *= 2; a.taluCount++; a._tw++; }
          else if (bw === 3) { ps *= 2; qs *= 2; b.taluCount++; b._tw++; }
          
          a.roundScore += ps;
          b.roundScore += qs;
        }
      }

      // Derby check x4
      scores.forEach(s => {
        if (handsData[s.name].foul) return;
        const opps = scores.filter(o => o.id !== s.id && !handsData[o.name].foul);
        if (active.length >= 4 && opps.length >= 2 && s._tw === opps.length) s.isDarby = true;
      });

      if (scores.some(s => s.isDarby)) {
        scores.forEach(s => { s.roundScore *= 4; });
      }

      // Foul deduction
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = scores[i], b = scores[j];
          const fa = handsData[a.name].foul, fb = handsData[b.name].foul;
          if (fa && fb) continue;
          if (fa) { a.roundScore -= 6; b.roundScore += 6; }
          else if (fb) { b.roundScore -= 6; a.roundScore += 6; }
        }
      }
    }

    // ── Apply rate multipliers & commission ──
    const rate = room.rate || 1;
    const comm = room.commission || 0;
    
    scores.forEach(s => {
      let amt = s.roundScore * rate;
      if (amt > 0 && comm > 0) amt = amt * (1 - comm / 100);
      s.roundScore = Math.round(amt * 100) / 100;
    });

    // Update members chips balance atomically inside transaction!
    const newScores = {};
    for (const p of active) {
      const memberRef = db.collection('members').doc(p.id);
      const mSnap = await transaction.get(memberRef);
      const scoreAmt = scores.find(s => s.id === p.id)?.roundScore || 0;
      
      const currentChips = mSnap.exists ? (mSnap.data().chips || 0) : 0;
      const finalChips = Math.round((currentChips + scoreAmt) * 100) / 100;
      
      transaction.update(memberRef, {
        chips: finalChips,
        txns: admin.firestore.FieldValue.arrayUnion({
          t: Date.now(),
          ty: scoreAmt >= 0 ? 'transfer_in' : 'transfer_out',
          amt: Math.abs(scoreAmt),
          bal: finalChips,
          note: `รอบที่ ${room.round} ห้อง #${roomId}`
        })
      });

      const oldRoomScore = (room.scores || {})[p.id] || 0;
      newScores[p.id] = Math.round((oldRoomScore + scoreAmt) * 100) / 100;
    }

    // Save final scores and move status to results
    transaction.update(roomRef, {
      scores: newScores,
      status: 'results',
      // Keep record of current round details in history array
      history: admin.firestore.FieldValue.arrayUnion({
        round: room.round,
        timestamp: Date.now(),
        scores: scores.map(s => ({ name: s.name, roundScore: s.roundScore }))
      })
    });

    return { success: true, scores };
  });
});
