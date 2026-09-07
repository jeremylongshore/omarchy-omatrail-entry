const test = require("node:test")
const assert = require("node:assert/strict")
const Journey = require("../JourneyRules.js")
const Hunt = require("../HuntingRules.js")

function newJourney(options = {}) {
  return Journey.createJourney({ seed: 1848, ...options })
}

function buyStarter(state) {
  for (const [item, steps] of [
    ["oxen", 2], ["food", 20], ["ammunition", 15],
    ["clothing", 5], ["medicine", 4], ["parts", 4]
  ]) state = Journey.dispatch(state, { type: "BUY", item, steps })
  return state
}

function trailReady(options = {}) {
  return Journey.dispatch(buyStarter(newJourney(options)), { type: "DEPART" })
}

function forceEvent(state, category) {
  const event = Journey.EVENTS.find((entry) => entry.category === category)
  return { ...structuredClone(state), phase: "event", pendingEvent: structuredClone(event) }
}

test("journey creation cleans setup input and establishes five travelers", () => {
  const state = newJourney({
    seed: -72.9,
    names: ["<A>", "", "B\u0000ad", "A very long traveler name beyond limit", "June", "ignored"],
    occupation: "DOCTOR",
    difficulty: "HARD",
    profile: "Color Deluxe",
    departureMonth: 99
  })
  assert.equal(state.seed, 72)
  assert.equal(state.profile, "color")
  assert.equal(state.occupation, "doctor")
  assert.equal(state.difficulty, "hard")
  assert.equal(state.month, 6)
  assert.equal(state.party.length, 5)
  assert.deepEqual(state.party.map((member) => member.name), ["A", "Morgan", "Bad", "A very long traveler nam", "June"])
  assert.equal(state.cash, Journey.OCCUPATIONS.doctor.budget)
  assert.equal(state.party[0].health, 94)
  assert.deepEqual(Journey.validate(state), [])
  assert.equal(Journey.canonicalOccupation("unknown"), "farmer")
  assert.equal(Journey.canonicalDifficulty("unknown"), "normal")
  assert.equal(Journey.canonicalPace("GRUELING"), "grueling")
  assert.equal(Journey.canonicalPace("fast"), "steady")
  assert.equal(Journey.canonicalRations("bare"), "bare")
  assert.equal(Journey.canonicalRations("huge"), "filling")
})

test("seed draws, text bounds, calendar seasons, and route records are deterministic", () => {
  assert.equal(Journey.normalizedSeed(0), 1)
  assert.equal(Journey.normalizedSeed("bad"), 1)
  assert.deepEqual(Journey.draw(99), Journey.draw(99))
  assert.equal(Journey.cleanText("<a>\u0000b", 2), "ab")
  assert.equal(Journey.seasonFor(5), "spring")
  assert.equal(Journey.seasonFor(7), "summer")
  assert.equal(Journey.seasonFor(10), "fall")
  assert.equal(Journey.seasonFor(11), "winter")
  assert.equal(new Set(Journey.ROUTE.map((stop) => stop.id)).size, Journey.ROUTE.length)
  assert.deepEqual(new Set(Journey.ROUTE.map((stop) => stop.act)), new Set([1, 2, 3]))
  assert.ok(new Set(Journey.ROUTE.map((stop) => stop.region)).size >= 5)
  assert.equal(Object.keys(Journey.ACTS).length, 3)
  assert.ok(Journey.ROUTE.every((stop) => stop.story.length >= 40 && stop.story.length <= 120))
  assert.deepEqual(Journey.validateEventRecords(), [])
})

test("identical journey inputs and actions produce byte-identical semantic state", () => {
  const actions = [
    { type: "BUY", item: "oxen", steps: 2 },
    { type: "BUY", item: "food", steps: 20 },
    { type: "BUY", item: "ammunition", steps: 15 },
    { type: "BUY", item: "clothing", steps: 5 },
    { type: "BUY", item: "medicine", steps: 4 },
    { type: "BUY", item: "parts", steps: 4 },
    { type: "DEPART" },
    { type: "SET_PACE", value: "strenuous" },
    { type: "SET_RATIONS", value: "meager" },
    { type: "TRAVEL" }
  ]
  const replay = () => actions.reduce((state, action) => Journey.dispatch(state, action),
    newJourney({ seed: 8675309, occupation: "carpenter", difficulty: "hard", departureMonth: 5 }))
  const left = JSON.stringify(Journey.semanticSnapshot(replay()))
  const right = JSON.stringify(Journey.semanticSnapshot(replay()))
  assert.equal(left, right)
})

