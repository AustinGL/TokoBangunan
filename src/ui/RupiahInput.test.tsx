import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RupiahInput } from './RupiahInput'

describe('RupiahInput', () => {
  it('displays live id-ID thousand separators while typing, and emits a plain integer', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RupiahInput id="harga" label="Harga jual" value={null} onChange={onChange} />)

    await user.type(screen.getByLabelText('Harga jual'), '65000')

    expect(screen.getByLabelText('Harga jual')).toHaveValue('65.000')
    expect(onChange).toHaveBeenLastCalledWith(65000)
  })

  it('displays "0", not blank, when value is 0', () => {
    render(<RupiahInput id="harga" label="Harga jual" value={0} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Harga jual')).toHaveValue('0')
  })

  it('emits null when the field is cleared', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RupiahInput id="harga" label="Harga jual" value={65000} onChange={onChange} />)

    await user.clear(screen.getByLabelText('Harga jual'))

    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('ignores non-digit characters typed into the field', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RupiahInput id="harga" label="Harga jual" value={null} onChange={onChange} />)

    await user.type(screen.getByLabelText('Harga jual'), '6a5b0c0d0')

    expect(onChange).toHaveBeenLastCalledWith(65000)
  })
})
