import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import {
  NAMA_HARI, akhirPekan, awalBulan, awalPekan, batasi, bulanDari, geserBulan, geserBulanKey, geserHari,
  kisiBulan, namaBulan, namaLengkap, type Bulan,
} from '../domain/kalender'
import { IconButton } from './IconButton'

export type PilihanKalender = { from: string | null; to: string | null }

type Props = {
  /** The day the calendar opens on, and where keyboard focus starts. */
  awal: string
  jumlahBulan: 1 | 2
  hariIni: string
  min?: string
  max?: string
  /** A chosen day (from === to) or range. `from` alone is a range start still waiting for its end. */
  pilihan: PilihanKalender
  /** While only the start is chosen: the day the range would end on, to preview the band. */
  pratinjau?: string | null
  onPilih: (key: string) => void
  /** The day under the pointer or keyboard focus; null when the pointer leaves the calendar. */
  onFokusHari?: (key: string | null) => void
}

const indeks = (b: Bulan): number => b.tahun * 12 + b.bulan
const dariIndeks = (n: number): Bulan => ({ tahun: Math.floor(n / 12), bulan: ((n % 12) + 12) % 12 })

const FOKUS = 'button[data-hari][tabindex="0"]'

/**
 * One or two month grids as an ARIA date grid. The calendar owns which month is
 * showing and which day is the roving-focus day (the one Tab lands on); the
 * parent owns what is chosen. Navigation never leaves the months between `min`
 * and `max`, and with two months the last one shown never passes `max`.
 */
export function Calendar(props: Props) {
  // The month on show, the focus day and the clamping all start from the number of months: change it and start over.
  return <KalenderIsi key={props.jumlahBulan} {...props} />
}

