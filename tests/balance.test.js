const test = require("node:test")
const assert = require("node:assert/strict")
const Balance = require("../scripts/balance-sim.js")

test("balance matrix allocates exactly across all Blueprint policy cells", () => {
  assert.equal(Balance.cells().length, 240)
  const allocation = Balance.allocation(100000)
  assert.equal(allocation.reduce((sum, cell) => sum + cell.runs, 0), 100000)
  assert.equal(allocation.filter((cell) => cell.runs === 417).length, 160)
  assert.equal(allocation.filter((cell) => cell.runs === 416).length, 80)
})

test("balance seeds and sampled policy runs are deterministic", () => {
  assert.equal(Balance.seedFor(0), 2654435761)
  const cell = { policy: "skilled-heavy", difficulty: "normal", occupation: "farmer", departureMonth: 4 }
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
  assert.equal(first.matrixCells, 240)
  assert.equal(first.overall.runs, 24)
  assert.deepEqual(replay, first)
})

test("worker sharding does not change the canonical balance report", async () => {
  const serial = Balance.runStudy(48, 0)
  const parallel = await Balance.runStudyParallel(48, 4, 0)
  assert.equal(parallel.aggregateSha256, serial.aggregateSha256)
  assert.deepEqual(parallel, serial)
})
