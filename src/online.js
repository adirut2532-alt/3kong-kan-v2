import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/functions';
import 'firebase/compat/firestore';
const config={
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY||'AIzaSyDUd1A3TyFBSSPGihdULbmnfTV6kvrOByY',
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN||'poker-kan.firebaseapp.com',
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID||'poker-kan',
  storageBucket:'poker-kan.firebasestorage.app',messagingSenderId:'267226971967',appId:'1:267226971967:web:3ae1891c63194a97715d8a'
};
if(!firebase.apps.length) firebase.initializeApp(config);
export const db=firebase.firestore();
export const auth=firebase.auth();
const functions=firebase.app().functions(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION||'us-central1');
if(import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS==='true') {
  if(!config.projectId.startsWith('demo-')) throw new Error('Emulators require a demo project');
  auth.useEmulator(window.location.origin,{disableWarnings:true});
  db.useEmulator(window.location.hostname,Number(window.location.port));
  functions.useEmulator(window.location.hostname,Number(window.location.port));
}
export {firebase};
export async function call(name,data={}) {
  try{return (await functions.httpsCallable(name,{timeout:25000})(data)).data;}
  catch(e){
    if(['functions/internal','functions/unavailable','functions/deadline-exceeded'].includes(e.code))throw new Error('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
    throw e;
  }
}
export async function signIn(data) {
  const result=await call('account',data);
  await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  await auth.signInWithCustomToken(result.token);
  return result;
}
export async function restorePlayer() {
  await new Promise(resolve=>{const stop=auth.onAuthStateChanged(()=>{stop();resolve();});});
  const user=auth.currentUser;
  if(!user || (await user.getIdTokenResult()).claims.admin) return null;
  const snap=await db.collection('members').doc(user.uid).get();
  if(!snap.exists||snap.data().active===false){await auth.signOut();return null;}
  const d=snap.data();return {memberId:user.uid,player:{name:d.name,avatar:d.avatar||'🎴',chips:d.chips||0}};
}
