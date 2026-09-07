#!/usr/bin/env node
"use strict"

const crypto = require("node:crypto")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads")
const Journey = require("../JourneyRules.js")
const Hunt = require("../HuntingRules.js")

const POLICY_VERSION = "omatrail-balance-v1"
const SEED_FORMULA = "Math.imul(runIndex + 1, 0x9e3779b1) >>> 0 || 1"
const POLICIES = ["reckless", "naive", "skilled-heavy", "skilled-light", "exploit"]
const DIFFICULTIES = ["easy", "normal", "hard"]
const OCCUPATIONS = ["banker", "carpenter", "doctor", "farmer"]
const MONTHS = [3, 4, 5, 6]
const TERMINAL = new Set(["victory", "loss"])

const POLICY = {
  reckless: {
    pace: "grueling", rations: "bare", huntFood: 40, huntLimit: 8, maxHunts: 2,
    stock: { oxen: 2, food: 1200, ammunition: 30, clothing: 5, medicine: 0, parts: 0 }
  },
  naive: {
    pace: "strenuous", rations: "meager", huntFood: 160, huntLimit: 6, maxHunts: 6,
    stock: { oxen: 6, food: 800, ammunition: 100, clothing: 6, medicine: 3, parts: 4 }
  },
  "skilled-heavy": {
    pace: "steady", rations: "filling", huntFood: 800, huntLimit: 8, maxHunts: 8,
    stock: { oxen: 10, food: 1200, ammunition: 260, clothing: 10, medicine: 8, parts: 10 }
  },
  "skilled-light": {
    pace: "steady", rations: "filling", huntFood: 110, huntLimit: 5, maxHunts: 2,
    stock: { oxen: 10, food: 1050, ammunition: 60, clothing: 12, medicine: 10, parts: 10 }
  },
  exploit: {
    pace: "steady", rations: "filling", huntFood: 900, huntLimit: 14, maxHunts: 20,
    stock: { oxen: 10, food: 500, ammunition: 300, clothing: 8, medicine: 6, parts: 8 }
  }
}

function seedFor(runIndex) {
  return Math.imul(runIndex + 1, 0x9e3779b1) >>> 0 || 1
}

function cells() {
  const result = []
  for (const policy of POLICIES)
    for (const difficulty of DIFFICULTIES)
      for (const occupation of OCCUPATIONS)
        for (const departureMonth of MONTHS)
          result.push({ policy, difficulty, occupation, departureMonth })
  return result
}

function allocation(totalRuns) {
  const matrix = cells()
  const base = Math.floor(totalRuns / matrix.length)
  const remainder = totalRuns % matrix.length
  return matrix.map((cell, index) => ({ ...cell, runs: base + (index < remainder ? 1 : 0) }))
}

function checkedJourney(state, action) {
  const next = Journey.dispatch(state, action)
  const errors = Journey.validate(next)
  if (errors.length) throw new Error(`journey invariant after ${action.type}: ${errors.join("; ")}`)
  return next
}

function checkedHunt(state, action) {
  const next = Hunt.dispatch(state, action)
  const errors = Hunt.validate(next)
  if (errors.length) throw new Error(`hunt invariant after ${action.type}: ${errors.join("; ")}`)
  return next
}

function buyTo(state, item, target) {
  const rule = Journey.ITEMS[item]
  while (state.inventory[item] < target && state.cash >= rule.price) {
    const steps = Math.min(20, Math.max(1, Math.ceil((target - state.inventory[item]) / rule.step)))
    const before = state.inventory[item]
    state = checkedJourney(state, { type: "BUY", item, steps })
    if (state.inventory[item] === before && steps > 1) state = checkedJourney(state, { type: "BUY", item, steps: 1 })
    if (state.inventory[item] === before) break
  }
  return state
}

function stock(state, targets) {
  for (const item of Journey.itemKeys()) state = buyTo(state, item, targets[item] || 0)
  return state
}

function nearestAnimal(hunt) {
  let nearest = null
  let distance = Infinity
  for (const animal of hunt.animals) {
    if (!animal.alive) continue
    const dx = animal.x - hunt.hunter.x
    const dy = animal.y - hunt.hunter.y
    const squared = dx * dx + dy * dy
    if (squared < distance) {
      nearest = animal
      distance = squared
    }
  }
  return nearest
}

