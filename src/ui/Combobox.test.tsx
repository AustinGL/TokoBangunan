import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Combobox } from './Combobox'

const options = [{ value: 'b1', label: 'Semen Tiga Roda' }, { value: 'b2', label: 'Semen Gudang Garam' }]

describe('Combobox: selection', () => {
  it('opens the listbox on focus and selects an option by click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Semen Gudang Garam' }))

    expect(onChange).toHaveBeenCalledWith('b2')
  })

  it('filters options by a case-insensitive substring of the typed text', async () => {
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'gudang')

    expect(screen.getByRole('option', { name: 'Semen Gudang Garam' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Semen Tiga Roda' })).toBeNull()
  })

  it('syncs the displayed text to the selected option\'s label when value is set externally', () => {
    render(<Combobox id="test" label="Nama barang" options={options} value="b1" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('Semen Tiga Roda')
  })

  it('shows "Tidak ada hasil" for a query matching nothing, when no onCreate is given', async () => {
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'xyz-tidak-ada')

    expect(screen.getByText(/tidak ada hasil/i)).toBeInTheDocument()
  })
})

describe('Combobox: control size', () => {
  it('shares the control height', () => {
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveClass('h-control')
  })
})

describe('Combobox: display sync', () => {
  it('displays the selected option\'s label once options arrive after mount, without needing value itself to change', () => {
    const { rerender } = render(<Combobox id="test" label="Nama barang" options={[]} value="b1" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue('')

    rerender(<Combobox id="test" label="Nama barang" options={options} value="b1" onChange={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveValue('Semen Tiga Roda')
  })
})

describe('Combobox: keyboard navigation', () => {
  it('does not preselect an option on focus, so a bare Enter does not select anything', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{Enter}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('prevents form submission on Enter even when the open listbox has no matching row', async () => {
    const onFormSubmit = vi.fn(e => e.preventDefault())
    const user = userEvent.setup()
    render(
      <form onSubmit={onFormSubmit}>
        <Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />
      </form>,
    )

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.type(input, 'xyz-tidak-ada')
    await user.keyboard('{Enter}')

    expect(onFormSubmit).not.toHaveBeenCalled()
  })

  it('prevents the Escape keydown from bubbling while the listbox is open, so a host dialog does not also close', async () => {
    const onKeyDownCapture = vi.fn()
    const user = userEvent.setup()
    render(
      <div onKeyDown={onKeyDownCapture}>
        <Combobox id="test" label="Nama barang" options={options} value="b1" onChange={vi.fn()} />
      </div>,
    )

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'gudang')
    onKeyDownCapture.mockClear()
    await user.keyboard('{Escape}')

    // Typing itself legitimately bubbles keydowns to the parent; only the
    // Escape keydown specifically must not, while the listbox is open.
    expect(onKeyDownCapture).not.toHaveBeenCalled()
  })

  it('moves the active option with ArrowDown/ArrowUp and selects it with Enter, without submitting a surrounding form', async () => {
    const onChange = vi.fn()
    const onFormSubmit = vi.fn(e => e.preventDefault())
    const user = userEvent.setup()
    render(
      <form onSubmit={onFormSubmit}>
        <Combobox id="test" label="Nama barang" options={options} value={null} onChange={onChange} />
      </form>,
    )

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('b2')
    expect(onFormSubmit).not.toHaveBeenCalled()
  })

  it('clamps at the last option on repeated ArrowDown, rather than wrapping or throwing', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={onChange} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('b2') // still the last option, not undefined
  })

  it('closes the listbox on Escape without changing the selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value="b1" onChange={onChange} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'gudang')
    await user.keyboard('{Escape}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('combobox')).toHaveValue('Semen Tiga Roda')
  })

  it('does not let a stale blur timer (from an earlier blur, before refocusing) clobber freshly-typed text', () => {
    // fireEvent + fake timers, not userEvent: userEvent's own click/type
    // simulation depends on React's Scheduler flushing via real setTimeout,
    // which fake timers deadlock (see Toast.tsx's own ledgered ruling for
    // the same finding). fireEvent's synchronous dispatch has no such
    // dependency, so it works under fake timers here.
    //
    // try/finally: a failing assertion must not leave fake timers active
    // for every later test in this file - real ones, using userEvent, would
    // then hit that exact Scheduler deadlock instead of failing cleanly.
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      render(<Combobox id="test" label="Nama barang" options={options} value="b1" onChange={onChange} />)
      const input = screen.getByRole('combobox')

      fireEvent.focus(input) // opens; nothing schedules yet
      fireEvent.blur(input) // schedules the 150ms close/reset timer
      fireEvent.focus(input) // refocuses well before that timer fires
      fireEvent.change(input, { target: { value: 'gudang' } }) // types

      // The stale timer from the FIRST blur is still pending and fires now,
      // even though the field has since been refocused and typed into.
      act(() => { vi.advanceTimersByTime(150) })

      expect(input).toHaveValue('gudang')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Combobox: create row', () => {
  it('offers a create row for text matching no option, and calls onCreate rather than onChange when selected', async () => {
    const onChange = vi.fn()
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<Combobox id="test" label="Supplier" options={options} value={null} onChange={onChange} onCreate={onCreate} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'UD Baru')

    expect(screen.getByText(/tambah.*UD Baru/i)).toBeInTheDocument()
    await user.click(screen.getByText(/tambah.*UD Baru/i))

    expect(onCreate).toHaveBeenCalledWith('UD Baru')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not offer a create row when the typed text exactly matches an existing option', async () => {
    const user = userEvent.setup()
    render(<Combobox id="test" label="Supplier" options={options} value={null} onChange={vi.fn()} onCreate={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'Semen Tiga Roda')

    expect(screen.queryByText(/tambah/i)).toBeNull()
  })
})

describe('Combobox: panel', () => {
  it('reports the chosen option as aria-selected and the highlighted one through aria-activedescendant', async () => {
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value="b1" onChange={vi.fn()} />)

    const input = screen.getByRole('combobox')
    await user.click(input)
    expect(screen.getByRole('option', { name: 'Semen Tiga Roda' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Semen Gudang Garam' })).toHaveAttribute('aria-selected', 'false')

    await user.keyboard('{ArrowDown}')
    const active = screen.getByRole('option', { name: 'Semen Tiga Roda' })
    expect(input).toHaveAttribute('aria-activedescendant', active.id)
  })

  it('shows an option\'s hint as its description without changing its name', async () => {
    const user = userEvent.setup()
    render(
      <Combobox
        id="test" label="Ukuran" value={null} onChange={vi.fn()}
        options={[{ value: 'u1', label: '50 kg', hint: 'Stok 40 · Rp 65.000' }]}
      />,
    )

    await user.click(screen.getByRole('combobox'))

    expect(screen.getByRole('option', { name: '50 kg' })).toHaveAccessibleDescription('Stok 40 · Rp 65.000')
  })

  it('emphasises the typed text inside matching labels', async () => {
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'gudang')

    expect(screen.getByText('Gudang', { selector: 'strong' })).toBeInTheDocument()
  })

  it('toggles the list from the chevron without moving focus off the input', async () => {
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />)
    const input = screen.getByRole('combobox')
    const chevron = input.parentElement!.querySelector('button')!

    fireEvent.mouseDown(chevron)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(input).toHaveFocus()

    fireEvent.mouseDown(chevron)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('has no chevron and does not open when disabled', async () => {
    const user = userEvent.setup()
    render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} disabled />)

    const input = screen.getByRole('combobox')
    expect(input.parentElement!.querySelector('button')).toBeNull()
    await user.click(input)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens upward when the field sits at the bottom of the viewport', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 700, bottom: 752, left: 0, right: 200, width: 200, height: 52, x: 0, y: 700, toJSON: () => ({}),
    })
    try {
      const user = userEvent.setup()
      render(<Combobox id="test" label="Nama barang" options={options} value={null} onChange={vi.fn()} />)
      await user.click(screen.getByRole('combobox'))
      expect(screen.getByRole('listbox')).toHaveClass('bottom-full')
    } finally {
      spy.mockRestore()
    }
  })
})
