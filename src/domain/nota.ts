/** A short, human-readable reference for a sale, e.g. "#9C1F2A". */
export function shortNota(saleId: string): string {
  const tail = saleId.replace(/-/g, '').slice(-6).toUpperCase()
  return `#${tail}`
}
