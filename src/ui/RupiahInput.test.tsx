import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RupiahInput } from './RupiahInput'

// A real caller (Tambah stok's own harga field) holds `value` in state and
// feeds it back to `onChange` synchronously on every keystroke - unlike a
// bare vi.fn() double, which would misrepresent how a controlled component
// like this is actually meant to be used. This harness matches that real
// round trip.
function Harness({ initial = null as number | null }: { initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial)
  return <RupiahInput id="harga" label="Harga jual" value={value} onChange={setValue} />
}

describe('RupiahInput', () => {
  it('displays live id-ID thousand separators while typing, and emits a plain integer', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Harga jual'), '65000')

    expect(screen.getByLabelText('Harga jual')).toHaveValue('65.000')
  })

  it('displays "0", not blank, when value is 0', () => {
    render(<Harness initial={0} />)
    expect(screen.getByLabelText('Harga jual')).toHaveValue('0')
  })

  it('emits null when the field is cleared', async () => {
    const user = userEvent.setup()
    render(<Harness initial={65000} />)

    await user.clear(screen.getByLabelText('Harga jual'))

    expect(screen.getByLabelText('Harga jual')).toHaveValue('')
  })

  it('ignores non-digit characters typed into the field', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Harga jual'), '6a5b0c0d0')

    expect(screen.getByLabelText('Harga jual')).toHaveValue('65.000')
  })

  it('calls onChange with a plain integer, never a formatted string', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<RupiahInput id="harga" label="Harga jual" value={null} onChange={onChange} />)

    await user.type(screen.getByLabelText('Harga jual'), '5')

    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('reverts the display to the current value when the caller rejects an edit (keeps value unchanged)', async () => {
    // A caller that validates before accepting (e.g. a max-price cap) may
    // call onChange but choose not to update its own state, leaving `value`
    // unchanged. The field is fully controlled by `value` alone: it must
    // show that unchanged value's formatted form, not linger on what the
    // user just typed and had rejected.
    const user = userEvent.setup()
    render(<RupiahInput id="harga" label="Harga jual" value={1000} onChange={() => {}} />)

    await user.type(screen.getByLabelText('Harga jual'), '5')

    expect(screen.getByLabelText('Harga jual')).toHaveValue('1.000')
  })
})
