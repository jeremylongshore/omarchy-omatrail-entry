const test = require("node:test")
const assert = require("node:assert/strict")
const Hunt = require("../HuntingRules.js")

function started(options = {}) {
  return Hunt.dispatch(Hunt.createHunt(options.seed || 1848, options), { type: "START" })
}

function animal(species, x, y) {
  return { id: species + "-fixture", species, x, y, dx: 1, dy: 0, moveEvery: 99, alive: true, hit: false }
}

function reachableCells(state) {
  const key = (x, y) => `${x},${y}`
  const blocked = new Set(state.obstacles.map((item) => key(Math.round(item.x), Math.round(item.y))))
  const start = { x: Math.round(state.hunter.x), y: Math.round(state.hunter.y) }
  const queue = [start]
  const reached = new Set([key(start.x, start.y)])
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    for (const direction of [
      [-1, -1], [0, -1], [1, -1], [-1, 0],
      [1, 0], [-1, 1], [0, 1], [1, 1]
    ]) {
      const x = cell.x + direction[0]
      const y = cell.y + direction[1]
      const cellKey = key(x, y)
      if (x < 1 || x > state.width - 1 || y < 1 || y > state.height - 1
          || blocked.has(cellKey) || reached.has(cellKey)) continue
      reached.add(cellKey)
      queue.push({ x, y })
    }
  }
  return reached
}

test("seed normalization and random draws are reproducible", () => {
  assert.equal(Hunt.normalizedSeed(0), 1)
  assert.equal(Hunt.normalizedSeed(-12.9), 12)
  assert.equal(Hunt.normalizedSeed("bad"), 1)
  assert.deepEqual(Hunt.nextRandom(99), Hunt.nextRandom(99))
  assert.notEqual(Hunt.nextRandom(99).seed, 99)
})

test("profiles, difficulty, region, and season are canonical", () => {
  assert.equal(Hunt.canonicalProfile("Color Deluxe"), "color")
  assert.equal(Hunt.canonicalProfile("anything"), "green")
  assert.equal(Hunt.canonicalDifficulty("HARD"), "hard")
  assert.equal(Hunt.canonicalDifficulty("unknown"), "normal")
  assert.equal(Hunt.canonicalRegion("MOUNTAINS"), "mountains")
  assert.equal(Hunt.canonicalRegion("woodland"), "woodland")
  assert.equal(Hunt.canonicalRegion("western-forest"), "western-forest")
  assert.equal(Hunt.canonicalRegion("ocean"), "prairie")
  assert.ok(Object.keys(Hunt.REGIONS).length >= 5)
  assert.equal(Hunt.canonicalSeason("winter"), "winter")
  assert.equal(Hunt.canonicalSeason("monsoon"), "spring")
  assert.ok(Hunt.difficultySettings("easy").ammo > Hunt.difficultySettings("hard").ammo)
})

test("10,000 generated fields are deterministic and 1,000 are graph-navigable", () => {
  const regions = Object.keys(Hunt.REGIONS)
  for (let seed = 1; seed <= 10000; seed++) {
    const region = regions[(seed - 1) % regions.length]
    const left = Hunt.createHunt(seed, { region })
    const right = Hunt.createHunt(seed, { region })
    assert.deepEqual(left, right)
    assert.deepEqual(Hunt.validate(left), [])
    const obstacles = left.obstacles.map((item) => `${Math.round(item.x)},${Math.round(item.y)}`)
    assert.equal(new Set(obstacles).size, obstacles.length)
    const animals = new Set()
    for (const item of left.animals) {
      const cell = `${Math.round(item.x)},${Math.round(item.y)}`
      assert.equal(obstacles.includes(cell), false, `seed ${seed} obstacle overlap`)
      assert.equal(animals.has(cell), false, `seed ${seed} animal overlap`)
      assert.ok(Hunt.REGIONS[region].species.includes(item.species), `seed ${seed} eligible species`)
      animals.add(cell)
    }
    if (seed <= 1000) {
      const reached = reachableCells(left)
      assert.ok(left.animals.every((item) =>
        reached.has(`${Math.round(item.x)},${Math.round(item.y)}`)), `seed ${seed} navigable animals`)
    }
  }
})

