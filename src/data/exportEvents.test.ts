import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { db } from './db'
import { appendEvents, markSynced } from './eventStore'
import { buildBackup, backupFileName, downloadBackup } from './exportEvents'
import { createEvent } from '../domain/events'
import { fixedClock } from '../domain/clock'

const item = (id: string) => ({
  id, nama: `Item ${id}`, baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }], hargaEceran: 52000, stokMinimum: 0,
})
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildBackup', () => {
  it('holds every event, synced or not, in causal order, with its format and when it was made', async () => {
    const a = createEvent('ItemUpserted', item('semen'), at('2026-09-18T07:00:00.000Z'))
    const b = createEvent('ItemUpserted', item('pasir'), at('2026-09-18T07:05:00.000Z'))
    await appendEvents([a, b])
    await markSynced([{ id: a.id, serverSeq: 1 }]) // a is on the server, b is still in the outbox

    const backup = await buildBackup(new Date('2026-10-12T03:00:00.000Z'))

    expect(backup.format).toBe('toko-bangunan-events')
    expect(backup.version).toBe(1)
    expect(backup.exportedAt).toBe('2026-10-12T03:00:00.000Z')
    expect(backup.events.map(e => e.id)).toEqual([a.id, b.id])
    expect(backup.events.find(e => e.id === b.id)?.serverSeq).toBeNull()
  })

  it('keeps records this version could not parse, verbatim', async () => {
    await db.quarantine.put({ key: 'k1', raw: { type: 'FutureThing', id: 'x' }, reason: 'unknown type', quarantinedAt: '2026-10-01T00:00:00.000Z' })

    const backup = await buildBackup()

    expect(backup.quarantine).toEqual([
      { key: 'k1', raw: { type: 'FutureThing', id: 'x' }, reason: 'unknown type', quarantinedAt: '2026-10-01T00:00:00.000Z' },
    ])
  })

  it('is valid for an empty shop', async () => {
    const backup = await buildBackup()

    expect(backup.events).toEqual([])
    expect(backup.quarantine).toEqual([])
  })

  it('survives a JSON round trip unchanged', async () => {
    await appendEvents([createEvent('ItemUpserted', item('semen'), at('2026-09-18T07:00:00.000Z'))])

    const backup = await buildBackup(new Date('2026-10-12T03:00:00.000Z'))

    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup)
  })
})

describe('backupFileName', () => {
  it('is named for the local calendar date, zero padded', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 30))).toBe('toko-cadangan-2026-01-05.json')
  })
})

describe('downloadBackup', () => {
  it('downloads one json file named for the date and returns how many events it holds', async () => {
    await appendEvents([
      createEvent('ItemUpserted', item('semen'), at('2026-09-18T07:00:00.000Z')),
      createEvent('ItemUpserted', item('pasir'), at('2026-09-18T07:05:00.000Z')),
    ])
    let blob: Blob | undefined
    const createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:fake' })
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicks: Array<{ href: string; download: string }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download })
    })

    const count = await downloadBackup(new Date(2026, 9, 12, 10, 0))

    expect(count).toBe(2)
    expect(clicks).toEqual([{ href: 'blob:fake', download: 'toko-cadangan-2026-10-12.json' }])
    expect(blob?.type).toBe('application/json')
    const saved = JSON.parse(await blob!.text())
    expect(saved.events).toHaveLength(2)
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake'))
  })
})
