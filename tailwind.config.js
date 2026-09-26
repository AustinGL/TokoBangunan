/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: 'var(--surface)', sunken: 'var(--surface-sunken)', raised: 'var(--surface-raised)' },
        background: 'var(--background)',
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)', input: 'var(--border-input)' },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
          disabled: 'var(--ink-disabled)',
          'on-primary': 'var(--ink-on-primary)',
        },
        primary: { DEFAULT: 'var(--primary)', hover: 'var(--primary-hover)', active: 'var(--primary-active)' },
        // mint-soft/mint-tint keep their Phase 1 names on purpose: see the
        // comment on these same two custom properties in tokens.css.
        mint: { soft: 'var(--mint-soft)', tint: 'var(--mint-tint)' },
        success: { DEFAULT: 'var(--success)', bg: 'var(--success-bg)' },
        warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)' },
        danger:  { DEFAULT: 'var(--danger)',  bg: 'var(--danger-bg)' },
        neutral: { DEFAULT: 'var(--neutral)', bg: 'var(--neutral-bg)' },
        data:    { fill: 'var(--data-fill)',  track: 'var(--data-track)' },
      },
      borderRadius: { card: 'var(--r-card)', sheet: 'var(--r-sheet)', field: 'var(--r-field)', tile: 'var(--r-tile)' },
      boxShadow: { card: 'var(--shadow-card)', panel: 'var(--shadow-panel)', glass: 'var(--shadow-glass)' },
      transitionTimingFunction: { out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)' },
      transitionDuration: { instant: '90ms', quick: '160ms', panel: '240ms' },
      zIndex: { sticky: '10', nav: '20', dropdown: '30', scrim: '40', modal: '50', toast: '60' },
      fontFamily: { sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
}