test("the complete route graph is ordered, connected, and reaches every required state", () => {
  assert.ok(Journey.ROUTE.length >= 12)
  assert.equal(Journey.ROUTE[0].mile, 0)
  assert.ok(Journey.ROUTE.every((stop, index) => index === 0 || stop.mile > Journey.ROUTE[index - 1].mile))
  assert.deepEqual([...new Set(Journey.ROUTE.map((stop) => stop.act))], [1, 2, 3])
  assert.ok(new Set(Journey.ROUTE.map((stop) => stop.region)).size >= 5)
  assert.ok(Journey.ROUTE.some((stop) => stop.type === "river"))
  assert.ok(Journey.ROUTE.some((stop) => stop.type === "fort"))
  assert.equal(Journey.ROUTE.at(-1).type, "finish")
  assert.ok(Journey.EVENTS.every((event) => event.destination === "trail"))
})

test("store purchases, returns, caps, and departure prerequisites are enforced", () => {
  let state = newJourney({ occupation: "banker" })
  assert.equal(Journey.canDepart(state), false)
  const untouched = Journey.dispatch(state, { type: "BUY", item: "unknown" })
  assert.deepEqual(untouched.inventory, state.inventory)
  state = Journey.dispatch(state, { type: "BUY", item: "oxen", steps: 1 })
  state = Journey.dispatch(state, { type: "BUY", item: "food", steps: 4 })
  state = Journey.dispatch(state, { type: "BUY", item: "ammunition", steps: 1 })
  state = Journey.dispatch(state, { type: "BUY", item: "clothing", steps: 5 })
  assert.equal(Journey.canDepart(state), true)
  const beforeSell = state.cash
  state = Journey.dispatch(state, { type: "SELL", item: "food", steps: 1 })
  assert.equal(state.inventory.food, 75)
  assert.ok(state.cash > beforeSell)
  assert.equal(Journey.canDepart(state), false)
  const noStock = Journey.dispatch(state, { type: "SELL", item: "parts", steps: 1 })
  assert.deepEqual(noStock.inventory, state.inventory)
  const capped = structuredClone(state)
  capped.inventory.food = Journey.ITEMS.food.maximum
  const tooMuch = Journey.dispatch(capped, { type: "BUY", item: "food", steps: 1 })
  assert.match(tooMuch.message, /budget or wagon/)
  const refused = Journey.dispatch(state, { type: "DEPART" })
  assert.equal(refused.phase, "store")
  state = Journey.dispatch(state, { type: "BUY", item: "food", steps: 1 })
  state = Journey.dispatch(state, { type: "DEPART" })
  assert.equal(state.phase, "trail")
  assert.match(state.message, /leaves East Camp/)
  assert.equal(Journey.dispatch(state, { type: "BUY", item: "parts" }).inventory.parts, 0)
})

test("weather spans seasonal tables and display profile never changes rules", () => {
  for (const month of [4, 7, 9, 11]) {
    const observed = new Set()
    for (let seed = 1; seed < 200; seed++) {
      const state = newJourney({ seed: seed * 100003, departureMonth: month })
      Journey.weatherFor(state)
      observed.add(state.weather)
      assert.ok(Number.isFinite(state.temperature))
    }
    assert.ok(observed.size >= 2)
  }
  let green = trailReady({ seed: 31, profile: "green" })
  let color = Journey.dispatch(green, { type: "SET_PROFILE", value: "Color Deluxe" })
  for (const action of [
    { type: "SET_PACE", value: "strenuous" },
    { type: "SET_RATIONS", value: "meager" },
    { type: "TRAVEL" }
  ]) {
    green = Journey.dispatch(green, action)
    color = Journey.dispatch(color, action)
  }
  assert.deepEqual(Journey.semanticSnapshot(green), Journey.semanticSnapshot(color))
})

test("travel advances calendar, consumes supplies, changes condition, and can surface events", () => {
  let state = trailReady({ seed: 4 })
  const beforeFood = state.inventory.food
  const beforeMiles = state.miles
  state = Journey.dispatch(state, { type: "SET_PACE", value: "grueling" })
  state = Journey.dispatch(state, { type: "SET_RATIONS", value: "bare" })
  state = Journey.dispatch(state, { type: "TRAVEL" })
  assert.ok(state.miles > beforeMiles)
  assert.ok(state.inventory.food < beforeFood)
  assert.ok(state.party[0].fatigue > 0)
  assert.ok(state.party[0].health < 100)

  let eventState = null
  for (let seed = 1; seed < 500 && !eventState; seed++) {
    const candidate = trailReady({ seed })
    candidate.wagonCondition = 80
    const traveled = Journey.dispatch(candidate, { type: "TRAVEL" })
    if (traveled.phase === "event") eventState = traveled
  }
  assert.ok(eventState)
  assert.ok(Journey.EVENTS.some((event) => event.id === eventState.pendingEvent.id))
  const resolved = Journey.dispatch(eventState, { type: "EVENT_CHOICE", index: 1 })
  assert.equal(resolved.phase, "trail")
  assert.equal(resolved.pendingEvent, null)
  assert.ok(resolved.eventHistory.length > 0)
})

