import React, { useState, useEffect } from 'react';
import { db } from '../App.jsx';

export default function Login({ onLoginSuccess, navigateToRegister, navigateToAdmin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // SHA256 utility for password hashing
  async function sha256(string) {
    const utf8 = new Uint8Array(new TextEncoder().encode(string));
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  useEffect(() => {
    try {
      const session = sessionStorage.getItem('player');
      const memberId = sessionStorage.getItem('gr_memberId');
      if (session && memberId) {
        const d = JSON.parse(session);
        if (d && typeof d === 'object') {
          onLoginSuccess(d, memberId);
        }
      }
    } catch (err) {
      console.error("Failed to parse auto-login session:", err);
      sessionStorage.removeItem('player');
      sessionStorage.removeItem('gr_memberId');
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('กรุณาใส่ชื่อผู้ใช้และรหัสผ่านครับ');
      return;
    }

    setLoading(true);
    try {
      const hash = await sha256(password);
      const docId = `m_${username.trim().toLowerCase()}`;
      const snap = await db.collection('members').doc(docId).get();
      
      if (!snap.exists) {
        setError('ไม่พบชื่อผู้ใช้นี้ครับ');
        setLoading(false);
        return;
      }

      const d = snap.data();
      if (d.active === false) {
        setError('บัญชีนี้ถูกระงับ กรุณาติดต่อแอดมิน');
        setLoading(false);
        return;
      }

      if (d.passwordHash !== hash) {
        setError('รหัสผ่านไม่ถูกต้องครับ');
        setLoading(false);
        return;
      }

      // Save to session storage
      const playerObj = { name: d.name, avatar: d.avatar || '🦊', chips: d.chips || 0 };
      sessionStorage.setItem('player', JSON.stringify(playerObj));
      sessionStorage.setItem('gr_myName', d.name);
      sessionStorage.setItem('gr_avatar', d.avatar || '🦊');
      sessionStorage.setItem('gr_chips', String(d.chips || 0));
      sessionStorage.setItem('gr_memberId', docId);

      onLoginSuccess(playerObj, docId);
    } catch (e) {
      setError('เกิดข้อผิดพลาดในการตรวจสอบบัญชี กรุณาลองใหม่ครับ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ fontSize: '44px', textShadow: '0 0 16px rgba(212, 175, 55, 0.4)' }}>🃏</div>
          <h2 style={{ fontSize: '26px', fontWeight: '900', color: 'var(--primary)', marginTop: '6px' }}>3กอง กาญ 2.0</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Premium Chinese Poker Online</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>👤 ชื่อผู้ใช้</label>
            <input
              type="text"
              className="form-input"
              placeholder="ชื่อผู้ใช้งานของคุณ"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>🔒 รหัสผ่าน</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-premium"
            style={{ width: '100%', padding: '14px', fontSize: '15px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🔑 เข้าสู่ระบบ'}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>ยังไม่มีบัญชี? </span>
          <button
            onClick={navigateToRegister}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '800', marginLeft: '5px', cursor: 'pointer' }}
          >
            สมัครสมาชิก →
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
          <button
            onClick={navigateToAdmin}
            style={{ background: 'none', border: 'none', color: 'rgba(212, 175, 55, 0.45)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
          >
            ⚙️ Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
}
