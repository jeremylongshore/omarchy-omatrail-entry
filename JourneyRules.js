// omaTrail expedition rules.
//
// The route and people are fictional composites. This module contains only
// deterministic state transitions and bounded data. QML owns presentation,
// focus, and persistence I/O.

var SAVE_SCHEMA_VERSION = 1
var MAX_SAVE_BYTES = 65536

var RULE_PROFILES = {
  omatrail: {
    label: "omaTrail",
    year: 1848,
    turnDays: 4,
    startingCash: null,
    fortPriceScale: 1.35,
    minimumHuntAmmo: 1,
    description: "Modern omaTrail balance with four-day travel turns and occupation budgets."
  },
  "classic-1978": {
    label: "Classic 1978-inspired",
    year: 1847,
    turnDays: 14,
    startingCash: 700,
    fortPriceScale: 1.5,
    minimumHuntAmmo: 40,
    description: "Historically informed pressure with two-week turns, fixed cash, costly forts, and scarce ammunition."
  }
}

var OCCUPATIONS = {
  banker: { label: "Banker", budget: 1600, healthBonus: 0, repairBonus: 0 },
  carpenter: { label: "Carpenter", budget: 1000, healthBonus: 0, repairBonus: 12 },
  doctor: { label: "Doctor", budget: 900, healthBonus: 12, repairBonus: 0 },
  farmer: { label: "Farmer", budget: 800, healthBonus: 4, repairBonus: 4 }
}

var ITEMS = {
  oxen: { label: "Oxen", price: 40, step: 2, maximum: 12 },
  food: { label: "Food", price: 1, step: 25, maximum: 1200 },
  ammunition: { label: "Ammunition", price: 2, step: 10, maximum: 300 },
  clothing: { label: "Clothing", price: 12, step: 1, maximum: 20 },
  medicine: { label: "Medicine", price: 18, step: 1, maximum: 20 },
  parts: { label: "Wagon parts", price: 20, step: 1, maximum: 12 }
}

var ACTS = {
  1: { title: "Leaving the Known", theme: "Preparation gives way to open-country decisions." },
  2: { title: "The Long Middle", theme: "Distance, fatigue, and scarce repairs test the party." },
  3: { title: "Last High Country", theme: "Weather and accumulated choices decide who arrives." }
}

var ROUTE = [
  { id: "east-camp", name: "East Camp", mile: 0, act: 1, region: "woodland", type: "fort", story: "The last familiar roofs disappear behind a crowded outfitter yard." },
  { id: "oak-fork", name: "Oak Fork", mile: 92, act: 1, region: "woodland", type: "river", width: 180, depth: 2.2, current: 2, story: "The first crossing asks whether preparation can become judgment." },
  { id: "prairie-gate", name: "Prairie Gate", mile: 210, act: 1, region: "prairie", type: "landmark", story: "Trees fall behind and the horizon opens farther than anyone expected." },
  { id: "reed-fort", name: "Reed Fort", mile: 356, act: 1, region: "prairie", type: "fort", story: "A rough stockade offers repairs, rumors, and one last easy resupply." },
  { id: "wide-water", name: "Wide Water", mile: 522, act: 2, region: "plains", type: "river", width: 410, depth: 4.3, current: 4, story: "Brown water erases the trail and makes every crossing method a wager." },
  { id: "wind-pass", name: "Wind Pass", mile: 690, act: 2, region: "plains", type: "landmark", story: "The wind never stops, and small disagreements begin to sound larger." },
  { id: "stone-fort", name: "Stone Fort", mile: 844, act: 2, region: "plains", type: "fort", story: "Stone walls mark the midpoint, but the mountains now fill the west." },
  { id: "granite-rise", name: "Granite Rise", mile: 1012, act: 2, region: "mountains", type: "landmark", story: "The wagon climbs slowly enough for every loose bolt to announce itself." },
  { id: "snowmelt", name: "Snowmelt Crossing", mile: 1148, act: 3, region: "mountains", type: "river", width: 260, depth: 3.7, current: 5, story: "Cold runoff turns the final river into the route's sharpest test." },
  { id: "dry-channel", name: "Dry Channel", mile: 1304, act: 3, region: "desert", type: "landmark", story: "The empty channel promises water and delivers only white stone." },
  { id: "cedar-fort", name: "Cedar Fort", mile: 1458, act: 3, region: "western-forest", type: "fort", story: "Cedar smoke carries the first scent of the country beyond the pass." },
  { id: "west-valley", name: "West Valley", mile: 1620, act: 3, region: "western-forest", type: "finish", story: "The valley opens below, carrying every survivor and every loss into the ending." }
]

var EVENTS = [
  { id: "evt-fever", category: "illness", eligibility: "care-needed", title: "A fever spreads", text: "One traveler wakes feverish and weak.", choices: ["Use medicine", "Rest and watch", "Keep moving"], effects: ["use-medicine", "rest-recover", "continue-carefully"], source: "fictional-composite", destination: "trail" },
  { id: "evt-axle", category: "breakdown", eligibility: "wagon-worn", title: "The rear axle cracks", text: "The wagon lists toward the trail edge.", choices: ["Use a spare part", "Make a field repair", "Leave cargo"], effects: ["use-part", "field-repair", "discard-food"], source: "fictional-composite", destination: "trail" },
  { id: "evt-storm", category: "weather", eligibility: "always", title: "A hard storm closes in", text: "Wind flattens the grass and darkens the trail.", choices: ["Make camp", "Press on", "Seek lower ground"], effects: ["camp-one-day", "storm-damage", "detour"], source: "fictional-composite", destination: "trail" },
  { id: "evt-trade", category: "trade", eligibility: "trade-stock", title: "A small caravan stops", text: "Another party offers food for ammunition.", choices: ["Trade ammunition", "Decline", "Offer medicine instead"], effects: ["trade-ammunition", "no-effect", "trade-medicine"], source: "fictional-composite", destination: "trail" },
  { id: "evt-aid", category: "aid", eligibility: "always", title: "A wagon needs help", text: "A traveler asks for a spare part before nightfall.", choices: ["Give a part", "Help repair", "Move on"], effects: ["give-part", "help-repair", "no-effect"], source: "fictional-composite", destination: "trail" },
  { id: "evt-dispute", category: "conflict", eligibility: "party-tired", title: "The party disagrees", text: "Fatigue turns a pace decision into an argument.", choices: ["Slow down", "Hear everyone", "Hold the pace"], effects: ["slow-pace", "hear-party", "hold-pace"], source: "fictional-composite", destination: "trail" },
  { id: "evt-fall", category: "injury", eligibility: "fall-risk", title: "A traveler falls", text: "Loose stone gives way beside the wagon.", choices: ["Use medicine", "Rest", "Continue carefully"], effects: ["use-medicine", "rest-recover", "continue-carefully"], source: "fictional-composite", destination: "trail" },
  { id: "evt-view", category: "landmark", eligibility: "always", title: "A long view west", text: "The next ridgeline appears beyond the open country.", choices: ["Record the view", "Scout ahead", "Keep moving"], effects: ["record-view", "scout-ahead", "no-effect"], source: "fictional-composite", destination: "trail" }
]

