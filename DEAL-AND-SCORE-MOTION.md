# Deal and score motion

Adds shared presentation animations to PracticeRoom and GameRoomView, without changing settlement.

- Fresh unplaced 13-card hand: 320ms transform/opacity entry per card, 36ms stagger, patterned back fades to face. Deal state clears after 800ms.
- Pointer or keyboard interaction immediately ends the deal effect; no game controls are delayed. Reset/undo do not replay the deal. Online board is keyed to round for a fresh presentation each round.
- Results: rows enter 110ms apart; displayed amounts count up/down over 720ms, followed by a restrained outline glow. Positive, negative and tied rows retain existing colors. Integer scores stay integer; fractional chip totals retain two decimals.
- Final score is immediately available to assistive technology; intermediate numbers are aria-hidden. Reduced-motion preference skips animations and counting; changing it during counting finishes immediately. All timers and animation-frame callbacks clean up on unmount.
- No dependencies, assets or sounds added. Existing sound controls and cues unchanged.

Validation: build, baseline engine/core-preservation tests and UI lint passed. Practice handler prefix, GameRoom controller, and existing commission/net-chip calculation compared against checkpoint and unchanged. Actual PracticeRoom browser flow: deal, auto-arrange, submit, result, next round and reset. Observed stagger timings 0/36/72ms; reset had animation:none. Final practice totals +1,-1,+3,-3 matched their accessible final values. Friend view fixture counted from 0 to +10/-10 chips. Rendered mobile result screens inspected at 390×844; no application errors observed in sampled logs (extension metadata errors remain).

Limits: short animation frames are difficult to capture reliably in this remote browser; live DOM confirmed activation/timings and completed frames were visually inspected. No physical-device FPS measurement, reduced-motion device emulation, or live multiplayer test performed. Existing synchronous AI work can delay the start of animation; it was left unchanged.
