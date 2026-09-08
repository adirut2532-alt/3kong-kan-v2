import React from 'react';
import { ArrowLeft, History, Settings, Users } from 'lucide-react';
import {GameButton} from '../ui/GameUI.jsx';
export default function GameHeader({title,subtitle,onBack,onHistory,onSettings,onSocial}) {
  return <header className="game-header"><GameButton variant="icon" aria-label="กลับ" onClick={onBack}><ArrowLeft size={21}/></GameButton><div><h1>{title}</h1><span>{subtitle}</span></div>{onSocial&&<GameButton variant="icon" aria-label="ร่วมโต๊ะ" onClick={onSocial}><Users size={21}/></GameButton>}{onHistory&&<GameButton variant="icon" aria-label="ประวัติการเล่น" onClick={onHistory}><History size={21}/></GameButton>}{onSettings&&<GameButton variant="icon" aria-label="ตั้งค่า" onClick={onSettings}><Settings size={21}/></GameButton>}</header>;
}
