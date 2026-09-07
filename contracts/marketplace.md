# Marketplace claim ledger

Every listing claim below names shipped source and executable evidence. A clean
Buzz render receipt and human visual approval are still required before any
submission.

| Claim | Shipped source | Executable proof |
| --- | --- | --- |
| Opens from an Omarchy bar button into a fullscreen overlay | `BarWidget.qml`, `Overlay.qml`, `manifest.json` | `tests/contract.test.js`, `scripts/rig-verify.sh`, `scripts/rig-render.sh` |
| Names five travelers and manages store, pace, rations, health, events, rivers, repairs, and endings | `JourneyRules.js`, `JourneyView.qml`, `TrailScene.qml` | `tests/journey.test.js` |
| Hunting has moving wildlife, aiming, ammunition, carry limits, spoilage, waste, and expedition costs | `HuntingRules.js`, `HuntingBoard.qml` | `tests/hunting.test.js`, journey integration test |
| Green Monitor and Color Deluxe share one semantic game state | all presentation QML, both rules engines | profile-invariance tests in `tests/hunting.test.js` and `tests/journey.test.js` |
| Runs offline with no telemetry, accounts, daemon, or elevated access | complete runtime tree | `tests/contract.test.js`, C31, C34, C35, C38 |
| Stores one bounded save and one last-good backup | `SaveStore.qml`, `bin/omatrail-state`, `JourneyRules.js` | `tests/state-helper.test.js`, save tests in `tests/journey.test.js`, C41 |
| One careful journey policy with modeled hunt results can finish every difficulty | `JourneyRules.js` | 180 seeded journey-policy simulations in `tests/journey.test.js` |
| Marketplace art represents the two visual profiles | `assets/banner.svg`, live `preview.png` | C43, `.render-proof.json`, `scripts/approve-preview.sh` |

The description and `barWidget.description` are identical and exactly 500
characters. The route and people are disclosed as fictional composites in the
README and source.
