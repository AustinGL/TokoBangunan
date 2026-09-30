import { appendEvents } from './eventStore'
import { db } from './db'
import { createEvent, type EventEnvelope } from '../domain/events'
import { newEventId } from '../domain/ids'
import { toBase } from '../domain/quantity'
import { add, rupiah, subtract, type Rupiah } from '../domain/money'
import type { Clock } from '../domain/clock'
import { kategoriIdForName, normalizeKategoriName } from '../domain/kategori'
import { loadKategoriEntries } from './kategoriQueries'

/**
 * Orchestration layer: assembles the event(s) a user action produces and
 * hands them to appendEvents in one atomic write. Event-shape logic itself
 * stays in domain/events.ts (createEvent), so this file only sequences and
 * persists. Both stok/ and kasir/ features import from here; no feature
 * imports another feature's internals.
 */

export type CommandContext = { clock: Clock; deviceId: string }

export type RecordItemInput = {
  nama: string
  baseUnit: string
  hargaEceran: number
  stokMinimum: number
  barcode?: string
  kategori?: string
  /** Whole units of baseUnit, e.g. 50 for "50 sak". Not milli-units. */
  stokAwal?: number
}

/**
 * Creates a new item and, if a starting count was given, its opening stock
 * movement, as one atomic write. Generates the item id itself (newEventId,
 * the same client-side UUIDv7 generator event ids use) since an offline
 * device has no other id source. units is always derived as
 * [{ unit: baseUnit, factor: 1 }]; this phase never asks for a multi-satuan
 * configuration.
 */
export const recordItem = async (input: RecordItemInput, ctx: CommandContext): Promise<string> => {
  const id = newEventId()
  const units = [{ unit: input.baseUnit, factor: 1 }]

  const itemEvent = createEvent('ItemUpserted', {
    id,
    nama: input.nama,
    baseUnit: input.baseUnit,
    units,
    hargaEceran: input.hargaEceran,
    stokMinimum: input.stokMinimum,
    barcode: input.barcode,
    kategori: input.kategori,
  }, ctx)

  const events: EventEnvelope[] = [itemEvent]

  // stockAdjustedSchema rejects quantity === 0, and a negative starting
  // count is nonsensical for a brand-new item, so the event is only built
  // when stokAwal is a positive number. The form is the validation
  // boundary for its sign; this only decides whether to emit the event.
  if (input.stokAwal !== undefined && input.stokAwal > 0) {
    const stockEvent = createEvent('StockAdjusted', {
      itemId: id,
      // Reuses toBase rather than hand-writing stokAwal * 1000, matching the
      // "same function that computed the stock movement" rule even though
      // the base-unit factor is trivially 1 here.
      quantity: toBase(input.stokAwal, { unit: input.baseUnit, factor: 1 }),
      reason: 'initial',
    }, ctx)
    events.push(stockEvent)
  }

  await appendEvents(events)
  return id
}

/**
 * A cart line as commands.ts needs it: structurally what useCart.ts's
 * CartLine produces (plus, harmlessly, any extra fields on that type -
 * TypeScript's structural typing accepts a CartLine[] argument here without
 * a cast). Kept as this file's own type, not an import from features/kasir,
 * since data/ is a lower layer than features/ (see this file's own doc
 * comment above: features import commands.ts, not the reverse).
 */
export type RecordSaleLine = {
  itemId: string
  nama: string
  unit: string
  /** Milli-units of `unit`, per quantity.ts. Positive: a cart holds what is being sold, not the stock delta. */
  qty: number
  hargaSatuan: number
  subtotal: number
  /** Which purchase batch this line was sold from. Absent for the legacy ("Stok lama") pool. */
  batchId?: string
  /** The ukuran's default harga jual at add-time, for the "Harga diubah" flag. */
  hargaNormal?: number
}

export type RecordSaleInput = {
  lines: RecordSaleLine[]
  /** Phase 2 accepts only tunai; matches saleRecordedSchema's narrower enum. */
  metodeBayar: 'tunai'
  uangDiterima?: number
  /** No customer picker exists yet (Task 6b territory); always undefined this phase. */
  customerId?: string
}

/**
 * Records a sale and its stock deduction as one atomic write: one
 * SaleRecorded event plus one StockAdjusted('sale') event per cart line,
 * all in a single appendEvents call. Assumes cart.lines has at least one
 * line, the same way recordItem assumes its caller already validated
 * required fields -- CartPanel (Task 6b) disables its save action on an
 * empty cart, so an empty-cart call is unreachable from the UI rather than
 * defended against here (saleLineSchema's array also has .min(1) and would
 * reject it regardless).
 */
