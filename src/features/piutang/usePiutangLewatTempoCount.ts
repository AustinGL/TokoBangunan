import { useLiveQuery } from 'dexie-react-hooks'
import { bacaPiutang } from './usePiutang'
import { useHariIni } from '../shared/useHariIni'

/**
 * How many customers are lewat tempo, for the dot on the Piutang menu. Only
 * lewat: "segera" would make the dot fire too often to be believed. 0 while
 * loading, so the dot never flashes on at start-up.
 *
 * The query hands back only the number, not usePiutang()'s summary: this runs
 * in the app shell, and a fresh summary object after every sale re-rendered
 * the shell even when the count had not moved.
 */
export function usePiutangLewatTempoCount(): number {
  const hariIni = useHariIni()
  return useLiveQuery(async () => (await bacaPiutang(hariIni)).jumlahLewatTempo, [hariIni], 0)
}
