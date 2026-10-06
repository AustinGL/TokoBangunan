import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it.each(['success', 'warning', 'danger', 'neutral'] as const)('renders the word and a decorative icon for %s', tone => {
    const { container } = render(<StatusPill tone={tone}>Habis</StatusPill>)
    expect(screen.getByText('Habis')).toBeInTheDocument()
    const icon = container.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses the tone-specific token classes', () => {
    render(<StatusPill tone="danger">Habis</StatusPill>)
    expect(screen.getByText('Habis').className).toMatch(/bg-danger-bg/)
    expect(screen.getByText('Habis').className).toMatch(/text-danger/)
  })
})
