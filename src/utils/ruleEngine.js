// ── 3 Kong Kan Rule Engine (100% Parity with Version 1.0) ──

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_VAL = {};
RANKS.forEach((r, i) => RANK_VAL[r] = i + 2);

export const SUIT_RANK = { '♠': 4, '♥': 3, '♦': 2, '♣': 1 };

export function cardScore(c) {
  return c.val * 10 + SUIT_RANK[c.suit];
}

export function isRed(c) {
  return c.suit === '♥' || c.suit === '♦';
}

export function makeDeck() {
  const d = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      d.push({ suit: s, rank: r, val: RANK_VAL[r] });
    }
  }
  return d;
}

export function shuffle(a) {
  const copy = [...a];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function handSortKey(cards) {
  if (!cards || !cards.length) return 0;
  const rc = {};
  cards.forEach(c => rc[c.val] = (rc[c.val] || 0) + 1);
  const counts = Object.values(rc).sort((a, b) => b - a);
  let main = [], kick = [];
  
  if (cards.length === 3) {
    if (counts[0] === 3) main = cards.slice();
    else if (counts[0] === 2) {
      const pv = parseInt(Object.keys(rc).find(v => rc[v] === 2));
      main = cards.filter(c => c.val === pv);
      kick = cards.filter(c => c.val !== pv);
    } else {
      kick = cards.slice();
    }
  } else {
    if (counts[0] === 4) {
      const qv = parseInt(Object.keys(rc).find(v => rc[v] === 4));
      main = cards.filter(c => c.val === qv);
      kick = cards.filter(c => c.val !== qv);
    } else if (counts[0] === 3 && counts[1] === 2) {
      const tv = parseInt(Object.keys(rc).find(v => rc[v] === 3));
      const pv = parseInt(Object.keys(rc).find(v => rc[v] === 2));
      main = [...cards.filter(c => c.val === tv), ...cards.filter(c => c.val === pv)];
    } else if (counts[0] === 3) {
      const tv = parseInt(Object.keys(rc).find(v => rc[v] === 3));
      main = cards.filter(c => c.val === tv);
      kick = cards.filter(c => c.val !== tv);
    } else if (counts[0] === 2 && counts[1] === 2) {
      const pvs = Object.keys(rc).filter(v => rc[v] === 2).map(Number).sort((a, b) => b - a);
      main = cards.filter(c => pvs.includes(c.val));
      kick = cards.filter(c => !pvs.includes(c.val));
    } else if (counts[0] === 2) {
      const pv = parseInt(Object.keys(rc).find(v => rc[v] === 2));
      main = cards.filter(c => c.val === pv);
      kick = cards.filter(c => c.val !== pv);
    } else {
      kick = cards.slice();
    }
  }

  // Sort by raw val (no suit consideration) - Full house main is kept intact
  if (!(cards.length === 5 && counts[0] === 3 && counts[1] === 2)) {
    main.sort((a, b) => b.val - a.val);
  }
  kick.sort((a, b) => b.val - a.val);

  return [...main, ...kick].reduce((acc, c) => acc * 100 + c.val, 0);
}

export function straightKey(vals) {
  if (vals[0] === 14 && vals[1] === 13 && vals[2] === 12 && vals[3] === 11 && vals[4] === 10) return 9999;
  if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) return 9998;
  return vals[0];
}

export function evalHand(cards) {
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
    else rank = 1; // 3 cards front: no straight/flush
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
  if (rank === 4 && n === 5) key = straightKey(vals) * 1e10 + handSortKey(cards);
  else key = handSortKey(cards);

  // Suit breaker based on the single highest card (by val, then suit strength)
  const top = [...cards].sort((a, b) => b.val - a.val || SUIT_RANK[b.suit] - SUIT_RANK[a.suit])[0];
  const suit = top ? SUIT_RANK[top.suit] : 0;
  
  return { rank, name, key, suit };
}

export function cmpH(a, b) {
  const ea = evalHand(a);
  const eb = evalHand(b);
  if (ea.rank !== eb.rank) return ea.rank > eb.rank ? 1 : -1;
  if (ea.key !== eb.key) return ea.key > eb.key ? 1 : -1;
  if (ea.suit !== eb.suit) return ea.suit > eb.suit ? 1 : -1;
  return 0;
}