export const recordSale = async (cart: RecordSaleInput, ctx: CommandContext): Promise<string> => {
  const subtotal = cart.lines.reduce(
    (sum, line) => add(sum, rupiah(line.subtotal)),
    rupiah(0),
  )
  const diskon: Rupiah = rupiah(0)
  const total = subtract(subtotal, diskon)

  const saleEvent = createEvent('SaleRecorded', {
    lines: cart.lines,
    metodeBayar: cart.metodeBayar,
    subtotal,
    diskon,
    total,
    uangDiterima: cart.uangDiterima,
    customerId: cart.customerId,
    deliveryIntent: 'dibawa',
  }, ctx)

  // One StockAdjusted per line, quantity negated: the cart line's own qty is
  // a positive milli-quantity (what was sold), but a sale deducts stock.
  // Each line's own batchId (if any) travels onto its StockAdjusted so
  // batchesProj can credit the right batch's sisa.
  const stockEvents: EventEnvelope[] = cart.lines.map(line =>
    createEvent('StockAdjusted', {
      itemId: line.itemId,
      quantity: -line.qty,
      reason: 'sale',
      saleId: saleEvent.id,
      batchId: line.batchId,
    }, ctx),
  )

  await appendEvents([saleEvent, ...stockEvents])
  return saleEvent.id
}

/**
 * Cancels an existing sale: writes SaleVoided and reverses its stock
 * deduction, one StockAdjusted('void') per original line, all as one
 * atomic appendEvents call. Reads db.salesProj first (the only command
 * function so far that reads before it writes) to recover the original
 * sale's lines - SaleVoided itself carries no line data, so there is no
 * other source for "what was on this sale" than the projection it already
 * produced.
 *
 * The status guard below is load-bearing, not defensive fluff.
 * reduceSales already treats a second SaleVoided on an already-'batal'
 * sale as a no-op at the projection level, but reduceStock has no such
 * guard: it unconditionally accumulates every StockAdjusted event it
 * sees. If voidSale ran twice for the same sale (a stale UI letting a
 * double-click through, two devices racing before a live query catches
 * up), the projection-level idempotency would hide the fact that stock
 * got reversed TWICE, a real, silent stock-count corruption. Throwing
 * here, before any event is built, is what prevents that.
 */
export async function voidSale(saleId: string, alasan: string, ctx: CommandContext): Promise<void> {
  const sale = await db.salesProj.get(saleId)
  if (!sale) throw new Error('Transaksi tidak ditemukan.')
  if (sale.status === 'batal') throw new Error('Transaksi sudah dibatalkan.')

  const voidEvent = createEvent('SaleVoided', { saleId, alasan }, ctx)
  // StockAdjusted.quantity is POSITIVE line.qty, reversing recordSale's
  // negative deduction exactly. StockAdjusted.saleId is the ORIGINAL
  // sale's id (the saleId parameter), not voidEvent's own id, so "which
  // sale does this stock movement belong to" stays consistent across both
  // 'sale' and 'void' reasons.
  const stockEvents = sale.lines.map(line =>
    createEvent('StockAdjusted', { itemId: line.itemId, quantity: line.qty, reason: 'void', saleId, batchId: line.batchId }, ctx),
  )
  await appendEvents([voidEvent, ...stockEvents])
}

const cleanKategoriName = (nama: string): string => nama.trim().replace(/\s+/g, ' ')

/**
 * Creates a kategori, or returns the existing one for the same name in any
 * spelling (un-archiving / materializing it when needed). The id is derived
 * from the name when free, so two offline devices that create the same name
 * converge on one row; when a renamed row already occupies that id a random
 * one is used instead.
 */
export const recordKategori = async (input: { nama: string }, ctx: CommandContext): Promise<string> => {
  const nama = cleanKategoriName(input.nama)
  if (nama === '') throw new Error('Nama kategori wajib diisi.')
  const key = normalizeKategoriName(nama)
  const entries = await loadKategoriEntries()
  const same = entries.find(e => normalizeKategoriName(e.nama) === key)
  if (same) {
    if (!same.materialized || same.diarsipkan) {
      await appendEvents([createEvent('KategoriUpserted', { id: same.id, nama: same.nama, diarsipkan: false }, ctx)])
    }
    return same.id
  }
  const derived = kategoriIdForName(nama)
  const id = entries.some(e => e.id === derived) ? newEventId() : derived
  await appendEvents([createEvent('KategoriUpserted', { id, nama, diarsipkan: false }, ctx)])
  return id
}

