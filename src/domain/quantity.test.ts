import { describe, it, expect } from 'vitest'
import { qty, toBase, fromBase, describeConversion, type UnitDef } from './quantity'

const TON: UnitDef = { unit: 'ton', factor: 20 }   // 1 ton = 20 sak
const SAK: UnitDef = { unit: 'sak', factor: 1 }
const M3: UnitDef  = { unit: 'm3',  factor: 1 }

describe('qty', () => {
  it('rejects non-integer milli-units', () => {
    expect(() => qty(1500.5)).toThrow(/integer/)
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
    const units: UnitDef[] = [TON, SAK, M3, { unit: 'kg', factor: 7 }]
    for (let i = 0; i < 500; i++) {
      const unit = units[Math.floor(Math.random() * units.length)]
      const value = Math.round(Math.random() * 1000 * 1000) / 1000  // 3dp
      expect(fromBase(toBase(value, unit), unit)).toBeCloseTo(value, 3)
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
