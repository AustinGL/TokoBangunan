declare const qtyBrand: unique symbol
/** Integer thousandths of an item's base unit. 1.5 m3 is 1500. */
export type Qty = number & { readonly [qtyBrand]: true }

export type UnitDef = {
  /** Display name, for example 'ton'. */
  unit: string
  /** How many base units one of this unit contains. 1 ton = 20 sak => 20. */
  factor: number
}

export function qty(milli: number): Qty {
  if (!Number.isInteger(milli)) {
    throw new Error(`Qty must be an integer in milli-units, received ${milli}`)
  }
  return milli as Qty
}

export const toBase = (value: number, unit: UnitDef): Qty =>
  qty(Math.round(value * unit.factor * 1000))

export const fromBase = (q: Qty, unit: UnitDef): number =>
  q / (unit.factor * 1000)

/**
 * MASTER.md requires the cart line to show its working, so the arithmetic the
 * user checks and the arithmetic that moves stock come from one function.
 */
export function describeConversion(
  value: number,
  unit: UnitDef,
  baseUnit: string,
): string {
  if (unit.unit === baseUnit) {
    return `${value} ${unit.unit}`
  }
  const inBase = fromBase(toBase(value, unit), { unit: baseUnit, factor: 1 })
  return `${value} ${unit.unit} (= ${inBase} ${baseUnit})`
}
