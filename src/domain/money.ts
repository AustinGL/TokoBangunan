declare const rupiahBrand: unique symbol
export type Rupiah = number & { readonly [rupiahBrand]: true }

export function rupiah(n: number): Rupiah {
  if (!Number.isInteger(n)) {
    throw new Error(`Rupiah must be an integer, received ${n}`)
  }
  return n as Rupiah
}

export const add = (a: Rupiah, b: Rupiah): Rupiah => rupiah(a + b)
export const subtract = (a: Rupiah, b: Rupiah): Rupiah => rupiah(a - b)

/** qtyMilli is thousandths of the item's base unit. See quantity.ts. */
export const multiplyByQty = (price: Rupiah, qtyMilli: number): Rupiah =>
  rupiah(Math.round((price * qtyMilli) / 1000))

export const percentOf = (amount: Rupiah, percent: number): Rupiah =>
  rupiah(Math.round((amount * percent) / 100))

/**
 * Split `total` across `weights` using the largest-remainder method.
 * Guarantees the parts sum exactly to the total: no rupiah is lost or invented.
 */
export function allocate(total: Rupiah, weights: number[]): Rupiah[] {
  // Individually, not just in aggregate: weights [-1, 3] sum to a positive 2
  // but ask for a negative share, which produces a part whose sign is opposite
  // to the total and silently breaks "no rupiah is lost or invented" for every
  // caller downstream. There is no meaningful negative line quantity here.
  if (weights.some(w => !Number.isFinite(w) || w < 0)) {
    throw new Error('allocate requires every weight to be a finite, non-negative number')
  }
  const weightSum = weights.reduce((a, b) => a + b, 0)
  if (weightSum <= 0) {
    throw new Error('allocate requires a positive total weight')
  }
  const exact = weights.map(w => (total * w) / weightSum)
  const parts = exact.map(Math.floor)
  let remainder = total - parts.reduce((a, b) => a + b, 0)

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  let cursor = 0
  while (remainder > 0) {
    parts[byFraction[cursor % byFraction.length].index] += 1
    remainder -= 1
    cursor += 1
  }
  return parts.map(rupiah)
}

const formatter = new Intl.NumberFormat('id-ID')

export function formatRupiah(amount: Rupiah): string {
  const sign = amount < 0 ? '- ' : ''
  return `${sign}Rp ${formatter.format(Math.abs(amount))}`
}
