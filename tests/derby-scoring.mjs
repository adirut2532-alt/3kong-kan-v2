import assert from 'node:assert/strict';
import { calcScores, cmpH, bonus, makeDeck } from '../src/utils/ruleEngine.js';
import { smartArrange } from '../src/utils/smartArrange.js';

// Independent pairwise oracle: x4 replaces x2 only on the Derby winner's pairs.
const players = Array.from({length:4}, (_,i)=>({id:String(i),name:String(i)}));
let seed=314159, derbyCases=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let deal=0;deal<60;deal++) {
  const deck=makeDeck();
  for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const hands=Object.fromEntries(players.map((p,i)=>[p.id,smartArrange(deck.slice(i*13,i*13+13))]));
  for(const count of [4,3,2]) {
    const active=players.slice(0,count), pairs=[], sweeps=Array(count).fill(0);
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++) {
      let base=0, wins=0, losses=0;
      for(const row of ['front','mid','back']) {
        const a=hands[i][row], b=hands[j][row], cmp=cmpH(a,b);
        if(cmp>0){base+=bonus(a,row).pts||1;wins++;}
        if(cmp<0){base-=bonus(b,row).pts||1;losses++;}
      }
      if(wins===3)sweeps[i]++;
      if(losses===3)sweeps[j]++;
      pairs.push({i,j,base,sweep:wins===3||losses===3});
    }
    const winner=count===4?sweeps.findIndex(x=>x===3):-1;
    if(winner>=0)derbyCases++;
    const expected=Array(count).fill(0);
    for(const {i,j,base,sweep} of pairs){
      const multiplier=(winner>=0&&(i===winner||j===winner))?4:sweep?2:1;
      expected[i]+=base*multiplier;expected[j]-=base*multiplier;
    }
    const scores=calcScores(active,hands);
    assert.deepEqual(scores.map(s=>s.roundScore),expected);
    assert.equal(scores.reduce((sum,s)=>sum+s.roundScore,0),0);
    assert.deepEqual(scores.map(s=>s.isDarby),active.map((_,i)=>i===winner));
  }
  // A fouled fourth player prevents Derby; foul payments stay six per opponent.
  const three=calcScores(players.slice(0,3),hands);
  const foulHands={...hands,3:{...hands[3],foul:true}};
  const withFoul=calcScores(players,foulHands);
  assert.deepEqual(withFoul.map(s=>s.roundScore),[...three.map(s=>s.roundScore+6),-18]);
  assert.ok(withFoul.every(s=>!s.isDarby));
}
assert.ok(derbyCases>0,'Fixtures must exercise Derby');
console.log(`Derby scoring: 60 deals, ${derbyCases} Derby cases; pairwise totals, 2/3-player tables and foul penalties passed`);
