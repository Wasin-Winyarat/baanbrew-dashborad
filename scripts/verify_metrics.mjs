// Independent cross-check: recompute the same numbers with plain array
// reduce/Set logic (no shared code with src/lib/metrics.js) and diff against
// metrics.js's output. This is the equivalent of "open in Excel, add a
// revenue column, pivot by branch" — done programmatically so it can run in
// this sandbox, but the same idea as the lab's manual verify step.
import fs from 'node:fs'
import Papa from 'papaparse'
import {
  computeBranchSales,
  computeDailySales,
  computeKpis,
} from '../src/lib/metrics.js'

const csvText = fs.readFileSync('public/sales.csv', 'utf8')
const { data: rows } = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
})

// --- independent recomputation, written differently on purpose ---
let independentRevenue = 0
const billSet = new Set()
const memberSet = new Set()
const byBranchIndependent = {}
const byDateIndependent = {}

for (const r of rows) {
  const rev = Number(r.qty) * Number(r.unit_price)
  independentRevenue += rev
  billSet.add(r.order_id)
  if (r.customer_id && r.customer_id.trim() !== '') memberSet.add(r.customer_id)
  byBranchIndependent[r.branch] = (byBranchIndependent[r.branch] || 0) + rev
  const d = r.datetime.slice(0, 10)
  byDateIndependent[d] = (byDateIndependent[d] || 0) + rev
}

const independentAvg = independentRevenue / billSet.size

// --- metrics.js output ---
const kpis = computeKpis(rows)
const daily = computeDailySales(rows)
const branch = computeBranchSales(rows)

function approxEqual(a, b, eps = 0.001) {
  return Math.abs(a - b) < eps
}

let ok = true
function check(name, a, b) {
  const pass = approxEqual(a, b)
  if (!pass) ok = false
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: metrics.js=${a}  independent=${b}`)
}

check('totalRevenue', kpis.totalRevenue, independentRevenue)
check('billCount', kpis.billCount, billSet.size)
check('avgPerBill', kpis.avgPerBill, independentAvg)
check('uniqueMembers', kpis.uniqueMembers, memberSet.size)

for (const row of branch) {
  check(`branch revenue [${row.branch}]`, row.revenue, byBranchIndependent[row.branch])
}
// branch sort order check
const sortedDesc = [...branch].every(
  (r, i, arr) => i === 0 || arr[i - 1].revenue >= r.revenue,
)
console.log(`${sortedDesc ? 'PASS' : 'FAIL'}  branch sales sorted descending`)
if (!sortedDesc) ok = false

let dateSum = 0
for (const d of daily) dateSum += d.revenue
check('sum of daily revenue == totalRevenue', dateSum, independentRevenue)
const sortedAsc = [...daily].every(
  (r, i, arr) => i === 0 || arr[i - 1].date <= r.date,
)
console.log(`${sortedAsc ? 'PASS' : 'FAIL'}  daily sales sorted ascending`)
if (!sortedAsc) ok = false

console.log('\nrows:', rows.length, ' bills:', billSet.size, ' branches:', branch.length, ' days:', daily.length)
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED')
process.exit(ok ? 0 : 1)
