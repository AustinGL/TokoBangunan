import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { pengingatTerakhir, type PengingatPelanggan } from '../../domain/pengingatLog'

/** customerId -> when they were last reminded and how often. Read from the log; undefined while loading. */
export function usePengingat(): Record<string, PengingatPelanggan> | undefined {
  return useLiveQuery(async () => pengingatTerakhir(await db.events.where('type').equals('ReminderSent').toArray()), [])
}