test("all event categories expose bounded choices and deterministic consequences", () => {
  for (const event of Journey.EVENTS) {
    assert.ok(event.choices.length >= 2)
    assert.equal(event.effects.length, event.choices.length)
    assert.equal(event.source, "fictional-composite")
    assert.equal(event.destination, "trail")
    for (let choice = 0; choice < event.choices.length; choice++) {
      let state = trailReady({ seed: 77 })
      state.inventory.medicine = 3
      state.inventory.parts = 3
      state.inventory.ammunition = 50
      state = forceEvent(state, event.category)
      const replay = Journey.dispatch(structuredClone(state), { type: "EVENT_CHOICE", index: choice })
      const result = Journey.dispatch(state, { type: "EVENT_CHOICE", index: choice })
      assert.deepEqual(result, replay)
      assert.equal(result.phase, "trail")
      assert.ok(result.eventHistory.includes(event.id))
      assert.deepEqual(Journey.validate(result), [])
    }
  }

  const repeated = trailReady()
  repeated.eventHistory = Journey.EVENTS.map((event) => event.id)
  assert.equal(Journey.chooseEvent(repeated), null)
  const healthy = trailReady()
  healthy.wagonCondition = 100
  healthy.inventory.medicine = 10
  assert.equal(Journey.eventEligible(healthy, Journey.EVENTS.find((event) => event.category === "breakdown")), false)
  assert.equal(Journey.eventEligible(healthy, Journey.EVENTS.find((event) => event.category === "illness")), false)

  const noSupplies = forceEvent(trailReady(), "illness")
  noSupplies.inventory.medicine = 0
  assert.equal(Journey.eventChoiceAvailable(noSupplies, noSupplies.pendingEvent, 0), false)
  assert.equal(Journey.eventChoiceAvailable(noSupplies, noSupplies.pendingEvent, 1), true)
  assert.equal(Journey.dispatch(noSupplies, { type: "EVENT_CHOICE", index: 0 }).phase, "event")
})

test("illness risk rises and recovery chance falls monotonically with worsening health factors", () => {
  const healthy = trailReady({ occupation: "doctor", difficulty: "easy" })
  healthy.weather = "mild"
  healthy.rations = "filling"
  healthy.inventory.medicine = 10
  healthy.party[0].health = 95
  healthy.party[0].fatigue = 5

  const tired = structuredClone(healthy)
  tired.party[0].fatigue = 70
  const weak = structuredClone(tired)
  weak.party[0].health = 35
  const exposed = structuredClone(weak)
  exposed.weather = "snow"
  exposed.rations = "bare"
  exposed.inventory.medicine = 0
  exposed.occupation = "farmer"
  exposed.difficulty = "hard"

  const risks = [healthy, tired, weak, exposed].map((state) => Journey.illnessRiskPercent(state, state.party[0]))
  assert.ok(risks.every((risk, index) => index === 0 || risk >= risks[index - 1]))

  const treatments = ["continue", "rest", "medicine"].map((treatment) =>
    Journey.recoveryChancePercent(weak, weak.party[0], treatment))
  assert.ok(treatments[0] <= treatments[1] && treatments[1] <= treatments[2])
  assert.ok(Journey.recoveryChancePercent(healthy, healthy.party[0], "rest")
    >= Journey.recoveryChancePercent(exposed, exposed.party[0], "rest"))

  const illness = forceEvent(weak, "illness")
  const left = Journey.dispatch(structuredClone(illness), { type: "EVENT_CHOICE", index: 1 })
  const right = Journey.dispatch(structuredClone(illness), { type: "EVENT_CHOICE", index: 1 })
  assert.deepEqual(left, right)
  assert.equal(left.phase, "trail")

  const noLiving = structuredClone(healthy)
  noLiving.party.forEach((member) => {
    member.alive = false
    member.health = 0
    member.condition = "lost"
  })
  assert.equal(Journey.averageFatigue(noLiving), 100)
  assert.equal(Journey.illnessRiskPercent(noLiving), 100)
  assert.equal(Journey.recoveryChancePercent(noLiving, null, "rest"), 0)
})

