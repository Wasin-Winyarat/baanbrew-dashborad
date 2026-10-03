import { describe, expect, it } from 'vitest'
import {
  addMovingAverage,
  computeBranchSales,
  computeDailySales,
  computeKpis,
  computeTopProducts,
  dailyRevenue,
  dateKey,
  filterRows,
  formatBaht,
  formatCount,
  formatShortBaht,
  formatThaiShortDate,
  hourlyRevenue,
  nextDateKey,
  prepareRows,
  rowRevenue,
} from './metrics'

// แถวตัวอย่างหน้าตาเหมือน sales.csv (ค่าเป็นสตริงเหมือนที่ Papa.parse ให้มา)
const row = (o = {}) => ({
  order_id: 'ORD0000001',
  datetime: '2025-04-01T09:15:00+07:00',
  branch: 'สยาม',
  product_id: 'P001',
  qty: '1',
  unit_price: '50',
  customer_id: '',
  payment_method: 'เงินสด',
  channel: 'หน้าร้าน',
  ...o,
})

// 3 บิล 5 แถว · บิล 1 มี 2 เมนู · สมาชิก C00001 ซื้อ 2 บิล
const sample = [
  row({ order_id: 'B1', qty: '2', unit_price: '60', customer_id: 'C00001' }), // 120
  row({ order_id: 'B1', product_id: 'P002', qty: '1', unit_price: '45', customer_id: 'C00001' }), // 45
  row({ order_id: 'B2', datetime: '2025-04-02T23:59:59+07:00', branch: 'สีลม', qty: '3', unit_price: '50' }), // 150
  row({ order_id: 'B3', datetime: '2025-04-04T07:00:00+07:00', qty: '1', unit_price: '80', customer_id: 'C00001' }), // 80
  row({ order_id: 'B3', datetime: '2025-04-04T07:00:00+07:00', product_id: 'P003', qty: '1', unit_price: '25', customer_id: 'C00001' }), // 25
]

describe('rowRevenue', () => {
  it('= qty × unit_price และรับค่าที่เป็นสตริงได้', () => {
    expect(rowRevenue({ qty: '3', unit_price: '45.5' })).toBe(136.5)
  })

  it('ค่าว่างหรือไม่ใช่ตัวเลขนับเป็น 0 ไม่ใช่ NaN', () => {
    expect(rowRevenue({ qty: '', unit_price: '50' })).toBe(0)
    expect(rowRevenue({ qty: '2', unit_price: 'abc' })).toBe(0)
  })
})

describe('dateKey', () => {
  it('ตัดเอาวันที่ตามเวลาไทย ไม่แปลงเป็น UTC', () => {
    // 00:30 เวลาไทย = 17:30 UTC ของวันก่อน ถ้าแปลงผ่าน Date จะได้วันผิด
    expect(dateKey('2025-04-02T00:30:00+07:00')).toBe('2025-04-02')
  })
})

describe('nextDateKey', () => {
  it('ข้ามเดือน ข้ามปี และวันที่ 29 ก.พ. ปีอธิกสุรทิน', () => {
    expect(nextDateKey('2025-04-30')).toBe('2025-05-01')
    expect(nextDateKey('2025-12-31')).toBe('2026-01-01')
    expect(nextDateKey('2024-02-28')).toBe('2024-02-29')
    expect(nextDateKey('2025-02-28')).toBe('2025-03-01')
  })
})

describe('computeKpis', () => {
  it('ยอดขายรวมทุกแถว และนับบิลจาก order_id ที่ไม่ซ้ำ ไม่ใช่จำนวนแถว', () => {
    const k = computeKpis(sample)
    expect(k.totalRevenue).toBe(420)
    expect(k.billCount).toBe(3)
    expect(k.avgPerBill).toBe(140)
  })

  it('สมาชิกนับไม่ซ้ำ และไม่นับลูกค้า walk-in (customer_id ว่าง)', () => {
    const k = computeKpis([...sample, row({ order_id: 'B4', customer_id: '   ' })])
    expect(k.uniqueMembers).toBe(1)
  })

  it('ไม่มีข้อมูล: ยอดเฉลี่ยต่อบิลเป็น 0 ไม่ใช่ NaN', () => {
    expect(computeKpis([])).toEqual({ totalRevenue: 0, billCount: 0, avgPerBill: 0, uniqueMembers: 0 })
  })
})

