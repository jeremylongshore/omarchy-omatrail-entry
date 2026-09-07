# Testing policy: omaTrail

## Classification

Repository type: Omarchy QML game plugin with pure JavaScript rules engines.
Applicable layers: static, unit, integration, migration, security,
accessibility, system, visual, end-to-end, and acceptance.

## Thresholds

```text
coverage.line: 95
coverage.branch: 90
coverage.function: 95
coverage.statement: 95
mutation.kill_rate: 90 for the named critical decision kernels
flaky.tolerance: 0/3 runs
```

## Required lanes

- `npm test`: pure rules, integration, contracts, accessibility, gate harness,
  hostile save lifecycle cases, 10,000 hunting fields, and 360 seeded
  journey-policy simulations with modeled hunt results.
- `npm run test:race`: three concurrent clean repetitions.
- `npm run test:mutation`: Stryker with a 90 floor over hunting fire and
  settlement, journey hunt-result reconciliation, and save parsing. These are
  the state-changing trust and conservation kernels, not declarative content or
  QML export glue.
- `npm run test:balance`: 100,000 fixed runs across two rules profiles, five
  versioned policies, three difficulties, four occupations, and four departure months. The lane
  composes the public journey dispatcher with genuine hunting-engine results,
  validates every transition, and writes an engine-hashed distribution report.
- `npm run audit`: deterministic audit-harness verification and scan.
- `scripts/run-plugin-gates.sh .`: manifest-verified canonical Omarchy lane.
- `scripts/rig-verify.sh .`: real Omarchy validator and qmllint receipt.
- `scripts/rig-render.sh . preview.png`: real shell load, IPC toggle, and direct
  full-frame capture.
- `scripts/rig-render-matrix.sh . evidence/render-matrix`: five deterministic
  critical scenes in both display profiles, with per-frame hash-bound receipts
  and retained raw shell logs.
- `scripts/rig-runtime-audit.sh .`: live hunting advance, hidden timer freeze,
  focus, resume, shell restart, state-hash stability, process, TCP, memory, and
  open-hide observations on the real Buzz shell.
- `scripts/approve-preview.sh`: hash-bound human visual inspection.

No local test may claim a live Omarchy render. No dirty rig receipt qualifies as
release evidence.

The current balance report is `reports/balance/balance-100000.json`. Its
aggregate SHA-256 is
`c6dfb3d1a8696ad235166e8d28ec3525e88820bd4b2cb1c1a4416553a9c8fe03`.
All 100,000 runs reached a terminal state. Across both rules profiles,
skilled-heavy won 82.56 percent, skilled-light won 77.22 percent, and exploit
won 51.82 percent with a median score of 919. Within Classic, exploit remained
below both skilled policies on survival and scored far lower while averaging
about 735 pounds of avoidable waste.

The current mutation report is `reports/mutation/mutation.json`. The refreshed
current-test run generated 637 mutants, ignored 126 outside the selected
behavioral boundary, killed 476 of 511 scored mutants, left 35 survivors,
recorded zero uncovered mutants, timeouts, or errors, and scored 93.15 percent
against the 90 percent break threshold. The report is Git-trackable and
hash-pinned together with the mutation configuration and test corpus.

The current candidate render ledger is `evidence/render-matrix/matrix.json`.
It contains twenty 1280 by 720 frames over one source fingerprint: hunt, river,
event, trail, and ending in both rules profiles and in Green Monitor and Color Deluxe. Every PNG and raw
shell log reconciles to its receipt. These artifacts come from a dirty
development tree; regenerate them from the exact clean target SHA before
release approval.

The current lifecycle receipt is
`evidence/runtime/runtime-audit.json`. In its dirty-tree Buzz run, the hunt
advanced from tick 0 to 10, hid and remained frozen at tick 11, resumed to tick
21, and restored the same journey after a shell restart. The state SHA-256 was
unchanged across restart, no persistent child or TCP connection was added, and
the receipt records three open-hide cycles. RSS and timing are observations of
the whole shell, not an attribution to this plugin. Regenerate the receipt on
the clean release revision.
