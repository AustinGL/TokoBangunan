import { KeyRound } from 'lucide-react'
import { ButtonLink } from '../../ui/Button'
import { Icon } from '../../ui/Icon'

/**
 * Shown while a cloud project is configured but nobody is signed in: until the
 * owner signs in, nothing leaves this device. It asks; it never blocks. The
 * cashier keeps working, which the text says so nobody hesitates to sell.
 */
export function LoginReminder({ pendingCount }: { pendingCount: number }) {
  const state = pendingCount > 0
    ? `${pendingCount} perubahan belum tercadangkan ke cloud.`
    : 'Data toko belum dicadangkan ke cloud.'

  return (
    <section aria-label="Belum masuk" className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-8 md:pt-6">
      <div className="flex flex-col gap-3 rounded-card border border-warning bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon icon={KeyRound} size="nav" className="mt-0.5 shrink-0 text-warning" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[14px] font-semibold text-warning">Masuk dulu agar data toko aman</p>
            <p className="text-[13px] text-warning">{state} Kasir tetap bisa dipakai.</p>
          </div>
        </div>
        <ButtonLink to="/masuk" variant="secondary">
          Masuk
        </ButtonLink>
      </div>
    </section>
  )
}
