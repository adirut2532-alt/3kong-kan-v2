import React, { useState, useEffect, useRef } from 'react';
import { db } from '../App.jsx';
import { RefreshCw, Play, ShieldAlert, Award, Star, Eye } from 'lucide-react';

const CHIP_MULT = 35; // Player needs at least 35 times the rate to play

export default function Lobby({ player, memberId, onEnterRoom, onLogout }) {
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

  // 1. Listen to player's account details (real-time chips, level, wins)
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

    return () => {
      if (unsubChips.current) unsubChips.current();
    };
  }, [memberId]);

  // 2. Fetch rooms in real time
  useEffect(() => {
    loadRooms();
    loadLeaderboard();
    return () => {
      if (unsubRooms.current) unsubRooms.current();
    };
  }, []);

  function loadRooms() {
    setLoadingRooms(true);
    if (unsubRooms.current) unsubRooms.current();

    db.collection('admin').doc('data').get().then(snap => {
      const adminRooms = (snap.exists ? snap.data().rooms : []).filter(r => r.code) || [];
      if (!adminRooms.length) {
        setRooms([]);
        setLoadingRooms(false);
        return;
      }

      // Start listening to the room documents listed by Admin
      unsubRooms.current = db.collection('admin').doc('data').onSnapshot(adminSnap => {
        if (!adminSnap.exists) return;
        const currentAdminRooms = (adminSnap.data().rooms || []).filter(r => r.code);

        // Fetch each room's live status in real time
        Promise.all(currentAdminRooms.map(r => db.collection('rooms').doc(r.code).get()))
          .then(roomSnaps => {
            const compiled = currentAdminRooms.map((r, i) => {
              const fb = roomSnaps[i].exists ? roomSnaps[i].data() : {};
              return {
                ...r,
                ...fb,
                code: r.code,
                adminName: r.name,
                rate: r.rate,
                commission: r.commission
              };
            });
            setRooms(compiled);
            setLoadingRooms(false);
          });
      }, () => setLoadingRooms(false));
    }).catch(() => {
      setLoadingRooms(false);
    });
  }

  async function loadLeaderboard() {
    setLoadingLeaders(true);
    try {
      const snap = await db.collection('members').orderBy('totalProfit', 'desc').limit(8).get();
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      setLeaderboard(rows);
    } catch (e) {
      // Error fallback
    } finally {
      setLoadingLeaders(false);
    }
  }

  function handleRoomJoin(roomCode, rate, amInRoom) {
    const need = CHIP_MULT * rate;
    const hasChips = chips >= need;

    if (!amInRoom && !hasChips) {
      alert(`🪙 ชิปไม่พอครับ\n\nห้องนี้อัตรา ${rate} ต้องมีชิปอย่างน้อย ${need} ชิป\nคุณมีอยู่ ${chips} ชิป\n\nกรุณาติดต่อแอดมินเพื่อเติมชิปก่อนเล่นครับ แต่คุณสามารถกดเข้าห้องเพื่อเข้าไปนั่งดูเพื่อนเล่นก่อนได้ครับ`);
      onEnterRoom(roomCode);
      return;
    }
    onEnterRoom(roomCode);
  }

  // Filtered rooms selector
  const filteredRooms = rooms.filter(r => {
    if (filter === 'waiting') return r.status === 'lobby' || !r.status;
    if (filter === 'playing') return r.status === 'playing' || r.status === 'results';
    if (filter === 'mine') {
      const activePlayers = Object.values(r.players || {});
      return activePlayers.some(p => p.name === player.name);
    }
    return true;
  });

  return (
    <div className="lobby-layout safe-area-bottom">
      {/* HEADER HERO */}
      <div className="lobby-hero glass-panel" style={{ marginTop: '10px' }}>
        <div className="hero-avatar">{player.avatar || '🦊'}</div>
        <div className="hero-info">
          <div className="hero-name">{player.name}</div>
          <div className="hero-stats">
            Level {level} • {level >= 20 ? 'Master' : level >= 10 ? 'Pro' : 'Rookie'} • Win Rate {winRate}%
          </div>
          <div className="xp-bar">
            <div className="xp-progress" style={{ width: `${(xp % 250) / 250 * 100}%` }}></div>
          </div>
        </div>
        <div className="hero-chips">🪙 {Math.round(chips * 100) / 100}</div>
      </div>

      {/* DAILY MISSIONS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', fontSize: '11px' }}>
          <b style={{ color: 'var(--primary)', display: 'block', fontSize: '13px' }}>Daily</b>
          <span style={{ color: 'var(--text-muted)' }}>เล่นครบ 3 รอบ</span>
        </div>
        <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', fontSize: '11px' }}>
          <b style={{ color: 'var(--primary)', display: 'block', fontSize: '13px' }}>Derby</b>
          <span style={{ color: 'var(--text-muted)' }}>กวาดดาร์บี้</span>
        </div>
        <div className="glass-panel" style={{ padding: '10px', textAlign: 'center', fontSize: '11px' }}>
          <b style={{ color: 'var(--primary)', display: 'block', fontSize: '13px' }}>Dragon</b>
          <span style={{ color: 'var(--text-muted)' }}>สะสมมังกร</span>
        </div>
      </div>

      {/* LEADERBOARD VIEW */}
      <div className="glass-panel" style={{ padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '900', color: 'var(--primary)', marginBottom: '8px' }}>
          <span>🏆 จัดอันดับผู้สร้างกำไรสูงสุด</span>
          <span>Top Profit</span>
        </div>

        {loadingLeaders ? (
          <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>กำลังโหลดอันดับ...</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>ยังไม่มีประวัติจัดอันดับ</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {leaderboard.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >
                <span style={{ color: 'var(--primary)', width: '16px' }}>{i + 1}</span>
                <span>{m.avatar || '🎴'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.id}</span>
                <span style={{ color: '#40e880' }}>+{(Math.round((m.totalProfit || 0) * 10) / 10).toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REFRESH & FILTER TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button className="btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={loadRooms}>
          <RefreshCw size={14} /> รีเฟรชห้อง
        </button>
        
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', flex: 1 }}>
          {[
            { key: 'all', label: '🏠 ทั้งหมด' },
            { key: 'waiting', label: '⏳ รอเล่น' },
            { key: 'playing', label: '🎮 กำลังแข่ง' },
            { key: 'mine', label: '⭐ ของฉัน' }
          ].map(tab => (
            <button
              key={tab.key}
              className="btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                background: filter === tab.key ? 'var(--primary)' : 'var(--glass)',
                color: filter === tab.key ? '#23180a' : 'var(--text-main)',
                borderColor: filter === tab.key ? 'var(--primary)' : 'var(--line)'
              }}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROOMS LISTING GRID */}
      {loadingRooms ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid rgba(212, 175, 55, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .6s linear infinite', marginBottom: '8px' }}></div>
          <br />กำลังโหลดห้องเกม...
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>ไม่มีห้องที่ตรงเงื่อนไขขณะนี้ครับ</div>
      ) : (
        <div className="rooms-grid">
          {filteredRooms.map(r => {
            const playersList = Object.values(r.players || {});
            const activePlayers = playersList.filter(p => !p.isSpectator && !p.isQueue);
            const isFull = activePlayers.length >= 4;
            const isPlaying = r.status === 'playing' || r.status === 'results';
            const amInRoom = playersList.some(p => p.name === player.name);
            const rate = r.rate || 1;
            const need = CHIP_MULT * rate;
            const hasChips = chips >= need;
            const isLobby = r.status === 'lobby' || !r.status;

            return (
              <div key={r.code} className={`room-card glass-panel ${isPlaying ? 'playing' : ''}`}>
                <div className="room-bar">
                  <span>{isPlaying ? '🎮 กำลังเล่น' : activePlayers.length > 0 ? '⏳ รอผู้เล่น' : '🟢 ว่าง'}</span>
                  <span>{activePlayers.length}/4</span>
                </div>
                
                <div className="room-body">
                  <div className="room-code">{r.code}</div>
                  <div className="room-title">{r.adminName || r.name || 'ห้องเกม'}</div>
                  
                  <div className="room-rate-badge">
                    💵 อัตรา <b>{rate}</b> {r.commission ? `• คอม ${r.commission}%` : ''}
                    <br />
                    🪙 ต้องมี <b>{need}</b> ชิป <span style={{ color: hasChips ? '#40e880' : '#ff6d86' }}>{hasChips ? '(พอเล่น ✓)' : '(ชิปไม่พอ)'}</span>
                  </div>

                  <div className="room-seats">
                    {Array(4).fill(0).map((_, idx) => {
                      const p = activePlayers[idx];
                      return p ? (
                        <div key={idx} className="seat-av filled" title={p.name}>{p.avatar || '🎴'}</div>
                      ) : (
                        <div key={idx} className="seat-av">+</div>
                      );
                    })}
                  </div>

                  {amInRoom ? (
                    <button
                      className="btn-premium"
                      style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                      onClick={() => handleRoomJoin(r.code, rate, true)}
                    >
                      <Play size={12} /> กลับเข้าห้อง
                    </button>
                  ) : isLobby && !isFull ? (
                    <button
                      className="btn-premium"
                      style={{ width: '100%', padding: '8px', fontSize: '12px' }}
                      onClick={() => handleRoomJoin(r.code, rate, false)}
                    >
                      เข้าร่วมสู้ →
                    </button>
                  ) : (
                    <button
                      className="btn-secondary"
                      style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyCenter: 'center', gap: '4px' }}
                      onClick={() => handleRoomJoin(r.code, rate, false)}
                    >
                      <Eye size={12} /> นั่งชมเกม
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOGOUT */}
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button
          onClick={onLogout}
          className="btn-secondary"
          style={{ padding: '8px 24px', fontSize: '12px', border: '1px solid rgba(255, 77, 109, 0.35)', color: '#ff9aac' }}
        >
          ← ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
