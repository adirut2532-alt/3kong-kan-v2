import assert from 'node:assert/strict';
import {mergePrivateRoom,handsByPlayerName} from '../src/utils/roomSnapshot.js';
const room={status:'playing',round:2,deals:{a:true,b:true},hands:{a:{done:true}}};
const old={round:1,cards:['old']},fresh={round:2,cards:['private']};
assert.equal(mergePrivateRoom(room,'a',old,null).deals.a,undefined);
assert.equal(mergePrivateRoom(room,'a',fresh,null).deals.b,true);
assert.deepEqual(mergePrivateRoom(room,'a',fresh,{round:2,front:['mine']}).hands.a.front,['mine']);
assert.equal(mergePrivateRoom(room,'b',null,null).hands.a.front,undefined);
assert.equal(room.deals.a,true);
const results={...room,status:'results',hands:{a:{front:['revealed']}}};
assert.deepEqual(mergePrivateRoom(results,'a',old,null),results);
console.log('PASS client stream: stale-round cards withheld, own hand restored, opponents private, results revealed');

const collision=[{id:'m_alice',name:'Alice'},{id:'m_m_alice',name:'m_alice'}];
const ownHands={m_alice:{front:['A']},m_m_alice:{front:['B']}};
assert.deepEqual(handsByPlayerName(collision,ownHands),{Alice:{front:['A']},m_alice:{front:['B']}});
console.log('PASS player-name/member-id collision does not change hand ownership');
