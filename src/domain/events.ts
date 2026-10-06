import { z } from 'zod'
import { newEventId } from './ids'
import type { Clock } from './clock'

const integer = z.number().int()

const unitDefSchema = z.object({
  unit: z.string().min(1),
  factor: z.number().positive(),
})

const itemUpsertedSchema = z.object({
  id: z.string().min(1),
  nama: z.string().min(1),
  baseUnit: z.string().min(1),
  units: z.array(unitDefSchema).min(1),
  hargaEceran: integer,
  stokMinimum: integer,
  barcode: z.string().optional(),
  kategori: z.string().optional(),
  /** The Kamus Barang parent this ukuran belongs to. Absent on every item
   * created before Kamus Barang existed - src/domain/katalog.ts's
   * groupUkuranByBarang gives those a virtual barang instead of requiring a
   * migration event. */
  barangId: z.string().min(1).optional(),
  diarsipkan: z.boolean().default(false),
})

const customerUpsertedSchema = z.object({
  id: z.string().min(1),
  nama: z.string().min(1),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  tier: z.enum(['eceran', 'grosir']).default('eceran'),
  termynHari: integer.default(30),
})

const supplierUpsertedSchema = z.object({
  id: z.string().min(1),
  nama: z.string().min(1),
  telepon: z.string().optional(),
  alamat: z.string().optional(),
  kontak: z.string().optional(),
  catatan: z.string().optional(),
  /** Set by a quick-add from Tambah stok's supplier picker; cleared by a
   * full form save. Drives the Supplier nav badge. */
  perluDilengkapi: z.boolean().default(false),
})

const stockAdjustedSchema = z.object({
  itemId: z.string().min(1),
  quantity: integer.refine(n => n !== 0, 'quantity must not be zero'),
  reason: z.enum(['initial', 'sale', 'void', 'koreksi']),
  saleId: z.string().optional(),    // present for 'sale' and 'void'
  /** The batch this movement affects, when it has one. Sale and void
   * deductions carry the line's batch (or omit it for the legacy,
   * pre-batch stock pool); a 'koreksi' StockAdjusted targeting a specific
   * batch's sisa also carries it. */
  batchId: z.string().min(1).optional(),
})

const saleLineSchema = z.object({
  itemId: z.string().min(1),
  // Snapshots, not references. hargaEceran on ItemUpserted can change after
  // the sale; the nota and margin math must reproduce what was actually
  // charged on the day, not today's catalogue price -- same principle as
  // occurredAt/recordedAt staying separate fields.
  nama: z.string().min(1),
  unit: z.string().min(1),          // Phase 2: always the item's baseUnit
  qty: integer,                     // milli-units of `unit`, per quantity.ts
  hargaSatuan: integer,             // Rupiah per whole unit, snapshot
  subtotal: integer,                // = multiplyByQty(hargaSatuan, qty)
  /** Which purchase batch this line was sold from. Absent for the legacy
   * ("Stok lama") pool, or for any sale recorded before batches existed. */
  batchId: z.string().min(1).optional(),
  /** The ukuran's default harga jual at the moment this line was added,
   * captured so the UI can flag hargaSatuan !== hargaNormal as "Harga
   * diubah". Absent for the same legacy reasons as batchId. */
  hargaNormal: integer.optional(),
})

const tanggalKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const saleRecordedSchema = z.object({
  lines: z.array(saleLineSchema).min(1),
  // 'bon', 'transfer' and 'qris' are additive: every event written under the old tunai-only enum stays valid.
  // Transfer and QRIS are paid in full, like Tunai, but never tender cash.
  metodeBayar: z.enum(['tunai', 'bon', 'transfer', 'qris']),
  subtotal: integer,
  diskon: integer.default(0),       // always 0 this phase; see Decision 6
  total: integer,                   // subtotal - diskon
  uangDiterima: integer.optional(), // Tunai: amount tendered
  customerId: z.string().optional(),// a Tunai sale may carry no customer; a Bon always has one
  deliveryIntent: z.enum(['dibawa']).default('dibawa'),
  /** Bon only: the day (yyyy-mm-dd, local) the customer is due to pay. */
  jatuhTempo: tanggalKey.optional(),
  /** Bon only: paid at the counter, whole rupiah, 0 <= dibayarAwal < total. The rest is piutang. */
  dibayarAwal: integer.min(0).optional(),
}).superRefine((sale, ctx) => {
  if (sale.metodeBayar === 'bon') {
    if (!sale.customerId) ctx.addIssue({ code: 'custom', path: ['customerId'], message: 'a Bon requires a customerId' })
    if (!sale.jatuhTempo) ctx.addIssue({ code: 'custom', path: ['jatuhTempo'], message: 'a Bon requires a jatuhTempo' })
    if ((sale.dibayarAwal ?? 0) >= sale.total) {
      ctx.addIssue({ code: 'custom', path: ['dibayarAwal'], message: 'dibayarAwal must be less than total' })
    }
    return
  }
  if (sale.metodeBayar !== 'tunai' && sale.uangDiterima !== undefined) ctx.addIssue({ code: 'custom', path: ['uangDiterima'], message: 'only Tunai tenders cash' })
  if (sale.jatuhTempo !== undefined) ctx.addIssue({ code: 'custom', path: ['jatuhTempo'], message: 'only a Bon has a jatuhTempo' })
  if ((sale.dibayarAwal ?? 0) !== 0) ctx.addIssue({ code: 'custom', path: ['dibayarAwal'], message: 'only a Bon takes a dibayarAwal' })
})

const paymentReceivedSchema = z.object({
  saleId: z.string().min(1),
  jumlah: integer.refine(n => n > 0, 'jumlah must be positive'),
  catatan: z.string().optional(),
})

const saleVoidedSchema = z.object({
  saleId: z.string().min(1),        // the id of the original SaleRecorded event
  alasan: z.string().min(1),
})

const barangUpsertedSchema = z.object({
  id: z.string().min(1),
  nama: z.string().min(1),
  kategori: z.string().optional(),
  // Set once a barang picks a Kategori master row; `kategori` text is legacy, only ever read.
  kategoriId: z.string().min(1).optional(),
  diarsipkan: z.boolean().default(false),
})

const kategoriUpsertedSchema = z.object({
  id: z.string().min(1),
  nama: z.string().min(1),
  diarsipkan: z.boolean().default(false),
})

const stockReceivedLineSchema = z.object({
  batchId: z.string().min(1),
  itemId: z.string().min(1),
  qty: integer.refine(n => n > 0, 'qty must be positive'),
  hargaBeli: integer.optional(),
  hargaJual: integer,
})

const stockReceivedSchema = z.object({
  supplierId: z.string().optional(),
  catatan: z.string().optional(),
  // Multi-line even though this phase's UI only ever sends one: a future
  // nota pembelian covering several ukuran in one purchase needs no new
  // event type, only a UI that builds a longer lines array.
  lines: z.array(stockReceivedLineSchema).min(1),
})

const batchCorrectedSchema = z.object({
  batchId: z.string().min(1),
  supplierId: z.string().optional(),
  hargaBeli: integer.optional(),
  hargaJual: integer,
  tanggalBeli: z.string().datetime(),
  /** Corrects the batch's own recorded "originally received" quantity
   * (src/domain/projections/batches.ts's Batch.diterima), for display only.
   * Does not by itself change sisa - a companion StockAdjusted('koreksi')
   * does that, so a purchase-record typo fix never silently erases or
   * double-counts sales already made from the batch. */
  jumlah: integer.optional(),
})

/** Operating expenses a shop pays outside buying stock. A fixed list, no custom names. */
export const KATEGORI_BIAYA = ['gaji', 'sewa', 'listrik', 'transport', 'lainnya'] as const
export type KategoriBiaya = (typeof KATEGORI_BIAYA)[number]

const expenseRecordedSchema = z.object({
  jumlah: integer.refine(n => n > 0, 'jumlah must be positive'),
  kategori: z.enum(KATEGORI_BIAYA),
  catatan: z.string().optional(),
})

/** Cancels an expense without erasing it (the log is append-only). */
const expenseVoidedSchema = z.object({
  expenseId: z.string().min(1),
})

/**
 * The owner tapped "Kirim pengingat" for a customer: WhatsApp was opened, which
 * is all the app can know (it cannot see whether the message was sent). Kept
 * so the screen can say when a customer was last reminded.
 */