function finiteNumber(value, fallback) {
  var number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function cleanText(value, maximum) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .slice(0, maximum)
}

function normalizedSeed(value) {
  var seed = Math.floor(Math.abs(finiteNumber(value, 1))) >>> 0
  return seed === 0 ? 1 : seed
}

function draw(seed) {
  var next = (Math.imul(normalizedSeed(seed), 1664525) + 1013904223) >>> 0
  return { seed: next, value: next / 4294967296 }
}

function canonicalDifficulty(value) {
  var name = String(value || "").toLowerCase()
  return name === "easy" || name === "hard" ? name : "normal"
}

function canonicalRulesProfile(value) {
  var name = String(value || "").toLowerCase()
  return name === "classic" || name === "classic-1978" || name.indexOf("classic 1978") === 0
    ? "classic-1978" : "omatrail"
}

function rulesProfileLabel(value) {
  return RULE_PROFILES[canonicalRulesProfile(value)].label
}

function canonicalOccupation(value) {
  var name = String(value || "").toLowerCase()
  return Object.prototype.hasOwnProperty.call(OCCUPATIONS, name) ? name : "farmer"
}

function canonicalPace(value) {
  var name = String(value || "").toLowerCase()
  return ["steady", "strenuous", "grueling"].indexOf(name) >= 0 ? name : "steady"
}

function canonicalRations(value) {
  var name = String(value || "").toLowerCase()
  return ["filling", "meager", "bare"].indexOf(name) >= 0 ? name : "filling"
}

function partyNames(values) {
  var defaults = ["Alex", "Morgan", "Sam", "River", "Casey"]
  var source = Array.isArray(values) ? values : []
  return defaults.map(function(fallback, index) {
    return cleanText(source[index], 24).trim() || fallback
  })
}

function createParty(names, healthBonus) {
  return partyNames(names).map(function(name, index) {
    return {
      id: "party-" + (index + 1),
      name: name,
      health: clamp(82 + healthBonus, 1, 100),
      fatigue: 0,
      morale: 75,
      condition: "well",
      alive: true
    }
  })
}

function updateMemberCondition(state, member, reason) {
  if (!member.alive) return member
  if (member.health <= 0) {
    member.health = 0
    member.alive = false
    member.condition = "lost"
    state.losses.push({
      id: member.id,
      name: member.name,
      day: state.day,
      reason: reason || "illness and exhaustion"
    })
  } else if (member.health < 25) member.condition = "critical"
  else if (member.health < 50) member.condition = "poor"
  else member.condition = "well"
  return member
}

function emptyInventory() {
  return { oxen: 0, food: 0, ammunition: 0, clothing: 0, medicine: 0, parts: 0 }
}

function createJourney(options) {
  var config = options || {}
  var occupation = canonicalOccupation(config.occupation)
  var difficulty = canonicalDifficulty(config.difficulty)
  var rulesProfile = canonicalRulesProfile(config.rulesProfile)
  var profileRules = RULE_PROFILES[rulesProfile]
  var occupationRules = OCCUPATIONS[occupation]
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: "0.1.0",
    phase: "store",
    seed: normalizedSeed(config.seed),
    rngState: normalizedSeed(config.seed),
    profile: String(config.profile || "").toLowerCase().indexOf("color") === 0 ? "color" : "green",
    rulesProfile: rulesProfile,
    difficulty: difficulty,
    occupation: occupation,
    departureMonth: clamp(Math.round(finiteNumber(config.departureMonth, 4)), 3, 6),
    day: 1,
    month: clamp(Math.round(finiteNumber(config.departureMonth, 4)), 3, 6),
    year: profileRules.year,
    miles: 0,
    targetIndex: 1,
    act: 1,
    region: "woodland",
    pace: "steady",
    rations: "filling",
    cash: profileRules.startingCash === null ? occupationRules.budget : profileRules.startingCash,
    inventory: emptyInventory(),
    party: createParty(config.names, occupationRules.healthBonus),
    wagonCondition: clamp(88 + occupationRules.repairBonus, 1, 100),
    oxenCondition: 90,
    weather: "mild",
    temperature: 62,
    pendingEvent: null,
    eventHistory: [],
    river: null,
    riverResult: null,
    daysRested: 0,
    hunts: 0,
    lastHuntMile: -1,
    harvestedPounds: 0,
    wastedPounds: 0,
    losses: [],
    flags: {},
    message: "Buy supplies before leaving East Camp",
    ending: null,
    huntSeed: null
  }
}

function itemKeys() {
  return Object.keys(ITEMS)
}

function totalPartyHealth(state) {
  var living = state.party.filter(function(member) { return member.alive })
  if (!living.length) return 0
  return Math.round(living.reduce(function(total, member) { return total + member.health }, 0) / living.length)
}

function livingParty(state) {
  return state.party.filter(function(member) { return member.alive }).length
}

function averageFatigue(state) {
  var living = state.party.filter(function(member) { return member.alive })
  if (!living.length) return 100
  return Math.round(living.reduce(function(total, member) { return total + member.fatigue }, 0) / living.length)
}

function illnessRiskPercent(state, member) {
  var traveler = member || state.party.find(function(candidate) { return candidate.alive })
  if (!traveler) return 100
  var severeWeather = ["snow", "cold", "storm", "hot"].indexOf(state.weather) >= 0 ? 8 : 0
  var rationRisk = state.rations === "bare" ? 12 : state.rations === "meager" ? 5 : 0
  var difficultyRisk = state.difficulty === "hard" ? 8 : state.difficulty === "easy" ? -5 : 0
  var doctorProtection = state.occupation === "doctor" ? 8 : 0
  var medicineProtection = Math.min(10, state.inventory.medicine)
  return clamp(Math.round(8 + (100 - traveler.health) * 0.30 + traveler.fatigue * 0.15
    + severeWeather + rationRisk + difficultyRisk - doctorProtection - medicineProtection), 2, 85)
}

function recoveryChancePercent(state, member, treatment) {
  var traveler = member || state.party.find(function(candidate) { return candidate.alive })
  if (!traveler) return 0
  var careBonus = treatment === "medicine" ? 30 : treatment === "rest" ? 16 : 0
  var doctorBonus = state.occupation === "doctor" ? 12 : 0
  var difficultyPenalty = state.difficulty === "hard" ? 8 : state.difficulty === "easy" ? -5 : 0
  return clamp(Math.round(28 + traveler.health * 0.30 + (100 - traveler.fatigue) * 0.12
    + careBonus + doctorBonus - difficultyPenalty), 5, 95)
}

function minimumHuntAmmo(state) {
  return RULE_PROFILES[canonicalRulesProfile(state && state.rulesProfile)].minimumHuntAmmo
}