test("party condition records a loss once and travel terminal conditions are explicit", () => {
  const state = trailReady()
  const member = state.party[0]
  member.health = 0
  Journey.updateMemberCondition(state, member, "test")
  Journey.updateMemberCondition(state, member, "duplicate")
  assert.equal(member.alive, false)
  assert.equal(state.losses.length, 1)

  const noParty = trailReady()
  noParty.party.forEach((person) => { person.alive = false })
  assert.equal(Journey.dispatch(noParty, { type: "TRAVEL" }).phase, "loss")
  const noOxen = trailReady()
  noOxen.inventory.oxen = 0
  assert.equal(Journey.dispatch(noOxen, { type: "TRAVEL" }).ending.reason, "loss")
  const broken = trailReady()
  broken.wagonCondition = 0
  assert.equal(Journey.dispatch(broken, { type: "TRAVEL" }).phase, "loss")
})

test("a terminal loss near West Valley never overshoots the route", () => {
  let state = trailReady({ seed: 9901, difficulty: "hard" })
  state.targetIndex = Journey.ROUTE.length - 1
  state.miles = Journey.ROUTE[Journey.ROUTE.length - 1].mile - 1
  state.wagonCondition = 1
  state.party.forEach((member) => { member.health = 1 })
  state = Journey.dispatch(state, { type: "TRAVEL" })
  assert.ok(state.miles <= Journey.ROUTE[Journey.ROUTE.length - 1].mile)
  assert.deepEqual(Journey.validate(state), [])
})

test("river context advertises eligible methods and every crossing is replayable", () => {
  const stop = Journey.ROUTE.find((entry) => entry.type === "river")
  const shallow = trailReady({ seed: 8 })
  shallow.weather = "mild"
  shallow.cash = 100
  shallow.phase = "river"
  shallow.river = Journey.riverContext(shallow, { ...stop, depth: 2 })
  assert.ok(shallow.river.options.includes("ford"))
  assert.ok(shallow.river.options.includes("ferry"))
  assert.ok(shallow.river.options.includes("guide"))

  const invalid = Journey.dispatch(shallow, { type: "RIVER_CHOICE", choice: "teleport" })
  assert.equal(invalid.phase, "river")
  assert.match(invalid.message, /not available/)

  const waited = Journey.dispatch(shallow, { type: "RIVER_CHOICE", choice: "wait" })
  assert.equal(waited.phase, "river")
  assert.ok(waited.river.depth < shallow.river.depth)
  assert.ok(waited.inventory.food < shallow.inventory.food)

  for (const option of ["ford", "float", "ferry", "guide"]) {
    const candidate = structuredClone(shallow)
    candidate.river.options = [option]
    const left = Journey.dispatch(candidate, { type: "RIVER_CHOICE", choice: option })
    const right = Journey.dispatch(candidate, { type: "RIVER_CHOICE", choice: option })
    assert.deepEqual(left, right)
    assert.equal(left.phase, "river-result")
    assert.equal(left.riverResult.choice, option)
    assert.ok(left.riverResult.explanation.length > 0)
  }

  const deep = trailReady()
  deep.weather = "storm"
  deep.cash = 0
  const context = Journey.riverContext(deep, { ...stop, depth: 4 })
  assert.equal(context.options.includes("ford"), false)
  assert.equal(context.options.includes("ferry"), false)
  assert.equal(context.options.includes("guide"), false)
})

test("route arrival, landmark departure, forts, and the finish are coherent", () => {
  for (let index = 1; index < Journey.ROUTE.length; index++) {
    const target = Journey.ROUTE[index]
    let state = trailReady({ seed: index })
    state.targetIndex = index
    state.miles = target.mile - 1
    state.wagonCondition = 100
    state.oxenCondition = 100
    state = Journey.dispatch(state, { type: "TRAVEL" })
    if (target.type === "river") assert.equal(state.phase, "river")
    else if (target.type === "finish") assert.equal(state.phase, "victory")
    else assert.equal(state.phase, "landmark")
    assert.equal(state.miles, target.mile)
    assert.equal(state.region, target.region)
  }

  let landmark = trailReady()
  landmark.phase = "landmark"
  landmark.targetIndex = 3
  landmark = Journey.dispatch(landmark, { type: "LEAVE_STOP" })
  assert.equal(landmark.targetIndex, 4)
  assert.equal(landmark.phase, "trail")
  assert.match(landmark.message, /Wide Water/)

  const fort = trailReady({ occupation: "banker" })
  fort.phase = "landmark"
  fort.targetIndex = 3
  fort.miles = Journey.ROUTE[3].mile
  const bought = Journey.dispatch(fort, { type: "BUY", item: "parts" })
  assert.equal(bought.inventory.parts, fort.inventory.parts + 1)
})

