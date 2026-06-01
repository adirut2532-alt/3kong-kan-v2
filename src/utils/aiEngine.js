import { evalHand, bonus, validArr, isDragonHand } from './ruleEngine.js';

const PRESETS = {
  balanced: { front: 1.0, mid: 1.05, back: 1.12, derby: 1.0, dragon: 1.0, safety: 1.0 },
  derby: { front: 1.25, mid: 1.08, back: 1.05, derby: 2.1, dragon: 0.7, safety: 0.8 },
  safe: { front: 0.90, mid: 1.05, back: 1.28, derby: 0.6, dragon: 0.5, safety: 1.9 },
  dragon: { front: 1.0, mid: 1.0, back: 1.0, derby: 0.8, dragon: 2.8, safety: 1.0 },
  aggressive: { front: 1.60, mid: 1.02, back: 0.92, derby: 1.4, dragon: 0.6, safety: 0.85 },
  custom: { front: 1.0, mid: 1.0, back: 1.0, derby: 1.0, dragon: 1.0, safety: 1.0 }
};

// Generates combination sets (n choose k)
export function combos(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [f, ...r] = arr;
  return [...combos(r, k - 1).map(c => [f, ...c]), ...combos(r, k)];
}

export function aiArrange(cards, mode = 'balanced', customWeights = null) {
  const w = mode === 'custom' && customWeights ? { ...PRESETS.custom, ...customWeights } : (PRESETS[mode] || PRESETS.balanced);

  function getScore(h, row) {
    const e = evalHand(h);
    const b = bonus(h, row).pts;
    const rowW = row === 'front' ? w.front : row === 'mid' ? w.mid : w.back;
    return (e.rank * 10000 + b * 1500 + (e.key % 1000)) * rowW;
  }

  let best = -Infinity;
  let bestA = null;

  // 1. Choose 5 cards for back
  const backCombos = combos(cards, 5);
  for (const back of backCombos) {
    const r1 = cards.filter(c => !back.includes(c));
    // 2. Choose 5 cards for mid
    const midCombos = combos(r1, 5);
    for (const mid of midCombos) {
      const front = r1.filter(c => !mid.includes(c));
      
      if (front.length !== 3) continue;
      if (!validArr(front, mid, back)) continue;
      
      const rowPower = getScore(back, 'back') * 1000000 + getScore(mid, 'mid') * 1000 + getScore(front, 'front');
      const bonusPower = (bonus(front, 'front').pts + bonus(mid, 'mid').pts + bonus(back, 'back').pts) * 1200 * w.derby;
      const isDrag = new Set([...front, ...mid, ...back].map(c => c.val)).size === 13;
      const dragonPower = (isDrag ? 35000000 : 0) * w.dragon;
      const safetyPower = (evalHand(back).rank >= evalHand(mid).rank ? 12000 : 0) * w.safety;
      
      const sc = rowPower + bonusPower + dragonPower + safetyPower;
      
      if (sc > best) {
        best = sc;
        bestA = { front, mid, back };
      }
    }
  }

  // Fallback if no valid hands found (highly unlikely unless deck is somehow invalid, but serves as safeguard)
  return bestA || {
    back: cards.slice(0, 5),
    mid: cards.slice(5, 10),
    front: cards.slice(10, 13)
  };
}

export function handPower(cards, row) {
  const h = evalHand(cards || []);
  const b = bonus(cards || [], row).pts;
  const max = row === 'front' ? 55000 : 95000;
  return Math.min(100, Math.round(((h.rank * 10000) + (b * 2000) + ((h.key || 0) % 900)) / max * 100));
}

export function gradeFromPower(p) {
  return p >= 85 ? 'S' : p >= 68 ? 'A' : p >= 48 ? 'B' : p >= 30 ? 'C' : 'D';
}

