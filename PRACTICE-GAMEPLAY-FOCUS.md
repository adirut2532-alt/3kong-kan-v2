# Practice gameplay focus

## Scope
Practice playing screen only. Premium felt/walnut artwork, colors, avatars and all existing interactions retained. Source changes: src/styles/practice-gameplay.css plus one CSS import and one class in src/components/PracticeRoom.jsx. The rest of PracticeRoom was compared byte-for-byte with commit 8a0cc6d after removing those two presentation changes.

## Measured at 390 × 844
- Table: 206 → 140 px (32% shorter). Four positions retained; compact top/bottom seats and central identity.
- Arrangement board: 646 px; scrollable gameplay area 472 px.
- Pile cards: 64 × 76 px, previously 68 px high. Rank 27 px; center suit 35 px.
- Hand tray: seven columns, roughly 46 × 64 px cards; five columns on narrow phones.
- Secondary tools: 44 px tall, undo/reset 44 px wide. Neutral styling.
- Gold confirmation: 366 × 54 px. Bottom safe-area padding retained.
- Full arranged hand and initial 13-card hand visible at target viewport. Intermediate distributions can scroll when needed; controls stay pinned.

## Verification
Opened the real PracticeRoom component in the existing isolated browser harness (no online account writes). Inspected rendered screenshots at 390×844, 320×568 and 844×390. Small and landscape screens retain scrolling gameplay and visible confirmation; they cannot show all cards simultaneously.

Verified select → place → undo; auto arrange → swap (foul) → undo (valid) → submit → result → next round. No scoring or rule changes. Browser automation uses pointer clicks; physical phone touch and notch hardware were not tested.

Build, baseline engine tests, core preservation checks and UI lint pass. Existing large entry bundle warning remains; observed console errors were extension metadata errors. Online multiplayer was not exercised in this practice-only revision.

Screenshot: deliverables/practice-gameplay-focus.jpg (actual browser, phone viewport within QA harness).
