// ฟังก์ชันคำนวณของหน้า "ลูกค้า" · แยกจาก UI เหมือน src/lib/metrics.js
// customers: แถวจาก customers.csv (customer_id, gender, age_group, home_branch_id, joined_date)
// sales:     แถวดิบจาก sales.csv (customer_id ว่าง = ลูกค้า walk-in ไม่ใช่สมาชิก)
// branches:  แถวจาก branches.csv (branch_id, branch, opened_date, ...)
import { dateKey } from '../lib/metrics.js'

// ช่วงอายุเป็นข้อมูลที่มีลำดับ เรียงตามอายุ ไม่เรียงตามจำนวน
export const AGE_ORDER = ['ต่ำกว่า 18', '18-24', '25-34', '35-44', '45-54', '55+']

/** จำนวนสมาชิกต่อช่วงอายุ เรียงจากอายุน้อยไปมาก พร้อมสัดส่วน */
export function membersByAge(customers) {
  const counts = new Map(AGE_ORDER.map((a) => [a, 0]))
  for (const c of customers) counts.set(c.age_group, (counts.get(c.age_group) || 0) + 1)
  const total = customers.length
  return Array.from(counts, ([age, count]) => ({ age, count, share: total ? count / total : 0 }))
}

/**
 * สัดส่วนบิลที่เป็นของสมาชิก แยกตามสาขาที่ขาย เรียงมากไปน้อย
 * นับเป็นบิล (order_id ไม่ซ้ำ) ไม่ใช่แถว เพราะ 1 บิลมีหลายแถว
 */
export function memberBillShareByBranch(sales) {
  const byBranch = new Map()
  for (const row of sales) {
    const cur = byBranch.get(row.branch) ?? { branch: row.branch, bills: new Set(), memberBills: new Set() }
    cur.bills.add(row.order_id)
    if (row.customer_id) cur.memberBills.add(row.order_id)
    byBranch.set(row.branch, cur)
  }
  return Array.from(byBranch.values())
    .map((b) => ({
      branch: b.branch,
      bills: b.bills.size,
      memberBills: b.memberBills.size,
      share: b.memberBills.size / b.bills.size,
    }))
    .sort((a, b) => b.share - a.share)
}

/**
 * สมาชิกใหม่รายเดือนจาก joined_date
 * dataEnd = วันสุดท้ายที่มีข้อมูล ใช้บอกว่าเดือนสุดท้ายมีข้อมูลครบเดือนหรือไม่
 */
export function newMembersByMonth(customers, dataEnd) {
  const byMonth = new Map()
  for (const c of customers) {
    const m = c.joined_date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) || 0) + 1)
  }
  const endMonth = dataEnd.slice(0, 7)
  const endDay = Number(dataEnd.slice(8, 10))
  return Array.from(byMonth, ([month, count]) => {
    const full = daysInMonth(month)
    const days = month === endMonth ? endDay : full
    return { month, count, days, fullDays: full, partial: days < full }
  }).sort((a, b) => (a.month < b.month ? -1 : 1))
}

/** จำนวนวันในเดือน "YYYY-MM" (ใช้ UTC จึงไม่ขึ้นกับ timezone ของเครื่อง) */
export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// กลุ่มความถี่การซื้อ: [ป้าย, จำนวนบิลต่ำสุด, สูงสุด]
const VISIT_BUCKETS = [
  ['ยังไม่เคยซื้อ', 0, 0],
  ['1 บิล', 1, 1],
  ['2–3 บิล', 2, 3],
  ['4–9 บิล', 4, 9],
  ['10 บิลขึ้นไป', 10, Infinity],
]

/**
 * สมาชิกแต่ละคนซื้อกี่บิล จัดเป็นกลุ่ม (รวมสมาชิกที่ยังไม่เคยซื้อด้วย)
 * คืนค่า buckets และ billsPerMember (Map customer_id -> จำนวนบิล) ไว้คำนวณข้อความสรุป
 */
export function memberVisitBuckets(customers, sales) {
  const bills = new Map()
  for (const row of sales) {
    if (!row.customer_id) continue
    const set = bills.get(row.customer_id) ?? new Set()
    set.add(row.order_id)
    bills.set(row.customer_id, set)
  }
  const perMember = customers.map((c) => bills.get(c.customer_id)?.size ?? 0)
  const buckets = VISIT_BUCKETS.map(([label, lo, hi]) => ({
    label,
    count: perMember.filter((n) => n >= lo && n <= hi).length,
  }))
  const buyers = perMember.filter((n) => n > 0)
  const repeat = buyers.filter((n) => n >= 2).length
  return {
    buckets,
    total: customers.length,
    buyers: buyers.length,
    repeatShare: buyers.length ? repeat / buyers.length : 0,
    medianBills: median(buyers),
  }
}

function median(values) {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** วันสุดท้ายที่มีข้อมูลการขาย ("YYYY-MM-DD") */
export function lastSaleDate(sales) {
  let max = ''
  for (const row of sales) {
    const d = dateKey(row.datetime)
    if (d > max) max = d
  }
  return max
}

/**
 * วันสุดท้ายในไฟล์สมาชิก ("YYYY-MM-DD") ใช้เป็นวันสิ้นสุดของข้อมูลสมาชิกใหม่
 * ห้ามใช้วันสุดท้ายของ sales แทน: ไฟล์สองไฟล์อาจ export คนละวัน ถ้าใช้วันของ sales
 * จะหารด้วยวันที่ไม่มีข้อมูลสมาชิก ทำให้ดูเหมือนสมาชิกใหม่ลดลงทั้งที่ข้อมูลแค่ยังไม่มา
 */
export function lastJoinedDate(customers) {
  let max = ''
  for (const c of customers) if (c.joined_date > max) max = c.joined_date
  return max
}
