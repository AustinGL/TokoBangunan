import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StokSummaryTiles } from './StokSummaryTiles'

const summary = { totalBarang: 12, menipisCount: 3, habisCount: 1 }

describe('StokSummaryTiles', () => {
  it('shows the three counts as one labelled group of toggle buttons', () => {
    render(<StokSummaryTiles summary={summary} status="semua" onChange={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Filter status stok' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semua barang: 12' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Menipis: 3' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Habis: 1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects a status filter on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StokSummaryTiles summary={summary} status="semua" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Menipis: 3' }))
    expect(onChange).toHaveBeenLastCalledWith('menipis')

    await user.click(screen.getByRole('button', { name: 'Habis: 1' }))
    expect(onChange).toHaveBeenLastCalledWith('habis')
  })

  it('clears the status filter when the pressed tile is clicked again, and when Semua barang is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StokSummaryTiles summary={summary} status="habis" onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Habis: 1' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Habis: 1' }))
    expect(onChange).toHaveBeenLastCalledWith('semua')

    await user.click(screen.getByRole('button', { name: 'Semua barang: 12' }))
    expect(onChange).toHaveBeenLastCalledWith('semua')
  })
})