function canHunt(state) {
  if (!state || (state.phase !== "trail" && state.phase !== "landmark")) return false
  if (state.inventory.ammunition < minimumHuntAmmo(state)) return false
  return state.rulesProfile !== "classic-1978" || state.lastHuntMile !== state.miles
}

function purchaseCost(state, itemName, steps) {
  if (!Object.prototype.hasOwnProperty.call(ITEMS, itemName)) return 0
  var count = Math.max(1, Math.min(20, Math.round(finiteNumber(steps, 1))))
  var priceScale = state && state.miles > 0
    ? RULE_PROFILES[canonicalRulesProfile(state.rulesProfile)].fortPriceScale : 1
  return Math.ceil(ITEMS[itemName].price * count * priceScale)
}

function buy(state, itemName, steps) {
  if (state.phase !== "store" && !(state.phase === "landmark" && ROUTE[state.targetIndex].type === "fort")) return state
  if (!Object.prototype.hasOwnProperty.call(ITEMS, itemName)) return state
  var item = ITEMS[itemName]
  var count = Math.max(1, Math.min(20, Math.round(finiteNumber(steps, 1))))
  var quantity = item.step * count
  var cost = purchaseCost(state, itemName, count)
  if (cost > state.cash || state.inventory[itemName] + quantity > item.maximum) {
    state.message = "That purchase does not fit the budget or wagon"
    return state
  }
  state.cash -= cost
  state.inventory[itemName] += quantity
  state.message = "Added " + quantity + " " + item.label.toLowerCase()
  return state
}

function sell(state, itemName, steps) {
  if (state.phase !== "store" && !(state.phase === "landmark" && ROUTE[state.targetIndex].type === "fort")) return state
  if (!Object.prototype.hasOwnProperty.call(ITEMS, itemName)) return state
  var item = ITEMS[itemName]
  var count = Math.max(1, Math.min(20, Math.round(finiteNumber(steps, 1))))
  var quantity = item.step * count
  if (state.inventory[itemName] < quantity) return state
  state.inventory[itemName] -= quantity
  state.cash += Math.max(1, Math.floor(item.price * count * 0.6))
  state.message = "Returned " + quantity + " " + item.label.toLowerCase()
  return state
}

function canDepart(state) {
  var minimumAmmo = minimumHuntAmmo(state)
  return state.inventory.oxen >= 2 && state.inventory.food >= 100
    && state.inventory.ammunition >= minimumAmmo && state.inventory.clothing >= livingParty(state)
}

function seasonFor(month) {
  if (month <= 5) return "spring"
  if (month <= 8) return "summer"
  if (month <= 10) return "fall"
  return "winter"
}

function weatherFor(state) {
  var first = draw(state.rngState)
  state.rngState = first.seed
  var season = seasonFor(state.month)
  var weather
  if (season === "winter") weather = first.value < 0.45 ? "snow" : first.value < 0.78 ? "cold" : "clear"
  else if (season === "summer") weather = first.value < 0.22 ? "storm" : first.value < 0.62 ? "hot" : "clear"
  else weather = first.value < 0.25 ? "rain" : first.value < 0.45 ? "wind" : "mild"
  var temperatures = { snow: 24, cold: 36, clear: season === "summer" ? 82 : 61, storm: 67, hot: 94, rain: 52, wind: 58, mild: 64 }
  state.weather = weather
  state.temperature = temperatures[weather]
  return state
}

function foodPerPerson(rations) {
  return rations === "bare" ? 1 : rations === "meager" ? 2 : 3
}

function paceMiles(pace) {
  return pace === "grueling" ? 22 : pace === "strenuous" ? 18 : 14
}

function healthDelta(state, member) {
  var delta = state.rations === "filling" ? 1 : state.rations === "meager" ? -1 : -3
  if (state.difficulty === "easy") delta += 1
  if (state.difficulty === "hard") delta -= 1
  if (state.pace === "strenuous") delta -= 2
  if (state.pace === "grueling") delta -= 5
  if (["snow", "cold", "storm", "hot"].indexOf(state.weather) >= 0) delta -= 2
  if (state.inventory.food <= 0) delta -= 8
  if (member.condition !== "well") delta -= 2
  return delta
}

function updateCalendar(state, days) {
  state.day += days
  while (state.day > 30) {
    state.day -= 30
    state.month += 1
    if (state.month > 12) {
      state.month = 1
      state.year += 1
    }
  }
  return state
}

function applyPartyTravel(state, days) {
  var alive = livingParty(state)
  var classicRations = state.rations === "bare" ? 13 : state.rations === "meager" ? 18 : 23
  var neededFood = state.rulesProfile === "classic-1978"
    ? Math.ceil(classicRations * alive / 5) : alive * foodPerPerson(state.rations) * days
  var pressureScale = state.rulesProfile === "classic-1978" ? Math.max(1, Math.round(days / 7)) : 1
  state.inventory.food = Math.max(0, state.inventory.food - neededFood)
  state.party.forEach(function(member) {
    if (!member.alive) return
    member.health = clamp(member.health + healthDelta(state, member) * pressureScale, 0, 100)
    member.fatigue = clamp(member.fatigue
      + (state.pace === "steady" ? 3 : state.pace === "strenuous" ? 7 : 12) * pressureScale, 0, 100)
    member.morale = clamp(member.morale + (state.rations === "filling" ? 1 : -2) * pressureScale, 0, 100)
    updateMemberCondition(state, member, "illness and exhaustion")
  })
  return state
}

function eventEligible(state, event) {
  if (event.eligibility === "wagon-worn" && state.wagonCondition > 88) return false
  if (event.eligibility === "trade-stock" && state.inventory.ammunition < 10 && state.inventory.medicine < 1) return false
  if (event.eligibility === "care-needed" && illnessRiskPercent(state) < 12) return false
  if (event.eligibility === "party-tired" && averageFatigue(state) < 10) return false
  if (event.eligibility === "fall-risk" && state.region !== "mountains" && averageFatigue(state) < 18) return false
  return state.eventHistory.indexOf(event.id) === -1
}

function eventChoiceAvailable(state, event, index) {
  if (!event || !Array.isArray(event.effects) || index < 0 || index >= event.effects.length) return false
  var effect = event.effects[index]
  if (effect === "use-medicine" || effect === "trade-medicine") return state.inventory.medicine > 0
  if (effect === "use-part" || effect === "give-part") return state.inventory.parts > 0
  if (effect === "trade-ammunition") return state.inventory.ammunition >= 10
  return true
}