test("display profile changes presentation only", () => {
  let green = started({ profile: "green" })
  const actions = [
    { type: "AIM", dx: 0, dy: 1 },
    { type: "MOVE", dx: -1, dy: 0 },
    { type: "TICK" },
    { type: "FIRE" },
    { type: "TICK" }
  ]
  let color = Hunt.dispatch(green, { type: "SET_PROFILE", profile: "color" })
  for (const action of actions) {
    green = Hunt.dispatch(green, action)
    color = Hunt.dispatch(color, action)
  }
  assert.deepEqual(Hunt.semanticSnapshot(green), Hunt.semanticSnapshot(color))
  assert.equal(green.profile, "green")
  assert.equal(color.profile, "color")
})

test("phase action matrix freezes ready, paused, and complete hunting state", () => {
  const ready = Hunt.createHunt(1)
  for (const action of [{ type: "MOVE", dx: 1, dy: 0 }, { type: "AIM", dx: 0, dy: 1 }, { type: "FIRE" }, { type: "TICK" }])
    assert.deepEqual(Hunt.dispatch(ready, action), ready)

  const playing = Hunt.dispatch(ready, { type: "START" })
  const paused = Hunt.dispatch(playing, { type: "PAUSE_TOGGLE" })
  for (const action of [{ type: "MOVE", dx: 1, dy: 0 }, { type: "AIM", dx: 0, dy: 1 }, { type: "FIRE" }, { type: "TICK" }])
    assert.deepEqual(Hunt.dispatch(paused, action), paused)

  const complete = Hunt.settle(playing, "manual")
  for (const action of [{ type: "MOVE", dx: 1, dy: 0 }, { type: "AIM", dx: 0, dy: 1 }, { type: "FIRE" }, { type: "TICK" }])
    assert.deepEqual(Hunt.dispatch(complete, action), complete)
})

test("movement is bounded, obstacle aware, and uses eight deterministic directions", () => {
  assert.deepEqual(Hunt.directionFor(99, 1), { x: 1, y: 0 })
  assert.deepEqual(Hunt.directionFor(1, -99), { x: 0, y: -1 })
  assert.deepEqual(Hunt.directionFor(-4, 3), { x: -1, y: 1 })
  assert.deepEqual(Hunt.directionFor(0, 0), { x: 0, y: 0 })
  let state = started()
  state.hunter = { x: 1, y: 1, stamina: 100 }
  state.obstacles = [{ id: "block", x: 2, y: 1, size: 1 }]
  assert.deepEqual(Hunt.dispatch(state, { type: "MOVE", dx: -1, dy: 0 }).hunter.x, 1)
  assert.deepEqual(Hunt.dispatch(state, { type: "MOVE", dx: 1, dy: 0 }).hunter, state.hunter)
  const moved = Hunt.dispatch(state, { type: "MOVE", dx: 0, dy: 1 })
  assert.equal(moved.hunter.y, 2)
  assert.ok(moved.hunter.stamina < state.hunter.stamina)
})

test("shot targeting selects the nearest animal on the aim line", () => {
  const state = started({ ammo: 4, carryCapacity: 500 })
  state.obstacles = []
  state.aim = { x: 1, y: 0 }
  state.animals = [animal("deer", state.hunter.x + 8, state.hunter.y), animal("rabbit", state.hunter.x + 3, state.hunter.y)]
  assert.equal(Hunt.targetForShot(state).species, "rabbit")
  const fired = Hunt.dispatch(state, { type: "FIRE" })
  assert.equal(fired.ammo, 3)
  assert.equal(fired.shotsFired, 1)
  assert.equal(fired.hits, 1)
  assert.equal(fired.animals[1].alive, false)
  assert.equal(fired.animals[1].hit, true)
  assert.equal(fired.harvestedPounds, 8)
  assert.equal(fired.carriedPounds, 8)
  assert.equal(fired.score, 20)
  assert.equal(fired.noise, 18)
  assert.equal(fired.phase, "playing")
})

