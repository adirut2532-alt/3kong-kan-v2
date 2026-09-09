import React from 'react';
import { createRoot } from 'react-dom/client';
import PracticeRoom from '../src/components/PracticeRoom.jsx';
import '../src/styles/premium.css';
import '../src/styles/tokens.css';import '../src/styles/ui.css';import '../src/styles/auth.css';import '../src/styles/game.css';
import '../src/styles/game-room-v2.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><div className="game-ui"><PracticeRoom player={{name:'ผู้เล่นทดสอบ',avatar:'🦊'}} onExit={()=>{window.location.href='/qa.html';}} /></div></React.StrictMode>);
