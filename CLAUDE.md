# omaTrail Repository Guide

omaTrail is a combined Omarchy overlay and bar-widget plugin. `JourneyRules.js`
and `HuntingRules.js` are pure deterministic state engines shared by QML and
Node tests. `Overlay.qml` owns shell lifecycle, `JourneyView.qml` owns journey
presentation, `HuntingBoard.qml` owns the real-time hunt, and `SaveStore.qml`
owns bounded local persistence.

Follow `AGENTS.md`. Track work in the parent Beads database. Preserve the two
visual profiles over one semantic state, avoid non-stock runtime dependencies,
and never hand-edit vendored gates. The minimum local evidence is `npm test`
plus `scripts/run-plugin-gates.sh .`; release evidence also requires clean Buzz
validator and render receipts.
