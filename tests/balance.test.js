const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const Balance = require("../scripts/balance-sim.js")

test("balance matrix allocates exactly across all Blueprint policy cells", () => {
  assert.equal(Balance.cells().length, 480)
  const allocation = Balance.allocation(100000)
  assert.equal(allocation.reduce((sum, cell) => sum + cell.runs, 0), 100000)
  assert.equal(allocation.filter((cell) => cell.runs === 209).length, 160)
  assert.equal(allocation.filter((cell) => cell.runs === 208).length, 320)
  assert.deepEqual(new Set(allocation.map((cell) => cell.rulesProfile)), new Set(["omatrail", "classic-1978"]))
})

test("balance seeds and sampled policy runs are deterministic", () => {
  assert.equal(Balance.seedFor(0), 2654435761)
  const cell = { policy: "skilled-heavy", difficulty: "normal", occupation: "farmer", departureMonth: 4, rulesProfile: "classic-1978" }
  const first = Balance.playRun(cell, 42)
  const replay = Balance.playRun(cell, 42)
  assert.deepEqual(replay, first)
  assert.ok(["victory", "loss", "nonterminal"].includes(first.phase))
})

test("small balance reports are canonical and replayable", () => {
  const first = Balance.runStudy(24, 0)
  const replay = Balance.runStudy(24, 0)
  assert.equal(first.aggregateSha256, replay.aggregateSha256)
  assert.equal(first.totalRuns, 24)
  assert.equal(first.matrixCells, 480)
  assert.equal(first.schemaVersion, 2)
  assert.equal(first.overall.runs, 24)
  assert.equal(first.byRulesProfile.omatrail.runs + first.byRulesProfile["classic-1978"].runs, 24)
  assert.equal(first.byRulesAndPolicy.omatrail.reckless.runs
    + first.byRulesAndPolicy["classic-1978"].reckless.runs, first.byPolicy.reckless.runs)
  assert.equal(Object.keys(first.byCell).length, 480)
  assert.ok(Object.hasOwn(first.byCell, "classic-1978/reckless/easy/banker/3"))
  assert.deepEqual(replay, first)
})

test("worker sharding does not change the canonical balance report", async () => {
  const serial = Balance.runStudy(48, 0)
  const parallel = await Balance.runStudyParallel(48, 4, 0)
  assert.equal(parallel.aggregateSha256, serial.aggregateSha256)
  assert.deepEqual(parallel, serial)
})

test("the retained 100,000-run report is current and rejects hunting dominance", () => {
  const reportPath = path.join(__dirname, "..", "reports", "balance", "balance-100000.json")
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))
  const engineHash = crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(__dirname, "..", "JourneyRules.js")))
    .update(fs.readFileSync(path.join(__dirname, "..", "HuntingRules.js"))).digest("hex")
  const unsigned = structuredClone(report)
  delete unsigned.aggregateSha256
  const reportHash = crypto.createHash("sha256").update(JSON.stringify(Balance.canonical(unsigned))).digest("hex")

  assert.equal(report.totalRuns, 100000)
  assert.equal(report.matrixCells, 480)
  assert.equal(report.overall.nonterminal, 0)
  assert.equal(report.engineSha256, engineHash)
  assert.equal(report.aggregateSha256, reportHash)
  for (const rulesProfile of Balance.RULE_PROFILES) {
    const policies = report.byRulesAndPolicy[rulesProfile]
    assert.ok(policies["skilled-heavy"].victoryRate > 0.5)
    assert.ok(policies["skilled-light"].victoryRate > 0.5)
    assert.ok(policies.exploit.victoryRate <= policies["skilled-heavy"].victoryRate)
    assert.ok(policies.exploit.victoryRate <= policies["skilled-light"].victoryRate)
    assert.ok(policies.exploit.score.p50 <= Math.max(
      policies["skilled-heavy"].score.p50, policies["skilled-light"].score.p50) * 1.1)
  }
})