test("rest and the hunting bridge consume time and reconcile harvest exactly", () => {
  let state = trailReady({ seed: 91 })
  state.party[0].health = 40
  state.party[0].fatigue = 80
  const beforeFood = state.inventory.food
  const beforeDay = state.day
  const beforeOxen = state.oxenCondition
  state = Journey.dispatch(state, { type: "REST" })
  assert.equal(state.party[0].health, 46)
  assert.equal(state.party[0].fatigue, 62)
  assert.equal(state.inventory.food, beforeFood - 30)
  assert.equal(state.day, beforeDay + 2)
  assert.equal(state.daysRested, 2)
  assert.equal(state.oxenCondition, Math.min(100, beforeOxen + 5))

  const outsideTrail = newJourney()
  assert.deepEqual(Journey.dispatch(outsideTrail, { type: "REST" }), outsideTrail)

  let exactFood = trailReady({ seed: 93 })
  exactFood.inventory.food = 24
  exactFood.party[4].alive = false
  exactFood.party[4].health = 0
  exactFood.party[4].condition = "lost"
  exactFood = Journey.dispatch(exactFood, { type: "REST" })
  assert.equal(exactFood.inventory.food, 0)
  assert.equal(exactFood.party[0].health, 92)
  assert.equal(exactFood.party[4].health, 0)

  let starving = trailReady({ seed: 92 })
  starving.inventory.food = 0
  const healthBeforeStarvingRest = starving.party[0].health
  starving = Journey.dispatch(starving, { type: "REST" })
  assert.ok(starving.party[0].health < healthBeforeStarvingRest)
  assert.match(starving.message, /without food/)
  assert.equal(starving.oxenCondition, 91)

  let almostFed = trailReady({ seed: 94 })
  almostFed.inventory.food = 29
  almostFed = Journey.dispatch(almostFed, { type: "REST" })
  assert.equal(almostFed.inventory.food, 0)
  assert.equal(almostFed.party[0].health, 78)
  for (let turn = 0; turn < 20 && starving.phase !== "loss"; turn++)
    starving = Journey.dispatch(starving, { type: "REST" })
  assert.equal(starving.phase, "loss")
  assert.equal(starving.losses.length, 5)

  state.wagonCondition = 40
  state.inventory.parts = 2
  state = Journey.dispatch(state, { type: "REPAIR" })
  assert.equal(state.inventory.parts, 1)
  assert.ok(state.wagonCondition >= 65)

  state = Journey.dispatch(state, { type: "BEGIN_HUNT" })
  assert.equal(state.phase, "hunt")
  const huntSeed = state.huntSeed
  assert.ok(Number.isFinite(huntSeed))
  const result = { ammoUsed: 6, carriedPounds: 80, wastedPounds: 20, expeditionDays: 2, partyEnergyCost: 14, injury: true, riskPercent: 9 }
  const beforeAmmo = state.inventory.ammunition
  const beforeHarvest = state.harvestedPounds
  const beforeHuntFood = state.inventory.food
  const beforeHuntDay = state.day
  const beforeHuntFatigue = state.party[0].fatigue
  const beforeHuntHealth = state.party[0].health
  state = Journey.dispatch(state, { type: "APPLY_HUNT_RESULT", result })
  assert.equal(state.phase, "trail")
  assert.equal(state.inventory.ammunition, beforeAmmo - 6)
  assert.equal(state.harvestedPounds, beforeHarvest + 100)
  assert.equal(state.wastedPounds, 20)
  assert.equal(state.hunts, 1)
  assert.equal(state.inventory.food, Math.min(1200, beforeHuntFood + 80))
  assert.equal(state.day, beforeHuntDay + 2)
  assert.equal(state.party[0].fatigue, Math.min(100, beforeHuntFatigue + 14))
  assert.equal(state.party[0].health, Math.max(0, beforeHuntHealth - 12))
  assert.match(state.message, /was injured \(9% regional risk\)/)

  let safeHunt = Journey.dispatch(trailReady(), { type: "BEGIN_HUNT" })
  const safeHealth = safeHunt.party[0].health
  safeHunt = Journey.dispatch(safeHunt, { type: "APPLY_HUNT_RESULT", result: {
    ammoUsed: 1, carriedPounds: 10, wastedPounds: 0, expeditionDays: 1,
    partyEnergyCost: 4, injury: false, riskPercent: 5
  } })
  assert.equal(safeHunt.party[0].health, safeHealth)
  assert.match(safeHunt.message, /No hunting injury/)

  let fatalHunt = Journey.dispatch(trailReady(), { type: "BEGIN_HUNT" })
  fatalHunt.party[0].health = 5
  fatalHunt = Journey.dispatch(fatalHunt, { type: "APPLY_HUNT_RESULT", result: {
    ammoUsed: 1, carriedPounds: 0, wastedPounds: 0, expeditionDays: 1,
    partyEnergyCost: 4, injury: true, riskPercent: 12
  } })
  assert.equal(fatalHunt.party[0].alive, false)
  assert.equal(fatalHunt.losses.at(-1).reason, "hunting injury")

  const deadTraveler = Journey.dispatch(trailReady(), { type: "BEGIN_HUNT" })
  deadTraveler.party[0].alive = false
  deadTraveler.party[0].health = 0
  deadTraveler.party[0].condition = "lost"
  const deadFatigue = deadTraveler.party[0].fatigue
  const nextHealth = deadTraveler.party[1].health
  const afterDead = Journey.applyHuntResult(deadTraveler, result)
  assert.equal(afterDead.party[0].fatigue, deadFatigue)
  assert.equal(afterDead.party[1].health, nextHealth - 12)

  const invalidResult = Journey.dispatch(trailReady(), { type: "BEGIN_HUNT" })
  assert.deepEqual(Journey.applyHuntResult(structuredClone(invalidResult), 5), invalidResult)

  const foodCap = Journey.dispatch(trailReady(), { type: "BEGIN_HUNT" })
  foodCap.inventory.food = 1190
  assert.equal(Journey.applyHuntResult(foodCap, result).inventory.food, 1200)

  const noAmmo = trailReady()
  noAmmo.inventory.ammunition = 0
  assert.equal(Journey.dispatch(noAmmo, { type: "BEGIN_HUNT" }).phase, "trail")

  let actual = Journey.dispatch(trailReady({ seed: 22 }), { type: "BEGIN_HUNT" })
  let hunt = Hunt.dispatch(Hunt.createHunt(actual.huntSeed, {
    ammo: actual.inventory.ammunition,
    region: actual.region,
    season: Journey.seasonFor(actual.month)
  }), { type: "START" })
  hunt = Hunt.settle(hunt, "manual")
  actual = Journey.dispatch(actual, { type: "APPLY_HUNT_RESULT", result: hunt.result })
  assert.deepEqual(Journey.validate(actual), [])
  assert.match(actual.message, /regional risk/)
})

