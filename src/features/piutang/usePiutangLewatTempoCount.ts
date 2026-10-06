import { usePiutang } from './usePiutang'

/**
 * How many customers are lewat tempo, for the dot on the Piutang menu. Only
 * lewat: "segera" would make the dot fire too often to be believed. 0 while
 * loading, so the dot never flashes on at start-up.
 */
export function usePiutangLewatTempoCount(): number {
  return usePiutang()?.jumlahLewatTempo ?? 0
}
