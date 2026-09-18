/**
 * Quantities are stored as integer thousandths of the base unit to avoid floating-point
 * precision drift in stock arithmetic. When a display unit is smaller than the base unit
 * (factor < 1), the display unit's precision is coarser than 0.001 base units: rounding
 * error is bounded by 1/(2*factor*1000) per conversion. The design intends the base unit
 * to be the smallest unit; factors below 1 are supported but lossy by construction.
 */

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
  if (!Number.isSafeInteger(milli)) {
    throw new Error(`Qty must be an integer in milli-units, received ${milli}`)
  }
  return milli as Qty
}

function validateFactor(factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`UnitDef factor must be a positive finite number, received ${factor}`)
  }
}

export const toBase = (value: number, unit: UnitDef): Qty => {
  validateFactor(unit.factor)
  return qty(Math.round(value * unit.factor * 1000))
}

export const fromBase = (q: Qty, unit: UnitDef): number => {
  validateFactor(unit.factor)
  return q / (unit.factor * 1000)
}

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
