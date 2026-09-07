#!/usr/bin/env bash
# Load a plugin into an isolated real Omarchy shell, open it through live IPC,
# and capture the dedicated 16:9 output without crop or post-processing.
#
# Generated plugins should add e2e/render-settings.json for deterministic inline
# widget settings. An executable e2e/rig-before-shell.sh may seed state before
# Quickshell starts; e2e/rig-before-capture.sh may perform or verify a live action
# after startup. Both hooks run inside the isolated rig container with HOME,
# XDG_RUNTIME_DIR, WAYLAND_DISPLAY, SWAYSOCK, OMARCHY_PATH, MOD, and PLUGIN_DIR
# exported, and must fail non-zero when their fixture or assertion fails.
set -uo pipefail

TARGET="$(cd "${1:-$(dirname "$0")/..}" && pwd)"
OUT="${2:-$TARGET/preview.png}"
PROOF_OUT="${3:-$TARGET/.render-proof.json}"
LOG_OUT="${4:-}"
AUDIT_OUT="${5:-}"
HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
RES="${OMARCHY_RIG_RESOLUTION:-1280x720}"
SCALE="${OMARCHY_RIG_SCALE:-1.25}"
FIXTURE="${OMATRAIL_RIG_FIXTURE:-hunt-save.json}"
DISPLAY_MODE="${OMATRAIL_RIG_DISPLAY_MODE:-}"
RULES_PROFILE="${OMATRAIL_RIG_RULES_PROFILE:-omatrail}"
RUNTIME_AUDIT="${OMATRAIL_RUNTIME_AUDIT:-false}"

mkdir -p "$(dirname "$OUT")" "$(dirname "$PROOF_OUT")"
if [[ -n "$LOG_OUT" ]]; then mkdir -p "$(dirname "$LOG_OUT")"; fi
if [[ -n "$AUDIT_OUT" ]]; then mkdir -p "$(dirname "$AUDIT_OUT")"; fi

for tool in jq identify convert; do
  command -v "$tool" >/dev/null 2>&1 || { echo "rig-render: $tool is required" >&2; exit 2; }
done
[[ -f "$TARGET/manifest.json" ]] || { echo "rig-render: no manifest.json in $TARGET" >&2; exit 2; }
[[ "$FIXTURE" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "rig-render: invalid fixture name" >&2; exit 2; }
if [[ "$FIXTURE" != "none" && ! -f "$TARGET/e2e/$FIXTURE" ]]; then
  echo "rig-render: fixture e2e/$FIXTURE does not exist" >&2; exit 2
fi
case "$DISPLAY_MODE" in
  ""|"Green Monitor"|"Color Deluxe") ;;
  *) echo "rig-render: invalid display mode" >&2; exit 2 ;;
esac
case "$RULES_PROFILE" in
  omatrail|classic-1978) ;;
  *) echo "rig-render: invalid rules profile" >&2; exit 2 ;;
esac
case "$RUNTIME_AUDIT" in
  true|false) ;;
  *) echo "rig-render: OMATRAIL_RUNTIME_AUDIT must be true or false" >&2; exit 2 ;;
esac
if [[ -n "$AUDIT_OUT" && "$RUNTIME_AUDIT" != true ]]; then
  echo "rig-render: an audit output requires OMATRAIL_RUNTIME_AUDIT=true" >&2; exit 2
fi

MOD="$(jq -r '.id // empty' "$TARGET/manifest.json")"
[[ -n "$MOD" ]] || { echo "rig-render: manifest.json has no id" >&2; exit 2; }
NAME="${MOD##*.}"
RUN_ID="${NAME}-$$"

fingerprint() {
  ( cd "$TARGET" && \
    find . -type f \
      -not -path './.git/*' -not -path './tests/*' \
      -not -path './scripts/*' -not -path './node_modules/*' \
      -not -path './.stryker-tmp/*' -not -path './coverage/*' \
      -not -path './reports/*' \
      \( -path './e2e/*' -o -name '*.qml' -o -name '*.js' -o -name 'manifest.json' -o -perm -u+x \) \
      -print0 2>/dev/null \
    | LC_ALL=C sort -z | xargs -0 cat 2>/dev/null | sha256sum | cut -d' ' -f1 )
}

