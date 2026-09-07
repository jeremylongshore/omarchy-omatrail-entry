# Contributing

Contributions to omaTrail are welcome. Keep changes small, evidence-backed, and
compatible with a stock Omarchy installation.

## Before opening a pull request

```bash
npm ci
npm test
npm run test:race
npm run test:mutation
npm run audit
scripts/run-plugin-gates.sh .
```

Use Conventional Commits such as `feat:`, `fix:`, `test:`, `docs:`, and `ci:`.
Do not hand-edit `scripts/gates/`; the lane is synced from its canonical source.

## Gameplay changes

- Keep all state transitions deterministic and driven by explicit actions.
- Preserve semantic parity between Green Monitor and Color Deluxe.
- Add a seed-based regression for balance, conservation, or outcome changes.
- Make hunting useful but optional for a carefully supplied expedition.
- Keep fictional route text clearly identified as fictional composite content.
- Never add runtime network access, telemetry, or a non-stock interpreter.

## Visible changes

Run the real-shell checks when QML, layout, controls, or graphics change:

```bash
scripts/rig-verify.sh .
scripts/rig-render.sh . preview.png
scripts/approve-preview.sh
```

The render receipt must bind a clean commit. A static validator or mockup is not
evidence that the plugin loaded and rendered correctly.

## Tracking

Project work is tracked in the parent `000-projects` Beads database. Do not add
markdown TODO lists or ad hoc memory files to this repository.