/** Full replace (last-write-wins), so the caller passes both fields. */
export const updateKategori = async (
  input: { id: string; nama: string; diarsipkan: boolean }, ctx: CommandContext,
): Promise<void> => {
  const nama = cleanKategoriName(input.nama)
  if (nama === '') throw new Error('Nama kategori wajib diisi.')
  const key = normalizeKategoriName(nama)
  const entries = await loadKategoriEntries()
  if (!entries.some(e => e.id === input.id)) throw new Error('Kategori tidak ditemukan.')
  if (entries.some(e => e.id !== input.id && normalizeKategoriName(e.nama) === key)) {
    throw new Error('Nama kategori sudah dipakai.')
  }
  await appendEvents([createEvent('KategoriUpserted', { id: input.id, nama, diarsipkan: input.diarsipkan }, ctx)])
}

/**
 * The KategoriUpserted a barang write must carry when its kategoriId is a
 * legacy-only entry (derived from old text, no master row yet): appended in
 * the SAME batch, so a barang never points at a row that does not exist.
 */
const kategoriEventsFor = async (kategoriId: string, ctx: CommandContext): Promise<EventEnvelope[]> => {
  if (await db.kategoriProj.get(kategoriId)) return []
  const entry = (await loadKategoriEntries()).find(e => e.id === kategoriId)
  if (!entry) throw new Error('Kategori tidak ditemukan.')
  return [createEvent('KategoriUpserted', { id: entry.id, nama: entry.nama, diarsipkan: entry.diarsipkan }, ctx)]
}

export type RecordBarangInput = { nama: string; kategoriId?: string }

/** Creates a new Kamus Barang parent. Generates its own id (newEventId), same as recordItem. */
export const recordBarang = async (input: RecordBarangInput, ctx: CommandContext): Promise<string> => {
  const id = newEventId()
  const kategoriEvents = input.kategoriId ? await kategoriEventsFor(input.kategoriId, ctx) : []
  await appendEvents([
    ...kategoriEvents,
    createEvent('BarangUpserted', { id, nama: input.nama, kategoriId: input.kategoriId, diarsipkan: false }, ctx),
  ])
  return id
}

export type UpdateBarangInput = {
  id: string
  nama?: string
  /** Omitted (or undefined): keep. null: clear. A string: set (replaces any legacy kategori text). */
  kategoriId?: string | null
  diarsipkan?: boolean
}

/**
 * BarangUpserted is a full-replace, last-write-wins event, so an update must
 * read the current row first to carry forward whatever field the caller
 * didn't set. When the kategori is untouched, BOTH the id and any legacy text
 * carry forward; when it is set or cleared, the legacy text is dropped
 * (kategoriId is the single source of truth from then on).
 */
export const updateBarang = async (input: UpdateBarangInput, ctx: CommandContext): Promise<void> => {
  const existing = await db.barangProj.get(input.id)
  if (!existing) throw new Error('Barang tidak ditemukan.')

  const touchesKategori = input.kategoriId !== undefined
  const kategoriId = touchesKategori ? (input.kategoriId ?? undefined) : existing.kategoriId
  const kategoriEvents = touchesKategori && kategoriId ? await kategoriEventsFor(kategoriId, ctx) : []

  await appendEvents([
    ...kategoriEvents,
    createEvent('BarangUpserted', {
      id: existing.id,
      nama: input.nama ?? existing.nama,
      kategoriId,
      kategori: touchesKategori ? undefined : existing.kategori,
      diarsipkan: input.diarsipkan ?? existing.diarsipkan,
    }, ctx),
  ])
}

export type RecordUkuranInput = {
  barangId: string
  /** e.g. "50 kg" - becomes both baseUnit and units[0].unit (factor 1). */
  ukuran: string
  hargaEceran: number
  stokMinimum: number
  barcode?: string
}

/**
 * Creates a new ukuran (still an ItemUpserted event under the hood) under
 * an existing barang, snapshotting the barang's current nama/kategori the
 * same way every ItemUpserted has since Kamus Barang's schema extension.
 */
