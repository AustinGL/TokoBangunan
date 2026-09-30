import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudOff, UserRound, WifiOff } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { signIn, signOut } from '../../data/auth'
import { requestPersistentStorage } from '../../data/persistentStorage'
import { isSupabaseConfigured } from '../../data/supabase'
import { PageHeader } from '../../ui/PageHeader'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { IconTile } from '../../ui/IconTile'
import { useToast } from '../../ui/useToast'
import { useSession } from './useSession'

const PAGE = 'mx-auto flex w-full max-w-md flex-col gap-5 p-4 md:p-8'
const ALERT = 'rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger'
const FIELD = 'h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink'

/**
 * Signing in is optional: the shop runs fully without it, on this device.
 * Signing in only turns on cloud backup (sync.ts). This screen never blocks a
 * sale and is never a gate in front of another screen.
 */
export function Masuk() {
  const session = useSession()

  if (!isSupabaseConfigured) {
    return (
      <main className={PAGE}>
        <PageHeader title="Akun" />
        <EmptyState icon={CloudOff}>Cadangan cloud belum diatur di perangkat ini. Data tersimpan hanya di perangkat ini.</EmptyState>
      </main>
    )
  }

  if (session.status === 'memuat') {
    return (
      <main className={PAGE}>
        <PageHeader title="Akun" />
        <ListSkeleton label="Memuat akun..." rows={2} />
      </main>
    )
  }

  if (session.status === 'offline') {
    return (
      <main className={PAGE}>
        <PageHeader title="Akun" />
        <EmptyState icon={WifiOff}>
          Tidak bisa memeriksa akun karena perangkat sedang offline. Kasir tetap bisa dipakai, dan data tersimpan di perangkat ini.
        </EmptyState>
      </main>
    )
  }

  return session.status === 'masuk' ? <AkunMasuk email={session.email} /> : <FormMasuk />
}

function FormMasuk() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return

    const next = {
      email: email.trim() === '' ? 'Email wajib diisi.' : undefined,
      password: password === '' ? 'Password wajib diisi.' : undefined,
    }
    setErrors(next)
    if (next.email || next.password) {
      ;(next.email ? emailRef : passwordRef).current?.focus()
      return
    }

    setSubmitError(null)
    setSubmitting(true)
    const result = await signIn(email, password)
    if (result.ok) {
      // The session is kept on this device; ask the browser not to evict it, so
      // this device stays remembered instead of asking for the password again.
      void requestPersistentStorage()
      showToast('Berhasil masuk. Pencadangan dimulai.')
      navigate('/', { replace: true })
    } else {
      setSubmitError(result.message)
    }
    setSubmitting(false)
  }

  return (
    <main className={PAGE}>
      <PageHeader title="Masuk" />
      <p className="text-[14px] text-ink-muted">
        Masuk agar data toko dicadangkan ke cloud dan bisa dibuka di perangkat lain. Kasir tetap bisa dipakai tanpa masuk.
        Perangkat ini akan mengingat Anda sampai Anda memilih Keluar.
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && <p role="alert" className={ALERT}>{submitError}</p>}

        <div className="flex flex-col gap-1">
          <label htmlFor="masuk-email" className="req text-[14px] font-medium text-ink">Email</label>
          <input
            id="masuk-email" ref={emailRef} type="email" inputMode="email" autoComplete="username" autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            aria-required="true" aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'masuk-email-error' : undefined}
            className={`${FIELD} ${errors.email ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {errors.email && <p id="masuk-email-error" className="text-[13px] text-danger">{errors.email}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="masuk-password" className="req text-[14px] font-medium text-ink">Password</label>
          <input
            id="masuk-password" ref={passwordRef} type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            aria-required="true" aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'masuk-password-error' : undefined}
            className={`${FIELD} ${errors.password ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {errors.password && <p id="masuk-password-error" className="text-[13px] text-danger">{errors.password}</p>}
        </div>

        <button
          type="submit" disabled={submitting}
          className="min-h-tap rounded-pill bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
        >
          {submitting ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </main>
  )
}

function AkunMasuk({ email }: { email: string }) {
  const { showToast } = useToast()
  // Live from the outbox, like the sync indicator: it moves the moment a sale is saved.
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKeluar = async () => {
    setBusy(true)
    setError(null)
    const result = await signOut()
    setBusy(false)
    if (result.ok) showToast('Anda sudah keluar.')
    else setError(result.message)
  }

  return (
    <main className={PAGE}>
      <PageHeader title="Akun" />
      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-card md:p-5">
        <div className="flex items-center gap-3">
          <IconTile icon={UserRound} tone="primary" />
          <div className="min-w-0">
            <p className="text-[13px] text-ink-muted">Masuk sebagai</p>
            <p className="break-all text-[15px] font-semibold text-ink">{email}</p>
          </div>
        </div>

        <p className="text-[14px] text-ink">
          {pending === 0 ? 'Semua data sudah tercadangkan.' : `${pending} perubahan menunggu dicadangkan.`}
        </p>

        {error && <p role="alert" className={ALERT}>{error}</p>}

        <button
          type="button" onClick={handleKeluar} disabled={busy}
          className="min-h-tap rounded-pill border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)] disabled:text-ink-disabled"
        >
          {busy ? 'Memproses...' : 'Keluar'}
        </button>
        <p className="text-[13px] text-ink-muted">
          Keluar tidak menghapus data. Semua data toko tetap ada dan terlihat di perangkat ini, dan perubahan yang belum tercadangkan tidak hilang.
        </p>
      </section>
    </main>
  )
}
