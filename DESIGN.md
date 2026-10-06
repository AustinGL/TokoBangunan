# Toko Clarity design system

An Apple-inspired interface for daily store operations: calm, flat, quiet,
and physically responsive. The source of truth is `src/ui/tokens.css`, with
Tailwind aliases in `tailwind.config.js`. Change a token and the whole app
follows.

## Principles

1. **Content is flat; only navigation floats.** Cards, lists, sheets and menus
   are opaque white with no border and (almost) no shadow. The one translucent
   material (`.glass-panel`) is reserved for the desktop sidebar and the phone
   tab capsule. Never nest glass in glass.
2. **Hierarchy comes from type and tone, not decoration.** Large Title
   headings, a single blue for actions, gray fills for secondary controls, and
   hairline separators instead of boxes.
3. **Blue means "you can act on this".** Status uses green/orange/red, always
   with a word or icon. Ink-filled chips mark a selected filter.
4. **Motion explains.** Things grow from where they came from, press in when
   touched and spring back. Exits are faster than entries. Everything honours
   `prefers-reduced-motion`.

## Tokens (`src/ui/tokens.css`)

| Token | Value | Purpose |
|---|---|---|
| `--background` | `#F5F5F7` | page canvas |
| `--surface` | `#FFFFFF` | cards, sheets, menus |
| `--ink` / `--ink-muted` | `#1D1D1F` / `#6B6B70` | text |
| `--border-input` | `#86868B` | field outline, must stay 3:1 |
| `--primary` | `#0071E3` | button fill (white text, 4.7:1) |
| `--primary-ink` | `#0066CC` | blue **text** and links (5.6:1 on white) |
| `--fill-secondary` / `--fill-tertiary` | gray at 12% / 8% | gray buttons, tracks, grouped rows |
| `--separator` | `rgba(60,60,67,.16)` | hairlines |
| `--r-field` / `--r-card` / `--r-sheet` | 12 / 20 / 26px | radii (squircle where supported) |
| `--control-h` | 44px | every button and field (Apple's minimum target) |
| `--glass-bg` + blur | `rgba(255,255,255,.72)`, 24px | nav material |
| `--dur-quick` / `--dur-panel` / `--dur-exit` | 200 / 420 / 160ms | speed |
| `--ease-spring` | damped spring, ~1% overshoot | menus, indicators, presses |
| `--ease-spring-bouncy` | ~5% overshoot | toast, tab pop, cart bar |
| `--ease-ios` | `cubic-bezier(.32,.72,0,1)` | sheet slide |
| `--press-scale` | `.97` | button squish depth |

Status colors (`--success`, `--warning`, `--danger`, `--info`) are each tuned
to at least 4.5:1 on their own tint; `src/ui/tokens.test.ts` enforces every
pair, so a palette edit that breaks contrast fails the unit tests.

### Typography

System font first (`-apple-system` gives real SF Pro on Mac and iPhone), then
self-hosted **Inter Variable** (the closest open face, used on Windows and
Android). Optical tracking tightens as size grows (set per size in
`tailwind.config.js`). Scale: 11, 12, 14, 16, 17, 22, 28 and 34px. Page titles
(`text-2xl md:text-3xl`) are the Large Title. Money and counts use tabular
numerals.

## Motion

| Interaction | Behavior | Where |
|---|---|---|
| Press | scale to .97, springs back | `Button`, `IconButton`, `.press` rows, chips |
| Dropdown open | fade + scale from the trigger edge (flips upward when low) | `ListboxPanel` (`.listbox-in`) |
| Dropdown close | 160ms ghost exit, inert and hidden from assistive tech | `usePresence` + `.listbox-out` |
| Chevron | rotates 180° on a spring | `Select`, `Combobox` |
| Sheet | bottom sheet on phone, side drawer on desktop, scale when centered; scrim fades | `dialog[data-sheet]` in tokens.css (`@starting-style`) |
| Sidebar highlight | one capsule glides to the active item | `Sidebar` |
| Tab highlight | same, in the phone capsule; active icon pops | `BottomNav` |
| Segmented control | white thumb slides on a spring | `SegmentedControl` |
| Route change | content crossfades and rises 6px; nav stays | React Router `viewTransition` + `::view-transition-*` |
| Numbers | cart total, today's sales roll in when the value changes | `NumberTicker` |
| Toast | capsule drops in from the top on a bouncy spring | `Toast` |
| Disclosure | height animates; chevron rotates | `<details>`, Kamus rows |
| Loading | soft shimmer skeletons | `.skeleton` |

Browsers without `@starting-style`, `linear()` or view transitions fall back
gracefully (instant open/close, cubic-bezier curves, no crossfade).

## Components

- **Button**: capsule. `primary` (blue), `secondary` (gray fill, blue text),
  `ghost`, `danger`, `link`.
- **Fields**: white, 1px `--border-input`, 12px radius, 4px blue focus glow.
  Visible labels; errors inline with `aria-describedby`.
- **Lists**: white card, rows divided by hairlines (`.row-sep` insets the line
  past the icon). Used by Stok, Lainnya, Beranda inbox.
- **Cards**: `bg-surface shadow-card`, no border. One shadow token, a 0.5px
  ring.
- **Sheets**: solid white, grabber on phone, title + gray close button.
- **Status**: `StatusPill` (word + icon), never color alone.

## Navigation

Desktop: floating glass source list with a gliding highlight and an F2 hint on
"Transaksi baru". Phone: a glass capsule of four tabs, with Kasir as its own
round blue button beside it (as in iOS 26).

## Accessibility

AA contrast enforced by tests, 44px targets, visible focus rings, skip link,
route announcer, `aria-pressed` on toggles, and reduced motion collapsing
every duration to 1ms. Light is the only theme; every color is a token so a dark
set can be added without touching components.

## References (to adjust against)

**Apple design**
- Materials / Liquid Glass: https://developer.apple.com/design/human-interface-guidelines/materials
- Color: https://developer.apple.com/design/human-interface-guidelines/color
- Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars
- Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
- Segmented controls: https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- Pop-up buttons / menus: https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons
- Lists and tables: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Design resources (Figma/Sketch kits): https://developer.apple.com/design/resources/
- apple.com as the web reference: canvas `#F5F5F7`, ink `#1D1D1F`, secondary
  `#6E6E73`, button blue `#0071E3`, link blue `#0066CC`.

**Fonts**: Inter (https://rsms.me/inter/), package `@fontsource-variable/inter`.

**Web techniques**
- Spring easing with `linear()`: https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear
  (tune curves visually at https://linear-easing-generator.netlify.app/)
- iOS sheet curve, as in Vaul: https://github.com/emilkowalski/vaul
- Dialog entry/exit: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style and
  https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
- View transitions: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API and
  https://reactrouter.com/how-to/view-transitions
- Squircle corners: https://developer.mozilla.org/en-US/docs/Web/CSS/corner-shape
- Animated `<details>`: https://developer.mozilla.org/en-US/docs/Web/CSS/interpolate-size

## Assets and licenses

- Brand mark and navigation icons: `src/ui/BrandIcons.tsx` (project-owned SVG).
- Utility icons: `lucide-react`, ISC license.
- Typeface: `@fontsource-variable/inter`, SIL Open Font License, served locally.
- Favicon: project-owned SVG in `public/favicon.svg`.
- No external photographs or hotlinked assets.

## Release verification

`npm run test`, `npm run lint`, `npm run build`, then `npm run test:e2e`. The
e2e run serves `dist` on :4173 and reuses an existing server there, so stop any
old preview server and rebuild first or it tests stale code.
