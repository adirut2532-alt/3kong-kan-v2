import React, { useState, lazy, Suspense } from 'react';
import {auth} from './online.js';
export {db, firebase} from './online.js';

// Import core view components
import HomeView from './components/lobby/HomeView.jsx';
import {Brand} from './components/ui/GameUI.jsx';
const Login=lazy(()=>import('./components/Login.jsx'));
const Register=lazy(()=>import('./components/Register.jsx'));
const Lobby=lazy(()=>import('./components/Lobby.jsx'));
const GameRoom=lazy(()=>import('./components/GameRoom.jsx'));
const AdminPanel=lazy(()=>import('./components/AdminPanel.jsx'));
const PracticeRoom=lazy(()=>import('./components/PracticeRoom.jsx'));

export default function App() {
  const [screen, setScreen] = useState('home');
  const [loginTarget, setLoginTarget] = useState('lobby');
  const [player, setPlayer] = useState(null);
  const [memberId, setMemberId] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');

  function handleLoginSuccess(playerObj, userMemberId) {
    setPlayer(playerObj);
    setMemberId(userMemberId);
    setScreen(loginTarget);
  }

  function handleRegisterSuccess() {
    setScreen('login');
  }

  async function handleLogout() {
    await auth.signOut();
    sessionStorage.clear();
    setPlayer(null);
    setMemberId('');
    setScreen('login');
  }

  function handleEnterRoom(roomId) {
    setActiveRoomId(roomId);
    setScreen('game-room');
  }

  function handleExitRoom() {
    setScreen('lobby');
    setActiveRoomId('');
  }

  function handleEnterPractice() {
    setScreen('practice');
  }

  function handleExitPractice() {
    setScreen('lobby');
  }

  return (
    <div className="app-container game-ui"><Suspense fallback={<div className="game-loading" role="status"><Brand/><span>กำลังเตรียมโต๊ะ…</span></div>}>
      {screen === 'home' && <HomeView onStart={() => {setLoginTarget('lobby');setScreen('login');}} onPractice={() => {setLoginTarget('practice');setScreen('login');}}/>}
      {screen === 'login' && (
        <Login
          onBack={() => setScreen('home')}
          onLoginSuccess={handleLoginSuccess}
          navigateToRegister={() => setScreen('register')}
          navigateToAdmin={() => setScreen('admin')}
        />
      )}

      {screen === 'register' && (
        <Register
          onRegisterSuccess={handleRegisterSuccess}
          navigateToLogin={() => setScreen('login')}
        />
      )}

      {screen === 'lobby' && (
        <Lobby
          player={player}
          memberId={memberId}
          onEnterRoom={handleEnterRoom}
          onEnterPractice={handleEnterPractice}
          onLogout={handleLogout}
        />
      )}

      {screen === 'game-room' && (
        <GameRoom
          player={player}
          memberId={memberId}
          roomId={activeRoomId}
          onExit={handleExitRoom}
        />
      )}

      {screen === 'practice' && (
        <PracticeRoom
          player={player}
          onExit={handleExitPractice}
        />
      )}

      {screen === 'admin' && (
        <AdminPanel
          onBack={() => setScreen('login')}
        />
      )}
    </Suspense></div>
  );
}
