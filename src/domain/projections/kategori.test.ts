import { describe, it, expect } from 'vitest'
import { reduceKategori, projectKategori } from './kategori'
import type { EventEnvelope } from '../events'

const ev = (id: string, recordedAt: string, payload: { id: string; nama: string; diarsipkan: boolean }): EventEnvelope => ({
  id, type: 'KategoriUpserted', payload, occurredAt: recordedAt, recordedAt, deviceId: 'd', serverSeq: null,
})

describe('kategori projection', () => {
  it('ignores other event types', () => {
    const other = { ...ev('e1', '2026-09-30T00:00:00.000Z', { id: 'k', nama: 'A', diarsipkan: false }), type: 'BarangUpserted' as const }
    expect(reduceKategori({}, other)).toEqual({})
  })
  it('stores a kategori with its provenance', () => {
    const s = projectKategori([ev('e1', '2026-09-30T00:00:00.000Z', { id: 'k', nama: 'Alat', diarsipkan: false })])
    expect(s.k).toEqual({ id: 'k', nama: 'Alat', diarsipkan: false, updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e1' })
  })
  it('last write wins by recordedAt', () => {
    const s = projectKategori([
      ev('e2', '2026-09-30T00:00:02.000Z', { id: 'k', nama: 'Baru', diarsipkan: false }),
      ev('e1', '2026-09-30T00:00:01.000Z', { id: 'k', nama: 'Lama', diarsipkan: false }),
    ])
    expect(s.k.nama).toBe('Baru')
  })
  it('breaks an identical recordedAt by event id', () => {
    const t = '2026-09-30T00:00:01.000Z'
    const s = projectKategori([ev('a', t, { id: 'k', nama: 'A', diarsipkan: false }), ev('b', t, { id: 'k', nama: 'B', diarsipkan: false })])
    expect(s.k.nama).toBe('B')
  })
})
