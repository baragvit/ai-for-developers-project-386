// Compares a Vitest JSON report of the conflict tests, run with the overlap check disabled,
// against the list of tests that must fail. Exits non-zero on any mismatch.
import { readFileSync } from 'node:fs'

const [reportPath, expectedPath, testFile] = process.argv.slice(2)

const expected = readFileSync(expectedPath, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const fileResult = report.testResults.find((result) => result.name.endsWith(testFile))
const tests = fileResult?.assertionResults ?? []

const problems = []
if (tests.length === 0) {
  problems.push(`no tests ran in ${testFile}${fileResult?.message ? `: ${fileResult.message}` : ''}`)
}

const status = new Map(tests.map((test) => [test.fullName, test.status]))
for (const name of expected) {
  if (!status.has(name)) problems.push(`missing (deleted or renamed?): ${name}`)
  else if (status.get(name) !== 'failed') problems.push(`${status.get(name)} with the rule disabled (weakened?): ${name}`)
}
for (const test of tests) {
  if (test.status === 'failed' && !expected.includes(test.fullName)) {
    problems.push(`failed but not listed in ${expectedPath}: ${test.fullName}`)
  }
}

if (problems.length > 0) {
  console.error('rule-guard: the conflict tests do not guard the no-overlap rule:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`rule-guard: all ${expected.length} guarding tests failed with the overlap check disabled; the rest passed.`)
