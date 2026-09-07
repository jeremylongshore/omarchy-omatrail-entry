// Replace final and temporary save names with a victim symlink as soon as seen.
const fs = require("node:fs")
const path = require("node:path")
const [dir, victim, ready, attacked] = process.argv.slice(2)
if (ready) fs.writeFileSync(ready, "ready")
for (;;) {
  try {
    for (const name of fs.readdirSync(dir)) {
      if (name !== "journey.json" && name !== "journey.last-good.json" && !name.startsWith(".journey-")) continue
      const candidate = path.join(dir, name)
      try { fs.unlinkSync(candidate) } catch {}
      try {
        fs.symlinkSync(victim, candidate)
        if (attacked) fs.writeFileSync(attacked, "attacked")
      } catch {}
    }
  } catch {}
}