describe('computeDailySales', () => {
  it('รวมยอดรายวัน เรียงจากเก่าไปใหม่ และเติม 0 ให้วันที่ไม่มียอดขาย', () => {
    expect(computeDailySales(sample)).toEqual([
      { date: '2025-04-01', revenue: 165 },
      { date: '2025-04-02', revenue: 150 },
      { date: '2025-04-03', revenue: 0 },
      { date: '2025-04-04', revenue: 105 },
    ])
  })

  it('ไม่มีข้อมูลได้อาร์เรย์ว่าง', () => {
    expect(computeDailySales([])).toEqual([])
  })
})

describe('filterRows', () => {
  it('กรองสาขา', () => {
    expect(filterRows(sample, { branch: 'สีลม' }).map((r) => r.order_id)).toEqual(['B2'])
  })

  it('ช่วงวันที่นับรวมทั้งวันแรกและวันสุดท้าย (รวมบิล 23:59 ของวันสุดท้าย)', () => {
    const ids = filterRows(sample, { from: '2025-04-02', to: '2025-04-02' }).map((r) => r.order_id)
    expect(ids).toEqual(['B2'])
  })

  it('ไม่ใส่ตัวกรองได้ข้อมูลครบ', () => {
    expect(filterRows(sample)).toHaveLength(sample.length)
    expect(filterRows(sample, { branch: '', from: '', to: '' })).toHaveLength(sample.length)
  })
})

describe('addMovingAverage', () => {
  const daily = [10, 20, 30, 40, 50].map((revenue, i) => ({ date: `2025-04-0${i + 1}`, revenue }))

  it('วันที่ยังไม่ครบหน้าต่างเป็น null ไม่ใช่ค่าเฉลี่ยของวันที่น้อยกว่า', () => {
    expect(addMovingAverage(daily, 3).map((d) => d.ma)).toEqual([null, null, 20, 30, 40])
  })

  it('ค่าเริ่มต้นคือ 7 วัน และเก็บ field เดิมไว้', () => {
    const week = Array.from({ length: 8 }, (_, i) => ({ date: `d${i}`, revenue: 7 }))
    const out = addMovingAverage(week)
    expect(out[5].ma).toBeNull()
    expect(out[6]).toEqual({ date: 'd6', revenue: 7, ma: 7 })
    expect(out[7].ma).toBe(7)
  })
})

describe('computeBranchSales', () => {
  it('รวมยอดต่อสาขา เรียงมากไปน้อย', () => {
    expect(computeBranchSales(sample)).toEqual([
      { branch: 'สยาม', revenue: 270 },
      { branch: 'สีลม', revenue: 150 },
    ])
  })

  it('แถวที่ไม่มีสาขาไปรวมไว้ที่ (ไม่ระบุสาขา)', () => {
    expect(computeBranchSales([row({ branch: '' })])).toEqual([{ branch: '(ไม่ระบุสาขา)', revenue: 50 }])
  })
})

