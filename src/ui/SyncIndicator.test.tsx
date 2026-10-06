import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { SyncIndicator } from './SyncIndicator'

describe('SyncIndicator', () => {
  it('shows the synced state', () => {
    render(<SyncIndicator status="tersinkron" pendingCount={0} />)
    expect(screen.getByText('Tersinkron')).toBeInTheDocument()
  })

  it('shows the saving state', () => {
    render(<SyncIndicator status="menyimpan" pendingCount={2} />)
    expect(screen.getByText('Menyimpan')).toBeInTheDocument()
  })

  it('shows the pending count when not synced', () => {
    render(<SyncIndicator status="belum-tersinkron" pendingCount={3} />)
    expect(screen.getByText('Belum tersinkron (3)')).toBeInTheDocument()
  })

  it('says local-only, not failed, when no server is configured', () => {
    render(<SyncIndicator status="lokal" pendingCount={4} />)
    expect(screen.getByText('Hanya di perangkat ini')).toBeInTheDocument()
    expect(screen.queryByText(/belum tersinkron/i)).toBeNull()
  })

  it('says plainly that nothing is backed up when the owner is not signed in', () => {
    render(<SyncIndicator status="belum-masuk" pendingCount={7} />)
    expect(screen.getByText('Belum masuk · 7 belum tercadangkan')).toBeInTheDocument()
  })

  it('announces changes politely', () => {
    render(<SyncIndicator status="tersinkron" pendingCount={0} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('keeps the same live-region node across a status change, so assistive tech can track it', () => {
    // jsdom has no accessibility tree and cannot simulate an actual screen-reader
    // announcement, so nothing here proves "this gets announced out loud". What
    // IS testable, and what actually governs whether AT announces anything at
    // all, is whether the live region survives an update as the SAME DOM node
    // rather than being unmounted and a fresh one mounted in its place. Screen
    // readers track live regions by node identity; if the node is replaced, the
    // replacement is ordinarily treated as unrelated new content and nothing is
    // announced.
    const { rerender } = render(<SyncIndicator status="tersinkron" pendingCount={0} />)
    const firstNode = screen.getByRole('status')
    const firstText = firstNode.textContent

    rerender(<SyncIndicator status="menyimpan" pendingCount={2} />)
    const secondNode = screen.getByRole('status')

    expect(secondNode).toBe(firstNode)
    expect(secondNode.textContent).not.toBe(firstText)
  })

  it('is not interactive: no focusable or interactive element, and a click has no effect', async () => {
    const user = userEvent.setup()
    const { container } = render(<SyncIndicator status="belum-tersinkron" pendingCount={1} />)

    // Never an accessible control, under any role.
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()

    // Never in the tab order and never a native interactive tag, anywhere in
    // the tree, including the root. This fails the moment a tabIndex (any
    // value, including -1) or an interactive element is introduced.
    expect(
      container.querySelector('button, a, input, select, textarea, [tabindex]'),
    ).toBeNull()

    const before = container.innerHTML
    await user.click(container.firstElementChild as HTMLElement)
    // A status display must not react to being clicked: no thrown error, no
    // state change, no side-effecting DOM mutation from a click handler.
    expect(container.innerHTML).toBe(before)
  })

  it('hides the decorative icon from assistive technology', () => {
    const { container } = render(<SyncIndicator status="tersinkron" pendingCount={0} />)
    const svg = container.querySelector('svg')

    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('gives each status a visually distinct icon, so shape carries the meaning and not just colour', () => {
    // lucide-react icons vary in internal shape - some use <path>, some use
    // <circle>/<line> only (verified by rendering each: AlertCircle has no
    // <path> element at all) - so comparing a single path's `d` attribute is
    // not a reliable cross-icon signal. Each lucide icon's root <svg> does
    // carry a unique `class` naming the icon itself, which is what actually
    // proves three different icons render, not an accident of one icon
    // happening to have no <path>.
    const classes = (['tersinkron', 'menyimpan', 'belum-tersinkron', 'lokal', 'belum-masuk'] as const).map((status) => {
      const { container, unmount } = render(<SyncIndicator status={status} pendingCount={0} />)
      const className = container.querySelector('svg')?.getAttribute('class') ?? ''
      unmount()
      return className
    })

    expect(new Set(classes).size).toBe(5)
  })
})
