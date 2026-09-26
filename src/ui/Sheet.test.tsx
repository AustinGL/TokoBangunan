import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Sheet } from './Sheet'

describe('Sheet', () => {
  it('is not present in the accessible tree while closed', () => {
    render(<Sheet open={false} onClose={vi.fn()} title="Contoh">Isi</Sheet>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a modal dialog carrying its title as the accessible name', () => {
    render(<Sheet open title="Menu lainnya" onClose={vi.fn()}>Isi sheet</Sheet>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Menu lainnya')
    expect(screen.getByText('Isi sheet')).toBeInTheDocument()
  })

  it('calls onClose when the header close button is activated', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Sheet open title="Menu lainnya" onClose={onClose}>Isi</Sheet>)

    await user.click(screen.getByRole('button', { name: 'Tutup' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the dialog fires its native close event (Escape, in a real browser)', () => {
    // jsdom's dialog polyfill (test-setup.ts) does not simulate the
    // browser's native Escape-to-close chain, so this fires the underlying
    // `close` event directly - the same event a real browser fires after
    // Escape, and the same event the polyfill's own close() dispatches.
    // What this proves is that Sheet wires that event to onClose; jsdom
    // itself firing Escape is out of scope here.
    const onClose = vi.fn()
    render(<Sheet open title="Menu lainnya" onClose={onClose}>Isi</Sheet>)

    screen.getByRole('dialog').dispatchEvent(new Event('close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the underlying dialog when the parent flips open to false', () => {
    const { rerender } = render(<Sheet open title="Menu lainnya" onClose={vi.fn()}>Isi</Sheet>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    rerender(<Sheet open={false} title="Menu lainnya" onClose={vi.fn()}>Isi</Sheet>)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the center variant as a real dialog too', () => {
    render(<Sheet open variant="center" title="Konfirmasi" onClose={vi.fn()}>Yakin?</Sheet>)
    expect(screen.getByRole('dialog', { name: 'Konfirmasi' })).toBeInTheDocument()
  })
})
