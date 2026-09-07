// omaTrail hunting rules.
//
// This file deliberately has no QML, filesystem, clock, or network access.
// Every state transition is driven by an explicit action and seeded random
// state, so the same hunt can be replayed under Node and inside Omarchy.

var GRID_WIDTH = 48
var GRID_HEIGHT = 28
var DEFAULT_TICKS = 900
var DEFAULT_AMMO = 24
var DEFAULT_CARRY = 200

var SPECIES = {
  rabbit: { label: "rabbit", yieldPounds: 8, moveEvery: 2, radius: 1, points: 12 },
  turkey: { label: "turkey", yieldPounds: 14, moveEvery: 2, radius: 1, points: 18 },
  deer: { label: "deer", yieldPounds: 50, moveEvery: 2, radius: 1, points: 45 },
  bison: { label: "bison", yieldPounds: 180, moveEvery: 3, radius: 2, points: 85 }
}

var REGIONS = {
  woodland: { species: ["rabbit", "turkey", "deer", "rabbit", "turkey", "deer", "rabbit", "deer"], visibility: 13, days: 1, energy: 9, risk: 5 },
  prairie: { species: ["rabbit", "deer", "turkey", "rabbit", "deer", "bison", "turkey", "deer"], visibility: 18, days: 1, energy: 8, risk: 4 },
  plains: { species: ["rabbit", "bison", "deer", "bison", "turkey", "deer", "bison", "rabbit"], visibility: 20, days: 1, energy: 9, risk: 5 },
  mountains: { species: ["rabbit", "deer", "deer", "turkey", "rabbit", "deer", "turkey", "deer"], visibility: 14, days: 2, energy: 13, risk: 9 },
  desert: { species: ["rabbit", "rabbit", "deer", "turkey", "rabbit", "deer", "rabbit", "turkey"], visibility: 16, days: 2, energy: 15, risk: 12 },
  "western-forest": { species: ["deer", "turkey", "rabbit", "deer", "turkey", "deer", "rabbit", "deer"], visibility: 12, days: 2, energy: 11, risk: 7 }
}

var DIRECTIONS = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 },                         { x: 1, y: 0 },
  { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 }
]

function finiteNumber(value, fallback) {
  var number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function normalizedSeed(value) {
  var seed = Math.floor(Math.abs(finiteNumber(value, 1))) >>> 0
  return seed === 0 ? 1 : seed
}

function nextRandom(seed) {
  var next = (Math.imul(normalizedSeed(seed), 1664525) + 1013904223) >>> 0
  return { seed: next, value: next / 4294967296 }
}

function randomRange(seed, minimum, maximum) {
  var draw = nextRandom(seed)
  return {
    seed: draw.seed,
    value: minimum + (maximum - minimum) * draw.value
  }
}

function canonicalProfile(value) {
  return String(value || "").toLowerCase().indexOf("color") === 0 ? "color" : "green"
}

function canonicalDifficulty(value) {
  var name = String(value || "").toLowerCase()
  return name === "easy" || name === "hard" ? name : "normal"
}

function canonicalRegion(value) {
  var name = String(value || "").toLowerCase()
  return Object.prototype.hasOwnProperty.call(REGIONS, name) ? name : "prairie"
}

function canonicalSeason(value) {
  var name = String(value || "").toLowerCase()
  return ["spring", "summer", "fall", "winter"].indexOf(name) >= 0 ? name : "spring"
}

function findEntry(config, id) {
  if (!config || !id) return {}
  var layout = config.bar && config.bar.layout
  if (layout) {
    var sections = ["left", "center", "right"]
    for (var sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      var entries = layout[sections[sectionIndex]]
      if (!Array.isArray(entries)) continue
      for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
        if (entries[entryIndex] && entries[entryIndex].id === id) return entries[entryIndex]
      }
    }
  }
  if (Array.isArray(config.plugins)) {
    for (var pluginIndex = 0; pluginIndex < config.plugins.length; pluginIndex++) {
      if (config.plugins[pluginIndex] && config.plugins[pluginIndex].id === id) return config.plugins[pluginIndex]
    }
  }
  return {}
}

