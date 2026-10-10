import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import Overview from "./Overview.jsx";
import Lab2Page from "./lab2/Lab2Page.jsx";
import LiveTab from "./lab3/LiveTab.jsx";
import RulesTester from "./lab3/RulesTester.jsx";
import SetupGuide from "./lab3/SetupGuide.jsx";
import CustomersTab from "./lab4/CustomersTab.jsx";
import ForecastTab from "./lab4/ForecastTab.jsx";
import { isConfigured } from "./lab3/firebase.js";
import { firestoreSource, createDemoSource } from "./lab3/dataSource.js";
import { prepareRows } from "./lib/metrics.js";

const loadCsv = (url) =>
  new Promise((resolve, reject) =>
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  );

const DEMO = new URLSearchParams(location.search).has("demo");
const TABS = [
  { id: "overview", label: "ภาพรวม (CSV)" },
  { id: "lab2", label: "Lab 2.2 · ซ่อมกราฟ" },
  { id: "live", label: "สด · Firestore" },
  { id: "customers", label: "ลูกค้า & เมนู" },
  { id: "forecast", label: "พยากรณ์ & ผิดปกติ" },
  { id: "rules", label: "ทดสอบ Rules" },
];

export default function App() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState(null);
  const [holidays, setHolidays] = useState({});
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => TABS.find((t) => "#" + t.id === location.hash)?.id ?? "overview");

  useEffect(() => {
    Promise.all([loadCsv("/sales.csv"), loadCsv("/products.csv"), loadCsv("/thai_holidays.csv").catch(() => [])])
      .then(([sales, prods, hol]) => {
        setRows(prepareRows(sales)); setProducts(prods);
        // Without thai_holidays.csv the dev server answers with index.html, so keep only real date rows.
        setHolidays(Object.fromEntries(hol.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date)).map((h) => [h.date, h.holiday])));
      })
      .catch((e) => setError(e.message ?? String(e)));
  }, []);

  const source = useMemo(() => {
    if (DEMO) return rows && products ? createDemoSource(rows, products, holidays) : null;
    return isConfigured ? firestoreSource : null;
  }, [rows, products, holidays]);

  // แท็บตาม #hash ใน URL (รวมกด back/forward หรือแก้ URL เอง)
  useEffect(() => {
    const onHash = () => setTab(TABS.find((t) => "#" + t.id === location.hash)?.id ?? "overview");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // บนจอแคบเมนูเลื่อนแนวนอนได้ ให้แท็บที่เลือกอยู่ในสายตาเสมอ
  useEffect(() => {
    document.querySelector('nav [aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  const choose = (id) => { setTab(id); history.replaceState(null, "", location.search + "#" + id); };
  const needsCsv = tab === "overview" || tab === "lab2" || DEMO;
  // ภาพรวมและแท็บสดจัดระยะหน้าเองอยู่แล้ว แท็บอื่นใช้กรอบเดียวกันจากตรงนี้
  const ownLayout = tab === "overview" || tab === "live";

  const content = (
    <>
      {error && needsCsv && <p className="rounded-xl bg-blush/50 p-3 text-sm text-danger">โหลดข้อมูลไม่สำเร็จ: {error} ตรวจว่ามี public/sales.csv และ public/products.csv</p>}
      {!error && needsCsv && !rows && <p className="py-16 text-center text-muted">กำลังโหลดข้อมูลยอดขาย…</p>}
      {rows && tab === "overview" && <Overview rows={rows} products={products} />}
      {rows && tab === "lab2" && <Lab2Page rows={rows} products={products} />}
      {tab === "live" && (source ? <LiveTab source={source} /> : !DEMO && <SetupGuide />)}
      {tab === "customers" && (source ? <CustomersTab source={source} /> : !DEMO && <SetupGuide />)}
      {tab === "forecast" && (source ? <ForecastTab source={source} /> : !DEMO && <SetupGuide />)}
      {tab === "rules" && (DEMO ? <p className="text-muted">การทดสอบ Rules ใช้ได้กับ Firebase จริงเท่านั้น ไม่ใช่โหมดสาธิต</p>
        : isConfigured ? <RulesTester /> : <SetupGuide />)}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/75 backdrop-blur-md">
        {/* แถบสีแบรนด์บาง ๆ บนสุด */}
        <div className="h-1 bg-gradient-to-r from-[#f6a35f] via-accent to-[#f2c46d]" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <a href={location.search + "#overview"} onClick={(e) => { e.preventDefault(); choose("overview"); }}
             className="flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
            <img src="/favicon.svg" alt="" className="h-9 w-9 drop-shadow-[0_4px_8px_rgba(232,116,44,0.35)]" />
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-wide text-ink">บ้านบรู</span>
              <span className="block text-[11px] uppercase tracking-[0.2em] text-brand-strong">baan brew · dashboard</span>
            </span>
            {DEMO && <span className="ml-1 rounded-full bg-oat px-2 py-0.5 text-[11px] font-medium text-oat-ink">โหมดสาธิต</span>}
          </a>
          <nav aria-label="แท็บ" className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-card/80 p-1 shadow-[0_1px_2px_rgba(59,44,34,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => choose(t.id)} aria-current={tab === t.id ? "page" : undefined}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                        tab === t.id
                          ? "bg-brand-strong font-medium text-white shadow-[0_4px_12px_-4px_rgba(185,83,28,0.6)]"
                          : "text-muted hover:bg-brand/60 hover:text-brand-ink"}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {ownLayout ? content : (
          <div className="px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-6xl">{content}</div>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 text-center text-xs tracking-wide text-muted/80 sm:px-6">
        บ้านบรู · ข้อมูลจาก sales.csv และ Firestore
      </footer>
    </div>
  );
}
