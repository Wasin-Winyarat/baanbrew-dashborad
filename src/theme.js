// Chart colors for the orange theme (mirrors the tokens in index.css).
// One data hue — a warm orange deep enough to keep ≥3:1 contrast on the card
// background — so every revenue/member measure reads as the same thing.
export const SERIES_COLOR = '#e8742c'
export const GRID_COLOR = '#f3e7da'
export const AXIS_COLOR = '#ad9887'
export const LABEL_COLOR = '#8a7566'
export const INK_COLOR = '#3b2c22'
export const CARD_COLOR = '#fffcf8'
export const CURSOR_FILL = 'rgba(232,116,44,0.08)'

export const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 12,
  border: '1px solid #f0e1d1',
  background: CARD_COLOR,
  boxShadow: '0 8px 24px -10px rgba(185,83,28,0.28)',
}

export const CARD_CLASS =
  'rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(59,44,34,0.04),0_8px_24px_-18px_rgba(185,83,28,0.25)]'