export function validArr(f, m, b) {
  if (f.length !== 3 || m.length !== 5 || b.length !== 5) return false;
  
  function nr(cards) {
    const h = evalHand(cards);
    if (cards.length === 3) {
      if (h.rank === 6) return 8; // Legacy placeholder check
      if (h.rank === 5) return 3; // Three of a Kind (ตอง) in front maps to rank 3 strength
      if (h.rank === 2) return 1; // Pair in front maps to rank 1 strength
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

export function bonus(cards, row) {
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

export function isDragonHand(h) {
  if (!h || !h.front || !h.mid || !h.back) return false;
  const all = [...h.front, ...h.mid, ...h.back];
  return all.length === 13 && new Set(all.map(c => c.val)).size === 13;
}

export function calcScores(players, hands) {
  const n = players.length;
  const h = k => hands[k.name] || hands[k.id] || { front: [], mid: [], back: [], foul: false };
  const sc = players.map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    roundScore: 0,
    bonusLabel: '',
    taluCount: 0,
    isDarby: false,
    _tw: 0,
    _pb: {}
  }));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = sc[i];
      const b = sc[j];
      const ha = h(a);
      const hb = h(b);
      
      if (ha.foul || hb.foul) continue;
      
      let ps = 0, qs = 0, aw = 0, bw = 0;
      
      ['front', 'mid', 'back'].forEach(row => {
        const cv = cmpH(ha[row] || [], hb[row] || []);
        const ba = bonus(ha[row] || [], row).pts;
        const bb = bonus(hb[row] || [], row).pts;
        
        if (cv > 0) {
          ps += ba > 0 ? ba : 1;
          qs -= ba > 0 ? ba : 1;
          aw++;
          if (ba > 0) {
            const lbl = bonus(ha[row], row).label;
            if (lbl) a.bonusLabel = a.bonusLabel ? a.bonusLabel + ', ' + lbl : lbl;
          }
        } else if (cv < 0) {
          qs += bb > 0 ? bb : 1;
          ps -= bb > 0 ? bb : 1;
          bw++;
          if (bb > 0) {
            const lbl = bonus(hb[row], row).label;
            if (lbl) b.bonusLabel = b.bonusLabel ? b.bonusLabel + ', ' + lbl : lbl;
          }
        }
      });
      
      if (aw === 3) {
        ps *= 2;
        qs *= 2;
        a.taluCount++;
        a._tw++;
        a._pb[j] = { talu: true };
        b._pb[i] = { talu: true };
      } else if (bw === 3) {
        ps *= 2;
        qs *= 2;
        b.taluCount++;
        b._tw++;
        b._pb[i] = { talu: true };
        a._pb[j] = { talu: true };
      }
      
      a.roundScore += ps;
      b.roundScore += qs;
    }
  }

  // Derby Check: Swept all active non-fouled players (requires at least 2 non-fouled opponents)
  sc.forEach(s => {
    if (h(s).foul) return;
    const opps = sc.filter(o => o.id !== s.id && !h(o).foul);
    if (opps.length >= 2 && s._tw === opps.length) s.isDarby = true;
  });

  if (sc.some(s => s.isDarby)) {
    sc.forEach(s => {
      s.roundScore *= 4;
    });
  }

  // Foul: Pays 6 to each non-fouled opponent (zero-sum)
  sc.forEach(s => {
    if (h(s).foul) s.bonusLabel = '⚠️ ฟาว';
  });

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = sc[i];
      const b = sc[j];
      const fa = h(a).foul;
      const fb = h(b).foul;
      
      if (fa && fb) continue; // Both fouled -> no chip trade
      if (fa) {
        a.roundScore -= 6;
        b.roundScore += 6;
      } else if (fb) {
        b.roundScore -= 6;
        a.roundScore += 6;
      }
    }
  }

  return sc;
}

export function buildMatchups(players, hands) {
  const h = k => hands[k.name] || hands[k.id] || { front: [], mid: [], back: [], foul: false };
  const rows = [
    { key: 'front', label: 'หน้า' },
    { key: 'mid', label: 'กลาง' },
    { key: 'back', label: 'หลัง' }
  ];
  const matchups = [];

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const ha = h(a);
      const hb = h(b);
      
      const rowResults = rows.map(r => {
        const ca = ha[r.key] || [];
        const cb = hb[r.key] || [];
        let winner = 0;
        
        if (ha.foul && !hb.foul) winner = -1;
        else if (hb.foul && !ha.foul) winner = 1;
        else if (ha.foul && hb.foul) winner = 0;
        else winner = cmpH(ca, cb);
        
        return {
          key: r.key,
          label: r.label,
          aCards: ca,
          bCards: cb,
          aName: evalHand(ca).name || 'ไฮการ์ด',
          bName: evalHand(cb).name || 'ไฮการ์ด',
          winner
        };
      });
      
      const aWins = rowResults.filter(r => r.winner > 0).length;
      const bWins = rowResults.filter(r => r.winner < 0).length;
      const talu = (aWins === 3 || bWins === 3) && !ha.foul && !hb.foul;
      
      matchups.push({
        a,
        b,
        ha,
        hb,
        rowResults,
        aWins,
        bWins,
        talu,
        taluWinner: aWins === 3 ? a : bWins === 3 ? b : null
      });
    }
  }
  return matchups;
}