test("a careful supply, repair, rest, and hunting policy can finish every difficulty", () => {
  function buy(state, item, steps) {
    return Journey.dispatch(state, { type: "BUY", item, steps })
  }
  function stock(state) {
    for (const [item, steps] of [
      ["oxen", 6], ["food", 20], ["food", 20], ["food", 8],
      ["ammunition", 20], ["ammunition", 10], ["clothing", 5],
      ["medicine", 10], ["parts", 10]
    ]) state = buy(state, item, steps)
    return state
  }
  function topUpFood(state) {
    for (const steps of [20, 20, 20, 10, 5, 2, 1]) state = buy(state, "food", steps)
    return state
  }
  function play(seed, difficulty) {
    let state = Journey.dispatch(stock(newJourney({ seed, difficulty, occupation: "banker" })), { type: "DEPART" })
    for (let turn = 0; turn < 500 && state.phase !== "victory" && state.phase !== "loss"; turn++) {
      if (state.phase === "trail") {
        if (Journey.totalPartyHealth(state) < 55 || Journey.averageFatigue(state) > 70)
          state = Journey.dispatch(state, { type: "REST" })
        else if (state.wagonCondition < 35 && state.inventory.parts > 0) state = Journey.dispatch(state, { type: "REPAIR" })
        else if (state.oxenCondition < 40) state = Journey.dispatch(state, { type: "REST" })
        else if (state.inventory.food < 250) {
          state = Journey.dispatch(state, { type: "BEGIN_HUNT" })
          if (state.phase === "hunt") state = Journey.dispatch(state, {
            type: "APPLY_HUNT_RESULT",
            result: { ammoUsed: 2, carriedPounds: 100, wastedPounds: 0, expeditionDays: 1, partyEnergyCost: 5 }
          })
        } else state = Journey.dispatch(state, { type: "TRAVEL" })
      } else if (state.phase === "event") state = Journey.dispatch(state, {
        type: "EVENT_CHOICE",
        index: Journey.eventChoiceAvailable(state, state.pendingEvent, 0) ? 0 : 1
      })
      else if (state.phase === "river") state = Journey.dispatch(state, {
        type: "RIVER_CHOICE",
        choice: state.river.options.includes("ferry") ? "ferry" : state.river.options[0]
      })
      else if (state.phase === "river-result") state = Journey.dispatch(state, { type: "LEAVE_STOP" })
      else if (state.phase === "landmark") {
        if (Journey.ROUTE[state.targetIndex].type === "fort") state = topUpFood(state)
        state = Journey.dispatch(state, { type: "LEAVE_STOP" })
      }
    }
    return state
  }

  for (const difficulty of ["easy", "normal", "hard"]) {
    for (let seed = 1; seed <= 60; seed++) {
      const result = play(seed, difficulty)
      assert.equal(result.phase, "victory", difficulty + " seed " + seed)
      assert.ok(result.ending.score > 0)
    }
  }
})

