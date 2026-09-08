const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('node:crypto');
const {promisify} = require('node:util');
admin.initializeApp();
const db = admin.firestore();
const scrypt = promisify(crypto.scrypt);
const service = import('./lib/game-service.mjs').then(m=>m.createGameService(db));
const error = (code,message)=>{throw new functions.https.HttpsError(code,message);};
const digest = text=>crypto.createHash('sha256').update(text).digest('hex');
const equal = (a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const memberId = name=>{
  if(typeof name!=='string'||!name.trim()||name.trim().length>125||name.includes('/')||Array.from(name).some(c=>c.charCodeAt(0)<32)) error('invalid-argument','ชื่อผู้ใช้ไม่ถูกต้อง');
  return 'm_'+name.trim().toLowerCase();
};
async function hashPassword(password) {
  const salt=crypto.randomBytes(16).toString('hex');
  return {salt,hash:(await scrypt(password,salt,64)).toString('hex')};
}
async function throttle(context,key) {
  // Server clock and transaction, shared across instances. No raw IP or password stored.
  const ip=context.rawRequest?.ip||'unknown';
  const refs=[db.collection('_authLimits').doc(digest('ip:'+ip)),db.collection('_authLimits').doc(digest('account:'+key))];
  await db.runTransaction(async tx=>{
    const snapshots=await Promise.all(refs.map(r=>tx.get(r))), now=Date.now();
    const rows=snapshots.map(s=>s.exists&&s.data().until>now?s.data():{count:0,until:now+15*60*1000});
    if(rows.some((r,i)=>r.count>=(i===0?100:15))) error('resource-exhausted','ลองหลายครั้งเกินไป กรุณารอ 15 นาที');
    refs.forEach((r,i)=>tx.set(r,{count:rows[i].count+1,until:rows[i].until}));
  });
}
const safePlayer = d=>({name:d.name,avatar:d.avatar||'🎴',chips:d.chips||0});
exports.account = functions.https.onCall(async(data,context)=>{
  const action=data?.action;
  if(action==='adminStatus') {
    const [a,b]=await Promise.all([db.doc('admin/config').get(),db.doc('config/admin').get()]);
    return {setup:!a.exists&&!b.exists};
  }
  const isAdmin=action==='adminLogin'||action==='adminSetup';
  const id=isAdmin?'admin_owner':memberId(data.username);
  const password=data.password;
  if(typeof password!=='string'||!password.length||password.length>256) error('invalid-argument','รหัสผ่านไม่ถูกต้อง');
  await throttle(context,id);
  const memberRef=db.collection('members').doc(id), secretRef=db.collection('_credentials').doc(id);
  let verifiedCreation,verifiedKey;
  if(action==='register') {
    if(password.length<6 || typeof data.email!=='string'||data.email.length>254||!data.email.includes('@')) error('invalid-argument','ตรวจสอบอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร');
    const secret=await hashPassword(password);
    await db.runTransaction(async tx=>{
      const m=await tx.get(memberRef);
      if(m.exists) error('already-exists','ชื่อผู้ใช้นี้มีผู้ใช้แล้ว');
      const avatar=['🦊','🐯','🐻','🐼','🐶','🐱','🐸','🦁'].includes(data.avatar)?data.avatar:'🦊';
      tx.set(memberRef,{sessionKey:crypto.randomBytes(16).toString('hex'),name:data.username.trim(),email:data.email.trim(),avatar,approved:false,active:true,chips:0,level:1,xp:0,games:0,wins:0,winRate:0,totalProfit:0,derbyCount:0,dragonCount:0,taluCount:0,createdAt:Date.now(),txns:[]});
      tx.set(secretRef,secret);
    });return {ok:true};
  }
  if(action==='adminSetup') {
    // Bootstrap is disabled unless the operator sets a one-time server secret.
    const setup=process.env.ADMIN_SETUP_TOKEN;
    if(!setup || !equal(digest(String(data.setupToken||'')),digest(setup))) error('permission-denied','รหัสติดตั้งระบบไม่ถูกต้อง');
    if(password.length<8) error('invalid-argument','รหัสผู้ดูแลต้องยาวอย่างน้อย 8 ตัวอักษร');
    const secret=await hashPassword(password);
    await db.runTransaction(async tx=>{
      const [a,b]=await Promise.all([tx.get(db.doc('admin/config')),tx.get(db.doc('config/admin'))]);
      if(a.exists||b.exists) error('already-exists','ตั้งค่าผู้ดูแลแล้ว');
      tx.set(db.doc('admin/config'),{configured:true,updatedAt:Date.now()});tx.set(secretRef,secret);
    });
  } else if(action==='login'||action==='adminLogin') {
    let ref=isAdmin?db.doc('admin/config'):memberRef;
    let snap=await ref.get();
    if(isAdmin&&!snap.exists){ref=db.doc('config/admin');snap=await ref.get();}
    const credentials=await secretRef.get(), d=snap.exists?snap.data():{};
    const secret=credentials.exists?credentials.data():null;
    // Accept legacy hashes only on the server, then migrate without changing member id/balance.
    const legacy=typeof d.passwordHash==='string';
    const valid=legacy?equal(d.passwordHash,digest(password)):secret&&equal(secret.hash,(await scrypt(password,secret.salt,64)).toString('hex'));
    if(!snap.exists||!valid||d.active===false) error('unauthenticated','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ');
    verifiedCreation=d.createdAt;verifiedKey=d.sessionKey;
    if(legacy) {
      const upgraded=await hashPassword(password);
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref);
        if(current.data()?.passwordHash!==d.passwordHash) error('aborted','บัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
        tx.set(secretRef,upgraded);tx.update(ref,{passwordHash:admin.firestore.FieldValue.delete()});
      });
    }
  } else error('invalid-argument','คำสั่งไม่ถูกต้อง');
  let memberKey;
  if(!isAdmin) {
    memberKey=await db.runTransaction(async tx=>{
      const current=await tx.get(memberRef);
      if(!current.exists||current.data().active===false)error('unauthenticated','บัญชีไม่พร้อมใช้งาน');
      if(current.data().createdAt!==verifiedCreation || (verifiedKey&&current.data().sessionKey!==verifiedKey))error('aborted','บัญชีเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
      if(current.data().sessionKey)return current.data().sessionKey;
      const key=crypto.randomBytes(16).toString('hex');tx.update(memberRef,{sessionKey:key});return key;
    });
  }
  const token=await admin.auth().createCustomToken(id,isAdmin?{admin:true}:{memberKey});
  return {token,memberId:id,...(!isAdmin?{player:safePlayer((await memberRef.get()).data())}:{})};
});
async function requireMember(context) {
  if(!context.auth)error('unauthenticated','กรุณาเข้าสู่ระบบ');
  const member=await db.collection('members').doc(context.auth.uid).get();
  if(!member.exists||member.data().active===false||!member.data().sessionKey||member.data().sessionKey!==context.auth.token?.memberKey)error('permission-denied','เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  return member;
}
exports.gameAction = functions.https.onCall(async(data,context)=>{
  await requireMember(context);
  try{return await (await service)(data||{},context.auth?.uid,context.auth?.token?.memberKey);}
  catch(e){if(e.code && ['invalid-argument','failed-precondition','unauthenticated','permission-denied','aborted','not-found','data-loss'].includes(e.code)) error(e.code,e.message);throw e;}
});
exports.leaderboard = functions.https.onCall(async(data,context)=>{
  await requireMember(context);
  const snap=await db.collection('members').orderBy('totalProfit','desc').limit(8).get();
  return snap.docs.map(s=>{const d=s.data();return {id:s.id,...safePlayer(d),totalProfit:d.totalProfit||0,level:d.level||1};});
});
