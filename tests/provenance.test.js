const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const Provenance = require("../scripts/provenance-audit.js")

const root = path.join(__dirname, "..")

test("retained historical comparison is bound to current shipped expression", () => {
  const report = JSON.parse(fs.readFileSync(path.join(root, "reports/provenance/oregon78-similarity.json"), "utf8"))
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.reference.commit, "38959e87c94886d7fee4d0da106322009f2ad2d4")
  assert.equal(report.reference.sha256, "f8a9995fbda5485cf61b03d21aaf39c60df4f43bcf42a1a035f0e11cda103f90")
  assert.equal(report.candidate.sha256, Provenance.candidateBundle(report.candidate.files).sha256)
  assert.deepEqual(report.metrics.exactStrings, [])
  assert.deepEqual(report.metrics.sharedFourWordPhrases, [])
  assert.deepEqual(report.metrics.sharedTwelveTokenCode, [])
  assert.deepEqual(report.metrics.sharedNormalizedLines, [])
  assert.equal(report.verdict, "NO_NONTRIVIAL_EXACT_MATCHES")
  assert.match(report.limitation, /cannot prove independent creation or provide a legal conclusion/)
})

test("historical comparison reports copied nontrivial expression", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "omatrail-provenance-"))
  try {
    const candidate = path.join(directory, "candidate.js")
    const reference = path.join(directory, "reference.bas")
    const copied = "a deliberately copied phrase with enough words"
    fs.writeFileSync(candidate, `const message = "${copied}"\n`)
    fs.writeFileSync(reference, `100 PRINT "${copied.toUpperCase()}"\n`)
    const report = Provenance.audit({
      candidates: [candidate],
      reference,
      referenceUrl: "https://example.invalid/reference",
      referenceCommit: "fixture",
      referenceFile: "reference.bas"
    })
    assert.equal(report.verdict, "REVIEW_MATCHES")
    assert.deepEqual(report.metrics.exactStrings, [copied])
    assert.ok(report.metrics.sharedFourWordPhrases.length > 0)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