test("misses, cooldown, and ammunition exit are explicit", () => {
  let state = started({ ammo: 1 })
  state.animals = []
  state = Hunt.dispatch(state, { type: "FIRE" })
  assert.equal(state.shotsFired, 1)
  assert.equal(state.hits, 0)
  assert.equal(state.ammo, 0)
  assert.equal(state.phase, "complete")
  assert.equal(state.result.reason, "ammunition")
  assert.equal(state.result.ammoUsed, 1)
  assert.match(state.message, /Out of ammunition/)

  let cooldown = started({ ammo: 3 })
  cooldown.animals = []
  cooldown = Hunt.dispatch(cooldown, { type: "FIRE" })
  assert.equal(cooldown.message, "The shot missed")
  const refused = Hunt.dispatch(cooldown, { type: "FIRE" })
  assert.equal(refused.ammo, cooldown.ammo)
  for (let count = 0; count < 4; count++) cooldown = Hunt.dispatch(cooldown, { type: "TICK" })
  assert.equal(Hunt.dispatch(cooldown, { type: "FIRE" }).ammo, cooldown.ammo - 1)
})

test("a hit with the final round settles and zero-ammo fire is safe", () => {
  let state = started({ ammo: 1, carryCapacity: 500 })
  state.obstacles = []
  state.animals = [animal("deer", state.hunter.x + 3, state.hunter.y)]
  state = Hunt.dispatch(state, { type: "FIRE" })
  assert.equal(state.hits, 1)
  assert.equal(state.phase, "complete")
  assert.equal(state.result.reason, "ammunition")
  assert.match(state.message, /Out of ammunition/)

  let empty = started({ ammo: 0 })
  empty = Hunt.dispatch(empty, { type: "FIRE" })
  assert.equal(empty.phase, "complete")
  assert.equal(empty.result.reason, "ammunition")
})

test("carry, waste, spoilage, and score conserve the harvest", () => {
  let state = started({ ammo: 5, carryCapacity: 10, season: "summer" })
  state.obstacles = []
  state.aim = { x: 1, y: 0 }
  state.animals = [animal("bison", state.hunter.x + 3, state.hunter.y)]
  state = Hunt.dispatch(state, { type: "FIRE" })
  assert.equal(state.phase, "complete")
  assert.equal(state.harvestedPounds, 180)
  assert.equal(state.carriedPounds + state.wastedPounds, 180)
  assert.equal(state.result.spoilagePounds, 1)
  assert.equal(state.result.reason, "carry")
  assert.match(state.message, /Carry limit reached/)
  assert.equal(state.score, 0)

  let full = started({ ammo: 5, carryCapacity: 1 })
  full.carriedPounds = 1
  full.harvestedPounds = 1
  full.score = 10
  full.obstacles = []
  full.aim = { x: 1, y: 0 }
  full.animals = [animal("rabbit", full.hunter.x + 3, full.hunter.y)]
  const afterWaste = Hunt.dispatch(full, { type: "FIRE" })
  assert.equal(afterWaste.carriedPounds, 1)
  assert.equal(afterWaste.wastedPounds, 8)
  assert.equal(afterWaste.score, 2)

  for (const [season, expected] of [["spring", 5], ["summer", 10], ["winter", 2]]) {
    const seasonal = started({ season, carryCapacity: 200 })
    seasonal.carriedPounds = 100
    seasonal.harvestedPounds = 100
    seasonal.score = 200
    const result = Hunt.settle(seasonal, "manual")
    assert.equal(result.result.spoilagePounds, expected)
    assert.equal(result.carriedPounds, 100 - expected)
    assert.equal(result.wastedPounds, expected)
    assert.equal(result.score, 200 - expected)
  }
})

