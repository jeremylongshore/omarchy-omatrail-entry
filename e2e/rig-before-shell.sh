#!/usr/bin/env bash
set -euo pipefail

"$PLUGIN_DIR/bin/omatrail-state" --delete
fixture="${OMATRAIL_E2E_SAVE:-hunt-save.json}"
if [[ "$fixture" == "none" ]]; then
  exit 0
fi
[[ "$fixture" =~ ^[A-Za-z0-9._-]+$ ]]
[[ -f "$PLUGIN_DIR/e2e/$fixture" ]]
"$PLUGIN_DIR/bin/omatrail-state" --write < "$PLUGIN_DIR/e2e/$fixture"
