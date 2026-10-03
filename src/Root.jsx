import Papa from 'papaparse'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import App from './App.jsx'
import CustomersPage from './customers/CustomersPage.jsx'
import Lab2Page from './lab2/Lab2Page.jsx'
import { prepareRows } from './lib/metrics'

// Firebase is only needed on the live tab, so it loads in its own chunk.
const LiveTab = lazy(() => import('./lab3/LiveTab.jsx'))

// Loads the CSVs once and switches between the tabs. The tab is kept in the
// URL hash (#customers, #lab2) so it survives a refresh and can be linked to.
const TABS = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'customers', label: 'ลูกค้า' },
  { id: 'live', label: 'ยอดขาย Real Time' },
  { id: 'lab2', label: 'Lab 2.2 · ซ่อมกราฟ' },
]

async function loadCsv(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`โหลด ${url.slice(1)} ไม่สำเร็จ (${res.status})`)
  return Papa.parse(await res.text(), { header: true, skipEmptyLines: true }).data
}

const tabFromHash = () => {
  const id = window.location.hash.slice(1)
  return TABS.some((t) => t.id === id) ? id : 'overview'
}

function Root() {
  const [rows, setRows] = useState(null)
  const [products, setProducts] = useState(null)
  const [customers, setCustomers] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(tabFromHash)

  useEffect(() => {
    Promise.all([loadCsv('/sales.csv'), loadCsv('/products.csv'), loadCsv('/customers.csv')])
      .then(([sales, prods, custs]) => {
        setRows(sales)
        setProducts(prods)
        setCustomers(custs)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Lab 2.2 charts read revenue/date/hour fields; only build them when needed.
  const labRows = useMemo(
    () => (rows && tab === 'lab2' ? prepareRows(rows) : null),
    [rows, tab],
  )

  const choose = (id) => {
    setTab(id)
    window.history.replaceState(null, '', id === 'overview' ? window.location.pathname : `#${id}`)
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-wide text-ink">บ้านบรู</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">baan brew</p>
            </div>
          </div>
          <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-line bg-card/70 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors ${
                  tab === t.id
                    ? 'bg-sage font-medium text-sage-ink'
                    : 'text-muted hover:bg-paper hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {tab === 'live' ? (
        <Suspense fallback={<p className="p-10 text-center text-muted">กำลังโหลด...</p>}>
          <LiveTab />
        </Suspense>
      ) : error ? (
        <p className="p-6 text-center text-danger">{error}</p>
      ) : !rows ? (
        <p className="p-10 text-center text-muted">กำลังโหลดข้อมูล...</p>
      ) : tab === 'overview' ? (
        <App rows={rows} />
      ) : tab === 'customers' ? (
        <CustomersPage customers={customers} sales={rows} />
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-5 sm:p-6">
          <Lab2Page rows={labRows} products={products} />
        </div>
      )}

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-xs tracking-wide text-muted/80 sm:px-6">
        บ้านบรู · ข้อมูลจาก sales.csv, customers.csv
      </footer>
    </div>
  )
}

export default Root