function chooseEvent(state) {
  var eligible = EVENTS.filter(function(event) { return eventEligible(state, event) })
  if (!eligible.length) return null
  var chance = draw(state.rngState)
  state.rngState = chance.seed
  var eventChance = state.difficulty === "easy" ? 0.22 : state.difficulty === "hard" ? 0.38 : 0.30
  if (state.rulesProfile === "classic-1978") eventChance = state.difficulty === "easy" ? 0.48 : state.difficulty === "hard" ? 0.68 : 0.58
  if (chance.value >= eventChance) return null
  var selection = draw(state.rngState)
  state.rngState = selection.seed
  if (state.rulesProfile !== "classic-1978")
    return clone(eligible[Math.min(eligible.length - 1, Math.floor(selection.value * eligible.length))])
  var weights = { illness: 16, breakdown: 18, weather: 20, trade: 8, aid: 6, conflict: 10, injury: 16, landmark: 6 }
  var totalWeight = eligible.reduce(function(total, event) { return total + weights[event.category] }, 0)
  var weightedRoll = selection.value * totalWeight
  for (var index = 0; index < eligible.length; index++) {
    weightedRoll -= weights[eligible[index].category]
    if (weightedRoll < 0) return clone(eligible[index])
  }
  return clone(eligible[eligible.length - 1])
}

function arriveAtTarget(state) {
  var target = ROUTE[state.targetIndex]
  state.miles = target.mile
  state.act = target.act
  state.region = target.region
  if (target.type === "finish") return finishJourney(state, "arrival")
  if (target.type === "river") {
    state.phase = "river"
    state.river = riverContext(state, target)
    state.message = "Choose how to cross " + target.name
  } else {
    state.phase = "landmark"
    state.message = "You reached " + target.name
  }
  return state
}

function travel(state) {
  if (state.phase !== "trail") return state
  if (livingParty(state) === 0) return finishJourney(state, "loss")
  if (state.inventory.oxen < 2 || state.wagonCondition <= 0) return finishJourney(state, "loss")

  var days = RULE_PROFILES[state.rulesProfile].turnDays
  weatherFor(state)
  var terrainFactor = state.region === "mountains" ? 0.68 : state.region === "desert" ? 0.82 : 1
  var conditionFactor = Math.max(0.45, Math.min(state.wagonCondition, state.oxenCondition) / 100)
  var distance
  if (state.rulesProfile === "classic-1978") {
    var trailVariation = draw(state.rngState)
    state.rngState = trailVariation.seed
    var paceBonus = state.pace === "grueling" ? 40 : state.pace === "strenuous" ? 20 : 0
    var classicMiles = 150 + state.inventory.oxen * 8 + paceBonus + Math.floor(trailVariation.value * 25)
    distance = Math.max(40, Math.round(classicMiles * terrainFactor * conditionFactor))
  } else distance = Math.max(12, Math.round(paceMiles(state.pace) * days * terrainFactor * conditionFactor))
  updateCalendar(state, days)
  applyPartyTravel(state, days)
  state.miles = Math.min(ROUTE[ROUTE.length - 1].mile, state.miles + distance)
  var wearScale = state.rulesProfile === "classic-1978" ? 4 : 1
  state.oxenCondition = clamp(state.oxenCondition
    - (state.pace === "grueling" ? 4 : state.pace === "strenuous" ? 2 : 1) * wearScale, 0, 100)

  var wear = draw(state.rngState)
  state.rngState = wear.seed
  var wearChance = state.difficulty === "easy" ? 0.12 : state.difficulty === "hard" ? 0.26 : 0.18
  var heavyWear = state.difficulty === "easy" ? 4 : state.difficulty === "hard" ? 8 : 6
  state.wagonCondition = clamp(state.wagonCondition - (wear.value < wearChance ? heavyWear : 1) * wearScale, 0, 100)

  if (livingParty(state) === 0 || state.wagonCondition === 0 || state.oxenCondition === 0)
    return finishJourney(state, "loss")
  if (state.miles >= ROUTE[state.targetIndex].mile) return arriveAtTarget(state)

  var event = chooseEvent(state)
  if (event) {
    state.pendingEvent = event
    state.phase = "event"
    state.message = event.title
  } else {
    state.message = "Traveled " + distance + " miles through " + state.weather + " weather"
  }
  return state
}

function eventChoice(state, choiceIndex) {
  if (state.phase !== "event" || !state.pendingEvent) return state
  var event = state.pendingEvent
  var index = clamp(Math.round(finiteNumber(choiceIndex, 0)), 0, event.choices.length - 1)
  if (!eventChoiceAvailable(state, event, index)) {
    state.message = "That choice needs supplies the party does not have"
    return state
  }
  var effect = event.effects[index]
  var member = state.party.find(function(candidate) { return candidate.alive })
  if (event.category === "illness" || event.category === "injury") {
    var treatment = effect === "use-medicine" && state.inventory.medicine > 0 ? "medicine"
      : effect === "rest-recover" ? "rest" : "continue"
    if (treatment === "medicine") {
      state.inventory.medicine -= 1
    } else if (treatment === "rest") {
      updateCalendar(state, 2)
    }
    var outcome = draw(state.rngState)
    state.rngState = outcome.seed
    var risk = illnessRiskPercent(state, member)
    var recovery = recoveryChancePercent(state, member, treatment)
    var recovered = outcome.value * 100 < clamp(recovery - Math.round(risk * 0.25), 5, 95)
    if (member) member.health = clamp(member.health + (recovered
      ? treatment === "medicine" ? 10 : treatment === "rest" ? 5 : 1
      : treatment === "continue" ? -12 : -5), 0, 100)
    if (member) updateMemberCondition(state, member, event.category)
    state.message = member ? member.name + (recovered ? " begins to recover" : " grows weaker") : "The party continues"
  } else if (effect === "use-part") {
    if (state.inventory.parts > 0) {
      state.inventory.parts -= 1
      state.wagonCondition = clamp(state.wagonCondition + 24, 0, 100)
    }
    state.message = "A spare part steadies the wagon"
  } else if (effect === "field-repair") {
    state.wagonCondition = clamp(state.wagonCondition + 10 + OCCUPATIONS[state.occupation].repairBonus, 0, 100)
    state.message = "The field repair holds"
  } else if (effect === "discard-food") {
    state.inventory.food = Math.max(0, state.inventory.food - 40)
    state.message = "Cargo is left beside the trail"
  } else if (effect === "trade-ammunition" && state.inventory.ammunition >= 10) {
    state.inventory.ammunition -= 10
    state.inventory.food = Math.min(ITEMS.food.maximum, state.inventory.food + 70)
    state.message = "Ten rounds buy seventy pounds of food"
  } else if (effect === "trade-medicine" && state.inventory.medicine > 0) {
    state.inventory.medicine -= 1
    state.inventory.food = Math.min(ITEMS.food.maximum, state.inventory.food + 45)
    state.message = "Medicine buys forty-five pounds of food"
  } else if (effect === "give-part" || effect === "help-repair") {
    if (effect === "give-part" && state.inventory.parts > 0) state.inventory.parts -= 1
    state.party.forEach(function(person) { if (person.alive) person.morale = clamp(person.morale + 6, 0, 100) })
    state.flags.helpedTraveler = true
    state.message = "Helping another wagon lifts the party"
  } else if (effect === "slow-pace") {
    state.pace = "steady"
    state.party.forEach(function(person) { if (person.alive) person.morale = clamp(person.morale - 4, 0, 100) })
    state.message = "The party agrees to slow down"
  } else if (effect === "hear-party") {
    state.party.forEach(function(person) { if (person.alive) person.morale = clamp(person.morale + 5, 0, 100) })
    state.message = "Being heard settles the disagreement"
  } else if (effect === "hold-pace") {
    state.party.forEach(function(person) { if (person.alive) person.morale = clamp(person.morale - 4, 0, 100) })
    state.message = "The pace holds and tempers remain short"
  } else if (effect === "camp-one-day") {
    updateCalendar(state, 1)
    state.message = "Camp holds until the storm passes"
  } else if (effect === "storm-damage") {
    state.wagonCondition = clamp(state.wagonCondition - 8, 0, 100)
    state.message = "The wagon takes eight points of storm damage"
  } else if (effect === "detour") {
    state.miles = Math.max(0, state.miles - 8)
    state.message = "Lower ground costs eight miles"
  } else if (effect === "scout-ahead") {
    state.flags.scoutedAhead = true
    state.message = "The scout marks the next stretch"
  } else if (effect === "record-view") {
    state.message = "The view is recorded in the trail journal"
  } else {
    state.message = "The party declines and continues"
  }
  state.eventHistory.push(event.id)
  state.pendingEvent = null
  state.phase = event.destination
  return state
}

