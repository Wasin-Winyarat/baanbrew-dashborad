import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import App from './App.jsx'
import CustomersPage from './customers/CustomersPage.jsx'
import Lab2Page from './lab2/Lab2Page.jsx'
import { prepareRows } from './lib/metrics'

// Loads the CSVs once and switches between the tabs. The tab is kept in the
// URL hash (#customers, #lab2) so it survives a refresh and can be linked to.
const TABS = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'customers', label: 'ลูกค้า' },
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
    <div className="min-h-screen bg-[#f9f9f7]">
      <nav className="sticky top-0 z-10 border-b border-black/10 bg-[#f9f9f7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 px-4 py-2 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? 'bg-[#0b0b0b] text-white' : 'text-[#52514e] hover:bg-black/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {error ? (
        <p className="p-6 text-center text-[#d03b3b]">{error}</p>
      ) : !rows ? (
        <p className="p-6 text-center text-[#52514e]">กำลังโหลดข้อมูล...</p>
      ) : tab === 'overview' ? (
        <App rows={rows} />
      ) : tab === 'customers' ? (
        <CustomersPage customers={customers} sales={rows} />
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-5 sm:p-6">
          <Lab2Page rows={labRows} products={products} />
        </div>
      )}
    </div>
  )
}

export default Root
