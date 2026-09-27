import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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

  const kpis = useMemo(() => (rows ? computeKpis(rows) : null), [rows])
  const daily = useMemo(
    () => (rows ? addMovingAverage(computeDailySales(rows), 7) : []),
    [rows],
  )
  const branchSales = useMemo(
    () => (rows ? computeBranchSales(rows) : []),
    [rows],
  )

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
        <h1 className="text-xl font-semibold text-[#0b0b0b] sm:text-2xl">
          บ้านบรู Dashboard
        </h1>

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
      </div>
    </div>
  )
}

export default App
