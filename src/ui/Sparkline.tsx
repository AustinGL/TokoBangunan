type Props = {
  values: number[]
  width?: number
  height?: number
  /** CSS colour. Defaults to the brand accent, which clears 3:1 on white and 5.5:1 on the dark focal widget. */
  stroke?: string
}

/**
 * A single smooth-ish line: no axes, no gridlines, no fill. Decorative
 * (aria-hidden): the caller prints the value and period as text beside it
 * (docs/REDESIGN.md section 12).
 */
export function Sparkline({ values, width = 160, height = 48, stroke = 'var(--accent)' }: Props) {
  const pad = 3
  if (values.length === 0) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0

  const points = values.map((v, i) => ({
    x: pad + i * stepX,
    // A flat series draws a centred flat line, not a divide-by-zero.
    y: span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2),
  }))

  const d = points.length === 1
    ? `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.01} ${points[0].y}`
    : points.reduce((path, p, i, all) => {
        if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
        const prev = all[i - 1]
        const cx = ((prev.x + p.x) / 2).toFixed(1)
        return `${path} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      }, '')

  return (
    <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3.5} fill={stroke} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  )
}
