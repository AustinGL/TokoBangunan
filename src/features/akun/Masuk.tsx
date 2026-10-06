import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudOff, Eye, EyeOff, UserRound, WifiOff } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { signIn, signOut } from '../../data/auth'
import { requestPersistentStorage } from '../../data/persistentStorage'
import { isSupabaseConfigured } from '../../data/supabase'
import { PageHeader } from '../../ui/PageHeader'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { IconTile } from '../../ui/IconTile'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { useToast } from '../../ui/useToast'
import { useSession } from './useSession'

const PAGE = 'mx-auto flex w-full max-w-md flex-col gap-5 p-4 md:p-8 md:pt-16'
const ALERT = 'rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger'
const FIELD = 'h-control rounded-field border bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm'

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
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="card-in rounded-card-xl bg-surface p-5 shadow-card md:p-6">
        <p className="mb-5 text-sm leading-6 text-ink-muted">
          Masuk agar data toko dicadangkan ke cloud dan bisa dibuka di perangkat lain. Kasir tetap bisa dipakai tanpa masuk.
          Perangkat ini akan mengingat Anda sampai Anda memilih Keluar.
        </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && <p role="alert" className={ALERT}>{submitError}</p>}

        <div className="flex flex-col gap-1">
          <label htmlFor="masuk-email" className="req text-sm font-medium text-ink">Email</label>
          <input
            id="masuk-email" ref={emailRef} type="email" inputMode="email" autoComplete="username" autoFocus
            value={email} onChange={e => setEmail(e.target.value)}
            aria-required="true" aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'masuk-email-error' : undefined}
            className={`${FIELD} ${errors.email ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {errors.email && <p id="masuk-email-error" className="text-sm text-danger">{errors.email}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="masuk-password" className="req text-sm font-medium text-ink">Password</label>
          <div className="relative">
            <input
              id="masuk-password" ref={passwordRef} type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              aria-required="true" aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'masuk-password-error' : undefined}
              className={`${FIELD} w-full pr-12 ${errors.password ? 'border-danger' : 'border-[var(--field-bd)]'}`}
            />
            <IconButton
              icon={showPassword ? EyeOff : Eye}
              label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              variant="ghost"
              shape="field"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(value => !value)}
              className="absolute right-0 top-0"
            />
          </div>
          {errors.password && <p id="masuk-password-error" className="text-sm text-danger">{errors.password}</p>}
        </div>

        <Button type="submit" variant="primary" loading={submitting}>
          Masuk
        </Button>
      </form>
      </div>
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
      <section className="card-in flex flex-col gap-4 rounded-card-xl bg-surface p-5 shadow-card md:p-6">
        <div className="flex items-center gap-3">
          <IconTile icon={UserRound} tone="primary" />
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Masuk sebagai</p>
            <p className="break-all text-base font-semibold text-ink">{email}</p>
          </div>
        </div>

        <p className="text-sm text-ink">
          {pending === 0 ? 'Semua data sudah tercadangkan.' : `${pending} perubahan menunggu dicadangkan.`}
        </p>

        {error && <p role="alert" className={ALERT}>{error}</p>}

        <Button variant="secondary" onClick={handleKeluar} loading={busy}>
          Keluar
        </Button>
        <p className="text-sm text-ink-muted">
          Keluar tidak menghapus data. Semua data toko tetap ada dan terlihat di perangkat ini, dan perubahan yang belum tercadangkan tidak hilang.
        </p>
      </section>
    </main>
  )
}
