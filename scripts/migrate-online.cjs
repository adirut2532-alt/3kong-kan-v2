// Read-only by default. Run only after a managed Firestore export and maintenance window.
const admin=require('../functions/node_modules/firebase-admin');
const project=process.env.GCLOUD_PROJECT;
if(!project)throw Error('Set GCLOUD_PROJECT explicitly; no default production project');
const apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--balances-reconciled'))throw Error('Reconcile any legacy unsettled chip payments before --apply --balances-reconciled');
admin.initializeApp({projectId:project});
(async()=>{
  const db=admin.firestore(), rooms=await db.collection('rooms').get();
  const legacy=rooms.docs.filter(s=>s.data().onlineVersion!==1);
  if(legacy.some(s=>s.data().status==='playing'))throw Error('Finish ALL legacy rounds before migration. No active room will be modified.');
  console.log(JSON.stringify({project,mode:apply?'apply':'dry-run',legacyRooms:legacy.map(s=>s.id)}));
  if(!apply)return;
  for(const room of legacy){
    // Each room transaction rechecks state, archives old history, and sanitizes before becoming readable.
    await db.runTransaction(async tx=>{
      const [current,history]=await Promise.all([tx.get(room.ref),tx.get(room.ref.collection('history').doc('details'))]);
      if(!current.exists||current.data().onlineVersion===1)return;
      const d=current.data();if(d.status==='playing')throw Error('Room started during migration; abort');
      const rounds=[...(d.roundHistory||[]),...(history.exists?history.data().roundHistory||[]:[])];
      const unique=new Map(rounds.map(r=>[r.round,r]));
      if(unique.size>400)throw Error('History exceeds safe per-room transaction size; migrate in a dedicated batch job first');
      for(const [round,summary]of unique)tx.set(room.ref.collection('rounds').doc(String(round)),summary);
      const deals=Object.fromEntries(Object.keys(d.deals||{}).map(id=>[id,true]));
      tx.update(room.ref,{onlineVersion:1,deals,hands:d.status==='results'?d.hands||{}:{},roundHistory:admin.firestore.FieldValue.delete()});
    });
    console.log('Migrated room',room.id);
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>admin.app().delete());
