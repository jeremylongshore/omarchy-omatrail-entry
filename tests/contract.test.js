const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Hunt = require("../HuntingRules.js")
const Journey = require("../JourneyRules.js")

const root = path.join(__dirname, "..")
const read = (name) => fs.readFileSync(path.join(root, name), "utf8")

test("manifest declares one combined overlay and bar plugin", () => {
  const manifest = JSON.parse(read("manifest.json"))
  assert.equal(manifest.id, "io.github.jeremylongshore.omatrail")
  assert.deepEqual(manifest.kinds, ["overlay", "bar-widget"])
  assert.deepEqual(manifest.entryPoints, { overlay: "Overlay.qml", barWidget: "BarWidget.qml" })
  assert.equal(manifest.keepLoaded, true)
  assert.equal(manifest.barWidget.allowMultiple, false)
  assert.equal(manifest.description.length, 500)
  assert.equal(manifest.barWidget.description, manifest.description)
  assert.match(manifest.description, /offline/i)
  assert.match(manifest.description, /no network/i)
})

test("manifest entry points exist and stay inside the repository", () => {
  const manifest = JSON.parse(read("manifest.json"))
  for (const entry of Object.values(manifest.entryPoints)) {
    const resolved = path.resolve(root, entry)
    assert.ok(resolved.startsWith(root + path.sep))
    assert.equal(fs.statSync(resolved).isFile(), true)
  }
})

test("marketplace render settings select Color Deluxe without changing rules", () => {
  const settings = JSON.parse(read("e2e/render-settings.json"))
  assert.deepEqual(settings, {
    displayMode: "Color Deluxe",
    difficulty: "Normal",
    reducedMotion: true,
    aimAssist: false
  })
  assert.equal(Object.hasOwn(settings, "id"), false)
})

