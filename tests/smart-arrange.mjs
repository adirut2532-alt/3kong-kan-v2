import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {aiArrange} from '../src/utils/aiEngine.js';
import {evalHand,validArr,calcScores,SUIT_RANK} from '../src/utils/ruleEngine.js';
const previous=execFileSync('git',['show','654eb92eef50a04861c231fd4fbb4f869b535f9f:src/components/PracticeRoom.jsx'],{encoding:'utf8'});
const body=previous.slice(previous.indexOf('function botArrange'),previous.indexOf('export default'));
let seed=92713;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const oldBot=Function('evalHand','validArr','SUIT_RANK','Math',body+';return botArrange;')(evalHand,validArr,SUIT_RANK,{random,floor:Math.floor});
const deck=()=>['♠','♥','♦','♣'].flatMap(suit=>['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map((rank,i)=>({suit,rank,val:i+2})));
let total=0,roundsWon=0,ms=0;
for(let n=0;n<40;n++){
 const cards=deck();for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
 const own=cards.slice(0,13), before=JSON.stringify(own),start=performance.now();
 const smart=aiArrange(own);ms+=performance.now()-start;
 assert(validArr(smart.front,smart.mid,smart.back));
 assert.equal(JSON.stringify(own),before);
 assert.deepEqual([...smart.front,...smart.mid,...smart.back].map(c=>c.rank+c.suit).sort(),own.map(c=>c.rank+c.suit).sort());
 const old=oldBot(own), opponent=oldBot(cards.slice(13,26));
 const players=[{name:'self',id:'self'},{name:'opponent',id:'opponent'}];
 const score=h=>calcScores(players,{self:h,opponent}).find(p=>p.id==='self').roundScore;
 const delta=score(smart)-score(old);total+=delta;if(delta>0)roundsWon++;
}
assert.throws(()=>aiArrange(deck().slice(0,12)));
assert.throws(()=>aiArrange(Array(13).fill(deck()[0])));
console.log(JSON.stringify({hands:40,validHands:40,scoreDeltaAgainstOldBot:total,improvedDeals:roundsWon,averageMs:Math.round(ms/40)}));
