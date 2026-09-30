import { describe, it, expect } from 'vitest'
import { createEvent, parseEvent, classifyEvent } from './events'
import { fixedClock } from './clock'
import type { Clock } from './clock'

const clock = fixedClock('2026-09-18T07:30:00.000Z')
const opts = { clock, deviceId: 'laptop-kasir' }

const itemPayload = {
  id: 'item-semen-tiga-roda',
  nama: 'Semen Tiga Roda',
  baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }, { unit: 'ton', factor: 20 }],
  hargaEceran: 52000,
  stokMinimum: 20000,
}

const customerPayload = {
  id: 'cust-budi',
  nama: 'Budi',
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj }
  delete copy[key]
  return copy
}

/** A clock that advances by 1ms on every read, to expose double-read bugs that fixedClock would mask. */
const advancingClock = (startIso: string): Clock => {
  let t = new Date(startIso).getTime()
  return { now: () => new Date(t++) }
}

describe('createEvent', () => {
  it('stamps recordedAt from the clock', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(e.recordedAt).toBe('2026-09-18T07:30:00.000Z')
  })

  it('defaults occurredAt to recordedAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(e.occurredAt).toBe(e.recordedAt)
  })

  it('allows occurredAt to be backdated while recordedAt stays honest', () => {
    const e = createEvent('ItemUpserted', itemPayload, {
      ...opts,
      occurredAt: new Date('2026-09-16T10:00:00.000Z'),
    })
    expect(e.occurredAt).toBe('2026-09-16T10:00:00.000Z')
    expect(e.recordedAt).toBe('2026-09-18T07:30:00.000Z')
  })

  it('starts unsynced', () => {
    expect(createEvent('ItemUpserted', itemPayload, opts).serverSeq).toBeNull()
  })

  it('rejects a payload that fails its schema', () => {
    expect(() =>
      createEvent('ItemUpserted', { ...itemPayload, hargaEceran: 52000.5 }, opts),
    ).toThrow()
  })

  it('produces an occurredAt exactly equal to recordedAt on the default path, even with a clock that advances on every read', () => {
    const e = createEvent('ItemUpserted', itemPayload, {
      clock: advancingClock('2026-09-18T07:30:00.000Z'),
      deviceId: 'laptop-kasir',
    })
    expect(e.occurredAt).toBe(e.recordedAt)
  })

  it('still honours an explicitly supplied occurredAt, distinct from recordedAt, with an advancing clock', () => {
    const e = createEvent('ItemUpserted', itemPayload, {
      clock: advancingClock('2026-09-18T07:30:00.000Z'),
      deviceId: 'laptop-kasir',
      occurredAt: new Date('2026-09-16T10:00:00.000Z'),
    })
    expect(e.occurredAt).toBe('2026-09-16T10:00:00.000Z')
    expect(e.recordedAt).not.toBe(e.occurredAt)
  })
})

describe('parseEvent', () => {
  it('accepts an event that came back from sync', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(parseEvent({ ...e, serverSeq: 42 }).serverSeq).toBe(42)
  })

  it('rejects an unknown event type', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, type: 'NotAThing' })).toThrow()
  })
})