function runHunt(journey, policyName, metrics) {
  const rule = POLICY[policyName]
  const carryCapacity = Math.max(40, Math.min(200, 220 - journey.inventory.food))
  let hunt = Hunt.createHunt(journey.huntSeed, {
    profile: journey.profile,
    difficulty: journey.difficulty,
    region: journey.region,
    season: Journey.seasonFor(journey.month),
    ammo: journey.inventory.ammunition,
    carryCapacity,
    assist: false
  })
  hunt = checkedHunt(hunt, { type: "START" })
  let fired = 0
  const tickLimit = policyName === "reckless" ? 12 : policyName === "naive" ? 24 : 48
  for (let tick = 0; tick < tickLimit && hunt.phase === "playing"; tick++) {
    const animal = nearestAnimal(hunt)
    if (!animal) break
    const dx = animal.x - hunt.hunter.x
    const dy = animal.y - hunt.hunter.y
    hunt = checkedHunt(hunt, { type: "AIM", dx, dy })
    const target = Hunt.targetForShot(hunt)
    const carelessShot = policyName === "reckless" || policyName === "naive" && tick % 4 === 0
    if (hunt.cooldownTicks === 0 && fired < rule.huntLimit && (target || carelessShot)) {
      hunt = checkedHunt(hunt, { type: "FIRE" })
      fired += 1
    } else if (!target) {
      hunt = checkedHunt(hunt, { type: "MOVE", dx, dy })
    }
    if (hunt.phase === "playing") hunt = checkedHunt(hunt, { type: "TICK" })
  }
  if (hunt.phase === "playing") hunt = checkedHunt(hunt, { type: "REQUEST_RETURN" })
  if (hunt.returnPending) hunt = checkedHunt(hunt, { type: "FINISH", confirmed: true })
  if (!hunt.result) throw new Error("hunt did not produce a result")

  const result = hunt.result
  metrics.huntRegions[journey.region] = (metrics.huntRegions[journey.region] || 0) + 1
  const season = Journey.seasonFor(journey.month)
  metrics.huntSeasons[season] = (metrics.huntSeasons[season] || 0) + 1
  metrics.shots += result.ammoUsed
  metrics.hits += hunt.hits
  metrics.harvested += result.harvestedPounds
  metrics.carried += result.carriedPounds
  metrics.spoiled += result.spoilagePounds
  metrics.wasted += result.wastedPounds
  metrics.huntInjuries += result.injury ? 1 : 0
  metrics.zeroYieldHunts += result.carriedPounds === 0 ? 1 : 0
  metrics.huntReasons[result.reason] = (metrics.huntReasons[result.reason] || 0) + 1
  return checkedJourney(journey, { type: "APPLY_HUNT_RESULT", result })
}

function eventIndex(state, policyName) {
  const event = state.pendingEvent
  const available = event.choices.map((_, index) => index)
    .filter((index) => Journey.eventChoiceAvailable(state, event, index))
  if (!available.length) return 0
  if (policyName === "reckless") return available[available.length - 1]
  if (policyName === "naive") return available.includes(1) ? 1 : available[0]
  const priorities = policyName === "exploit"
    ? ["use-part", "use-medicine", "trade-ammunition", "rest-recover", "camp-one-day", "hear-party", "scout-ahead", "field-repair", "no-effect"]
    : ["use-medicine", "use-part", "rest-recover", "camp-one-day", "hear-party", "scout-ahead", "field-repair", "no-effect"]
  for (const effect of priorities) {
    const index = event.effects.indexOf(effect)
    if (available.includes(index)) return index
  }
  return available[0]
}

function riverChoice(state, policyName) {
  const options = state.river.options
  if (policyName === "reckless") return options.includes("ford") ? "ford" : "float"
  if (policyName === "naive") return options.includes("guide") ? "guide" : "float"
  if (policyName === "exploit") return options.includes("guide") ? "guide" : options.includes("ferry") ? "ferry" : "float"
  return options.includes("ferry") ? "ferry" : options.includes("guide") ? "guide" : "float"
}

function fortTargets(policyName) {
  if (policyName === "skilled-heavy") return { food: 1050, ammunition: 220, medicine: 5, parts: 6, clothing: 8, oxen: 8 }
  if (policyName === "skilled-light") return { food: 900, ammunition: 40, medicine: 8, parts: 7, clothing: 10, oxen: 8 }
  if (policyName === "exploit") return { food: 500, ammunition: 260, medicine: 5, parts: 6, clothing: 8, oxen: 8 }
  if (policyName === "naive") return { food: 650, ammunition: 60, medicine: 2, parts: 3, clothing: 6, oxen: 6 }
  return POLICY.reckless.stock
}

