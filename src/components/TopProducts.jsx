import { formatBaht, formatCount } from '../lib/metrics'
import { CARD_CLASS, SERIES_COLOR } from '../theme'

// Line icons per menu category (products.csv `category`); decoration only.
const CUP = <path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M9 3c0 1 1 1 1 2M13 3c0 1 1 1 1 2" />
const ICONS = {
  กาแฟ: CUP,
  ชา: <path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM17 11h1.5a2 2 0 0 1 0 4H17M11 9V5l3-2" />,
  นอนคอฟฟี่: CUP,
  ปั่น: <path d="M7 4h10l-1.5 15a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2zM7.5 9h9M13 4l2-2" />,
  โซดา: <path d="M8 4h8l-1 16H9zM8.5 9h7M12 13v.01M11 16v.01M13.5 17v.01" />,
  เบเกอรี่: <path d="M3 15c0-4 4-8 9-8s9 4 9 8c0 1.5-1.5 2-3 2H6c-1.5 0-3-.5-3-2zM9 8l1.5 9M15 8l-1.5 9" />,
  อาหาร: <path d="M3 12h18a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8zM8 9c0-2 2-2 2-4M13 9c0-2 2-2 2-4" />,
}
const DOT = <circle cx="12" cy="12" r="4" />

// Rank badge colours: gold-ish for the top three, quiet after that.
const RANK_CLASS = [
  'bg-brand-strong text-white',
  'bg-brand text-brand-ink',
  'bg-oat text-oat-ink',
]

/** Best-selling menu items, from computeTopProducts(). */
export default function TopProducts({ items, subtitle }) {
  const top = items[0]?.revenue || 1
  return (
    <section className={`${CARD_CLASS} p-4 sm:p-6`}>
      <div className="mb-3">
        <h2 className="text-base font-medium text-ink">เมนูขายดี {items.length} อันดับ</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">ยังไม่มียอดขายในช่วงนี้</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((p, i) => (
            <li key={p.productId} className="flex items-center gap-3 py-3">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                  RANK_CLASS[i] ?? 'bg-paper text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-brand-strong" title={p.category || undefined}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[p.category] ?? DOT}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatBaht(p.revenue)}</p>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-paper">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${(p.revenue / top) * 100}%`, backgroundColor: SERIES_COLOR }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {p.category && `${p.category} · `}
                  {formatCount(p.qty)} ชิ้น · {(p.share * 100).toFixed(1)}% ของยอดขาย
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
