#!/usr/bin/env node

const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const defaultCandidates = [
  "BarWidget.qml",
  "HuntingBoard.qml",
  "HuntingRules.js",
  "JourneyRules.js",
  "JourneyView.qml",
  "OmatrailButton.qml",
  "Overlay.qml",
  "SaveStore.qml",
  "TrailScene.qml",
  "assets/banner.svg",
  "bin/omatrail-state",
  "manifest.json"
]

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function words(value) {
  return String(value).toLowerCase().match(/[a-z0-9]+/g) || []
}

function normalizedStrings(source) {
  const values = []
  const expression = /(["'])(?:(?!\1|\\).|\\.)*\1/g
  for (const match of source.matchAll(expression)) {
    const value = words(match[0].slice(1, -1)).join(" ")
    if (value) values.push(value)
  }
  return values
}

function ngrams(values, size) {
  const result = new Set()
  for (const value of values) {
    const tokens = words(value)
    for (let index = 0; index + size <= tokens.length; index += 1)
      result.add(tokens.slice(index, index + size).join(" "))
  }
  return result
}

function codeTokens(source, basic) {
  let stripped = source.replace(/(["'])(?:(?!\1|\\).|\\.)*\1/g, " ")
  stripped = basic
    ? stripped.replace(/^\s*\d+\s*/gm, " ").replace(/\bREM\b.*$/gim, " ")
    : stripped.replace(/\/\/.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ")
  return (stripped.toLowerCase().match(/[a-z_][a-z0-9_$]*/g) || [])
}

function tokenNgrams(tokens, size) {
  const result = new Set()
  for (let index = 0; index + size <= tokens.length; index += 1)
    result.add(tokens.slice(index, index + size).join(" "))
  return result
}

function normalizedLines(source, basic) {
  return new Set(source.split(/\r?\n/).map((line) => {
    const withoutNumber = basic ? line.replace(/^\s*\d+\s*/, "") : line
    return words(withoutNumber).join(" ")
  }).filter((line) => line.length >= 30))
}

function intersection(left, right, limit = 20) {
  return [...left].filter((value) => right.has(value)).sort().slice(0, limit)
}

function candidateBundle(files) {
  const resolved = files.map((file) => path.resolve(root, file)).sort()
  const chunks = []
  let source = ""
  for (const file of resolved) {
    const relative = path.relative(root, file)
    const content = fs.readFileSync(file, "utf8")
    chunks.push(Buffer.from(relative + "\0"), Buffer.from(content), Buffer.from("\0"))
    source += "\n" + content
  }
  return { files: resolved.map((file) => path.relative(root, file)), source, sha256: sha256(Buffer.concat(chunks)) }
}

function audit(options) {
  const candidate = candidateBundle(options.candidates || defaultCandidates)
  const reference = fs.readFileSync(options.reference, "utf8")
  const candidateStrings = normalizedStrings(candidate.source)
  const referenceStrings = normalizedStrings(reference)
  const exactStrings = intersection(
    new Set(candidateStrings.filter((value) => words(value).length >= 4 && value.length >= 20)),
    new Set(referenceStrings.filter((value) => words(value).length >= 4 && value.length >= 20))
  )
  const sharedFourWordPhrases = intersection(ngrams(candidateStrings, 4), ngrams(referenceStrings, 4))
  const sharedTwelveTokenCode = intersection(
    tokenNgrams(codeTokens(candidate.source, false), 12),
    tokenNgrams(codeTokens(reference, true), 12)
  )
  const sharedLines = intersection(normalizedLines(candidate.source, false), normalizedLines(reference, true))
  const findings = exactStrings.length + sharedFourWordPhrases.length
    + sharedTwelveTokenCode.length + sharedLines.length
  return {
    schemaVersion: 1,
    method: "exact normalized expression comparison",
    candidate: { files: candidate.files, sha256: candidate.sha256 },
    reference: {
      url: options.referenceUrl,
      commit: options.referenceCommit,
      file: options.referenceFile,
      sha256: sha256(reference)
    },
    thresholds: {
      exactString: "at least four words and 20 normalized characters",
      proseNgramWords: 4,
      codeNgramTokens: 12,
      exactLineCharacters: 30
    },
    metrics: {
      candidateStringLiterals: candidateStrings.length,
      referenceStringLiterals: referenceStrings.length,
      exactStrings,
      sharedFourWordPhrases,
      sharedTwelveTokenCode,
      sharedNormalizedLines: sharedLines
    },
    verdict: findings === 0 ? "NO_NONTRIVIAL_EXACT_MATCHES" : "REVIEW_MATCHES",
    limitation: "This deterministic exact-match audit can detect copied expression above its thresholds. It cannot prove independent creation or provide a legal conclusion."
  }
}

function parseArgs(argv) {
  const options = { candidates: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[index + 1]
    if (["--reference", "--reference-url", "--reference-commit", "--reference-file", "--output", "--candidate"].includes(key) && !value)
      throw new Error(key + " requires a value")
    if (key === "--reference") options.reference = value
    else if (key === "--reference-url") options.referenceUrl = value
    else if (key === "--reference-commit") options.referenceCommit = value
    else if (key === "--reference-file") options.referenceFile = value
    else if (key === "--output") options.output = value
    else if (key === "--candidate") options.candidates.push(value)
    else throw new Error("unknown argument: " + key)
    index += 1
  }
  if (!options.reference || !options.referenceUrl || !options.referenceCommit || !options.referenceFile)
    throw new Error("reference path, URL, commit, and file are required")
  if (!options.candidates.length) delete options.candidates
  return options
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const result = audit(options)
    const rendered = JSON.stringify(result, null, 2) + "\n"
    if (options.output) fs.writeFileSync(options.output, rendered)
    else process.stdout.write(rendered)
    process.exitCode = result.verdict === "NO_NONTRIVIAL_EXACT_MATCHES" ? 0 : 1
  } catch (error) {
    process.stderr.write("provenance-audit: " + error.message + "\n")
    process.exitCode = 2
  }
}

module.exports = { audit, candidateBundle, normalizedStrings, ngrams, codeTokens, tokenNgrams, normalizedLines }
