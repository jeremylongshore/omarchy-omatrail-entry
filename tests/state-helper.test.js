const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawn, spawnSync } = require("node:child_process")

const helper = path.join(__dirname, "..", "bin", "omatrail-state")

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omatrail-state-"))
  const env = { ...process.env, HOME: root, XDG_STATE_HOME: path.join(root, "state") }
  const dir = path.join(root, "state", "omarchy", "omatrail")
  return { root, env, dir }
}

function run(env, operation, input = "", options = {}) {
  return spawnSync(helper, [operation], { encoding: "utf8", env, input, ...options })
}

function save(serial) {
  return JSON.stringify({ schemaVersion: 1, serial, state: { screen: "trail", seed: serial } })
}

const stopRacer = child => {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise(resolve => { child.once("close", resolve); child.kill() })
}

const waitFor = async (file, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs
  while (!fs.existsSync(file)) {
    if (Date.now() >= deadline) assert.fail(`timed out waiting for ${file}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

test("state helper writes private primary and last-good backup files", () => {
  const x = setup()
  try {
    assert.equal(run(x.env, "--write", save(1)).status, 0)
    assert.equal(run(x.env, "--write", save(2)).status, 0)
    assert.equal(run(x.env, "--read-primary").stdout, save(2))
    assert.equal(run(x.env, "--read-backup").stdout, save(1))
    assert.equal(fs.statSync(x.dir).mode & 0o777, 0o700)
    for (const name of ["journey.json", "journey.last-good.json", ".journey.lock"])
      assert.equal(fs.statSync(path.join(x.dir, name)).mode & 0o777, 0o600)
  } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
})

test("state helper rejects malformed and oversized input without changing the save", () => {
  const x = setup()
  try {
    assert.equal(run(x.env, "--write", save(1)).status, 0)
    assert.notEqual(run(x.env, "--write", "not json").status, 0)
    assert.notEqual(run(x.env, "--write", JSON.stringify({ data: "x".repeat(70 * 1024) })).status, 0)
    assert.equal(run(x.env, "--read-primary").stdout, save(1))
  } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
})

test("FIFO, symlink, oversized, and directory primary saves fail without blocking", () => {
  const shapes = ["FIFO", "symlink", "oversized", "directory"]
  for (const shape of shapes) {
    const x = setup()
    try {
      fs.mkdirSync(x.dir, { recursive: true })
      const target = path.join(x.dir, "journey.json")
      if (shape === "FIFO") assert.equal(spawnSync("mkfifo", [target]).status, 0)
      if (shape === "symlink") fs.symlinkSync(path.join(x.root, "victim"), target)
      if (shape === "oversized") fs.writeFileSync(target, "x".repeat(70 * 1024))
      if (shape === "directory") fs.mkdirSync(target)
      const result = run(x.env, "--read-primary", "", { timeout: 1000 })
      assert.equal(result.status, 4, `${shape} must be classified unsafe`)
    } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
  }
})

test("missing and unsafe reads have distinct status codes", () => {
  const x = setup()
  try {
    assert.equal(run(x.env, "--read-primary").status, 3)
    const target = path.join(x.dir, "journey.json")
    fs.symlinkSync(path.join(x.root, "victim"), target)
    assert.equal(run(x.env, "--read-primary").status, 4)
  } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
})

test("delete safely removes non-directory hostile names and refuses directories", () => {
  for (const shape of ["FIFO", "symlink"]) {
    const x = setup()
    try {
      run(x.env, "--read-primary")
      const target = path.join(x.dir, "journey.json")
      if (shape === "FIFO") assert.equal(spawnSync("mkfifo", [target]).status, 0)
      else fs.symlinkSync(path.join(x.root, "victim"), target)
      assert.equal(run(x.env, "--delete").status, 0, shape)
      assert.equal(run(x.env, "--write", save(1)).status, 0, shape)
    } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
  }

  const x = setup()
  try {
    run(x.env, "--read-primary")
    fs.mkdirSync(path.join(x.dir, "journey.json"))
    assert.notEqual(run(x.env, "--delete").status, 0)
    assert.notEqual(run(x.env, "--write", save(1)).status, 0)
  } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
})

test("delete removes only descriptor-verified regular save entries", () => {
  const x = setup()
  try {
    assert.equal(run(x.env, "--write", save(1)).status, 0)
    assert.equal(run(x.env, "--write", save(2)).status, 0)
    assert.equal(run(x.env, "--delete").status, 0)
    assert.equal(fs.existsSync(path.join(x.dir, "journey.json")), false)
    assert.equal(fs.existsSync(path.join(x.dir, "journey.last-good.json")), false)
  } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
})

test("same-UID final and temporary entry swaps never write through to a victim", async () => {
  const x = setup()
  const victim = path.join(x.root, "victim-final-temp")
  const ready = path.join(x.root, "swap-ready")
  const attacked = path.join(x.root, "swap-attacked")
  fs.writeFileSync(victim, "precious")
  assert.equal(run(x.env, "--write", save(1)).status, 0)
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "state-swap-racer.js"), x.dir, victim, ready, attacked], { stdio: "ignore" })
  try {
    await waitFor(ready)
    for (let i = 0; i < 80; i++) run(x.env, "--write", save(i + 2))
    await waitFor(attacked)
    assert.equal(fs.readFileSync(victim, "utf8"), "precious")
  } finally {
    await stopRacer(racer)
    fs.rmSync(x.root, { recursive: true, force: true })
  }
})

test("same-UID parent directory swaps cannot redirect save publication", async () => {
  const x = setup()
  const victimDir = path.join(x.root, "victim-parent")
  const ready = path.join(x.root, "parent-ready")
  const attacked = path.join(x.root, "parent-attacked")
  fs.mkdirSync(victimDir)
  assert.equal(run(x.env, "--write", save(1)).status, 0)
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "state-parent-racer.js"), x.dir, victimDir, ready, attacked], { stdio: "ignore" })
  try {
    await waitFor(ready)
    for (let i = 0; i < 80; i++) run(x.env, "--write", save(i + 2))
    await waitFor(attacked)
    assert.equal(fs.existsSync(path.join(victimDir, "journey.json")), false)
  } finally {
    await stopRacer(racer)
    if (fs.existsSync(x.dir) && fs.lstatSync(x.dir).isSymbolicLink()) fs.unlinkSync(x.dir)
    if (!fs.existsSync(x.dir) && fs.existsSync(`${x.dir}.parked`)) fs.renameSync(`${x.dir}.parked`, x.dir)
    fs.rmSync(x.root, { recursive: true, force: true })
  }
})

test("relative and symlinked state parents are rejected", () => {
  const x = setup()
  try {
    assert.notEqual(run({ ...x.env, XDG_STATE_HOME: "relative" }, "--write", save(1)).status, 0)
    const victim = path.join(x.root, "victim-parent")
    fs.mkdirSync(victim)
    fs.symlinkSync(victim, x.env.XDG_STATE_HOME, "dir")
    assert.notEqual(run(x.env, "--write", save(1)).status, 0)
    assert.equal(fs.existsSync(path.join(victim, "omarchy", "omatrail", "journey.json")), false)
  } finally { fs.rmSync(x.root, { recursive: true, force: true }) }
})

test("hostile final temp parent FIFO lifecycle evidence stays descriptor bound", () => {
  const source = fs.readFileSync(helper, "utf8")
  for (const primitive of ["O_NOFOLLOW", "O_NONBLOCK", "O_CREAT", "O_EXCL", "sysopen", "rename"])
    assert.match(source, new RegExp(`\\b${primitive}\\b`))
})
