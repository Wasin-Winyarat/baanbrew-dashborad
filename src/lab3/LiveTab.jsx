// Lab 3.2 · Dashboard ยอดขายแบบ real-time จาก Firestore
// ฟัง collection "sales" ด้วย onSnapshot เฉพาะช่วงวันที่ที่เลือก แล้วคำนวณด้วยฟังก์ชันเดิมใน lib/metrics.js
// (ไม่มีสูตรคำนวณในไฟล์นี้) ตัวเลือกสาขากรองในเบราว์เซอร์ จึงไม่ต้องอ่าน Firestore ใหม่เมื่อเปลี่ยนสาขา
// คอลัมน์ขวาเป็นฟอร์มบันทึกยอดขาย (SaleForm) ยอดที่บันทึกจะเด้งเข้ามาในตารางผ่าน onSnapshot เอง
// ต้องล็อกอินด้วย Google ก่อน: Dashboard (และ onSnapshot) เริ่มทำงานเมื่อมีผู้ใช้แล้วเท่านั้น
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, db, googleProvider, projectId } from "./firebase.js";
import { addDays, todayBangkok } from "./time.js";
import { BRANCHES } from "./saleModel.js";
import SaleForm from "./SaleForm.jsx";
import SetupGuide from "./SetupGuide.jsx";
import KpiCard from "../components/KpiCard.jsx";
import {
  computeBranchSales, computeKpis, dailyRevenue, formatBaht, formatCount, formatShortBaht,
  formatThaiShortDate, hourlyRevenue, prepareRows,
} from "../lib/metrics.js";
import {
  AXIS_COLOR, CARD_CLASS, CARD_COLOR, CURSOR_FILL, GRID_COLOR, INK_COLOR, LABEL_COLOR, SERIES_COLOR, TOOLTIP_STYLE,
} from "../theme.js";

const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7d", label: "7 วัน", days: 7 },
  { id: "30d", label: "30 วัน", days: 30 },
];
const HIGHLIGHT_MS = 4000;
const LATEST_COUNT = 8;

const ERROR_TEXT = {
  "permission-denied": "Security Rules ไม่อนุญาตให้อ่านยอดขาย (ล็อกอินแล้วหรือยัง หรือ rules ปิดการอ่านไว้)",
  unauthenticated: "ต้องล็อกอินก่อนจึงจะอ่านยอดขายได้",
  "failed-precondition": "Firestore ต้องการ index สำหรับ query นี้ ดูลิงก์สร้าง index ใน Console ของเบราว์เซอร์",
  unavailable: "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ต แล้วระบบจะลองใหม่เอง",
  "resource-exhausted": "ใช้โควตาอ่าน Firestore ของวันนี้หมดแล้ว ลองใหม่พรุ่งนี้",
};

