import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type FormEvent } from 'react'
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

  it('draws its close button as a control-sized ghost icon button', () => {
    render(<Sheet open title="Menu lainnya" onClose={vi.fn()}>Isi</Sheet>)
    expect(screen.getByRole('button', { name: 'Tutup' })).toHaveClass('h-control', 'w-control')
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

  // Tailwind utilities of equal specificity (every class here is a plain
  // single-class selector) cascade by their position in the COMPILED
  // stylesheet, not by the order classes appear in a className string -
  // verified directly against this project's real build: .max-h-none
  // compiles AFTER .max-h-[85vh], so an element carrying both classes
  // unprefixed always resolves to max-height: none, regardless of which
  // order they are written in JSX. Every variant sets its own max-height
  // explicitly (max-h-[85vh] unprefixed, and md:max-h-none for the side
  // variant's desktop full-height case, which is gated by a media query and
  // so never competes with the unprefixed rule at the same breakpoint), so
  // the dialog element itself must never also carry an unprefixed
  // max-h-none: that would silently defeat every variant's cap at every
  // width a breakpoint override does not explicitly reclaim.
  it.each(['side', 'center'] as const)('the %s variant never combines an unprefixed max-h-none with its own height cap', (variant) => {
    render(<Sheet open variant={variant} title="Cek" onClose={vi.fn()}>Isi</Sheet>)
    const className = screen.getByRole('dialog').className

    const hasUnprefixedNone = /(^|\s)max-h-none(\s|$)/.test(className)
    const hasUnprefixedCap = /(^|\s)max-h-\[[^\]]+\](\s|$)/.test(className)

    expect(
      hasUnprefixedNone && hasUnprefixedCap,
      `dialog className carries both an unprefixed max-h-none and a max-h-[...] cap, so the cap never applies: "${className}"`,
    ).toBe(false)
  })

  describe('focus (WCAG 2.4.3)', () => {
    it('puts focus on the first field when a form opens, not on the Tutup button', () => {
      render(
        <Sheet open title="Barang baru" onClose={vi.fn()}>
          <form><label htmlFor="n">Nama</label><input id="n" /><button type="submit">Simpan</button></form>
        </Sheet>,
      )
      expect(screen.getByLabelText('Nama')).toHaveFocus()
    })

    it('moves focus to the invalid field after a submit that failed with a single error', async () => {
      const user = userEvent.setup()
      function Form() {
        const [error, setError] = useState(false)
        return (
          <Sheet open title="Barang baru" onClose={vi.fn()}>
            <form noValidate onSubmit={e => { e.preventDefault(); setError(true) }}>
              <label htmlFor="n">Nama</label>
              <input id="n" aria-invalid={error ? true : undefined} />
              <label htmlFor="k">Kategori</label>
              <input id="k" />
              <button type="submit">Simpan</button>
            </form>
          </Sheet>
        )
      }
      render(<Form />)
      await user.click(screen.getByLabelText('Kategori'))
      await user.click(screen.getByRole('button', { name: 'Simpan' }))

      await waitFor(() => expect(screen.getByLabelText('Nama')).toHaveFocus())
    })
  })
})

describe('Sheet opened from inside a caller form', () => {
  // A picker's inline "Tambah ..." opens a Sheet from inside a <form> (Tambah
  // stok). If the sheet's own <form> were nested in that one at the DOM level,
  // Chrome would never bubble its submit event up to React's root listener:
  // the inner onSubmit would not run and the browser would navigate away
  // ("/stok?"), saving nothing. jsdom cannot show that, so these pin the
  // structure and the event boundary that prevent it.
  it('renders its dialog outside the form that renders it', () => {
    render(<form><Sheet open title="Isi" onClose={vi.fn()}>x</Sheet></form>)

    expect(screen.getByRole('dialog').closest('form')).toBeNull()
  })

  it('keeps a submit from inside the sheet from reaching the caller form onSubmit', async () => {
    const outer = vi.fn((e: FormEvent) => e.preventDefault())
    const inner = vi.fn((e: FormEvent) => e.preventDefault())
    const user = userEvent.setup()
    render(
      <form onSubmit={outer}>
        <Sheet open title="Isi" onClose={vi.fn()}>
          <form onSubmit={inner}><button type="submit">Simpan</button></form>
        </Sheet>
      </form>,
    )

    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })
})
