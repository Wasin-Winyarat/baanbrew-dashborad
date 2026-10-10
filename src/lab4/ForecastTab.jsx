// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot,
} from "recharts";
import { AnalyticsShell, Card, Pending, Insight, MAIN, GREEN, MUTED, INK, thaiDay } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest, mape } from "../lib/analytics/forecast.js";
import { addDays } from "../lab3/time.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { formatBaht as fmtBaht, formatShortBaht as fmtShortBaht } from "../lib/metrics.js";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

// Lab 4.4B · รวมเป็นรายสัปดาห์ จันทร์–อาทิตย์ (key = วันจันทร์ของสัปดาห์)
const mondayOf = (ymd) => addDays(ymd, -((new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7));
/** rows = [{ date, ...ค่าตัวเลข }] → รวมค่าตาม keys เป็นรายสัปดาห์ เก็บเฉพาะสัปดาห์ที่ครบ 7 วัน */
function toWeekly(rows, keys) {
  const weeks = new Map();
  for (const r of rows) {
    const k = mondayOf(r.date);
    const w = weeks.get(k) ?? { date: k, days: 0, ...Object.fromEntries(keys.map((key) => [key, 0])) };
    w.days += 1;
    for (const key of keys) w[key] += r[key];
    weeks.set(k, w);
  }
  return [...weeks.values()].filter((w) => w.days === 7);
}

function ForecastCard({ daily }) {
  const [branch, setBranch] = useState(null);
  const [view, setView] = useState("day");
  const result = useMemo(() => tryRun(() => {
    const series = toSeries(daily, branch);
    const bt = backtest(series, HORIZON);
    const fc = seasonalForecast(series, HORIZON);
    const recent = series.slice(-56);
    const last = recent[recent.length - 1];
    const chart = [
      ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
      ...fc.map((f) => ({ date: f.date, forecast: f.forecast, band: [f.forecast * (1 - bt.band), f.forecast * (1 + bt.band)] })),
    ];
    chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue }; // ต่อเส้นให้ไม่ขาด
    const next7 = fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0);

    // รายสัปดาห์: ยอดจริง 8 สัปดาห์ล่าสุด + คาดการณ์ 4 สัปดาห์ และ MAPE จากย้อนทดสอบชุดเดิม
    const actualWeeks = toWeekly(recent.map((s) => ({ date: s.date, actual: s.revenue })), ["actual"]);
    const forecastWeeks = toWeekly(fc, ["forecast"]);
    const weekChart = [...actualWeeks.map((w) => ({ date: w.date, actual: w.actual })), ...forecastWeeks.map((w) => ({ date: w.date, forecast: w.forecast }))];
    if (actualWeeks.length) weekChart[actualWeeks.length - 1] = { ...weekChart[actualWeeks.length - 1], forecast: actualWeeks.at(-1).actual };
    const btWeeks = toWeekly(bt.test, ["actual", "seasonal", "flat"]);
    const weekly = {
      count: btWeeks.length,
      mapeSeasonal: mape(btWeeks.map((w) => w.actual), btWeeks.map((w) => w.seasonal)),
      mapeFlat: mape(btWeeks.map((w) => w.actual), btWeeks.map((w) => w.flat)),
    };
    return { bt, chart, next7, lastDate: last.date, weekChart, weekly, lastWeek: actualWeeks.at(-1)?.date };
  }), [daily, branch]);

  const r = result.value;
  const isWeek = view === "week";
  return (
    <Card title="พยากรณ์ยอดขาย 28 วัน" sub="ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"
          right={<div className="flex flex-wrap gap-1">
            {[null, ...BRANCHES].map((b) => (
              <button key={b ?? "all"} onClick={() => setBranch(b)}
                      className={`rounded-lg px-2.5 py-1 text-sm ${branch === b ? "bg-stone-900 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{b ?? "รวม"}</button>
            ))}
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : (
        <>
          <div className="mb-3 inline-flex rounded-lg p-0.5 ring-1 ring-stone-200">
            {[["day", "รายวัน"], ["week", "รายสัปดาห์"]].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)}
                      className={`rounded-md px-3 py-1 text-sm ${view === id ? "bg-stone-900 text-white" : "text-stone-600"}`}>{label}</button>
            ))}
          </div>
          {isWeek ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label={`ย้อนทดสอบ ${r.weekly.count} สัปดาห์: คลาดเคลื่อนเฉลี่ยต่อสัปดาห์`} value={`${r.weekly.mapeSeasonal.toFixed(1)}%`}
                    note={`วิธีดูวันในสัปดาห์ · รายวัน ${r.bt.mapeSeasonal.toFixed(1)}%`} />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง (รายสัปดาห์)" value={`${r.weekly.mapeFlat.toFixed(1)}%`}
                    note={`ตัวเปรียบเทียบ · รายวัน ${r.bt.mapeFlat.toFixed(1)}%`} muted />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} note="วิธีดูวันในสัปดาห์" />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} note="ตัวเปรียบเทียบ" muted />
            </div>
          )}
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={isWeek ? r.weekChart : r.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tickFormatter={isWeek ? (d) => `สัปดาห์ ${shortDay(d)}` : shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={isWeek ? (d) => `สัปดาห์เริ่ม ${thaiDay(d)} (จ.–อา.)` : thaiDay}
                         formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine x={isWeek ? r.lastWeek : r.lastDate} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />
                {!isWeek && <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill={GREEN[1]} isAnimationActive={false} />}
                <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {isWeek ? (
            <Insight>
              {branch ?? "ภาพรวม"}: รวมเป็นรายสัปดาห์แล้วคลาดเคลื่อนเหลือ {r.weekly.mapeSeasonal.toFixed(1)}% จากรายวัน {r.bt.mapeSeasonal.toFixed(1)}%
              เพราะวันที่ขายเกินกับวันที่ขายขาดหักล้างกันในสัปดาห์เดียวกัน จึงเหมาะกับการสั่งของและจัดกะพนักงานรายสัปดาห์ ·
              ค่าเฉลี่ยเส้นตรงก็เหลือ {r.weekly.mapeFlat.toFixed(1)}% เพราะรูปแบบวันในสัปดาห์หักล้างกันหมดเมื่อรวมครบ 7 วัน
              (ย้อนทดสอบได้ {r.weekly.count} สัปดาห์เต็ม จึงเป็นตัวเลขคร่าว ๆ)
            </Insight>
          ) : <Insight>
            {r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
              ? `${branch ?? "ภาพรวม"}: การดูวันในสัปดาห์ช่วยลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
              : `${branch ?? "ภาพรวม"}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%) ${branch ? "" : "เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน"}`}
            {" "}ใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
          </Insight>}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, note, muted }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${muted ? "text-stone-500" : ""}`}>{value}</div>
      {note && <div className="text-xs text-stone-400">{note}</div>}
    </div>
  );
}

// Lab 4.5B · กราฟซูม ±28 วันรอบวันที่เลือก ของสาขานั้น
const ZOOM_DAYS = 28;
const LOW = "#b91c1c";  // ต่ำกว่าปกติ
const HIGH = "#d97706"; // สูงกว่าปกติ

function AnomalyZoom({ daily, all, focus, onClose }) {
  const from = addDays(focus.date, -ZOOM_DAYS);
  const to = addDays(focus.date, ZOOM_DAYS);
  // ค่าปกติของทุกวันในช่วงนี้ มาจากผล scoreAnomalies ชุดเดียวกับตาราง
  const expectedOn = new Map(all.filter((a) => a.branch === focus.branch).map((a) => [a.date, a.expected]));
  const data = toSeries(daily, focus.branch)
    .filter((s) => s.date >= from && s.date <= to)
    .map((s) => ({ date: s.date, actual: s.revenue, expected: expectedOn.get(s.date) }));
  const color = focus.change < 0 ? LOW : HIGH;
  return (
    <div className="mb-4 rounded-lg p-3 ring-1 ring-stone-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{focus.branch} · {thaiDay(focus.date)}</div>
          <div className="text-sm text-stone-500">
            ยอดจริง {fmtBaht(focus.actual)} เทียบค่าปกติ {fmtBaht(focus.expected)} · ±{ZOOM_DAYS / 7} สัปดาห์รอบวันนั้น
          </div>
        </div>
        <button onClick={onClose} aria-label="ปิดกราฟ"
                className="rounded-lg px-3 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100">ปิด</button>
      </div>
      <div className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eee" />
            <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={thaiDay} formatter={(v, n) => [fmtBaht(v), n]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine x={focus.date} stroke={MUTED} strokeDasharray="3 3" />
            <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="ค่าปกติ" dataKey="expected" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
            <ReferenceDot x={focus.date} y={focus.actual} r={6} fill={color} stroke="#fff" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  return (
    <Card title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ">
      {focus && <AnomalyZoom daily={daily} all={all} focus={focus} onClose={() => setFocus(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="text-left text-stone-500">
            <tr><th className="py-1 font-medium">#</th><th className="font-medium">วันที่</th><th className="font-medium">สาขา</th>
              <th className="text-right font-medium">ยอดจริง</th><th className="text-right font-medium">ปกติ</th><th className="pl-4 font-medium">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              return (
                <tr key={a.date + a.branch} onClick={() => setFocus(sel ? null : a)}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${sel ? "bg-emerald-50" : ""}`}>
                  <td className="py-1.5 text-stone-400">{i + 1}</td>
                  <td>{thaiDay(a.date)} <span className="text-stone-400">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td>{a.branch}</td>
                  <td className="text-right">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-stone-500">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    {a.change < 0
                      ? <span className="font-medium text-red-700">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                      : <span className="font-medium text-amber-700">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.slice(0, 3).map((h) => `${h.holiday} (${h.branch})`).join(", ")}</>}
      </Insight>
    </Card>
  );
}

export default function ForecastTab({ source }) {
  const state = useAnalytics(source);
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์และวันผิดปกติ">
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-6">
          {d.meta.alerts?.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
