import React, { useState } from 'react';
import { db } from '../App.jsx';
import { ArrowLeft } from 'lucide-react';

const AVATARS = ['🦊', '🐯', '🐻', '🐼', '🐶', '🐱', '🐸', '🦁'];

export default function Register({ onRegisterSuccess, navigateToLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦊');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sha256(string) {
    const utf8 = new Uint8Array(new TextEncoder().encode(string));
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    if (!trimmedUser || !email.trim() || !password) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่องครับ');
      return;
    }

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรขึ้นไป');
      return;
    }

    if (password !== confirmPass) {
      setError('รหัสผ่านยืนยันไม่ตรงกันครับ');
      return;
    }

    setLoading(true);
    try {
      const docId = `m_${trimmedUser.toLowerCase()}`;
      
      // Check if username already exists
      const checkDoc = await db.collection('members').doc(docId).get();
      if (checkDoc.exists) {
        setError('ชื่อผู้ใช้งานนี้มีผู้อื่นใช้ไปแล้วครับ ลองชื่ออื่นนะ');
        setLoading(false);
        return;
      }

      const hash = await sha256(password);
      const memberPayload = {
        name: trimmedUser,
        email: email.trim(),
        avatar: selectedAvatar,
        passwordHash: hash,
        approved: false, // Wait for admin approval
        active: true,
        chips: 0,
        level: 1,
        xp: 0,
        games: 0,
        wins: 0,
        winRate: 0,
        totalProfit: 0,
        derbyCount: 0,
        dragonCount: 0,
        taluCount: 0,
        createdAt: Date.now(),
        txns: []
      };

      await db.collection('members').doc(docId).set(memberPayload);
      alert('🎉 สมัครสมาชิกสำเร็จ! กรุณารอแอดมินอนุมัติสิทธิ์เข้าใช้งานระบบครับ');
      onRegisterSuccess();
    } catch (e) {
      setError('สมัครสมาชิกไม่สำเร็จ: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ fontSize: '44px' }}>📝</div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)', marginTop: '6px' }}>สมัครสมาชิก</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>สร้างบัญชีเพื่อเข้าเล่น 3กอง กาญ Online</p>
        </div>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>👤 ชื่อผู้ใช้ (ภาษาอังกฤษ/ตัวเลข)</label>
            <input
              type="text"
              className="form-input"
              placeholder="กรอกชื่อผู้ใช้ของคุณ"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>📧 อีเมล</label>
            <input
              type="email"
              className="form-input"
              placeholder="yourname@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Select Avatar */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>🎭 เลือกอวตารของคุณ</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {AVATARS.map(avatar => (
                <button
                  type="button"
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  style={{
                    fontSize: '24px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: selectedAvatar === avatar ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid ' + (selectedAvatar === avatar ? 'var(--primary)' : 'var(--line)'),
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>🔒 รหัสผ่าน</label>
            <input
              type="password"
              className="form-input"
              placeholder="ตั้งรหัสผ่านความปลอดภัย"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>🔒 ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              className="form-input"
              placeholder="พิมพ์รหัสผ่านยืนยันอีกครั้ง"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-premium"
            style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? '⏳ กำลังบันทึกข้อมูล...' : '✅ ยืนยันสมัครสมาชิก'}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <button
          onClick={navigateToLogin}
          className="btn-secondary"
          style={{ width: '100%', padding: '10px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
        >
          <ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}
