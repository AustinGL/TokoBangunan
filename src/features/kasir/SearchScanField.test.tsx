import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { SearchScanField } from './SearchScanField'
import { simulateScan } from './testHelpers'

/**
 * A thin controlled wrapper so tests exercise the field the way a real
 * parent screen would (value/onChange wired to state), rather than a bare
 * value prop that never actually updates as the user types.
 */
function Wrapper({ onScan }: { onScan: (value: string) => void }) {
  const [value, setValue] = useState('')
  return <SearchScanField value={value} onChange={setValue} onScan={onScan} />
}

describe('SearchScanField', () => {
  it('typed input at normal human speed reports the typed value and does not fire onScan', async () => {
    const user = userEvent.setup({ delay: 60 })
    const onScan = vi.fn()
    render(<Wrapper onScan={onScan} />)

    const input = screen.getByLabelText('Cari barang')
    await user.type(input, 'semen')

    expect(input).toHaveValue('semen')
    expect(onScan).not.toHaveBeenCalled()
  }, 10000)

  it('a fast keystroke sequence terminated by Enter fires onScan with the accumulated value, not as typed input', () => {
    const onScan = vi.fn()
    render(<Wrapper onScan={onScan} />)

    const input = screen.getByLabelText('Cari barang')
    // simulateScan dispatches keydown/change events with no real elapsed
    // time between them, well under the component's SCAN_MAX_INTERVAL_MS=30
    // threshold, simulating a barcode scanner's HID keystroke burst without
    // depending on userEvent's real-timer scheduling (which can flake under
    // the full suite's parallel load).
    simulateScan(input, '8991234567890')

    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith('8991234567890')
    // The field clears after a scan (judgment call, see report), so this is
    // not left showing as an ordinary typed search value.
    expect(input).toHaveValue('')
  })

  it('focus returns to the field after a scan is detected', () => {
    const onScan = vi.fn()
    render(<Wrapper onScan={onScan} />)

    const input = screen.getByLabelText('Cari barang') as HTMLInputElement
    simulateScan(input, '8991234567890')

    expect(onScan).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(input)
  })

  it('a scan immediately after slow typed input reports only the scanned value, not the typed text plus the scan', async () => {
    // The owner types a search term (slow, human-speed keystrokes), then
    // scans the next item's barcode without ever pressing Enter or clearing
    // the field in between. The slow keystrokes must not poison the timing
    // window for the scan that follows: a fresh run starts at the point the
    // gap since the last keystroke got too slow to be part of a scan, and
    // only that run's characters are reported. The slow half stays on
    // userEvent.type (real elapsed time is exactly the point there); only
    // the fast scan burst that follows uses the deterministic simulateScan
    // helper.
    const slowUser = userEvent.setup({ delay: 60 })
    const onScan = vi.fn()
    render(<Wrapper onScan={onScan} />)

    const input = screen.getByLabelText('Cari barang')
    await slowUser.type(input, 'semen')
    expect(input).toHaveValue('semen')

    simulateScan(input, '8991234567890')

    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith('8991234567890')
  }, 10000)

  it('a short fast burst below the minimum scan length is not treated as a scan', async () => {
    const user = userEvent.setup()
    const onScan = vi.fn()
    render(<Wrapper onScan={onScan} />)

    const input = screen.getByLabelText('Cari barang')
    // Only two keystrokes: below SCAN_MIN_LENGTH=3, so timing is never
    // evaluated as a scan candidate even though it is fast.
    await user.type(input, '12{Enter}')

    expect(onScan).not.toHaveBeenCalled()
  })

  it('the leading search icon is aria-hidden', () => {
    const { container } = render(<Wrapper onScan={vi.fn()} />)
    const svg = container.querySelector('svg')

    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('is wrapped in a real, visible label, not a placeholder standing in for one', () => {
    render(<Wrapper onScan={vi.fn()} />)

    const input = screen.getByLabelText('Cari barang')
    expect(screen.getByText('Cari barang').tagName).toBe('LABEL')
    expect(input).toHaveAttribute('placeholder')
  })

  it('renders an adjacent Scan button that returns focus to the field without simulating a fake scan', async () => {
    const user = userEvent.setup()
    const onScan = vi.fn()
    render(<Wrapper onScan={onScan} />)

    const input = screen.getByLabelText('Cari barang')
    const scanButton = screen.getByRole('button', { name: 'Scan' })

    input.blur()
    expect(document.activeElement).not.toBe(input)

    await user.click(scanButton)

    expect(document.activeElement).toBe(input)
    expect(onScan).not.toHaveBeenCalled()
  })
})
