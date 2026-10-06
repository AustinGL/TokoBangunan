import { useLayoutEffect, useRef } from 'react'

export type SegmentOption = { value: string; label: string }

type Props = {
  options: SegmentOption[]
  /** The selected segment, or null when none is (the thumb then hides). */
  value: string | null
  onChange: (value: string) => void
  'aria-label': string
}

/**
 * A segmented control: a gray track with a white thumb that slides to the
 * chosen segment on a spring. Each segment is a real button with
 * aria-pressed, so keyboard and screen-reader behaviour is the same as the
 * toggle buttons it replaces. The thumb is decoration only, and is moved by
 * writing to its style directly: it follows measured layout, not React state.
 */
export function SegmentedControl({ options, value, onChange, 'aria-label': ariaLabel }: Props) {
  const nodes = useRef(new Map<string, HTMLButtonElement>())
  const thumb = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = thumb.current
    if (!el) return
    const place = () => {
      const node = value === null ? undefined : nodes.current.get(value)
      el.style.width = node ? `${node.offsetWidth}px` : '0px'
      el.style.transform = `translateX(${node ? node.offsetLeft : 0}px)`
      el.style.opacity = node ? '1' : '0'
    }
    place()
    // Turn the slide on only after the first placement, so the thumb never
    // glides in from the left edge on mount.
    const frame = requestAnimationFrame(() => el.classList.add('transition-[transform,width,opacity]', 'duration-panel', 'ease-spring'))
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame)
    const observer = new ResizeObserver(place)
    nodes.current.forEach(node => observer.observe(node))
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [value, options])

  return (
    <div role="group" aria-label={ariaLabel} className="relative inline-flex h-control items-stretch rounded-pill bg-fill">
      <span
        ref={thumb}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0.5 left-0 rounded-pill bg-surface opacity-0 shadow-float"
      />
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={node => { if (node) nodes.current.set(option.value, node); else nodes.current.delete(option.value) }}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`relative z-10 h-control rounded-pill px-4 text-sm transition-colors duration-quick focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${
              selected ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