FP="$(fingerprint)"
SOURCE_COMMIT="$(git -C "$TARGET" rev-parse HEAD 2>/dev/null || printf unknown)"
SOURCE_DIRTY=true
if [[ "$SOURCE_COMMIT" != "unknown" ]] && \
   [[ -z "$(git -C "$TARGET" status --porcelain --untracked-files=all 2>/dev/null)" ]]; then
  SOURCE_DIRTY=false
fi

TGZ="$(mktemp -t rigrender-XXXXXX.tgz)"
REMOTE="$(mktemp -t rigrender-XXXXXX.sh)"
trap 'rm -f "$TGZ" "$REMOTE"' EXIT
if [[ "$SOURCE_DIRTY" == false ]]; then
  PACKAGE_BOUNDARY="exact tracked HEAD archive"
  (set -o pipefail; git -C "$TARGET" archive --format=tar HEAD | gzip -n > "$TGZ") || {
    echo "rig-render: could not package committed HEAD" >&2; exit 2; }
else
  PACKAGE_BOUNDARY="development runtime tree; generated evidence, proof receipts, reports, tests, developer scripts, and marketplace preview excluded"
  (set -o pipefail; tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -cf - \
    -C "$TARGET" --exclude=.git --exclude=tests --exclude=scripts \
    --exclude=node_modules --exclude=.stryker-tmp --exclude=reports --exclude=coverage --exclude=evidence \
    --exclude=.harness-hash --exclude=.rig-proof.json --exclude=.render-proof.json \
    --exclude=.render-shell.log --exclude=preview.png . \
    | gzip -n > "$TGZ") || {
    echo "rig-render: could not package the development tree" >&2; exit 2; }
fi
ARCHIVE_SHA="$(sha256sum "$TGZ" | cut -d' ' -f1)"

echo "rig-render: shipping $NAME to $HOST/$CONTAINER"
scp -q -o BatchMode=yes "$TGZ" "$HOST:/tmp/rigrender-$RUN_ID.tgz" || {
  echo "rig-render: cannot reach $HOST" >&2; exit 2; }

