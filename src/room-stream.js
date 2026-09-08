import {db} from './online.js';
import {mergePrivateRoom} from './utils/roomSnapshot.js';
// Only the current player's private documents are observed. Other hands appear in room at settlement.
export function subscribeRoom(roomId,uid,onRoom,onError) {
  const ref=db.collection('rooms').doc(roomId);
  let room=null, deal=null, hand=null, stopped=false;
  const emit=()=>{
    if(stopped||!room)return;
    const merged=mergePrivateRoom(room,uid,deal,hand);
    onRoom({exists:true,data:()=>merged});
  };
  const stops=[ref.onSnapshot(s=>{if(!s.exists){onRoom(s);return;}room=s.data();emit();},onError)];
  for(const kind of ['deals','hands'])stops.push(ref.collection(kind).doc(uid).onSnapshot(s=>{
    if(kind==='deals')deal=s.exists?s.data():null;else hand=s.exists?s.data():null;emit();
  },onError));
  return ()=>{stopped=true;stops.forEach(stop=>stop());};
}
