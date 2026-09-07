#!/usr/bin/env bash
# Exercise the documented public add, enable, launch, disable, remove, and
# reinstall path inside a fresh home on the real Buzz Omarchy rig.
set -euo pipefail

TARGET="$(cd "${1:-$(dirname "$0")/..}" && pwd)"
OUT="${2:-$TARGET/evidence/install/install-lifecycle.json}"
LOG_OUT="${OUT%.json}.shell.log"
HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
ID="$(jq -r '.id' "$TARGET/manifest.json")"
SOURCE_COMMIT="$(git -C "$TARGET" rev-parse HEAD)"
SOURCE_DIRTY=true
[[ -z "$(git -C "$TARGET" status --porcelain --untracked-files=all)" ]] && SOURCE_DIRTY=false
URL="$(git -C "$TARGET" remote get-url origin)"
REMOTE_COMMIT="$(git -C "$TARGET" ls-remote origin refs/heads/main | awk 'NR == 1 { print $1 }')"
RUN_ID="omatrail-install-$$"
RAW="$(mktemp -t omatrail-install-XXXXXX.log)"
trap 'find "$RAW" -delete 2>/dev/null || true' EXIT

[[ "$SOURCE_DIRTY" == false ]] || { echo "rig-install-lifecycle: source tree must be clean" >&2; exit 2; }
[[ "$ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ && "$ID" != *..* ]] || {
  echo "rig-install-lifecycle: unsafe plugin id" >&2; exit 2; }
[[ "$SOURCE_COMMIT" == "$REMOTE_COMMIT" ]] || {
  echo "rig-install-lifecycle: origin/main is not exact local HEAD" >&2; exit 2; }
[[ "$URL" == https://github.com/* ]] || {
  echo "rig-install-lifecycle: origin must be a public GitHub HTTPS URL" >&2; exit 2; }

mkdir -p "$(dirname "$OUT")"
echo "rig-install-lifecycle: exercising public CLI on $HOST/$CONTAINER"

set +e
# Values are validated above and intentionally expanded into the remote docker
# invocation so the heredoc itself remains literal.
# shellcheck disable=SC2029
ssh "$HOST" "docker exec -i -e PATH=/root/omarchy/bin:/usr/local/bin:/usr/bin:/bin $CONTAINER /bin/bash -s -- '$URL' '$ID' '$SOURCE_COMMIT' '$RUN_ID'" \
  >"$RAW" 2>&1 <<'REMOTE'
set -euo pipefail

URL="$1"
ID="$2"
EXPECTED_COMMIT="$3"
RUN_ID="$4"
ROOT="/tmp/$RUN_ID"
RUNTIME="$ROOT/runtime"
SWAY_CONFIG="$ROOT/sway.conf"
SWAY_LOG="$ROOT/sway.log"
QS_LOG="$ROOT/quickshell.log"
TARGET="$ROOT/.config/omarchy/plugins/$ID"
QS_PID=""
SWAY_PID=""
DBUS_PID=""

cleanup() {
  [[ -z "$QS_PID" ]] || kill "$QS_PID" 2>/dev/null || true
  [[ -z "$SWAY_PID" ]] || kill "$SWAY_PID" 2>/dev/null || true
  [[ -z "$DBUS_PID" ]] || kill "$DBUS_PID" 2>/dev/null || true
  [[ ! -d "$ROOT" ]] || find "$ROOT" -depth -delete 2>/dev/null || true
}
trap cleanup EXIT INT TERM
trap 'status=$?; echo "lifecycle:error line=$LINENO status=$status command=$BASH_COMMAND" >&2; exit "$status"' ERR

mkdir -p "$RUNTIME" "$ROOT/.config/omarchy/plugins"
chmod 700 "$ROOT" "$RUNTIME" "$ROOT/.config" "$ROOT/.config/omarchy" "$ROOT/.config/omarchy/plugins"
cat >"$SWAY_CONFIG" <<'SWAY'
output * resolution 1280x720 scale 1
seat * hide_cursor 1000
SWAY

export HOME="$ROOT" XDG_RUNTIME_DIR="$RUNTIME" OMARCHY_PATH=/root/omarchy
WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman \
  sway --config "$SWAY_CONFIG" >"$SWAY_LOG" 2>&1 &
SWAY_PID=$!
WAYLAND_SOCKET=""
for _ in $(seq 1 30); do
  WAYLAND_SOCKET=$(find "$RUNTIME" -maxdepth 1 -type s -name 'wayland-*' | head -1)
  [[ -z "$WAYLAND_SOCKET" ]] || break
  sleep 1
done
[[ -n "$WAYLAND_SOCKET" ]] || { echo "lifecycle: no Wayland socket"; exit 1; }
export WAYLAND_DISPLAY="${WAYLAND_SOCKET##*/}"
export SWAYSOCK
SWAYSOCK=$(find "$RUNTIME" -maxdepth 1 -type s -name 'sway-ipc.*.sock' | head -1)

DBUS_INFO=$(dbus-daemon --session --fork --print-address=1 --print-pid=1)
export DBUS_SESSION_BUS_ADDRESS
DBUS_SESSION_BUS_ADDRESS=$(printf '%s\n' "$DBUS_INFO" | sed -n '1p')
DBUS_PID=$(printf '%s\n' "$DBUS_INFO" | sed -n '2p')

jq -n '{version:1,bar:{position:"top",transparent:false,centerAnchor:"omarchy.workspaces",layout:{left:[{id:"omarchy.workspaces"}],center:[],right:[]}},plugins:[]}' \
  >"$ROOT/.config/omarchy/shell.json"

qs -p /root/omarchy/shell >"$QS_LOG" 2>&1 &
QS_PID=$!
sleep 18
[[ -d "/proc/$QS_PID" ]] || { tail -80 "$QS_LOG"; exit 1; }

plugin_row() {
  local plugins=""
  for _ in $(seq 1 15); do
    if plugins=$(omarchy-shell shell listPlugins 2>/dev/null); then
      [[ -n "$plugins" ]] || plugins="[]"
      printf '%s\n' "$plugins" | jq -c --arg id "$ID" '[.[] | select(.id == $id)]'
      return
    fi
    sleep 1
  done
  echo "lifecycle: shell plugin catalog did not recover after rescan" >&2
  return 1
}

echo "lifecycle:add"
omarchy-plugin-add "$URL" --enable --yes
[[ -d "$TARGET/.git" ]]
[[ "$(jq -r '.id' "$TARGET/manifest.json")" == "$ID" ]]
[[ "$(git -C "$TARGET" rev-parse HEAD)" == "$EXPECTED_COMMIT" ]]
ADDED_COUNT=$(plugin_row | jq 'length')
ENABLED_COUNT=$(plugin_row | jq '[.[] | select(.enabled == true)] | length')
BAR_COUNT=$(jq --arg id "$ID" '[.bar.layout.left[], .bar.layout.center[], .bar.layout.right[] | select(.id == $id)] | length' "$ROOT/.config/omarchy/shell.json")
[[ "$ADDED_COUNT" == 1 && "$ENABLED_COUNT" == 1 && "$BAR_COUNT" == 1 ]]

echo "lifecycle:launch"
qs -p /root/omarchy/shell ipc call "$ID" summon '{}' >/dev/null
sleep 1
STATUS=$(qs -p /root/omarchy/shell ipc call "$ID" status | sed -n '/^{.*}$/p' | tail -1)
printf '%s\n' "$STATUS" | jq -e '.schemaVersion == 1 and .opened == true and .focused == true' >/dev/null

echo "lifecycle:disable"
omarchy-plugin-disable "$ID"
DISABLED_COUNT=$(plugin_row | jq '[.[] | select(.enabled == false)] | length')
[[ "$DISABLED_COUNT" == 1 ]]

echo "lifecycle:enable"
omarchy-plugin-enable "$ID" --section right
REENABLED_COUNT=$(plugin_row | jq '[.[] | select(.enabled == true)] | length')
[[ "$REENABLED_COUNT" == 1 ]]

echo "lifecycle:remove"
omarchy-plugin-remove "$ID" --yes
[[ ! -e "$TARGET" ]]
REMOVED_COUNT=$(plugin_row | jq 'length')
echo "lifecycle:removed-count=$REMOVED_COUNT"
[[ "$REMOVED_COUNT" == 0 ]]

echo "lifecycle:reinstall"
omarchy-plugin-add "$URL" --enable --yes
[[ -d "$TARGET/.git" ]]
[[ "$(git -C "$TARGET" rev-parse HEAD)" == "$EXPECTED_COMMIT" ]]
REINSTALLED_COUNT=$(plugin_row | jq '[.[] | select(.enabled == true)] | length')
[[ "$REINSTALLED_COUNT" == 1 ]]

echo "lifecycle:final-cleanup"
omarchy-plugin-remove "$ID" --yes
[[ ! -e "$TARGET" ]]
FINAL_COUNT=$(plugin_row | jq 'length')
[[ "$FINAL_COUNT" == 0 ]]

jq -nc --argjson added "$ADDED_COUNT" --argjson enabled "$ENABLED_COUNT" \
  --argjson bar "$BAR_COUNT" --argjson disabled "$DISABLED_COUNT" \
  --argjson reenabled "$REENABLED_COUNT" --argjson removed "$REMOVED_COUNT" \
  --argjson reinstalled "$REINSTALLED_COUNT" --argjson final "$FINAL_COUNT" \
  '{addedEntries:$added,enabledEntries:$enabled,barEntries:$bar,
    launched:true,disabledEntries:$disabled,reenabledEntries:$reenabled,
    entriesAfterRemoval:$removed,reinstalledEntries:$reinstalled,
    entriesAfterFinalCleanup:$final}' | sed 's/^/OMATRAIL_INSTALL_RESULT /'
REMOTE
RC=$?
set -e

cp "$RAW" "$LOG_OUT"
RESULT="$(sed -n 's/^OMATRAIL_INSTALL_RESULT //p' "$RAW" | tail -1)"
if [[ "$RC" -ne 0 || -z "$RESULT" ]]; then
  echo "rig-install-lifecycle: remote lifecycle failed" >&2
  tail -100 "$RAW" >&2
  exit 1
fi

LOG_SHA="$(sha256sum "$LOG_OUT" | awk '{print $1}')"
jq -n --arg repository "$URL" --arg commit "$SOURCE_COMMIT" --arg id "$ID" \
  --arg rig "$HOST/$CONTAINER" --arg run "$RUN_ID" --arg log "$LOG_SHA" \
  --argjson result "$RESULT" --arg iso "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{schemaVersion:1,repository:$repository,sourceCommit:$commit,sourceDirty:false,
    pluginId:$id,rig:$rig,runId:$run,command:"omarchy-plugin-add <public-url> --enable --yes",
    rawShellLogSha256:$log,checks:$result,verifiedAt:$iso}' >"$OUT"

jq -e '.checks.addedEntries == 1 and .checks.enabledEntries == 1
  and .checks.barEntries == 1 and .checks.launched == true
  and .checks.disabledEntries == 1 and .checks.reenabledEntries == 1
  and .checks.entriesAfterRemoval == 0 and .checks.reinstalledEntries == 1
  and .checks.entriesAfterFinalCleanup == 0' "$OUT" >/dev/null

echo "rig-install-lifecycle: PASS, wrote $OUT and $LOG_OUT"
