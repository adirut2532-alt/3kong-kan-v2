import {evalHand,bonus,validArr} from './ruleEngine.js';

const profiles={balanced:[1,1,1,.45],aggressive:[1.35,1,.9,.2],derby:[1.15,1.1,1.05,.9],safe:[1,1.05,1.1,1.3],dragon:[1,1,1,.45]};
// Search uses only the caller's thirteen cards. Cached evaluations are local to a hand.
export function smartArrange(cards,mode='balanced',weights=null) {
  if(cards.length!==13||new Set(cards.map(c=>c.rank+c.suit)).size!==13)throw new Error('ต้องใช้ไพ่ไม่ซ้ำกันครบ 13 ใบ');
  const groups=new Map(),fives=[];
  function collect(start,left,mask,chosen) {
    if(!left){
      const e=evalHand(chosen),front=chosen.length===3;
      const rank=front?(e.rank===6?8:e.rank===5?3:e.rank===2?1:0):e.rank;
      const b=front?bonus(chosen,'front').pts:bonus(chosen,'back').pts;
      const m=front?0:bonus(chosen,'mid').pts;
      const g={cards:chosen,mask,e,rank,b,m};groups.set(mask,g);if(!front)fives.push(g);return;
    }
    for(let i=start;i<=13-left;i++)collect(i+1,left-1,mask|(1<<i),[...chosen,cards[i]]);
  }
  collect(0,3,0,[]);collect(0,5,0,[]);
  // Rank within each category keeps all kickers and suit tie-breaks relevant.
  for(const size of [3,5]){
    const sorted=[...groups.values()].filter(g=>g.cards.length===size).sort((a,b)=>a.e.rank-b.e.rank||a.e.key-b.e.key||a.e.suit-b.e.suit);
    for(let i=0;i<sorted.length;i++)sorted[i].strength=(i+.5)/sorted.length;
  }
  const profile=profiles[mode]||profiles.balanced;
  const w=mode==='custom'&&weights?[weights.front??1,weights.mid??1,weights.back??1,weights.safety??.45]:profile;
  let best=null,bestScore=-Infinity;
  for(const back of fives){
    const remaining=8191^back.mask;
    const indices=[];for(let i=0;i<13;i++)if(remaining&(1<<i))indices.push(i);
    // Choose the three front cards from the remaining eight; middle is the complement.
    for(let a=0;a<6;a++)for(let b=a+1;b<7;b++)for(let c=b+1;c<8;c++){
      const front=groups.get((1<<indices[a])|(1<<indices[b])|(1<<indices[c]));
      const mid=groups.get(remaining^front.mask);
      if(mid.rank<front.rank||back.rank<mid.rank)continue;
      if(mid.rank===front.rank&&mid.e.key<front.e.key)continue;
      if(back.rank===mid.rank&&back.e.key<mid.e.key)continue;
      const f=front.strength,m=mid.strength,r=back.strength;
      const score=2*f*w[0]+m*w[1]+r*w[2]+w[3]*Math.min(f,m,r)
        +.18*(front.b*f+mid.m*m+back.b*r)*(weights?.derby??1);
      if(score>bestScore){bestScore=score;best={front:front.cards,mid:mid.cards,back:back.cards};}
    }
  }
  if(!best||!validArr(best.front,best.mid,best.back))throw new Error('ไม่พบการจัดไพ่ที่ถูกกติกา');
  return best;
}
