# QML to rules contract

`Overlay.qml`, `JourneyView.qml`, `TrailScene.qml`, and `HuntingBoard.qml` call
only top-level functions exported from `JourneyRules.js` and `HuntingRules.js`.
The rules modules contain no QML, wall clock, filesystem, process, or network
access. Every gameplay change is an explicit action against cloned state.

`tests/contract.test.js` derives QML calls and checks their Node export surface.
The same test verifies the manifest, module identity, entry points, launcher,
and offline runtime claim. `tests/journey.test.js` and `tests/hunting.test.js`
prove deterministic replay and presentation-profile invariance.

Persistence accepts only schema version 1, caps UTF-8 documents at 64 KiB, and
validates the complete game state before restoration. Invalid primary saves may
fall back to one last-good copy. If neither file is safe and valid, the UI
requires an explicit Start Fresh action before the descriptor-bound helper
deletes them. QML never opens a save pathname directly.
