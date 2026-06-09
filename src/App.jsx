import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// ── Firebase Client SDK Initialization ──
const firebaseConfig = {
  apiKey: "AIzaSyDUd1A3TyFBSSPGihdULbmnfTV6kvrOByY",
  authDomain: "poker-kan.firebaseapp.com",
  projectId: "poker-kan",
  storageBucket: "poker-kan.firebasestorage.app",
  messagingSenderId: "267226971967",
  appId: "1:267226971967:web:3ae1891c63194a97715d8a"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export { firebase };

// Import core view components
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import Lobby from './components/Lobby.jsx';
import GameRoom from './components/GameRoom';
import AdminPanel from './components/AdminPanel.jsx';
import PracticeRoom from './components/PracticeRoom.jsx';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [player, setPlayer] = useState(null);
  const [memberId, setMemberId] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');

  function handleLoginSuccess(playerObj, userMemberId) {
    setPlayer(playerObj);
    setMemberId(userMemberId);
    setScreen('lobby');
  }

  function handleRegisterSuccess() {
    setScreen('login');
  }

  function handleLogout() {
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
    <div className="app-container">
      {screen === 'login' && (
        <Login
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
    </div>
  );
}