function difficultySettings(value) {
  var difficulty = canonicalDifficulty(value)
  if (difficulty === "easy") return { ammo: 30, ticks: 1050, animalSpeed: 0.82 }
  if (difficulty === "hard") return { ammo: 18, ticks: 750, animalSpeed: 1.18 }
  return { ammo: DEFAULT_AMMO, ticks: DEFAULT_TICKS, animalSpeed: 1 }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sameCell(left, right) {
  return Math.round(left.x) === Math.round(right.x) && Math.round(left.y) === Math.round(right.y)
}

function terrainFor(seed) {
  var obstacles = []
  var cursor = normalizedSeed(seed)
  var attempts = 0
  while (obstacles.length < 18 && attempts < 200) {
    attempts += 1
    var xDraw = randomRange(cursor, 2, GRID_WIDTH - 3)
    cursor = xDraw.seed
    var yDraw = randomRange(cursor, 3, GRID_HEIGHT - 3)
    cursor = yDraw.seed
    var x = Math.round(xDraw.value)
    var y = Math.round(yDraw.value)
    if (Math.abs(x - GRID_WIDTH / 2) < 5 && Math.abs(y - GRID_HEIGHT / 2) < 4) continue
    var candidate = { id: "grass-" + obstacles.length, x: x, y: y, size: obstacles.length % 4 === 0 ? 2 : 1 }
    if (obstacles.some(function(obstacle) { return sameCell(obstacle, candidate) })) continue
    obstacles.push(candidate)
  }
  return { seed: cursor, obstacles: obstacles }
}

function animalFor(seed, index, region, obstacles, animals, speedScale) {
  var species = REGIONS[region].species[index % REGIONS[region].species.length]
  var cursor = seed
  var x = 3
  var y = 4
  var attempts = 0
  while (attempts < 80) {
    attempts += 1
    var xDraw = randomRange(cursor, 3, GRID_WIDTH - 4)
    var yDraw = randomRange(xDraw.seed, 4, GRID_HEIGHT - 4)
    cursor = yDraw.seed
    x = Math.round(xDraw.value)
    y = Math.round(yDraw.value)
    var candidate = { x: x, y: y }
    var blocked = obstacles.some(function(obstacle) { return sameCell(obstacle, candidate) })
      || animals.some(function(animal) { return sameCell(animal, candidate) })
      || (Math.abs(x - GRID_WIDTH / 2) < 4 && Math.abs(y - GRID_HEIGHT / 2) < 3)
    if (!blocked) break
  }
  var directionDraw = randomRange(cursor, 0, DIRECTIONS.length)
  var direction = DIRECTIONS[Math.min(DIRECTIONS.length - 1, Math.floor(directionDraw.value))]
  var baseEvery = SPECIES[species].moveEvery
  return {
    seed: directionDraw.seed,
    animal: {
      id: "animal-" + index,
      species: species,
      x: x,
      y: y,
      dx: direction.x,
      dy: direction.y,
      moveEvery: Math.max(1, Math.round(baseEvery / speedScale)),
      alive: true,
      hit: false
    }
  }
}

function createHunt(seed, options) {
  var config = options || {}
  var difficulty = canonicalDifficulty(config.difficulty)
  var region = canonicalRegion(config.region)
  var season = canonicalSeason(config.season)
  var settings = difficultySettings(difficulty)
  var configuredTicks = Math.max(10, Math.round(finiteNumber(config.ticks, settings.ticks)))
  var tickBudget = configuredTicks + (config.assist === true ? 150 : 0)
  var terrain = terrainFor(seed)
  var cursor = terrain.seed
  var animals = []
  for (var index = 0; index < 8; index++) {
    var generated = animalFor(cursor, index, region, terrain.obstacles, animals, settings.animalSpeed)
    cursor = generated.seed
    animals.push(generated.animal)
  }

  return {
    schemaVersion: 1,
    seed: normalizedSeed(seed),
    rngState: cursor,
    phase: "ready",
    profile: canonicalProfile(config.profile),
    difficulty: difficulty,
    region: region,
    season: season,
    visibility: Math.max(8, REGIONS[region].visibility - (season === "winter" ? 3 : 0)),
    assist: config.assist === true,
    assistTimeGranted: config.assist === true,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    tick: 0,
    remainingTicks: tickBudget,
    initialTicks: tickBudget,
    baseTicks: configuredTicks,
    ammo: Math.max(0, Math.round(finiteNumber(config.ammo, settings.ammo))),
    initialAmmo: Math.max(0, Math.round(finiteNumber(config.ammo, settings.ammo))),
    carryCapacity: Math.max(1, Math.round(finiteNumber(config.carryCapacity, DEFAULT_CARRY))),
    carriedPounds: 0,
    wastedPounds: 0,
    shotsFired: 0,
    hits: 0,
    harvestedPounds: 0,
    score: 0,
    cooldownTicks: 0,
    noise: 0,
    returnPending: false,
    result: null,
    hunter: { x: GRID_WIDTH / 2, y: GRID_HEIGHT / 2, stamina: 100 },
    aim: { x: 1, y: 0 },
    animals: animals,
    obstacles: terrain.obstacles,
    message: "Press Enter to begin the hunt"
  }
}

function isBlocked(state, x, y) {
  for (var index = 0; index < state.obstacles.length; index++) {
    var obstacle = state.obstacles[index]
    if (Math.abs(obstacle.x - x) < 0.8 && Math.abs(obstacle.y - y) < 0.8) return true
  }
  return false
}

function moveHunter(state, dx, dy) {
  if (state.phase !== "playing") return state
  var direction = directionFor(dx, dy)
  if (direction.x === 0 && direction.y === 0 || state.hunter.stamina < 1) return state
  var x = clamp(state.hunter.x + direction.x, 1, state.width - 1)
  var y = clamp(state.hunter.y + direction.y, 1, state.height - 1)
  if (!isBlocked(state, x, y)) {
    state.hunter.x = x
    state.hunter.y = y
    state.hunter.stamina = clamp(state.hunter.stamina - 2, 0, 100)
    state.noise = clamp(state.noise + 1, 0, 100)
  }
  return state
}

function directionFor(dx, dy) {
  var x = finiteNumber(dx, 0)
  var y = finiteNumber(dy, 0)
  if (x === 0 && y === 0) return { x: 0, y: 0 }
  var absoluteX = Math.abs(x)
  var absoluteY = Math.abs(y)
  if (absoluteX > absoluteY * 2) return { x: x < 0 ? -1 : 1, y: 0 }
  if (absoluteY > absoluteX * 2) return { x: 0, y: y < 0 ? -1 : 1 }
  return { x: x < 0 ? -1 : 1, y: y < 0 ? -1 : 1 }
}

function setAim(state, dx, dy) {
  if (state.phase !== "playing") return state
  var direction = directionFor(dx, dy)
  if (direction.x === 0 && direction.y === 0) return state
  state.aim = direction
  return state
}

function targetForShot(state) {
  var nearest = null
  var nearestDistance = Infinity
  var assistRadius = state.assist ? 1 : 0
  var directionScale = Math.abs(state.aim.x) + Math.abs(state.aim.y)
  for (var index = 0; index < state.animals.length; index++) {
    var animal = state.animals[index]
    if (!animal.alive) continue
    var offsetX = animal.x - state.hunter.x
    var offsetY = animal.y - state.hunter.y
    var distance = offsetX * state.aim.x + offsetY * state.aim.y
    if (distance < 1 || distance > state.visibility * directionScale) continue
    var perpendicular = Math.abs(offsetX * state.aim.y - offsetY * state.aim.x)
    if (perpendicular <= (SPECIES[animal.species].radius + assistRadius) * directionScale
        && distance < nearestDistance) {
      nearest = animal
      nearestDistance = distance
    }
  }
  return nearest
}

function fire(state) {
  if (state.phase !== "playing") return state
  if (state.ammo <= 0) {
    return settle(state, "ammunition")
  }
  if (state.cooldownTicks > 0) {
    state.message = "Wait before firing again"
    return state
  }

  state.ammo -= 1
  state.shotsFired += 1
  state.cooldownTicks = state.assist ? 3 : 4
  state.noise = clamp(state.noise + 18, 0, 100)
  var target = targetForShot(state)
  if (!target) {
    state.message = state.ammo === 0 ? "The shot missed. You are out of ammunition" : "The shot missed"
    if (state.ammo === 0) settle(state, "ammunition")
    return state
  }

  target.alive = false
  target.hit = true
  state.hits += 1
  var traits = SPECIES[target.species]
  var room = Math.max(0, state.carryCapacity - state.carriedPounds)
  var carried = Math.min(room, traits.yieldPounds)
  var wasted = traits.yieldPounds - carried
  state.harvestedPounds += traits.yieldPounds
  state.carriedPounds += carried
  state.wastedPounds += wasted
  state.score += carried > 0 ? Math.round(traits.points * carried / traits.yieldPounds) + carried : 0
  state.message = carried > 0
    ? "Harvested " + carried + " lb from a " + traits.label
    : "No room left. The harvest was wasted"
  if (state.carriedPounds >= state.carryCapacity) {
    settle(state, "carry")
  } else if (state.ammo === 0) {
    settle(state, "ammunition")
  }
  return state
}

function settle(state, reason) {
  if (state.result) return state
  var region = REGIONS[state.region]
  var seasonSpoilage = state.season === "summer" ? 0.10 : state.season === "winter" ? 0.02 : 0.05
  var spoilagePounds = Math.min(state.carriedPounds, Math.floor(state.carriedPounds * seasonSpoilage))
  var riskDraw = nextRandom(state.rngState)
  state.rngState = riskDraw.seed
  var injury = riskDraw.value * 100 < region.risk
  var energyCost = region.energy + (injury ? 6 : 0)
  state.carriedPounds -= spoilagePounds
  state.wastedPounds += spoilagePounds
  state.score = Math.max(0, state.score - state.wastedPounds)
  state.phase = "complete"
  state.returnPending = false
  state.result = {
    reason: reason,
    harvestedPounds: state.harvestedPounds,
    carriedPounds: state.carriedPounds,
    wastedPounds: state.wastedPounds,
    spoilagePounds: spoilagePounds,
    expeditionDays: region.days,
    partyEnergyCost: energyCost,
    injury: injury,
    riskPercent: region.risk,
    ammoUsed: state.initialAmmo - state.ammo,
    score: state.score
  }
  if (reason === "ammunition") state.message = "Out of ammunition. You return with " + state.carriedPounds + " lb"
  else if (reason === "carry") state.message = "Carry limit reached. You return with " + state.carriedPounds + " lb"
  else if (reason === "time") state.message = "Hunting time is over. You return with " + state.carriedPounds + " lb"
  else state.message = "You return to the wagon with " + state.carriedPounds + " lb"
  state.message += injury
    ? ". Injury occurred at a " + region.risk + "% regional risk"
    : ". No injury at a " + region.risk + "% regional risk"
  return state
}

function moveAnimals(state) {
  for (var index = 0; index < state.animals.length; index++) {
    var animal = state.animals[index]
    if (!animal.alive) continue

    var moveEvery = animal.moveEvery + (state.assist ? 1 : 0)
    if (state.tick % moveEvery !== 0) continue

    if (state.tick % 12 === 0) {
      var turnDraw = randomRange(state.rngState, 0, DIRECTIONS.length)
      state.rngState = turnDraw.seed
      var turn = DIRECTIONS[Math.min(DIRECTIONS.length - 1, Math.floor(turnDraw.value))]
      animal.dx = turn.x
      animal.dy = turn.y
    }

    var nextX = animal.x + animal.dx
    var nextY = animal.y + animal.dy
    if (nextX < 1 || nextX > state.width - 1 || nextY < 2 || nextY > state.height - 1
        || isBlocked(state, nextX, nextY)) {
      animal.dx *= -1
      animal.dy *= -1
    } else {
      animal.x = nextX
      animal.y = nextY
    }
  }
  return state
}

function advanceTick(state) {
  if (state.phase !== "playing") return state
  state.tick += 1
  state.remainingTicks = Math.max(0, state.remainingTicks - 1)
  state.cooldownTicks = Math.max(0, state.cooldownTicks - 1)
  state.hunter.stamina = clamp(state.hunter.stamina + 1, 0, 100)
  state.noise = clamp(state.noise - 1, 0, 100)
  moveAnimals(state)
  if (state.remainingTicks === 0) {
    settle(state, "time")
  }
  return state
}

function dispatch(current, action) {
  var state = clone(current)
  var input = action || {}
  var type = String(input.type || "")

  if (type === "SET_PROFILE") {
    state.profile = canonicalProfile(input.profile)
    return state
  }
  if (type === "SET_ASSIST") {
    var enabling = input.enabled === true
    if (enabling && !state.assistTimeGranted && state.phase !== "complete") {
      state.remainingTicks += 150
      state.initialTicks += 150
      state.assistTimeGranted = true
    }
    state.assist = enabling
    state.message = state.assist ? "Aim assist enabled" : "Aim assist disabled"
    return state
  }
  if (type === "RESTART") return createHunt(input.seed || state.seed, {
    profile: state.profile,
    difficulty: state.difficulty,
    assist: state.assist,
    region: state.region,
    season: state.season,
    ticks: state.baseTicks,
    ammo: state.initialAmmo,
    carryCapacity: state.carryCapacity
  })
  if (type === "START") {
    if (state.phase === "ready" || state.phase === "paused" && !state.returnPending) {
      state.phase = "playing"
      state.message = "Move with WASD. Aim with arrows. Space fires"
    } else if (state.phase === "complete") {
      state.message = "Hunt complete"
    }
    return state
  }
  if (type === "REQUEST_RETURN" && state.phase === "playing") {
    state.returnPending = true
    state.phase = "paused"
    state.message = "Return now? Press Enter to confirm or P to keep hunting"
    return state
  }
  if (type === "FINISH" && state.returnPending && input.confirmed === true) {
    settle(state, "manual")
    return state
  }
  if (type === "PAUSE_TOGGLE") {
    if (state.phase === "playing") {
      state.phase = "paused"
      state.message = "Hunt paused"
    } else if (state.phase === "paused") {
      state.phase = "playing"
      state.returnPending = false
      state.message = "Hunt resumed"
    }
    return state
  }
  if (type === "MOVE") return moveHunter(state, finiteNumber(input.dx, 0), finiteNumber(input.dy, 0))
  if (type === "AIM") return setAim(state, finiteNumber(input.dx, 0), finiteNumber(input.dy, 0))
  if (type === "FIRE") return fire(state)
  if (type === "TICK") return advanceTick(state)
  return state
}

function timeText(state) {
  var seconds = Math.ceil(state.remainingTicks / 10)
  var minutes = Math.floor(seconds / 60)
  var remainder = seconds % 60
  return minutes + ":" + (remainder < 10 ? "0" : "") + remainder
}

function accuracy(state) {
  return state.shotsFired > 0 ? Math.round(state.hits / state.shotsFired * 100) : 0
}

function livingAnimals(state) {
  return state.animals.filter(function(animal) { return animal.alive }).length
}

function semanticSnapshot(state) {
  var copy = clone(state)
  delete copy.profile
  delete copy.message
  return copy
}

function validate(state) {
  var errors = []
  if (!state || typeof state !== "object") return ["state must be an object"]
  if (state.schemaVersion !== 1) errors.push("unsupported schema")
  if (["ready", "playing", "paused", "complete"].indexOf(state.phase) === -1) errors.push("invalid phase")
  var finiteFields = ["rngState", "ammo", "initialAmmo", "carryCapacity", "carriedPounds", "wastedPounds",
    "harvestedPounds", "shotsFired", "hits", "remainingTicks", "initialTicks", "baseTicks", "score", "cooldownTicks"]
  finiteFields.forEach(function(field) {
    if (!Number.isFinite(state[field])) errors.push(field + " must be finite")
  })
  if (!state.hunter || !Number.isFinite(state.hunter.x) || !Number.isFinite(state.hunter.y)
      || !Number.isFinite(state.hunter.stamina)) errors.push("hunter values must be finite")
  if (state.ammo < 0) errors.push("ammo below zero")
  if (state.carriedPounds < 0 || state.carriedPounds > state.carryCapacity) errors.push("carry limit violated")
  if (state.wastedPounds < 0) errors.push("waste below zero")
  if (state.harvestedPounds !== state.carriedPounds + state.wastedPounds) errors.push("harvest conservation violated")
  if (state.hits > state.shotsFired) errors.push("hits exceed shots")
  if (state.remainingTicks < 0 || state.remainingTicks > state.initialTicks) errors.push("timer out of bounds")
  if (state.hunter && (state.hunter.x < 0 || state.hunter.x > state.width || state.hunter.y < 0 || state.hunter.y > state.height))
    errors.push("hunter out of bounds")
  return errors
}

var api = {
  GRID_WIDTH: GRID_WIDTH,
  GRID_HEIGHT: GRID_HEIGHT,
  SPECIES: SPECIES,
  REGIONS: REGIONS,
  normalizedSeed: normalizedSeed,
  nextRandom: nextRandom,
  canonicalProfile: canonicalProfile,
  canonicalDifficulty: canonicalDifficulty,
  canonicalRegion: canonicalRegion,
  canonicalSeason: canonicalSeason,
  findEntry: findEntry,
  difficultySettings: difficultySettings,
  createHunt: createHunt,
  targetForShot: targetForShot,
  directionFor: directionFor,
  settle: settle,
  dispatch: dispatch,
  timeText: timeText,
  accuracy: accuracy,
  livingAnimals: livingAnimals,
  semanticSnapshot: semanticSnapshot,
  validate: validate
}

if (typeof module !== "undefined" && module.exports) module.exports = api
