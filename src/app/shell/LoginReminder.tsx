import { KeyRound, X } from 'lucide-react'
import { ButtonLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { IconButton } from '../../ui/IconButton'

/**
 * Shown while a cloud project is configured but nobody is signed in: until the
 * owner signs in, nothing leaves this device. It asks; it never blocks.
 *
 * One slim strip (it used to wrap to ~110px at the top of every phone screen):
 * the title and state each hold one line and truncate rather than wrap.
 */
export function LoginReminder({ pendingCount, onDismiss }: { pendingCount: number; onDismiss?: () => void }) {
  const state = pendingCount > 0
    ? `${pendingCount} perubahan belum dicadangkan`
    : 'Data masih tersimpan di perangkat ini'

  return (
    <section
      aria-label="Belum masuk"
      className="card-in mx-4 pt-3 md:hidden"
    >
      <div className="flex items-center gap-1.5 rounded-card bg-warning-bg py-0.5 pl-3 pr-0.5">
        {/* Decoration only, and the first thing to go on a narrow phone (360px)
            so both lines fit; the amber tint already says "warning". */}
        <Icon icon={KeyRound} size="inline" className="hidden shrink-0 text-warning min-[400px]:block" />
        <div className="min-w-0 flex-1 py-1.5">
          <p className="truncate text-sm font-semibold leading-5 text-warning">Cadangan cloud belum aktif</p>
          <p className="truncate text-xs leading-4 text-warning">{state}</p>
        </div>
        <ButtonLink to="/masuk" variant="link" size="sm" className="min-h-control shrink-0 px-1">Masuk</ButtonLink>
        {onDismiss && <IconButton icon={X} label="Tutup pengingat masuk sampai besok" size="sm" variant="ghost" className="min-h-control min-w-control shrink-0" onClick={onDismiss} />}
      </div>
    </section>
  )
}
