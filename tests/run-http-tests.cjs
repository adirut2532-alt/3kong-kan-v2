// HTTP integration harness for the actual exported onCall wrappers.
// Uses public Express APIs; does not patch Firebase CLI or bypass token validation.
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {spawn}=require('node:child_process');
const path=require('node:path');
const requireFunctions=createRequire(path.resolve('functions/index.js'));
assert.equal(process.env.GCLOUD_PROJECT,'demo-3kong-online');
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST&&process.env.FIRESTORE_EMULATOR_HOST);
const cloud=requireFunctions('./index.js');
const admin=requireFunctions('firebase-admin');
const express=requireFunctions('express');
const app=express();
app.use(express.json({verify:(req,res,bytes)=>{req.rawBody=bytes;}}));
for(const name of ['account','gameAction','leaderboard'])app.all('/demo-3kong-online/us-central1/'+name,cloud[name]);
const server=app.listen(5001,'127.0.0.1',()=>{
  const tests=process.argv.slice(2);
  (async()=>{
    for(const script of tests){
      await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,[script],{stdio:'inherit',env:process.env});
        child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(script+' exited '+code)));
      });
    }
  })().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{server.close();admin.app().delete();});
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;admin.app().delete();});
