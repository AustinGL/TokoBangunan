import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './data/db'
import App from './App'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('App: Supplier badge', () => {
  it('reaches the Sidebar\'s Supplier link accessible name from a real live query, not the old hardcoded 0', async () => {
    await db.suppliersProj.put({ id: 's1', nama: 'UD Baru', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })

    render(<App />)

    // Sidebar.tsx's own convention (see navItems.ts's doc comment): the
    // count lives in the link's accessible name, e.g. "Supplier, 1 perlu
    // dilengkapi", not just the visual dot.
    expect(await screen.findByRole('link', { name: /supplier.*1 perlu dilengkapi/i })).toBeInTheDocument()
  })
})