const timeOf = (datetime) => datetime.slice(11, 16);
const tooltipProps = (labelFormatter) => ({
  formatter: (v) => [formatBaht(v), "ยอดขาย"],
  labelFormatter,
  contentStyle: TOOLTIP_STYLE,
  labelStyle: { color: LABEL_COLOR },
  itemStyle: { color: INK_COLOR },
});

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex rounded-full border border-line bg-card p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
            value === o.id ? "bg-brand font-medium text-brand-ink" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LiveTabInner({ user }) {
  const [rangeId, setRangeId] = useState("7d");
  const [branch, setBranch] = useState("");
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | live | error
  const [error, setError] = useState(null);
  const [reads, setReads] = useState(0);
  const [fresh, setFresh] = useState(() => new Set());
  const timers = useRef(new Set());
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState(null);

  // เมนูเปลี่ยนไม่บ่อย อ่านครั้งเดียวตอนเปิดหน้า (40 เอกสาร) ไม่ต้องฟังแบบ real-time
  useEffect(() => {
    getDocs(collection(db, "products"))
      .then((snap) => {
        setReads((n) => n + snap.size);
        setProducts(snap.docs.map((d) => d.data()).sort((a, b) => a.product_id.localeCompare(b.product_id)));
      })
      .catch((err) => {
        console.error(err);
        setProductsError(ERROR_TEXT[err.code] ?? `โหลดเมนูไม่สำเร็จ (${err.code ?? err.message})`);
      });
  }, []);
  const productName = useMemo(() => Object.fromEntries(products.map((p) => [p.product_id, p.product_name])), [products]);

  // วันที่ตามเวลาไทย · ช่วง N วันรวมวันนี้ = วันนี้ย้อนหลัง N−1 วัน
  const { start, end } = useMemo(() => {
    const today = todayBangkok();
    const days = RANGES.find((r) => r.id === rangeId).days;
    return { start: addDays(today, -(days - 1)), end: today };
  }, [rangeId]);

  // เปลี่ยนช่วง = query ใหม่ แสดงสถานะกำลังโหลดจนกว่า snapshot แรกของช่วงใหม่จะมา
  const chooseRange = (id) => {
    if (id === rangeId) return;
    setStatus("loading");
    setError(null);
    setRangeId(id);
  };

  useEffect(() => {
    let first = true;
    const q = query(collection(db, "sales"), where("date", ">=", start), where("date", "<=", end), orderBy("date"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        setReads((n) => n + changes.length);
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus("live");
        // snapshot แรกคือข้อมูลเดิมทั้งหมด ไฮไลต์เฉพาะเอกสารที่เพิ่มเข้ามาหลังจากนั้น
        if (!first) {
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length) {
            setFresh((prev) => new Set([...prev, ...added]));
            const t = setTimeout(() => {
              timers.current.delete(t);
              setFresh((prev) => {
                const next = new Set(prev);
                added.forEach((id) => next.delete(id));
                return next;
              });
            }, HIGHLIGHT_MS);
            timers.current.add(t);
          }
        }
        first = false;
      },
      (err) => {
        setStatus("error");
        setError(ERROR_TEXT[err.code] ?? `อ่านข้อมูลไม่สำเร็จ (${err.code ?? err.message})`);
        console.error(err);
      },
    );
    return unsubscribe;
  }, [start, end]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const rows = useMemo(() => {
    const prepared = prepareRows(docs);
    return branch ? prepared.filter((r) => r.branch === branch) : prepared;
  }, [docs, branch]);
  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const isToday = rangeId === "today";
  const series = useMemo(() => (isToday ? hourlyRevenue(rows) : dailyRevenue(rows)), [rows, isToday]);
  // ยอดแยกสาขาใช้ทุกสาขาเสมอ เพื่อให้เทียบกับ seed:dry ได้ และไฮไลต์สาขาที่เลือก
  const branchSales = useMemo(() => computeBranchSales(prepareRows(docs)), [docs]);
  const latest = useMemo(
    () => [...rows].sort((a, b) => (a.datetime < b.datetime ? 1 : a.datetime > b.datetime ? -1 : 0)).slice(0, LATEST_COUNT),
    [rows],
  );

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-brand-strong">
              <span className={`inline-block h-2 w-2 rounded-full ${status === "live" ? "animate-pulse bg-accent" : status === "error" ? "bg-danger" : "bg-line"}`} />
              Live · {projectId}
            </p>
            <h1 className="mt-1 text-2xl font-light tracking-tight text-ink sm:text-3xl">ยอดขาย Real Time</h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <UserChip user={user} />
            <p className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted sm:text-sm">
              {isToday ? formatThaiShortDate(end) : `${formatThaiShortDate(start)} – ${formatThaiShortDate(end)}`}
              {" · "}อ่านไปแล้ว <span className="font-medium tabular-nums text-ink">{formatCount(reads)}</span> เอกสาร
            </p>
          </div>
        </div>

        <div className={`${CARD_CLASS} flex flex-wrap items-center gap-3 p-4 sm:p-5`}>
          <Segmented options={RANGES} value={rangeId} onChange={chooseRange} />
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="สาขา"
            className="h-10 rounded-xl border border-line bg-paper/60 px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
          >
            <option value="">ทุกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-2">
        {status === "error" && (
          <div role="alert" className="rounded-2xl border border-blush bg-blush/50 p-4 text-sm text-blush-ink">❌ {error}</div>
        )}
        {status === "loading" && <div className={`${CARD_CLASS} p-10 text-center text-muted`}>กำลังเชื่อมต่อ Firestore…</div>}

        {status === "live" && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <KpiCard label="ยอดขายรวม" value={formatBaht(kpis.totalRevenue)} icon="revenue" tone="brand" />
              <KpiCard label="จำนวนบิล" value={formatCount(kpis.billCount)} icon="bills" tone="mist" />
              <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(kpis.avgPerBill)} icon="avg" tone="oat" />
              <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatCount(kpis.uniqueMembers)} icon="members" tone="blush" />
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              <section className={`${CARD_CLASS} p-4 sm:p-6 xl:col-span-3`}>
                <h2 className="text-base font-medium text-ink">{isToday ? "ยอดขายรายชั่วโมง วันนี้" : "ยอดขายรายวัน"}</h2>
                <p className="mt-0.5 text-xs text-muted">{branch || "ทุกสาขา"} · อัปเดตทันทีเมื่อมีการขายใหม่</p>
                <div className="mt-4 h-64 w-full">
                  {series.length === 0 ? (
                    <p className="grid h-full place-items-center text-sm text-muted">ยังไม่มียอดขายในช่วงนี้</p>
                  ) : (
                    <ResponsiveContainer>
                      {isToday ? (
                        <BarChart data={series} margin={{ left: 0, right: 8 }}>
                          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 12, fill: AXIS_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} />
                          <YAxis tickFormatter={formatShortBaht} tick={{ fontSize: 12, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={52} />
                          <Tooltip {...tooltipProps((h) => `${h}:00–${h}:59 น.`)} cursor={{ fill: CURSOR_FILL }} />
                          <Bar dataKey="revenue" fill={SERIES_COLOR} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                        </BarChart>
                      ) : (
                        <LineChart data={series} margin={{ left: 0, right: 8 }}>
                          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                          <XAxis dataKey="date" tickFormatter={formatThaiShortDate} tick={{ fontSize: 12, fill: AXIS_COLOR }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} minTickGap={24} />
                          <YAxis tickFormatter={formatShortBaht} tick={{ fontSize: 12, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={52} />
                          <Tooltip {...tooltipProps(formatThaiShortDate)} cursor={{ stroke: GRID_COLOR }} />
                          <Line type="monotone" dataKey="revenue" stroke={SERIES_COLOR} strokeWidth={2.5} dot={series.length <= 7 ? { r: 3, fill: SERIES_COLOR, strokeWidth: 0 } : false} activeDot={{ r: 5, stroke: CARD_COLOR, strokeWidth: 2 }} isAnimationActive={false} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className={`${CARD_CLASS} p-4 sm:p-6 xl:col-span-2`}>
                <h2 className="text-base font-medium text-ink">ยอดขายแยกสาขา</h2>
                <p className="mt-0.5 text-xs text-muted">ทุกสาขาในช่วงที่เลือก · บาทเต็มจำนวน</p>
                <ul className="mt-4 space-y-3">
                  {branchSales.length === 0 && <li className="text-sm text-muted">ยังไม่มียอดขาย</li>}
                  {branchSales.map((b) => {
                    const max = branchSales[0].revenue || 1;
                    const dim = branch && b.branch !== branch;
                    return (
                      <li key={b.branch} className={dim ? "opacity-40" : ""}>
                        <div className="flex justify-between text-sm">
                          <span className="text-ink">{b.branch}</span>
                          <span className="tabular-nums text-ink">{formatBaht(b.revenue)}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-paper">
                          <div className="h-2 rounded-full" style={{ width: `${(b.revenue / max) * 100}%`, backgroundColor: SERIES_COLOR }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <section className={`${CARD_CLASS} overflow-hidden`}>
              <div className="p-4 pb-2 sm:px-6 sm:pt-6">
                <h2 className="text-base font-medium text-ink">รายการล่าสุด</h2>
                <p className="mt-0.5 text-xs text-muted">{LATEST_COUNT} รายการล่าสุด · แถวใหม่จะเป็นสีเขียวอ่อน {HIGHLIGHT_MS / 1000} วินาที</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-4 py-2 font-normal sm:px-6">เวลา</th>
                      <th className="px-2 py-2 font-normal">สาขา</th>
                      <th className="px-2 py-2 font-normal">เมนู</th>
                      <th className="px-2 py-2 text-right font-normal">จำนวน</th>
                      <th className="px-2 py-2 text-right font-normal">ยอด</th>
                      <th className="px-4 py-2 font-normal sm:px-6">ชำระ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-6 text-center text-muted">ยังไม่มีรายการในช่วงนี้</td></tr>
                    )}
                    {latest.map((r) => (
                      <tr key={r.id} className={`border-b border-line/60 transition-colors duration-700 last:border-0 ${fresh.has(r.id) ? "bg-brand" : ""}`}>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted sm:px-6">
                          {isToday ? timeOf(r.datetime) : `${formatThaiShortDate(r.date)} ${timeOf(r.datetime)}`}
                        </td>
                        <td className="px-2 py-2.5 text-ink">{r.branch}</td>
                        <td className="px-2 py-2.5 text-ink">{productName[r.product_id] ?? r.product_id}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink">{r.qty}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink">{formatBaht(r.revenue)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted sm:px-6">
                          {r.payment_method}
                          {r.source === "web" && <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-[11px] text-mist-ink">เว็บ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        </div>

        <aside className="lg:sticky lg:top-24">
          <SaleForm products={products} productsError={productsError} uid={user.uid} />
        </aside>
        </div>
      </div>
    </div>
  );
}

const AUTH_ERROR_TEXT = {
  "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาต เพิ่มโดเมนของเว็บใน Firebase Console → Authentication → Settings → Authorized domains",
  "auth/operation-not-allowed": "ยังไม่ได้เปิดการล็อกอินด้วย Google เปิดได้ที่ Firebase Console → Authentication → Sign-in method → Google",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วกดปุ่มอีกครั้ง",
  "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ กดปุ่มอีกครั้งเพื่อเข้าสู่ระบบ",
};
const authErrorText = (err) => AUTH_ERROR_TEXT[err.code] ?? `เข้าสู่ระบบไม่สำเร็จ (${err.code ?? err.message})`;

function UserChip({ user }) {
  const name = user.displayName || user.email || "ผู้ใช้";
  const [failed, setFailed] = useState(false);
  const logout = () => signOut(auth).catch((err) => console.error(err));
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-1">
      {user.photoURL && !failed ? (
        // Google ไม่ให้โหลดรูปถ้าส่ง referrer ไปด้วย
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-7 w-7 rounded-full" />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-medium text-brand-ink">{name.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="max-w-[10rem] truncate text-sm text-ink" title={user.email ?? undefined}>{name}</span>
      <button
        type="button"
        onClick={logout}
        className="rounded-full px-3 py-1 text-xs text-muted transition-colors hover:bg-blush hover:text-blush-ink"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}

function SignInCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // สำเร็จแล้ว onAuthStateChanged ใน AuthGate จะสลับไปแสดง Dashboard เอง
    } catch (err) {
      console.error(err);
      setError(authErrorText(err));
      setBusy(false);
    }
  };
  return (
    <div className="px-4 py-10 sm:px-6 sm:py-16">
      <div className={`${CARD_CLASS} mx-auto max-w-md p-6 text-center sm:p-8`}>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-strong">Live · {projectId}</p>
        <h1 className="mt-2 text-2xl font-light tracking-tight text-ink">ยอดขาย Real Time</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          ข้อมูลยอดขายสำหรับพนักงานเท่านั้น เข้าสู่ระบบด้วยบัญชี Google เพื่อดูยอดขายและบันทึกการขาย
        </p>
        <button
          type="button"
          onClick={login}
          disabled={busy}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line bg-card text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-wait disabled:opacity-60"
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-blush/60 px-3 py-2 text-left text-sm text-blush-ink">❌ {error}</p>
        )}
      </div>
    </div>
  );
}

/** ตรวจสถานะล็อกอินก่อน: undefined = กำลังตรวจ, null = ยังไม่ล็อกอิน */
function AuthGate() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <p className="p-10 text-center text-muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (user === null) return <SignInCard />;
  // key = uid: เปลี่ยนผู้ใช้แล้วเริ่ม Dashboard ใหม่ทั้งหมด (ตัวนับการอ่านและ listener ไม่ปนกัน)
  return <LiveTabInner key={user.uid} user={user} />;
}

export default function LiveTab() {
  // ยังไม่ได้ตั้งค่า .env → firebase.js ให้ db = null
  return db ? <AuthGate /> : <SetupGuide />;
}
