import {randomInt} from 'node:crypto';
import {makeDeck, calcScores, validArr, isDragonHand} from './ruleEngine.mjs';

export class GameError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (message, code='failed-precondition') => { throw new GameError(code, message); };
const money = n => Math.round(n * 100) / 100;
const active = room => Object.entries(room.players || {}).map(([id,p])=>({...p,id})).filter(p=>!p.isSpectator&&!p.isQueue);
const participant = (room, uid) => active(room).find(p=>p.id===uid);
const refId = value => typeof value==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

// Same payout, commission, statistics and XP as the original GameRoom.settleScores.
export function payout(member, player, score, hand, room, roomId, now) {
  const gross = score.roundScore * (room.rate || 1);
  const commission = gross>0 ? gross*(room.commission||0)/100 : 0;
  const amount = money(gross-commission);
  const chips = money((member.chips||0)+amount);
  const games=(member.games||0)+1, wins=(member.wins||0)+(amount>0?1:0);
  const dragon=isDragonHand(hand), derby=score.isDarby||false, talu=score.taluCount||0;
  let xp=(member.xp||0)+25+(amount>0?25:0)+(talu>0?30:0)+(derby?75:0)+(dragon?100:0);
  let level=member.level||1;
  while(xp>=250){xp-=250;level++;}
  return {amount, update:{chips,games,wins,winRate:Math.round(wins/games*100),
    totalProfit:money((member.totalProfit||0)+amount),dragonCount:(member.dragonCount||0)+(dragon?1:0),
    derbyCount:(member.derbyCount||0)+(derby?1:0),taluCount:(member.taluCount||0)+talu,level,xp,
    txns:[...(member.txns||[]),{t:now,ty:amount>=0?'win':'lose',amt:Math.abs(amount),bal:chips,
      note:`รอบ ${room.round} ห้อง #${roomId} (คะแนน ${score.roundScore} x ${room.rate||1}${commission>0?` - ต๋ง ${room.commission}%`:''})`}].slice(-30)}};
}

