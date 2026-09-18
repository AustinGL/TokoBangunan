import { describe, it, expect } from 'vitest'
import { qty, toBase, fromBase, describeConversion, type UnitDef } from './quantity'

const TON: UnitDef = { unit: 'ton', factor: 20 }   // 1 ton = 20 sak
const SAK: UnitDef = { unit: 'sak', factor: 1 }
const M3: UnitDef  = { unit: 'm3',  factor: 1 }

describe('qty', () => {
  it('rejects non-integer milli-units', () => {
    expect(() => qty(1500.5)).toThrow(/integer/)
  })

  it('rejects values beyond MAX_SAFE_INTEGER', () => {
    expect(() => qty(Number.MAX_SAFE_INTEGER + 1)).toThrow(/integer/)
  })
})

describe('UnitDef factor validation', () => {
  it('rejects zero factor in toBase', () => {
    expect(() => toBase(1, { unit: 'test', factor: 0 })).toThrow(/positive finite number/)
  })

  it('rejects negative factor in toBase', () => {
    expect(() => toBase(1, { unit: 'test', factor: -1 })).toThrow(/positive finite number/)
  })

  it('rejects NaN factor in toBase', () => {
    expect(() => toBase(1, { unit: 'test', factor: NaN })).toThrow(/positive finite number/)
  })

  it('rejects Infinity factor in toBase', () => {
    expect(() => toBase(1, { unit: 'test', factor: Infinity })).toThrow(/positive finite number/)
  })

  it('rejects zero factor in fromBase', () => {
    expect(() => fromBase(qty(1000), { unit: 'test', factor: 0 })).toThrow(/positive finite number/)
  })

  it('rejects negative factor in fromBase', () => {
    expect(() => fromBase(qty(1000), { unit: 'test', factor: -1 })).toThrow(/positive finite number/)
  })

  it('rejects NaN factor in fromBase', () => {
    expect(() => fromBase(qty(1000), { unit: 'test', factor: NaN })).toThrow(/positive finite number/)
  })

  it('rejects Infinity factor in fromBase', () => {
    expect(() => fromBase(qty(1000), { unit: 'test', factor: Infinity })).toThrow(/positive finite number/)
  })
})

describe('conversion', () => {
  it('converts a selling unit into base milli-units', () => {
    expect(toBase(1, TON)).toBe(20000)   // 1 ton = 20 sak = 20000 milli-sak
    expect(toBase(2, SAK)).toBe(2000)
  })

  it('handles genuinely fractional goods', () => {
    expect(toBase(1.5, M3)).toBe(1500)
  })

  it('converts back to display units', () => {
    expect(fromBase(qty(20000), TON)).toBe(1)
    expect(fromBase(qty(1500), M3)).toBe(1.5)
  })

  it('round-trips exactly for many random values', () => {
    const integerUnits: UnitDef[] = [TON, SAK, M3, { unit: 'kg', factor: 7 }]
    const fractionalUnits: UnitDef[] = [
      { unit: 'half', factor: 0.5 },
      { unit: 'one-point-five', factor: 1.5 },
    ]
    for (let i = 0; i < 500; i++) {
      // Integer factors always round-trip exactly
      const intUnit = integerUnits[Math.floor(Math.random() * integerUnits.length)]
      const value = Math.round(Math.random() * 1000 * 1000) / 1000  // 3dp
      expect(fromBase(toBase(value, intUnit), intUnit)).toBe(value)

      // Fractional factors: rounding error bounded by 1/(2*factor*1000) per milli-unit precision
      const fracUnit = fractionalUnits[Math.floor(Math.random() * fractionalUnits.length)]
      const roundTripped = fromBase(toBase(value, fracUnit), fracUnit)
      const maxDrift = 1 / (2 * fracUnit.factor * 1000)
      expect(Math.abs(roundTripped - value)).toBeLessThanOrEqual(maxDrift + 1e-12)
    }
  })
})

describe('describeConversion', () => {
  it('shows its working when the unit is not the base unit', () => {
    expect(describeConversion(1, TON, 'sak')).toBe('1 ton (= 20 sak)')
  })

  it('stays silent when selling in the base unit', () => {
    expect(describeConversion(2, SAK, 'sak')).toBe('2 sak')
  })
})
