# Changelog

Notable changes to omaTrail. The project follows Semantic Versioning.

Regenerate release entries with:

```bash
scripts/gen-changelog.sh . "omaTrail" "0.1.0"
```

## [Unreleased]

### Added

- Optional Classic 1978-inspired rules profile with an 1847 start, fixed $700
  budget, two-week turns, classic ration pressure, higher fort pricing,
  weighted event pressure, and a 40-round hunting requirement.
- Visible rules selection and labeling across setup, trail art, hunting, saved
  journeys, and endings in both Green Monitor and Color Deluxe.
- Backward-compatible migration of existing saves to the omaTrail rules profile.
- Independent-implementation provenance contract for the historical mechanics.
- Public design decision Gist covering historical research, the anti-copy
  boundary, story, graphics, hunting, architecture, balance defects, and proof.
- Classic fresh-ground hunting cadence and profile-aware balance policies that
  prevent repeated hunting from dominating skilled play.
- Three-act fictional composite trail with party, store, travel, events, rivers,
  hunting, repair, rest, victory, and loss flows.
- Green Monitor and Color Deluxe profiles over identical game state.
- Bounded local save with one last-good recovery copy.
- Deterministic tests, policy playthroughs, Omarchy gates, and Buzz rig lanes.

## [0.1.0] - unreleased

Initial development release.
