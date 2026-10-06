import { useEffect, useRef } from 'react'
import { Check, Plus, SearchX } from 'lucide-react'
import { Icon } from './Icon'
import { optionId, type ListboxRow } from './listbox'
import type { PanelPlacement } from './panelPlacement'

type Props = {
  id: string
  rows: ListboxRow[]
  /** Keyboard-highlighted row (exposed to assistive tech via the owner's aria-activedescendant). -1: none. */
  activeIndex: number
  /** The chosen value; this is what aria-selected reports. */
  selectedValue: string | null
  emptyText: string
  placement: PanelPlacement
  /** Typed text to emphasise inside matching option labels. */
  highlight?: string
  /** Width classes; the panel is absolutely positioned inside a `relative` parent. */
  className?: string
  /**
   * True while the panel plays its exit animation. The list is then a ghost:
   * it drops its listbox role and id, is hidden from assistive tech and inert,
   * so the accessibility tree already reflects "closed".
   */
  closing?: boolean
  onPick: (row: ListboxRow) => void
}

function Emphasised({ text, needle }: { text: string; needle: string }) {
  const at = needle === '' ? -1 : text.toLowerCase().indexOf(needle)
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-bold">{text.slice(at, at + needle.length)}</strong>
      {text.slice(at + needle.length)}
    </>
  )
}

export function ListboxPanel({
  id, rows, activeIndex, selectedValue, emptyText, placement, highlight = '', className = 'w-full', closing = false, onPick,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const needle = highlight.trim().toLowerCase()

  // Keep the keyboard-highlighted row visible in a scrolling panel.
  // scrollIntoView does not exist in jsdom, hence the typeof guard.
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]')
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const up = placement.side === 'up'

  return (
    <ul
      ref={listRef}
      id={closing ? undefined : id}
      role={closing ? undefined : 'listbox'}
      aria-hidden={closing || undefined}
      inert={closing}
      // Pressing the panel (or dragging its scrollbar) must not steal focus
      // from the trigger, or the blur-driven close would fire first.
      onMouseDown={e => e.preventDefault()}
      style={{ maxHeight: placement.maxHeight }}
      className={`${closing ? 'listbox-out' : 'listbox-in'} absolute left-0 z-dropdown overflow-y-auto overscroll-contain rounded-inner bg-surface p-1.5 shadow-float ${
        up ? 'listbox-up bottom-full mb-1.5' : 'top-full mt-1.5'
      } ${className}`}
    >
      {rows.length === 0 ? (
        <li role="presentation" className="flex items-center gap-2 px-3 py-3 text-sm text-ink-muted">
          <Icon icon={SearchX} size="inline" className="shrink-0" />
          {emptyText}
        </li>
      ) : (
        rows.map((row, index) => {
          const create = row.kind === 'create'
          const selected = !create && row.value === selectedValue
          const active = index === activeIndex
          const labelId = `${optionId(id, index)}-label`
          const hintId = `${optionId(id, index)}-hint`
          return (
            <li
              key={row.value}
              id={optionId(id, index)}
              role="option"
              aria-selected={selected}
              aria-disabled={row.disabled || undefined}
              // The name is the label alone; the hint is the description.
              aria-labelledby={labelId}
              aria-describedby={row.hint ? hintId : undefined}
              data-active={active}
              // onMouseDown (not onClick): fires before the trigger's blur, so
              // the pick is not lost to the blur-driven close.
              onMouseDown={e => {
                e.preventDefault()
                if (!row.disabled) onPick(row)
              }}
              className={`flex min-h-control items-center gap-2 rounded-tile px-3 py-2 text-sm ${
                row.disabled ? 'cursor-not-allowed text-ink-disabled' : 'cursor-pointer'
              } ${create ? 'font-semibold text-primary-ink' : row.disabled ? '' : 'text-ink'} ${active ? 'bg-fill' : ''}`}
            >
              {create && <Icon icon={Plus} size="inline" className="shrink-0" />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span id={labelId} className={`break-words ${selected ? 'font-semibold' : ''}`}>
                  {create ? row.label : <Emphasised text={row.label} needle={needle} />}
                </span>
                {row.hint && (
                  <span id={hintId} className="text-xs text-ink-muted">{row.hint}</span>
                )}
              </span>
              {selected && <Icon icon={Check} size="inline" className="shrink-0 text-primary-ink" />}
            </li>
          )
        })
      )}
    </ul>
  )
}