test("timer and confirmed return settle bounded expedition costs", () => {
  let timed = started({ ticks: 10, region: "mountains" })
  for (let count = 0; count < 10; count++) timed = Hunt.dispatch(timed, { type: "TICK" })
  assert.equal(timed.phase, "complete")
  assert.equal(timed.result.reason, "time")
  assert.match(timed.message, /Hunting time is over/)
  assert.equal(timed.result.expeditionDays, 2)
  assert.ok(timed.result.partyEnergyCost >= 13 && timed.result.partyEnergyCost <= 19)

  let manual = started()
  manual = Hunt.dispatch(manual, { type: "REQUEST_RETURN" })
  assert.equal(manual.returnPending, true)
  assert.equal(manual.phase, "paused")
  const ignored = Hunt.dispatch(manual, { type: "FINISH", confirmed: false })
  assert.equal(ignored.phase, "paused")
  manual = Hunt.dispatch(manual, { type: "FINISH", confirmed: true })
  assert.equal(manual.result.reason, "manual")
  assert.equal(manual.returnPending, false)
  assert.match(manual.message, /return to the wagon/)

  let usedRound = started({ ammo: 5 })
  usedRound.animals = []
  usedRound = Hunt.dispatch(usedRound, { type: "FIRE" })
  usedRound = Hunt.dispatch(usedRound, { type: "REQUEST_RETURN" })
  usedRound = Hunt.dispatch(usedRound, { type: "FINISH", confirmed: true })
  assert.equal(usedRound.result.ammoUsed, 1)

  const injured = started({ seed: 1972, region: "mountains" })
  injured.rngState = 1972
  const injuredResult = Hunt.settle(injured, "manual")
  assert.equal(injuredResult.result.injury, true)
  assert.equal(injuredResult.result.partyEnergyCost, 19)

  const safe = started({ seed: 1, region: "mountains" })
  safe.rngState = 1
  const safeResult = Hunt.settle(safe, "manual")
  assert.equal(safeResult.result.injury, false)
  assert.equal(safeResult.result.partyEnergyCost, 13)
})

test("pause resumes, restart preserves configuration, and complete start is inert", () => {
  let state = started({ seed: 77, profile: "color", difficulty: "hard", region: "desert", season: "fall", ammo: 9, carryCapacity: 88 })
  state = Hunt.dispatch(state, { type: "PAUSE_TOGGLE" })
  assert.equal(state.phase, "paused")
  state = Hunt.dispatch(state, { type: "PAUSE_TOGGLE" })
  assert.equal(state.phase, "playing")
  assert.equal(state.returnPending, false)

  const restarted = Hunt.dispatch(state, { type: "RESTART", seed: 78 })
  assert.equal(restarted.phase, "ready")
  assert.equal(restarted.seed, 78)
  assert.equal(restarted.profile, "color")
  assert.equal(restarted.difficulty, "hard")
  assert.equal(restarted.region, "desert")
  assert.equal(restarted.season, "fall")
  assert.equal(restarted.initialAmmo, 9)
  assert.equal(restarted.carryCapacity, 88)

  const complete = Hunt.settle(state, "manual")
  const startedAgain = Hunt.dispatch(complete, { type: "START" })
  const beforeSecondSettlement = structuredClone(startedAgain)
  assert.equal(startedAgain.phase, "complete")
  assert.equal(startedAgain.message, "Hunt complete")
  assert.deepEqual(Hunt.settle(startedAgain, "time"), beforeSecondSettlement)
})

test("animal movement turns, bounces, and ignores harvested animals", () => {
  let state = started({ seed: 31, ticks: 100 })
  state.obstacles = [{ id: "wall", x: 11, y: 10, size: 1 }]
  state.animals = [
    { ...animal("rabbit", 10, 10), dx: 1, dy: 0, moveEvery: 1 },
    { ...animal("deer", 20, 20), dx: 1, dy: 0, moveEvery: 1, alive: false }
  ]
  state.tick = 11
  state.cooldownTicks = 3
  state.hunter.stamina = 40
  state.noise = 20
  const next = Hunt.dispatch(state, { type: "TICK" })
  assert.equal(next.tick, 12)
  assert.equal(next.cooldownTicks, 2)
  assert.equal(next.hunter.stamina, 41)
  assert.equal(next.noise, 19)
  assert.equal(next.animals[0].x, 10)
  assert.equal(next.animals[1].x, 20)
  assert.ok([-1, 0, 1].includes(next.animals[0].dx))
  assert.ok([-1, 0, 1].includes(next.animals[0].dy))
})