cat > "$REMOTE" <<REMOTE_EOF
#!/bin/sh
set -eu
MOD="$MOD"; NAME="$NAME"; RUN_ID="$RUN_ID"; RES="$RES"; SCALE="$SCALE"
FIXTURE="$FIXTURE"; DISPLAY_MODE="$DISPLAY_MODE"; RULES_PROFILE="$RULES_PROFILE"
RUNTIME_AUDIT="$RUNTIME_AUDIT"
RUNTIME=/tmp/rigrender-runtime-\$RUN_ID
RIG_ROOT=/tmp/rigrender-home-\$RUN_ID
SWAY_CONFIG=/tmp/rigrender-sway-\$RUN_ID.conf
SWAY_LOG=/tmp/rigrender-sway-\$RUN_ID.log
QS_LOG=/tmp/rigrender-qs-\$RUN_ID.log
SHOT=/tmp/rigrender-\$RUN_ID.png
PLUGIN_DIR=\$RIG_ROOT/.config/omarchy/plugins/\$NAME
QS_PID=""; SWAY_PID=""; DBUS_PID=""
cleanup() {
  [ -z "\$QS_PID" ] || kill "\$QS_PID" 2>/dev/null || true
  [ -z "\$SWAY_PID" ] || kill "\$SWAY_PID" 2>/dev/null || true
  [ -z "\$DBUS_PID" ] || kill "\$DBUS_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for path in "\$RUNTIME" "\$RIG_ROOT"; do
  if [ -d "\$path" ]; then find "\$path" -depth -delete; fi
done
mkdir -p "\$RUNTIME" "\$PLUGIN_DIR"
chmod 700 "\$RUNTIME" "\$RIG_ROOT" "\$RIG_ROOT/.config" \
  "\$RIG_ROOT/.config/omarchy" "\$RIG_ROOT/.config/omarchy/plugins" "\$PLUGIN_DIR"
tar xzf /tmp/rigrender-\$RUN_ID.tgz -C "\$PLUGIN_DIR"

cat > "\$SWAY_CONFIG" <<SWAY
output * resolution \$RES scale \$SCALE
seat * hide_cursor 1000
SWAY
export XDG_RUNTIME_DIR="\$RUNTIME"
WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman \
  sway --config "\$SWAY_CONFIG" >"\$SWAY_LOG" 2>&1 &
SWAY_PID=\$!
WAYLAND_SOCKET=""; attempt=0
while [ \$attempt -lt 30 ]; do
  WAYLAND_SOCKET=\$(find "\$RUNTIME" -maxdepth 1 -type s -name 'wayland-*' | head -1)
  [ -z "\$WAYLAND_SOCKET" ] || break
  attempt=\$((attempt + 1)); sleep 1
done
[ -n "\$WAYLAND_SOCKET" ] || { echo "rig-render: isolated Wayland socket did not start" >&2; exit 1; }
export WAYLAND_DISPLAY="\${WAYLAND_SOCKET##*/}"
export SWAYSOCK=\$(find "\$RUNTIME" -maxdepth 1 -type s -name 'sway-ipc.*.sock' | head -1)
[ -n "\$SWAYSOCK" ] || { echo "rig-render: isolated Sway IPC socket did not start" >&2; exit 1; }

command -v dbus-daemon >/dev/null 2>&1 || { echo "rig-render: dbus-daemon is required for native Omarchy services" >&2; exit 1; }
DBUS_INFO=\$(dbus-daemon --session --fork --print-address=1 --print-pid=1)
DBUS_SESSION_BUS_ADDRESS=\$(printf '%s\n' "\$DBUS_INFO" | sed -n '1p')
DBUS_PID=\$(printf '%s\n' "\$DBUS_INFO" | sed -n '2p')
[ -n "\$DBUS_SESSION_BUS_ADDRESS" ] && [ -n "\$DBUS_PID" ] || { echo "rig-render: isolated D-Bus session did not start" >&2; exit 1; }
export DBUS_SESSION_BUS_ADDRESS

SETTINGS_FILE=\$PLUGIN_DIR/e2e/render-settings.json
if [ -f "\$SETTINGS_FILE" ]; then
  jq -e 'type == "object" and (has("id") | not)' "\$SETTINGS_FILE" >/dev/null || {
    echo "rig-render: e2e/render-settings.json must be an object without id" >&2; exit 1; }
  jq -n --arg mod "\$MOD" --arg display "\$DISPLAY_MODE" --slurpfile settings "\$SETTINGS_FILE" \
    '{version:1,bar:{position:"top",transparent:false,centerAnchor:\$mod,
      layout:{left:[{id:"omarchy.workspaces"}],center:[],right:[({id:\$mod}+\$settings[0]
        +(if \$display == "" then {} else {displayMode:\$display} end))]}},plugins:[]}' \
    > "\$RIG_ROOT/.config/omarchy/shell.json"
else
  jq -n --arg mod "\$MOD" --arg display "\$DISPLAY_MODE" \
    '{version:1,bar:{position:"top",transparent:false,centerAnchor:\$mod,
      layout:{left:[{id:"omarchy.workspaces"}],center:[],right:[({id:\$mod}
        +(if \$display == "" then {} else {displayMode:\$display} end))]}},plugins:[]}' \
    > "\$RIG_ROOT/.config/omarchy/shell.json"
fi