function riverContext(state, stop) {
  var recentWeather = state.weather
  var depth = stop.depth + (recentWeather === "rain" || recentWeather === "storm" ? 0.8 : 0)
  var ferryPrice = Math.ceil(18 + stop.width / 30)
  var options = ["float", "wait"]
  if (depth <= 3) options.unshift("ford")
  if (state.cash >= ferryPrice) options.push("ferry")
  if (state.cash >= Math.ceil(ferryPrice * 0.6)) options.push("guide")
  return {
    id: stop.id,
    name: stop.name,
    width: stop.width,
    depth: Math.round(depth * 10) / 10,
    current: stop.current,
    weather: recentWeather,
    wagonCondition: state.wagonCondition,
    partyHealth: totalPartyHealth(state),
    ferryPrice: ferryPrice,
    options: options
  }
}

function resolveRiver(state, choice) {
  if (state.phase !== "river" || !state.river) return state
  var option = String(choice || "")
  if (state.river.options.indexOf(option) === -1) {
    state.message = "That crossing option is not available"
    return state
  }
  if (option === "wait") {
    updateCalendar(state, 2)
    applyPartyTravel(state, 2)
    state.river.depth = Math.max(1, Math.round((state.river.depth - 0.4) * 10) / 10)
    state.message = "The water falls while the party waits"
    return state
  }

  var baseRisk = state.river.depth * 8 + state.river.current * 5 + (100 - state.wagonCondition) * 0.22
  baseRisk *= state.difficulty === "easy" ? 0.8 : state.difficulty === "hard" ? 1.2 : 1
  if (option === "ford") baseRisk += 8
  if (option === "float") baseRisk -= 4
  if (option === "ferry") {
    state.cash -= state.river.ferryPrice
    baseRisk = 3
  }
  if (option === "guide") {
    state.cash -= Math.ceil(state.river.ferryPrice * 0.6)
    baseRisk *= 0.45
  }
  var roll = draw(state.rngState)
  state.rngState = roll.seed
  var failed = roll.value * 100 < clamp(baseRisk, 2, 80)
  var foodLost = failed ? Math.min(state.inventory.food, Math.ceil(state.river.width / 18)) : 0
  var wagonDamage = failed ? 12 : 2
  state.inventory.food -= foodLost
  state.wagonCondition = clamp(state.wagonCondition - wagonDamage, 0, 100)
  state.riverResult = {
    choice: option,
    success: !failed,
    foodLost: foodLost,
    wagonDamage: wagonDamage,
    explanation: failed
      ? "Depth, current, and wagon condition made the crossing difficult"
      : "The chosen method matched the visible river conditions"
  }
  state.phase = "river-result"
  state.message = failed ? "The wagon takes water" : "The wagon reaches the far bank"
  return state
}

function leaveStop(state) {
  if (state.phase !== "landmark" && state.phase !== "river-result") return state
  state.targetIndex += 1
  state.river = null
  state.riverResult = null
  state.phase = "trail"
  state.message = "The trail continues toward " + ROUTE[state.targetIndex].name
  return state
}

function rest(state) {
  if (state.phase !== "trail" && state.phase !== "landmark") return state
  updateCalendar(state, 2)
  state.daysRested += 2
  var foodCost = livingParty(state) * foodPerPerson(state.rations) * 2
  var fed = state.inventory.food >= foodCost
  state.inventory.food = Math.max(0, state.inventory.food - foodCost)
  state.party.forEach(function(member) {
    if (!member.alive) return
    member.health = clamp(member.health + (fed ? 6 : -8), 0, 100)
    member.fatigue = clamp(member.fatigue - (fed ? 18 : 4), 0, 100)
    updateMemberCondition(state, member, "hunger in camp")
  })
  state.oxenCondition = clamp(state.oxenCondition + (fed ? 5 : 1), 0, 100)
  if (livingParty(state) === 0) return finishJourney(state, "loss")
  state.message = fed ? "The party rests for two days" : "Rest without food weakens the party"
  return state
}

function repair(state) {
  if (state.phase !== "trail" && state.phase !== "landmark") return state
  if (state.inventory.parts <= 0 || state.wagonCondition >= 100) {
    state.message = state.inventory.parts <= 0 ? "No wagon parts remain" : "The wagon needs no repair"
    return state
  }
  state.inventory.parts -= 1
  state.wagonCondition = clamp(state.wagonCondition + 25 + OCCUPATIONS[state.occupation].repairBonus, 0, 100)
  state.message = "The party repairs the wagon"
  return state
}

function beginHunt(state) {
  if (state.phase !== "trail" && state.phase !== "landmark") return state
  var requiredAmmo = minimumHuntAmmo(state)
  if (state.inventory.ammunition < requiredAmmo) {
    state.message = state.rulesProfile === "classic-1978"
      ? "Classic hunting needs at least 40 rounds" : "No ammunition remains"
    return state
  }
  if (state.rulesProfile === "classic-1978" && state.lastHuntMile === state.miles) {
    state.message = "Classic hunting is available again after traveling"
    return state
  }
  var seedDraw = draw(state.rngState)
  state.rngState = seedDraw.seed
  state.phase = "hunt"
  state.huntSeed = seedDraw.seed
  state.message = "The party prepares to hunt"
  return state
}

