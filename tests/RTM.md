# Requirements traceability matrix: omaTrail

This matrix uses the canonical acceptance IDs from the Intent Blueprint. `Met`
means the current local candidate has direct evidence for the full criterion.
`Partial` means useful evidence exists but part of the criterion remains
unproven. `Not evaluated` means the required evidence has not been run. This is
an implementation snapshot, not release approval.

| ID | Status | Current evidence | Remaining limitation |
| --- | --- | --- | --- |
| AC-001 | Met | `JourneyRules.js`, `JourneyView.qml`, setup and store unit tests | Human usability review remains outside this criterion. |
| AC-002 | Met | Deterministic travel, weather, calendar, supplies, wagon, and party tests | None known in the rules boundary. |
| AC-003 | Met | Two fresh journeys with the same setup, seed, and ordered public-dispatch action sequence produce byte-identical semantic snapshots; save and RNG replay tests add independent coverage | None known in the deterministic engine boundary. |
| AC-004 | Met | The route graph test proves ordered connectivity, all three acts, six regions, rivers, forts, landmarks, a finish, and continuing event destinations; completion and loss paths are separately exercised | None known in the authored route boundary. |
| AC-005 | Met | Ending rules, source tests, and retained Green/Color real-shell ending receipts verify survivors, named losses and reasons, duration, difficulty, all resources, waste, score, and seed | Clean-revision regeneration remains part of release evidence. |
| AC-006 | Partial | Keyboard movement, aim, fire, pause, and return are implemented; right-click movement and left-click aim/fire are source tested | A real pointer and keyboard input-matrix playtest is not proven. |
| AC-007 | Partial | 10,000 fields cycle through all six regions and prove deterministic eligible placement; graph search proves every animal reachable in 1,000 generated fields | A formal universal proof over the complete seed space has not run. |
| AC-008 | Partial | Hunt settlement and journey-bridge tests reconcile ammunition, days, energy, carry, waste, regional risk, and injury | A real result-screen capture for every factor is missing. |
| AC-009 | Partial | Capacity tests distinguish harvested, carried, and wasted pounds and cap added food | Full presentation of all three values needs a runtime scene capture. |
| AC-010 | Met | `reports/balance/balance-100000.json` records 100,000 public-engine runs over 480 cells: heavy 82.56%, light 77.22%, exploit 51.82%, with zero nonterminal runs; the retained-report test separately rejects exploit dominance in either rules profile | Human PLAY-004 remains separate from this simulation criterion. |
| AC-011 | Met | River rules, explicit confirmation, explanations, and reduced-motion behavior are source tested and retained in hash-bound Green/Color real-shell river renders | Human PLAY-005 remains separate from this implementation criterion. |
| AC-012 | Met | Every river choice has deterministic replay and explanation assertions | None known in the pure-rules boundary. |
| AC-013 | Met | Every event record validates unique ID, eligibility, bounded prose, choices, parallel effects, fictional-composite source, destination, and deterministic resolution | None known in the authored event-record boundary. |
| AC-014 | Met | Illness and recovery functions are bounded, monotonic under worsening health factors, deterministically tested, and used by event resolution | Balance tuning remains subject to future playtests. |
| AC-015 | Partial | Save restoration preserves the selected visual and rules profiles; a clean twenty-frame, one-fingerprint matrix retains river, ending, trail, event, and hunt across both rules and both visual modes with receipts and raw logs | Real input operability across the full matrix remains outstanding. |
| AC-016 | Partial | Differential rules tests show profile switching preserves semantic state | Hitbox identity across all scenes has not been measured. |
| AC-017 | Partial | Green Monitor palette tokens, black-field styling, and five retained real-shell scenes per rules profile are source and runtime verified; both visual modes preserve the selected rules and save state; the exact marketplace preview has hash-bound owner approval | Integer-scaling review across non-1280 viewports remains outstanding. |
| AC-018 | Partial | Reduced motion disables the Green Monitor scanline without changing the 100 ms simulation timer | Other CRT effects and runtime accessibility checks remain unproven. |
| AC-019 | Partial | Keyboard contracts and non-color labels are source tested | Every critical action and focus path has not been exercised in a real input matrix. |
| AC-020 | Met | A clean exact public commit passed manifest validation and `qmllint` on the Buzz rig, then the public CLI added, enabled, launched, disabled, re-enabled, removed, reinstalled, and finally removed the plugin from a fresh isolated home; the receipt and raw shell log are retained in `evidence/install/` | None known in the plugin lifecycle boundary. |
| AC-021 | Partial | Bar launcher, shell IPC target, Escape, and hide contracts exist; live Buzz IPC verifies focused open, unfocused hide, and focused reopen during hunting | Focus return has not been checked on every journey and system path. |
| AC-022 | Partial | Consequential actions serialize through the descriptor-bound state helper; a live Buzz restart restored the exact persisted hunt fixture and identical journey fields with an unchanged state SHA-256 | The retained restart run begins from a seeded persisted state rather than performing and saving a new consequential journey action in the same run. |
| AC-023 | Partial | Missing, malformed, future, oversized, FIFO, symlink, directory, and same-UID swap cases are tested with explicit recovery | Read-only and full real-shell failure paths remain unproven. |
| AC-024 | Partial | Pause, abandon confirmation, new expedition, and explicit save deletion exist | Full runtime restart and deletion scenarios remain unproven. |
| AC-025 | Partial | Offline static gates, local state-path contracts, dependency audit, and hostile-path tests pass; a targeted live hunting lifecycle added no persistent child process or Quickshell TCP connection | A complete expedition runtime observation and write-set capture have not run. |
| AC-026 | Met | `contracts/provenance.md` records the source ledger and permitted-use boundary; the hash-bound comparison report finds zero nontrivial exact matches across four expression surfaces, and a synthetic copied fixture proves the detector fails closed | The comparison cannot prove independent creation or replace legal review. |
| AC-027 | Partial | Story text is labeled fictional composite rather than historical fact | Human affected-group and historical review disposition is missing. |
| AC-028 | Partial | Live Buzz status proves the hunting timer advances while active, freezes while hidden, resumes on request, and resets safely after shell restart; the receipt records whole-shell RSS and three IPC open-hide cycles | Frame pacing, device-to-render input latency, long-soak memory, and whole-shell idle CPU are not measured. |

The canonical criterion wording, authorities, and waiver rules remain in the
Intent Blueprint linked from `README.md`.
