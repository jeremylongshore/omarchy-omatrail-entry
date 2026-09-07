#!/usr/bin/env bash
set -euo pipefail

TARGET="$(cd "${1:-$(dirname "$0")/..}" && pwd)"
OUT="${2:-$TARGET/evidence/runtime/runtime-audit.json}"
LOG_OUT="${OUT%.json}.shell.log"
WORK="$(mktemp -d -t omatrail-runtime-audit-XXXXXX)"
trap 'find "$WORK" -depth -delete 2>/dev/null || true' EXIT

OMATRAIL_RUNTIME_AUDIT=true \
OMATRAIL_RIG_FIXTURE=hunt-save.json \
OMATRAIL_RIG_DISPLAY_MODE="Green Monitor" \
  "$TARGET/scripts/rig-render.sh" "$TARGET" \
    "$WORK/runtime.png" "$WORK/render-proof.json" "$LOG_OUT" "$OUT"

jq -e '
  .fixture == "hunt-save.json"
  and ([.audit.checks[]] | all(. == true))
  and .audit.status.playing.hunt.tick > 0
  and .audit.status.hidden.hunt.tick == .audit.status.reopened.hunt.tick
  and .audit.status.resumed.hunt.tick > .audit.status.reopened.hunt.tick
  and .audit.state.beforeSha256 == .audit.state.afterSha256' "$OUT" >/dev/null
test "$(sha256sum "$LOG_OUT" | awk '{print $1}')" = "$(jq -r '.rawShellLogSha256' "$OUT")"

echo "rig-runtime-audit: PASS, wrote $OUT and $LOG_OUT"
