import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Icon as AppIcon } from './Icon'

const formatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

/**
 * A signed percent change. Never colour alone: the sign and an arrow icon
 * carry the meaning. Uses success/danger, never the brand accent, so growth
 * is not confused with the brand highlight (docs/REDESIGN.md section 3.3).
 * A null delta (no previous figure to compare to) renders nothing rather
 * than a made-up number.
 */
export function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-neutral'
  const Glyph = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  const sign = value > 0 ? '+ ' : value < 0 ? '− ' : ''
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill bg-fill-tertiary px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <AppIcon icon={Glyph} size="micro" />
      {sign}{formatter.format(Math.abs(value))}%
    </span>
  )
}
