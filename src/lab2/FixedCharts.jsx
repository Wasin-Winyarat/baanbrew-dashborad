// Lab 2.2 · กราฟที่ซ่อมแล้ว (คู่กับ BadChart1 … BadChart5 ใน BadCharts.jsx)
// ทุกกราฟรับ props { rows, products } ใช้สีหลักสีเดียว (MAIN) และมีข้อความสรุป
// 1 บรรทัดเหนือกราฟ ตัวเลขในข้อความคำนวณจาก rows ทั้งหมด ไม่มีตัวเลขพิมพ์ตายตัว
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList, Cell,
} from "recharts";
import {
  revenueByProduct, monthlyRevenue, daysInMonth, branchPerformance, weeklyRevenue, thaiMonth,
} from "./lab2Metrics.js";
import {
  formatBaht as fmtBaht, formatCount as fmtNum, formatShortBaht as fmtShortBaht,
  formatThaiShortDate as thaiDate,
} from "../lib/metrics.js";

// สีหลักเดียวกับกราฟหน้าภาพรวม (SERIES_COLOR ใน App.jsx)
// ชื่อ fmt*/thaiDate เป็นชื่อเดิมจาก Lab 2.2 starter ที่ map มาที่ฟังก์ชันของโปรเจกต์นี้
const MAIN = "#2a78d6";

const GRID = "#e7e5e4";   // stone-200
const AXIS = "#78716c";   // stone-500
const TICK = { fontSize: 11, fill: AXIS };
const FADED = 0.35;       // ความทึบของแท่งที่ต้องการให้เด่นน้อยลง (ใช้สีเดิม ไม่เพิ่มสีใหม่)
const pct = (x) => `${(x * 100).toFixed(1)}%`;

