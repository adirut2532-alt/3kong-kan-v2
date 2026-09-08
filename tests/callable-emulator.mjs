import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
const require=createRequire(new URL('../functions/index.js',import.meta.url));
const admin=require('firebase-admin');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST&&process.env.FIRESTORE_EMULATOR_HOST,'Emulators required');
admin.initializeApp({projectId:'demo-3kong-online'});
const db=admin.firestore();
const clients=[];
const call=async(c,name,data)=>(await c.functions().httpsCallable(name)(data)).data;
const once=(ref,predicate)=>new Promise((resolve,reject)=>{let stop;const timer=setTimeout(()=>{stop?.();reject(Error('Snapshot timeout'));},15000);stop=ref.onSnapshot(s=>{if(predicate(s)){clearTimeout(timer);stop?.();resolve(s);}},e=>{clearTimeout(timer);reject(e);});});
try{
  for(let i=0;i<2;i++){
    const app=firebase.initializeApp({projectId:'demo-3kong-online',apiKey:'demo-key',authDomain:'demo-3kong-online.firebaseapp.com'},'transport'+i);
    app.auth().useEmulator('http://127.0.0.1:9099',{disableWarnings:true});
    app.firestore().useEmulator('127.0.0.1',8080);app.functions().useEmulator('127.0.0.1',5001);
    clients.push(app);
    await call(app,'account',{action:'register',username:'Transport'+i,email:'test@example.test',password:'emulator-password'});
    const result=await call(app,'account',{action:'login',username:'Transport'+i,password:'emulator-password'});
    await app.auth().signInWithCustomToken(result.token);
    assert.equal(app.auth().currentUser.uid,'m_transport'+i);
    const member=await app.firestore().doc('members/m_transport'+i).get();assert.equal(member.exists,true);
    await db.doc('members/m_transport'+i).update({chips:10000});
  }
  await db.doc('rooms/TRANSPORT').set({onlineVersion:1,status:'lobby',round:0,maxRounds:0,rate:5,commission:0,players:{},hands:{},deals:{},scores:{}});
  const act=(i,action,extra={})=>call(clients[i],'gameAction',{roomId:'TRANSPORT',round:1,action,...extra});
  await act(0,'join');await act(1,'join');await act(1,'ready');
  await assert.rejects(act(1,'deal',{round:0}));
  await act(0,'deal',{round:0});
  for(let i=0;i<2;i++){
    const snapshot=await once(clients[i].firestore().doc('rooms/TRANSPORT/deals/m_transport'+i),s=>s.exists);
    const cards=snapshot.data().cards;assert.equal(cards.length,13);
    await assert.rejects(clients[i].firestore().doc('rooms/TRANSPORT/deals/m_transport'+(1-i)).get());
    await act(i,'submit',{front:cards.slice(0,3),mid:cards.slice(3,8),back:cards.slice(8)});
  }
  const results=await Promise.all(clients.map(c=>once(c.firestore().doc('rooms/TRANSPORT'),s=>s.exists&&s.data().status==='results')));
  assert.deepEqual(results[0].data().scores,results[1].data().scores);
  assert.equal(results[0].data().hands.m_transport0.front.length,3);
  await act(0,'next');await act(0,'deal');
  const next=await once(clients[1].firestore().doc('rooms/TRANSPORT/deals/m_transport1'),s=>s.exists&&s.data().round===2);
  assert.equal(next.data().cards.length,13);
  console.log('PASS REAL CALLABLE TRANSPORT: 2 independent Auth clients -> join -> ready -> deal -> private cards -> submit -> same results -> next round');
}finally{await Promise.all(clients.map(c=>c.delete()));await admin.app().delete();}
