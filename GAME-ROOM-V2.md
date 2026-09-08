# Game Room V2 — visual review checkpoint

2026-09-06. Continues the approved redesign using the original engine and existing table WebP. This pass reuses existing artwork; no new generated raster asset was created.

Changed: four seat presentation and empty seats; dark player nameplates and framed avatars; larger face-card suit symbols; original renderCard pointer handlers retained through React.cloneElement; empty piles collapse to smaller drop targets; main application now imports game-room-v2.css (previous unfinished pass imported it only in QA).

Fixed UI event delegation: online cards use data-source while practice cards use data-card-zone. Board ignores bubbled card clicks for both conventions. No dealing, scoring, AI, auth, Firebase, or Cloud Functions changes.

Visual checks: actual browser at 390x844 and 320x568 in dev QA iframe. Practice uses the actual PracticeRoom component with a local fixture identity. Verified selection 4-diamonds -> front pile (12 remaining), undo, auto arrange (ready), submit -> results (+1,-8,+8,-1), and next round with updated practice chips. Small screens retain scrolling card content and visible primary controls. This is not physical iPhone/Android or multiplayer validation. Existing browser extension metadata errors observed; they are not application errors.

Build, lint:ui, existing rule tests and locked-core hashes pass. Firebase entry chunk warning remains. See REDESIGN-README.md and AUDIT.md for existing backend/rule-document discrepancies and release gates.

Preview locally: npm ci; npm run dev; open /qa.html -> ห้องซ้อมแยกจากบัญชี or โต๊ะออนไลน์ ข้อมูลทดสอบ. Production uses normal existing login and room flows. QA fixtures are not a backend substitute and are omitted from the production build.

Screenshots in qa/v2 show rendered browser output, not generated mockups. The portraits remain the user's existing emoji avatars; no invented profile photos or database avatar migration.
