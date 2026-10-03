// หน้า "ลูกค้า" · กราฟสมาชิก 4 กราฟ แต่ละกราฟตอบคำถามธุรกิจ 1 ข้อ
// ใช้สีหลักสีเดียวกับหน้าภาพรวม และมีข้อความสรุป 1 บรรทัดที่คำนวณจากข้อมูลจริง
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCount, formatThaiShortDate } from '../lib/metrics'
import {
  lastJoinedDate,
  lastSaleDate,
  memberBillShareByBranch,
  memberVisitBuckets,
  membersByAge,
  newMembersByMonth,
} from './customerMetrics'
import {
  AXIS_COLOR,
  CARD_CLASS,
  CURSOR_FILL,
  GRID_COLOR,
  INK_COLOR,
  LABEL_COLOR,
  SERIES_COLOR,
  TOOLTIP_STYLE,
} from '../theme'

const MAIN = SERIES_COLOR
const GRID = GRID_COLOR
const AXIS = AXIS_COLOR
const TICK = { fontSize: 12, fill: AXIS }
const LABEL = { fontSize: 11, fill: LABEL_COLOR }
const FADED = 0.35
const pct = (x) => `${(x * 100).toFixed(1)}%`

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const thaiMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return `${THAI_MONTHS[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}`
}

const tooltipProps = (label, fmt = formatCount) => ({
  formatter: (v) => [fmt(v), label],
  contentStyle: TOOLTIP_STYLE,
  labelStyle: { color: LABEL_COLOR },
  itemStyle: { color: INK_COLOR },
  cursor: { fill: CURSOR_FILL },
})

// แถบสีพาสเทลด้านบนการ์ด ใช้แยกการ์ดให้ดูง่าย ไม่ได้สื่อความหมายของข้อมูล
const TONES = { brand: 'bg-brand', mist: 'bg-mist', blush: 'bg-blush', oat: 'bg-oat' }

/** ตัวเลขสรุปบนสุดของหน้า ใช้หน้าตาเดียวกับ KpiCard ในหน้าภาพรวม และมีบรรทัดอธิบายเสริมได้ */
function StatCard({ label, value, note, tone }) {
  return (
    <div className={`${CARD_CLASS} min-w-0 p-4 sm:p-5`}>
      <span className={`mb-3 block h-1.5 w-8 rounded-full ${TONES[tone]}`} />
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className="mt-1 break-words text-xl font-medium tabular-nums tracking-tight text-ink sm:text-[1.75rem]">{value}</p>
      {note && <p className="mt-1.5 text-xs leading-snug text-muted">{note}</p>}
    </div>
  )
}