describe('computeTopProducts', () => {
  const menu = [
    { product_id: 'P001', product_name: 'อเมริกาโน่ร้อน', category: 'กาแฟ' },
    { product_id: 'P002', product_name: 'ลาเต้เย็น', category: 'กาแฟ' },
    { product_id: 'P003', product_name: 'ครัวซองต์', category: 'เบเกอรี่' },
  ]
  // sample: P001 = 120 + 150 + 80 = 350 (6 ชิ้น) · P002 = 45 (1) · P003 = 25 (1) · รวม 420

  it('เรียงตามยอดขายมากไปน้อย รวมจำนวนชิ้น และใส่ชื่อกับหมวดจากเมนู', () => {
    expect(computeTopProducts(sample, menu)).toEqual([
      { productId: 'P001', name: 'อเมริกาโน่ร้อน', category: 'กาแฟ', revenue: 350, qty: 6, share: 350 / 420 },
      { productId: 'P002', name: 'ลาเต้เย็น', category: 'กาแฟ', revenue: 45, qty: 1, share: 45 / 420 },
      { productId: 'P003', name: 'ครัวซองต์', category: 'เบเกอรี่', revenue: 25, qty: 1, share: 25 / 420 },
    ])
  })

  it('ตัดตาม limit แต่สัดส่วนยังเทียบกับยอดขายทั้งหมด', () => {
    const top = computeTopProducts(sample, menu, 1)
    expect(top).toHaveLength(1)
    expect(top[0].share).toBeCloseTo(350 / 420)
  })

  it('เมนูที่ไม่อยู่ใน products ใช้รหัสแทนชื่อ และไม่มีข้อมูลได้อาร์เรย์ว่าง', () => {
    expect(computeTopProducts([row({ product_id: 'P999' })])[0]).toMatchObject({ productId: 'P999', name: 'P999', category: '' })
    expect(computeTopProducts([], menu)).toEqual([])
  })
})

describe('prepareRows และ dailyRevenue (Lab 2.2)', () => {
  it('เพิ่ม revenue เป็นตัวเลข, date และ hour ตามเวลาไทย และตัดแถวที่ไม่มี order_id', () => {
    const out = prepareRows([...sample, row({ order_id: '' })])
    expect(out).toHaveLength(sample.length)
    expect(out[2]).toMatchObject({ order_id: 'B2', revenue: 150, date: '2025-04-02', hour: 23, branch: 'สีลม' })
  })

  it('dailyRevenue ไม่เติมวันที่ไม่มียอดขาย', () => {
    expect(dailyRevenue(prepareRows(sample)).map((d) => d.date)).toEqual(['2025-04-01', '2025-04-02', '2025-04-04'])
  })
})

describe('hourlyRevenue (หน้ายอดขาย Real Time)', () => {
  it('รวมยอดต่อชั่วโมง เรียงตามชั่วโมง และเติม 0 ให้ชั่วโมงที่ไม่มียอดขาย', () => {
    // sample: 09:15 = 165 · 23:59 = 150 · 07:00 = 105
    const out = hourlyRevenue(prepareRows(sample))
    expect(out[0]).toEqual({ hour: 7, revenue: 105 })
    expect(out.find((h) => h.hour === 8)).toEqual({ hour: 8, revenue: 0 })
    expect(out.find((h) => h.hour === 9)).toEqual({ hour: 9, revenue: 165 })
    expect(out.at(-1)).toEqual({ hour: 23, revenue: 150 })
    expect(out).toHaveLength(17)
  })

  it('ไม่มีข้อมูลได้อาร์เรย์ว่าง', () => {
    expect(hourlyRevenue([])).toEqual([])
  })
})

describe('การจัดรูปแบบตัวเลขและวันที่', () => {
  it('formatBaht ปัดเป็นจำนวนเต็มและมีตัวคั่นหลักพัน', () => {
    expect(formatBaht(123456.7)).toBe('฿123,457')
    expect(formatBaht(0)).toBe('฿0')
  })

  it('formatCount', () => {
    expect(formatCount(12345)).toBe('12,345')
  })

  it('formatShortBaht ย่อเป็น K/M', () => {
    expect(formatShortBaht(1500)).toBe('฿1.5K')
    expect(formatShortBaht(1230027)).toBe('฿1.2M')
  })

  it('formatThaiShortDate ใช้ปี พ.ศ. 2 หลัก', () => {
    expect(formatThaiShortDate('2025-04-01')).toBe('1 เม.ย. 68')
    expect(formatThaiShortDate('2026-12-31')).toBe('31 ธ.ค. 69')
  })

  it('formatThaiShortDate คืนค่าเดิมถ้าไม่ใช่วันที่', () => {
    expect(formatThaiShortDate('abc')).toBe('abc')
  })
})
