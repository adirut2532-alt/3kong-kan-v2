# Friend room visual refresh

## Changes
- Waiting room: framed emerald/walnut table, four visible seat positions, prominent room identifier and player count, compact expandable roster, dominant existing start/ready/join action.
- Self seat now receives the matching player record to show readiness and submission status correctly; no spectator self seat is invented.
- Playing: shares the proven practice composition (140px top table, 76px pile cards, 54px confirmation) through scoped CSS; practice appearance unchanged.
- Chat, emoji and history are grouped in the header social menu; settings remains in the header. No bottom social strip under the confirmation button.
- Existing result calculation/markup retained, with restrained visual surface styling.

## Source boundaries
GameRoom controller, rule engine, AI, Firebase schema, Firestore rules and Cloud Functions unchanged. Eligibility conditions for start, ready and join retained. Calculation section compared against previous commit and unchanged. New local state only opens the social sheet. No new assets, libraries, account writes or deployment.

## Verification
Build, npm test (baseline engine and core preservation), and lint:ui passed. Existing >500kB entry bundle warning remains. Browser inspection at 390×844 (2-player/empty seats and 4-player waiting, playing, result navigation) and 320×568 playing found no horizontal screen overflow; cards scroll on short phones while confirmation stays visible. Opened/closed chat, emoji, history and settings from the revised navigation. Observed console errors were browser-extension metadata errors.

QA uses the real GameRoomView with local fixture props, not live Firebase. Four-seat fixture tests visual positions; result fixture deals are only provided for two players. Fixture buttons simulate room phases and do not validate live multiplayer, real message delivery, or original pointer arrangement handlers. These backend flows still require multi-device integration testing.

## Review
See deliverables/friends-room-waiting.jpg and deliverables/friends-room-playing.jpg, actual browser screenshots in the mobile QA harness.