export HOME="\$RIG_ROOT" OMARCHY_PATH=/root/omarchy PLUGIN_DIR MOD
export OMATRAIL_E2E_SAVE="\$FIXTURE"
export OMATRAIL_E2E_RULES_PROFILE="\$RULES_PROFILE"
export PATH="\$OMARCHY_PATH/bin:\$PATH"
if [ -d "\$PLUGIN_DIR/e2e/bin" ]; then
  for fixture_command in "\$PLUGIN_DIR"/e2e/bin/*; do
    [ -f "\$fixture_command" ] || continue
    [ -x "\$fixture_command" ] || {
      echo "rig-render: e2e/bin fixture commands must be executable" >&2; exit 1; }
  done
  export PATH="\$PLUGIN_DIR/e2e/bin:\$PATH"
fi

PRE_HOOK=\$PLUGIN_DIR/e2e/rig-before-shell.sh
if [ -f "\$PRE_HOOK" ]; then
  [ -x "\$PRE_HOOK" ] || { echo "rig-render: e2e/rig-before-shell.sh is not executable" >&2; exit 1; }
  "\$PRE_HOOK"
fi

qs -p /root/omarchy/shell >"\$QS_LOG" 2>&1 &
QS_PID=\$!
sleep 18
[ -d "/proc/\$QS_PID" ] || { echo "rig-render: isolated Quickshell exited before IPC" >&2; tail -80 "\$QS_LOG" >&2; exit 1; }

AUDIT_OUTPUT=""
if [ "\$RUNTIME_AUDIT" = true ]; then
  echo "runtime-audit: begin"
  ipc_status() {
    raw=\$(qs -p /root/omarchy/shell ipc call "\$MOD" status 2>/dev/null)
    status=\$(printf '%s\n' "\$raw" | sed -n '/^{.*}$/p' | tail -1)
    printf '%s\n' "\$status" | jq -e 'type == "object" and .schemaVersion == 1' >/dev/null
    printf '%s\n' "\$status"
  }
  rss_kb() { awk '/^VmRSS:/ { print \$2; found=1 } END { if (!found) print 0 }' "/proc/\$QS_PID/status"; }
  child_count() { ps -eo ppid= | awk -v parent="\$QS_PID" '\$1 == parent { count += 1 } END { print count + 0 }'; }
  tcp_count() { ss -Hntp 2>/dev/null | grep -c "pid=\$QS_PID," || true; }

  STATE_FILE="\$RIG_ROOT/.local/state/omarchy/omatrail/journey.json"
  [ -f "\$STATE_FILE" ] || { echo "rig-render: runtime audit has no restored journey" >&2; exit 1; }
  STATE_BEFORE=\$(sha256sum "\$STATE_FILE" | awk '{print \$1}')
  RSS_BEFORE=\$(rss_kb)
  CHILDREN_BEFORE=\$(child_count)
  TCP_BEFORE=\$(tcp_count)

  HOSTILE_RESULTS='[]'
  for hostile_payload in 'null' '7' '[]' 'true' '"text"'; do
    echo "runtime-audit: canonicalize \$hostile_payload"
    qs -p /root/omarchy/shell ipc call "\$MOD" summon "\$hostile_payload" >/dev/null 2>&1
    sleep 1
    HOSTILE_STATUS=\$(ipc_status)
    echo "runtime-audit: hostile status \$HOSTILE_STATUS"
    printf '%s\n' "\$HOSTILE_STATUS" | jq -e '.viewMode == "hunt" and (.opened == true or .opened == false)' >/dev/null
    HOSTILE_RESULTS=\$(jq -cn --argjson prior "\$HOSTILE_RESULTS" --arg input "\$hostile_payload" \
      --argjson status "\$HOSTILE_STATUS" '\$prior + [{input:\$input,status:\$status}]')
    qs -p /root/omarchy/shell ipc call "\$MOD" hide >/dev/null 2>&1
  done

  echo "runtime-audit: open and advance hunt"
  qs -p /root/omarchy/shell ipc call "\$MOD" summon '{}' >/dev/null 2>&1
  sleep 1
  OPENED=\$(ipc_status)
  printf '%s\n' "\$OPENED" | jq -e '.opened == true and .focused == true and .viewMode == "hunt" and .hunt.phase == "ready"' >/dev/null

  qs -p /root/omarchy/shell ipc call "\$MOD" huntStart >/dev/null 2>&1
  sleep 1
  PLAYING=\$(ipc_status)
  PLAYING_TICK=\$(printf '%s\n' "\$PLAYING" | jq -r '.hunt.tick')
  printf '%s\n' "\$PLAYING" | jq -e '.opened == true and .hunt.phase == "playing" and .hunt.tick > 0' >/dev/null

  qs -p /root/omarchy/shell ipc call "\$MOD" hide >/dev/null 2>&1
  sleep 1
  HIDDEN_ONE=\$(ipc_status)
  sleep 1
  HIDDEN_TWO=\$(ipc_status)
  HIDDEN_TICK=\$(printf '%s\n' "\$HIDDEN_ONE" | jq -r '.hunt.tick')
  printf '%s\n' "\$HIDDEN_ONE" | jq -e '.opened == false and .hunt.phase == "paused"' >/dev/null
  printf '%s\n' "\$HIDDEN_TWO" | jq -e --argjson tick "\$HIDDEN_TICK" '.opened == false and .hunt.phase == "paused" and .hunt.tick == \$tick' >/dev/null

  echo "runtime-audit: reopen and resume hunt"
  qs -p /root/omarchy/shell ipc call "\$MOD" summon '{}' >/dev/null 2>&1
  sleep 1
  REOPENED=\$(ipc_status)
  printf '%s\n' "\$REOPENED" | jq -e --argjson tick "\$HIDDEN_TICK" '.opened == true and .focused == true and .hunt.phase == "paused" and .hunt.tick == \$tick' >/dev/null
  qs -p /root/omarchy/shell ipc call "\$MOD" huntStart >/dev/null 2>&1
  sleep 1
  RESUMED=\$(ipc_status)
  RESUMED_TICK=\$(printf '%s\n' "\$RESUMED" | jq -r '.hunt.tick')
  printf '%s\n' "\$RESUMED" | jq -e --argjson tick "\$HIDDEN_TICK" '.hunt.phase == "playing" and .hunt.tick > \$tick' >/dev/null
  qs -p /root/omarchy/shell ipc call "\$MOD" hide >/dev/null 2>&1
  sleep 1

  RSS_AFTER=\$(rss_kb)
  CHILDREN_AFTER=\$(child_count)
  TCP_AFTER=\$(tcp_count)
  [ "\$CHILDREN_AFTER" -le "\$CHILDREN_BEFORE" ] || { echo "rig-render: runtime audit found a persistent child process" >&2; exit 1; }
  [ "\$TCP_AFTER" -le "\$TCP_BEFORE" ] || { echo "rig-render: runtime audit found a new Quickshell TCP connection" >&2; exit 1; }

  echo "runtime-audit: restart shell and restore state"
  kill "\$QS_PID"
  wait "\$QS_PID" 2>/dev/null || true
  qs -p /root/omarchy/shell >>"\$QS_LOG" 2>&1 &
  QS_PID=\$!
  sleep 12
  [ -d "/proc/\$QS_PID" ] || { echo "rig-render: Quickshell did not survive persistence restart" >&2; exit 1; }
  RESTARTED=\$(ipc_status)
  STATE_AFTER=\$(sha256sum "\$STATE_FILE" | awk '{print \$1}')
  [ "\$STATE_BEFORE" = "\$STATE_AFTER" ] || { echo "rig-render: restored journey changed across restart" >&2; exit 1; }
  printf '%s\n' "\$RESTARTED" | jq -e --argjson expected "\$OPENED" '
    .opened == false and .viewMode == "hunt" and .hunt.phase == "ready"
    and .journey == \$expected.journey' >/dev/null

  START_NS=\$(date +%s%N)
  cycle=0
  while [ "\$cycle" -lt 3 ]; do
    qs -p /root/omarchy/shell ipc call "\$MOD" summon '{}' >/dev/null 2>&1
    qs -p /root/omarchy/shell ipc call "\$MOD" hide >/dev/null 2>&1
    cycle=\$((cycle + 1))
  done
  END_NS=\$(date +%s%N)
  CYCLE_MS=\$(((END_NS - START_NS) / 1000000))

  AUDIT_OUTPUT=\$(jq -cn \
    --argjson hostile "\$HOSTILE_RESULTS" --argjson opened "\$OPENED" --argjson playing "\$PLAYING" \
    --argjson hidden "\$HIDDEN_TWO" --argjson reopened "\$REOPENED" \
    --argjson resumed "\$RESUMED" --argjson restarted "\$RESTARTED" \
    --arg stateBefore "\$STATE_BEFORE" --arg stateAfter "\$STATE_AFTER" \
    --argjson rssBefore "\$RSS_BEFORE" --argjson rssAfter "\$RSS_AFTER" \
    --argjson childrenBefore "\$CHILDREN_BEFORE" --argjson childrenAfter "\$CHILDREN_AFTER" \
    --argjson tcpBefore "\$TCP_BEFORE" --argjson tcpAfter "\$TCP_AFTER" \
    --argjson cycleMs "\$CYCLE_MS" \
    '{schemaVersion:1,checks:{hostilePayloadsHandled:true,openedFocused:true,huntAdvanced:true,hiddenTimerFrozen:true,reopenedPaused:true,resumedAdvanced:true,restartRestored:true,stateHashStable:(\$stateBefore == \$stateAfter),noPersistentChildAdded:(\$childrenAfter <= \$childrenBefore),noTcpConnectionAdded:(\$tcpAfter <= \$tcpBefore)},status:{hostileInputs:\$hostile,opened:\$opened,playing:\$playing,hidden:\$hidden,reopened:\$reopened,resumed:\$resumed,restarted:\$restarted},state:{beforeSha256:\$stateBefore,afterSha256:\$stateAfter},resources:{rssBeforeKb:\$rssBefore,rssAfterKb:\$rssAfter,childProcessesBefore:\$childrenBefore,childProcessesAfter:\$childrenAfter,tcpConnectionsBefore:\$tcpBefore,tcpConnectionsAfter:\$tcpAfter,threeOpenHideCyclesMs:\$cycleMs}}')
  echo "runtime-audit: assertions complete"
fi

HOOK=\$PLUGIN_DIR/e2e/rig-before-capture.sh
if [ -f "\$HOOK" ]; then
  [ -x "\$HOOK" ] || { echo "rig-render: e2e/rig-before-capture.sh is not executable" >&2; exit 1; }
  if ! HOOK_OUTPUT=\$("\$HOOK" 2>&1); then
    echo "rig-render: pre-capture hook failed" >&2
    printf '%s\n' "\$HOOK_OUTPUT" >&2
    exit 1
  fi
fi

qs -p /root/omarchy/shell ipc call "\$MOD" toggle >/dev/null 2>&1
sleep 8
[ -d "/proc/\$QS_PID" ] || { echo "rig-render: isolated Quickshell exited after IPC" >&2; tail -80 "\$QS_LOG" >&2; exit 1; }

echo "===QML WARNINGS==="
grep -a -iE "(WARN|ERROR).*(qml|scene)|(qml|scene).*(WARN|ERROR)|cannot assign|is not a type|unable to|handler was registered|quickshell has crashed" "\$QS_LOG" \
  | grep -avE "libEGL|MESA|ZINK|failed to get driver|failed to create dri2" | head -20
grim "\$SHOT" 2>/dev/null
echo "===RUN=== \$RUN_ID"
if [ -n "\$AUDIT_OUTPUT" ]; then echo "===AUDIT=== \$AUDIT_OUTPUT"; fi
echo "===LOGSHA=== \$(sha256sum "\$QS_LOG" | awk '{print \$1}')"
echo "===PACKAGE=== \$(sha256sum /tmp/rigrender-\$RUN_ID.tgz | awk '{print \$1}')"
echo "===SHOT=== \$(ls -l "\$SHOT" 2>/dev/null | awk '{print \$5}') bytes"
REMOTE_EOF

scp -q -o BatchMode=yes "$REMOTE" "$HOST:/tmp/rigrender-$RUN_ID.sh" || exit 2
RESULT="$(ssh -o BatchMode=yes "$HOST" "docker cp /tmp/rigrender-$RUN_ID.tgz $CONTAINER:/tmp/ >/dev/null && \
  docker cp /tmp/rigrender-$RUN_ID.sh $CONTAINER:/tmp/ >/dev/null && \
  docker exec $CONTAINER sh /tmp/rigrender-$RUN_ID.sh" 2>&1)"

WARNINGS="$(printf '%s' "$RESULT" | sed -n '/===QML WARNINGS===/,/===RUN===/p' | grep -vE '===' || true)"
SIZE="$(printf '%s' "$RESULT" | grep -oE '===SHOT=== [0-9]+' | grep -oE '[0-9]+' || true)"
REMOTE_SHA="$(printf '%s' "$RESULT" | grep -oE '===PACKAGE=== [a-f0-9]{64}' | awk '{print $2}' || true)"
RAW_LOG_SHA="$(printf '%s' "$RESULT" | grep -oE '===LOGSHA=== [a-f0-9]{64}' | awk '{print $2}' || true)"
REMOTE_RUN_ID="$(printf '%s' "$RESULT" | grep -oE '===RUN=== [A-Za-z0-9.-]+' | awk '{print $2}' || true)"
AUDIT_JSON="$(printf '%s' "$RESULT" | sed -n 's/^===AUDIT=== //p' | tail -1)"

if [[ -n "$WARNINGS" ]]; then
  echo "rig-render: shell warnings belong to this plugin run:" >&2
  printf '%s\n' "$WARNINGS" >&2
fi
if [[ -z "$SIZE" || "$SIZE" -lt 4000 ]]; then
  echo "rig-render: no usable screenshot came back (size=${SIZE:-none})" >&2
  printf '%s\n' "$RESULT" >&2
  exit 1
fi
[[ "$REMOTE_SHA" == "$ARCHIVE_SHA" ]] || { echo "rig-render: remote package hash mismatch" >&2; exit 1; }
[[ "$RAW_LOG_SHA" =~ ^[a-f0-9]{64}$ && "$REMOTE_RUN_ID" == "$RUN_ID" ]] || {
  echo "rig-render: raw shell-log provenance is missing or belongs to another run" >&2; exit 1; }

ssh -o BatchMode=yes "$HOST" "docker cp $CONTAINER:/tmp/rigrender-$RUN_ID.png /tmp/rigrender-out-$RUN_ID.png >/dev/null" || exit 1
scp -q -o BatchMode=yes "$HOST:/tmp/rigrender-out-$RUN_ID.png" "$OUT" || exit 1
if [[ -n "$LOG_OUT" ]]; then
  ssh -o BatchMode=yes "$HOST" "docker cp $CONTAINER:/tmp/rigrender-qs-$RUN_ID.log /tmp/rigrender-log-$RUN_ID.log >/dev/null" || exit 1
  scp -q -o BatchMode=yes "$HOST:/tmp/rigrender-log-$RUN_ID.log" "$LOG_OUT" || exit 1
  LOCAL_LOG_SHA="$(sha256sum "$LOG_OUT" | cut -d' ' -f1)"
  [[ "$LOCAL_LOG_SHA" == "$RAW_LOG_SHA" ]] || {
    echo "rig-render: retained shell-log hash mismatch" >&2; exit 1;
  }
fi

DIMS="$(identify -format '%wx%h' "$OUT" 2>/dev/null || true)"
COVERAGE="$(convert "$OUT" -colorspace gray -threshold 3% -format '%[fx:mean]' info: 2>/dev/null || true)"
if [[ "$DIMS" != "1280x720" ]]; then
  echo "rig-render: preview dimensions are ${DIMS:-unreadable}, expected 1280x720" >&2; exit 1
fi
if [[ -z "$COVERAGE" ]] || ! awk -v coverage="$COVERAGE" 'BEGIN { exit !(coverage >= 0.35) }'; then
  echo "rig-render: preview nonblack coverage is ${COVERAGE:-unreadable}, expected at least 0.35" >&2; exit 1
fi
if [[ -n "$WARNINGS" ]]; then
  echo "rig-render: refusing to write a clean receipt for a warning-bearing shell log" >&2; exit 1
fi

PREVIEW_SHA="$(sha256sum "$OUT" | cut -d' ' -f1)"
jq -n --arg fp "$FP" --arg commit "$SOURCE_COMMIT" --argjson dirty "$SOURCE_DIRTY" \
  --arg archive "$ARCHIVE_SHA" --arg remote "$REMOTE_SHA" --arg rig "$HOST/$CONTAINER" \
  --arg run "$REMOTE_RUN_ID" --arg logSha "$RAW_LOG_SHA" --arg sha "$PREVIEW_SHA" \
  --arg packageBoundary "$PACKAGE_BOUNDARY" \
  --arg fixture "$FIXTURE" --arg displayMode "$DISPLAY_MODE" --arg rulesProfile "$RULES_PROFILE" \
  --arg dimensions "${DIMS/x/ x }" --arg coverage "$COVERAGE" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{fingerprint:$fp,sourceCommit:$commit,sourceDirty:$dirty,
    sourcePackageSha256:$archive,remotePackageSha256:$remote,rig:$rig,runId:$run,rawShellLogSha256:$logSha,
    packageBoundary:$packageBoundary,
    fixture:$fixture,displayModeOverride:$displayMode,rulesProfileOverride:$rulesProfile,
    evidenceBoundary:"isolated real Omarchy shell and QML under a dedicated headless compositor; plugin-specific fixture hook when present; live plugin IPC toggle; direct full-frame grim capture with no crop or image post-processing",
    visualInspection:{status:"pending",previewSha256:$sha,checks:[]},
    previewSha256:$sha,dimensions:$dimensions,nonblackCoverage:($coverage|tonumber),capturedAt:$at}' \
  > "$PROOF_OUT"

echo "rig-render: wrote $OUT (${SIZE} bytes on the rig, ${DIMS}, coverage ${COVERAGE})"
echo "rig-render: wrote proof $PROOF_OUT"
if [[ -n "$LOG_OUT" ]]; then echo "rig-render: wrote shell log $LOG_OUT"; fi
if [[ "$RUNTIME_AUDIT" == true ]]; then
  printf '%s\n' "$AUDIT_JSON" | jq -e '
    .schemaVersion == 1 and ([.checks[]] | all(. == true))' >/dev/null || {
      echo "rig-render: runtime audit receipt missing or incomplete" >&2
      printf '%s\n' "$RESULT" >&2
      exit 1
    }
  jq -n --argjson audit "$AUDIT_JSON" --arg fp "$FP" --arg commit "$SOURCE_COMMIT" \
    --argjson dirty "$SOURCE_DIRTY" --arg archive "$ARCHIVE_SHA" --arg remote "$REMOTE_SHA" \
    --arg rig "$HOST/$CONTAINER" --arg run "$REMOTE_RUN_ID" --arg logSha "$RAW_LOG_SHA" \
    --arg fixture "$FIXTURE" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{fingerprint:$fp,sourceCommit:$commit,sourceDirty:$dirty,sourcePackageSha256:$archive,
      remotePackageSha256:$remote,rig:$rig,runId:$run,rawShellLogSha256:$logSha,fixture:$fixture,
      evidenceBoundary:"isolated real Omarchy shell; live local IPC; active, hidden, reopened, and restarted lifecycle; process and TCP observations",
      observedAt:$at,audit:$audit}' > "$AUDIT_OUT"
  echo "rig-render: wrote runtime audit $AUDIT_OUT"
fi
echo "rig-render: loaded clean, no QML warnings"
