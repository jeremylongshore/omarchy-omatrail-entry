---
name: Bug report
about: Something the plugin does wrong
labels: bug
---

**What happened, and what you expected instead**

**Which Omarchy and Quickshell**

```
omarchy --version
```

**Anything the shell logged**

Quickshell writes to its log; the lines mentioning this plugin are the useful
ones.

**Replay seed, game phase, and display profile**

These make deterministic gameplay defects reproducible.

**Is it reproducible from a clean save?**

State lives under `$XDG_STATE_HOME/omarchy/omatrail/`, or under
`~/.local/state/omarchy/omatrail/` when that variable is unset. Deleting this
directory resets the game. Say whether that changed anything.
