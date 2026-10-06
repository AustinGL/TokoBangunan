import { describe, it, expect } from 'vitest'
import { labelStatus } from './statusLabel'

describe('labelStatus', () => {
  it('lewat is a danger pill with the days overdue', () => {
    expect(labelStatus({ status: 'lewat', hariLewat: 12, hariLagi: 0 })).toEqual({ tone: 'danger', text: 'Lewat 12 hari' })
  })
  it('segera says today, or the days left', () => {
    expect(labelStatus({ status: 'segera', hariLewat: 0, hariLagi: 0 })).toEqual({ tone: 'warning', text: 'Jatuh tempo hari ini' })
    expect(labelStatus({ status: 'segera', hariLewat: 0, hariLagi: 2 })).toEqual({ tone: 'warning', text: 'Jatuh tempo 2 hari lagi' })
  })
  it('berjalan is neutral', () => {
    expect(labelStatus({ status: 'berjalan', hariLewat: 0, hariLagi: 20 })).toEqual({ tone: 'neutral', text: 'Berjalan' })
  })
})
