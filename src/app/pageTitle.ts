export const APP_NAME = 'Toko Bahan Bangunan'

/** "Stok · Toko Bahan Bangunan": the screen's own name first, so a tab or a screen reader says where you are. */
export function pageTitleFor(heading: string | null): string {
  const name = heading?.trim()
  if (name) return `${name} · ${APP_NAME}`
  return APP_NAME
}