function applyHuntResult(state, result) {
  if (state.phase !== "hunt" || !result || typeof result !== "object") return state
  var ammoUsed = clamp(Math.round(finiteNumber(result.ammoUsed, 0)), 0, state.inventory.ammunition)
  var reportedCarried = clamp(Math.round(finiteNumber(result.carriedPounds, 0)), 0, 200)
  var classicCarryLimit = state.rulesProfile === "classic-1978" ? 100 : 200
  var carried = Math.min(reportedCarried, classicCarryLimit)
  var wasted = Math.max(0, Math.round(finiteNumber(result.wastedPounds, 0))) + Math.max(0, reportedCarried - carried)
  var days = clamp(Math.round(finiteNumber(result.expeditionDays, 1)), 1, 2)
  var energy = clamp(Math.round(finiteNumber(result.partyEnergyCost, 8)), 0, 25)
  var injury = result.injury === true
  var riskPercent = clamp(Math.round(finiteNumber(result.riskPercent, 0)), 0, 100)
  state.inventory.ammunition -= ammoUsed
  state.inventory.food = Math.min(1200, state.inventory.food + carried)
  state.hunts += 1
  if (state.rulesProfile === "classic-1978") state.lastHuntMile = state.miles
  state.harvestedPounds += carried + wasted
  state.wastedPounds += wasted
  updateCalendar(state, days)
  state.party.forEach(function(member) {
    if (member.alive) member.fatigue = clamp(member.fatigue + energy, 0, 100)
  })
  var injuredMember = injury ? state.party.find(function(member) { return member.alive }) : null
  if (injuredMember) {
    injuredMember.health = clamp(injuredMember.health - 12, 0, 100)
    updateMemberCondition(state, injuredMember, "hunting injury")
  }
  state.phase = "trail"
  state.huntSeed = null
  state.message = "The hunt adds " + carried + " lb of food"
    + (injuredMember ? ". " + injuredMember.name + " was injured (" + riskPercent + "% regional risk)"
      : ". No hunting injury (" + riskPercent + "% regional risk)")
  return state
}

function scoreJourney(state) {
  var survivors = livingParty(state)
  var resourceScore = Math.round(state.inventory.food / 5 + state.inventory.ammunition + state.cash / 4)
  var healthScore = totalPartyHealth(state) * survivors
  var timePenalty = Math.max(0, state.month * 30 + state.day - 120)
  var difficultyScale = state.difficulty === "hard" ? 1.35 : state.difficulty === "easy" ? 0.80 : 1
  return Math.max(0, Math.round((survivors * 300 + healthScore + resourceScore - state.wastedPounds - timePenalty) * difficultyScale))
}

function journeyDurationDays(state) {
  var departureYear = RULE_PROFILES[state.rulesProfile].year
  return Math.max(0, (state.year - departureYear) * 360 + (state.month - state.departureMonth) * 30 + state.day - 1)
}

function finishJourney(state, reason) {
  state.phase = reason === "arrival" ? "victory" : "loss"
  state.ending = {
    reason: reason,
    survivors: state.party.filter(function(member) { return member.alive }).map(function(member) { return member.name }),
    losses: clone(state.losses),
    durationDays: journeyDurationDays(state),
    month: state.month,
    day: state.day,
    difficulty: state.difficulty,
    rulesProfile: state.rulesProfile,
    resources: clone(state.inventory),
    wastedPounds: state.wastedPounds,
    score: scoreJourney(state),
    seed: state.seed
  }
  state.message = reason === "arrival" ? "The party reaches West Valley" : "The expedition can go no farther"
  return state
}

function dispatch(current, action) {
  var state = clone(current)
  var input = action || {}
  var type = String(input.type || "")
  if (type === "BUY") return buy(state, String(input.item || ""), input.steps)
  if (type === "SELL") return sell(state, String(input.item || ""), input.steps)
  if (type === "DEPART") {
    if (!canDepart(state)) {
      state.message = "Departure needs 2 oxen, 100 food, " + minimumHuntAmmo(state)
        + " ammunition, and one coat per traveler"
      return state
    }
    state.phase = "trail"
    state.message = "The wagon leaves East Camp"
    return state
  }
  if (type === "SET_PACE") { state.pace = canonicalPace(input.value); return state }
  if (type === "SET_RATIONS") { state.rations = canonicalRations(input.value); return state }
  if (type === "SET_PROFILE") { state.profile = String(input.value || "").toLowerCase().indexOf("color") === 0 ? "color" : "green"; return state }
  if (type === "TRAVEL") return travel(state)
  if (type === "REST") return rest(state)
  if (type === "REPAIR") return repair(state)
  if (type === "BEGIN_HUNT") return beginHunt(state)
  if (type === "APPLY_HUNT_RESULT") return applyHuntResult(state, input.result)
  if (type === "EVENT_CHOICE") return eventChoice(state, input.index)
  if (type === "RIVER_CHOICE") return resolveRiver(state, input.choice)
  if (type === "LEAVE_STOP") return leaveStop(state)
  if (type === "ABANDON" && input.confirmed === true) return finishJourney(state, "abandoned")
  return state
}

function validateEventRecords() {
  var errors = []
  var ids = {}
  EVENTS.forEach(function(event) {
    if (!event.id || ids[event.id]) errors.push("event id must be unique")
    ids[event.id] = true
    if (!event.category || !event.title || !event.text) errors.push(event.id + " lacks content")
    if (["always", "wagon-worn", "trade-stock", "care-needed", "party-tired", "fall-risk"].indexOf(event.eligibility) === -1)
      errors.push(event.id + " has invalid eligibility")
    if (!Array.isArray(event.choices) || event.choices.length < 2) errors.push(event.id + " lacks choices")
    if (!Array.isArray(event.effects) || event.effects.length !== event.choices.length
      || event.effects.some(function(effect) { return typeof effect !== "string" || !effect || effect.length > 40 }))
      errors.push(event.id + " has invalid effects")
    if (event.source !== "fictional-composite") errors.push(event.id + " has invalid source")
    if (event.destination !== "trail") errors.push(event.id + " has invalid destination")
    if (event.title.length > 80 || event.text.length > 240) errors.push(event.id + " exceeds text bounds")
  })
  return errors
}

