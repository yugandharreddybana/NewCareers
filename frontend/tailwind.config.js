/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* ── Brand ─────────────────────────────────── */
        brand: {
          DEFAULT:  '#6366f1',
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
          vibrant: '#6366f1',
          deep:    '#4338ca',
          glow:    '#818cf8',
          muted:   '#e0e7ff',
        },
        /* ── Surfaces ──────────────────────────────── */
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8f9fc',
          tertiary:  '#f1f5f9',
          inverse:   '#0f172a',
        },
        /* ── Borders ───────────────────────────────── */
        border: {
          DEFAULT: '#e2e8f0',
          strong:  '#cbd5e1',
          subtle:  '#f1f5f9',
          brand:   '#c7d2fe',
        },
        /* ── Text ──────────────────────────────────── */
        text: {
          primary:   '#0f172a',
          secondary: '#475569',
          muted:     '#94a3b8',
          disabled:  '#cbd5e1',
          inverse:   '#ffffff',
          brand:     '#6366f1',
        },
        /* ── Semantic ──────────────────────────────── */
        success: {
          DEFAULT: '#10b981',
          50:  '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          DEFAULT: '#f59e0b',
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          DEFAULT: '#ef4444',
          50:  '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          DEFAULT: '#3b82f6',
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
        },
        /* ── Legacy aliases (keep for Phase 1 compatibility) */
        primary: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe',
          300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1',
          600: '#4f46e5', 700: '#4338ca', 800: '#3730a3',
          900: '#312e81', 950: '#1e1b4b',
        },
        ink: {
          900: '#0b1220', 800: '#111a2e',
          700: '#1a2542', 500: '#475569', 300: '#cbd5e1',
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '72':  '18rem',
        '84':  '21rem',
        '96':  '24rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        /* Elevation */
        'xs':      '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm':      '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md':      '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'lg':      '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
        'xl':      '0 20px 25px -5px rgb(0 0 0 / 0.07), 0 8px 10px -6px rgb(0 0 0 / 0.07)',
        '2xl':     '0 25px 50px -12px rgb(0 0 0 / 0.15)',
        /* Brand */
        'brand':   '0 0 0 3px rgb(99 102 241 / 0.15)',
        'brand-lg':'0 8px 24px rgb(99 102 241 / 0.2)',
        'glow':    '0 0 20px rgb(99 102 241 / 0.25)',
        /* Legacy */
        'glass':   '0 8px 32px 0 rgba(31,38,135,0.12)',
        'premium': '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.03)',
        /* Inset */
        'inner-brand': 'inset 0 0 0 1px rgb(99 102 241 / 0.2)',
      },
      backgroundImage: {
        'gradient-brand':   'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
        'gradient-subtle':  'linear-gradient(135deg, #f8f9fc 0%, #eef2ff 100%)',
        'gradient-mesh':    'radial-gradient(at 0% 0%, hsl(240 100% 97%) 0, transparent 60%), radial-gradient(at 100% 0%, hsl(280 100% 97%) 0, transparent 60%)',
        'glass-gradient':   'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))',
        'mesh-gradient':    'radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)',
      },
      animation: {
        'fade-in':      'fadeIn 0.2s ease-out forwards',
        'slide-up':     'slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-down':   'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':     'scaleIn 0.15s ease-out forwards',
        'float':        'float 6s ease-in-out infinite',
        'pulse-brand':  'pulseBrand 2s ease-in-out infinite',
        'shimmer':      'shimmer 1.8s linear infinite',
        'spin-slow':    'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:      { from: { opacity: '0' },                               to: { opacity: '1' } },
        slideUp:     { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideDown:   { from: { transform: 'translateY(-12px)', opacity: '0' },to: { transform: 'translateY(0)', opacity: '1' } },
        slideInRight:{ from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        scaleIn:     { from: { transform: 'scale(0.95)', opacity: '0' },      to: { transform: 'scale(1)', opacity: '1' } },
        float:       { '0%,100%': { transform: 'translateY(0)' },             '50%': { transform: 'translateY(-8px)' } },
        pulseBrand:  { '0%,100%': { boxShadow: '0 0 0 0 rgb(99 102 241 / 0.3)' }, '50%': { boxShadow: '0 0 0 8px rgb(99 102 241 / 0)' } },
        shimmer:     { from: { backgroundPosition: '200% 0' },                to: { backgroundPosition: '-200% 0' } },
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
