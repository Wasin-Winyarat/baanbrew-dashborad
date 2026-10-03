// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
import { addDays, daysBetween } from "../src/lab3/time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  if (rows.length === 0) throw new Error("ไม่มีข้อมูลในไฟล์");
  // เทียบวันที่เป็นสตริง YYYY-MM-DD ได้เลย เพราะลำดับตัวอักษรตรงกับลำดับปฏิทิน
  const end = rows.reduce((max, r) => (r.datetime.slice(0, 10) > max ? r.datetime.slice(0, 10) : max), "");
  const start = addDays(end, -(days - 1));
  const picked = rows.filter((r) => {
    const d = r.datetime.slice(0, 10);
    return d >= start && d <= end;
  });
  return { rows: picked, start, end };
}

/** จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ */
export function computeShift(lastDataDate, today) {
  return Math.max(0, daysBetween(lastDataDate, addDays(today, -1)));
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  // เลื่อนเฉพาะส่วนวันที่ (10 ตัวแรก) ส่วนเวลาและ +07:00 ต่อท้ายเหมือนเดิม
  return addDays(iso.slice(0, 10), days) + iso.slice(10);
}

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 */
export function toSaleDoc(row, shiftDays = 0) {
  const where = `${row.order_id}/${row.product_id}`;
  if (!row.order_id || !row.product_id) throw new Error(`แถวไม่มี order_id หรือ product_id (${where})`);
  if (!/^[1-9]\d*$/.test(String(row.qty).trim())) throw new Error(`qty ต้องเป็นจำนวนเต็มบวก: "${row.qty}" (${where})`);
  const price = String(row.unit_price).trim();
  if (!/^\d+(\.\d+)?$/.test(price) || Number(price) <= 0) throw new Error(`unit_price ต้องเป็นตัวเลขบวก: "${row.unit_price}" (${where})`);
  if (!BRANCHES.includes(row.branch)) throw new Error(`ไม่รู้จักสาขา "${row.branch}" (${where})`);
  if (!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\+07:00$/.test(row.datetime)) {
    throw new Error(`datetime ต้องเป็นรูปแบบ 20YY-MM-DDTHH:MM:SS+07:00: "${row.datetime}" (${where})`);
  }

  const qty = Number(row.qty);
  const unit_price = Number(price);
  const datetime = shiftDays ? shiftDateTime(row.datetime, shiftDays) : row.datetime;
  const customer = String(row.customer_id ?? "").trim();
  return {
    id: `${row.order_id}-${row.product_id}`,
    data: {
      order_id: row.order_id,
      datetime,
      // อ่านจากสตริงตรง ๆ ไม่ผ่าน Date จึงยังเป็นวันและชั่วโมงของไทย
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
      branch: row.branch,
      product_id: row.product_id,
      qty,
      unit_price,
      revenue: qty * unit_price,
      customer_id: customer === "" ? null : customer,
      payment_method: row.payment_method,
      channel: row.channel,
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranch = {};
  let revenue = 0;
  let start = null;
  let end = null;
  for (const { data } of docs) {
    bills.add(data.order_id);
    revenue += data.revenue;
    byBranch[data.branch] = (byBranch[data.branch] ?? 0) + data.revenue;
    if (start === null || data.date < start) start = data.date;
    if (end === null || data.date > end) end = data.date;
  }
  return { docs: docs.length, bills: bills.size, revenue, byBranch, start, end };
}
