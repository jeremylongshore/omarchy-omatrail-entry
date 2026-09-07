# Install lifecycle evidence

`install-lifecycle.json` and its hash-bound raw log prove the documented public
plugin lifecycle on the Buzz Omarchy rig. The lane starts a real Omarchy shell
inside a fresh isolated home, then runs the stock commands to add, enable,
launch, disable, enable, remove, reinstall, and finally remove omaTrail again.

The receipt is accepted only when the public repository's `main` commit equals
the clean local HEAD and both cloned installations resolve to that exact commit.
The final removal leaves the isolated home with no omaTrail catalog entry or
plugin directory.

Reproduce it with:

```bash
scripts/rig-install-lifecycle.sh .
```
