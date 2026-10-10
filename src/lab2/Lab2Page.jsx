import * as Bad from "./BadCharts.jsx";
import * as Fixed from "./FixedCharts.jsx";
import { CARD_CLASS } from "../theme";

// โจทย์ของแต่ละกราฟ: คำถามทางธุรกิจที่กราฟต้องตอบ + คำถามนำให้วิจารณ์
const CASES = [
  {
    n: 1, title: "สัดส่วนยอดขายแต่ละเมนู",
    ask: "ผู้จัดการฝ่ายเมนูถาม: เมนูไหนทำเงินมากที่สุด ควรโปรโมตตัวไหน",
    probe: ["บอกได้ไหมว่าเมนูอันดับ 3 คืออะไร", "สีใช้แยกอะไร จำได้ไหมว่าสีไหนคือเมนูไหน"],
  },
  {
    n: 2, title: "ยอดขายแยกสาขา",
    ask: "เจ้าของร้านถาม: สาขาต่าง ๆ ขายได้ต่างกันมากแค่ไหน",
    probe: ["ดูด้วยตา สยามขายได้กี่เท่าของอารีย์", "ลองเทียบกับตัวเลขจริงใน Tooltip"],
  },
  {
    n: 3, title: "ยอดขายรายวัน",
    ask: "เจ้าของร้านถาม: ยอดขายโดยรวมโตขึ้นหรือลดลง",
    probe: ["เห็นแนวโน้มชัดไหม หรือเห็นแต่ความยุ่ง", "อ่านวันที่บนแกนได้ไหม"],
  },
  {
    n: 4, title: "ยอดขายรายเดือน",
    ask: "ผู้บริหารถาม: ทำไมเดือนล่าสุดยอดตก ต้องทำโปรฯ ด่วนไหม",
    probe: ["ข้อมูลเดือนล่าสุดมีกี่วัน (ดูใน README ของข้อมูล)", "ถ้าเดือนนี้ขายครบทั้งเดือนจะได้ประมาณเท่าไร"],
  },
  {
    n: 5, title: "ผลงานผู้จัดการสาขา",
    ask: "ฝ่ายบุคคลถาม: ผู้จัดการสาขาไหนควรได้รับการพัฒนาเร่งด่วน",
    probe: ["ทุกสาขาเปิดขายมานานเท่ากันไหม (ดู branches.csv)", "การเทียบแบบนี้ยุติธรรมกับผู้จัดการทุกคนไหม"],
  },
];

function Placeholder({ n }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-line p-6 text-center text-muted">
      <div className="text-lg font-medium">ยังไม่ได้ซ่อม</div>
      <div className="mt-1 text-sm">
        สร้าง <code className="rounded bg-paper px-1">FixedChart{n}</code> ใน <code className="rounded bg-paper px-1">src/lab2/FixedCharts.jsx</code>
      </div>
    </div>
  );
}

export default function Lab2Page({ rows, products }) {
  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-strong">Lab 2.2</p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-ink sm:text-3xl">ซ่อมกราฟแย่</h1>
        <p className="mt-1 max-w-3xl text-muted">
          กราฟซ้ายมือทุกอันใช้ข้อมูลถูกต้อง แต่ทำให้คนดูเข้าใจผิดหรืออ่านไม่ออก วิจารณ์ลงใน LAB2_WORKSHEET.md
          แล้วสั่ง AI สร้างกราฟที่ตอบคำถามได้ดีกว่าทางขวามือ
        </p>
      </header>

      {CASES.map((c) => {
        const BadC = Bad[`BadChart${c.n}`];
        const FixC = Fixed[`FixedChart${c.n}`];
        return (
          <section key={c.n} id={`case-${c.n}`} className={`${CARD_CLASS} mb-6 p-4 sm:p-6`}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="rounded-full bg-brand-strong px-3 py-0.5 text-sm font-semibold text-white">กราฟ {c.n}</span>
              <h2 className="text-lg font-semibold tracking-tight text-ink">{c.title}</h2>
            </div>
            <p className="mt-2 font-medium text-ink/85">{c.ask}</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">
              {c.probe.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-semibold text-danger">ก่อนซ่อม</div>
                <div className="h-80 overflow-hidden rounded-lg bg-paper/70 p-2">
                  <BadC rows={rows} products={products} />
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-mist-ink">หลังซ่อม</div>
                <div className="h-80 overflow-hidden rounded-lg bg-paper/70 p-2">
                  {FixC ? <FixC rows={rows} products={products} /> : <Placeholder n={c.n} />}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