function validate(state) {
  var errors = []
  if (!state || typeof state !== "object") return ["state must be an object"]
  if (state.schemaVersion !== SAVE_SCHEMA_VERSION) errors.push("unsupported save schema")
  if (state.gameVersion !== "0.1.0") errors.push("unsupported game version")
  var phases = ["store", "trail", "landmark", "event", "river", "river-result", "hunt", "victory", "loss"]
  if (phases.indexOf(state.phase) === -1) errors.push("invalid phase")
  var numeric = ["seed", "rngState", "day", "month", "year", "miles", "targetIndex", "act", "cash", "wagonCondition", "oxenCondition", "temperature", "daysRested", "hunts", "lastHuntMile", "harvestedPounds", "wastedPounds"]
  numeric.forEach(function(field) { if (!Number.isFinite(state[field])) errors.push(field + " must be finite") })
  var integerFields = ["seed", "rngState", "day", "month", "year", "miles", "targetIndex", "act", "cash", "wagonCondition", "oxenCondition", "temperature", "daysRested", "hunts", "lastHuntMile", "harvestedPounds", "wastedPounds"]
  integerFields.forEach(function(field) {
    if (Number.isFinite(state[field]) && !Number.isInteger(state[field])) errors.push(field + " must be an integer")
  })
  if (!Number.isInteger(state.seed) || state.seed < 1 || state.seed > 0xffffffff
    || !Number.isInteger(state.rngState) || state.rngState < 1 || state.rngState > 0xffffffff)
    errors.push("seed state is invalid")
  if (!Number.isInteger(state.day) || state.day < 1 || state.day > 30
    || !Number.isInteger(state.month) || state.month < 1 || state.month > 12
    || !Number.isInteger(state.year) || state.year < 1847 || state.year > 1900)
    errors.push("calendar is invalid")
  if (state.profile !== "green" && state.profile !== "color") errors.push("profile is invalid")
  if (state.rulesProfile !== canonicalRulesProfile(state.rulesProfile)) errors.push("rules profile is invalid")
  if (state.difficulty !== canonicalDifficulty(state.difficulty)) errors.push("difficulty is invalid")
  if (!Object.prototype.hasOwnProperty.call(OCCUPATIONS, state.occupation)) errors.push("occupation is invalid")
  if (state.pace !== canonicalPace(state.pace)) errors.push("pace is invalid")
  if (state.rations !== canonicalRations(state.rations)) errors.push("rations are invalid")
  if (["woodland", "prairie", "plains", "mountains", "desert", "western-forest"].indexOf(state.region) === -1)
    errors.push("region is invalid")
  var weatherNames = ["mild", "snow", "cold", "clear", "storm", "hot", "rain", "wind"]
  if (weatherNames.indexOf(state.weather) === -1 || !Number.isInteger(state.temperature)
    || state.temperature < -80 || state.temperature > 140) errors.push("weather is invalid")
  if (!Number.isInteger(state.departureMonth) || state.departureMonth < 3 || state.departureMonth > 6)
    errors.push("departure month is invalid")
  if (typeof state.message !== "string" || state.message.length > 240 || cleanText(state.message, 240) !== state.message)
    errors.push("message is invalid")
  if (!Array.isArray(state.party) || state.party.length !== 5) errors.push("party must contain five members")
  if (Array.isArray(state.party) && state.party.some(function(member, index) {
    if (!member || typeof member !== "object") return true
    var measures = [member.health, member.fatigue, member.morale]
    return member.id !== "party-" + (index + 1)
      || typeof member.name !== "string" || !member.name || member.name.length > 24
      || cleanText(member.name, 24) !== member.name
      || measures.some(function(value) { return !Number.isInteger(value) || value < 0 || value > 100 })
      || ["well", "poor", "critical", "lost"].indexOf(member.condition) === -1
      || typeof member.alive !== "boolean"
      || (!member.alive && (member.health !== 0 || member.condition !== "lost"))
  }))
    errors.push("party member is invalid")
  if (!state.inventory || typeof state.inventory !== "object"
    || Object.keys(state.inventory).sort().join(",") !== itemKeys().sort().join(",")
    || itemKeys().some(function(item) {
    return !Number.isInteger(state.inventory[item]) || state.inventory[item] < 0 || state.inventory[item] > ITEMS[item].maximum
  }))
    errors.push("inventory is invalid")
  if (!Number.isInteger(state.targetIndex) || state.targetIndex < 1 || state.targetIndex >= ROUTE.length
    || !Number.isInteger(state.miles) || state.miles < 0 || state.miles > ROUTE[ROUTE.length - 1].mile
    || !Number.isInteger(state.act) || state.act < 1 || state.act > 3)
    errors.push("route state is invalid")
  if (!Number.isInteger(state.cash) || state.cash < 0 || state.cash > 100000
    || !Number.isInteger(state.wagonCondition) || state.wagonCondition < 0 || state.wagonCondition > 100
    || !Number.isInteger(state.oxenCondition) || state.oxenCondition < 0 || state.oxenCondition > 100)
    errors.push("resource state is invalid")
  if (!Number.isInteger(state.daysRested) || state.daysRested < 0 || !Number.isInteger(state.hunts) || state.hunts < 0
    || !Number.isInteger(state.lastHuntMile) || state.lastHuntMile < -1 || state.lastHuntMile > state.miles
    || !Number.isInteger(state.wastedPounds) || state.wastedPounds < 0
    || !Number.isInteger(state.harvestedPounds) || state.harvestedPounds < state.wastedPounds)
    errors.push("hunt totals are invalid")
  if (!Array.isArray(state.eventHistory) || state.eventHistory.some(function(id, index) {
    return typeof id !== "string" || !EVENTS.some(function(event) { return event.id === id })
      || state.eventHistory.indexOf(id) !== index
  })) errors.push("event history is invalid")
  if (!Array.isArray(state.losses) || state.losses.some(function(loss) {
    return !loss || typeof loss !== "object" || typeof loss.id !== "string" || typeof loss.name !== "string"
      || !Number.isInteger(loss.day) || loss.day < 1 || loss.day > 30
      || typeof loss.reason !== "string" || cleanText(loss.reason, 120) !== loss.reason
  })) errors.push("loss records are invalid")
  var flagNames = ["helpedTraveler", "scoutedAhead"]
  if (!state.flags || typeof state.flags !== "object" || Array.isArray(state.flags)
    || Object.keys(state.flags).some(function(name) { return flagNames.indexOf(name) === -1 || state.flags[name] !== true }))
    errors.push("flags are invalid")

  var canonicalPending = state.pendingEvent && EVENTS.find(function(event) { return event.id === state.pendingEvent.id })
  if (state.phase === "event") {
    if (!canonicalPending || JSON.stringify(state.pendingEvent) !== JSON.stringify(canonicalPending))
      errors.push("pending event is invalid")
  } else if (state.pendingEvent !== null) errors.push("pending event is out of phase")

  var riverPhases = state.phase === "river" || state.phase === "river-result"
  if (riverPhases) {
    var routeRiver = state.river && ROUTE.find(function(stop) { return stop.id === state.river.id && stop.type === "river" })
    var allowedOptions = ["ford", "float", "wait", "ferry", "guide"]
    if (!routeRiver || state.river.name !== routeRiver.name || weatherNames.indexOf(state.river.weather) === -1
      || !Array.isArray(state.river.options)
      || state.river.options.length < 2 || state.river.options.some(function(option, index) {
        return allowedOptions.indexOf(option) === -1 || state.river.options.indexOf(option) !== index
      })
      || !Number.isInteger(state.river.width) || state.river.width !== routeRiver.width
      || !Number.isFinite(state.river.depth) || state.river.depth < 0 || state.river.depth > 20
      || !Number.isInteger(state.river.current) || state.river.current !== routeRiver.current
      || !Number.isInteger(state.river.wagonCondition) || state.river.wagonCondition < 0 || state.river.wagonCondition > 100
      || !Number.isInteger(state.river.partyHealth) || state.river.partyHealth < 0 || state.river.partyHealth > 100
      || !Number.isInteger(state.river.ferryPrice) || state.river.ferryPrice < 1 || state.river.ferryPrice > 10000)
      errors.push("river state is invalid")
  } else if (state.river !== null) errors.push("river is out of phase")

  if (state.phase === "river-result") {
    if (!state.riverResult || typeof state.riverResult !== "object"
      || typeof state.riverResult.success !== "boolean"
      || !Number.isInteger(state.riverResult.foodLost) || state.riverResult.foodLost < 0
      || !Number.isInteger(state.riverResult.wagonDamage) || state.riverResult.wagonDamage < 0
      || !state.river || state.river.options.indexOf(state.riverResult.choice) === -1
      || typeof state.riverResult.explanation !== "string" || !state.riverResult.explanation
      || cleanText(state.riverResult.explanation, 180) !== state.riverResult.explanation)
      errors.push("river result is invalid")
  } else if (state.riverResult !== null) errors.push("river result is out of phase")

  if (state.phase === "hunt") {
    if (!Number.isInteger(state.huntSeed) || state.huntSeed < 1 || state.huntSeed > 0xffffffff)
      errors.push("hunt seed is invalid")
  } else if (state.huntSeed !== null) errors.push("hunt seed is out of phase")
  if (state.phase === "victory" || state.phase === "loss") {
    var expectedSurvivors = Array.isArray(state.party) ? state.party.filter(function(member) {
      return member && member.alive === true
    }).map(function(member) { return member.name }) : []
    if (!state.ending || typeof state.ending !== "object"
      || ["arrival", "loss", "abandoned"].indexOf(state.ending.reason) === -1
      || (state.phase === "victory" ? state.ending.reason !== "arrival" : state.ending.reason === "arrival")
      || !Array.isArray(state.ending.survivors)
      || state.ending.survivors.some(function(name) { return typeof name !== "string" || !name || name.length > 24 })
      || JSON.stringify(state.ending.survivors) !== JSON.stringify(expectedSurvivors)
      || !Array.isArray(state.ending.losses) || JSON.stringify(state.ending.losses) !== JSON.stringify(state.losses)
      || !Number.isInteger(state.ending.durationDays) || state.ending.durationDays !== journeyDurationDays(state)
      || !state.ending.resources || typeof state.ending.resources !== "object"
      || JSON.stringify(state.ending.resources) !== JSON.stringify(state.inventory)
      || !Number.isInteger(state.ending.month) || state.ending.month !== state.month
      || !Number.isInteger(state.ending.day) || state.ending.day !== state.day
      || state.ending.difficulty !== state.difficulty
      || state.ending.rulesProfile !== state.rulesProfile
      || !Number.isInteger(state.ending.wastedPounds) || state.ending.wastedPounds !== state.wastedPounds
      || !Number.isInteger(state.ending.score) || state.ending.score < 0
      || !Number.isInteger(state.ending.seed) || state.ending.seed !== state.seed)
      errors.push("ending is invalid")
  } else if (state.ending !== null) errors.push("ending is out of phase")
  return errors
}

