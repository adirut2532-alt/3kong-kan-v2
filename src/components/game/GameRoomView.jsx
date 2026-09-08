import {handsByPlayerName} from '../../utils/roomSnapshot.js';
import React, {useState} from 'react';
import {MessageCircle,Send,Smile,History,Users,Check} from 'lucide-react';
import {bonus,calcScores,buildMatchups} from '../../utils/ruleEngine.js';
import {GameButton,Sheet} from '../ui/GameUI.jsx';
import GameHeader from './GameHeader.jsx';
import TableSurface from './TableSurface.jsx';
import ArrangementBoard from './ArrangementBoard.jsx';
import AnimatedScore from './AnimatedScore.jsx';
import Showdown from './Showdown.jsx';
import '../../styles/practice-gameplay.css';
import '../../styles/friends-room.css';
export default function GameRoomView({room,players,myId,isHost,hand,selectedCard,ghostRef,ghostNumRef,ghostSuitRef,floatingEmojis,player,roomId,handleExitRoom,setHistoryOpen,joinActive,setReadyState,handleHostStart,seats,renderCard,myChips,moveCardTo,handleSwapMidBack,handleAutoArrange,handleUndo,handleReset,handleSubmitHand,handleCancelSubmit,handleSendEmoji,handleCloseRoom,handleNextRound,chatOpen,setChatOpen,chatList,chatMsg,setChatMsg,handleSendChat,historyOpen,historyList,undoStack,soundVolume,setSoundVolume,speechMuted,setSpeechMuted}) {
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [emojiOpen,setEmojiOpen]=useState(false);
 const [socialOpen,setSocialOpen]=useState(false);
 const activePlayers=players.filter(p=>!p.isSpectator&&!p.isQueue);
 const me=players.find(p=>p.id===myId);
 const self=me&&!me.isSpectator&&!me.isQueue?{...player,...me,chips:myChips}:undefined;

  return (
    <div className={`game-session friends-room friends-room--${room.status} ${room.status==='playing'?'friends-gameplay':''}`}>
 
      <GameHeader title="ห้องเล่นกับเพื่อน" subtitle={`โต๊ะ ${roomId} · อัตรา ${room.rate} · รอบ ${room.round||0}`} onBack={handleExitRoom} onSocial={()=>setSocialOpen(true)} onSettings={()=>setSettingsOpen(true)}/>
      {socialOpen&&<Sheet title="ร่วมโต๊ะ" onClose={()=>setSocialOpen(false)}><div className="friends-social-menu"><GameButton variant="secondary" onClick={()=>{setSocialOpen(false);setChatOpen(true);}}><MessageCircle size={22}/> แชทกับเพื่อน</GameButton><GameButton variant="secondary" onClick={()=>{setSocialOpen(false);setEmojiOpen(true);}}><Smile size={22}/> ส่งอีโมจิ</GameButton><GameButton variant="secondary" onClick={()=>{setSocialOpen(false);setHistoryOpen(true);}}><History size={22}/> ประวัติการเล่น</GameButton></div></Sheet>}
      {settingsOpen&&<Sheet title="ตั้งค่า" onClose={()=>setSettingsOpen(false)}><label className="setting-row"><span>ระดับเสียงเอฟเฟกต์</span><input type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={e=>setSoundVolume(Number(e.target.value))}/></label><label className="setting-row"><span>เสียงพูดประกาศผล</span><input type="checkbox" checked={!speechMuted} onChange={e=>setSpeechMuted(!e.target.checked)}/></label><p className="muted">ตั้งค่าสำหรับการเข้าห้องครั้งนี้</p></Sheet>}
      {/* PERSISTENT GHOST CARD */}
      <div
        ref={ghostRef}
        className="poker-card"
        style={{
          position: 'fixed', left: 0, top: 0, display: 'none',
          pointerEvents: 'none', zIndex: 9999, opacity: 0.95,
          boxShadow: '0 14px 36px rgba(0,0,0,0.55)', willChange: 'transform', transition: 'none'
        }}
      >
        <span ref={ghostNumRef} className="card-num" style={{ fontSize: '25px', fontWeight: 900, lineHeight: 1 }}></span>
        <span ref={ghostSuitRef} className="card-suit" style={{ fontSize: '26px', lineHeight: 1 }}></span>
      </div>
 
      {/* FLOATING EMOJIS */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
        {floatingEmojis.map(x => (
          <div key={x.id} className="table-emoji">
            <span style={{ fontSize: '18px', marginRight: '6px' }}>{x.avatar}</span>
            <span>{x.emoji}</span>
          </div>
        ))}
      </div>
 
      {room.status==='lobby'&&<div className="friends-waiting">
        <div className="friends-room-info"><div><span>ชวนเพื่อนมาร่วมวง</span><h2>โต๊ะ <b>{roomId}</b></h2></div><span className="friends-occupancy"><Users size={17}/>{activePlayers.length} / 4 คน</span></div>
        <TableSurface seats={seats} self={self} status={activePlayers.length<2?'รอเพื่อนมาร่วมโต๊ะ':'พร้อมเมื่อไหร่ เริ่มได้เลย'}/>
        <div className="friends-waiting-footer">
          <div className="friends-invite-note"><span>ให้เพื่อนเลือกโต๊ะ <strong>{roomId}</strong> ในหน้าห้องเล่น</span><small>อัตรา {room.rate} · {room.maxRounds > 0 ? room.maxRounds+' รอบ' : 'ไม่จำกัดรอบ'}</small></div>
          <details className="friends-roster"><summary>ผู้ร่วมโต๊ะ <span>{activePlayers.filter(p=>p.ready).length} คนพร้อมแล้ว</span></summary><div>{players.map(p=><span key={p.id}>{p.avatar} {p.name}<small>{p.isSpectator?'ผู้ชม':p.isQueue?'รอคิว':p.isHost?'หัวห้อง':p.ready?'พร้อม':'รอพร้อม'}</small></span>)}</div></details>
          <div className="friends-start">
            {!myId&&<GameButton onClick={joinActive}><Users size={20}/> เข้าร่วมเป็นผู้เล่น</GameButton>}
            {myId&&!players.find(p=>p.id===myId)?.ready&&!isHost&&<GameButton onClick={setReadyState}><Check size={20}/> พร้อมเล่น</GameButton>}
            {isHost&&players.filter(p=>!p.isSpectator).length>=2&&<GameButton onClick={handleHostStart}>เริ่มเกมแจกไพ่</GameButton>}
            {isHost&&players.filter(p=>!p.isSpectator).length<2&&<p role="status">รอเพื่อนเข้าร่วมโต๊ะ เพื่อเริ่มเกม</p>}
            {!isHost&&me?.ready&&<p role="status"><Check size={18}/> คุณพร้อมแล้ว · รอหัวห้องเริ่มเกม</p>}
          </div>
        </div>
      </div>}
      {room.status==='playing'&&<><div className="game-play-layout"><TableSurface seats={seats} self={self} hands={room.hands||{}} compact status={hand.done?'รอผู้เล่น':'กำลังจัดไพ่'}/><div className="arrangement-column">
        {new Set([...hand.front,...hand.mid,...hand.back,...hand.unplaced].map(c=>c.val)).size===13&&<div className="dragon-notice">🎉 คุณได้รับไพ่มังกร</div>}
        <ArrangementBoard key={room.round||0} hand={hand} selectedCard={selectedCard} renderCard={renderCard} moveCardTo={moveCardTo} onUndo={handleUndo} onReset={handleReset} onSwap={handleSwapMidBack} onAuto={handleAutoArrange} onSubmit={handleSubmitHand} onCancel={handleCancelSubmit} undoCount={undoStack.length}/>
      </div></div></>}
      {/* RESULTS */}
      {room.status === 'results' && (
        <div className="results-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#081708', padding: '14px', overflowY: 'auto' }}>
          <Showdown key={room.round||0} players={players.filter(p=>!p.isSpectator&&!p.isQueue&&room.deals&&room.deals[p.id])} hands={room.hands||{}} focusName={activePlayers.some(p=>p.name===player.name)?player.name:undefined}/>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--primary)', textAlign: 'center', marginBottom: '14px' }}>🏆 ผลรวมรอบการเล่นนี้</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {calcScores(players.filter(p => !p.isSpectator && room.deals && room.deals[p.id]), handsByPlayerName(players, room.hands || {})).map((s, idx) => {
              const isWin = s.roundScore > 0;
              const rate = room.rate || 1;
              const commissionPercent = room.commission || 0;
              const grossChips = s.roundScore * rate;
              const commDeducted = (grossChips > 0 && commissionPercent > 0) ? (grossChips * (commissionPercent / 100)) : 0;
              const netChips = Math.round((grossChips - commDeducted) * 100) / 100;

              return (
                <div key={s.id||s.name} className="glass-panel score-reveal" style={{'--score-index':idx,'--score-glow':isWin?'#78d49a':s.roundScore<0?'#d58d95':'#d4b779', padding: '12px', borderLeft: '4px solid ' + (isWin ? '#40e880' : s.roundScore < 0 ? '#ff6d86' : 'var(--line)') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '14px' }}>
                    <span>{s.avatar} {s.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: netChips > 0 ? '#40e880' : netChips < 0 ? '#ff6d86' : '#fff', fontWeight: '900', fontSize: '15px' }}>
                        <AnimatedScore value={netChips} unit="ชิป" delay={idx*110}/> 
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>
                        {s.roundScore > 0 ? '+' : ''}{s.roundScore} แต้ม (อัตรา x{rate}) {commDeducted > 0 ? `• ต๋ง ${commissionPercent}%` : ''}
                      </div>
                    </div>
                  </div>
                  {s.bonusLabel && <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', marginTop: '4px' }}>🌟 โบนัสพิเศษ: {s.bonusLabel}</div>}
                </div>
              );
            })}
          </div>

          <details className="result-details"><summary>ดูรายละเอียดเทียบไพ่รายคู่</summary>
          {/* MATCHUPS DETAILED BREAKDOWN */}
          <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)', marginTop: '16px', marginBottom: '10px' }}>⚔️ รายละเอียดการเทียบไพ่รายคู่</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {buildMatchups(players.filter(p => !p.isSpectator && !p.isQueue && room.deals && room.deals[p.id]), handsByPlayerName(players, room.hands || {})).map((m, mIdx) => {
              const p1 = m.a;
              const p2 = m.b;
              return (
                <div key={mIdx} className="glass-panel animate-pop-up" style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.25)', borderRadius: '12px' }}>
                  {/* Pair Header */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '900', fontSize: '13px' }}>
                    {m.talu && m.taluWinner && m.taluWinner.id === p1.id && (
                      <span style={{ 
                        color: '#ffd700', 
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,180,0,0.25) 100%)', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        border: '1.5px solid #ffd700', 
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 0 8px rgba(255,215,0,0.4)',
                        fontWeight: '900',
                        letterSpacing: '0.5px'
                      }}>
                        👑 กินทะลุ
                      </span>
                    )}
                    <span>{p1.avatar} {p1.name}</span>
                    <span style={{ color: 'var(--primary)', fontSize: '11px', background: 'rgba(212,175,55,0.15)', padding: '2px 8px', borderRadius: '10px' }}>VS</span>
                    <span>{p2.avatar} {p2.name}</span>
                    {m.talu && m.taluWinner && m.taluWinner.id === p2.id && (
                      <span style={{ 
                        color: '#ffd700', 
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,180,0,0.25) 100%)', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        border: '1.5px solid #ffd700', 
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 0 8px rgba(255,215,0,0.4)',
                        fontWeight: '900',
                        letterSpacing: '0.5px'
                      }}>
                        👑 กินทะลุ
                      </span>
                    )}
                  </div>

                  {/* Rows comparison */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {m.rows.map((row, rIdx) => {
                      const isFoulP1 = (room.hands || {})[p1.name]?.foul || (room.hands || {})[p1.id]?.foul;
                      const isFoulP2 = (room.hands || {})[p2.name]?.foul || (room.hands || {})[p2.id]?.foul;
                      
                      let resultLabel1 = '';
                      let resultLabel2 = '';
                      let labelColor1 = '#fff';
                      let labelColor2 = '#fff';
                      
                      if (isFoulP1 && isFoulP2) {
                        resultLabel1 = 'ฟาวล์';
                        resultLabel2 = 'ฟาวล์';
                        labelColor1 = '#ff6d86';
                        labelColor2 = '#ff6d86';
                      } else if (isFoulP1) {
                        resultLabel1 = 'ฟาวล์';
                        resultLabel2 = 'ชนะ';
                        labelColor1 = '#ff6d86';
                        labelColor2 = '#40e880';
                      } else if (isFoulP2) {
                        resultLabel1 = 'ชนะ';
                        resultLabel2 = 'ฟาวล์';
                        labelColor1 = '#40e880';
                        labelColor2 = '#ff6d86';
                      } else {
                        if (row.winner > 0) {
                          const bPts = bonus(row.aCards, row.key).pts;
                          const pts = bPts > 0 ? bPts : 1;
                          resultLabel1 = `ชนะ (+${pts})`;
                          resultLabel2 = `แพ้ (-${pts})`;
                          labelColor1 = '#40e880';
                          labelColor2 = '#ff6d86';
                        } else if (row.winner < 0) {
                          const bPts = bonus(row.bCards, row.key).pts;
                          const pts = bPts > 0 ? bPts : 1;
                          resultLabel1 = `แพ้ (-${pts})`;
                          resultLabel2 = `ชนะ (+${pts})`;
                          labelColor1 = '#ff6d86';
                          labelColor2 = '#40e880';
                        } else {
                          resultLabel1 = 'เสมอ (0)';
                          resultLabel2 = 'เสมอ (0)';
                          labelColor1 = '#aaa';
                          labelColor2 = '#aaa';
                        }
                      }

                      return (
                        <div key={rIdx} style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', alignItems: 'center' }}>
                            {/* Player 1 Result Badge on Left */}
                            <span style={{ 
                              color: labelColor1, 
                              fontWeight: '900', 
                              fontSize: '10px',
                              background: resultLabel1.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.12)' : (resultLabel1.startsWith('แพ้') || resultLabel1.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${resultLabel1.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.3)' : (resultLabel1.startsWith('แพ้') || resultLabel1.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                            }}>
                              {resultLabel1}
                            </span>

                            <span style={{ color: 'var(--text-muted)' }}>กอง{row.label}</span>

                            {/* Player 2 Result Badge on Right */}
                            <span style={{ 
                              color: labelColor2, 
                              fontWeight: '900', 
                              fontSize: '10px',
                              background: resultLabel2.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.12)' : (resultLabel2.startsWith('แพ้') || resultLabel2.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${resultLabel2.startsWith('ชนะ') ? 'rgba(64, 232, 128, 0.3)' : (resultLabel2.startsWith('แพ้') || resultLabel2.startsWith('ฟาวล์')) ? 'rgba(255, 109, 134, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                            }}>
                              {resultLabel2}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            {/* Player 1 Cards */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                display: 'flex', 
                                gap: '2px', 
                                flexWrap: 'nowrap', 
                                scale: '0.85', 
                                transformOrigin: 'left center', 
                                width: row.key === 'front' ? '68px' : '108px' 
                              }}>
                                {row.aCards.map((c, cIdx) => {
                                  const isRed = c.suit === '♥' || c.suit === '♦';
                                  return (
                                    <div key={cIdx} style={{ 
                                      background: '#fff', 
                                      color: isRed ? '#ff4d4d' : '#111', 
                                      padding: '2px 4px', 
                                      borderRadius: '4px', 
                                      fontSize: '11px', 
                                      fontWeight: '900', 
                                      width: '20px', 
                                      textAlign: 'center', 
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      lineHeight: 1
                                    }}>
                                      <span>{c.rank}</span>
                                      <span style={{ fontSize: '10px' }}>{c.suit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isFoulP1 ? '⚠️ ฟาวล์' : row.aName}
                              </span>
                            </div>

                            {/* VS separator */}
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', fontWeight: 'bold' }}>vs</div>

                            {/* Player 2 Cards */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, justifyContent: 'flex-end', textAlign: 'right' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isFoulP2 ? '⚠️ ฟาวล์' : row.bName}
                              </span>
                              <div style={{ 
                                display: 'flex', 
                                gap: '2px', 
                                flexWrap: 'nowrap', 
                                scale: '0.85', 
                                transformOrigin: 'right center', 
                                width: row.key === 'front' ? '68px' : '108px', 
                                justifyContent: 'flex-end' 
                              }}>
                                {row.bCards.map((c, cIdx) => {
                                  const isRed = c.suit === '♥' || c.suit === '♦';
                                  return (
                                    <div key={cIdx} style={{ 
                                      background: '#fff', 
                                      color: isRed ? '#ff4d4d' : '#111', 
                                      padding: '2px 4px', 
                                      borderRadius: '4px', 
                                      fontSize: '11px', 
                                      fontWeight: '900', 
                                      width: '20px', 
                                      textAlign: 'center', 
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      lineHeight: 1
                                    }}>
                                      <span>{c.rank}</span>
                                      <span style={{ fontSize: '10px' }}>{c.suit}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          </details>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            {(room.maxRounds > 0 && room.round >= room.maxRounds) && (
              <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.35)', borderRadius: '8px', color: '#ff6d86', fontSize: '12px', fontWeight: 'bold' }}>
                เล่นครบกำหนด {room.maxRounds} รอบแล้ว {isHost ? 'กรุณากดปิดห้องเพื่อจบเกมครับ' : 'กรุณารอโฮสต์ปิดห้องเพื่อจบเกมครับ'}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {!players.some(p => p.name === player.name && !p.isSpectator && !p.isQueue) && players.filter(p => !p.isSpectator && !p.isQueue).length < 4 && (!room.maxRounds || room.round < room.maxRounds) && (
                <button className="btn-premium" style={{ flex: 1, padding: '12px' }} onClick={joinActive}>➕ เข้าร่วมเล่นรอบถัดไป</button>
              )}
              {isHost ? (
                (room.maxRounds > 0 && room.round >= room.maxRounds) ? (
                  <button className="btn-premium" style={{ flex: 1, padding: '12px', background: '#d11f1f', border: '1px solid #d11f1f' }} onClick={handleCloseRoom}>❌ ปิดห้องเล่นเกม</button>
                ) : (
                  <button className="btn-premium" style={{ flex: 1, padding: '12px' }} onClick={handleNextRound}>▶ เริ่มรอบถัดไป</button>
                )
              ) : null}
              <button className="btn-secondary" style={{ padding: '12px 20px' }} onClick={handleExitRoom}>ออกห้อง</button>
            </div>
          </div>
        </div>
      )}
 

      {emojiOpen&&<Sheet title="ส่งอีโมจิ" onClose={()=>setEmojiOpen(false)}><div className="emoji-choices">{['😂','😭','🔥','💸','🐉','👑','🎉'].map(emoji=><GameButton key={emoji} variant="secondary" aria-label={`ส่ง ${emoji}`} onClick={()=>{handleSendEmoji(emoji);setEmojiOpen(false);}}>{emoji}</GameButton>)}</div></Sheet>}
      {/* CHAT DRAWER */}
      {chatOpen && (
        <div className="chat-drawer" role="region" aria-label="แชท" style={{ position: 'fixed', inset: 'auto 0 0 0', zIndex: 200, display: 'flex', flexDirection: 'column', maxHeight: '50vh', background: '#1c1c28', borderTop: '2px solid var(--line)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '13px' }}>💬 แชทส่งข่าวกันร่วมโต๊ะ</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer' }} aria-label="ปิดแชท" onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {chatList.map(msg => (
              <div key={msg.id} style={{ alignSelf: msg.name === player.name ? 'flex-end' : 'flex-start', background: msg.name === player.name ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: msg.name === player.name ? '#23180a' : '#fff', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%', fontSize: '13px' }}>
                <span style={{ fontSize: '10px', opacity: 0.6, display: 'block' }}>{msg.name}</span>
                {msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '6px', padding: '8px' }}>
            <input type="text" className="form-input" aria-label="ข้อความแชท" placeholder="พิมพ์ข้อความ..." value={chatMsg} onChange={e => setChatMsg(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" aria-label="ส่งข้อความ" className="btn-premium" style={{ padding: '8px 12px' }}><Send size={14} /></button>
          </form>
        </div>
      )}

      {/* HISTORY DRAWER */}
      {historyOpen && (
        <div className="history-drawer" role="region" aria-label="ประวัติ" style={{ 
          position: 'fixed', 
          inset: 'auto 0 0 0', 
          zIndex: 200, 
          display: 'flex', 
          flexDirection: 'column', 
          maxHeight: '75vh', 
          background: '#0d1610', 
          borderTop: '2px solid var(--primary)', 
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.8)'
        }}>
          <div style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📜 ประวัติไพ่และการเล่น (ผ่านไปแล้ว)
            </span>
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }} 
              aria-label="ปิดประวัติ" onClick={() => setHistoryOpen(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(!historyList || historyList.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                ยังไม่มีบันทึกประวัติการเล่นในห้องนี้
              </div>
            ) : (
              [...historyList].reverse().map((hRecord, rIdx) => (
                <div key={rIdx} className="glass-panel" style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '8px', fontWeight: '900', fontSize: '13px', color: 'var(--primary)' }}>
                    <span>รอบที่ {hRecord.round}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(hRecord.timestamp || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {hRecord.scores.map((scItem, sIdx) => {
                      const pHand = (hRecord.hands || {})[scItem.id] || (hRecord.hands || {})[scItem.name] || {};
                      const netScore = scItem.roundScore;
                      return (
                        <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: sIdx === hRecord.scores.length - 1 ? 0 : '8px', borderBottom: sIdx === hRecord.scores.length - 1 ? 'none' : '1px dashed rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                            <span style={{ fontWeight: '800' }}>
                              {scItem.avatar} {scItem.name} 
                              {pHand.foul && <span style={{ color: '#ff6d86', fontSize: '10px', marginLeft: '6px' }}>⚠️ ฟาวล์</span>}
                              {scItem.bonusLabel && <span style={{ color: '#ffd700', fontSize: '10px', marginLeft: '6px', background: 'rgba(255,215,0,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,215,0,0.2)' }}>🏆 {scItem.bonusLabel}</span>}
                            </span>
                            <span style={{ fontWeight: '900', color: netScore > 0 ? '#40e880' : netScore < 0 ? '#ff6d86' : '#fff' }}>
                              {netScore > 0 ? '+' : ''}{netScore} แต้ม
                            </span>
                          </div>

                          {!pHand.foul && pHand.front && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px' }}>
                              {/* Front */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', fontWeight: '800' }}>หน้า:</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {pHand.front.map((c, cIdx) => {
                                    const isRed = c.suit === '♥' || c.suit === '♦';
                                    return (
                                      <div key={cIdx} style={{ 
                                        background: '#fff', 
                                        color: isRed ? '#d11f1f' : '#1a1a1a', 
                                        borderRadius: '4px', 
                                        fontSize: '11px', 
                                        fontWeight: '900', 
                                        width: '26px', 
                                        height: '36px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '2px 0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                        lineHeight: 1 
                                      }}>
                                        <span style={{ fontSize: '10px' }}>{c.rank}</span>
                                        <span style={{ fontSize: '9px', marginTop: '-2px' }}>{c.suit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Mid */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', fontWeight: '800' }}>กลาง:</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {pHand.mid.map((c, cIdx) => {
                                    const isRed = c.suit === '♥' || c.suit === '♦';
                                    return (
                                      <div key={cIdx} style={{ 
                                        background: '#fff', 
                                        color: isRed ? '#d11f1f' : '#1a1a1a', 
                                        borderRadius: '4px', 
                                        fontSize: '11px', 
                                        fontWeight: '900', 
                                        width: '26px', 
                                        height: '36px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '2px 0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                        lineHeight: 1 
                                      }}>
                                        <span style={{ fontSize: '10px' }}>{c.rank}</span>
                                        <span style={{ fontSize: '9px', marginTop: '-2px' }}>{c.suit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Back */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '32px', fontWeight: '800' }}>หลัง:</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {pHand.back.map((c, cIdx) => {
                                    const isRed = c.suit === '♥' || c.suit === '♦';
                                    return (
                                      <div key={cIdx} style={{ 
                                        background: '#fff', 
                                        color: isRed ? '#d11f1f' : '#1a1a1a', 
                                        borderRadius: '4px', 
                                        fontSize: '11px', 
                                        fontWeight: '900', 
                                        width: '26px', 
                                        height: '36px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between', 
                                        padding: '2px 0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(0,0,0,0.15)',
                                        lineHeight: 1 
                                      }}>
                                        <span style={{ fontSize: '10px' }}>{c.rank}</span>
                                        <span style={{ fontSize: '9px', marginTop: '-2px' }}>{c.suit}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
