if(!process.env.FIRESTORE_EMULATOR_HOST || process.env.GCLOUD_PROJECT!=='demo-3kong-online')throw Error('Only the demo emulator may be seeded');
const admin=require('../functions/node_modules/firebase-admin');
const {createHash}=require('node:crypto');
admin.initializeApp({projectId:'demo-3kong-online'});
(async()=>{const db=admin.firestore(),batch=db.batch();
for(let i=0;i<2;i++)batch.set(db.doc('members/m_browser'+i),{name:'Browser'+i,avatar:i?'🐯':'🦊',active:true,approved:true,chips:10000,passwordHash:createHash('sha256').update('emulator-only-password').digest('hex'),createdAt:Date.now(),txns:[]});
batch.set(db.doc('rooms/BROWSER'),{onlineVersion:1,name:'โต๊ะทดสอบออนไลน์',status:'lobby',round:0,players:{},hands:{},scores:{},rate:5,commission:1,maxRounds:0});await batch.commit();console.log('Disposable browser demo ready');await admin.app().delete();})();