export function aiAnalysis(hand, unplaced = [], mode = 'balanced') {
  const rows = [
    { key: 'front', label: 'หน้า' },
    { key: 'mid', label: 'กลาง' },
    { key: 'back', label: 'หลัง' }
  ];
  
  const filled = hand.front.length === 3 && hand.mid.length === 5 && hand.back.length === 5;
  const powers = rows.map(r => ({
    key: r.key,
    label: r.label,
    power: handPower(hand[r.key], r.key),
    name: evalHand(hand[r.key] || []).name || '-'
  }));
  
  const avg = Math.round(powers.reduce((a, x) => a + x.power, 0) / 3);
  const valid = filled && validArr(hand.front, hand.mid, hand.back);
  const dragon = isDragonHand(hand);
  
  const derbyProb = Math.max(4, Math.min(94, Math.round((powers[0].power * 0.45 + powers[1].power * 0.30 + powers[2].power * 0.25) * (valid ? 1 : 0.25))));
  const winProb = Math.max(8, Math.min(96, Math.round(avg * (valid ? 1 : 0.35) + (bonus(hand.front, 'front').pts + bonus(hand.mid, 'mid').pts + bonus(hand.back, 'back').pts) * 2.2)));
  const dragonProb = dragon ? 100 : Math.max(1, Math.min(45, new Set([...hand.front, ...hand.mid, ...hand.back, ...unplaced].map(c => c.val)).size * 2.5 - 12));
  
  let hint = 'จัดกองหลังให้แข็งกว่ากองกลางเสมอ เพื่อป้องกันการฟาวล์ ⚠️';
  let smartSuggestion = null;

  if (!filled) {
    hint = 'จัดไพ่ให้ครบ 3-5-5 แล้วระบบ AI จะประเมินระดับการเล่นและวิเคราะห์ให้ทันทีครับ 📊';
  } else if (!valid) {
    hint = '⚠️ แจ้งเตือน: ตอนนี้ไพ่ฟาวล์! ลองสลับกองกลางหรือกด "Safe Mode" เพื่อความปลอดภัย';
    smartSuggestion = {
      action: 'suggest',
      message: 'กดปุ่ม "Suggest" เพื่อให้ AI ช่วยสลับตำแหน่งลดการฟาวล์ทันที'
    };
  } else {
    // Generates smart hint feedback by simulating minor card swaps
    if (mode === 'balanced') {
      hint = 'การจัดไพ่ของคุณอยู่ในระดับที่ปลอดภัยดีแล้ว! 🛡️';
    } else if (mode === 'derby') {
      hint = 'Derby Mode เน้นผลักไพ่คู่หรือตองขึ้นกองหน้าเพื่อกวาดชิปรวดทุกคน! 🏆';
    } else if (mode === 'dragon') {
      hint = 'โหมด Dragon Hunter พยายามรักษาไพ่ไม่ซ้ำแต้มกันเพื่อสะสมคะแนนมังกร 🐉';
    }

    // Proactive hint logic: check if swapping a card from front to mid or mid to back yields better Win Prob
    // We can suggest minor tweaks if user missed a higher EV layout
    const all = [...hand.front, ...hand.mid, ...hand.back];
    const bestArr = aiArrange(all, mode);
    const bestValid = validArr(bestArr.front, bestArr.mid, bestArr.back);
    
    if (bestValid) {
      const bestAvg = Math.round((handPower(bestArr.front, 'front') + handPower(bestArr.mid, 'mid') + handPower(bestArr.back, 'back')) / 3);
      if (bestAvg > avg + 4) {
        hint = `💡 แนะนำ: มีการจัดไพ่ในโหมด ${mode === 'balanced' ? 'Auto EV' : mode} ที่เพิ่มแต้มเฉลี่ยได้ถึง ${bestAvg - avg}%!`;
        smartSuggestion = {
          action: 'optimize',
          message: `ลองขยับไพ่ตระกูล ${bestArr.front[0]?.rank || 'สูง'} ขึ้นไปกองหน้าเพื่อเสริมพลังปะทะ`
        };
      }
    }
  }

  return {
    powers,
    winProb,
    derbyProb,
    dragonProb,
    hint,
    valid,
    smartSuggestion
  };
}
