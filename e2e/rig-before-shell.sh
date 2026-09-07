#!/usr/bin/env bash
set -euo pipefail

"$PLUGIN_DIR/bin/omatrail-state" --delete
fixture="${OMATRAIL_E2E_SAVE:-hunt-save.json}"
if [[ "$fixture" == "none" ]]; then
  exit 0
fi
[[ "$fixture" =~ ^[A-Za-z0-9._-]+$ ]]
[[ -f "$PLUGIN_DIR/e2e/$fixture" ]]
rules_profile="${OMATRAIL_E2E_RULES_PROFILE:-omatrail}"
case "$rules_profile" in omatrail|classic-1978) ;; *) exit 2 ;; esac
jq --arg rules "$rules_profile" '
  .state.rulesProfile = $rules
  | .state.year = (if $rules == "classic-1978" then 1847 else 1848 end)
  | if .state.ending then
      .state.ending.rulesProfile = $rules
      | .state.ending.durationDays = ((.state.year - (if $rules == "classic-1978" then 1847 else 1848 end)) * 360
        + (.state.month - .state.departureMonth) * 30 + .state.day - 1)
    else . end
' "$PLUGIN_DIR/e2e/$fixture" | "$PLUGIN_DIR/bin/omatrail-state" --write
