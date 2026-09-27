import { render, screen } from '@testing-library/react'
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

describe('Combobox: keyboard navigation', () => {
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