export const recordUkuran = async (input: RecordUkuranInput, ctx: CommandContext): Promise<string> => {
  const barangRow = await db.barangProj.get(input.barangId)
  if (!barangRow) throw new Error('Barang tidak ditemukan.')

  const id = newEventId()
  await appendEvents([createEvent('ItemUpserted', {
    id,
    nama: barangRow.nama,
    baseUnit: input.ukuran,
    units: [{ unit: input.ukuran, factor: 1 }],
    hargaEceran: input.hargaEceran,
    stokMinimum: input.stokMinimum,
    barcode: input.barcode,
    // kategori here is a legacy snapshot only read for items with no barang; the barang owns the real value.
    kategori: barangRow.kategori,
    barangId: input.barangId,
    diarsipkan: false,
  }, ctx)])
  return id
}

export type UpdateUkuranInput = {
  id: string
  ukuran?: string
  hargaEceran?: number
  stokMinimum?: number
  /** Omitted (or undefined): keep. null: clear. A string: set. */
  barcode?: string | null
  /** Set to move the ukuran to a different barang ("Pindahkan ke barang lain"). */
  barangId?: string
  diarsipkan?: boolean
}

/**
 * ItemUpserted is a full-replace, last-write-wins event, so an update reads
 * the current row first (same precedent as updateBarang/voidSale). When
 * barangId changes (or is set for the first time), nama/kategori are
 * re-snapshotted from that barang - using a plain ternary on barangRow's
 * own presence, not `??`, because the target barang's kategori can itself
 * be legitimately undefined (a barang with no kategori), which `??` would
 * otherwise treat as "no snapshot" and fall through to the OLD barang's
 * kategori. A legacy item's undefined barangId is preserved, not invented,
 * when the caller doesn't set one.
 */
export const updateUkuran = async (input: UpdateUkuranInput, ctx: CommandContext): Promise<void> => {
  const existing = await db.itemsProj.get(input.id)
  if (!existing) throw new Error('Ukuran tidak ditemukan.')

  const barangId = input.barangId ?? existing.barangId
  const barangRow = barangId ? await db.barangProj.get(barangId) : undefined
  const ukuran = input.ukuran ?? existing.baseUnit

  await appendEvents([createEvent('ItemUpserted', {
    id: existing.id,
    nama: barangRow ? barangRow.nama : existing.nama,
    baseUnit: ukuran,
    units: [{ unit: ukuran, factor: 1 }],
    hargaEceran: input.hargaEceran ?? existing.hargaEceran,
    stokMinimum: input.stokMinimum ?? existing.stokMinimum,
    barcode: input.barcode === null ? undefined : (input.barcode ?? existing.barcode),
    // kategori here is a legacy snapshot only read for items with no barang; the barang owns the real value.
    kategori: barangRow ? barangRow.kategori : existing.kategori,
    barangId,
    diarsipkan: input.diarsipkan ?? existing.diarsipkan,
  }, ctx)])
}

export type RecordSupplierInput = {
  nama: string
  telepon?: string
  alamat?: string
  kontak?: string
  catatan?: string
  /** True for a quick-add from a picker (e.g. Tambah stok's supplier field): lights the Supplier nav dot until updateSupplier clears it. */
  quickAdd?: boolean
}

export const recordSupplier = async (input: RecordSupplierInput, ctx: CommandContext): Promise<string> => {
  const id = newEventId()
  await appendEvents([createEvent('SupplierUpserted', {
    id,
    nama: input.nama,
    telepon: input.telepon,
    alamat: input.alamat,
    kontak: input.kontak,
    catatan: input.catatan,
    perluDilengkapi: input.quickAdd ?? false,
  }, ctx)])
  return id
}

export type UpdateSupplierInput = {
  id: string
  nama?: string
  /** Each optional field: omitted (or undefined) keeps the existing value, null clears it, a string sets it. */
  telepon?: string | null
  alamat?: string | null
  kontak?: string | null
  catatan?: string | null
}

const resolveClearable = (input: string | null | undefined, existing: string | undefined): string | undefined =>
  input === null ? undefined : (input ?? existing)

/**
 * A full-form save on the Supplier page. Always clears perluDilengkapi,
 * regardless of which fields the save touches - "Nanti saja" is simply not
 * calling this command, not a flag passed to it.
 */
