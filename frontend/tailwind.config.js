/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
          950: '#1e1b4b',
          DEFAULT:  '#6366f1',
          vibrant:  '#6366f1',
          deep:     '#4f46e5',
          light:    '#818cf8',
          pale:     '#eef2ff',
        },
        surface: {
          DEFAULT: '#ffffff',
          raised:  '#f8f9fc',
          overlay: '#f1f4f9',
          sunken:  '#e8ecf4',
        },
        border: {
          DEFAULT: '#e2e8f0',
          strong:  '#cbd5e1',
          focus:   '#6366f1',
        },
        text: {
          primary:   '#0f172a',
          secondary: '#475569',
          tertiary:  '#94a3b8',
          disabled:  '#cbd5e1',
          inverse:   '#ffffff',
          brand:     '#6366f1',
        },
        success: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Legacy compatibility
        ink: { 900:'#0b1220', 800:'#111a2e', 700:'#1a2542', 500:'#475569', 300:'#cbd5e1' },
        glass: { DEFAULT: 'rgba(255,255,255,0.7)', dark: 'rgba(15,23,42,0.8)' },
        primary: {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
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
        sidebar:           '240px',
        'sidebar-collapsed': '64px',
        topbar:            '60px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'dropdown':   '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'modal':      '0 24px 64px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)',
        'brand':      '0 4px 14px rgba(99,102,241,0.25)',
        'brand-lg':   '0 8px 24px rgba(99,102,241,0.30)',
        // Legacy
        'glass':   '0 8px 32px 0 rgba(31,38,135,0.15)',
        'premium': '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        'glow':    '0 0 20px rgba(99,102,241,0.3)',
      },
      backgroundImage: {
        'mesh-gradient': "radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)",
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-out forwards',
        'slide-up':      'slideUp 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-down':    'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-in-right':'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':      'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':       'shimmer 1.8s ease-in-out infinite',
        'float':         'float 6s ease-in-out infinite',
        'spin-slow':     'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:      { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:     { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown:   { '0%': { transform: 'translateY(-8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight:{ '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        scaleIn:     { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer:     { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        float:       { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
