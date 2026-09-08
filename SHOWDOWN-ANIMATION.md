# Animated showdown

Shared Showdown component added to practice and online result views. Opens a native modal after a round settles; replays are available from the result page. Front, middle and back appear in sequence, with synchronized two-sided 3D card flips (550ms plus 45ms per card), winner highlight after 950ms, next pile after 2200ms, then a per-pile summary. Player pairs advance manually. Close/skip never waits for animation. Reduced motion reveals cards immediately and advances manually. Modal focus, timer cleanup and bounded row index included.

Uses the existing buildMatchups helper for card comparison, including same-rank tiebreaks and foul handling. No score multipliers or per-pile point values are invented; totals and bonuses remain in the existing result view. Practice supplies completed hand data with the existing validArr foul check. The old practice detail panel has a pre-existing rank-only comparison limitation; it is unchanged. New animation uses the canonical engine comparator, as scoring already does.

Unchanged: all practice gameplay/settlement functions, GameRoom controller, ruleEngine, aiEngine, Firebase schema, Firestore rules, Cloud Functions and net-chip calculations. No new dependency, audio or raster asset. Existing table artwork reused.

Validation: npm build/test/lint:ui pass. Original practice handler prefix and core files compared against checkpoint. Browser: actual practice deal/arrange/submit → auto-showdown, three opponent pairs, next pair, skip, return to results. Online presentation fixture verified front win/middle loss/back win, summary, replay and close. 390×844 rendering and 320×568 scroll/controls inspected. Recorded GIF at about 8.5 fps; it is not an FPS benchmark. Console samples contain only extension metadata errors. Live Firebase multiplayer and physical-device/reduced-motion testing remain unverified.

Preview: showdown-preview.gif.