describe('parseEvent envelope validation', () => {
  it('rejects a missing id', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'id'))).toThrow()
  })

  it('rejects an empty-string id', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, id: '' })).toThrow()
  })

  it('rejects a missing deviceId', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'deviceId'))).toThrow()
  })

  it('rejects an empty-string deviceId', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, deviceId: '' })).toThrow()
  })

  it('rejects a serverSeq that is not a number', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, serverSeq: '42' })).toThrow()
  })

  it('rejects a serverSeq that is not an integer', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, serverSeq: 1.5 })).toThrow()
  })

  it('rejects a missing occurredAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'occurredAt'))).toThrow()
  })

  it('rejects a missing recordedAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'recordedAt'))).toThrow()
  })

  it('rejects a malformed occurredAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, occurredAt: 'banana' })).toThrow()
  })

  it('rejects a malformed recordedAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, recordedAt: 'banana' })).toThrow()
  })

  // The schema accepts only a Z suffix, and that strictness is deliberate:
  // reduceItems compares recordedAt as a raw string for last-write-wins, so a
  // log holding a mix of '...Z' and '...+00:00' would tie-break by ASCII at
  // the offset character. Postgres serialises timestamptz with a +00:00
  // offset, which is why the pull adapter normalises before this schema ever
  // sees it (data/sync.ts canonicalTimestamp), rather than the schema being
  // relaxed to let the offset form through.
  it('rejects an offset-form occurredAt, leaving normalisation to the adapter', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, occurredAt: '2026-09-18T09:00:00+00:00' })).toThrow()
  })

  it('rejects an offset-form recordedAt for the same reason', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, recordedAt: '2026-09-18T09:00:00.123456+00:00' })).toThrow()
  })
})

describe('classifyEvent', () => {
  it('reports a fully valid event as valid, with its payload parsed', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, serverSeq: 3 })
    expect(result.status).toBe('valid')
    if (result.status === 'valid') expect(result.event.serverSeq).toBe(3)
  })

  // The forward-compatibility case: a device still on this release receiving
  // an event type a later release introduced. The envelope is sound, so the
  // record is usable later and must be distinguishable from corruption.
  it('separates an unknown event type from an invalid record', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, type: 'NotYetKnownType' })
    expect(result.status).toBe('unknown-type')
    if (result.status === 'unknown-type') {
      expect(result.event.id).toBe(e.id)
      expect(result.reason).toContain('NotYetKnownType')
    }
  })

  it('reports a broken envelope as invalid, naming the offending field', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, recordedAt: 'banana' })
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') expect(result.reason).toContain('recordedAt')
  })

  it('reports a known type with a bad payload as invalid, not as an unknown type', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, payload: { ...itemPayload, hargaEceran: 'gratis' } })
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') expect(result.reason).toContain('ItemUpserted')
  })

  it('reports a non-object as invalid rather than throwing', () => {
    expect(classifyEvent(null).status).toBe('invalid')
    expect(classifyEvent('nope').status).toBe('invalid')
  })
})

describe('parseEvent payload validation', () => {
  it('applies schema defaults to a payload arriving from sync, matching the local createEvent path', () => {
    const local = createEvent('CustomerUpserted', customerPayload, opts)
    const rawFromSync = {
      id: 'evt-from-sync',
      type: 'CustomerUpserted',
      payload: customerPayload,
      occurredAt: local.occurredAt,
      recordedAt: local.recordedAt,
      deviceId: 'phone-kasir',
      serverSeq: 7,
    }
    const synced = parseEvent(rawFromSync)
    expect(synced.payload).toEqual(local.payload)
  })

  it('strips an unknown extra key from a payload arriving from sync', () => {
    const rawFromSync = {
      id: 'evt-strip',
      type: 'SupplierUpserted',
      payload: { id: 'sup-1', nama: 'Toko Jaya', extra: 'should be stripped' },
      occurredAt: '2026-09-18T07:30:00.000Z',
      recordedAt: '2026-09-18T07:30:00.000Z',
      deviceId: 'laptop-kasir',
      serverSeq: 1,
    }
    const parsed = parseEvent(rawFromSync)
    expect(parsed.payload).not.toHaveProperty('extra')
  })
})

describe('BarangUpserted', () => {
  const payload = { id: 'barang-semen', nama: 'Semen Tiga Roda' }

  it('accepts a minimal payload, defaulting diarsipkan to false', () => {
    const e = createEvent('BarangUpserted', payload, opts)
    expect(e.payload).toMatchObject({ id: 'barang-semen', nama: 'Semen Tiga Roda', diarsipkan: false })
  })

  it('accepts kategori and an explicit diarsipkan', () => {
    const e = createEvent('BarangUpserted', { ...payload, kategori: 'Semen', diarsipkan: true }, opts)
    expect(e.payload).toMatchObject({ kategori: 'Semen', diarsipkan: true })
  })

  it('rejects a missing nama', () => {
    expect(() => createEvent('BarangUpserted', { id: 'x' }, opts)).toThrow()
  })
})

