import React, { useState } from 'react';
import {call} from '../online.js';
import { ArrowLeft } from 'lucide-react';

import { Brand, GameButton } from './ui/GameUI.jsx';

const AVATARS = ['🦊', '🐯', '🐻', '🐼', '🐶', '🐱', '🐸', '🦁'];

export default function Register({ onRegisterSuccess, navigateToLogin }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦊');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      await call('account',{action:'register',username:trimmedUser,email,password,avatar:selectedAvatar});
      alert('🎉 สมัครสมาชิกสำเร็จ! กรุณารอแอดมินอนุมัติสิทธิ์เข้าใช้งานระบบครับ');
      onRegisterSuccess();
    } catch (e) {
      setError('สมัครสมาชิกไม่สำเร็จ: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-scene">
    <header><GameButton variant="icon" aria-label="กลับไปเข้าสู่ระบบ" onClick={navigateToLogin}><ArrowLeft size={22}/></GameButton><Brand small/></header>
    <div className="auth-intro"><h1>เข้ามาเป็นเพื่อนร่วมวง</h1><p>สร้างบัญชี 3กอง กาญ</p></div>
    <form onSubmit={handleRegister}>
      <div className="form-group"><label htmlFor="register-user">ชื่อผู้ใช้</label><input id="register-user" className="form-input" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} disabled={loading}/></div>
      <div className="form-group"><label htmlFor="register-email">อีเมล</label><input id="register-email" type="email" className="form-input" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={loading}/></div>
      <fieldset className="avatar-picker"><legend>เลือกอวตาร</legend><div>{AVATARS.map(avatar=><button key={avatar} type="button" aria-label={`อวตาร ${avatar}`} aria-pressed={selectedAvatar===avatar} onClick={()=>setSelectedAvatar(avatar)}>{avatar}</button>)}</div></fieldset>
      <div className="form-group"><label htmlFor="register-password">รหัสผ่าน</label><input id="register-password" type="password" className="form-input" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading}/></div>
      <div className="form-group"><label htmlFor="register-confirm">ยืนยันรหัสผ่าน</label><input id="register-confirm" type="password" className="form-input" autoComplete="new-password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} disabled={loading}/></div>
      <GameButton type="submit" disabled={loading}>{loading?'กำลังบันทึก…':'สมัครสมาชิก'}</GameButton>
    </form>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <div className="auth-footer"><button className="text-button" onClick={navigateToLogin}>มีบัญชีอยู่แล้ว · เข้าสู่ระบบ</button></div>
  </main>;
}
