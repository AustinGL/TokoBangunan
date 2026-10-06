import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SheetFooter } from './SheetFooter'
import { Button } from './Button'

describe('SheetFooter', () => {
  it('is sticky to the bottom, full-bleed, with a top border and its own background', () => {
    render(<form><SheetFooter><Button type="submit">Simpan</Button></SheetFooter></form>)
    const footer = screen.getByRole('button', { name: 'Simpan' }).parentElement!
    expect(footer).toHaveClass('sticky', 'bottom-0', 'translate-y-4', 'border-t', 'bg-surface')
    expect(footer.className).toMatch(/-mx-4/)
    expect(footer.className).toMatch(/mt-auto/)
    expect(footer.className).toMatch(/safe-area-inset-bottom/)
  })

  it('a submit button inside it still submits the surrounding form', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(<form onSubmit={onSubmit}><SheetFooter><Button type="submit">Simpan</Button></SheetFooter></form>)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simpan' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('lays several actions out in a row', () => {
    render(<form><SheetFooter><Button>A</Button><Button type="submit">B</Button></SheetFooter></form>)
    expect(screen.getByRole('button', { name: 'A' }).parentElement).toHaveClass('flex', 'justify-between', 'gap-3')
  })
})
