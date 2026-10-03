import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  addMovingAverage,
  computeBranchSales,
  computeDailySales,
  computeKpis,
  computeTopProducts,
  dateKey,
  filterRows,
  formatBaht,
  formatCount,
  formatThaiShortDate,
} from './lib/metrics'
import {
  AXIS_COLOR,
  CARD_CLASS,
  CARD_COLOR,
  CURSOR_FILL,
  GRID_COLOR,
  LABEL_COLOR,
  SERIES_COLOR,
} from './theme'
import KpiCard from './components/KpiCard.jsx'
import TopProducts from './components/TopProducts.jsx'

// Single accent hue for both charts — one measure (revenue), so identity
// color-per-series would be noise, not signal. See dataviz skill.
// In the daily chart the raw daily line is the same hue at low opacity so the
// 7-day average reads as the main line and the daily values as background.
const DAILY_LINE_OPACITY = 0.3

// Y-axis ticks: short form ("12K") so the axis stays narrow on phones.
const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const formatAxisNumber = (v) => compactNumber.format(v)

const INPUT_CLASS =
  'h-10 w-full rounded-xl border border-line bg-paper/60 px-3 text-sm text-ink transition-colors hover:border-accent/40 focus:border-accent focus:bg-card focus:outline-none focus:ring-4 focus:ring-accent/15'

function FilterField({ label, children }) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5 sm:flex-none">
      <span className="text-xs tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

function ChartCard({ title, subtitle, legend, children }) {
  return (
    <section className={`${CARD_CLASS} p-4 sm:p-6`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {legend}
      </div>
      <div className="h-60 w-full sm:h-72">{children}</div>
    </section>
  )
}

function LegendItem({ label, opacity = 1, width = 2 }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span
        className="inline-block w-4 rounded-full"
        style={{ height: width, backgroundColor: SERIES_COLOR, opacity }}
      />
      {label}
    </span>
  )
}

function CustomTooltip({ active, payload, label, labelPrefix = '', labelFormatter = (l) => l }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-sm shadow-[0_6px_20px_-8px_rgba(58,53,48,0.18)]">
      <p className="text-xs text-muted">{labelPrefix}{labelFormatter(label)}</p>
      {payload.length === 1 ? (
        <p className="font-medium tabular-nums text-ink">
          {formatBaht(payload[0].value)}
        </p>
      ) : (
        payload
          .filter((p) => p.value != null)
          .map((p) => (
            <p key={p.dataKey} className="flex justify-between gap-4 tabular-nums">
              <span className="text-muted">{p.name}</span>
              <span className="font-medium text-ink">{formatBaht(p.value)}</span>
            </p>
          ))
      )}
    </div>
  )
}

