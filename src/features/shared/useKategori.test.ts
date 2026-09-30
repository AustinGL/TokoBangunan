import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { useKategori } from './useKategori'

const stamp = { updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e' }
beforeEach(async () => { await db.delete(); await db.open() })

describe('useKategori', () => {
  it('is undefined until loaded, then lists master and legacy entries together', async () => {
    await db.kategoriProj.put({ id: 'kat_alat', nama: 'Alat', diarsipkan: false, ...stamp })
    await db.barangProj.put({ id: 'b1', nama: 'x', kategori: 'Semen', diarsipkan: false, ...stamp })
    const { result } = renderHook(() => useKategori())
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current?.map(e => e.nama)).toEqual(['Alat', 'Semen']))
  })
  it('updates live when a kategori is renamed', async () => {
    await db.kategoriProj.put({ id: 'kat_alat', nama: 'Alat', diarsipkan: false, ...stamp })
    const { result } = renderHook(() => useKategori())
    await waitFor(() => expect(result.current).toHaveLength(1))
    await db.kategoriProj.put({ id: 'kat_alat', nama: 'Perkakas', diarsipkan: false, ...stamp })
    await waitFor(() => expect(result.current?.[0].nama).toBe('Perkakas'))
  })
})
