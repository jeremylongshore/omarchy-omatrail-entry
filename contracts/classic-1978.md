# How we designed the Classic 1978-inspired profile for omaTrail

## The product question

The request sounded simple: could omaTrail learn from the original Oregon Trail
without becoming a copy of it?

We treated that as three separate requirements:

1. Preserve the decisions that made the early game memorable.
2. Keep omaTrail's story, artwork, interface, hunting game, and implementation
   recognizably its own.
3. Give players a choice instead of replacing the existing game.

That led to two independent selectors. A player chooses an **omaTrail** or
**Classic 1978-inspired** rules profile, then independently chooses **Green
Monitor** or **Color Deluxe** graphics. All four combinations are supported.

## Research and source hierarchy

Our primary historical source was the Oregon Trail program listing published in
the May/June 1978 issue of Creative Computing:

- [Creative Computing, May/June 1978 scan](https://archive.org/details/CreativeComputingbetterScan197805)

We used the listing to observe functional behavior, not as reusable source code.
Third-party ports can help locate a publication, but they are not accepted as
authoritative code. The magazine scan also carries a 1978 copyright notice, so
the fact that a listing can be read online does not make wholesale copying an
appropriate product decision.

The boundary is deliberate. No BASIC statements, control flow, identifiers,
prompts, prose, data tables, or artwork from the publication are included in
omaTrail. We extracted gameplay ideas, wrote a behavior contract in plain
language, and independently implemented that contract in the existing
deterministic omaTrail engine.

The [provenance and expression audit](provenance.md) records the source ledger,
reference commit and hashes, permitted-use boundary, automated comparison, and
its limitations. The retained comparison found no nontrivial exact string,
four-word prose, 12-token code, or normalized-line matches.

## What we learned and how we translated it

The historical listing established a recognizable pattern: fixed outfitting
money, an 1847 departure, travel in roughly two-week decisions, more expensive
fort purchases, three ration levels, repeated trail hazards, mountain pressure,
and a minimum ammunition threshold before hunting.

The Classic 1978-inspired profile translates those broad mechanics into
omaTrail's own units and systems:

- the journey begins in 1847 with a fixed $700 budget;
- a travel decision advances 14 days;
- distance responds to oxen, pace, terrain, equipment condition, and the seeded
  random stream;
- the three ration settings consume 13, 18, or 23 food units per turn, scaled
  to the number of living travelers;
- fort prices use a 1.5 multiplier;
- deterministic event pressure is higher and uses independently selected
  category weights;
- a graphical hunt requires at least 40 rounds;
- a hunt carries at most 100 pounds, and excess harvest is recorded as waste;
- the party must travel to fresh ground before beginning another Classic hunt.

The last rule protects a core omaTrail product requirement: hunting should be a
valuable choice, not an infinite-food loop. It also fits the original cadence,
where hunting was one decision inside a travel turn.

## Why we kept both games

Replacing the existing balance would have taken a choice away from current
players. The omaTrail profile therefore keeps four-day turns and occupation
budgets. The Classic 1978-inspired profile supplies the fixed-budget,
longer-turn alternative. Both use the same complete journey, so this is not a
short demo mode.

The graphics choice is orthogonal to the rules choice. Green Monitor supplies
the requested green-on-black CRT character, while Color Deluxe uses the warmer
illustrated palette. Changing the display profile cannot change inventory,
random state, hunting results, health, rivers, events, or scoring. Semantic
snapshot tests enforce that separation.

## Story and visual design

Historical mechanics do not require borrowed expression. Both rules profiles
use omaTrail's fictional 1,620-mile route and original three-act structure:

- **Leaving the Known** moves from outfitting into the first open-country
  decisions.
- **The Long Middle** makes fatigue, supplies, relationships, and repairs
  accumulate.
- **Last High Country** turns weather and earlier tradeoffs into the ending.

All travelers, locations, events, choices, outcomes, and descriptions are
fictional composites written for omaTrail. The route art, wagon, rivers,
landmarks, wildlife, result panels, and both palettes are project-authored QML
and SVG work.

The Green Monitor treatment is more than a color filter. It uses a near-black
field, green hierarchy, monospaced presentation, scanline treatment, and trail
markers designed to remain readable at the Omarchy overlay size. Reduced-motion
mode disables the animated CRT and river-current treatments without concealing
information.

## Hunting stayed graphical

The 1978 listing used a typing-speed hunting interaction. We retained the part
players remember, the risk-reward break from menu decisions, but expressed it
through omaTrail's original real-time hunting field.

Players move the hunter, aim, fire, watch moving region-eligible wildlife,
manage ammunition, pause, use optional aim assistance, and decide when to
return. Settlement reconciles shots, harvested pounds, carry capacity,
spoilage, waste, expedition time, fatigue, injury risk, and food added to the
wagon. Keyboard and mouse both cover the complete action set.

This was an intentional "learn, then design" choice: the Classic profile changes
the economic envelope around the hunt while the actual hunting game remains
omaTrail's own interaction and artwork.

## Architecture decisions

Rules live in pure JavaScript state machines. QML owns presentation, focus, and
persistence I/O, but it does not secretly calculate outcomes. That split makes
every meaningful decision deterministic and replayable from the same seed,
profile, and ordered actions.

The selected rules profile is part of the bounded save document and ending
record. Existing saves that predate the selector migrate to the omaTrail profile
instead of failing or silently receiving Classic behavior. The save helper keeps
one primary save and one last-good backup using descriptor-bound local file
operations. The runtime has no network calls, telemetry, account, daemon, or
elevated permission.

## How the balance process changed the design

We did not accept "it feels about right" as balance evidence. The simulation
lane composes the same public journey dispatcher and hunting engine used by the
interface. It covers:

- 2 rules profiles;
- 5 versioned player policies;
- 3 difficulties;
- 4 occupations;
- 4 departure months;
- 480 matrix cells and 100,000 fixed-seed journeys.

The first large study exposed a genuine problem: the Classic exploit policy won
98.96 percent, above both policies labeled skilled. Investigation showed two
separate causes. Repeated hunting needed a fresh-ground constraint, and the
fixed $700 budget made the original skilled shopping lists spend their cash
before buying wagon parts. We fixed the gameplay constraint and made the
simulated skilled policies budget-aware, then discarded the obsolete report and
reran the full study.

The retained report records 100,000 terminal journeys with zero nonterminal
runs. Its aggregate SHA-256 is
`c6dfb3d1a8696ad235166e8d28ec3525e88820bd4b2cb1c1a4416553a9c8fe03`.
Across both profiles, skilled-heavy wins 82.56 percent, skilled-light wins 77.22
percent, and the exploit policy wins 51.82 percent. In the Classic profile, the
two skilled policies win 99.16 and 99.12 percent, while exploit wins 98.96
percent and earns a much lower median score: 1,523 versus 2,221 and 2,160. The
exploit also averages about 735 pounds of avoidable waste.

Those relationships are now executable acceptance tests. A stale report, a
changed engine hash, a nonterminal run, or hunting dominance fails the suite.

## Verification depth

The release lane is intentionally layered:

| Question | Evidence |
| --- | --- |
| Are state transitions correct and bounded? | Unit, integration, hostile-input, migration, and conservation tests |
| Can careful play finish every profile and difficulty? | 360 fixed-seed policy journeys, with a minimum 75 percent success band in every cell |
| Is hunting strategically viable without dominating? | 100,000-run, 480-cell balance report with engine and aggregate hashes |
| Do tests catch meaningful logic changes? | Mutation testing over hunting settlement, journey reconciliation, and save parsing |
| Are repeated runs stable? | Three concurrent race repetitions with zero tolerated flakes |
| Does it load in actual Omarchy? | The real Omarchy validator, `qmllint`, and Buzz shell receipts |
| Do all combinations render? | 20 frames: 5 critical scenes by 2 rules profiles by 2 visual profiles |
| Does the listing match the product? | Claim ledger, exact 500-character description, screenshot receipts, and human visual approval |

The five retained scenes are trail travel, event, river, graphical hunt, and
ending. Each frame has a raw shell log and a hash-bound receipt. Release evidence
must come from a clean exact revision; dirty development captures are useful for
debugging but cannot qualify a marketplace submission.

## Alternatives we rejected

- **Port the BASIC listing.** Rejected because it would import another work's
  expression and would fight omaTrail's tested state-machine architecture.
- **Replace omaTrail balance with Classic rules.** Rejected because players
  asked for both versions.
- **Make Classic a visual skin.** Rejected because the meaningful difference is
  rules, not nostalgia-colored pixels.
- **Recreate the typing-speed hunt.** Rejected because graphical hunting is one
  of omaTrail's defining interactions and the feature players most wanted kept.
- **Let Green and Color modes diverge.** Rejected because visuals should never
  change odds, saves, or outcomes.
- **Publish a favorable hand-picked seed.** Rejected in favor of deterministic
  tests, a 100,000-run distribution, and retained real-shell evidence.

## The resulting promise

omaTrail is historically informed but independently expressed. A player can
choose the current omaTrail game or the Classic 1978-inspired pressure model,
then play either one in Green Monitor or Color Deluxe. In every combination the
full original omaTrail story, graphical hunting, rivers, party management,
accessibility, deterministic saves, and offline-only runtime remain intact.

Repository: [jeremylongshore/omarchy-omatrail-entry](https://github.com/jeremylongshore/omarchy-omatrail-entry)
