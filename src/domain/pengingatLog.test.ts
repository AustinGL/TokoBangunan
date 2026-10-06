import { describe, it, expect } from 'vitest'
import { pengingatTerakhir } from './pengingatLog'
import { createEvent } from './events'
import { fixedClock } from './clock'

const kirim = (customerId: string, iso: string) => createEvent('ReminderSent', { customerId }, { clock: fixedClock(iso), deviceId: 'hp' })

describe('pengingatTerakhir', () => {
  it('is empty with no reminders', () => {
    expect(pengingatTerakhir([])).toEqual({})
  })

  it('keeps the latest time and the count per customer', () => {
    const r = pengingatTerakhir([
      kirim('c1', '2026-10-01T03:00:00.000Z'),
      kirim('c2', '2026-10-02T03:00:00.000Z'),
      kirim('c1', '2026-10-04T03:00:00.000Z'),
    ])
    expect(r.c1).toEqual({ terakhir: '2026-10-04T03:00:00.000Z', jumlah: 2 })
    expect(r.c2).toEqual({ terakhir: '2026-10-02T03:00:00.000Z', jumlah: 1 })
  })

  it('does not depend on the order the events arrive in', () => {
    const a = kirim('c1', '2026-10-01T03:00:00.000Z')
    const b = kirim('c1', '2026-10-04T03:00:00.000Z')
    expect(pengingatTerakhir([b, a])).toEqual(pengingatTerakhir([a, b]))
  })

  it('ignores other event types', () => {
    const toko = createEvent('TokoDiatur', { nama: 'X' }, { clock: fixedClock('2026-10-01T03:00:00.000Z'), deviceId: 'hp' })
    expect(pengingatTerakhir([toko])).toEqual({})
  })

  it('counts a replayed event once', () => {
    const a = kirim('c1', '2026-10-01T03:00:00.000Z')
    expect(pengingatTerakhir([a, a]).c1.jumlah).toBe(1)
  })
})