test("targeting rejects dead, behind, distant, and off-line animals", () => {
  const state = started({ assist: false })
  state.obstacles = []
  state.aim = { x: 1, y: 0 }
  state.animals = [
    { ...animal("rabbit", state.hunter.x + 2, state.hunter.y), alive: false },
    animal("deer", state.hunter.x - 3, state.hunter.y),
    animal("deer", state.hunter.x + state.visibility + 2, state.hunter.y),
    animal("deer", state.hunter.x + 4, state.hunter.y + 5)
  ]
  assert.equal(Hunt.targetForShot(state), null)
  state.assist = true
  state.animals = [animal("deer", state.hunter.x + 4, state.hunter.y + 2)]
  assert.equal(Hunt.targetForShot(state).species, "deer")
})

test("aim assist extends time once and slows animals", () => {
  let state = started({ assist: false })
  const originalTicks = state.remainingTicks
  const originalMoveEvery = state.animals[0].moveEvery
  state = Hunt.dispatch(state, { type: "SET_ASSIST", enabled: true })
  assert.equal(state.remainingTicks, originalTicks + 150)
  const afterOneTick = Hunt.dispatch(state, { type: "TICK" })
  assert.equal(afterOneTick.animals[0].x, state.animals[0].x)
  state = afterOneTick
  state = Hunt.dispatch(state, { type: "SET_ASSIST", enabled: false })
  state = Hunt.dispatch(state, { type: "SET_ASSIST", enabled: true })
  assert.equal(state.remainingTicks, afterOneTick.remainingTicks)
  assert.equal(originalMoveEvery >= 1, true)
})

test("settings lookup follows bar layout before enabled plugins", () => {
  const config = {
    bar: { layout: { left: [], center: [], right: [{ id: "io.github.jeremylongshore.omatrail", displayMode: "Color Deluxe" }] } },
    plugins: [{ id: "io.github.jeremylongshore.omatrail", displayMode: "Green Monitor" }]
  }
  assert.equal(Hunt.findEntry(config, "io.github.jeremylongshore.omatrail").displayMode, "Color Deluxe")
  assert.deepEqual(Hunt.findEntry(null, "x"), {})
  assert.deepEqual(Hunt.findEntry({ bar: { layout: { right: "bad" } } }, "x"), {})
  assert.equal(Hunt.findEntry({ plugins: [{ id: "x", difficulty: "Hard" }] }, "x").difficulty, "Hard")
  assert.deepEqual(Hunt.findEntry({ plugins: [{ id: "y" }] }, "x"), {})
})

test("validation rejects corrupt counters, coordinates, and conservation", () => {
  const valid = Hunt.createHunt(42)
  assert.deepEqual(Hunt.validate(valid), [])
  for (const mutation of [
    (state) => { state.ammo = Number.NaN },
    (state) => { state.rngState = Infinity },
    (state) => { state.hunter.x = Number.NaN },
    (state) => { state.carriedPounds = state.carryCapacity + 1 },
    (state) => { state.wastedPounds = -1 },
    (state) => { state.hits = state.shotsFired + 1 },
    (state) => { state.harvestedPounds = 4 },
    (state) => { state.phase = "broken" },
    (state) => { state.remainingTicks = state.initialTicks + 1 }
  ]) {
    const corrupt = structuredClone(valid)
    mutation(corrupt)
    assert.ok(Hunt.validate(corrupt).length > 0)
  }
  assert.deepEqual(Hunt.validate(null), ["state must be an object"])
})

test("time, accuracy, and living-animal summaries are bounded", () => {
  const state = Hunt.createHunt(7, { ticks: 615 })
  assert.equal(Hunt.timeText(state), "1:02")
  assert.equal(Hunt.accuracy(state), 0)
  state.shotsFired = 3
  state.hits = 2
  assert.equal(Hunt.accuracy(state), 67)
  assert.equal(Hunt.livingAnimals(state), 8)
  state.animals[0].alive = false
  assert.equal(Hunt.livingAnimals(state), 7)
})
