import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { Select } from './Select'

const options = [
  { value: 'a', label: 'Semen' },
  { value: 'b', label: 'Pasir' },
  { value: 'c', label: 'Kerikil' },
]

afterEach(() => { vi.restoreAllMocks() })

function setup(props: Partial<ComponentProps<typeof Select>> = {}) {
  const onChange = vi.fn()
  render(<Select id="s" label="Bahan" options={options} value={null} onChange={onChange} {...props} />)
  return { onChange, user: userEvent.setup() }
}

describe('Select: mouse', () => {
  it('opens on click, picks an option, and closes', async () => {
    const { onChange, user } = setup()

    await user.click(screen.getByRole('combobox', { name: 'Bahan' }))
    await user.click(screen.getByRole('option', { name: 'Pasir' }))

    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('closes when the trigger is clicked again', async () => {
    const { user } = setup()
    const trigger = screen.getByRole('combobox')

    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows the chosen label, or the placeholder when nothing is chosen', () => {
    const { rerender } = render(<Select id="s" label="Bahan" options={options} value="b" onChange={vi.fn()} placeholder="Pilih bahan" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Pasir')

    rerender(<Select id="s" label="Bahan" options={options} value={null} onChange={vi.fn()} placeholder="Pilih bahan" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Pilih bahan')
  })
})

describe('Select: keyboard', () => {
  it('opens with ArrowDown on the first option, moves, and selects with Enter', async () => {
    const { onChange, user } = setup()

    await user.tab()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Semen' })).toHaveAttribute('data-active', 'true')

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('opens with Space and with Enter', async () => {
    const { user } = setup()

    await user.tab()
    await user.keyboard(' ')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('starts on the chosen option when opened', async () => {
    const { user } = setup({ value: 'b' })

    await user.tab()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('option', { name: 'Pasir' })).toHaveAttribute('data-active', 'true')
  })

  it('jumps to the first and last option with Home and End', async () => {
    const { user } = setup()

    await user.tab()
    await user.keyboard('{Enter}{End}')
    expect(screen.getByRole('option', { name: 'Kerikil' })).toHaveAttribute('data-active', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('option', { name: 'Semen' })).toHaveAttribute('data-active', 'true')
  })

  it('finds an option by typing its first letters, on the closed trigger too', async () => {
    const { onChange, user } = setup()

    await user.tab()
    await user.keyboard('k')
    expect(screen.getByRole('option', { name: 'Kerikil' })).toHaveAttribute('data-active', 'true')

    await user.keyboard('x') // "kx" matches nothing: the highlight stays put
    expect(screen.getByRole('option', { name: 'Kerikil' })).toHaveAttribute('data-active', 'true')

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('closes without choosing when focus leaves', async () => {
    const { onChange, user } = setup()

    await user.tab()
    await user.keyboard('{Enter}')
    await user.tab()

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes only the list on the first Escape, so a host dialog stays open; the second Escape bubbles', async () => {
    const onKeyDown = vi.fn()
    const user = userEvent.setup()
    render(
      <div onKeyDown={onKeyDown}>
        <Select id="s" label="Bahan" options={options} value={null} onChange={vi.fn()} />
      </div>,
    )

    await user.tab()
    await user.keyboard('{Enter}')
    onKeyDown.mockClear()

    await user.keyboard('{Escape}')
    expect(onKeyDown).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.keyboard('{Escape}')
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})

describe('Select: disabled and odd inputs', () => {
  it('skips disabled options with the arrow keys and ignores clicks on them', async () => {
    const { onChange, user } = setup({
      options: [{ value: 'a', label: 'Semen' }, { value: 'b', label: 'Pasir', disabled: true }, { value: 'c', label: 'Kerikil' }],
    })

    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('c')

    onChange.mockClear()
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Pasir' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('opens to an empty state, and Enter picks nothing, when there are no options', async () => {
    const { onChange, user } = setup({ options: [] })

    await user.click(screen.getByRole('combobox'))
    expect(screen.getByText('Tidak ada pilihan.')).toBeInTheDocument()
    await user.keyboard('{Enter}{ArrowDown}{End}{Home}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the placeholder, and does not throw, when the value matches no option', () => {
    setup({ value: 'gone', placeholder: 'Pilih bahan' })
    expect(screen.getByRole('combobox')).toHaveTextContent('Pilih bahan')
  })

  it('cannot be opened by click or key when disabled', async () => {
    const { user } = setup({ disabled: true })
    const trigger = screen.getByRole('combobox')

    expect(trigger).toBeDisabled()
    await user.click(trigger)
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('does not throw, loop or select when every option is disabled', async () => {
    const { onChange, user } = setup({ options: options.map(o => ({ ...o, disabled: true })) })

    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowDown}{End}{Home}{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})

describe('Select: field variant', () => {
  it('is labelled by its label, and carries required, error and description', () => {
    setup({ required: true, error: 'Wajib dipilih.' })

    const trigger = screen.getByLabelText(/bahan/i)
    expect(trigger).toHaveAttribute('aria-required', 'true')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAccessibleDescription('Wajib dipilih.')
    expect(screen.getByText('Wajib dipilih.')).toBeInTheDocument()
  })

  it('can hide its visible label while keeping the accessible name', () => {
    setup({ hideLabel: true })
    expect(screen.getByText('Bahan')).toHaveClass('sr-only')
    expect(screen.getByRole('combobox', { name: 'Bahan' })).toBeInTheDocument()
  })
})

describe('Select: pill variant', () => {
  const pillOptions = [{ value: 'semua', label: 'Semua kategori' }, { value: 'semen', label: 'Semen' }]

  it('is named by its prefix and its value, and tints only when a non-default value is chosen', () => {
    const { rerender } = render(
      <Select id="k" variant="pill" label="Kategori" options={pillOptions} value="semua" neutralValue="semua" onChange={vi.fn()} />,
    )
    const neutral = screen.getByRole('combobox', { name: 'Kategori Semua kategori' })
    expect(neutral).not.toHaveClass('bg-accent-50')

    rerender(
      <Select id="k" variant="pill" label="Kategori" options={pillOptions} value="semen" neutralValue="semua" onChange={vi.fn()} />,
    )
    expect(screen.getByRole('combobox', { name: 'Kategori Semen' })).toHaveClass('bg-accent-50')
  })
})

describe('Select: placement', () => {
  it('opens upward when the trigger sits at the bottom of the viewport', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 700, bottom: 752, left: 0, right: 200, width: 200, height: 52, x: 0, y: 700, toJSON: () => ({}),
    })
    const { user } = setup()

    await user.click(screen.getByRole('combobox'))

    expect(screen.getByRole('listbox')).toHaveClass('bottom-full')
  })
})
