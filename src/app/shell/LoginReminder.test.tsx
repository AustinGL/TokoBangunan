import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { LoginReminder } from './LoginReminder'

const renderReminder = (pendingCount: number) =>
  render(<MemoryRouter><LoginReminder pendingCount={pendingCount} /></MemoryRouter>)

describe('LoginReminder', () => {
  it('asks the owner to sign in first and links to the sign-in screen', () => {
    renderReminder(0)

    expect(screen.getByRole('region', { name: 'Belum masuk' })).toBeInTheDocument()
    expect(screen.getByText('Cadangan cloud belum aktif')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/masuk')
  })

  it('says nothing is backed up yet when no change is waiting', () => {
    renderReminder(0)

    expect(screen.getByText(/data masih tersimpan di perangkat ini/i)).toBeInTheDocument()
  })

  it('counts the changes that are not backed up yet', () => {
    renderReminder(7)

    expect(screen.getByText(/7 perubahan menunggu dicadangkan/i)).toBeInTheDocument()
  })

  it('can be dismissed without blocking the shop', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<MemoryRouter><LoginReminder pendingCount={0} onDismiss={onDismiss} /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Tutup pengingat masuk' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
