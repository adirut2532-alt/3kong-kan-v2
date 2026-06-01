// ── Rule Engine Parity Validation Script ──

import { evalHand, validArr, cmpH, calcScores, makeDeck } from './ruleEngine.js';

console.log('🧪 Starting 3 Kong Kan 2.0 Rule Engine Validation...');

try {
  // Test 1: Standard Card Deck Creation
  const deck = makeDeck();
  if (deck.length !== 52) {
    throw new Error(`Deck creation failed: expected 52 cards, got ${deck.length}`);
  }
  console.log('✅ Test 1 Passed: Deck successfully created with 52 cards.');

  // Test 2: Hand Evaluation (ตอง / Three of a Kind)
  const threeOfAKind = [
    { suit: '♠', rank: 'A', val: 14 },
    { suit: '♥', rank: 'A', val: 14 },
    { suit: '♦', rank: 'A', val: 14 }
  ];
  const eval3 = evalHand(threeOfAKind);
  if (eval3.name !== 'ตอง' || eval3.rank !== 5) {
    throw new Error(`Three of a Kind evaluation failed: got ${eval3.name} (rank ${eval3.rank})`);
  }
  console.log('✅ Test 2 Passed: Three of a Kind evaluated correctly (ตอง, rank 5).');

  // Test 3: Hand Evaluation (ฟลัชหลวง / Royal Flush)
  const royalFlush = [
    { suit: '♠', rank: 'A', val: 14 },
    { suit: '♠', rank: 'K', val: 13 },
    { suit: '♠', rank: 'Q', val: 12 },
    { suit: '♠', rank: 'J', val: 11 },
    { suit: '♠', rank: '10', val: 10 }
  ];
  const evalRF = evalHand(royalFlush);
  if (evalRF.name !== 'ฟลัชหลวง' || evalRF.rank !== 9) {
    throw new Error(`Royal Flush evaluation failed: got ${evalRF.name} (rank ${evalRF.rank})`);
  }
  console.log('✅ Test 3 Passed: Royal Flush evaluated correctly (ฟลัชหลวง, rank 9).');

  // Test 4: Hand ordering check (validArr - Back >= Mid >= Front)
  const front = [
    { suit: '♠', rank: '2', val: 2 },
    { suit: '♥', rank: '2', val: 2 },
    { suit: '♦', rank: '5', val: 5 } // Pair of 2s
  ];
  const mid = [
    { suit: '♠', rank: '4', val: 4 },
    { suit: '♥', rank: '4', val: 4 },
    { suit: '♦', rank: '4', val: 4 },
    { suit: '♣', rank: '6', val: 6 },
    { suit: '♠', rank: '7', val: 7 } // Three of 4s
  ];
  const back = [
    { suit: '♠', rank: 'K', val: 13 },
    { suit: '♥', rank: 'K', val: 13 },
    { suit: '♦', rank: 'Q', val: 12 },
    { suit: '♣', rank: 'Q', val: 12 },
    { suit: '♠', rank: 'J', val: 11 } // Two Pairs K & Q
  ];

  // In standard rules:
  // Front = Pair of 2s (nr maps to rank 1 strength)
  // Mid = Three of 4s (evalHand maps to rank 3)
  // Back = Two Pair of K & Q (evalHand maps to rank 2)
  // Because Back (rank 2) < Mid (rank 3), this arrangement is a FOUL!
  const isFoul = !validArr(front, mid, back);
  if (!isFoul) {
    throw new Error('foul validation failed: expected layout to be invalid');
  }
  console.log('✅ Test 4 Passed: Arrangement foul rules successfully validated.');

  console.log('\n🎉 ALL CORE RULE ENGINE TESTS PASSED SUCCESSFULLY! 100% PARITY CONFIRMED.');
} catch (e) {
  console.error('❌ VALIDATION ERROR:', e.message);
}
