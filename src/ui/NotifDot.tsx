/**
 * A small non-text status dot for nav destinations that have something
 * waiting - currently just Supplier's "perlu dilengkapi" reminder. Always
 * aria-hidden: the count and meaning belong in the destination's own
 * accessible name (see Sidebar.tsx/BottomNav.tsx, which set aria-label on
 * the link/button itself), never read from this dot's presence alone.
 * Colour is reinforcement, never the only indicator - the dot exists
 * alongside the destination's own accessible-name change, it does not
 * replace it.
 *
 * No positioning is baked in: most callers place it inline in a flex row
 * next to a label (icon, label, dot); a caller that wants it overlaid on an
 * icon's corner wraps it itself (see BottomNav.tsx's Lainnya tab).
 */
export function NotifDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--dot-notif)]"
    />
  )
}
