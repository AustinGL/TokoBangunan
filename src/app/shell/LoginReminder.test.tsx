import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { LoginReminder } from './LoginReminder'

const renderReminder = (pendingCount: number) =>
  render(<MemoryRouter><LoginReminder pendingCount={pendingCount} /></MemoryRouter>)

describe('LoginReminder', () => {
  it('asks the owner to sign in first and links to the sign-in screen', () => {
    renderReminder(0)

    expect(screen.getByRole('region', { name: 'Belum masuk' })).toBeInTheDocument()
    expect(screen.getByText('Masuk dulu agar data toko aman')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/masuk')
  })

  it('says nothing is backed up yet when no change is waiting', () => {
    renderReminder(0)

    expect(screen.getByText(/data toko belum dicadangkan ke cloud/i)).toBeInTheDocument()
  })

  it('counts the changes that are not backed up yet, and reassures that the cashier still works', () => {
    renderReminder(7)

    expect(screen.getByText(/7 perubahan belum tercadangkan ke cloud/i)).toBeInTheDocument()
    expect(screen.getByText(/kasir tetap bisa dipakai/i)).toBeInTheDocument()
  })
})