function KalenderIsi({ awal, jumlahBulan, hariIni, min, max, pilihan, pratinjau = null, onPilih, onFokusHari }: Props) {
  const uid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const mintaFokus = useRef(false)

  const batasiBulan = (b: Bulan): Bulan => {
    const lo = min ? indeks(bulanDari(min)) : -Infinity
    const hi = max ? indeks(bulanDari(max)) - (jumlahBulan - 1) : Infinity
    return dariIndeks(Math.min(Math.max(indeks(b), lo), Math.max(lo, hi)))
  }

  const [fokus, setFokus] = useState(() => batasi(awal, min, max))
  const [bulan, setBulan] = useState<Bulan>(() => batasiBulan(bulanDari(batasi(awal, min, max))))

  const tampak = (key: string): boolean => {
    const k = indeks(bulanDari(key))
    const p = indeks(bulan)
    return k >= p && k <= p + jumlahBulan - 1
  }
  // After the month is changed with the buttons the remembered day may be off screen: fall back to the first day shown.
  const kunciFokus = tampak(fokus) ? fokus : batasi(awalBulan(bulan), min, max)

  // Put focus on the day at once, so the keyboard works the moment the card opens.
  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>(FOKUS)?.focus()
  }, [])

  // After a keyboard move, re-render first (the month may have turned), then focus the new day.
  useEffect(() => {
    if (!mintaFokus.current) return
    mintaFokus.current = false
    rootRef.current?.querySelector<HTMLElement>(FOKUS)?.focus()
  })

  const geserFokus = (key: string) => {
    const baru = batasi(key, min, max)
    const b = bulanDari(baru)
    setFokus(baru)
    setBulan(prev => {
      const k = indeks(b)
      const p = indeks(prev)
      if (k < p) return b
      if (k > p + jumlahBulan - 1) return batasiBulan(geserBulan(b, -(jumlahBulan - 1)))
      return prev
    })
    mintaFokus.current = true
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let tujuan: string
    switch (e.key) {
      case 'ArrowLeft': tujuan = geserHari(kunciFokus, -1); break
      case 'ArrowRight': tujuan = geserHari(kunciFokus, 1); break
      case 'ArrowUp': tujuan = geserHari(kunciFokus, -7); break
      case 'ArrowDown': tujuan = geserHari(kunciFokus, 7); break
      case 'Home': tujuan = awalPekan(kunciFokus); break
      case 'End': tujuan = akhirPekan(kunciFokus); break
      case 'PageUp': tujuan = geserBulanKey(kunciFokus, e.shiftKey ? -12 : -1); break
      case 'PageDown': tujuan = geserBulanKey(kunciFokus, e.shiftKey ? 12 : 1); break
      default: return
    }
    e.preventDefault()
    geserFokus(tujuan)
  }

  const pindah = (n: number) => {
    const baru = batasiBulan(geserBulan(bulan, n))
    setBulan(baru)
    // The button just pressed disables itself when it cannot go further. A focused button that disables drops
    // focus out of the card (and the next Escape would then close a host dialog): hand focus to a day first.
    if (indeks(batasiBulan(geserBulan(baru, n))) === indeks(baru)) mintaFokus.current = true
  }
  const bisaPindah = (n: number): boolean => indeks(batasiBulan(geserBulan(bulan, n))) !== indeks(bulan)

  // The band: from the start to the chosen end, or to the pointer while the end is still open.
  const [lo, hi] = (() => {
    if (!pilihan.from) return [null, null] as const
    const ujung = pilihan.to ?? pratinjau
    if (!ujung) return [pilihan.from, null] as const
    return pilihan.from <= ujung ? ([pilihan.from, ujung] as const) : ([ujung, pilihan.from] as const)
  })()

  const bulanTampak = Array.from({ length: jumlahBulan }, (_, i) => geserBulan(bulan, i))

  // Selected for assistive tech: both ends and every day between them, once the end is chosen (a preview is not a choice).
  const awalPilih = pilihan.from !== null && pilihan.to !== null ? (pilihan.from <= pilihan.to ? pilihan.from : pilihan.to) : pilihan.from
  const akhirPilih = pilihan.from !== null && pilihan.to !== null ? (pilihan.from <= pilihan.to ? pilihan.to : pilihan.from) : pilihan.to

  return (
    <div ref={rootRef} className="flex flex-col gap-4 sm:flex-row" onMouseLeave={() => onFokusHari?.(null)}>
      {/* One live region that stays mounted and only changes its text: a region inserted with its text already in it is often not announced. */}
      <p role="status" className="sr-only">{bulanTampak.map(namaBulan).join(' dan ')}</p>
      {bulanTampak.map((b, i) => {
        const judulId = `${uid}-judul-${i}`
        return (
          // Keyed by position, not by month: turning the page updates this in place, so the nav button
          // that was just pressed stays in the DOM (and keeps focus) instead of being rebuilt.
          <div key={i} className="flex w-[308px] max-w-full flex-col">
            <div className="flex h-control items-center justify-between">
              {i === 0 ? (
                <span className="flex">
                  <IconButton icon={ChevronsLeft} label="Tahun sebelumnya" variant="ghost" size="sm" disabled={!bisaPindah(-12)} onClick={() => pindah(-12)} />
                  <IconButton icon={ChevronLeft} label="Bulan sebelumnya" variant="ghost" size="sm" disabled={!bisaPindah(-1)} onClick={() => pindah(-1)} />
                </span>
              ) : <span className="w-[72px]" />}
              <h3 id={judulId} className="text-sm font-semibold text-ink">{namaBulan(b)}</h3>
              {i === jumlahBulan - 1 ? (
                <span className="flex">
                  <IconButton icon={ChevronRight} label="Bulan berikutnya" variant="ghost" size="sm" disabled={!bisaPindah(1)} onClick={() => pindah(1)} />
                  <IconButton icon={ChevronsRight} label="Tahun berikutnya" variant="ghost" size="sm" disabled={!bisaPindah(12)} onClick={() => pindah(12)} />
                </span>
              ) : <span className="w-[72px]" />}
            </div>

            <div role="grid" aria-labelledby={judulId} onKeyDown={onKeyDown}>
              <div role="row" className="grid grid-cols-7">
                {NAMA_HARI.map(nama => (
                  <div key={nama} role="columnheader" className="flex h-8 items-center justify-center text-xs font-medium text-ink-muted">{nama}</div>
                ))}
              </div>
              {/* A trailing week with no day of this month is only faded days of the next: leave it out, so the card is a row shorter (it matters inside a phone sheet). */}
              {kisiBulan(b).filter(minggu => minggu.some(sel => sel.dalamBulan)).map((minggu, m) => (
                <div key={m} role="row" className="grid grid-cols-7">
                  {minggu.map(({ key, dalamBulan }) => {
                    const angka = Number(key.slice(8))
                    if (!dalamBulan) {
                      return <div key={key} role="gridcell" aria-hidden="true" className="flex h-control items-center justify-center text-sm text-ink-disabled">{angka}</div>
                    }
                    const nonaktif = (min !== undefined && key < min) || (max !== undefined && key > max)
                    const dipilih = key === pilihan.from || key === pilihan.to
                    const terpilih = dipilih || (awalPilih !== null && akhirPilih !== null && key > awalPilih && key < akhirPilih)
                    const ada = lo !== null && hi !== null && lo !== hi
                    const tengah = ada && key > lo && key < hi
                    const kiri = ada && key === lo
                    const kanan = ada && key === hi
                    return (
                      <div
                        key={key} role="gridcell" aria-selected={terpilih}
                        className={`flex h-control items-center justify-center ${tengah ? 'bg-accent-100' : ''} ${kiri ? 'rounded-l-full bg-accent-100' : ''} ${kanan ? 'rounded-r-full bg-accent-100' : ''}`}
                      >
                        <button
                          type="button" data-hari={key}
                          tabIndex={key === kunciFokus ? 0 : -1}
                          disabled={nonaktif}
                          aria-label={namaLengkap(key)}
                          aria-current={key === hariIni ? 'date' : undefined}
                          onClick={() => onPilih(key)}
                          onMouseEnter={() => onFokusHari?.(key)}
                          onFocus={() => { setFokus(key); onFokusHari?.(key) }}
                          className="group h-control w-control rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        >
                          <span
                            className={`mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-quick ${
                              dipilih ? 'bg-primary font-semibold text-ink-on-primary'
                              : nonaktif ? 'text-ink-disabled'
                              : `text-ink group-hover:bg-fill ${key === hariIni ? 'ring-1 ring-primary' : ''}`
                            }`}
                          >
                            {angka}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
