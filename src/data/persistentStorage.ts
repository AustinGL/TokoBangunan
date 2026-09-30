/**
 * Asks the browser to treat this site's storage as persistent: not evicted
 * when the device runs low on space. That storage holds the shop's event log
 * (until it is backed up) and the signed-in session, so losing it would mean
 * both lost data and signing in again. Best effort: a browser may decline, and
 * some have no such API. Never throws, and nothing depends on the answer.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = navigator.storage
    if (!storage?.persist) return false
    if (await storage.persisted?.()) return true
    return await storage.persist()
  } catch {
    return false
  }
}
