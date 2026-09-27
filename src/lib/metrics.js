// src/lib/metrics.js
//
// All sales-number logic lives here, and only here — components just call
// these functions and render the result. That way any number shown on the
// dashboard can be re-derived (and re-checked against a spreadsheet pivot
// table) by reading one file.
//
// Expected row shape (one row = one product line on one bill):
//   { order_id, datetime, branch, product_id, qty, unit_price, customer_id,
//     payment_method, channel }
// Business rules this file encodes:
//   - revenue for a row = qty * unit_price
//   - a bill = one order_id; a bill can span several rows (several products)
//   - customer_id === '' (or missing) means a walk-in, non-member customer
//   - datetime is already a Thai local timestamp, e.g. "2025-04-01T18:48:40+07:00"

/**
 * Revenue contributed by a single CSV row.
 * @param {{qty: number|string, unit_price: number|string}} row
 * @returns {number}
 */
export function rowRevenue(row) {
  const qty = Number(row.qty) || 0
  const unitPrice = Number(row.unit_price) || 0
  return qty * unitPrice
}

/**
 * Pulls the calendar-day part ("YYYY-MM-DD") out of a Thai-local ISO
 * datetime string. We deliberately take the first 10 characters instead of
 * going through `new Date(...)` — the string already IS Thai local time, so
 * slicing avoids any risk of the browser's local timezone shifting the date.
 * @param {string} datetime
 * @returns {string}
 */
export function dateKey(datetime) {
  return String(datetime).slice(0, 10)
}

/**
 * The four headline KPI numbers.
 *
 * - totalRevenue: sum of qty*unit_price across every row (every product
 *   line), regardless of which bill it belongs to.
 * - billCount: number of *distinct* order_id values — this is "how many
 *   bills", not "how many rows". A bill with 3 products is still one bill.
 * - avgPerBill: totalRevenue / billCount — average spend per receipt.
 * - uniqueMembers: number of distinct non-empty customer_id values. Rows
 *   with an empty customer_id are walk-in customers and are not counted
 *   here (they are not "no members", they are simply not members).
 *
 * @param {Array<object>} rows
 */
export function computeKpis(rows) {
  let totalRevenue = 0
  const billIds = new Set()
  const memberIds = new Set()

  for (const row of rows) {
    totalRevenue += rowRevenue(row)
    if (row.order_id) billIds.add(row.order_id)
    if (row.customer_id && String(row.customer_id).trim() !== '') {
      memberIds.add(row.customer_id)
    }
  }

  const billCount = billIds.size
  const avgPerBill = billCount > 0 ? totalRevenue / billCount : 0

  return {
    totalRevenue,
    billCount,
    avgPerBill,
    uniqueMembers: memberIds.size,
  }
}

/**
 * Revenue grouped by calendar day, sorted oldest first — the series the
 * daily LineChart plots.
 * @param {Array<object>} rows
 * @returns {Array<{date: string, revenue: number}>}
 */
export function computeDailySales(rows) {
  const byDate = new Map()
  for (const row of rows) {
    const key = dateKey(row.datetime)
    byDate.set(key, (byDate.get(key) || 0) + rowRevenue(row))
  }
  if (byDate.size === 0) return []

  // Fill every calendar day between the first and last date, with 0 for days
  // that had no sales (e.g. a branch closed for a day). Without this a
  // "7-point" moving average would silently span more than 7 days.
  const keys = Array.from(byDate.keys()).sort()
  const result = []
  for (let day = keys[0]; day <= keys[keys.length - 1]; day = nextDateKey(day)) {
    result.push({ date: day, revenue: byDate.get(day) || 0 })
  }
  return result
}

/**
 * The calendar day after a "YYYY-MM-DD" key. Uses UTC arithmetic so the
 * browser's timezone and daylight-saving rules can never skip or repeat a day.
 * @param {string} key
 */
export function nextDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/**
 * Rows matching the dashboard filters. Dates compare as "YYYY-MM-DD" strings
 * (same order as calendar order), and both ends are inclusive.
 * @param {Array<object>} rows
 * @param {{branch?: string, from?: string, to?: string}} filters
 *   branch '' = all branches; from/to '' = no limit on that side
 */
export function filterRows(rows, { branch = '', from = '', to = '' } = {}) {
  return rows.filter((row) => {
    if (branch && row.branch !== branch) return false
    const day = dateKey(row.datetime)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
}

/**
 * Adds a trailing N-day moving average (`ma`) to each point of a daily
 * series from computeDailySales. The average for a day covers that day and
 * the N-1 days before it. The first N-1 days have no full window yet, so
 * their `ma` is null and the chart line starts on day N rather than showing
 * an average of fewer days.
 * Relies on computeDailySales returning one point per calendar day (gaps are
 * filled with 0), so N points always means N calendar days.
 * @param {Array<{date: string, revenue: number}>} daily
 * @param {number} [windowDays=7]
 * @returns {Array<{date: string, revenue: number, ma: number|null}>}
 */
export function addMovingAverage(daily, windowDays = 7) {
  let windowSum = 0
  return daily.map((point, i) => {
    windowSum += point.revenue
    if (i >= windowDays) windowSum -= daily[i - windowDays].revenue
    const ma = i >= windowDays - 1 ? windowSum / windowDays : null
    return { ...point, ma }
  })
}

/**
 * Revenue grouped by branch, sorted highest first — the series the branch
 * BarChart plots.
 * @param {Array<object>} rows
 * @returns {Array<{branch: string, revenue: number}>}
 */
export function computeBranchSales(rows) {
  const byBranch = new Map()
  for (const row of rows) {
    const key = row.branch || '(ไม่ระบุสาขา)'
    byBranch.set(key, (byBranch.get(key) || 0) + rowRevenue(row))
  }
  return Array.from(byBranch, ([branch, revenue]) => ({ branch, revenue })).sort(
    (a, b) => b.revenue - a.revenue,
  )
}

/**
 * Formats a number of baht with thousands separators and a "฿" suffix,
 * e.g. formatBaht(123456.7) -> "฿123,457".
 * @param {number} value
 */
export function formatBaht(value) {
  return `฿${Math.round(value).toLocaleString('th-TH')}`
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/**
 * Formats a "YYYY-MM-DD" date key as a short Thai date with a 2-digit
 * Buddhist-era year, e.g. formatThaiShortDate('2025-04-01') -> "1 เม.ย. 68".
 * Parses the string directly (like dateKey) so no timezone shift can occur.
 * @param {string} key
 */
export function formatThaiShortDate(key) {
  const [year, month, day] = String(key).split('-').map(Number)
  if (!year || !month || !day) return String(key)
  const beYear = String((year + 543) % 100).padStart(2, '0')
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${beYear}`
}

/**
 * Formats a plain count with thousands separators, e.g. formatCount(12345)
 * -> "12,345".
 * @param {number} value
 */
export function formatCount(value) {
  return Math.round(value).toLocaleString('th-TH')
}
