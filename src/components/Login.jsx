import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Brand, GameButton } from './ui/GameUI.jsx';
import {signIn, restorePlayer} from '../online.js';

export default function Login({ onLoginSuccess, navigateToRegister, navigateToAdmin, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled=false;
    restorePlayer().then(result=>{if(result&&!cancelled) onLoginSuccess(result.player,result.memberId);}).catch(()=>{if(!cancelled)setError('เชื่อมต่อบัญชีไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง');});
    return ()=>{cancelled=true;};
  }, [onLoginSuccess]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('กรุณาใส่ชื่อผู้ใช้และรหัสผ่านครับ');
      return;
    }

    setLoading(true);
    try {
      const result=await signIn({action:'login',username,password});
      onLoginSuccess(result.player,result.memberId);
    } catch (e) {
      setError(e.message || 'เชื่อมต่อบัญชีไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-scene">
    <header><GameButton variant="icon" aria-label="กลับหน้าหลัก" onClick={onBack}><ArrowLeft size={22}/></GameButton><Brand small/></header>
    <div className="auth-intro"><h1>กลับมาที่วงไพ่</h1><p>เข้าสู่บัญชีของคุณเพื่อเริ่มเล่น</p></div>
    <form onSubmit={handleLogin}>
      <div className="form-group"><label htmlFor="login-user">ชื่อผู้ใช้</label><input id="login-user" type="text" className="form-input" placeholder="ชื่อผู้ใช้งานของคุณ" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} disabled={loading}/></div>
      <div className="form-group"><label htmlFor="login-pass">รหัสผ่าน</label><input id="login-pass" type="password" className="form-input" placeholder="รหัสผ่าน" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading}/></div>
      <GameButton type="submit" disabled={loading}>{loading?'กำลังเข้าสู่ระบบ…':'เข้าสู่เกม'}</GameButton>
    </form>
    {error&&<div role="alert" className="auth-error">{error}</div>}
    <div className="auth-footer"><span>ยังไม่มีบัญชี?</span><button className="text-button" onClick={navigateToRegister}>สมัครสมาชิก</button></div>
    <button className="text-button auth-admin" onClick={navigateToAdmin}>สำหรับผู้ดูแลห้อง</button>
  </main>;
}
