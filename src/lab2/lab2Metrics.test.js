import { describe, expect, it } from "vitest";
import { branchPerformance, daysInMonth, monthlyRevenue, revenueByProduct, thaiMonth, weeklyRevenue } from "./lab2Metrics.js";

// แถวหลังผ่าน prepareRows() แล้ว: มี revenue (ตัวเลข) และ date
const r = (date, revenue, o = {}) => ({ date, revenue, branch: "สยาม", product_id: "P001", ...o });

// วันที่ทุกวันในช่วง [from, from + n) วันละ 1 แถว
const days = (from, n, revenue = 100, o = {}) => {
  const [y, m, d] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => r(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10), revenue, o));
};

describe("revenueByProduct", () => {
  const products = [
    { product_id: "P001", product_name: "อเมริกาโน่" },
    { product_id: "P002", product_name: "ลาเต้" },
  ];
  // P001 มี 2 แถว รวม 120 · P002 = 300 · P999 (ไม่มีในเมนู) = 80 · รวม 500
  const rows = [r("2025-04-01", 50), r("2025-04-01", 300, { product_id: "P002" }), r("2025-04-02", 70), r("2025-04-02", 80, { product_id: "P999" })];

  it("รวมยอดต่อเมนู เรียงมากไปน้อย และสัดส่วนรวมกันได้ 1", () => {
    const out = revenueByProduct(rows, products);
    expect(out.map((p) => [p.id, p.revenue])).toEqual([["P002", 300], ["P001", 120], ["P999", 80]]);
    expect(out[0]).toEqual({ id: "P002", name: "ลาเต้", revenue: 300, share: 0.6 });
    expect(out.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1);
  });

  it("เมนูที่ไม่อยู่ใน products ใช้รหัสแทนชื่อ และไม่ส่ง products มาก็ได้", () => {
    expect(revenueByProduct(rows, products).find((p) => p.id === "P999").name).toBe("P999");
    expect(revenueByProduct(rows).find((p) => p.id === "P002").name).toBe("P002");
  });
});

describe("monthlyRevenue", () => {
  it("รวมยอดรายเดือน นับวันที่มีข้อมูล (ไม่นับซ้ำ) และยอดเฉลี่ยต่อวัน", () => {
    const rows = [...days("2025-04-29", 2, 100), r("2025-04-30", 100), ...days("2025-05-01", 3, 50)];
    expect(monthlyRevenue(rows)).toEqual([
      { month: "2025-04", revenue: 300, days: 2, perDay: 150 },
      { month: "2025-05", revenue: 150, days: 3, perDay: 50 },
    ]);
  });

  it("เรียงเดือนจากเก่าไปใหม่ แม้ข้อมูลเข้ามาไม่เรียง และข้ามปีได้", () => {
    const out = monthlyRevenue([r("2026-01-05", 1), r("2025-12-31", 1), r("2025-11-01", 1)]);
    expect(out.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("daysInMonth", () => {
  it("จำนวนวันตามปฏิทิน รวม ก.พ. ปีอธิกสุรทิน", () => {
    expect(daysInMonth("2025-04")).toBe(30);
    expect(daysInMonth("2025-05")).toBe(31);
    expect(daysInMonth("2025-02")).toBe(28);
    expect(daysInMonth("2024-02")).toBe(29);
  });
});

describe("branchPerformance", () => {
  it("ยอดเฉลี่ยต่อวันหารด้วยจำนวนวันที่สาขานั้นเปิดขาย ไม่ใช่จำนวนวันทั้งหมด", () => {
    const rows = [...days("2025-04-01", 4, 100), ...days("2025-04-01", 2, 150, { branch: "สีลม" }), r("2025-04-02", 50, { branch: "สีลม" })];
    const out = Object.fromEntries(branchPerformance(rows).map((b) => [b.branch, b]));
    expect(out["สยาม"]).toEqual({ branch: "สยาม", revenue: 400, days: 4, perDay: 100 });
    expect(out["สีลม"]).toEqual({ branch: "สีลม", revenue: 350, days: 2, perDay: 175 });
  });
});

describe("weeklyRevenue", () => {
  it("สัปดาห์เริ่มวันจันทร์ และตัดสัปดาห์ที่ข้อมูลไม่ครบ 7 วันออก", () => {
    // 2025-04-01 = อังคาร → สัปดาห์แรก (จ. 31 มี.ค.) มีแค่ 6 วัน ต้องถูกตัด
    // 2025-04-07 และ 2025-04-14 = จันทร์ ครบ 7 วัน · 2025-04-21 มีแค่ 2 วัน ต้องถูกตัด
    const rows = days("2025-04-01", 22, 10);
    expect(weeklyRevenue(rows)).toEqual([
      { week: "2025-04-07", revenue: 70 },
      { week: "2025-04-14", revenue: 70 },
    ]);
  });

  it("สัปดาห์ที่คร่อมเดือนนับเป็นสัปดาห์เดียวกัน", () => {
    // จ. 28 เม.ย. – อา. 4 พ.ค. 2025
    expect(weeklyRevenue(days("2025-04-28", 7, 1))).toEqual([{ week: "2025-04-28", revenue: 7 }]);
  });

  it("หลายแถวในวันเดียวกันนับเป็น 1 วัน", () => {
    const rows = [...days("2025-04-07", 6, 10), r("2025-04-07", 5), r("2025-04-07", 5)];
    expect(weeklyRevenue(rows)).toEqual([]);
  });
});

describe("thaiMonth", () => {
  it("ชื่อเดือนย่อภาษาไทย ปี พ.ศ. 2 หลัก", () => {
    expect(thaiMonth("2025-04")).toBe("เม.ย. 68");
  });
});