test("render fixtures restore valid deterministic game screens", () => {
  const phases = {
    "hunt-save.json": "hunt",
    "river-save.json": "river",
    "event-save.json": "event",
    "trail-save.json": "trail",
    "ending-save.json": "victory"
  }
  for (const [fixture, phase] of Object.entries(phases)) {
    const parsed = Journey.parseSave(read(`e2e/${fixture}`))
    assert.equal(parsed.valid, true, fixture)
    assert.equal(parsed.state.phase, phase, fixture)
    assert.equal(parsed.state.profile, "color", fixture)
  }

  const parsed = Journey.parseSave(read("e2e/hunt-save.json"))
  const hook = read("e2e/rig-before-shell.sh")
  const nodeStub = read("e2e/bin/node")
  assert.equal(parsed.state.huntSeed, 4089946423)
  assert.match(hook, /omatrail-state" --delete/)
  assert.match(hook, /omatrail-state" --write/)
  assert.match(hook, /OMATRAIL_E2E_SAVE:-hunt-save\.json/)
  const render = read("scripts/rig-render.sh")
  assert.match(render, /OMATRAIL_RIG_FIXTURE:-hunt-save\.json/)
  assert.match(render, /OMATRAIL_RIG_DISPLAY_MODE/)
  assert.match(render, /PROOF_OUT="\$\{3:-\$TARGET\/\.render-proof\.json\}"/)
  assert.match(nodeStub, /^#!\/bin\/sh\nexit 127\n$/)
  assert.notEqual(fs.statSync(path.join(root, "e2e/bin/node")).mode & 0o111, 0)
})

test("render matrix retains both profiles across every critical scene", () => {
  const matrix = read("scripts/rig-render-matrix.sh")
  const render = read("scripts/rig-render.sh")
  assert.match(matrix, /FIXTURES=\(hunt river event trail ending\)/)
  assert.match(matrix, /MODE_NAMES=\("Green Monitor" "Color Deluxe"\)/)
  assert.match(matrix, /\.render-proof\.json/)
  assert.match(matrix, /\.shell\.log/)
  assert.match(matrix, /source fingerprint drifted during capture/)
  assert.match(matrix, /source package drifted during capture/)
  assert.match(matrix, /OMATRAIL_MATRIX_REQUIRE_CLEAN/)
  assert.match(matrix, /mktemp -d -t omatrail-render-matrix/)
  assert.match(matrix, /expected 10 entries/)
  assert.match(render, /retained shell-log hash mismatch/)
  assert.match(render, /--exclude=evidence/)
  assert.match(render, /--exclude=\.harness-hash/)
  assert.match(render, /--exclude=\.render-shell\.log/)
  assert.match(render, /tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner/)
  assert.match(render, /gzip -n/)
  assert.match(render, /OMATRAIL_RUNTIME_AUDIT/)
  assert.match(render, /hostilePayloadsHandled/)
  assert.match(render, /hiddenTimerFrozen/)
  assert.match(render, /restartRestored/)
  assert.match(render, /noTcpConnectionAdded/)
  assert.notEqual(fs.statSync(path.join(root, "scripts/rig-render-matrix.sh")).mode & 0o111, 0)
  assert.notEqual(fs.statSync(path.join(root, "scripts/rig-runtime-audit.sh")).mode & 0o111, 0)
  const runtimeAudit = read("scripts/rig-runtime-audit.sh")
  assert.match(runtimeAudit, /LOG_OUT="\$\{OUT%\.json\}\.shell\.log"/)
  assert.match(runtimeAudit, /rawShellLogSha256/)
  assert.match(runtimeAudit, /sha256sum "\$LOG_OUT"/)
  const verify = read("scripts/rig-verify.sh")
  assert.match(verify, /tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner/)
  assert.match(verify, /--exclude=\.harness-hash/)
  assert.match(verify, /--exclude=\.render-shell\.log/)
  assert.match(verify, /--exclude=evidence/)
  assert.match(verify, /gzip -n/)
})

test("bar launcher uses shell toggle and does not impersonate a panel", () => {
  const qml = read("BarWidget.qml")
  assert.match(qml, /moduleName:\s*"io\.github\.jeremylongshore\.omatrail"/)
  assert.match(qml, /root\.bar\.shell\.toggle\(root\.moduleName,\s*"\{\}"\)/)
  assert.doesNotMatch(qml, /property bool opened|function open\(|function close\(/)
  assert.match(qml, /implicitWidth:/)
  assert.match(qml, /implicitHeight:/)
})

test("overlay implements the current Omarchy lifecycle", () => {
  const qml = read("Overlay.qml")
  assert.match(qml, /property var shell:/)
  assert.match(qml, /property var manifest:/)
  assert.match(qml, /property bool opened:/)
  assert.match(qml, /function open\(payloadJson\)/)
  assert.match(qml, /function close\(\)/)
  assert.match(qml, /function toggle\(\)/)
  assert.match(qml, /root\.shell\.hide\(/)
  assert.match(qml, /WlrLayershell\.layer:\s*WlrLayer\.Overlay/)
  assert.match(qml, /WlrLayershell\.keyboardFocus:\s*WlrKeyboardFocus\.Exclusive/)
  assert.match(qml, /exclusionMode:\s*ExclusionMode\.Ignore/)
  assert.match(qml, /forceActiveFocus\(\)/)
  assert.match(qml, /IpcHandler\s*{[\s\S]*target:\s*"io\.github\.jeremylongshore\.omatrail"/)
  assert.match(qml, /rawPayload\.length\s*>\s*4096/)
  assert.match(qml, /function huntStart\(\): string \{ return root\.huntStartOrResume\(\) \}/)
  assert.doesNotMatch(qml, /function primary\(\): string/)
  assert.match(qml, /function status\(\): string \{ return root\.diagnosticStatus\(\) \}/)
  assert.match(qml, /!payload \|\| typeof payload !== "object" \|\| Array\.isArray\(payload\)/)
  assert.match(qml, /function huntStartOrResume\(\)[\s\S]*viewMode !== "hunt"[\s\S]*returnPending/)
  assert.match(qml, /schemaVersion:\s*1[\s\S]*opened:[\s\S]*focused:[\s\S]*viewMode:[\s\S]*profile:/)
  const diagnostics = qml.match(/function diagnosticStatus\(\) \{([\s\S]*?)\n  \}/)
  assert.ok(diagnostics)
  assert.doesNotMatch(diagnostics[1], /party|inventory|message|saveNotice|cash|food|ammunition/)
  assert.match(qml, /season:\s*Journey\.seasonFor\(state\.month\)/)
  assert.doesNotMatch(qml, /root\.profile\s*=\s*Hunt\.canonicalProfile\(state\.profile\)/)
  assert.match(qml, /label:\s*board\.huntState\.returnPending\s*\?\s*"CONFIRM"\s*:\s*"RETURN \[Q\]"/)
})

test("restoring a journey preserves the selected visual mode", () => {
  const qml = read("JourneyView.qml")
  assert.match(qml, /Journey\.dispatch\(state,\s*\{\s*type:\s*"SET_PROFILE",\s*value:\s*root\.profile\s*\}\)/)
  assert.doesNotMatch(qml, /root\.profile\s*=\s*state\.profile/)
})

test("every Hunt function called by QML exists", () => {
  const qml = read("Overlay.qml") + read("HuntingBoard.qml")
  const called = [...qml.matchAll(/Hunt\.([A-Za-z][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1])
  assert.ok(called.length > 0)
  for (const name of new Set(called)) assert.equal(typeof Hunt[name], "function", name)
})

test("every Journey function called by QML exists", () => {
  const qml = ["Overlay.qml", "JourneyView.qml", "TrailScene.qml", "SaveStore.qml"].map(read).join("\n")
  const called = [...qml.matchAll(/Journey\.([A-Za-z][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1])
  assert.ok(called.length > 0)
  for (const name of new Set(called)) assert.equal(typeof Journey[name], "function", name)
})

test("banner is authored for omaTrail and carries both palettes", () => {
  const banner = read("assets/banner.svg")
  assert.match(banner, /<title[^>]*>omaTrail<\/title>/)
  assert.match(banner, /#63ff73/i)
  assert.match(banner, /#d8c06b/i)
  assert.match(banner, /<(?:path|circle)\b/)
  assert.doesNotMatch(banner, /Widget Name|YOURNAME/)
})

test("runtime source is offline and persistence is descriptor-bound", () => {
  const runtimeFiles = [
    "BarWidget.qml", "Overlay.qml", "JourneyView.qml", "TrailScene.qml",
    "HuntingBoard.qml", "OmatrailButton.qml", "SaveStore.qml",
    "JourneyRules.js", "HuntingRules.js", "bin/omatrail-state"
  ]
  const runtime = runtimeFiles.map(read).join("\n")
  assert.doesNotMatch(runtime, /curl|https?:\/\//)
  const save = read("SaveStore.qml")
  const helper = read("bin/omatrail-state")
  assert.equal((save.match(/\bProcess\s*\{/g) || []).length, 4)
  assert.match(save, /Qt\.resolvedUrl\("bin\/omatrail-state"\)/)
  for (const operation of ["--read-primary", "--read-backup", "--write", "--delete"])
    assert.match(save, new RegExp(operation))
  assert.match(helper, /O_NOFOLLOW/)
  assert.match(helper, /O_NONBLOCK/)
  assert.match(helper, /O_EXCL/)
  assert.match(helper, /flock/)
  assert.match(helper, /rename\(/)
  assert.match(helper, /->sync/)
  assert.match(helper, /MAX_BYTES\s*=\s*64\s*\*\s*1024/)
  assert.match(save, /eraseRequested/)
  assert.match(save, /root\.blocked\s*\|\|\s*root\.eraseRequested\s*\|\|\s*eraser\.running/)
  assert.doesNotMatch(save, /\bFileView\b|\.setText\(/)
  assert.doesNotMatch(runtime, /Style\.font\.monospace/)
})
