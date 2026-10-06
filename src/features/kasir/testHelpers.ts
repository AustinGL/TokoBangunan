import { fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'

/**
 * SearchScanField distinguishes a scan from human typing by inter-key
 * interval (its own SCAN_MAX_INTERVAL_MS=30ms threshold). userEvent.type's
 * own internal scheduling still costs a handful of milliseconds per
 * keystroke, which is fine on a quiet machine but flakes under the full
 * suite's parallel load, where an occasional keystroke gap creeps past
 * 30ms. fireEvent dispatches synchronously with no scheduling overhead, so
 * firing one keydown per character back-to-back keeps every interval at
 * effectively 0ms regardless of machine load, then a final Enter completes
 * the scan the same way a real HID scanner burst would.
 *
 * The final change event appends the scanned characters to whatever the
 * field already contains (mirroring real typing, where each keystroke adds
 * to the existing value) rather than overwriting it. When the field starts
 * empty this is identical to just setting the scanned value; when the field
 * already holds slow-typed text, this lets the component's own run-start
 * tracking strip that leftover prefix the same way it would for a real scan
 * that follows typed input.
 *
 * The burst's clock is pinned as well: even synchronous, a process the OS pauses for
 * 30ms in the middle of the burst (three suites sharing one machine) would split one
 * scan into two runs. Each key reads a time exactly 1ms after the previous one, starting
 * well after any slow typing that came before, so the burst is a scan on any machine.
 */
export function simulateScan(input: HTMLElement, scannedValue: string) {
  const el = input as HTMLInputElement
  const start = Date.now() + 1000
  let tick = 0
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => start + tick++)
  try {
    act(() => {
      for (const char of scannedValue) {
        fireEvent.keyDown(el, { key: char })
      }
      fireEvent.change(el, { target: { value: el.value + scannedValue } })
      fireEvent.keyDown(el, { key: 'Enter' })
    })
  } finally {
    clock.mockRestore()
  }
}
