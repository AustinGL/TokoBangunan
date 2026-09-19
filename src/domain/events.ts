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
})

export const eventSchemas = {
  ItemUpserted: itemUpsertedSchema,
  CustomerUpserted: customerUpsertedSchema,
  SupplierUpserted: supplierUpsertedSchema,
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
 * Events arriving from sync get the same scepticism as events created locally.
 */
export function parseEvent(raw: unknown): EventEnvelope {
  const envelope = envelopeSchema.parse(raw)
  const schema = eventSchemas[envelope.type as EventType]
  if (!schema) throw new Error(`Unknown event type: ${envelope.type}`)
  const parsed = schema.parse(envelope.payload)
  return { ...envelope, payload: parsed } as EventEnvelope
}
