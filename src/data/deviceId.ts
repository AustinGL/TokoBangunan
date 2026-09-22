import { newEventId } from '../domain/ids'

/**
 * A stable per-device identifier for CommandContext.deviceId. This is an
 * impure, IO-touching concern (localStorage), so it belongs in data/, not
 * domain/ (domain/ must stay pure per eslint.config.js's no-restricted-imports
 * rule; touching localStorage there would violate it).
 *
 * Shared here rather than reinvented per feature: every live UI-to-command
 * call on a given device (Stok's item creation, and later Kasir's recordSale
 * and Transaksi's voidSale) needs the exact same deviceId source. The event
 * envelope uses deviceId for audit/sync attribution, so two independent
 * implementations drifting (different localStorage keys, different fallback
 * strategies) would make the same physical device report inconsistent ids
 * across screens, a subtle real defect rather than a style nit.
 */
const DEVICE_ID_KEY = 'toko-device-id'
let cachedDeviceId: string | null = null

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) {
      cachedDeviceId = existing
      return existing
    }
    const id = newEventId()
    localStorage.setItem(DEVICE_ID_KEY, id)
    cachedDeviceId = id
    return id
  } catch {
    // Storage unavailable (private mode, disabled storage): fall back to a
    // session-only id rather than failing the write outright.
    const id = newEventId()
    cachedDeviceId = id
    return id
  }
}
