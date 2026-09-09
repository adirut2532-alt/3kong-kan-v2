import React, {useEffect, useState} from 'react';
import '../../styles/game-motion.css';

// Only the displayed number moves. Settlement always uses the supplied final value.
export default function AnimatedScore({value, unit, delay=0}) {
  const [display,setDisplay]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?value:0);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame;
    let start;
    const finish=()=>{cancelAnimationFrame(frame);setDisplay(value);};
    if(preference.matches) { finish(); return; }
    setDisplay(0);
    const tick=now=>{
      if(start===undefined) start=now;
      const progress=Math.min(1,Math.max(0,(now-start-delay)/720));
      const eased=1-Math.pow(1-progress,3);
      const precision=Number.isInteger(value)?1:100;
      setDisplay(progress===1?value:Math.trunc(value*eased*precision)/precision);
      if(progress<1) frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    preference.addEventListener('change',finish);
    return ()=>{cancelAnimationFrame(frame);preference.removeEventListener('change',finish);};
  },[value,delay]);
  const format=n=>`${n>0?'+':''}${n.toLocaleString('th-TH',{maximumFractionDigits:2})}`;
  return <span className="animated-score"><span className="motion-sr-only">{format(value)} {unit}</span><span aria-hidden="true">{format(display)} {unit}</span></span>;
}
