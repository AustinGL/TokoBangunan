import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ToastProvider } from './Toast'
import { useToast } from './useToast'

function Trigger() {
  const { showToast } = useToast()
  return <button type="button" onClick={() => showToast('Supplier ditambahkan.')}>Trigger</button>
}

describe('Toast', () => {
  it('shows a message in an aria-live region when showToast is called', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><Trigger /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'Trigger' }))

    expect(await screen.findByText('Supplier ditambahkan.')).toBeInTheDocument()
  })

  it('throws a clear error when useToast is called outside a ToastProvider', () => {
    // Swallow the expected console.error React logs for this one render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })

  // Real timers, not vi.useFakeTimers(): React's Scheduler package drives its
  // own task loop off the global setTimeout, so faking it freezes every
  // act()-wrapped interaction (including userEvent.click) indefinitely,
  // regardless of an `advanceTimers` config - confirmed by isolating a plain
  // button click under fake timers, which hung the same way with no Toast
  // code involved at all. waitFor's own real-timer polling is the reliable
  // way to observe the auto-dismiss.
  it('auto-dismisses after its timeout', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><Trigger /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'Trigger' }))
    expect(screen.getByText('Supplier ditambahkan.')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Supplier ditambahkan.')).toBeNull(), { timeout: 4800 })
  }, 6000)
})
