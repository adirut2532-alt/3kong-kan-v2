// Materialize only the signed-in player's private data into the existing view contract.
export function mergePrivateRoom(room, uid, deal, hand) {
  if(room.status!=='playing')return {...room};
  const merged={...room,deals:{...room.deals},hands:{...room.hands}};
  if(deal?.round===room.round)merged.deals[uid]=deal.cards;
  else delete merged.deals[uid];
  if(hand?.round===room.round)merged.hands[uid]=hand;
  return merged;
}

// Prevent a display name equal to another player's member id from selecting the wrong hand.
export function handsByPlayerName(players,hands={}) {
  return Object.fromEntries(players.map(p=>[p.name,hands[p.id]||hands[p.name]]));
}