describe('KategoriUpserted / BarangUpserted.kategoriId', () => {
  it('accepts a kategori and defaults diarsipkan to false', () => {
    const e = createEvent('KategoriUpserted', { id: 'kat_a', nama: 'Alat' }, opts)
    expect(e.payload).toEqual({ id: 'kat_a', nama: 'Alat', diarsipkan: false })
  })
  it('rejects an empty kategori name', () => {
    expect(() => createEvent('KategoriUpserted', { id: 'k', nama: '' }, opts)).toThrow()
  })
  it('an old BarangUpserted without kategoriId still validates', () => {
    const e = createEvent('BarangUpserted', { id: 'b', nama: 'Semen', kategori: 'Semen' }, opts)
    expect(e.payload).toMatchObject({ kategori: 'Semen' })
  })
  it('a BarangUpserted may carry a kategoriId', () => {
    const e = createEvent('BarangUpserted', { id: 'b', nama: 'Semen', kategoriId: 'kat_semen' }, opts)
    expect(e.payload).toMatchObject({ kategoriId: 'kat_semen' })
  })
})

describe('ItemUpserted extensions (barangId, diarsipkan)', () => {
  it('accepts a payload carrying barangId and diarsipkan', () => {
    const e = createEvent('ItemUpserted', { ...itemPayload, barangId: 'barang-semen', diarsipkan: true }, opts)
    expect(e.payload).toMatchObject({ barangId: 'barang-semen', diarsipkan: true })
  })

  it('still accepts a legacy payload with neither field, defaulting diarsipkan to false', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(e.payload).toMatchObject({ diarsipkan: false })
    expect((e.payload as { barangId?: string }).barangId).toBeUndefined()
  })
})

describe('SupplierUpserted extensions (alamat, kontak, catatan, perluDilengkapi)', () => {
  const payload = { id: 'sup-1', nama: 'CV Maju' }

  it('accepts the new optional fields and an explicit perluDilengkapi', () => {
    const e = createEvent('SupplierUpserted', {
      ...payload, alamat: 'Jl. Merdeka 1', kontak: 'Pak Budi', catatan: 'Langganan lama', perluDilengkapi: true,
    }, opts)
    expect(e.payload).toMatchObject({ alamat: 'Jl. Merdeka 1', kontak: 'Pak Budi', catatan: 'Langganan lama', perluDilengkapi: true })
  })

  it('still accepts a legacy payload with none of the new fields, defaulting perluDilengkapi to false', () => {
    const e = createEvent('SupplierUpserted', payload, opts)
    expect(e.payload).toMatchObject({ perluDilengkapi: false })
  })
})

describe('StockAdjusted extensions (koreksi reason, batchId)', () => {
  const base = { itemId: 'semen', quantity: 10 }

  it('accepts the new koreksi reason', () => {
    const e = createEvent('StockAdjusted', { ...base, reason: 'koreksi' as const, batchId: 'batch-1' }, opts)
    expect(e.payload).toMatchObject({ reason: 'koreksi', batchId: 'batch-1' })
  })

  it('rejects a reason outside the enum', () => {
    expect(() => createEvent('StockAdjusted', { ...base, reason: 'opname' }, opts)).toThrow()
  })

  it('still accepts a legacy payload with the original three reasons and no batchId', () => {
    const e = createEvent('StockAdjusted', { ...base, reason: 'initial' as const }, opts)
    expect((e.payload as { batchId?: string }).batchId).toBeUndefined()
  })
})

