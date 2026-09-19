import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SyncIndicator } from './SyncIndicator'

describe('SyncIndicator', () => {
  it('shows the synced state', () => {
    render(<SyncIndicator status="tersinkron" pendingCount={0} />)
    expect(screen.getByText('Tersinkron')).toBeInTheDocument()
  })

  it('shows the saving state', () => {
    render(<SyncIndicator status="menyimpan" pendingCount={2} />)
    expect(screen.getByText('Menyimpan')).toBeInTheDocument()
  })

  it('shows the pending count when not synced', () => {
    render(<SyncIndicator status="belum-tersinkron" pendingCount={3} />)
    expect(screen.getByText('Belum tersinkron (3)')).toBeInTheDocument()
  })

  it('announces changes politely', () => {
    render(<SyncIndicator status="tersinkron" pendingCount={0} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('is not a button, because it must never block a write', () => {
    render(<SyncIndicator status="belum-tersinkron" pendingCount={1} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
