import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { loadKategoriEntries } from './kategoriQueries'
import { kategoriIdForName } from '../domain/kategori'

const stamp = { updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e' }
beforeEach(async () => { await db.delete(); await db.open() })

describe('loadKategoriEntries', () => {
  it('merges master rows with legacy text from barang and from barang-less items', async () => {
    await db.kategoriProj.put({ id: 'kat_alat', nama: 'Alat', diarsipkan: false, ...stamp })
    await db.barangProj.put({ id: 'b1', nama: 'Semen', kategori: 'Semen', diarsipkan: false, ...stamp })
    await db.itemsProj.put({ id: 'i1', nama: 'Cat', baseUnit: '5 kg', units: [{ unit: '5 kg', factor: 1 }], hargaEceran: 1, stokMinimum: 0, kategori: 'Cat', diarsipkan: false, updatedAt: stamp.updatedAt, updatedByEventId: 'e' } as never)
    const list = await loadKategoriEntries()
    expect(list.map(e => [e.nama, e.materialized])).toEqual([['Alat', true], ['Cat', false], ['Semen', false]])
  })
  it('ignores the stale kategori snapshot on an item that has a real barang', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen', diarsipkan: false, ...stamp })
    await db.itemsProj.put({ id: 'i1', nama: 'Semen', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }], hargaEceran: 1, stokMinimum: 0, kategori: 'Lama', barangId: 'b1', diarsipkan: false, updatedAt: stamp.updatedAt, updatedByEventId: 'e' } as never)
    expect(await loadKategoriEntries()).toEqual([])
  })
  it('uses the derived id for legacy text', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'x', kategori: ' semen', diarsipkan: false, ...stamp })
    expect((await loadKategoriEntries())[0].id).toBe(kategoriIdForName('Semen'))
  })
})
