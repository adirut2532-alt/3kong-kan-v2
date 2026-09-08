import React from 'react';
import { Avatar, Badge, Brand } from '../ui/GameUI.jsx';

const fmt = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const statusFor = (player, hands, compact) => {
  if (hands[player.id]?.done || hands[player.name]?.done) return ['ส่งแล้ว', 'green'];
  if (compact) return ['กำลังจัด', 'neutral'];
  if (player.ready) return ['พร้อม', 'green'];
  return ['รอเล่น', 'neutral'];
};

function Seat({ player, pos, hands, compact, self = false }) {
  if (!player) {
    return <div className={`player-seat player-seat--empty ${pos.replace('felt-pos-', 'player-seat--')}`} aria-label="ที่นั่งว่าง">
      <span className="empty-seat-mark" aria-hidden="true">+</span><small>ว่าง</small>
    </div>;
  }
  const [label, tone] = statusFor(player, hands, compact);
  return <div className={`player-seat ${self ? 'player-seat--self' : ''} ${pos.replace('felt-pos-', 'player-seat--')}`}>
    <div className="player-seat__portrait"><Avatar value={player.avatar}/>{self && <span className="self-crown" aria-hidden="true">◆</span>}</div>
    <div className="player-seat__plate">
      <strong title={player.name}>{player.name}{self ? ' · คุณ' : ''}</strong>
      <span className="player-seat__chips"><i aria-hidden="true"/> {fmt(player.chips)}</span>
    </div>
    <Badge tone={tone}>{label}</Badge>
  </div>;
}

export default function TableSurface({ seats = [], self, hands = {}, compact = false, status = 'รอผู้เล่น', children }) {
  const fullSeats = ['felt-pos-top', 'felt-pos-left', 'felt-pos-right'].map(pos => seats.find(s => s.pos === pos) || { player: null, pos });
  return <section className={`game-table ${compact ? 'game-table--compact' : ''}`} aria-label="โต๊ะผู้เล่น">
    <div className="game-table__vignette" aria-hidden="true"/>
    <div className="game-table__center">
      <div className="deck-stack" aria-hidden="true"><i/><i/><i/></div>
      <Brand small/>
      <span className="table-status" role="status"><b aria-hidden="true"/> {status}</span>
      {children}
    </div>
    {fullSeats.map(({ player, pos }) => <Seat key={pos} player={player} pos={pos} hands={hands} compact={compact}/>)}
    {self && <Seat player={self} pos="felt-pos-bottom" hands={hands} compact={compact} self/>}
  </section>;
}
