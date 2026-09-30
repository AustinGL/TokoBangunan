import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { SearchField } from './SearchField'

function Harness() {
  const [value, setValue] = useState('')
  return <SearchField id="s" label="Cari barang" value={value} onChange={setValue} placeholder="Nama barang" />
}

describe('SearchField', () => {
  it('is labelled by its label, which is visually hidden, and shows the placeholder', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Cari barang')).toHaveAttribute('placeholder', 'Nama barang')
    expect(screen.getByText('Cari barang')).toHaveClass('sr-only')
  })

  it('shares the control height', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Cari barang')).toHaveClass('h-control')
  })

  it('reports what is typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Cari barang'), 'semen')

    expect(screen.getByLabelText('Cari barang')).toHaveValue('semen')
  })
})