// The overview tab. sales.csv is loaded once in Root.jsx and passed in, so
// the Lab 2.2 tab can share the same rows.
function App({ rows, products }) {
  const [branch, setBranch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Full-data facts for the header and the filter controls.
  const allBranches = useMemo(
    () => (rows ? computeBranchSales(rows).map((b) => b.branch) : []),
    [rows],
  )
  const dataRange = useMemo(() => {
    if (!rows || rows.length === 0) return null
    let min = dateKey(rows[0].datetime)
    let max = min
    for (const row of rows) {
      const day = dateKey(row.datetime)
      if (day < min) min = day
      if (day > max) max = day
    }
    return { min, max }
  }, [rows])

  // KPIs and the daily chart follow every filter. The branch chart follows
  // only the date range, so the selected branch can still be compared with
  // the others (it is highlighted instead of shown alone).
  const dateRows = useMemo(
    () => (rows ? filterRows(rows, { from, to }) : []),
    [rows, from, to],
  )
  const filteredRows = useMemo(
    () => (branch ? filterRows(dateRows, { branch }) : dateRows),
    [dateRows, branch],
  )
  const kpis = useMemo(
    () => (rows ? computeKpis(filteredRows) : null),
    [rows, filteredRows],
  )
  const daily = useMemo(
    () => addMovingAverage(computeDailySales(filteredRows), 7),
    [filteredRows],
  )
  const branchSales = useMemo(() => computeBranchSales(dateRows), [dateRows])
  // Top menu follows every filter, like the KPIs.
  const topProducts = useMemo(
    () => computeTopProducts(filteredRows, products ?? [], 5),
    [filteredRows, products],
  )

  const isFiltered = branch !== '' || from !== '' || to !== ''
  const resetFilters = () => {
    setBranch('')
    setFrom('')
    setTo('')
  }

  if (!rows || !kpis) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted">กำลังโหลดข้อมูล...</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-strong">Sales overview</p>
            <h1 className="mt-1 text-2xl font-light tracking-tight text-ink sm:text-3xl">
              ภาพรวมยอดขาย
            </h1>
          </div>
          {dataRange && (
            <p className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted sm:text-sm">
              ข้อมูลวันที่{' '}
              <span className="font-medium tabular-nums text-ink">
                {formatThaiShortDate(dataRange.min)} –{' '}
                {formatThaiShortDate(dataRange.max)}
              </span>
            </p>
          )}
        </div>

        <div className={`${CARD_CLASS} flex flex-wrap items-end gap-3 p-4 sm:gap-4 sm:p-5`}>
          <FilterField label="สาขา">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">ทุกสาขา</option>
              {allBranches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="ตั้งแต่วันที่">
            <input
              type="date"
              value={from}
              min={dataRange?.min}
              max={to || dataRange?.max}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT_CLASS}
            />
          </FilterField>
          <FilterField label="ถึงวันที่">
            <input
              type="date"
              value={to}
              min={from || dataRange?.min}
              max={dataRange?.max}
              onChange={(e) => setTo(e.target.value)}
              className={INPUT_CLASS}
            />
          </FilterField>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!isFiltered}
            className="h-10 rounded-xl border border-line px-4 text-sm text-ink transition-colors hover:bg-blush hover:text-blush-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
          >
            ล้างตัวกรอง
          </button>
          {isFiltered && (
            <p className="basis-full text-xs text-muted">
              กำลังแสดง: {branch || 'ทุกสาขา'} ·{' '}
              {formatThaiShortDate(from || dataRange.min)} –{' '}
              {formatThaiShortDate(to || dataRange.max)} ·{' '}
              {formatCount(filteredRows.length)} แถว
            </p>
          )}
        </div>

        {filteredRows.length === 0 ? (
          <div className={`${CARD_CLASS} p-10 text-center text-muted`}>
            ไม่มีข้อมูลในสาขาและช่วงวันที่ที่เลือก
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <KpiCard label="ยอดขายรวม" value={formatBaht(kpis.totalRevenue)} icon="revenue" tone="brand" />
          <KpiCard label="จำนวนบิล" value={formatCount(kpis.billCount)} icon="bills" tone="mist" />
          <KpiCard
            label="ยอดเฉลี่ยต่อบิล"
            value={formatBaht(kpis.avgPerBill)}
            icon="avg"
            tone="oat"
          />
          <KpiCard
            label="ลูกค้าสมาชิก (ไม่ซ้ำ)"
            value={formatCount(kpis.uniqueMembers)}
            icon="members"
            tone="blush"
          />
        </div>

        <ChartCard
          title="ยอดขายรายวัน"
          subtitle="เส้นเข้ม = ค่าเฉลี่ย 7 วัน ช่วยให้เห็นแนวโน้มชัดขึ้น"
          legend={
            <div className="flex gap-4">
              <LegendItem label="รายวัน" opacity={DAILY_LINE_OPACITY} width={1.5} />
              <LegendItem label="เฉลี่ย 7 วัน" width={3} />
            </div>
          }
        >
          <ResponsiveContainer>
            <LineChart data={daily} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="date"
                tickFormatter={formatThaiShortDate}
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisNumber}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip labelFormatter={formatThaiShortDate} />}
                cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="รายวัน"
                stroke={SERIES_COLOR}
                strokeOpacity={DAILY_LINE_OPACITY}
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ma"
                name="เฉลี่ย 7 วัน"
                stroke={SERIES_COLOR}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: CARD_COLOR, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartCard
          title="ยอดขายแยกสาขา"
          subtitle={branch ? `เทียบ ${branch} กับสาขาอื่น · เรียงจากมากไปน้อย` : 'เรียงจากมากไปน้อย'}
        >
          <ResponsiveContainer>
            {/* layout="vertical" = horizontal bars: branches on the Y axis,
                revenue on the X axis. branchSales is already sorted highest
                first, and a category Y axis draws the first item on top. */}
            <BarChart
              data={branchSales}
              layout="vertical"
              margin={{ left: 0, right: 48 }}
            >
              <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisNumber}
              />
              <YAxis
                type="category"
                dataKey="branch"
                tick={{ fontSize: 12, fill: LABEL_COLOR }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                interval={0}
                width={84}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: CURSOR_FILL }} />
              <Bar dataKey="revenue" fill={SERIES_COLOR} radius={[0, 8, 8, 0]} maxBarSize={26} isAnimationActive={false}>
                {/* With a branch selected, its bar stays solid and the others
                    fade, so it can still be compared against them. */}
                {branchSales.map((b) => (
                  <Cell
                    key={b.branch}
                    fillOpacity={!branch || b.branch === branch ? 1 : DAILY_LINE_OPACITY}
                  />
                ))}
                <LabelList
                  dataKey="revenue"
                  position="right"
                  formatter={formatAxisNumber}
                  style={{ fontSize: 12, fill: LABEL_COLOR }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <TopProducts
          items={topProducts}
          subtitle={`${branch || 'ทุกสาขา'} · ${formatThaiShortDate(from || dataRange.min)} – ${formatThaiShortDate(to || dataRange.max)}`}
        />
        </div>
        </>
        )}
      </div>
    </div>
  )
}

export default App
