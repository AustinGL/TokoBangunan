import { describe, it, expect } from 'vitest'
import { tundaSampaiBesok, pisahTunda, tundaAktif } from './tunda'
import type { InboxRow } from './inbox'

const row = (key: string): InboxRow => ({ key, severity: 'danger', title: key, aksi: 'Buka', items: [{ key, label: key, to: '/' }] })
const NOW = new Date(2026, 9, 5, 15, 30, 0)

describe('tundaSampaiBesok', () => {
  it('is local midnight at the start of tomorrow, whatever the hour now', () => {
    expect(new Date(tundaSampaiBesok(NOW))).toEqual(new Date(2026, 9, 6, 0, 0, 0))
    expect(new Date(tundaSampaiBesok(new Date(2026, 9, 5, 0, 0, 1)))).toEqual(new Date(2026, 9, 6, 0, 0, 0))
  })
  it('rolls over a month end and a year end', () => {
    expect(new Date(tundaSampaiBesok(new Date(2026, 9, 31, 9)))).toEqual(new Date(2026, 10, 1))
    expect(new Date(tundaSampaiBesok(new Date(2026, 11, 31, 9)))).toEqual(new Date(2027, 0, 1))
  })
})

describe('pisahTunda', () => {
  const rows = [row('a'), row('b'), row('c')]

  it('shows everything when nothing is snoozed', () => {
    expect(pisahTunda(rows, {}, NOW)).toEqual({ tampil: rows, ditunda: [] })
  })

  it('hides a row snoozed until a later time, keeping the order of the rest', () => {
    const r = pisahTunda(rows, { b: tundaSampaiBesok(NOW) }, NOW)
    expect(r.tampil.map(x => x.key)).toEqual(['a', 'c'])
    expect(r.ditunda.map(x => x.key)).toEqual(['b'])
  })

  it('shows a row again once its snooze has run out, exactly at the boundary too', () => {
    const batas = tundaSampaiBesok(NOW)
    expect(pisahTunda(rows, { b: batas }, new Date(batas)).tampil.map(x => x.key)).toEqual(['a', 'b', 'c'])
    expect(pisahTunda(rows, { b: batas }, new Date(new Date(batas).getTime() - 1)).tampil.map(x => x.key)).toEqual(['a', 'c'])
  })

  it('ignores a snooze for a row that no longer exists', () => {
    expect(pisahTunda(rows, { hantu: tundaSampaiBesok(NOW) }, NOW).tampil).toEqual(rows)
  })

  it('treats a malformed snooze time as not snoozed', () => {
    expect(pisahTunda(rows, { a: 'bukan tanggal' }, NOW).tampil).toEqual(rows)
  })
})

describe('tundaAktif', () => {
  it('drops expired and malformed entries, keeps the live ones', () => {
    const besok = tundaSampaiBesok(NOW)
    const kemarin = new Date(2026, 9, 5, 0, 0, 0).toISOString()
    expect(tundaAktif({ a: besok, b: kemarin, c: 'x' }, NOW)).toEqual({ a: besok })
  })
})
