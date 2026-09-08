import React from 'react';
import {createRoot} from 'react-dom/client';
import {signIn} from '../src/online.js';
import GameRoom from '../src/components/GameRoom.jsx';
import '../src/styles/premium.css';
import '../src/styles/tokens.css';
import '../src/styles/ui.css';
import '../src/styles/game.css';
import '../src/styles/game-room-v2.css';
// Disposable emulator identities only. This entry is excluded from production build.
const root=createRoot(document.getElementById('root'));
if(import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS==='true' && import.meta.env.VITE_FIREBASE_PROJECT_ID==='demo-3kong-online'){
  const id=new URLSearchParams(location.search).get('player')==='1'?1:0;
  signIn({action:'login',username:'Browser'+id,password:'emulator-only-password'}).then(r=>root.render(<div className="app-container game-ui"><GameRoom player={r.player} memberId={r.memberId} roomId="BROWSER" onExit={()=>root.render(<p>ออกจากห้องแล้ว</p>)}/></div>)).catch(e=>root.render(<p role="alert">{e.message}</p>));
}else root.render(<p>Emulator only</p>);