export const updateSupplier = async (input: UpdateSupplierInput, ctx: CommandContext): Promise<void> => {
  const existing = await db.suppliersProj.get(input.id)
  if (!existing) throw new Error('Supplier tidak ditemukan.')

  await appendEvents([createEvent('SupplierUpserted', {
    id: existing.id,
    nama: input.nama ?? existing.nama,
    telepon: resolveClearable(input.telepon, existing.telepon),
    alamat: resolveClearable(input.alamat, existing.alamat),
    kontak: resolveClearable(input.kontak, existing.kontak),
    catatan: resolveClearable(input.catatan, existing.catatan),
    perluDilengkapi: false,
  }, ctx)])
}

export type RecordStockPurchaseInput = {
  itemId: string
  /** Whole units of the item's baseUnit, e.g. 40 for "40 sak". Not milli-units. */
  qty: number
  hargaJual: number
  hargaBeli?: number
  supplierId?: string
  catatan?: string
  /** Business date of the purchase; defaults to today (createEvent's own default) when omitted. */
  tanggalBeli?: Date
}

/**
 * Records a purchase as one atomic write: a StockReceived event (creating
 * the batch), plus an ItemUpserted re-save when hargaJual differs from the
 * ukuran's current default - which then becomes the new default, per spec.
 */
export const recordStockPurchase = async (input: RecordStockPurchaseInput, ctx: CommandContext): Promise<string> => {
  const item = await db.itemsProj.get(input.itemId)
  if (!item) throw new Error('Ukuran tidak ditemukan.')

  const batchId = newEventId()
  const events: EventEnvelope[] = [createEvent('StockReceived', {
    supplierId: input.supplierId,
    catatan: input.catatan,
    lines: [{
      batchId,
      itemId: input.itemId,
      qty: toBase(input.qty, { unit: item.baseUnit, factor: 1 }),
      hargaBeli: input.hargaBeli,
      hargaJual: input.hargaJual,
    }],
  }, { ...ctx, occurredAt: input.tanggalBeli })]

  if (input.hargaJual !== item.hargaEceran) {
    events.push(createEvent('ItemUpserted', {
      id: item.id,
      nama: item.nama,
      baseUnit: item.baseUnit,
      units: item.units,
      hargaEceran: input.hargaJual,
      stokMinimum: item.stokMinimum,
      barcode: item.barcode,
      kategori: item.kategori,
      barangId: item.barangId,
      diarsipkan: item.diarsipkan,
    }, ctx))
  }

  await appendEvents(events)
  return batchId
}

export type CorrectBatchInput = {
  batchId: string
  supplierId?: string
  hargaBeli?: number
  hargaJual: number
  tanggalBeli: string
  /** A corrected "originally received" quantity, whole units of the item's baseUnit. Omit for a metadata-only correction. */
  jumlah?: number
}

/**
 * BatchCorrected overwrites the batch's metadata (last-write-wins, matching
 * batches.ts's own reducer). diterima/sisa are stored in milli-units (the
 * same convention StockReceived's own qty uses), so a given jumlah is
 * converted via toBase before it is compared or written - comparing a
 * whole-unit input directly against a milli-unit diterima would silently
 * corrupt both the correction and its koreksi delta. When the converted
 * jumlah differs from the batch's current diterima, a companion
 * StockAdjusted('koreksi') carries the delta against diterima - never
 * against sisa, which already reflects whatever has sold since receipt.
 */
export const correctBatch = async (input: CorrectBatchInput, ctx: CommandContext): Promise<void> => {
  const existing = await db.batchesProj.get(input.batchId)
  if (!existing) throw new Error('Batch tidak ditemukan.')

  const item = await db.itemsProj.get(existing.itemId)
  const jumlahMilli = input.jumlah === undefined
    ? undefined
    : toBase(input.jumlah, { unit: item?.baseUnit ?? '', factor: 1 })

  const events: EventEnvelope[] = [createEvent('BatchCorrected', {
    batchId: input.batchId,
    supplierId: input.supplierId,
    hargaBeli: input.hargaBeli,
    hargaJual: input.hargaJual,
    tanggalBeli: input.tanggalBeli,
    jumlah: jumlahMilli,
  }, ctx)]

  if (jumlahMilli !== undefined && jumlahMilli !== existing.diterima) {
    events.push(createEvent('StockAdjusted', {
      itemId: existing.itemId,
      quantity: jumlahMilli - existing.diterima,
      reason: 'koreksi',
      batchId: input.batchId,
    }, ctx))
  }

  await appendEvents(events)
}