const reminderSentSchema = z.object({
  customerId: z.string().min(1),
})

/** The shop's name, shown only in the payment reminder. Empty clears it. */
const tokoDiaturSchema = z.object({
  nama: z.string().trim().max(60),
})

export const eventSchemas = {
  ItemUpserted: itemUpsertedSchema,
  CustomerUpserted: customerUpsertedSchema,
  SupplierUpserted: supplierUpsertedSchema,
  StockAdjusted: stockAdjustedSchema,
  SaleRecorded: saleRecordedSchema,
  SaleVoided: saleVoidedSchema,
  BarangUpserted: barangUpsertedSchema,
  KategoriUpserted: kategoriUpsertedSchema,
  StockReceived: stockReceivedSchema,
  BatchCorrected: batchCorrectedSchema,
  PaymentReceived: paymentReceivedSchema,
  TokoDiatur: tokoDiaturSchema,
  ExpenseRecorded: expenseRecordedSchema,
  ExpenseVoided: expenseVoidedSchema,
  ReminderSent: reminderSentSchema,
} as const

export type EventType = keyof typeof eventSchemas

const envelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  payload: z.unknown(),
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  deviceId: z.string().min(1),
  serverSeq: z.number().int().nullable(),
})

export type EventEnvelope = {
  id: string
  type: EventType
  payload: unknown
  /** Business time. The user may backdate this. */
  occurredAt: string
  /** Wall clock at the moment of writing. Never backdated. */
  recordedAt: string
  deviceId: string
  serverSeq: number | null
}

export function createEvent(
  type: EventType,
  payload: unknown,
  opts: { clock: Clock; deviceId: string; occurredAt?: Date },
): EventEnvelope {
  const schema = eventSchemas[type]
  if (!schema) throw new Error(`Unknown event type: ${type}`)
  const parsed = schema.parse(payload)
  const recordedAt = opts.clock.now().toISOString()
  return {
    id: newEventId(),
    type,
    payload: parsed,
    occurredAt: opts.occurredAt ? opts.occurredAt.toISOString() : recordedAt,
    recordedAt,
    deviceId: opts.deviceId,
    serverSeq: null,
  }
}

/**
 * An envelope whose transport fields are all sound but whose `type` this
 * version of the app does not know. The shared log is append-only and read by
 * devices on different releases, so a phone still on Phase 1 will legitimately
 * receive a Phase 2 event type. That is forward compatibility, not corruption.
 */
export type UnknownTypeEvent = Omit<EventEnvelope, 'type'> & { type: string }

export type EventClassification =
  | { status: 'valid'; event: EventEnvelope }
  | { status: 'unknown-type'; event: UnknownTypeEvent; reason: string }
  | { status: 'invalid'; reason: string }

const describeIssues = (error: z.ZodError): string =>
  error.issues
    .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')

/**
 * Sorts an incoming record into the three cases a caller has to handle
 * differently: usable now, usable after a future release, and never usable.
 * Separating "unknown type" from "invalid" is what lets a single unrecognised
 * event be tolerated instead of wedging the whole pull.
 */
export function classifyEvent(raw: unknown): EventClassification {
  const envelope = envelopeSchema.safeParse(raw)
  if (!envelope.success) {
    return { status: 'invalid', reason: describeIssues(envelope.error) }
  }

  const schema = eventSchemas[envelope.data.type as EventType]
  if (!schema) {
    return {
      status: 'unknown-type',
      event: envelope.data,
      reason: `Unknown event type: ${envelope.data.type}`,
    }
  }

  const payload = schema.safeParse(envelope.data.payload)
  if (!payload.success) {
    return {
      status: 'invalid',
      reason: `${envelope.data.type} payload: ${describeIssues(payload.error)}`,
    }
  }

  return {
    status: 'valid',
    event: { ...envelope.data, payload: payload.data } as EventEnvelope,
  }
}

/**
 * Events arriving from sync get the same scepticism as events created locally.
 * Throws on anything this version cannot fully validate. Callers that must
 * survive a single bad record use classifyEvent instead.
 */
export function parseEvent(raw: unknown): EventEnvelope {
  const result = classifyEvent(raw)
  if (result.status !== 'valid') throw new Error(result.reason)
  return result.event
}
