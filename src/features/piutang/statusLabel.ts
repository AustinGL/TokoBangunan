import type { PiutangStatus } from '../../domain/piutang'
import type { StatusTone } from '../../ui/StatusPill'

/** The words on a status pill. The tone only reinforces them. */
export function labelStatus(s: { status: PiutangStatus; hariLewat: number; hariLagi: number }): { tone: StatusTone; text: string } {
  if (s.status === 'lewat') return { tone: 'danger', text: `Lewat ${s.hariLewat} hari` }
  if (s.status === 'segera') {
    return { tone: 'warning', text: s.hariLagi === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${s.hariLagi} hari lagi` }
  }
  return { tone: 'neutral', text: 'Berjalan' }
}