function lossClass(state) {
  if (Journey.livingParty(state) === 0) return "party"
  if (state.wagonCondition <= 0) return "wagon"
  if (state.oxenCondition <= 0 || state.inventory.oxen < 2) return "oxen"
  return state.ending && state.ending.reason || "unknown"
}

function emptyMetrics() {
  return {
    hunts: 0, rests: 0, repairs: 0, events: 0, riverCrossings: 0, riverFailures: 0,
    shots: 0, hits: 0, harvested: 0, carried: 0, spoiled: 0, wasted: 0, huntInjuries: 0,
    zeroYieldHunts: 0,
    huntRegions: {}, huntSeasons: {}, huntReasons: {}, riverChoices: {}
  }
}

function playRun(cell, runIndex) {
  const seed = seedFor(runIndex)
  const rule = POLICY[cell.policy]
  let state = Journey.createJourney({
    seed, profile: "green", difficulty: cell.difficulty,
    occupation: cell.occupation, departureMonth: cell.departureMonth
  })
  const metrics = emptyMetrics()
  state = stock(state, rule.stock)
  state = checkedJourney(state, { type: "SET_PACE", value: rule.pace })
  state = checkedJourney(state, { type: "SET_RATIONS", value: rule.rations })
  state = checkedJourney(state, { type: "DEPART" })
  if (state.phase === "store") throw new Error(`policy ${cell.policy} could not depart`)

  let transitions = 0
  while (!TERMINAL.has(state.phase) && transitions < 800) {
    transitions += 1
    if (state.phase === "trail") {
      const health = Journey.totalPartyHealth(state)
      const fatigue = Journey.averageFatigue(state)
      const repairAt = cell.policy === "reckless" ? 0 : cell.policy === "naive" ? 28 : 55
      const restAt = cell.policy === "reckless" ? 88 : cell.policy === "naive" ? 76 : 68
      const healthAt = cell.policy === "reckless" ? 38 : cell.policy === "naive" ? 55 : 58
      if ((fatigue > restAt || health < healthAt || state.oxenCondition < (cell.policy === "naive" ? 25 : 38))
          && state.inventory.food > 0) {
        state = checkedJourney(state, { type: "REST" })
        metrics.rests += 1
      } else if (state.wagonCondition < repairAt && state.inventory.parts > 0) {
        state = checkedJourney(state, { type: "REPAIR" })
        metrics.repairs += 1
      } else if (state.inventory.food < rule.huntFood && state.inventory.ammunition > 0
          && metrics.hunts < rule.maxHunts) {
        state = checkedJourney(state, { type: "BEGIN_HUNT" })
        if (state.phase === "hunt") {
          metrics.hunts += 1
          state = runHunt(state, cell.policy, metrics)
        }
      } else state = checkedJourney(state, { type: "TRAVEL" })
    } else if (state.phase === "event") {
      state = checkedJourney(state, { type: "EVENT_CHOICE", index: eventIndex(state, cell.policy) })
      metrics.events += 1
    } else if (state.phase === "river") {
      const choice = riverChoice(state, cell.policy)
      state = checkedJourney(state, { type: "RIVER_CHOICE", choice })
      if (state.phase === "river-result") {
        metrics.riverCrossings += 1
        metrics.riverChoices[choice] = (metrics.riverChoices[choice] || 0) + 1
        metrics.riverFailures += state.riverResult.success ? 0 : 1
      }
    } else if (state.phase === "river-result") {
      state = checkedJourney(state, { type: "LEAVE_STOP" })
    } else if (state.phase === "landmark") {
      const stop = Journey.ROUTE[state.targetIndex]
      if (stop.type === "fort" && cell.policy !== "reckless") state = stock(state, fortTargets(cell.policy))
      state = checkedJourney(state, { type: "LEAVE_STOP" })
    } else throw new Error(`unhandled phase ${state.phase}`)
  }

  const nonterminal = !TERMINAL.has(state.phase)
  return {
    runIndex, seed, cell, phase: nonterminal ? "nonterminal" : state.phase,
    lossClass: state.phase === "loss" ? lossClass(state) : null,
    deathReasons: state.losses.map((loss) => loss.reason),
    durationDays: Journey.journeyDurationDays(state),
    deaths: state.losses.length,
    score: state.ending ? state.ending.score : 0,
    survivors: Journey.livingParty(state),
    resources: { ...state.inventory, cash: state.cash, wagonCondition: state.wagonCondition,
      oxenCondition: state.oxenCondition, health: Journey.totalPartyHealth(state) },
    transitions,
    ...metrics
  }
}

