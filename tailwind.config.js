/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--surface)',
          sunken: 'var(--surface-sunken)',
          raised: 'var(--surface-raised)',
          card: 'var(--surface-card)',
          inset: 'var(--surface-inset)',
        },
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
        // accent is for graphics and large marks; text and small white-on
        // fills use primary (see the note at the top of tokens.css).
        accent: {
          DEFAULT: 'var(--accent)',
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          200: 'var(--accent-200)',
          300: 'var(--accent-300)',
        },
        success: { DEFAULT: 'var(--success)', bg: 'var(--success-bg)' },
        warning: { DEFAULT: 'var(--warning)', bg: 'var(--warning-bg)' },
        danger:  { DEFAULT: 'var(--danger)',  bg: 'var(--danger-bg)' },
        neutral: { DEFAULT: 'var(--neutral)', bg: 'var(--neutral-bg)' },
        data:    { fill: 'var(--data-fill)',  track: 'var(--data-track)' },
        focal:   { DEFAULT: 'var(--focal-bg)', fg: 'var(--focal-fg)' },
      },
      borderRadius: {
        'card-xl': 'var(--r-card-xl)',
        card: 'var(--r-card)',
        sheet: 'var(--r-sheet)',
        inner: 'var(--r-inner)',
        field: 'var(--r-field)',
        tile: 'var(--r-tile)',
        pill: 'var(--r-pill)',
      },
      boxShadow: { card: 'var(--shadow-card)', panel: 'var(--shadow-panel)' },
      transitionTimingFunction: { out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)' },
      transitionDuration: { instant: '90ms', quick: '160ms', panel: '240ms' },
      zIndex: { sticky: '10', nav: '20', dropdown: '30', scrim: '40', modal: '50', toast: '60' },
      fontFamily: { sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      height: { control: 'var(--control-h)', 'control-sm': 'var(--control-h-sm)' },
      width: { control: 'var(--control-h)', 'control-sm': 'var(--control-h-sm)' },
      minHeight: { tap: '44px', control: 'var(--control-h)' },
      minWidth: { tap: '44px', control: 'var(--control-h)' },
    },
  },
  plugins: [],
}
