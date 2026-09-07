# omaTrail Agent Instructions

## Scope

This repository contains the omaTrail Omarchy plugin. Runtime code belongs here;
umbrella planning and portfolio documents belong in the sibling `omarchy`
repository.

## Tracking

Use the Beads database rooted at `/home/jeremy/000-projects` for every task.
Run `bd prime` when context is stale. Do not create markdown TODO lists or ad
hoc memory files.

## Runtime invariants

- Preserve manifest ID `io.github.jeremylongshore.omatrail`.
- Keep the plugin offline and compatible with stock Omarchy.
- Keep rules deterministic and QML presentation thin.
- Keep Green Monitor and Color Deluxe semantically identical.
- Treat hunting, saves, rivers, party health, and scoring as conserved state.
- Use plain bounded text in QML and fixed subprocess argument arrays.
- Do not use em or en dashes in shipped content.
- Do not edit vendored files under `scripts/gates/` by hand.

## Required evidence

Run `npm test` and `scripts/run-plugin-gates.sh .` for every change. Run the
mutation, race, audit, and Buzz lanes before release or marketplace submission.
Do not claim runtime or visual proof without clean hash-bound receipts.

## External changes

Do not create a remote repository, marketplace submission, release, tag, or PR
without explicit user authorization.
