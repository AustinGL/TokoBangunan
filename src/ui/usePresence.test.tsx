import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import { usePresence } from './usePresence'

function Probe({ open, exitMs = 30 }: { open: boolean; exitMs?: number }) {
  const { mounted, closing } = usePresence(open, exitMs)
  return mounted ? <span data-testid="probe" data-closing={closing}>here</span> : null
}

const original = Element.prototype.animate

afterEach(() => {
  if (original) Element.prototype.animate = original
  else delete (Element.prototype as { animate?: unknown }).animate
})

describe('usePresence', () => {
  it('mounts while open and is not closing', () => {
    render(<Probe open />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-closing', 'false')
  })

  it('unmounts at once where the browser cannot animate (jsdom), so nothing lingers', () => {
    const { rerender } = render(<Probe open />)
    rerender(<Probe open={false} />)
    expect(screen.queryByTestId('probe')).toBeNull()
  })

  it('keeps a closing ghost for the exit time where animation is supported, then removes it', async () => {
    Element.prototype.animate = (() => ({})) as unknown as typeof Element.prototype.animate
    const { rerender } = render(<Probe open />)
    rerender(<Probe open={false} />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-closing', 'true')
    await waitFor(() => expect(screen.queryByTestId('probe')).toBeNull())
  })

  it('returns to open (not closing) if reopened during the exit', () => {
    Element.prototype.animate = (() => ({})) as unknown as typeof Element.prototype.animate
    const { rerender } = render(<Probe open exitMs={500} />)
    rerender(<Probe open={false} exitMs={500} />)
    rerender(<Probe open exitMs={500} />)
    expect(screen.getByTestId('probe')).toHaveAttribute('data-closing', 'false')
  })
})
