import React, { useState, useEffect, useRef } from 'react';
import {db,call} from '../online.js';
import LobbyView from './lobby/LobbyView.jsx';

const CHIP_MULT = 35;

export default function Lobby({ player, memberId, onEnterRoom, onEnterPractice, onLogout }) {
  const [error,setError]=useState('');
  const [chips, setChips] = useState(player.chips || 0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [games, setGames] = useState(0);
  const [wins, setWins] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [filter, setFilter] = useState('all');

  const unsubRooms = useRef(null);
  const unsubChips = useRef(null);

  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

  useEffect(() => {
    if (!memberId) return;
    unsubChips.current = db.collection('members').doc(memberId).onSnapshot(snap => {
      if (snap.exists) {
        const d = snap.data();
        setChips(d.chips || 0);
        setLevel(d.level || 1);
        setXp(d.xp || 0);
        setGames(d.games || 0);
        setWins(d.wins || 0);
        sessionStorage.setItem('gr_chips', String(d.chips || 0));
      }
    }, () => {});
    return () => { if (unsubChips.current) unsubChips.current(); };
  }, [memberId]);

  useEffect(() => {
    loadRooms();
    loadLeaderboard();
    return () => { if (unsubRooms.current) unsubRooms.current(); };
  }, []);

  function loadRooms() {
    setLoadingRooms(true);
    if (unsubRooms.current) unsubRooms.current();
    unsubRooms.current=db.collection('rooms').where('onlineVersion','==',1).onSnapshot(s=>{
      setRooms(s.docs.map(d=>({code:d.id,...d.data()})).filter(r=>r.status!=='closed'));
      setError('');setLoadingRooms(false);
    },e=>{setError(e.message||'โหลดห้องไม่สำเร็จ');setLoadingRooms(false);});
  }
  async function loadLeaderboard() {
    setLoadingLeaders(true);
    try{setLeaderboard(await call('leaderboard'));}catch(e){setError(e.message);}finally{setLoadingLeaders(false);}
  }

  function handleRoomJoin(roomCode, rate, amInRoom) {
    const need = CHIP_MULT * rate;
    const hasChips = chips >= need;
    if (!amInRoom && !hasChips) {
      alert(`🪙 ชิปไม่พอครับ\n\nห้องนี้อัตรา ${rate} ต้องมีชิปอย่างน้อย ${need} ชิป\nคุณมีอยู่ ${chips} ชิป`);
      onEnterRoom(roomCode);
      return;
    }
    onEnterRoom(roomCode);
  }

  const filteredRooms = rooms.filter(r => {
    if (filter === 'waiting') return r.status === 'lobby' || !r.status;
    if (filter === 'playing') return r.status === 'playing' || r.status === 'results';
    if (filter === 'mine') {
      const activePlayers = Object.values(r.players || {});
      return activePlayers.some(p => p.name === player.name);
    }
    return true;
  });

  return <>{error&&<div role="alert" className="online-status">{error}<button onClick={loadRooms}>ลองอีกครั้ง</button></div>}<LobbyView player={player} chips={chips} level={level} xp={xp} games={games} wins={wins} winRate={winRate} rooms={filteredRooms} leaderboard={leaderboard} loadingRooms={loadingRooms} loadingLeaders={loadingLeaders} filter={filter} setFilter={setFilter} loadRooms={loadRooms} onEnterPractice={onEnterPractice} onLogout={onLogout} onJoin={handleRoomJoin}/></>;
}
