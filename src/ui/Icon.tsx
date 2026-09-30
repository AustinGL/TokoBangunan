import type { LucideIcon } from 'lucide-react'

/**
 * The only icon sizes in the app. micro sits inside 12px badge text, inline
 * beside body text, button inside a button, nav in navigation and headers,
 * fab on the floating centre action.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the size table belongs with Icon; a plain const never breaks Fast Refresh here
export const ICON_SIZE = { micro: 12, inline: 16, button: 18, nav: 20, fab: 24 } as const
export type IconSize = keyof typeof ICON_SIZE

type Props = { icon: LucideIcon; size?: IconSize; className?: string }

/** A decorative glyph: words next to it carry the meaning, so it is always aria-hidden. */
export function Icon({ icon: Glyph, size = 'button', className }: Props) {
  return <Glyph aria-hidden="true" size={ICON_SIZE[size]} strokeWidth={2} className={className} />
}
