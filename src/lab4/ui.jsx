import { LoginCard, UserChip, authErrorText } from "../lab3/AuthBar.jsx";
import { useState } from "react";
import { CARD_CLASS, GRID_COLOR, INK_COLOR, AXIS_COLOR } from "../theme";

// สีกราฟตามธีมส้มของแบรนด์ (ตรวจด้วย validate_palette ของ dataviz แล้ว: MAIN คู่กับ PAIR ผ่านครบ)
export const INK = INK_COLOR;
export const MUTED = AXIS_COLOR;   // เส้นอ้างอิง/เส้นรอง
export const GRID = GRID_COLOR;
export const SCALE = ["#fdeee2", "#fbd5b6", "#f7cba6", "#ee8f4e", "#d9661f", "#b9531c"]; // ไล่สีเดียว อ่อน→เข้ม
export const MAIN = SCALE[4];     // ส้มหลัก (≥3:1 บนพื้นการ์ด)
export const PAIR = "#1f8fa8";    // series ที่สองเมื่อต้องแยกประเภท (เช่น % ลูกค้า เทียบ % ยอดซื้อ)
// ข้อความใน legend ใช้สีตัวอักษร ไม่ใช้สีของ series (สีอ่อนอย่างแถบช่วงคาดการณ์จะอ่านไม่ออก)
export const legendText = (value) => <span style={{ color: INK_COLOR }}>{value}</span>;
export const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
export const thaiDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
export const thaiMonth = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("th-TH", { month: "short", year: "2-digit" });

export function Card({ title, sub, children, right }) {
  return (
    <section className={`${CARD_CLASS} p-4 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
          {sub && <p className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** ปุ่มแบบ pill ใช้ซ้ำทั้งตัวเลือกสาขา รายวัน/รายสัปดาห์ และปุ่มในการ์ด */
export function Pill({ active, onClick, children, ...rest }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} {...rest}
            className={`shrink-0 rounded-full px-3 py-1 text-sm transition-colors ${
              active ? "bg-brand-strong font-medium text-white shadow-[0_4px_12px_-6px_rgba(185,83,28,0.7)]"
                     : "text-muted ring-1 ring-line hover:bg-brand/50 hover:text-brand-ink"}`}>
      {children}
    </button>
  );
}

/** แสดงแทนส่วนที่ยังคำนวณไม่ได้ เช่น ฟังก์ชันยังเป็น "ยังไม่ได้ทำ" */
export function Pending({ lab, error }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper/50 p-6 text-center text-muted">
      <div className="text-sm font-medium text-ink/80">รอ {lab}</div>
      <div className="mt-1 text-xs">{error}</div>
    </div>
  );
}

export function Insight({ children }) {
  return (
    <p className="mt-4 flex gap-2 rounded-xl border border-oat bg-oat/40 px-3.5 py-2.5 text-sm leading-relaxed text-ink/85">
      <span aria-hidden="true">💡</span><span>{children}</span>
    </p>
  );
}

/** ส่วนหัวร่วม: ล็อกอิน, ความสดของข้อมูล, จำนวนเอกสารที่อ่าน */
export function AnalyticsShell({ source, state, title, eyebrow = "Analytics", children }) {
  const { user, data, error } = state;
  const [authError, setAuthError] = useState(null);
  if (user === undefined) return <p className="py-16 text-center text-muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (!user) return <div className="py-6 sm:py-12"><LoginCard onSignIn={() => source.signIn().catch((e) => setAuthError(authErrorText(e)))} error={authError} /></div>;
  const m = data?.meta;
  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-strong">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-light tracking-tight text-ink sm:text-3xl">{title}</h1>
          {m && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Chip>ข้อมูลถึง <b className="font-medium text-ink">{thaiDay(m.asOf)}</b></Chip>
              <Chip><b className="font-medium tabular-nums text-ink">{m.rows?.toLocaleString()}</b> รายการ</Chip>
              {m.builtBy === "demo"
                ? <span className="rounded-full bg-oat px-2.5 py-1 text-oat-ink">โหมดสาธิต · คำนวณในเบราว์เซอร์</span>
                : <>
                    <Chip>อัปเดต {m.builtAt ? new Date(m.builtAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "–"} · {m.builtBy === "github-actions" ? "GitHub Actions" : "เครื่องผู้สอน/ผู้เรียน"}</Chip>
                    <span className="rounded-full bg-mist px-2.5 py-1 text-mist-ink">อ่าน {data.reads} เอกสาร</span>
                  </>}
            </div>
          )}
        </div>
        <UserChip user={user} onSignOut={() => source.signOut()} />
      </header>
      {error && <p className="rounded-xl bg-blush/50 p-3 text-sm text-danger">{error}</p>}
      {!data && !error && <p className="py-16 text-center text-muted">กำลังโหลดผลวิเคราะห์…</p>}
      {data && children(data)}
    </div>
  );
}

function Chip({ children }) {
  return <span className="rounded-full border border-line bg-card px-2.5 py-1">{children}</span>;
}
