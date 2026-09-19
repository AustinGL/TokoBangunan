import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The runSync tests in sync.test.ts exercise the overlap-recovery contract
 * through the injectable SyncTransport, using a fake pull() that
 * re-implements the overlap arithmetic itself. That proves runSync behaves
 * correctly given a transport that applies the mitigation, but it never
 * touches the real supabaseTransport.pull query, so it could not catch a
 * regression in the actual `.gt(...)` expression. This file pins that
 * expression directly by mocking the supabase client's query builder.
 */
const { gtSpy, mockBuilder } = vi.hoisted(() => {
  const gtSpy = vi.fn()
  const builder = {
    select: vi.fn(() => builder),
    gt: vi.fn((...args: unknown[]) => {
      gtSpy(...args)
      return builder
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return { gtSpy, mockBuilder: builder }
})

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(() => mockBuilder) },
}))

const { supabaseTransport, CURSOR_OVERLAP } = await import('./sync')

beforeEach(() => {
  gtSpy.mockClear()
})

describe('supabaseTransport.pull cursor overlap query', () => {
  it('queries an overlap window below the cursor rather than strictly greater than it', async () => {
    await supabaseTransport.pull(150)
    expect(gtSpy).toHaveBeenCalledWith('server_seq', 150 - CURSOR_OVERLAP)
  })

  it('clamps the overlap window at zero instead of querying a negative bound', async () => {
    await supabaseTransport.pull(10)
    expect(gtSpy).toHaveBeenCalledWith('server_seq', 0)
  })
})