export function createGameService(db, {now=Date.now, shuffle=cards=>{
  for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];} return cards;
}}={}) {
  return async function gameAction(data, uid, memberKey) {
    if(!uid) fail('กรุณาเข้าสู่ระบบ', 'unauthenticated');
    if(!refId(data.roomId)) fail('รหัสห้องไม่ถูกต้อง','invalid-argument');
    const roomRef=db.collection('rooms').doc(data.roomId);
    const actorRef=db.collection('members').doc(uid);
    return db.runTransaction(async tx=>{
      const [rs, ms]=await Promise.all([tx.get(roomRef),tx.get(actorRef)]);
      if(!ms.exists || ms.data().active===false || (memberKey!==undefined && ms.data().sessionKey!==memberKey)) fail('บัญชีนี้ไม่พร้อมใช้งาน','permission-denied');
      if(!rs.exists) fail('ห้องนี้ปิดแล้ว','not-found');
      const room=rs.data(), member=ms.data(), stamp=now();
      if(room.status==='closed') fail('ห้องนี้ปิดแล้ว','not-found');
      if(room.onlineVersion!==1) fail('ห้องนี้กำลังรออัปเดตระบบออนไลน์');
      const players={...(room.players||{})}, me=participant(room,uid), action=data.action;
      const need=35*(room.rate||1);
      const checkRound=()=>{if(data.round!==room.round) fail('รอบเปลี่ยนแล้ว กรุณารอข้อมูลล่าสุด','aborted');};
      const host=()=>{if(!me?.isHost) fail('เฉพาะหัวห้องเท่านั้น','permission-denied');};
      const handsRef=id=>roomRef.collection('hands').doc(id);
      const dealRef=id=>roomRef.collection('deals').doc(id);

      if(action==='join') {
        if(me) return {ok:true};
        if(room.status==='playing') fail('รอจบรอบก่อนเข้าร่วม');
        if(active(room).length>=4) fail('โต๊ะเต็มแล้ว');
        if((member.chips||0)<need) fail(`ต้องมีชิปอย่างน้อย ${need} ชิป`);
        players[uid]={name:member.name,avatar:member.avatar||'🎴',chips:member.chips||0,isSpectator:false,isQueue:false,
          ready:false,isHost:!active(room).some(p=>p.isHost),lastSeen:stamp};
        tx.update(roomRef,{players}); return {ok:true};
      }
      if(!me) fail('คุณไม่ได้ร่วมเล่นในห้องนี้','permission-denied');
      if(action==='heartbeat') {
        players[uid]={...players[uid],lastSeen:stamp,chips:member.chips||0};
        const current=active(room).find(p=>p.isHost);
        if(!current || stamp-(current.lastSeen||0)>75000) {
          for(const p of active(room)) players[p.id]={...players[p.id],isHost:p.id===uid};
        }
        tx.update(roomRef,{players}); return {ok:true};
      }
      if(action==='ready') {
        if(room.status!=='lobby') fail('รอบเริ่มแล้ว');
        if((member.chips||0)<need) fail(`ต้องมีชิปอย่างน้อย ${need} ชิป`);
        players[uid]={...players[uid],ready:true,lastSeen:stamp,chips:member.chips||0};
        tx.update(roomRef,{players}); return {ok:true};
      }
      if(action==='leave') {
        if(room.status==='playing') return {ok:true,retained:true};
        delete players[uid];
        if(me.isHost){const next=Object.keys(players).find(id=>!players[id].isSpectator&&!players[id].isQueue);if(next) players[next]={...players[next],isHost:true};}
        tx.update(roomRef,{players}); return {ok:true};
      }
      if(action==='emoji') {
        const emoji=String(data.emoji||'');
        if(!emoji || emoji.length>16) fail('อีโมจิไม่ถูกต้อง','invalid-argument');
        players[uid]={...players[uid],emojiReaction:emoji,emojiAt:stamp};
        tx.update(roomRef,{players}); return {ok:true};
      }
      if(action==='close') {
        host(); checkRound();
        if(room.status==='playing') fail('ต้องจบรอบก่อนปิดห้อง');
        // Archive under the same id. Subcollections cannot accidentally attach to a reused id.
        tx.update(roomRef,{status:'closed',closedAt:stamp}); return {ok:true};
      }
      if(action==='next') {
        host();checkRound();
        if(room.status!=='results') fail('ยังไม่จบรอบ');
        if(room.maxRounds>0 && room.round>=room.maxRounds) fail('เล่นครบกำหนดรอบแล้ว');
        for(const id of Object.keys(players)) players[id]={...players[id],ready:false};
        tx.update(roomRef,{status:'lobby',players,hands:{},deals:{},scores:{}});return {ok:true};
      }
      if(action==='deal') {
        host();checkRound();
        if(room.status!=='lobby') fail('รอบเริ่มแล้ว');
        if(room.maxRounds>0 && room.round>=room.maxRounds) fail('เล่นครบกำหนดรอบแล้ว');
        const list=active(room);
        if(list.length<2||list.length>4) fail('ต้องมีผู้เล่น 2–4 คน');
        // Preserve original host-start behavior: readiness remains an indicator, not a new rule.
        const members=await Promise.all(list.map(p=>tx.get(db.collection('members').doc(p.id))));
        if(members.some(s=>!s.exists||s.data().active===false||(s.data().chips||0)<need)) fail('มีผู้เล่นชิปไม่พอหรือบัญชีถูกระงับ');
        const cards=shuffle(makeDeck()), round=(room.round||0)+1, deals={};
        list.forEach((p,i)=>{
          deals[p.id]=true;
          tx.set(dealRef(p.id),{round,cards:cards.slice(i*13,i*13+13)});
          tx.delete(handsRef(p.id));
          players[p.id]={...players[p.id],chips:members[i].data().chips||0};
        });
        tx.update(roomRef,{status:'playing',round,players,deals,hands:{},scores:{}}); return {ok:true,round};
      }
      checkRound();
      if(!room.deals?.[uid]) fail('คุณไม่ได้รับไพ่ในรอบนี้','permission-denied');
      if(room.status==='results' && room.settledRound===room.round && ['submit','settle'].includes(action)) return {ok:true,settled:true};
      if(room.status!=='playing') fail('รอบนี้ไม่ได้อยู่ระหว่างจัดไพ่');
      const list=active(room).filter(p=>room.deals?.[p.id]);
      if(list.length<2) fail('ข้อมูลผู้ร่วมรอบไม่ครบ');
      const snapshots=await Promise.all(list.map(p=>tx.get(handsRef(p.id))));
      const hands={};
      list.forEach((p,i)=>{if(snapshots[i].exists && snapshots[i].data().round===room.round) hands[p.id]=snapshots[i].data();});
      const publicHands={...(room.hands||{})};
      if(action==='cancel') {
        delete publicHands[uid];tx.delete(handsRef(uid));tx.update(roomRef,{hands:publicHands});return {ok:true};
      }
      let submitted;
      if(action==='submit') {
        const ds=await tx.get(dealRef(uid));
        if(!ds.exists || ds.data().round!==room.round) fail('ไม่พบไพ่รอบนี้');
        const official=ds.data().cards, rows=['front','mid','back'], lengths=[3,5,5];
        const key=c=>`${c?.rank}:${c?.suit}:${c?.val}`;
        if(rows.some((r,i)=>!Array.isArray(data[r])||data[r].length!==lengths[i])) fail('กรุณาจัดไพ่ 3–5–5 ให้ครบ','invalid-argument');
        const all=rows.flatMap(r=>data[r]);
        if(all.map(key).sort().join('|')!==official.map(key).sort().join('|')) fail('ชุดไพ่ไม่ตรงกับไพ่ที่แจก','permission-denied');
        const canonical=new Map(official.map(c=>[key(c),c]));
        submitted=Object.fromEntries(rows.map(r=>[r,data[r].map(c=>canonical.get(key(c)))]));
        submitted={...submitted,round:room.round,done:true,foul:!validArr(submitted.front,submitted.mid,submitted.back)};
        if(hands[uid]?.done && JSON.stringify(rows.map(r=>hands[uid][r]))!==JSON.stringify(rows.map(r=>submitted[r]))) fail('ส่งไพ่แล้ว กรุณาดึงกลับก่อนแก้');
        hands[uid]=submitted;publicHands[uid]={done:true};
      } else if(action!=='settle') fail('คำสั่งไม่ถูกต้อง','invalid-argument');
      const complete=list.every(p=>hands[p.id]?.done);
      if(!complete) {
        if(submitted){tx.set(handsRef(uid),submitted);tx.update(roomRef,{hands:publicHands});}
        return {ok:true,settled:false};
      }
      // Read every balance and ledger BEFORE any write. Conflicts retry the entire transaction.
      const ledger=roomRef.collection('settlements').doc(String(room.round));
      const [existing,...memberDocs]=await Promise.all([tx.get(ledger),...list.map(p=>tx.get(db.collection('members').doc(p.id)))]);
      if(existing.exists) fail('ข้อมูลรอบไม่สอดคล้อง กรุณาติดต่อผู้ดูแล','data-loss');
      if(memberDocs.some(s=>!s.exists)) fail('ไม่พบบัญชีผู้ร่วมรอบ กรุณาติดต่อผู้ดูแล');
      // No alternative rule implementation: byte-identical deployed copy of the original engine.
      const engineHands=Object.fromEntries(list.map(p=>[p.name,hands[p.id]]));
      const scores=calcScores(list,engineHands), totals={...(room.scores||{})};
      const updates=list.map((p,i)=>payout(memberDocs[i].data(),p,scores.find(s=>s.id===p.id),hands[p.id],room,data.roomId,stamp));
      if(submitted) tx.set(handsRef(uid),submitted);
      list.forEach((p,i)=>{
        tx.update(db.collection('members').doc(p.id),updates[i].update);
        totals[p.id]=money((totals[p.id]||0)+updates[i].amount);
        players[p.id]={...players[p.id],chips:updates[i].update.chips};
      });
      const summary={round:room.round,hands,scores:scores.map(s=>({id:s.id,name:s.name,avatar:s.avatar||'🎴',roundScore:s.roundScore,bonusLabel:s.bonusLabel||''})),timestamp:stamp};
      tx.set(ledger,{round:room.round,amounts:Object.fromEntries(list.map((p,i)=>[p.id,updates[i].amount])),timestamp:stamp});
      tx.set(roomRef.collection('rounds').doc(String(room.round)),summary);
      tx.update(roomRef,{status:'results',settledRound:room.round,scores:totals,players,hands});
      return {ok:true,settled:true};
    });
  };
}
