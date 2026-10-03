import { CARD_CLASS } from '../theme'

// Small line icons for the KPI cards; decoration only, so aria-hidden.
const ICONS = {
  revenue: <path d="M4 17l5-5 4 3 7-8M15 7h5v5" />,
  bills: <path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4" />,
  avg: <path d="M5 19L19 5M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  members: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M18 14.5a5 5 0 0 1 3 5" />,
}

// Each KPI gets its own pastel tile; the tint labels the card, it is not data.
const TONES = {
  brand: 'bg-brand text-brand-ink',
  mist: 'bg-mist text-mist-ink',
  blush: 'bg-blush text-blush-ink',
  oat: 'bg-oat text-oat-ink',
}

/** One headline number. Shared by the overview tab and the live (Lab 3.2) tab. */
export default function KpiCard({ label, value, icon, tone }) {
  return (
    <div className={`${CARD_CLASS} min-w-0 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 sm:p-5`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[icon]}
          </svg>
        </span>
        <p className="text-xs leading-snug text-muted sm:text-sm">{label}</p>
      </div>
      <p className="mt-3 break-words text-xl font-medium tabular-nums tracking-tight text-ink sm:text-[1.75rem]">
        {value}
      </p>
    </div>
  )
}