function utf8Length(value) {
  var text = String(value || "")
  var bytes = 0
  for (var index = 0; index < text.length; index++) {
    var code = text.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length
      && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4
      index += 1
    } else bytes += 3
  }
  return bytes
}

function serializeSave(state) {
  if (validate(state).length) return ""
  var encoded = JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state: state })
  return utf8Length(encoded) <= MAX_SAVE_BYTES ? encoded : ""
}

function parseSave(raw) {
  var text = String(raw || "")
  var size = utf8Length(text)
  if (!text || size > MAX_SAVE_BYTES) return { valid: false, reason: size > MAX_SAVE_BYTES ? "oversized" : "missing", state: null }
  try {
    var document = JSON.parse(text)
    if (!document || document.schemaVersion !== SAVE_SCHEMA_VERSION || !document.state)
      return { valid: false, reason: "incompatible", state: null }
    if (document.state.gameVersion === "0.1.0" && document.state.rulesProfile === undefined) {
      document.state.rulesProfile = "omatrail"
      if (document.state.ending && document.state.ending.rulesProfile === undefined)
        document.state.ending.rulesProfile = "omatrail"
    }
    if (document.state.gameVersion === "0.1.0" && document.state.lastHuntMile === undefined)
      document.state.lastHuntMile = -1
    var errors = validate(document.state)
    return errors.length ? { valid: false, reason: "invalid", state: null, errors: errors }
      : { valid: true, reason: "ok", state: document.state }
  } catch (error) {
    return { valid: false, reason: "malformed", state: null }
  }
}

function semanticSnapshot(state) {
  var copy = clone(state)
  delete copy.profile
  delete copy.message
  return copy
}

var api = {
  SAVE_SCHEMA_VERSION: SAVE_SCHEMA_VERSION,
  MAX_SAVE_BYTES: MAX_SAVE_BYTES,
  RULE_PROFILES: RULE_PROFILES,
  OCCUPATIONS: OCCUPATIONS,
  ITEMS: ITEMS,
  ACTS: ACTS,
  ROUTE: ROUTE,
  EVENTS: EVENTS,
  cleanText: cleanText,
  normalizedSeed: normalizedSeed,
  draw: draw,
  canonicalDifficulty: canonicalDifficulty,
  canonicalRulesProfile: canonicalRulesProfile,
  rulesProfileLabel: rulesProfileLabel,
  canonicalOccupation: canonicalOccupation,
  canonicalPace: canonicalPace,
  canonicalRations: canonicalRations,
  partyNames: partyNames,
  createJourney: createJourney,
  updateMemberCondition: updateMemberCondition,
  itemKeys: itemKeys,
  totalPartyHealth: totalPartyHealth,
  livingParty: livingParty,
  averageFatigue: averageFatigue,
  illnessRiskPercent: illnessRiskPercent,
  recoveryChancePercent: recoveryChancePercent,
  minimumHuntAmmo: minimumHuntAmmo,
  canHunt: canHunt,
  purchaseCost: purchaseCost,
  buy: buy,
  sell: sell,
  canDepart: canDepart,
  seasonFor: seasonFor,
  weatherFor: weatherFor,
  eventEligible: eventEligible,
  eventChoiceAvailable: eventChoiceAvailable,
  chooseEvent: chooseEvent,
  travel: travel,
  eventChoice: eventChoice,
  riverContext: riverContext,
  resolveRiver: resolveRiver,
  leaveStop: leaveStop,
  rest: rest,
  repair: repair,
  beginHunt: beginHunt,
  applyHuntResult: applyHuntResult,
  scoreJourney: scoreJourney,
  journeyDurationDays: journeyDurationDays,
  finishJourney: finishJourney,
  dispatch: dispatch,
  validateEventRecords: validateEventRecords,
  validate: validate,
  utf8Length: utf8Length,
  serializeSave: serializeSave,
  parseSave: parseSave,
  semanticSnapshot: semanticSnapshot
}

if (typeof module !== "undefined" && module.exports) module.exports = api
