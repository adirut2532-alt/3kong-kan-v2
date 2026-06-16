import React, { useState, useEffect } from 'react';
import { db } from '../App.jsx';
import firebase from 'firebase/compat/app';
import { ShieldCheck, Plus, Trash2, Edit2, ShieldAlert, KeyRound, LogOut, ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';
import { sha256 } from '../utils/sha256.js';

const RATES = [1, 5, 10, 15, 20, 30, 50];
const COMMS = [0, 0.25, 0.5, 0.75, 1, 1.5, 1.75, 2];

export default function AdminPanel({ onBack }) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    return sessionStorage.getItem('admin_logged_in') === 'true';
  });
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  
  // Setup fields
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');

  // Admin stats & data
  const [members, setMembers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRate, setSelectedRate] = useState(5);
  const [selectedComm, setSelectedComm] = useState(0);
  const [roomName, setRoomName] = useState('');
  const [maxRounds, setMaxRounds] = useState(0);

  // Modal controls
  const [showChipsModal, setShowChipsModal] = useState(false);
  const [chipsTarget, setChipsTarget] = useState(null);
  const [chipsAmount, setChipsAmount] = useState('');
  const [chipsNote, setChipsNote] = useState('');
  
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [roomSummaries, setRoomSummaries] = useState([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);

  // Room Round History Modal states
  const [showRoomHistoryModal, setShowRoomHistoryModal] = useState(false);
  const [selectedRoomHistory, setSelectedRoomHistory] = useState([]);
  const [selectedRoomCode, setSelectedRoomCode] = useState('');
  const [selectedRoomDetails, setSelectedRoomDetails] = useState({ rate: 1, commission: 0 });
  const [loadingRoomHistory, setLoadingRoomHistory] = useState(false);
  const [expandedRound, setExpandedRound] = useState(null);


  // Check if admin config exists on mount
  useEffect(() => {
    db.collection('admin').doc('config').get().then(async snap => {
      if (!snap.exists) {
        const legacySnap = await db.collection('config').doc('admin').get().catch(() => ({ exists: false }));
        if (!legacySnap.exists) {
          setSetupMode(true);
        }
      }
    });
  }, []);

  // Fetch data if logged in
  useEffect(() => {
    if (isAdminLoggedIn) {
      loadMembers();
      loadRooms();
      loadRoomSummaries();
    }
  }, [isAdminLoggedIn]);

  async function handleSetup(e) {
    e.preventDefault();
    setError('');
    if (newPass1.length < 4) {
      setError('รหัสต้องมีอย่างน้อย 4 ตัวอักษรขึ้นไปครับ');
      return;
    }
    if (newPass1 !== newPass2) {
      setError('รหัสผ่านไม่ตรงกันครับ');
      return;
    }

    try {
      const hash = await sha256(newPass1);
      const payload = { passwordHash: hash, updatedAt: Date.now() };
      await db.collection('admin').doc('config').set(payload);
      sessionStorage.setItem('admin_logged_in', 'true');
      setIsAdminLoggedIn(true);
      setSetupMode(false);
    } catch (e) {
      setError('บันทึกรหัสผ่านล้มเหลว กรุณาลองใหม่');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const hash = await sha256(adminPass);
      let snap = await db.collection('admin').doc('config').get();
      
      // Fallback to legacy path if admin/config does not exist
      if (!snap.exists) {
        snap = await db.collection('config').doc('admin').get().catch(() => ({ exists: false, data: () => ({}) }));
      }
      
      if (!snap.exists || snap.data().passwordHash !== hash) {
        setError('รหัสผ่านแอดมินไม่ถูกต้องครับ');
        return;
      }

      sessionStorage.setItem('admin_logged_in', 'true');
      setIsAdminLoggedIn(true);
    } catch (e) {
      setError('เชื่อมต่อระบบความปลอดภัยล้มเหลว');
    }
  }

  // Database actions
  async function loadMembers() {
    try {
      const snap = await db.collection('members').orderBy('createdAt', 'desc').get();
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMembers(list);
    } catch (e) {}
  }

  async function loadRooms() {
    try {
      const snap = await db.collection('admin').doc('data').get();
      const list = (snap.exists ? snap.data().rooms : []).filter(r => r.code) || [];
      setRooms(list);
    } catch (e) {}
  }

  async function loadRoomSummaries() {
    setLoadingSummaries(true);
    try {
      const adminSnap = await db.collection('admin').doc('data').get();
      const briefRooms = (adminSnap.exists ? adminSnap.data().rooms : []).filter(r => r.code) || [];

      const summaries = [];
      for (const brief of briefRooms) {
        try {
          const roomSnap = await db.collection('rooms').doc(brief.code).get();
          if (roomSnap.exists) {
            const rd = roomSnap.data();
            const roundHistory = rd.roundHistory || [];
            const roundsPlayed = rd.round || roundHistory.length || 0;
            const rate = rd.rate || brief.rate || 1;
            const commissionPercent = rd.commission != null ? rd.commission : (brief.commission || 0);

            // Calculate total commission from roundHistory
            let totalCommission = 0;
            for (const rh of roundHistory) {
              for (const s of (rh.scores || [])) {
                const pts = s.roundScore || 0;
                const grossChips = pts * rate;
                if (grossChips > 0 && commissionPercent > 0) {
                  totalCommission += grossChips * (commissionPercent / 100);
                }
              }
            }
            totalCommission = Math.round(totalCommission * 100) / 100;

            // Count unique players
            const playerSet = new Set();
            if (rd.players) Object.keys(rd.players).forEach(k => playerSet.add(k));

            summaries.push({
              code: brief.code,
              name: rd.name || brief.name || '—',
              rate,
              commissionPercent,
              roundsPlayed,
              totalCommission,
              playerCount: playerSet.size,
              status: rd.status || 'lobby',
              createdAt: rd.createdAt || brief.createdAt || 0,
              players: rd.players || {}
            });
          }
        } catch (e) {
          // room doc might be deleted
        }
      }

      // Sort by creation date (newest first)
      summaries.sort((a, b) => b.createdAt - a.createdAt);
      setRoomSummaries(summaries);
    } catch (e) {
      console.error('loadRoomSummaries error:', e);
    }
    setLoadingSummaries(false);
  }

  async function handleCreateRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;

    try {
      // Generate unique 5-char code
      const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 5; i++) code += ch[Math.floor(Math.random() * ch.length)];

      const roomPayload = {
        name: roomName.trim(),
        rate: selectedRate,
        commission: selectedComm,
        maxRounds: parseInt(maxRounds) || 0,
        status: 'lobby',
        players: {},
        round: 0,
        scores: {},
        createdAt: Date.now(),
        createdByAdmin: true
      };

      const briefPayload = {
        code,
        name: roomName.trim(),
        rate: selectedRate,
        commission: selectedComm,
        maxRounds: parseInt(maxRounds) || 0,
        createdAt: Date.now()
      };

      // 1) Write to rooms collection
      await db.collection('rooms').doc(code).set(roomPayload);
      // 2) Write to general list
      const adminSnap = await db.collection('admin').doc('data').get();
      const currentRooms = adminSnap.exists ? (adminSnap.data().rooms || []) : [];
      await db.collection('admin').doc('data').set({
        rooms: [...currentRooms, briefPayload]
      }, { merge: true });

      setRoomName('');
      setMaxRounds(0);
      loadRooms();
      alert(`🎰 สร้างห้องเรียบร้อยรหัส #${code}`);
    } catch (e) {
      alert('สร้างห้องไม่สำเร็จ: ' + e.message);
    }
  }

  async function handleDeleteRoom(code, name) {
    if (!confirm(`ยืนยันลบห้อง "${name}" (รหัส #${code})? จะลบประวัติถาวร`)) return;
    try {
      // Delete single document
      await db.collection('rooms').doc(code).delete();
      // Remove from brief list
      const adminSnap = await db.collection('admin').doc('data').get();
      if (adminSnap.exists) {
        const filtered = (adminSnap.data().rooms || []).filter(r => r.code !== code);
        await db.collection('admin').doc('data').set({ rooms: filtered }, { merge: true });
      }
      loadRooms();
    } catch (e) {
      alert('ลบห้องผิดพลาด');
    }
  }

  async function handleKickPlayer(roomCode, playerId, playerName) {
    if (!confirm(`ยืนยันเตะผู้เล่น "${playerName}" ออกจากห้อง #${roomCode}?`)) return;
    try {
      const roomRef = db.collection('rooms').doc(roomCode);
      const updates = {};
      updates[`players.${playerId}`] = firebase.firestore.FieldValue.delete();
      updates[`deals.${playerId}`] = firebase.firestore.FieldValue.delete();
      updates[`hands.${playerId}`] = firebase.firestore.FieldValue.delete();
      await roomRef.update(updates);
      
      alert(`เตะผู้เล่น "${playerName}" ออกจากห้องเรียบร้อย`);
      loadRoomSummaries();
    } catch (e) {
      alert('เตะผู้เล่นล้มเหลว: ' + e.message);
    }
  }

  async function handleResetChipsToZero(memberId, name, currentChips) {
    const cur = currentChips || 0;
    if (cur === 0) {
      alert('ชิปของผู้เล่นเป็น 0 อยู่แล้วครับ');
      return;
    }

    if (!confirm(`ยืนยันการเซ็ตชิปของ "${name}" ให้เหลือ 0?\n(ยอดปัจจุบันคือ ${cur.toFixed(1)} ชิป)`)) return;

    const now = Date.now();
    const amt = Math.abs(cur);
    const newBal = 0;
    const transactionType = cur > 0 ? 'withdraw' : 'deposit';
    const note = cur > 0 ? 'เซ็ตชิปเป็น 0' : 'เซ็ตชิปเป็น 0 (ล้างยอดติดลบ)';

    try {
      const txRecord = { t: now, ty: transactionType, amt, bal: newBal, note };
      await db.collection('members').doc(memberId).update({
        chips: newBal,
        txns: firebase.firestore.FieldValue.arrayUnion(txRecord)
      });
      alert(`เซ็ตชิปของ "${name}" ให้เหลือ 0 เรียบร้อยแล้ว`);
      loadMembers();
    } catch (e) {
      alert('เซ็ตชิปเป็น 0 ล้มเหลว: ' + e.message);
    }
  }

  async function handleApproveMember(memberId, name) {
    try {
      await db.collection('members').doc(memberId).update({ approved: true });
      loadMembers();
    } catch (e) {
      alert('อนุมัติล้มเหลว');
    }
  }

  async function handleToggleMemberActive(memberId, currentActive) {
    try {
      await db.collection('members').doc(memberId).update({ active: !currentActive });
      loadMembers();
    } catch (e) {}
  }

  async function handleDeleteMember(memberId, name) {
    if (!confirm(`ลบสมาชิก "${name}" ออกจากเซิร์ฟเวอร์ถาวร?`)) return;
    try {
      await db.collection('members').doc(memberId).delete();
      loadMembers();
    } catch (e) {}
  }

  async function handleResetAllProfit() {
    if (!confirm('⚠️ ยืนยันที่จะล้างแต้ม "กำไรสะสมทั้งหมด" ของผู้เล่นทุกคนเป็น 0 หรือไม่?\n(การดำเนินการนี้เหมาะสำหรับใช้วัดค่าวันต่อวัน และไม่สามารถย้อนกลับได้)')) return;
    try {
      const snap = await db.collection('members').get();
      const batch = db.batch();
      snap.forEach(doc => {
        batch.update(doc.ref, { totalProfit: 0 });
      });
      await batch.commit();
      alert('✨ ล้างค่ากำไรสะสมของผู้เล่นทุกคนเป็น 0 เรียบร้อยแล้วครับ');
      loadMembers();
    } catch (e) {
      alert('ล้างข้อมูลล้มเหลว: ' + e.message);
    }
  }

  async function handleResetAllChipsToZero() {
    if (!confirm('⚠️ ยืนยันที่จะเซ็ตชิปของผู้เล่นทุกคนให้เป็น 0 หรือไม่?\n(การดำเนินการนี้จะเคลียร์ยอดชิปทั้งหมด และไม่สามารถย้อนกลับได้)')) return;
    try {
      const snap = await db.collection('members').get();
      const batch = db.batch();
      const now = Date.now();
      
      let count = 0;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const cur = data.chips || 0;
        if (cur !== 0) {
          const amt = Math.abs(cur);
          const transactionType = cur > 0 ? 'withdraw' : 'deposit';
          const note = cur > 0 ? 'เซ็ตชิปเป็น 0 (ล้างชิปทั้งหมด)' : 'เซ็ตชิปเป็น 0 (ล้างชิปทั้งหมด - ยอดติดลบ)';
          const txRecord = { t: now, ty: transactionType, amt, bal: 0, note };
          
          batch.update(docSnap.ref, {
            chips: 0,
            txns: firebase.firestore.FieldValue.arrayUnion(txRecord)
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        alert(`✨ เซ็ตชิปของผู้เล่น ${count} คนให้เป็น 0 เรียบร้อยแล้วครับ`);
      } else {
        alert('ผู้เล่นทุกคนมีชิปเป็น 0 อยู่แล้วครับ');
      }
      loadMembers();
    } catch (e) {
      alert('เซ็ตชิปทั้งหมดเป็น 0 ล้มเหลว: ' + e.message);
    }
  }


  // Chips modifiers
  function openChips(member) {
    setChipsTarget(member);
    setChipsAmount('');
    setChipsNote('');
    setShowChipsModal(true);
  }

  async function handleChipOp(op) {
    const amt = parseFloat(chipsAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('กรุณากรอกจำนวนชิปให้ถูกต้องครับ');
      return;
    }

    const cur = chipsTarget.chips || 0;
    const now = Date.now();
    let newBal = cur;
    let transactionType = '';

    if (op === 'deposit') {
      newBal = cur + amt;
      transactionType = 'deposit';
    } else if (op === 'withdraw') {
      if (amt > cur) {
        alert('จำนวนชิปที่ถอน เกินชิปคงเหลือจริง!');
        return;
      }
      newBal = cur - amt;
      transactionType = 'withdraw';
    }

    try {
      const txRecord = { t: now, ty: transactionType, amt, bal: newBal, note: chipsNote.trim() };
      await db.collection('members').doc(chipsTarget.id).update({
        chips: newBal,
        approved: true,
        // Using batch update helper or standard array operations
        txns: firebase.firestore.FieldValue.arrayUnion(txRecord)
      });

      setShowChipsModal(false);
      loadMembers();
    } catch (e) {
      alert('บันทึกยอดชิปล้มเหลว');
    }
  }

  async function viewHistory(member) {
    setHistoryTarget(member);
    setShowHistoryModal(true);
    setHistoryLogs([]);

    try {
      const snap = await db.collection('members').doc(member.id).get();
      if (snap.exists) {
        const sorted = (snap.data().txns || []).sort((a, b) => b.t - a.t);
        setHistoryLogs(sorted);
      }
    } catch (e) {}
  }

  async function handleViewRoomHistory(roomCode, rate, commission) {
    setSelectedRoomCode(roomCode);
    setSelectedRoomDetails({ rate, commission });
    setLoadingRoomHistory(true);
    setShowRoomHistoryModal(true);
    setExpandedRound(null);
    try {
      const roomSnap = await db.collection('rooms').doc(roomCode).get();
      if (roomSnap.exists) {
        const data = roomSnap.data();
        const history = data.roundHistory || [];
        // Sort rounds descending (newest first)
        const sortedHistory = [...history].sort((a, b) => b.round - a.round);
        setSelectedRoomHistory(sortedHistory);
      } else {
        setSelectedRoomHistory([]);
        alert('ไม่พบข้อมูลห้องนี้ครับ');
      }
    } catch (e) {
      alert('โหลดประวัติห้องล้มเหลว: ' + e.message);
    } finally {
      setLoadingRoomHistory(false);
    }
  }

  // Stats calculation
  const pendingCount = members.filter(m => !m.approved).length;
  const activeCount = members.filter(m => m.approved && m.active !== false).length;

  if (!isAdminLoggedIn) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-panel">
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{ fontSize: '46px' }}>⚙️</div>
            <h2 className="header-logo" style={{ marginTop: '5px' }}>Admin Control Center</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3กอง กาญ 2.0</p>
          </div>

          {setupMode ? (
            <form onSubmit={handleSetup}>
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                🎉 ระบบตรวจพบว่าแอดมินยังไม่ได้ตั้งรหัสผ่าน ตั้งรหัสผ่านหลักได้ที่นี่ครับ
              </p>
              <div className="form-group">
                <label>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="รหัสผ่านแอดมิน"
                  value={newPass1}
                  onChange={e => setNewPass1(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                  value={newPass2}
                  onChange={e => setNewPass2(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-premium" style={{ width: '100%', padding: '12px' }}>
                บันทึกและเปิดระบบ
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>🔒 รหัสผ่านเข้าแอดมิน</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="ป้อนรหัสแอดมิน"
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-premium" style={{ width: '100%', padding: '12px' }}>
                🔑 ยืนยันสิทธิ์
              </button>
            </form>
          )}

          {error && <div className="error-banner">{error}</div>}

          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ width: '100%', padding: '10px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          >
            <ArrowLeft size={14} /> ย้อนกลับ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-layout safe-area-bottom">
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
        <ShieldCheck size={28} style={{ color: 'var(--primary)' }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--primary)' }}>แผงจัดการผู้ดูแลห้อง</h2>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>จัดการข้อมูลชิป สมาชิก และห้องเล่นเกม</span>
        </div>
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => { setIsAdminLoggedIn(false); sessionStorage.removeItem('admin_logged_in'); }}>
          <LogOut size={12} /> ล็อกเอาต์
        </button>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <div className="glass-panel" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)' }}>{members.length}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>สมาชิกทั้งหมด</div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#ffea79' }}>{pendingCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>รออนุมัติ</div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#60e890' }}>{activeCount}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ใช้งานได้</div>
        </div>
      </div>

      {/* CREATE ROOM */}
      <form className="glass-panel" style={{ padding: '16px', marginBottom: '14px' }} onSubmit={handleCreateRoom}>
        <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)', marginBottom: '12px' }}>🎰 สร้างห้องเกมใหม่</h3>
        
        <div className="form-group">
          <label>ชื่อห้องเล่น</label>
          <input
            type="text"
            className="form-input"
            placeholder="เช่น โต๊ะระดับสูง VIP, โต๊ะเพื่อนฝูง"
            value={roomName}
            onChange={e => setRoomName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>💵 อัตราแต้มละ (ชิป)</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {RATES.map(rate => (
              <button
                type="button"
                key={rate}
                onClick={() => setSelectedRate(rate)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  background: selectedRate === rate ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: selectedRate === rate ? '#23180a' : 'var(--text-main)',
                  border: '1px solid ' + (selectedRate === rate ? 'var(--primary)' : 'var(--line)')
                }}
              >
                {rate}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>✂️ ค่าต๋ง (Commission % เฉพาะคนชนะ)</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {COMMS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setSelectedComm(c)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  background: selectedComm === c ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: selectedComm === c ? '#23180a' : 'var(--text-main)',
                  border: '1px solid ' + (selectedComm === c ? 'var(--primary)' : 'var(--line)')
                }}
              >
                {c}%
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>จำนวนรอบการเล่น (0 = ไม่จำกัดรอบ)</label>
          <input
            type="number"
            className="form-input"
            value={maxRounds}
            onChange={e => setMaxRounds(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-premium" style={{ width: '100%', padding: '12px' }}>
          <Plus size={16} /> สร้างโต๊ะเกมใหม่
        </button>
      </form>

      {/* ROOM LISTS */}
      <div className="glass-panel" style={{ padding: '14px', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)', marginBottom: '10px' }}>🚪 โต๊ะที่เปิดเล่นอยู่</h3>
        {rooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>ไม่มีห้องเปิดอยู่ขณะนี้</div>
        ) : (
          rooms.map(r => (
            <div
              key={r.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(0,0,0,0.2)',
                padding: '10px',
                borderRadius: '10px',
                marginBottom: '6px'
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: '800' }}>{r.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--primary)', marginLeft: '8px', fontWeight: '800' }}>#{r.code}</span>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  อัตรา {r.rate} • ค่าต๋ง {r.commission}% • เล่นสูงสุด {r.maxRounds > 0 ? r.maxRounds + ' รอบ' : 'ไม่จำกัด'}
                </div>
              </div>
              <button
                className="btn-danger"
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                onClick={() => handleDeleteRoom(r.code, r.name)}
              >
                <Trash2 size={12} /> ลบ
              </button>
            </div>
          ))
        )}
      </div>

      {/* ROOM PLAY SUMMARY */}
      <div className="glass-panel" style={{ padding: '14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={16} /> สรุปผลการเล่นแต่ละห้อง
          </h3>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={loadRoomSummaries}
            disabled={loadingSummaries}
          >
            <RefreshCw size={11} className={loadingSummaries ? 'spin-anim' : ''} /> รีเฟรช
          </button>
        </div>

        {loadingSummaries ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>⏳ กำลังโหลดข้อมูลห้อง...</div>
        ) : roomSummaries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>ยังไม่มีห้องที่เปิดเล่น</div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffea79' }}>{roomSummaries.length}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>ห้องทั้งหมด</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#60e890' }}>{roomSummaries.reduce((sum, r) => sum + r.roundsPlayed, 0)}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>รอบรวม</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)' }}>{roomSummaries.reduce((sum, r) => sum + r.totalCommission, 0).toFixed(1)}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>ค่าต๋งรวม (ชิป)</div>
              </div>
            </div>

            {/* Individual room rows */}
            {roomSummaries.map(rs => (
              <div
                key={rs.code}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  marginBottom: '6px',
                  borderLeft: '3px solid ' + (rs.status === 'lobby' ? 'rgba(255,255,255,0.15)' : rs.status === 'results' ? '#60e890' : '#ffea79')
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>{rs.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', marginLeft: '6px', fontWeight: '800' }}>#{rs.code}</span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: rs.status === 'lobby' ? 'rgba(255,255,255,0.08)' : rs.status === 'results' ? 'rgba(96,232,144,0.15)' : 'rgba(255,234,121,0.15)',
                    color: rs.status === 'lobby' ? 'var(--text-muted)' : rs.status === 'results' ? '#60e890' : '#ffea79'
                  }}>
                    {rs.status === 'lobby' ? '⏸ รอเล่น' : rs.status === 'results' ? '✅ ดูผล' : '🎮 กำลังเล่น'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>🎰 เล่นไป <b style={{ color: '#fff' }}>{rs.roundsPlayed}</b> รอบ</span>
                  <span>💵 อัตรา <b style={{ color: '#fff' }}>x{rs.rate}</b></span>
                  <span>✂️ ค่าต๋ง <b style={{ color: '#fff' }}>{rs.commissionPercent}%</b></span>
                  <span>👥 <b style={{ color: '#fff' }}>{rs.playerCount}</b> คน</span>
                </div>

                {/* List players in the room for admin to kick */}
                {(() => {
                  const roomPlayers = Object.entries(rs.players || {}).map(([id, val]) => ({ id, ...val }));
                  return (
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>👤 ผู้เล่นในโต๊ะ:</div>
                      {roomPlayers.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 0' }}>ไม่มีผู้เล่นในห้อง</div>
                      ) : (
                        roomPlayers.map(p => (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              fontSize: '11px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{p.avatar || '🦊'}</span>
                              <span style={{ fontWeight: '800', color: '#fff' }}>{p.name || p.id}</span>
                              <span style={{ color: 'var(--primary)', fontWeight: '800' }}>({(p.chips || 0).toFixed(1)} ชิป)</span>
                              {p.isSpectator && <span style={{ fontSize: '9px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '4px' }}>ดูเล่น</span>}
                              {p.isHost && <span style={{ fontSize: '9px', color: '#ffd25e', background: 'rgba(255,210,94,0.1)', padding: '1px 4px', borderRadius: '4px' }}>Host</span>}
                              {p.ready && !p.isSpectator && <span style={{ fontSize: '9px', color: '#60e890', background: 'rgba(96,232,144,0.1)', padding: '1px 4px', borderRadius: '4px' }}>Ready</span>}
                            </div>
                            <button
                              type="button"
                              className="btn-danger"
                              style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                minHeight: 'auto',
                                background: 'rgba(255, 77, 77, 0.15)',
                                border: '1px solid rgba(255, 77, 77, 0.4)',
                                color: '#ff4d4d',
                                borderRadius: '4px'
                              }}
                              onClick={() => handleKickPlayer(rs.code, p.id, p.name || p.id)}
                            >
                              เตะออก
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  {rs.totalCommission > 0 ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(255,215,0,0.08))',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: 'var(--primary)',
                      border: '1px solid rgba(212,175,55,0.25)'
                    }}>
                      💰 ค่าต๋งสะสม: {rs.totalCommission.toFixed(1)} ชิป
                    </div>
                  ) : <div />}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '10px', fontWeight: '800', borderColor: 'rgba(212,175,55,0.25)', color: 'var(--primary)' }}
                    onClick={() => handleViewRoomHistory(rs.code, rs.rate, rs.commissionPercent)}
                  >
                    📋 ประวัติรอบเล่น
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* MEMBERS LIST */}
      <div className="glass-panel" style={{ padding: '14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)', margin: 0 }}>👥 รายชื่อผู้เล่นทั้งหมด</h3>
          {members.length > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-danger"
                style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}
                onClick={handleResetAllProfit}
              >
                🧹 ล้างกำไรสะสม (เริ่มวันใหม่)
              </button>
              <button
                type="button"
                className="btn-danger"
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'rgba(255, 77, 77, 0.15)',
                  border: '1px solid rgba(255, 77, 77, 0.4)',
                  color: '#ff4d4d'
                }}
                onClick={handleResetAllChipsToZero}
              >
                🪙 เซ็ตชิปทุกคนเป็น 0
              </button>
            </div>
          )}
        </div>

        {members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>ยังไม่มีสมาชิกสมัครเข้ามา</div>
        ) : (
          members.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: m.approved ? 'rgba(0,0,0,0.18)' : 'rgba(212, 175, 55, 0.08)',
                borderLeft: '3px solid ' + (m.approved ? 'transparent' : 'var(--primary)'),
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '6px',
                fontSize: '12px'
              }}
            >
              <div style={{ fontSize: '24px' }}>{m.avatar || '🎴'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '800', color: '#fff', fontSize: '13px' }}>{m.name || m.id}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '1px' }}>{m.email || '—'}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '10px' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '900' }}>💰 {(m.chips || 0).toFixed(1)} ชิป</span>
                  <span>Win Rate {m.games > 0 ? Math.round((m.wins / m.games) * 100) : 0}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '140px' }}>
                {!m.approved ? (
                  <button className="btn-premium" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleApproveMember(m.id, m.name)}>
                    อนุมัติ
                  </button>
                ) : (
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px', color: m.active !== false ? '#ff9aac' : '#60e890' }}
                    onClick={() => handleToggleMemberActive(m.id, m.active !== false)}
                  >
                    {m.active !== false ? 'บล็อก' : 'ปลด'}
                  </button>
                )}
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: '#ffd25e' }} onClick={() => openChips(m)}>
                  ชิป
                </button>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: '#ff7d7d' }} onClick={() => handleResetChipsToZero(m.id, m.name, m.chips)}>
                  เซ็ต 0
                </button>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => viewHistory(m)}>
                  ประวัติ
                </button>
                <button className="btn-danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDeleteMember(m.id, m.name)}>
                  ลบ
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CHIPS ADJUSTMENT MODAL */}
      {showChipsModal && chipsTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)', marginBottom: '12px' }}>💰 เติม/ถอน ชิป</h4>
            <div style={{ fontSize: '13px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', marginBottom: '12px' }}>
              👤 <b>{chipsTarget.name}</b>
              <br />ชิปคงเหลือปัจจุบัน: <span style={{ color: 'var(--primary)', fontWeight: '900' }}>{(chipsTarget.chips || 0).toFixed(1)} ชิป</span>
            </div>

            <div className="form-group">
              <label>จำนวนชิป</label>
              <input
                type="number"
                className="form-input"
                placeholder="กรอกจำนวนชิปที่ต้องการทำรายการ"
                value={chipsAmount}
                onChange={e => setChipsAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>หมายเหตุ / รายละเอียดธุรกรรม (ไม่บังคับ)</label>
              <input
                type="text"
                className="form-input"
                placeholder="เช่น เงินสด / ถอนกำไรจากมังกร"
                value={chipsNote}
                onChange={e => setChipsNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-premium" style={{ flex: 1, padding: '10px' }} onClick={() => handleChipOp('deposit')}>
                ➕ เติมชิป
              </button>
              <button className="btn-danger" style={{ flex: 1, padding: '10px' }} onClick={() => handleChipOp('withdraw')}>
                ➖ ถอนชิป
              </button>
            </div>

            <button
              className="btn-secondary"
              style={{ width: '100%', padding: '10px', marginTop: '8px' }}
              onClick={() => setShowChipsModal(false)}
            >
              ปิดหน้าจอ
            </button>
          </div>
        </div>
      )}

      {/* CHIP LOGS HISTORY MODAL */}
      {showHistoryModal && historyTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '20px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)', marginBottom: '8px' }}>📜 ประวัติการเดินชิป</h4>
            <div style={{ fontSize: '13px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', marginBottom: '10px' }}>
              👤 <b>{historyTarget.name}</b>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
              {historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>ยังไม่มีประวัติธุรกรรม</div>
              ) : (
                historyLogs.map((log, idx) => {
                  const isInc = log.ty === 'deposit' || log.ty === 'transfer_in' || log.ty === 'win';
                  const dateStr = new Date(log.t).toLocaleDateString('th', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                  const typeLabel = log.ty === 'deposit' ? '➕ เติม' :
                                    log.ty === 'withdraw' ? '➖ ถอน' :
                                    log.ty === 'win' ? '📈 เล่นได้' :
                                    log.ty === 'lose' ? '📉 เล่นเสีย' :
                                    log.ty === 'transfer_in' ? '🔁 โอนเข้า' :
                                    log.ty === 'transfer_out' ? '🔁 โอนออก' : '🔁 โอน';
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: '800', color: isInc ? '#60e890' : '#ff8080' }}>
                          {typeLabel}
                        </span>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '1px' }}>
                          {dateStr} {log.note ? `• ${log.note}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <b style={{ color: isInc ? '#60e890' : '#ff8080' }}>
                          {isInc ? '+' : '-'}{log.amt}
                        </b>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ดุล {log.bal}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button className="btn-secondary" style={{ padding: '10px' }} onClick={() => setShowHistoryModal(false)}>
              ปิดหน้าจอ
            </button>
          </div>
        </div>
      )}

      {/* ROOM ROUNDS HISTORY MODAL */}
      {showRoomHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '20px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📋 ประวัติรอบเล่นห้อง #{selectedRoomCode}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>อัตรา: x{selectedRoomDetails.rate} | ต๋ง: {selectedRoomDetails.commission}%</span>
            </h4>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
              {loadingRoomHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <div style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid rgba(212, 175, 55, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .6s linear infinite', marginBottom: '8px' }} />
                  <br />กำลังโหลดประวัติ...
                </div>
              ) : selectedRoomHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>ยังไม่มีประวัติการเล่นในห้องนี้</div>
              ) : (
                selectedRoomHistory.map((rh, idx) => {
                  const dateStr = rh.timestamp ? new Date(rh.timestamp).toLocaleTimeString('th', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(rh.timestamp).toLocaleDateString('th', { day: 'numeric', month: 'short' }) : '—';
                  const isExpanded = expandedRound === rh.round;
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setExpandedRound(isExpanded ? null : rh.round)}
                      >
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>รอบที่ {rh.round}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>{dateStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--primary)', fontWeight: '800' }}>
                          <span>{isExpanded ? '▲ ซ่อนไพ่' : '▼ ดูรายละเอียดไพ่'}</span>
                        </div>
                      </div>

                      {/* Score Summary for Round */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' }}>
                        {(rh.scores || []).map((s, sIdx) => {
                          const pts = s.roundScore || 0;
                          const gross = pts * selectedRoomDetails.rate;
                          const comm = (gross > 0 && selectedRoomDetails.commission > 0) ? gross * (selectedRoomDetails.commission / 100) : 0;
                          const net = Math.round((gross - comm) * 100) / 100;
                          const isWin = pts > 0;
                          
                          return (
                            <div
                              key={sIdx}
                              style={{
                                background: 'rgba(0,0,0,0.15)',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '11px'
                              }}
                            >
                              <span>{s.avatar} {s.name}</span>
                              <span style={{ fontWeight: '800', color: isWin ? '#60e890' : pts < 0 ? '#ff8080' : '#fff' }}>
                                {isWin ? '+' : ''}{net} ({pts}แต้ม)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Expanded Card Details */}
                      {isExpanded && rh.hands && (
                        <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {(rh.scores || []).map((s, sIdx) => {
                            const playerHand = rh.hands[s.id] || rh.hands[s.name] || {};
                            const hasFoul = playerHand.foul;
                            
                            // Check if dragon hand
                            const isDragon = playerHand.front && playerHand.mid && playerHand.back && 
                              ([...playerHand.front, ...playerHand.mid, ...playerHand.back].length === 13) &&
                              (new Set([...playerHand.front, ...playerHand.mid, ...playerHand.back].map(c => c.val)).size === 13);
                            
                            return (
                              <div key={sIdx} style={{ marginBottom: sIdx < rh.scores.length - 1 ? '8px' : '0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800', color: '#ffd25e', marginBottom: '3px' }}>
                                  <span>{s.avatar} {s.name}</span>
                                  {hasFoul && <span style={{ color: '#ff6d86' }}>⚠️ ฟาวล์</span>}
                                  {isDragon && <span style={{ color: '#ffea79' }}>🐉 ไพ่มังกร</span>}
                                </div>
                                
                                {!isDragon && !hasFoul && playerHand.front && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '6px' }}>
                                    <div>หน้า: {playerHand.front.map(c => `${c.suit}${c.rank}`).join(' ')}</div>
                                    <div>กลาง: {playerHand.mid.map(c => `${c.suit}${c.rank}`).join(' ')}</div>
                                    <div>หลัง: {playerHand.back.map(c => `${c.suit}${c.rank}`).join(' ')}</div>
                                  </div>
                                )}
                                {hasFoul && playerHand.front && (
                                  <div style={{ fontSize: '10px', color: 'rgba(255,109,134,0.7)', display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '6px' }}>
                                    <div>หน้า: {playerHand.front.map(c => `${c.suit}${c.rank}`).join(' ')}</div>
                                    <div>กลาง: {playerHand.mid.map(c => `${c.suit}${c.rank}`).join(' ')}</div>
                                    <div>หลัง: {playerHand.back.map(c => `${c.suit}${c.rank}`).join(' ')}</div>
                                  </div>
                                )}
                                {isDragon && playerHand.front && (
                                  <div style={{ fontSize: '10px', color: '#ffea79', paddingLeft: '6px' }}>
                                    ไพ่: {[...playerHand.front, ...playerHand.mid, ...playerHand.back].map(c => `${c.suit}${c.rank}`).join(' ')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <button className="btn-secondary" style={{ padding: '10px' }} onClick={() => setShowRoomHistoryModal(false)}>
              ปิดหน้าจอ
            </button>
          </div>
        </div>
      )}

      {/* BACK BUTTON */}
      <button
        onClick={onBack}
        className="btn-secondary"
        style={{ width: '100%', padding: '12px', marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
      >
        <ArrowLeft size={16} /> ย้อนกลับล็อบบี้
      </button>
    </div>
  );
}
