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
  hostile save lifecycle cases, 10,000 hunting fields, and 180 seeded
  journey-policy simulations with modeled hunt results.
- `npm run test:race`: three concurrent clean repetitions.
- `npm run test:mutation`: Stryker with a 90 floor over hunting fire and
  settlement, journey hunt-result reconciliation, and save parsing. These are
  the state-changing trust and conservation kernels, not declarative content or
  QML export glue.
- `npm run test:balance`: 100,000 fixed runs across five versioned policies,
  three difficulties, four occupations, and four departure months. The lane
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
`dabb03ad141fd906377719655f8519e4e70a8182d9ff9721f6188c4a4ac83319`.
A 1,000-run sentinel replay produced the same canonical report hash with one
worker and eight workers.

The current mutation report is `reports/mutation/mutation.json`. The refreshed
current-test run killed 195 of 206 covered mutants, left 11 survivors, recorded
zero uncovered mutants or errors, and scored 94.66 percent against the 90
percent break threshold. The report is Git-trackable and hash-pinned together
with the mutation configuration and test corpus.

The current candidate render ledger is `evidence/render-matrix/matrix.json`.
It contains ten 1280 by 720 frames over one source fingerprint: hunt, river,
event, trail, and ending in Green Monitor and Color Deluxe. Every PNG and raw
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