test("scores and endings contain survivors, losses, resources, difficulty, and seed", () => {
  const state = trailReady({ seed: 202, difficulty: "hard" })
  const normal = Journey.scoreJourney({ ...structuredClone(state), difficulty: "normal" })
  const hard = Journey.scoreJourney(state)
  assert.ok(hard > normal)
  const won = Journey.finishJourney(structuredClone(state), "arrival")
  assert.equal(won.phase, "victory")
  assert.equal(won.ending.reason, "arrival")
  assert.equal(won.ending.survivors.length, 5)
  assert.equal(won.ending.seed, 202)
  assert.equal(won.ending.durationDays, Journey.journeyDurationDays(won))
  assert.ok(Number.isInteger(won.ending.score))
  const abandoned = Journey.dispatch(state, { type: "ABANDON", confirmed: true })
  assert.equal(abandoned.phase, "loss")
  assert.equal(abandoned.ending.reason, "abandoned")
  assert.equal(Journey.dispatch(state, { type: "ABANDON", confirmed: false }).phase, "trail")
})

test("save serialization is bounded by UTF-8 bytes and round trips valid state", () => {
  const state = trailReady({ names: ["A🙂", "B", "C", "D", "E"] })
  const encoded = Journey.serializeSave(state)
  assert.ok(encoded.length > 0)
  assert.equal(Journey.utf8Length("A🙂"), 5)
  const decoded = Journey.parseSave(encoded)
  assert.equal(decoded.valid, true)
  assert.deepEqual(decoded.state, state)
  assert.deepEqual(Journey.parseSave(""), { valid: false, reason: "missing", state: null })
  const malformed = Journey.parseSave("{")
  assert.equal(malformed.valid, false)
  assert.equal(malformed.reason, "malformed")
  const incompatible = Journey.parseSave(JSON.stringify({ schemaVersion: 99, state }))
  assert.equal(incompatible.valid, false)
  assert.equal(incompatible.reason, "incompatible")
  const oversized = Journey.parseSave("🙂".repeat(20000))
  assert.equal(oversized.valid, false)
  assert.equal(oversized.reason, "oversized")
  const exactState = structuredClone(state)
  exactState.padding = ""
  let exactDocument = JSON.stringify({ schemaVersion: 1, state: exactState })
  exactState.padding = "x".repeat(Journey.MAX_SAVE_BYTES - Buffer.byteLength(exactDocument))
  exactDocument = JSON.stringify({ schemaVersion: 1, state: exactState })
  assert.equal(Buffer.byteLength(exactDocument), Journey.MAX_SAVE_BYTES)
  assert.equal(Journey.parseSave(exactDocument).valid, true)
  const invalid = structuredClone(state)
  invalid.cash = Number.NaN
  assert.equal(Journey.serializeSave(invalid), "")
  const invalidDocument = JSON.stringify({ schemaVersion: 1, state: { ...state, phase: "bad" } })
  const invalidParsed = Journey.parseSave(invalidDocument)
  assert.equal(invalidParsed.valid, false)
  assert.equal(invalidParsed.reason, "invalid")
})

