// Presentation-only fixture. Never imports App, Firebase, or GameRoom controller.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import GameRoomView from '../src/components/game/GameRoomView.jsx';
import {RANK_VAL} from '../src/utils/ruleEngine.js';
import '../src/styles/premium.css';
import '../src/styles/tokens.css';
import '../src/styles/ui.css';
import '../src/styles/game.css';
import '../src/styles/game-room-v2.css';
const players=[{id:'a',name:'ผู้เล่น',avatar:'🦊',chips:1000,isHost:true,ready:true},{id:'b',name:'เพื่อนทดสอบ',avatar:'🐱',chips:1000,ready:true}];
if(new URLSearchParams(window.location.search).get('players')==='4') players.push({id:'c',name:'มะลิ',avatar:'🐰',chips:1000,ready:true},{id:'d',name:'ต้น',avatar:'🐯',chips:1000,ready:false});
const c=(rank,suit)=>({rank,suit,val:RANK_VAL[rank]});
const handA={front:[c('2','♣'),c('5','♦'),c('9','♥')],mid:[c('3','♣'),c('3','♦'),c('6','♥'),c('8','♠'),c('J','♣')],back:[c('Q','♣'),c('Q','♦'),c('Q','♥'),c('A','♠'),c('K','♠')],unplaced:[],done:false,foul:false};
const handB={front:[c('2','♥'),c('4','♣'),c('8','♦')],mid:[c('5','♣'),c('5','♥'),c('7','♦'),c('9','♠'),c('10','♣')],back:[c('J','♦'),c('J','♠'),c('K','♣'),c('A','♦'),c('A','♥')],unplaced:[],done:true,foul:false};
const hands={a:handA,b:handB};
const noop=()=>{};
function Fixture(){
 const [status,setStatus]=useState('lobby'),[chatOpen,setChatOpen]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[chatMsg,setChatMsg]=useState(''),[soundVolume,setSoundVolume]=useState(.5),[speechMuted,setSpeechMuted]=useState(false);
 const ghostRef=useRef(),ghostNumRef=useRef(),ghostSuitRef=useRef();
 const roomHands=status==='playing'?{a:{...handA,done:false},b:handB}:hands;
 const room={status,rate:10,round:1,maxRounds:4,commission:0,hands:roomHands,deals:{a:true,b:true}};
 const hand={...hands.a,done:status!=='playing'};
 const renderCard=(c,i,zone)=><div key={i} data-card-zone={zone} data-card-idx={i} className={`poker-card ${['♥','♦'].includes(c.suit)?'red-card':'black-card'}`}><span className="card-num">{c.rank}</span><span className="card-suit">{c.suit}</span></div>;
 return <div className="game-ui"><GameRoomView {...{room,players,hand,renderCard,ghostRef,ghostNumRef,ghostSuitRef,chatOpen,setChatOpen,historyOpen,setHistoryOpen,chatMsg,setChatMsg,soundVolume,setSoundVolume,speechMuted,setSpeechMuted}} myId="a" isHost player={players[0]} roomId="TEST" myChips={1000} seats={[{player:players[1],pos:'felt-pos-top'},{player:players[2]||null,pos:'felt-pos-left'},{player:players[3]||null,pos:'felt-pos-right'}]} selectedCard={null} floatingEmojis={[]} undoStack={[]} chatList={[]} historyList={[]} handleExitRoom={()=>setStatus('lobby')} handleHostStart={()=>setStatus('playing')} handleSubmitHand={()=>setStatus('results')} handleNextRound={()=>setStatus('playing')} handleCloseRoom={()=>setStatus('lobby')} joinActive={noop} setReadyState={noop} moveCardTo={noop} handleSwapMidBack={noop} handleAutoArrange={noop} handleUndo={noop} handleReset={noop} handleCancelSubmit={noop} handleSendEmoji={noop} handleSendChat={noop}/></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
