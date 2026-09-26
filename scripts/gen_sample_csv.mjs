// One-off generator for a realistic sample public/sales.csv
// Schema: order_id, datetime, branch, product_id, qty, unit_price, customer_id, payment_method, channel
// This file exists only to seed test data — delete it (or keep it) as you like;
// it is not imported by the app.
import fs from 'node:fs'

const branches = ['สาขาเซ็นทรัล', 'สาขามหาวิทยาลัย', 'สาขาไนท์บาซาร์']
const products = [
  { id: 'P001', price: 65 }, // เอสเปรสโซ
  { id: 'P002', price: 75 }, // ลาเต้
  { id: 'P003', price: 85 }, // คาปูชิโน
  { id: 'P004', price: 70 }, // อเมริกาโน่
  { id: 'P005', price: 95 }, // ชาเขียวมัทฉะ
  { id: 'P006', price: 45 }, // ครัวซองต์
  { id: 'P007', price: 55 }, // เค้กกล้วยหอม
]
const paymentMethods = ['cash', 'credit_card', 'promptpay']
const channels = ['walk-in', 'grab', 'line-man', 'shopeefood']

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20250401)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min

const rows = []
let orderSeq = 1
const startDate = new Date('2025-04-01T00:00:00+07:00')
const days = 60

// ~120 recurring member IDs; empty customer_id = walk-in (non-member)
const memberIds = Array.from({ length: 120 }, (_, i) => `M${String(i + 1).padStart(4, '0')}`)

for (let d = 0; d < days; d++) {
  const day = new Date(startDate.getTime() + d * 86400000)
  const isWeekend = [0, 6].includes(day.getUTCDay())
  const ordersToday = int(isWeekend ? 45 : 28, isWeekend ? 65 : 42)

  for (let o = 0; o < ordersToday; o++) {
    const orderId = `BB${String(orderSeq++).padStart(6, '0')}`
    const branch = pick(branches)
    const hour = int(7, 20)
    const minute = int(0, 59)
    const second = int(0, 59)
    const dt = new Date(day)
    dt.setUTCHours(hour, minute, second, 0)
    const iso =
      dt.toISOString().slice(0, 19).replace('Z', '') + '+07:00'

    const isMember = rand() < 0.42
    const customerId = isMember ? pick(memberIds) : ''
    const paymentMethod = pick(paymentMethods)
    const channel = pick(channels)

    const lineItems = int(1, 4)
    const usedProducts = new Set()
    for (let li = 0; li < lineItems; li++) {
      let product = pick(products)
      let guard = 0
      while (usedProducts.has(product.id) && guard < 10) {
        product = pick(products)
        guard++
      }
      usedProducts.add(product.id)
      const qty = int(1, 3)
      rows.push({
        order_id: orderId,
        datetime: iso,
        branch,
        product_id: product.id,
        qty,
        unit_price: product.price,
        customer_id: customerId,
        payment_method: paymentMethod,
        channel,
      })
    }
  }
}

const header = [
  'order_id',
  'datetime',
  'branch',
  'product_id',
  'qty',
  'unit_price',
  'customer_id',
  'payment_method',
  'channel',
]
const csvLines = [header.join(',')]
for (const r of rows) {
  csvLines.push(header.map((h) => r[h]).join(','))
}

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/sales.csv', csvLines.join('\n') + '\n', 'utf8')
console.log(`Wrote ${rows.length} rows (${orderSeq - 1} bills) to public/sales.csv`)