describe('SaleRecorded line extensions (batchId, hargaNormal)', () => {
  const lineWithExtras = {
    itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000,
    hargaSatuan: 63000, subtotal: 63000, batchId: 'batch-1', hargaNormal: 65000,
  }
  const saleBase = { metodeBayar: 'tunai' as const, subtotal: 63000, diskon: 0, total: 63000 }

  it('accepts a line carrying batchId and hargaNormal', () => {
    const e = createEvent('SaleRecorded', { ...saleBase, lines: [lineWithExtras] }, opts)
    expect((e.payload as { lines: unknown[] }).lines[0]).toMatchObject({ batchId: 'batch-1', hargaNormal: 65000 })
  })

  it('still accepts a legacy line with neither field (the Phase 2 shape)', () => {
    const legacyLine = { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000 }
    const e = createEvent('SaleRecorded', { ...saleBase, lines: [legacyLine] }, opts)
    const line = (e.payload as { lines: Array<{ batchId?: string; hargaNormal?: number }> }).lines[0]
    expect(line.batchId).toBeUndefined()
    expect(line.hargaNormal).toBeUndefined()
  })
})

describe('StockReceived', () => {
  const payload = {
    supplierId: 'sup-1',
    lines: [{ batchId: 'batch-1', itemId: 'semen', qty: 40000, hargaBeli: 60000, hargaJual: 67000 }],
  }

  it('accepts a minimal single-line payload', () => {
    const e = createEvent('StockReceived', payload, opts)
    expect(e.payload).toMatchObject(payload)
  })

  it('accepts a line with hargaBeli omitted', () => {
    const lineWithoutCost = omit(payload.lines[0], 'hargaBeli')
    const e = createEvent('StockReceived', { ...payload, lines: [lineWithoutCost] }, opts)
    expect((e.payload as { lines: Array<{ hargaBeli?: number }> }).lines[0].hargaBeli).toBeUndefined()
  })

  it('accepts supplierId omitted (opening stock or unknown source)', () => {
    const withoutSupplier = omit(payload, 'supplierId')
    const e = createEvent('StockReceived', withoutSupplier, opts)
    expect((e.payload as { supplierId?: string }).supplierId).toBeUndefined()
  })

  it('rejects an empty lines array', () => {
    expect(() => createEvent('StockReceived', { ...payload, lines: [] }, opts)).toThrow()
  })

  it('rejects a non-positive qty', () => {
    expect(() => createEvent('StockReceived', { ...payload, lines: [{ ...payload.lines[0], qty: 0 }] }, opts)).toThrow()
  })

  it('supports multiple lines in one event, for a future multi-item nota pembelian', () => {
    const secondLine = { batchId: 'batch-2', itemId: 'pasir', qty: 2000, hargaJual: 180000 }
    const e = createEvent('StockReceived', { ...payload, lines: [payload.lines[0], secondLine] }, opts)
    expect((e.payload as { lines: unknown[] }).lines).toHaveLength(2)
  })
})

describe('BatchCorrected', () => {
  const payload = {
    batchId: 'batch-1', supplierId: 'sup-1', hargaBeli: 60000, hargaJual: 67000,
    tanggalBeli: '2026-09-15T00:00:00.000Z',
  }

  it('accepts a full metadata correction', () => {
    const e = createEvent('BatchCorrected', payload, opts)
    expect(e.payload).toMatchObject(payload)
  })

  it('accepts an optional jumlah correction', () => {
    const e = createEvent('BatchCorrected', { ...payload, jumlah: 40000 }, opts)
    expect((e.payload as { jumlah?: number }).jumlah).toBe(40000)
  })

  it('leaves jumlah undefined when omitted (a metadata-only correction)', () => {
    const e = createEvent('BatchCorrected', payload, opts)
    expect((e.payload as { jumlah?: number }).jumlah).toBeUndefined()
  })

  it('rejects a missing hargaJual', () => {
    const withoutHargaJual = omit(payload, 'hargaJual')
    expect(() => createEvent('BatchCorrected', withoutHargaJual, opts)).toThrow()
  })

  it('rejects a malformed tanggalBeli', () => {
    expect(() => createEvent('BatchCorrected', { ...payload, tanggalBeli: 'kemarin' }, opts)).toThrow()
  })
})
