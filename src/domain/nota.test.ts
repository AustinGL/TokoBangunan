import { describe, it, expect } from 'vitest'
import { shortNota } from './nota'

describe('shortNota', () => {
  it('produces a # followed by 6 uppercase hex characters from the id\'s tail', () => {
    const nota = shortNota('01926a3e-9c1f-72a3-a1b2-c3d4e5f69c1f2a')
    expect(nota).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('is deterministic for the same id', () => {
    const id = '01926a3e-9c1f-72a3-a1b2-c3d4e5f69c1f2a'
    expect(shortNota(id)).toBe(shortNota(id))
  })

  it('differs for two different ids', () => {
    expect(shortNota('01926a3e-0000-0000-0000-000000000001')).not.toBe(shortNota('01926a3e-0000-0000-0000-000000000002'))
  })
})
