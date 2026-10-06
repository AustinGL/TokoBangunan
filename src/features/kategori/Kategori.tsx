import { useMemo, useState } from 'react'
import { useKategori } from '../shared/useKategori'
import { useKatalog } from '../shared/useKatalog'
import { KategoriSheet, type KategoriSheetValues } from './KategoriSheet'
import { recordKategori, updateKategori } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import type { KategoriEntry } from '../../domain/kategori'
import { PageHeader } from '../../ui/PageHeader'
import { Button } from '../../ui/Button'
import { IconTile } from '../../ui/IconTile'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { StatusPill } from '../../ui/StatusPill'
import { CategoryIcon } from '../../ui/BrandIcons'

const ctx = () => ({ clock: systemClock, deviceId: getDeviceId() })

export function Kategori() {
  const entries = useKategori()
  const katalog = useKatalog()
  const [sheet, setSheet] = useState<{ mode: 'create' } | { mode: 'edit'; entry: KategoriEntry } | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of katalog ?? []) {
      if (row.kategoriId && !row.diarsipkan) map.set(row.kategoriId, (map.get(row.kategoriId) ?? 0) + 1)
    }
    return map
  }, [katalog])

  const handleSubmit = async (values: KategoriSheetValues) => {
    if (sheet?.mode === 'edit') {
      await updateKategori({ id: sheet.entry.id, nama: values.nama, diarsipkan: values.diarsipkan }, ctx())
    } else {
      await recordKategori({ nama: values.nama }, ctx())
    }
    setSheet(null)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <PageHeader
        title="Kategori"
        subtitle={entries !== undefined ? `${entries.filter(entry => !entry.diarsipkan).length} kategori` : undefined}
        action={<Button variant="primary" onClick={() => setSheet({ mode: 'create' })}>+ Kategori baru</Button>}
      />

      {entries === undefined ? (
        <ListSkeleton label="Memuat daftar kategori..." />
      ) : entries.length === 0 ? (
        <EmptyState icon={CategoryIcon}>Belum ada kategori. Mulai tambahkan kategori.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {entries.map(entry => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setSheet({ mode: 'edit', entry })}
                className="press flex min-h-control w-full items-center gap-3 rounded-card bg-surface p-4 text-left shadow-card transition-shadow duration-quick hover:shadow-float focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <IconTile icon={CategoryIcon} tone="primary" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold text-ink">{entry.nama}</span>
                  <span className="text-sm text-ink-muted">{counts.get(entry.id) ?? 0} barang</span>
                </span>
                {entry.diarsipkan && <StatusPill tone="neutral">Diarsipkan</StatusPill>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <KategoriSheet
          open
          onClose={() => setSheet(null)}
          onSubmit={handleSubmit}
          initialValues={sheet.mode === 'edit' ? { nama: sheet.entry.nama, diarsipkan: sheet.entry.diarsipkan } : undefined}
        />
      )}
    </main>
  )
}
