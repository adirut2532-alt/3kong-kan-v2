import React, { useState, useEffect } from 'react';
import { db } from '../App.jsx';
import { ShieldCheck, Plus, Trash2, Edit2, ShieldAlert, KeyRound, LogOut, ArrowLeft } from 'lucide-react';

const RATES = [1, 5, 10, 15, 20, 30, 50];
const COMMS = [0, 0.25, 0.5, 0.75, 1, 1.5, 1.75, 2];

export default function AdminPanel({ onBack }) {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
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
  const [historyLogs, setHistoryLogs] = useState([]);

  // Setup / verification SHA256 helper
  async function sha256(string) {
    const utf8 = new Uint8Array(new TextEncoder().encode(string));
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Check if admin config exists on mount
  useEffect(() => {
    db.collection('admin').doc('config').get().then(snap => {
      if (!snap.exists) {
        setSetupMode(true);
      }
    });
  }, []);

  // Fetch data if logged in
  useEffect(() => {
    if (isAdminLoggedIn) {
      loadMembers();
      loadRooms();
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
      const snap = await db.collection('admin').doc('config').get();
      
      if (!snap.exists || snap.data().passwordHash !== hash) {
        setError('รหัสผ่านแอดมินไม่ถูกต้องครับ');
        return;
      }

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
        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setIsAdminLoggedIn(false)}>
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

      {/* MEMBERS LIST */}
      <div className="glass-panel" style={{ padding: '14px', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--primary)', marginBottom: '10px' }}>👥 รายชื่อผู้เล่นทั้งหมด</h3>
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
                  const isInc = log.ty === 'deposit' || log.ty === 'transfer_in';
                  const dateStr = new Date(log.t).toLocaleDateString('th', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
                          {log.ty === 'deposit' ? '➕ เติม' : log.ty === 'withdraw' ? '➖ ถอน' : '🔁 โอน'}
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
