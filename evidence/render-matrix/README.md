# omaTrail dual-profile render matrix

This directory retains five deterministic gameplay states for both omaTrail and
Classic 1978-inspired rules in both Green Monitor and Color Deluxe. Every PNG
is an uncropped 1280 by 720 frame captured after a live plugin IPC toggle in an
isolated Buzz Omarchy shell. Classic files use the `classic-` prefix.

Each frame has two adjacent provenance artifacts:

- `*.render-proof.json` binds the source fingerprint, shipped archive, rig run,
  raw shell-log hash, preview hash, dimensions, and capture time.
- `*.shell.log` is the raw Quickshell log whose SHA-256 is recorded in that
  receipt. Standard headless compositor and unavailable-service noise may be
  present; the matrix lane rejects plugin-sourced QML warnings.

`matrix.json` summarizes all twenty receipts and fails generation if the source
fingerprint changes during the matrix run. Reproduce the complete set with:

```bash
scripts/rig-render-matrix.sh . evidence/render-matrix
```

The retained artifacts were produced from clean source commit
`ae86fc21848debc6a4ab33d8b951b8a2cc460d83`. All twenty receipts record
`sourceDirty: false`, one source fingerprint, and matching local and remote
package hashes. Human approval of the separate marketplace preview remains
hash-bound in `.render-proof.json`; it is not inferred from this matrix.

Regenerate the matrix from a clean target revision with:

```bash
OMATRAIL_MATRIX_REQUIRE_CLEAN=true \
  scripts/rig-render-matrix.sh . evidence/render-matrix
```

The matrix captures into an external temporary directory so a clean repository
stays clean for all twenty rig runs. Only after commit, fingerprint, package, and
dirty-state consistency checks pass does the lane publish the completed set
into this directory.
