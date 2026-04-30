/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand (indigo) ──
        brand: {
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
          DEFAULT:  '#6366f1',
          deep:     '#4f46e5',
          light:    '#818cf8',
          pale:     '#eef2ff',
        },
        // ── Surfaces ──
        surface: {
          DEFAULT: '#ffffff',
          raised:  '#f8f9fc',
          overlay: '#f1f4f9',
          sunken:  '#e8ecf4',
        },
        // ── Borders ──
        border: {
          DEFAULT: '#e2e8f0',
          strong:  '#cbd5e1',
          focus:   '#6366f1',
        },
        // ── Muted text ──
        muted: {
          DEFAULT: '#64748b',
          light:   '#94a3b8',
          xlight:  '#cbd5e1',
        },
        // ── Semantic text ──
        text: {
          primary:   '#0f172a',
          secondary: '#475569',
          tertiary:  '#94a3b8',
          disabled:  '#cbd5e1',
          inverse:   '#ffffff',
          brand:     '#6366f1',
        },
        // ── Status ──
        success: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          DEFAULT: '#10b981',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          DEFAULT: '#f59e0b',
        },
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          DEFAULT: '#ef4444',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        sidebar:             '240px',
        'sidebar-collapsed': '64px',
        topbar:              '60px',
      },
      borderRadius: {
        'xs':  '0.25rem',
        'sm':  '0.375rem',
        'md':  '0.5rem',
        'lg':  '0.75rem',
        'xl':  '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'xs':         '0 1px 2px rgba(0,0,0,0.04)',
        'card':       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'sm':         '0 1px 3px rgba(0,0,0,0.08)',
        'md':         '0 4px 12px rgba(0,0,0,0.06)',
        'lg':         '0 8px 24px rgba(0,0,0,0.08)',
        'xl':         '0 16px 40px rgba(0,0,0,0.10)',
        'dropdown':   '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'modal':      '0 24px 64px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)',
        'glow':       '0 0 20px rgba(99,102,241,0.3)',
        'brand':      '0 4px 14px rgba(99,102,241,0.25)',
      },
      animation: {
        'fade-in':        'fadeIn 0.2s ease-out forwards',
        'slide-up':       'slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-down':     'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':       'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
        'spring-in':      'springIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'shimmer':        'shimmer 1.8s ease-in-out infinite',
        'spin-slow':      'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:      { '0%': { opacity: '0' },                           '100%': { opacity: '1' } },
        slideUp:     { '0%': { transform: 'translateY(10px)',  opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown:   { '0%': { transform: 'translateY(-8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight:{ '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        scaleIn:     { '0%': { transform: 'scale(0.95)',       opacity: '0' }, '100%': { transform: 'scale(1)',    opacity: '1' } },
        springIn:    { '0%': { transform: 'scale(0.85)',       opacity: '0' }, '100%': { transform: 'scale(1)',    opacity: '1' } },
        shimmer:     { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
