export type ListboxRow = {
  value: string
  label: string
  /** Second, muted line (e.g. stock and price). Read as the option's description. */
  hint?: string
  disabled?: boolean
  /** 'create' is the "Tambah ..." action row, not a choosable option. */
  kind?: 'option' | 'create'
}

/** DOM id of the option at `index` in the listbox `listboxId` (what aria-activedescendant points at). */
export const optionId = (listboxId: string, index: number): string => `${listboxId}-${index}`
