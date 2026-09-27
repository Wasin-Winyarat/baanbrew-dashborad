import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
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
  dateKey,
  filterRows,
  formatBaht,
  formatCount,
  formatThaiShortDate,
} from './lib/metrics'

// Single accent hue for both charts — one measure (revenue), so identity
// color-per-series would be noise, not signal. See dataviz skill.
// In the daily chart the raw daily line is the same hue at low opacity so the
// 7-day average reads as the main line and the daily values as background.
const SERIES_COLOR = '#2a78d6'
const DAILY_LINE_OPACITY = 0.3
const GRID_COLOR = '#e1e0d9'
const AXIS_COLOR = '#898781'

// Y-axis ticks: short form ("12K") so the axis stays narrow on phones.
const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const formatAxisNumber = (v) => compactNumber.format(v)

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-black/15 bg-white px-2 text-sm text-[#0b0b0b] focus:border-[#2a78d6] focus:outline-none focus:ring-2 focus:ring-[#2a78d6]/20'

function FilterField({ label, children }) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1 sm:flex-none">
      <span className="text-xs text-[#52514e]">{label}</span>
      {children}
    </label>
  )
}

function KpiCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-black/10 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-xs text-[#52514e] sm:text-sm">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold tabular-nums text-[#0b0b0b] sm:text-2xl">
        {value}
      </p>
    </div>
  )
}

function ChartCard({ title, legend, children }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold text-[#0b0b0b]">{title}</h2>
        {legend}
      </div>
      <div className="h-60 w-full sm:h-72">{children}</div>
    </div>
  )
}

function LegendItem({ label, opacity = 1, width = 2 }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[#52514e]">
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
    <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-md">
      <p className="text-[#52514e]">{labelPrefix}{labelFormatter(label)}</p>
      {payload.length === 1 ? (
        <p className="font-semibold tabular-nums text-[#0b0b0b]">
          {formatBaht(payload[0].value)}
        </p>
      ) : (
        payload
          .filter((p) => p.value != null)
          .map((p) => (
            <p key={p.dataKey} className="flex justify-between gap-4 tabular-nums">
              <span className="text-[#52514e]">{p.name}</span>
              <span className="font-semibold text-[#0b0b0b]">{formatBaht(p.value)}</span>
            </p>
          ))
      )}
    </div>
  )
}

function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/sales.csv')
      .then((res) => {
        if (!res.ok) throw new Error(`โหลด sales.csv ไม่สำเร็จ (${res.status})`)
        return res.text()
      })
      .then((csvText) => {
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        })
        setRows(parsed.data)
      })
      .catch((err) => setError(err.message))
  }, [])

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

  const isFiltered = branch !== '' || from !== '' || to !== ''
  const resetFilters = () => {
    setBranch('')
    setFrom('')
    setTo('')
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9f7] p-6">
        <p className="text-[#d03b3b]">{error}</p>
      </div>
    )
  }

  if (!rows || !kpis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9f7]">
        <p className="text-[#52514e]">กำลังโหลดข้อมูล...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9f9f7] px-4 py-5 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-semibold text-[#0b0b0b] sm:text-2xl">
            บ้านบรู Dashboard
          </h1>
          {dataRange && (
            <p className="text-sm text-[#52514e]">
              ข้อมูลวันที่{' '}
              <span className="font-medium tabular-nums text-[#0b0b0b]">
                {formatThaiShortDate(dataRange.min)} –{' '}
                {formatThaiShortDate(dataRange.max)}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-sm sm:gap-4 sm:p-4">
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
            className="h-9 rounded-md border border-black/15 px-3 text-sm text-[#0b0b0b] hover:bg-black/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
          >
            ล้างตัวกรอง
          </button>
          {isFiltered && (
            <p className="basis-full text-xs text-[#52514e]">
              กำลังแสดง: {branch || 'ทุกสาขา'} ·{' '}
              {formatThaiShortDate(from || dataRange.min)} –{' '}
              {formatThaiShortDate(to || dataRange.max)} ·{' '}
              {formatCount(filteredRows.length)} แถว
            </p>
          )}
        </div>

        {filteredRows.length === 0 ? (
          <div className="rounded-lg border border-black/10 bg-white p-8 text-center text-[#52514e] shadow-sm">
            ไม่มีข้อมูลในสาขาและช่วงวันที่ที่เลือก
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <KpiCard label="ยอดขายรวม" value={formatBaht(kpis.totalRevenue)} />
          <KpiCard label="จำนวนบิล" value={formatCount(kpis.billCount)} />
          <KpiCard
            label="ยอดเฉลี่ยต่อบิล"
            value={formatBaht(kpis.avgPerBill)}
          />
          <KpiCard
            label="ลูกค้าสมาชิก (ไม่ซ้ำ)"
            value={formatCount(kpis.uniqueMembers)}
          />
        </div>

        <ChartCard
          title="ยอดขายรายวัน"
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
                axisLine={{ stroke: AXIS_COLOR }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisNumber}
                width={40}
              />
              <Tooltip content={<CustomTooltip labelFormatter={formatThaiShortDate} />} />
              <Line
                type="monotone"
                dataKey="revenue"
                name="รายวัน"
                stroke={SERIES_COLOR}
                strokeOpacity={DAILY_LINE_OPACITY}
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ma"
                name="เฉลี่ย 7 วัน"
                stroke={SERIES_COLOR}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ยอดขายแยกสาขา (มากไปน้อย)">
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
                tick={{ fontSize: 12, fill: AXIS_COLOR }}
                tickLine={false}
                axisLine={{ stroke: AXIS_COLOR }}
                interval={0}
                width={84}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="revenue" fill={SERIES_COLOR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
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
                  style={{ fontSize: 12, fill: '#52514e' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        </>
        )}
      </div>
    </div>
  )
}

export default App
