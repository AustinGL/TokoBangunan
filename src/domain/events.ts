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
