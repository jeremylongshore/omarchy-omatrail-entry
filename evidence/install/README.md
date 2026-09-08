# Install lifecycle evidence

`install-lifecycle.json` and its hash-bound raw log prove the documented public
plugin lifecycle on the Buzz Omarchy rig. The lane starts a real Omarchy shell
inside a fresh isolated home, then runs the stock commands to add, enable,
launch, disable, enable, remove, reinstall, and finally remove omaTrail again.

The receipt is accepted only when the public repository's `main` commit equals
the clean local HEAD and both cloned installations resolve to that exact commit.
The final removal leaves the isolated home with no omaTrail catalog entry or
plugin directory.

The retained receipt exercised public `main` commit
`d3d48a212e73411a09130eb0a5093c08b5dfedf2` after the dysentery update was
merged. Its raw log SHA-256 is recorded in the receipt and verified by the
wrapper.

Reproduce it with:

```bash
scripts/rig-install-lifecycle.sh .
```