function quantile(values, fraction) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]
}

function wilson(successes, total) {
  if (!total) return { low: 0, high: 0 }
  const z = 1.959963984540054
  const p = successes / total
  const denominator = 1 + z * z / total
  const center = (p + z * z / (2 * total)) / denominator
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) }
}

function summarize(results) {
  const resourceKeys = ["food", "ammunition", "medicine", "parts", "clothing", "oxen", "cash", "wagonCondition", "oxenCondition", "health"]
  const summary = {
    runs: results.length,
    victories: results.filter((result) => result.phase === "victory").length,
    losses: results.filter((result) => result.phase === "loss").length,
    nonterminal: results.filter((result) => result.phase === "nonterminal").length,
    duration: {}, deaths: {}, score: {}, resources: {}, hunts: {}, harvest: {}, waste: {},
    shots: {}, hits: {}, carried: {}, spoiled: {}, huntInjuries: {}, zeroYieldHunts: {},
    rests: {}, repairs: {}, events: {}, riverCrossings: {}, riverFailures: {},
    lossClasses: {}, deathReasons: {}, huntRegions: {}, huntSeasons: {}, huntReasons: {}, riverChoices: {},
    firstFailureSeeds: {}
  }
  summary.victoryRate = summary.runs ? summary.victories / summary.runs : 0
  summary.victoryWilson95 = wilson(summary.victories, summary.runs)
  for (const key of ["durationDays", "deaths", "score", "hunts", "harvested", "wasted", "shots", "hits",
    "carried", "spoiled", "huntInjuries", "zeroYieldHunts", "rests", "repairs", "events", "riverCrossings", "riverFailures"]) {
    const values = results.map((result) => result[key])
    const target = key === "durationDays" ? summary.duration : key === "harvested" ? summary.harvest
      : key === "wasted" ? summary.waste : summary[key]
    target.mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    for (const [label, fraction] of [["p05", 0.05], ["p25", 0.25], ["p50", 0.50], ["p75", 0.75], ["p95", 0.95]])
      target[label] = quantile(values, fraction)
  }
  const totals = results.reduce((sum, result) => {
    sum.shots += result.shots
    sum.hits += result.hits
    sum.harvested += result.harvested
    sum.wasted += result.wasted
    sum.hunts += result.hunts
    sum.injuries += result.huntInjuries
    sum.rivers += result.riverCrossings
    sum.riverFailures += result.riverFailures
    return sum
  }, { shots: 0, hits: 0, harvested: 0, wasted: 0, hunts: 0, injuries: 0, rivers: 0, riverFailures: 0 })
  summary.huntAccuracy = totals.shots ? totals.hits / totals.shots : 0
  summary.wasteRatio = totals.harvested ? totals.wasted / totals.harvested : 0
  summary.huntInjuryRate = totals.hunts ? totals.injuries / totals.hunts : 0
  summary.riverFailureRate = totals.rivers ? totals.riverFailures / totals.rivers : 0
  for (const key of resourceKeys) {
    const values = results.map((result) => result.resources[key])
    summary.resources[key] = { mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length), p50: quantile(values, 0.5) }
  }
  for (const result of results) {
    for (const reason of result.deathReasons) summary.deathReasons[reason] = (summary.deathReasons[reason] || 0) + 1
    for (const mapName of ["huntRegions", "huntSeasons", "huntReasons", "riverChoices"])
      for (const [key, value] of Object.entries(result[mapName]))
        summary[mapName][key] = (summary[mapName][key] || 0) + value
    if (!result.lossClass) continue
    summary.lossClasses[result.lossClass] = (summary.lossClasses[result.lossClass] || 0) + 1
    if (!Object.hasOwn(summary.firstFailureSeeds, result.lossClass)) summary.firstFailureSeeds[result.lossClass] = result.seed
  }
  return summary
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

