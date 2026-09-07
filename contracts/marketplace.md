# Marketplace claim ledger

Every listing claim below names shipped source and executable evidence. A clean
Buzz render receipt and human visual approval are still required before any
submission.

| Claim | Shipped source | Executable proof |
| --- | --- | --- |
| Opens from an Omarchy bar button into a fullscreen overlay | `BarWidget.qml`, `Overlay.qml`, `manifest.json` | `tests/contract.test.js`, `scripts/rig-verify.sh`, `scripts/rig-render.sh` |
| Names five travelers and manages store, pace, rations, health, events, rivers, repairs, and endings | `JourneyRules.js`, `JourneyView.qml`, `TrailScene.qml` | `tests/journey.suite.js` |
| Hunting has moving wildlife, aiming, ammunition, carry limits, spoilage, waste, and expedition costs | `HuntingRules.js`, `HuntingBoard.qml` | `tests/hunting.suite.js`, journey integration test |
| Players can choose original omaTrail rules or an independently built Classic 1978-inspired profile | `JourneyRules.js`, `JourneyView.qml`, `contracts/classic-1978.md` | rules-profile, migration, playthrough, and UI contract tests |
| Green Monitor and Color Deluxe share one semantic game state for either rules profile | all presentation QML, both rules engines | profile-invariance tests in `tests/hunting.suite.js` and `tests/journey.suite.js` |
| Runs offline with no telemetry, accounts, daemon, or elevated access | complete runtime tree | `tests/contract.test.js`, C31, C34, C35, C38 |
| Stores one bounded save and one last-good backup | `SaveStore.qml`, `bin/omatrail-state`, `JourneyRules.js` | `tests/state-helper.test.js`, save tests in `tests/journey.suite.js`, C41 |
| One careful journey policy with modeled hunt results can finish both rules profiles on every difficulty | `JourneyRules.js` | 360 seeded journey-policy simulations in `tests/journey.suite.js` |
| Hunting remains viable without an infinite-food strategy dominating skilled play | both rules engines, fresh-ground Classic hunting, carry and waste scoring | 100,000 deterministic runs over 480 cells in `reports/balance/balance-100000.json` and retained-report assertions |
| Marketplace art represents both rules profiles in both visual profiles | `assets/banner.svg`, live `preview.png`, `evidence/render-matrix/` | C43, twenty render receipts, `scripts/approve-preview.sh` |

The description and `barWidget.description` are identical and exactly 500
characters, and link to the public
[design decision Gist](https://gist.github.com/jeremylongshore/f6bfa2df134361ec33faa552a6df56d1).
The route and people are disclosed as fictional composites in the README and source.
