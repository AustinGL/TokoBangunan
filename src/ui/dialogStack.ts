/**
 * Tracks currently-open <dialog> elements in show order. Toast.tsx needs
 * this because a real browser's top layer does NOT stack popovers and modal
 * dialogs by show order the way it stacks dialogs among themselves - a
 * modal <dialog> always paints above a popover regardless of which was
 * shown more recently (verified directly against Chromium; two modal
 * dialogs, by contrast, do stack in show order). So a toast fired while a
 * Sheet is open must be portaled INTO that dialog (a plain DOM descendant,
 * painting above the dialog's own content by ordinary stacking rules)
 * rather than shown as a sibling popover, which a real browser would render
 * underneath it.
 */
const openDialogs: HTMLDialogElement[] = []

export function pushOpenDialog(dialog: HTMLDialogElement): void {
  openDialogs.push(dialog)
}

export function popOpenDialog(dialog: HTMLDialogElement): void {
  const index = openDialogs.lastIndexOf(dialog)
  if (index !== -1) openDialogs.splice(index, 1)
}

export function topOpenDialog(): HTMLDialogElement | null {
  return openDialogs.length > 0 ? openDialogs[openDialogs.length - 1] : null
}