function runRange(totalRuns, startIndex, endIndex, progress) {
  const plan = allocation(totalRuns)
  const results = []
  let runIndex = 0
  for (const cell of plan) {
    for (let count = 0; count < cell.runs; count++) {
      if (runIndex >= startIndex && runIndex < endIndex) results.push(playRun(cell, runIndex))
      runIndex += 1
      if (progress && runIndex >= startIndex && runIndex < endIndex && runIndex % progress === 0)
        process.stderr.write(`balance-sim: ${runIndex}/${totalRuns}\n`)
    }
  }
  return results
}

function reportFromResults(totalRuns, results) {
  const byPolicy = {}
  for (const policy of POLICIES) byPolicy[policy] = summarize(results.filter((result) => result.cell.policy === policy))
  const byCell = {}
  for (const cell of cells()) {
    const key = `${cell.policy}/${cell.difficulty}/${cell.occupation}/${cell.departureMonth}`
    byCell[key] = summarize(results.filter((result) => result.cell.policy === cell.policy
      && result.cell.difficulty === cell.difficulty && result.cell.occupation === cell.occupation
      && result.cell.departureMonth === cell.departureMonth))
  }
  const report = {
    schemaVersion: 1,
    engineVersion: Journey.createJourney({}).gameVersion,
    contentVersion: Journey.createJourney({}).gameVersion,
    engineSha256: crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(__dirname, "..", "JourneyRules.js")))
      .update(fs.readFileSync(path.join(__dirname, "..", "HuntingRules.js"))).digest("hex"),
    policyVersion: POLICY_VERSION,
    policyDefinitions: POLICY,
    seedFormula: SEED_FORMULA,
    totalRuns,
    matrixCells: cells().length,
    overall: summarize(results),
    byPolicy,
    byCell
  }
  const encoded = JSON.stringify(canonical(report))
  report.aggregateSha256 = crypto.createHash("sha256").update(encoded).digest("hex")
  return report
}

function runStudy(totalRuns, progress) {
  return reportFromResults(totalRuns, runRange(totalRuns, 0, totalRuns, progress))
}

async function runStudyParallel(totalRuns, workerCount, progress) {
  const count = Math.max(1, Math.min(totalRuns, workerCount))
  if (count === 1) return runStudy(totalRuns, progress)
  const ranges = []
  const base = Math.floor(totalRuns / count)
  const remainder = totalRuns % count
  let start = 0
  for (let index = 0; index < count; index++) {
    const size = base + (index < remainder ? 1 : 0)
    ranges.push({ start, end: start + size })
    start += size
  }
  const shards = await Promise.all(ranges.map((range) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { mode: "balance", totalRuns, range } })
    worker.once("message", resolve)
    worker.once("error", reject)
    worker.once("exit", (code) => { if (code !== 0) reject(new Error(`balance worker exited ${code}`)) })
  })))
  const results = shards.flat().sort((left, right) => left.runIndex - right.runIndex)
  if (progress) process.stderr.write(`balance-sim: ${results.length}/${totalRuns}\n`)
  return reportFromResults(totalRuns, results)
}

function parseArguments(argv) {
  const options = { runs: 100000, output: path.join("reports", "balance", "balance-100000.json"), progress: 5000,
    workers: Math.max(1, Math.min(8, os.availableParallelism ? os.availableParallelism() : os.cpus().length)) }
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--runs") options.runs = Number(argv[++index])
    else if (argv[index] === "--output") options.output = argv[++index]
    else if (argv[index] === "--progress") options.progress = Number(argv[++index])
    else if (argv[index] === "--workers") options.workers = Number(argv[++index])
    else throw new Error(`unknown argument ${argv[index]}`)
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error("--runs must be a positive integer")
  if (!Number.isInteger(options.progress) || options.progress < 0) throw new Error("--progress must be a nonnegative integer")
  if (!Number.isInteger(options.workers) || options.workers < 1 || options.workers > 64)
    throw new Error("--workers must be an integer from 1 through 64")
  return options
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const report = await runStudyParallel(options.runs, options.workers, options.progress)
  const output = path.resolve(options.output)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n")
  process.stdout.write(`${output}\n${report.aggregateSha256}\n`)
}

module.exports = { POLICY_VERSION, POLICIES, DIFFICULTIES, OCCUPATIONS, MONTHS, seedFor, cells, allocation, playRun, runStudy, runStudyParallel, canonical }
if (!isMainThread && workerData && workerData.mode === "balance") {
  parentPort.postMessage(runRange(workerData.totalRuns, workerData.range.start, workerData.range.end, 0))
} else if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1 })
}