test("validation rejects hostile or corrupt state without accepting partial saves", () => {
  assert.deepEqual(Journey.validate(null), ["state must be an object"])
  const valid = trailReady()
  for (const mutate of [
    (state) => { state.schemaVersion = 99 },
    (state) => { state.phase = "unknown" },
    (state) => { state.rngState = Number.NaN },
    (state) => { state.party = [] },
    (state) => { state.party[0].health = 101 },
    (state) => { state.party[0].name = "" },
    (state) => { state.inventory.food = -1 },
    (state) => { state.targetIndex = 0 },
    (state) => { state.wastedPounds = -1 },
    (state) => { state.harvestedPounds = 0; state.wastedPounds = 1 },
    (state) => { state.day = 500 },
    (state) => { state.month = 13 },
    (state) => { state.cash = 1000000 },
    (state) => { state.gameVersion = {} },
    (state) => { state.region = {} },
    (state) => { state.weather = {} },
    (state) => { state.temperature = 1000000000 },
    (state) => { state.inventory.injected = 1 },
    (state) => { state.huntSeed = 22 },
    (state) => { state.party[0].alive = "yes" },
    (state) => { state.party[0].fatigue = Number.POSITIVE_INFINITY },
    (state) => { state.party[0].condition = "unknown" },
    (state) => { state.pendingEvent = { id: "evt-fever", choices: [] } },
    (state) => { state.river = { id: "oak-fork", options: ["teleport"] } },
    (state) => { state.ending = { reason: "arrival", score: 1 } }
  ]) {
    const corrupt = structuredClone(valid)
    mutate(corrupt)
    assert.ok(Journey.validate(corrupt).length > 0)
    assert.equal(Journey.parseSave(JSON.stringify({ schemaVersion: 1, state: corrupt })).valid, false)
  }

  const corruptEvent = forceEvent(valid, "illness")
  corruptEvent.pendingEvent.choices = ["Injected"]
  assert.match(Journey.validate(corruptEvent).join(";"), /pending event/)

  const corruptRiver = structuredClone(valid)
  corruptRiver.phase = "river"
  corruptRiver.river = Journey.riverContext(corruptRiver, Journey.ROUTE.find((stop) => stop.type === "river"))
  corruptRiver.river.options.push("teleport")
  assert.match(Journey.validate(corruptRiver).join(";"), /river state/)
  corruptRiver.river.options.pop()
  corruptRiver.river.weather = {}
  assert.match(Journey.validate(corruptRiver).join(";"), /river state/)

  const corruptEnding = Journey.finishJourney(structuredClone(valid), "arrival")
  corruptEnding.ending.seed += 1
  assert.match(Journey.validate(corruptEnding).join(";"), /ending/)
  corruptEnding.ending.seed = corruptEnding.seed
  corruptEnding.ending.survivors.push(null)
  corruptEnding.ending.resources.food = {}
  assert.match(Journey.validate(corruptEnding).join(";"), /ending/)
})

test("unavailable actions are inert and action payloads are canonicalized", () => {
  const store = newJourney()
  assert.deepEqual(Journey.dispatch(store, { type: "TRAVEL" }), store)
  assert.deepEqual(Journey.dispatch(store, { type: "NOPE" }), store)
  let trail = trailReady()
  trail = Journey.dispatch(trail, { type: "SET_PACE", value: "invalid" })
  trail = Journey.dispatch(trail, { type: "SET_RATIONS", value: "invalid" })
  assert.equal(trail.pace, "steady")
  assert.equal(trail.rations, "filling")
  assert.deepEqual(Journey.dispatch(trail, { type: "EVENT_CHOICE", index: 0 }), trail)
  assert.deepEqual(Journey.dispatch(trail, { type: "RIVER_CHOICE", choice: "ford" }), trail)
  assert.deepEqual(Journey.dispatch(trail, { type: "LEAVE_STOP" }), trail)
  assert.deepEqual(Journey.dispatch(trail, { type: "APPLY_HUNT_RESULT", result: {} }), trail)

  const noParts = structuredClone(trail)
  noParts.inventory.parts = 0
  assert.match(Journey.dispatch(noParts, { type: "REPAIR" }).message, /No wagon parts/)
  const soundWagon = structuredClone(trail)
  soundWagon.wagonCondition = 100
  assert.match(Journey.dispatch(soundWagon, { type: "REPAIR" }).message, /needs no repair/)

  const illness = Journey.EVENTS.find((event) => event.category === "illness")
  const breakdown = Journey.EVENTS.find((event) => event.category === "breakdown")
  const trade = Journey.EVENTS.find((event) => event.category === "trade")
  const empty = structuredClone(trail)
  empty.inventory.medicine = 0
  empty.inventory.parts = 0
  empty.inventory.ammunition = 0
  assert.equal(Journey.eventChoiceAvailable(empty, null, 0), false)
  assert.equal(Journey.eventChoiceAvailable(empty, illness, -1), false)
  assert.equal(Journey.eventChoiceAvailable(empty, illness, 0), false)
  assert.equal(Journey.eventChoiceAvailable(empty, breakdown, 0), false)
  assert.equal(Journey.eventChoiceAvailable(empty, trade, 0), false)
  assert.equal(Journey.eventChoiceAvailable(empty, trade, 2), false)
  assert.equal(Journey.eventChoiceAvailable(empty, trade, 1), true)
})
