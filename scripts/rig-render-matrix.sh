#!/usr/bin/env bash
# Retain the critical omaTrail scene matrix in both display profiles, with one
# hash-bound receipt and raw Omarchy shell log for every uncropped frame.
set -euo pipefail

ROOT="$(cd "${1:-$(dirname "$0")/..}" && pwd)"
EVIDENCE_DIR="${2:-$ROOT/evidence/render-matrix}"
RENDER="$ROOT/scripts/rig-render.sh"
REQUIRE_CLEAN="${OMATRAIL_MATRIX_REQUIRE_CLEAN:-false}"
FIXTURES=(hunt river event trail ending)
MODE_SLUGS=(green color)
MODE_NAMES=("Green Monitor" "Color Deluxe")
RULE_SLUGS=(omatrail classic)
RULE_NAMES=(omatrail classic-1978)

[[ -x "$RENDER" ]] || { echo "rig-render-matrix: rig-render.sh is not executable" >&2; exit 2; }
case "$REQUIRE_CLEAN" in true|false) ;; *) echo "rig-render-matrix: OMATRAIL_MATRIX_REQUIRE_CLEAN must be true or false" >&2; exit 2 ;; esac
CAPTURE_DIR="$(mktemp -d -t omatrail-render-matrix-XXXXXXXX)"
trap 'find "$CAPTURE_DIR" -depth -delete 2>/dev/null || true' EXIT

for rule_index in "${!RULE_SLUGS[@]}"; do
  rule_slug="${RULE_SLUGS[$rule_index]}"
  rules_profile="${RULE_NAMES[$rule_index]}"
  for mode_index in "${!MODE_SLUGS[@]}"; do
    slug="${MODE_SLUGS[$mode_index]}"
    mode="${MODE_NAMES[$mode_index]}"
    for fixture in "${FIXTURES[@]}"; do
      stem="$slug-$fixture"
      if [[ "$rule_slug" == classic ]]; then stem="classic-$stem"; fi
      echo "rig-render-matrix: rendering $rules_profile / $mode / $fixture"
      OMATRAIL_RIG_FIXTURE="$fixture-save.json" \
        OMATRAIL_RIG_DISPLAY_MODE="$mode" \
        OMATRAIL_RIG_RULES_PROFILE="$rules_profile" \
        "$RENDER" "$ROOT" \
          "$CAPTURE_DIR/$stem.png" \
          "$CAPTURE_DIR/$stem.render-proof.json" \
          "$CAPTURE_DIR/$stem.shell.log"
    done
  done
done

for receipt in "$CAPTURE_DIR"/*.render-proof.json; do
  jq -e '
    .sourcePackageSha256 == .remotePackageSha256 and
    .dimensions == "1280 x 720" and
    .nonblackCoverage >= 0.35 and
    (.rawShellLogSha256 | test("^[a-f0-9]{64}$")) and
    (.previewSha256 | test("^[a-f0-9]{64}$"))
  ' "$receipt" >/dev/null
done

ledger_tmp="$CAPTURE_DIR/.matrix.json"
jq -s \
  --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg evidenceBoundary "twenty uncropped 1280 x 720 frames from isolated real Omarchy shells; five deterministic semantic fixtures rendered with two rules profiles in Green Monitor and Color Deluxe; each entry retains its raw shell log and rig receipt" \
  '{schemaVersion:1,generatedAt:$generatedAt,evidenceBoundary:$evidenceBoundary,
    entries:(map({fixture,displayMode:.displayModeOverride,rulesProfile:.rulesProfileOverride,fingerprint,sourceCommit,sourceDirty,
      sourcePackageSha256,remotePackageSha256,rig,runId,rawShellLogSha256,
      previewSha256,dimensions,nonblackCoverage,capturedAt}))}' \
  "$CAPTURE_DIR"/*.render-proof.json > "$ledger_tmp"
mv "$ledger_tmp" "$CAPTURE_DIR/matrix.json"

entry_count="$(jq '.entries | length' "$CAPTURE_DIR/matrix.json")"
[[ "$entry_count" -eq 20 ]] || { echo "rig-render-matrix: expected 20 entries, got $entry_count" >&2; exit 1; }
fingerprint_count="$(jq '[.entries[].fingerprint] | unique | length' "$CAPTURE_DIR/matrix.json")"
[[ "$fingerprint_count" -eq 1 ]] || { echo "rig-render-matrix: source fingerprint drifted during capture" >&2; exit 1; }
commit_count="$(jq '[.entries[].sourceCommit] | unique | length' "$CAPTURE_DIR/matrix.json")"
[[ "$commit_count" -eq 1 ]] || { echo "rig-render-matrix: source commit drifted during capture" >&2; exit 1; }
package_count="$(jq '[.entries[].sourcePackageSha256] | unique | length' "$CAPTURE_DIR/matrix.json")"
[[ "$package_count" -eq 1 ]] || { echo "rig-render-matrix: source package drifted during capture" >&2; exit 1; }
dirty_count="$(jq '[.entries[].sourceDirty] | unique | length' "$CAPTURE_DIR/matrix.json")"
[[ "$dirty_count" -eq 1 ]] || { echo "rig-render-matrix: source dirty state drifted during capture" >&2; exit 1; }
if [[ "$REQUIRE_CLEAN" == true ]]; then
  jq -e 'all(.entries[]; .sourceDirty == false)' "$CAPTURE_DIR/matrix.json" >/dev/null || {
    echo "rig-render-matrix: clean source was required but the candidate is dirty" >&2; exit 1;
  }
fi

mkdir -p "$EVIDENCE_DIR"
for artifact in "$CAPTURE_DIR"/*; do
  cp -f "$artifact" "$EVIDENCE_DIR/"
done

echo "rig-render-matrix: PASS, retained 20 frames, receipts, and shell logs in $EVIDENCE_DIR"
