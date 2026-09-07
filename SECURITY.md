# Security

## Reporting

Use GitHub's private vulnerability reporting for this repository. Do not place
a suspected vulnerability in a public issue before the maintainer can review
it. This is a personal project, so no formal response-time promise is made.

## Runtime boundary

omaTrail is QML loaded without a sandbox into the long-running Omarchy
Quickshell process. It therefore runs with the desktop user's access.

The shipped game:

- makes no network requests and includes no telemetry or accounts;
- invokes only the repository-owned save helper with fixed operation arguments;
- parses gameplay entirely in pure deterministic JavaScript;
- bounds serialized save data to 64 KiB and rejects malformed, incompatible,
  oversized, or structurally invalid save documents;
- pins every state-path directory descriptor and rejects symlink traversal;
- opens reads once with `O_NOFOLLOW|O_NONBLOCK`, then validates and bounds that
  same descriptor;
- publishes through a private `O_EXCL|O_NOFOLLOW` temporary descriptor held
  through write and `fsync`, followed by descriptor-relative replacement;
- serializes operations through a private same-owner lock;
- keeps one last-good save for recovery;
- renders dynamic strings as `Text.PlainText` with a width and overflow rule.

The save is local game progress, not a credential store. Use New Expedition
after a completed or abandoned run to delete it through the same helper.

## Evidence limits

The vendored gates, Omarchy validator, qmllint, unit tests, and Buzz render each
cover different defect classes. None alone is a general security audit.