function ChartCard({ title, summary, note, children }) {
  return (
    <section className={`${CARD_CLASS} flex flex-col p-4 sm:p-6`}>
      <h2 className="text-base font-medium text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted [&_b]:font-medium [&_b]:text-ink">{summary}</p>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
      {note && <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-xs leading-snug text-muted">{note}</p>}
    </section>
  )
}

/** ลูกค้าหลักอายุเท่าไร: แท่งเรียงตามช่วงอายุ เพราะอายุเป็นข้อมูลที่มีลำดับ */
function AgeChart({ customers }) {
  const data = useMemo(() => membersByAge(customers), [customers])
  const top = data.reduce((a, b) => (b.count > a.count ? b : a))
  const young = data.filter((d) => d.age === '18-24' || d.age === '25-34')
  const youngShare = young.reduce((s, d) => s + d.share, 0)
  return (
    <ChartCard
      title="สมาชิกแต่ละช่วงอายุ"
      summary={<>กลุ่มใหญ่สุดคือ <b>{top.age} ปี</b> {formatCount(top.count)} คน ({pct(top.share)}) · อายุ 18–34 รวมกัน {pct(youngShare)} ของสมาชิกทั้งหมด</>}
    >
      <BarChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="age" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} tickFormatter={formatCount} />
        <Tooltip {...tooltipProps('สมาชิก (คน)')} />
        <Bar dataKey="count" fill={MAIN} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false}>
          <LabelList dataKey="share" position="top" formatter={pct} style={LABEL} />
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

/** สาขาไหนเปลี่ยนลูกค้าเป็นสมาชิกได้ดี: % ของบิลที่เป็นสมาชิก (นับบิล ไม่ใช่แถว) */
function MemberShareChart({ sales }) {
  const data = useMemo(() => memberBillShareByBranch(sales), [sales])
  const allBills = data.reduce((s, b) => s + b.bills, 0)
  const allMember = data.reduce((s, b) => s + b.memberBills, 0)
  const top = data[0]
  const low = data[data.length - 1]
  return (
    <ChartCard
      title="สัดส่วนบิลที่เป็นสมาชิก แยกสาขา"
      summary={<>ทั้งร้าน {pct(allMember / allBills)} ของบิลเป็นสมาชิก · <b>{top.branch}</b> สูงสุด {pct(top.share)} · {low.branch} ต่ำสุด {pct(low.share)}</>}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, 1]} tick={TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
        <YAxis type="category" dataKey="branch" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval={0} width={84} />
        <Tooltip
          {...tooltipProps('บิลของสมาชิก', pct)}
          labelFormatter={(b) => {
            const d = data.find((x) => x.branch === b)
            return `${b} · ${formatCount(d.memberBills)} จาก ${formatCount(d.bills)} บิล`
          }}
        />
        <Bar dataKey="share" fill={MAIN} radius={[0, 6, 6, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList dataKey="share" position="right" formatter={pct} style={LABEL} />
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

/** สมาชิกใหม่เพิ่มขึ้นไหม: รายเดือน เดือนที่ข้อมูลไม่ครบเป็นแท่งจาง และเทียบแบบต่อวัน */
function NewMembersChart({ customers, dataEnd }) {
  const data = useMemo(() => newMembersByMonth(customers, dataEnd), [customers, dataEnd])
  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const change = last.count / last.days / (prev.count / prev.days) - 1
  return (
    <ChartCard
      title="สมาชิกใหม่รายเดือน"
      summary={
        last.partial ? (
          <>ข้อมูลสมาชิกถึง {formatThaiShortDate(dataEnd)} ({last.days} จาก {last.fullDays} วันของ{thaiMonth(last.month)}) ได้สมาชิกใหม่ {formatCount(last.count)} คน · เฉลี่ยต่อวัน{' '}
            <b>{change >= 0 ? 'มากกว่า' : 'น้อยกว่า'} {thaiMonth(prev.month)} {pct(Math.abs(change))}</b></>
        ) : (
          <>{thaiMonth(last.month)} ได้สมาชิกใหม่ {formatCount(last.count)} คน <b>{change >= 0 ? 'มากกว่า' : 'น้อยกว่า'} {thaiMonth(prev.month)} {pct(Math.abs(change))}</b></>
        )
      }
      note={
        last.partial && (
          <>
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
              style={{ backgroundColor: MAIN, opacity: FADED }}
            />
            แท่งจาง = ข้อมูลไม่ครบเดือน · {thaiMonth(last.month)} มีข้อมูลสมัครถึง {formatThaiShortDate(dataEnd)} เท่านั้น
            ({last.days}/{last.fullDays} วัน) แท่งจึงเตี้ยกว่าเดือนอื่น อย่าเทียบจำนวนรวมตรง ๆ ให้เทียบค่าเฉลี่ยต่อวันด้านบน
          </>
        )
      }
    >
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={thaiMonth} minTickGap={8} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} tickFormatter={formatCount} />
        <Tooltip
          {...tooltipProps('สมาชิกใหม่ (คน)')}
          labelFormatter={(m) => {
            const d = data.find((x) => x.month === m)
            return d.partial ? `${thaiMonth(m)} · ข้อมูล ${d.days}/${d.fullDays} วัน` : thaiMonth(m)
          }}
        />
        <Bar dataKey="count" fill={MAIN} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.month} fillOpacity={d.partial ? FADED : 1} />)}
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

/** สมาชิกกลับมาซื้อซ้ำไหม: จำนวนสมาชิกตามจำนวนบิลที่ซื้อ รวมคนที่สมัครแล้วยังไม่เคยซื้อ */
function VisitsChart({ visits: v }) {
  const never = v.buckets[0]
  return (
    <ChartCard
      title="สมาชิกซื้อกี่บิล"
      summary={<>สมาชิกที่เคยซื้อ <b>{pct(v.repeatShare)} กลับมาซื้อซ้ำ</b> (ค่ากลาง {formatCount(v.medianBills)} บิล/คน) · อีก {formatCount(never.count)} คน ({pct(never.count / v.total)}) สมัครแล้วยังไม่เคยซื้อ</>}
    >
      <BarChart data={v.buckets} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={formatCount} />
        <YAxis type="category" dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval={0} width={96} />
        <Tooltip {...tooltipProps('สมาชิก (คน)')} />
        <Bar dataKey="count" fill={MAIN} radius={[0, 6, 6, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" formatter={formatCount} style={LABEL} />
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

export default function CustomersPage({ customers, sales }) {
  const joinedEnd = useMemo(() => lastJoinedDate(customers), [customers])
  const salesEnd = useMemo(() => lastSaleDate(sales), [sales])
  const visits = useMemo(() => memberVisitBuckets(customers, sales), [customers, sales])
  const billShare = useMemo(() => {
    const bills = new Set()
    const memberBills = new Set()
    for (const row of sales) {
      bills.add(row.order_id)
      if (row.customer_id) memberBills.add(row.order_id)
    }
    return { bills: bills.size, memberBills: memberBills.size }
  }, [sales])
  const neverBought = visits.buckets[0].count
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-strong">Members</p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-ink sm:text-3xl">ลูกค้าสมาชิก</h1>
        <p className="mt-2 text-sm text-muted">
          สมาชิกทั้งหมด {formatCount(customers.length)} คน (สมัครถึง {formatThaiShortDate(joinedEnd)})
          · ข้อมูลการซื้อจาก sales.csv ถึง {formatThaiShortDate(salesEnd)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard tone="brand" label="สมาชิกทั้งหมด" value={formatCount(visits.total)} />
        <StatCard
          tone="mist"
          label="เคยซื้ออย่างน้อย 1 บิล"
          value={formatCount(visits.buyers)}
          note={`${pct(visits.buyers / visits.total)} ของสมาชิก`}
        />
        <StatCard
          tone="blush"
          label="สมัครแล้วยังไม่เคยซื้อ"
          value={formatCount(neverBought)}
          note={`${pct(neverBought / visits.total)} ของสมาชิก · ถ้าคิดยอดต่อสมาชิก ควรหารด้วยคนที่เคยซื้อ`}
        />
        <StatCard
          tone="oat"
          label="บิลที่เป็นของสมาชิก"
          value={pct(billShare.memberBills / billShare.bills)}
          note={`${formatCount(billShare.memberBills)} จาก ${formatCount(billShare.bills)} บิล`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AgeChart customers={customers} />
        <MemberShareChart sales={sales} />
        <NewMembersChart customers={customers} dataEnd={joinedEnd} />
        <VisitsChart visits={visits} />
      </div>
    </div>
  )
}
