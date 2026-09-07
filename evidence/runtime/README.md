# Runtime evidence

`runtime-audit.json` is a machine-checked candidate receipt from an isolated
real Omarchy shell on the Buzz rig. `runtime-audit.shell.log` is its retained
raw shell log, and the wrapper verifies its hash against the receipt. The run
covers hunting advance, focus, hidden
timer shutdown, reopen, resume, shell restart, state-hash stability, persistent
child-process count, Quickshell TCP connection count, whole-shell RSS, and
three IPC open-hide cycles.

The status payload is versioned and excludes party names, inventory, messages,
and other free-form user data. The receipt is bound to the shipped runtime
fingerprint, source commit, dirty-state flag, package hashes, rig, run ID, and
raw shell-log hash.

This is dirty development-tree evidence. It does not prove a complete journey,
frame pacing, device-to-render latency, long-soak memory behavior, or clean-SHA
release readiness.
