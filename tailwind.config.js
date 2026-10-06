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
        fill: { DEFAULT: 'var(--fill-secondary)', tertiary: 'var(--fill-tertiary)' },
        separator: 'var(--separator)',
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)', input: 'var(--border-input)' },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
          disabled: 'var(--ink-disabled)',
          'on-primary': 'var(--ink-on-primary)',
        },
        // primary fills carry white text; primary-ink is the blue used as text.
        primary: { DEFAULT: 'var(--primary)', hover: 'var(--primary-hover)', active: 'var(--primary-active)', ink: 'var(--primary-ink)' },
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
        info:    { DEFAULT: 'var(--info)',    bg: 'var(--info-bg)' },
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
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        panel: 'var(--shadow-panel)',
        button: 'var(--shadow-button)',
        'button-hover': 'var(--shadow-button-hover)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        ios: 'var(--ease-ios)',
        exit: 'var(--ease-exit)',
        spring: 'var(--ease-spring)',
        'spring-bouncy': 'var(--ease-spring-bouncy)',
      },
      transitionDuration: {
        instant: 'var(--dur-instant)',
        quick: 'var(--dur-quick)',
        panel: 'var(--dur-panel)',
        exit: 'var(--dur-exit)',
      },
      zIndex: {
        sticky: 'var(--z-sticky)', nav: 'var(--z-nav)', dropdown: 'var(--z-dropdown)',
        scrim: 'var(--z-scrim)', modal: 'var(--z-modal)', toast: 'var(--z-toast)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Inter Variable"', '"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      // Optical tracking follows the SF Pro table: tighter as the size grows.
      fontSize: {
        '2xs': ['var(--text-2xs)', { lineHeight: 'var(--leading-2xs)', letterSpacing: '0.006em' }],
        xs: ['var(--text-xs)', { lineHeight: 'var(--leading-xs)', letterSpacing: '0' }],
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-sm)', letterSpacing: '-0.006em' }],
        base: ['var(--text-base)', { lineHeight: 'var(--leading-base)', letterSpacing: '-0.011em' }],
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-lg)', letterSpacing: '-0.014em' }],
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-xl)', letterSpacing: '-0.02em' }],
        '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-2xl)', letterSpacing: '-0.021em' }],
        '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-3xl)', letterSpacing: '-0.022em' }],
      },
      height: { control: 'var(--control-h)', 'control-sm': 'var(--control-h-sm)' },
      width: {
        sidebar: 'var(--sidebar-w)',
        panel: 'var(--panel-w)',
        control: 'var(--control-h)',
        'control-sm': 'var(--control-h-sm)',
      },
      maxWidth: {
        workspace: 'var(--workspace-wide)',
        dashboard: 'var(--workspace-dashboard)',
      },
      spacing: {
        sidebar: 'var(--sidebar-w)',
      },
      minHeight: { tap: '44px', control: 'var(--control-h)' },
      minWidth: { tap: '44px', control: 'var(--control-h)' },
    },
  },
  plugins: [],
}
