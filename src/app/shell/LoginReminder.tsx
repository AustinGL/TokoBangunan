import { KeyRound, X } from 'lucide-react'
import { ButtonLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { IconButton } from '../../ui/IconButton'

/**
 * Shown while a cloud project is configured but nobody is signed in: until the
 * owner signs in, nothing leaves this device. It asks; it never blocks. The
 * cashier keeps working, which the text says so nobody hesitates to sell.
 */
export function LoginReminder({ pendingCount, onDismiss }: { pendingCount: number; onDismiss?: () => void }) {
  const state = pendingCount > 0
    ? `${pendingCount} perubahan menunggu dicadangkan.`
    : 'Data masih tersimpan di perangkat ini.'

  return (
    <section
      aria-label="Belum masuk"
      className="card-in mx-4 pt-4 md:hidden"
    >
      <div className="flex items-center gap-2 rounded-card bg-warning-bg p-3">
        <Icon icon={KeyRound} size="nav" className="shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warning">Cadangan cloud belum aktif</p>
          <p className="text-xs leading-4 text-warning">{state}</p>
        </div>
        <ButtonLink to="/masuk" variant="secondary" size="sm" className="min-h-control">Masuk</ButtonLink>
        {onDismiss && <IconButton icon={X} label="Tutup pengingat masuk" size="sm" variant="ghost" className="min-h-control min-w-control" onClick={onDismiss} />}
      </div>
    </section>
  )
}