/** โครงร่วม: ข้อความสรุปด้านบน กราฟเต็มพื้นที่ที่เหลือ */
function Frame({ summary, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 px-1 text-sm leading-snug text-stone-700">{summary}</p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

const bahtTooltip = (label = "ยอดขาย") => ({
  formatter: (v) => [fmtBaht(v), label],
  contentStyle: { fontSize: 12, borderRadius: 8 },
  cursor: { fill: "rgba(0,0,0,0.04)" },
});

/**
 * กราฟ 1 · เมนูไหนทำเงินมากที่สุด
 * แท่งแนวนอนเรียงมากไปน้อย 10 อันดับแรก แทน pie 40 ชิ้นที่ต้องไล่จับคู่สีกับ legend
 */
const TOP_N = 10;
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  const top = all.slice(0, TOP_N);
  const topShare = top.reduce((s, d) => s + d.share, 0);
  const [first] = top;
  return (
    <Frame
      summary={<>
        เมนูที่ทำเงินสูงสุดคือ <b>{first.name}</b> {fmtBaht(first.revenue)} ({pct(first.share)} ของยอดขาย)
        · {TOP_N} อันดับแรกรวมกัน {pct(topShare)} จากทั้งหมด {fmtNum(all.length)} เมนู
      </>}
    >
      <BarChart data={top} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={TICK} tickFormatter={fmtShortBaht} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={112} interval={0} tick={TICK} tickLine={false} />
        <Tooltip {...bahtTooltip()} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="share" position="right" formatter={pct} style={{ fontSize: 11, fill: AXIS }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 2 · สาขาขายต่างกันแค่ไหน
 * แกนเริ่มที่ 0 ความยาวแท่งจึงเทียบกันตรง ๆ ได้ เรียงมากไปน้อย สีเดียว มีตัวเลขที่ปลายแท่ง
 */
export function FixedChart2({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.revenue - a.revenue), [rows]);
  const top = data[0];
  const low = data[data.length - 1];
  return (
    <Frame
      summary={<>
        <b>{top.branch}</b> ขายได้มากที่สุด {fmtBaht(top.revenue)} คิดเป็น{" "}
        <b>{(top.revenue / low.revenue).toFixed(1)} เท่า</b> ของ{low.branch}ซึ่งขายได้น้อยที่สุด ({fmtBaht(low.revenue)})
      </>}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 88, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, "auto"]} tick={TICK} tickFormatter={fmtShortBaht} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="branch" width={84} interval={0} tick={TICK} tickLine={false} />
        <Tooltip {...bahtTooltip()} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="right" formatter={fmtBaht} style={{ fontSize: 11, fill: AXIS }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 3 · ยอดขายโดยรวมโตขึ้นหรือลดลง
 * รวมเป็นรายสัปดาห์ (ตัดสัปดาห์ที่ไม่ครบ 7 วัน) ความผันผวนรายวันจึงหายไปและเห็นแนวโน้ม
 * ข้อความสรุปเทียบค่าเฉลี่ย 12 สัปดาห์แรกกับ 12 สัปดาห์ล่าสุด และถ้ามีสาขาเปิดใหม่ระหว่างทาง
 * จะบอกการเติบโตของ "สาขาเดิม" ด้วย เพราะยอดรวมที่โตอาจมาจากสาขาใหม่ ไม่ใช่ร้านเดิมขายดีขึ้น
 */
const COMPARE_WEEKS = 12;
const avgRevenue = (weeks) => weeks.reduce((s, w) => s + w.revenue, 0) / weeks.length;
function growth(weeks, n) {
  const first = avgRevenue(weeks.slice(0, n));
  const last = avgRevenue(weeks.slice(-n));
  return { first, last, change: last / first - 1 };
}
const trendWord = (c) => `${c >= 0 ? "โตขึ้น" : "ลดลง"} ${pct(Math.abs(c))}`;

export function FixedChart3({ rows }) {
  const data = useMemo(() => weeklyRevenue(rows), [rows]);
  const n = Math.min(COMPARE_WEEKS, Math.floor(data.length / 2));
  const all = growth(data, n);

  // สาขาเดิม = สาขาที่มียอดขายตั้งแต่ n สัปดาห์แรก
  const sameStore = useMemo(() => {
    if (data.length <= n) return null;
    const afterFirst = data[n].week; // วันจันทร์แรกหลังช่วง n สัปดาห์แรก
    const firstSale = new Map();
    for (const r of rows) if (!firstSale.has(r.branch) || r.date < firstSale.get(r.branch)) firstSale.set(r.branch, r.date);
    const newBranches = [...firstSale].filter(([, d]) => d >= afterFirst).map(([b]) => b);
    if (newBranches.length === 0) return null;
    const old = rows.filter((r) => !newBranches.includes(r.branch));
    return { newBranches, ...growth(weeklyRevenue(old), n) };
  }, [rows, data, n]);

  return (
    <Frame
      summary={<>
        ยอดขายเฉลี่ย {n} สัปดาห์ล่าสุด {fmtBaht(all.last)}/สัปดาห์ <b>{trendWord(all.change)}</b> จาก {n} สัปดาห์แรก
        {sameStore && <> · ถ้าไม่นับสาขาที่เปิดใหม่ ({sameStore.newBranches.join(", ")}) สาขาเดิม <b>{trendWord(sameStore.change)}</b></>}
      </>}
    >
      <LineChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="week" tick={TICK} tickFormatter={(w) => thaiMonth(w.slice(0, 7))} minTickGap={28} tickLine={false} />
        <YAxis tick={TICK} tickFormatter={fmtShortBaht} width={52} axisLine={false} tickLine={false} domain={[0, "auto"]} />
        <Tooltip {...bahtTooltip("ยอดขายสัปดาห์นี้")} labelFormatter={(w) => `สัปดาห์เริ่ม ${thaiDate(w)}`} cursor={{ stroke: GRID }} />
        <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart>
    </Frame>
  );
}

/**
 * กราฟ 4 · เดือนล่าสุดยอดตกจริงไหม
 * ใช้ "ยอดเฉลี่ยต่อวัน" แทนยอดรวม เดือนที่มีข้อมูลไม่ครบจึงเทียบกับเดือนอื่นได้ยุติธรรม
 * เดือนที่ข้อมูลไม่ครบแสดงเป็นแท่งจาง และข้อความบอกว่ามีข้อมูลกี่วัน
 */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(rows).map((m) => ({
      ...m, fullDays: daysInMonth(m.month), partial: m.days < daysInMonth(m.month),
    })),
    [rows]
  );
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = last.perDay / prev.perDay - 1;
  return (
    <Frame
      summary={<>
        {thaiMonth(last.month)} มีข้อมูล <b>{last.days} จาก {last.fullDays} วัน</b> ยอดรวมจึงดูต่ำ
        แต่ยอดเฉลี่ยต่อวัน {fmtBaht(last.perDay)} {change >= 0 ? "สูงกว่า" : "ต่ำกว่า"} {thaiMonth(prev.month)}{" "}
        {pct(Math.abs(change))} ({fmtBaht(prev.perDay)}/วัน)
      </>}
    >
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={TICK} tickFormatter={thaiMonth} interval="preserveStartEnd" minTickGap={4} tickLine={false} />
        <YAxis tick={TICK} tickFormatter={fmtShortBaht} width={52} axisLine={false} tickLine={false} />
        <Tooltip
          {...bahtTooltip("ยอดเฉลี่ยต่อวัน")}
          labelFormatter={(m) => {
            const d = data.find((x) => x.month === m);
            return `${thaiMonth(m)} · ข้อมูล ${d.days}/${d.fullDays} วัน`;
          }}
        />
        <Bar dataKey="perDay" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.month} fillOpacity={d.partial ? FADED : 1} />)}
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 5 · ผลงานผู้จัดการสาขา
 * เทียบ "ยอดเฉลี่ยต่อวันที่เปิดขาย" แทนยอดรวม เพราะแต่ละสาขามีจำนวนวันในข้อมูลไม่เท่ากัน
 * ไม่ติดป้าย "แย่ที่สุด" แต่แสดงจำนวนวันที่มีข้อมูลไว้ให้ผู้อ่านตัดสินเอง
 */
export function FixedChart5({ rows }) {
  const data = useMemo(
    () => branchPerformance(rows)
      .sort((a, b) => b.perDay - a.perDay)
      .map((b) => ({ ...b, label: `${fmtBaht(b.perDay)}/วัน · ${fmtNum(b.days)} วัน` })),
    [rows]
  );
  // บอกเฉพาะสาขาที่มีข้อมูลน้อยกว่าสาขาอื่นชัดเจน (ต่ำกว่า 90%) ไม่นับวันหยุดวันสองวัน
  const maxDays = Math.max(...data.map((b) => b.days));
  const short = data.filter((b) => b.days < maxDays * 0.9);
  const top = data[0];
  const low = data[data.length - 1];
  return (
    <Frame
      summary={<>
        เทียบต่อวัน <b>{top.branch}</b> สูงสุด {fmtBaht(top.perDay)}/วัน · {low.branch} ต่ำสุด {fmtBaht(low.perDay)}/วัน
        {short.length > 0 && <> · {short.map((b) => `${b.branch}มีข้อมูล ${fmtNum(b.days)} วัน`).join(", ")} จาก {fmtNum(maxDays)} วัน</>}
      </>}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 148, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, "auto"]} tick={TICK} tickFormatter={fmtBaht} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="branch" width={84} interval={0} tick={TICK} tickLine={false} />
        <Tooltip {...bahtTooltip("ยอดเฉลี่ยต่อวัน")} />
        <Bar dataKey="perDay" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: AXIS }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}
