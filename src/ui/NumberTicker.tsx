import { useState, type ReactNode } from 'react'

type Props = {
  /** The raw number; a change of value is what triggers the roll-in. */
  value: number
  /** The formatted text to show. Stays one plain text node so it reads and tests as ordinary text. */
  children: ReactNode
  className?: string
}

/**
 * A figure that rises into place whenever its value changes (a cart total
 * after adding a line, today's sales after a sale). The first render does
 * not animate, so a page does not twitch on load: `changes` stays 0 until the
 * value first differs. Keyed on that count so the entry animation replays;
 * the text itself is untouched.
 */
export function NumberTicker({ value, children, className = '' }: Props) {
  const [seen, setSeen] = useState(value)
  const [changes, setChanges] = useState(0)

  // Adjusting state during render (the documented derived-state pattern).
  if (value !== seen) {
    setSeen(value)
    setChanges(count => count + 1)
  }

  return (
    <span key={changes} className={`inline-block tabular-nums ${changes > 0 ? 'digit-in' : ''} ${className}`}>
      {children}
    </span>
  )
}
