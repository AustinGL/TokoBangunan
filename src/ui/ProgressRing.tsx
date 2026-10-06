import type { ReactNode } from 'react'

type Props = {
  /** 0 to 1. */
  value: number
  size?: number
  stroke?: number
  /** Real text shown in the middle (the value itself); the arc is never the only carrier of the number. */
  children?: ReactNode
}

/**
 * A thick round-capped arc over a track. Decorative: the figure it shows
 * must also be printed as text by the caller (docs/REDESIGN.md section 12).
 * Uses --data-fill over --data-track, the measured 3:1 pair.
 */
export function ProgressRing({ value, size = 96, stroke = 10, children }: Props) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--data-track)" strokeWidth={stroke} />
        <circle
          data-testid="ring-arc"
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--data-fill)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset var(--dur-panel) var(--ease-ios)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
