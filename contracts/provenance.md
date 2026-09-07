# omaTrail provenance and expression audit

## Disposition

omaTrail may learn from historical game mechanics, but it does not import the
historical program's expression. The accepted boundary is behavioral ideas
implemented inside omaTrail's existing deterministic JavaScript architecture.
Historical source code, prompts, prose, identifiers, control flow, tables,
names, dialogue, and artwork are rejected as implementation inputs.

This is a project provenance record and technical comparison, not a legal
opinion.

## Source ledger

| Source | Authority and rights signal | Permitted use | Imported into omaTrail |
| --- | --- | --- | --- |
| [Creative Computing May/June 1978 scan](https://archive.org/details/CreativeComputingbetterScan197805), pages 132 to 139 | Primary publication. The issue carries a 1978 copyright notice. | Observe broad mechanics and historical context. | No |
| [TedThompson/OREGON78](https://github.com/TedThompson/OREGON78) at `38959e87c94886d7fee4d0da106322009f2ad2d4` | Third-party Applesoft port under GPL-3.0. `OREGON78.RC.abas` SHA-256 is `f8a9995fbda5485cf61b03d21aaf39c60df4f43bcf42a1a035f0e11cda103f90`. | Locate and cross-check the published listing, then serve as a non-shipped comparison corpus. | No |
| omaTrail baseline at `682a0ae960e5ce4d9b5f3e411580bcf8c3708cfb` | Project-owned pre-Classic implementation. | Preserve the original omaTrail profile, story, interface, and graphical hunt. | Existing project source only |
| Current QML, JavaScript, SVG, and fixture files | Project-authored implementation and assets. | Shipped product. | Yes |

No historical source file, emulator image, WAV recording, screenshot, prompt,
or third-party asset is stored in this repository or required at runtime.

## Reproducible expression comparison

`scripts/provenance-audit.js` compares the shipped runtime and marketplace art
against an external reference file. The retained report is
`reports/provenance/oregon78-similarity.json`. It binds both sides by SHA-256 and
records the exact reference repository commit without retaining the GPL source.

The comparison checks four independent exact-match surfaces:

- complete normalized string literals of at least four words and 20 characters;
- every normalized four-word phrase inside string literals;
- normalized 12-token code sequences after removing strings and comments;
- normalized source lines of at least 30 characters.

The retained audit reports zero matches in all four surfaces and returns
`NO_NONTRIVIAL_EXACT_MATCHES`. Tests bind the report to the current shipped-file
hash and prove the detector reports a deliberately copied fixture.

To reproduce it, obtain the pinned reference commit outside this repository and
run:

```bash
node scripts/provenance-audit.js \
  --reference /path/to/OREGON78.RC.abas \
  --reference-url https://github.com/TedThompson/OREGON78 \
  --reference-commit 38959e87c94886d7fee4d0da106322009f2ad2d4 \
  --reference-file OREGON78.RC.abas \
  --output reports/provenance/oregon78-similarity.json
```

Exact comparison has limits. It can catch copied expression above the stated
thresholds, but cannot prove independent creation, detect every possible
paraphrase, or replace human and legal review. The stronger evidence is the
combination of the source ledger, separate language and architecture, original
fictional route and graphics, clean Git history, hash-bound comparison, and an
explicit rule that historical expression is not an implementation input.
