import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadBackup } from '../../data/exportEvents'
import { Button } from '../../ui/Button'
import { useToast } from '../../ui/useToast'

const ALERT = 'rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger'

/**
 * A second copy of the shop's data, kept by the owner: a file of every event on
 * this device. It needs no network and no account, so it works offline and
 * signed out, which is exactly when the cloud copy cannot help.
 */
export function UnduhCadangan() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnduh = async () => {
    setBusy(true)
    setError(null)
    try {
      const count = await downloadBackup()
      showToast(`Cadangan diunduh (${count} catatan).`)
    } catch {
      setError('Cadangan gagal dibuat. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card-in flex flex-col gap-3 rounded-card-xl bg-surface p-5 shadow-card md:p-6">
      <h2 className="text-base font-semibold text-ink">Cadangan di perangkat</h2>
      <p className="text-sm text-ink-muted">
        Unduh salinan seluruh data toko di perangkat ini sebagai satu berkas. Simpan di tempat yang aman, misalnya flashdisk atau Google Drive.
      </p>
      {error && <p role="alert" className={ALERT}>{error}</p>}
      <Button variant="secondary" icon={Download} onClick={handleUnduh} loading={busy} loadingLabel="Membuat cadangan...">
        Unduh cadangan
      </Button>
    </section>
  )
}
