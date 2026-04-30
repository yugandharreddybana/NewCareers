/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand (Indigo) ──────────────────────────────────────────────
        brand: {
          50:      '#EEF2FF',
          100:     '#E0E7FF',
          200:     '#C7D2FE',
          300:     '#A5B4FC',
          400:     '#818CF8',
          500:     '#6366F1',
          600:     '#4F46E5',
          700:     '#4338CA',
          800:     '#3730A3',
          900:     '#312E81',
          DEFAULT: '#6366F1',
          hover:   '#4F46E5',
          light:   '#EEF2FF',
          // Legacy compat
          vibrant: '#6366F1',
          deep:    '#4F46E5',
          glow:    '#818CF8',
        },
        // ── Surfaces ────────────────────────────────────────────────────
        surface: {
          DEFAULT: '#FFFFFF',
          raised:  '#FFFFFF',
          sunken:  '#F8F9FC',
          brand:   '#EEF2FF',
        },
        // ── Borders ─────────────────────────────────────────────────────
        border: {
          DEFAULT: '#E2E8F0',
          strong:  '#CBD5E1',
          brand:   '#C7D2FE',
        },
        // ── Text ────────────────────────────────────────────────────────
        text: {
          primary:   '#0F172A',
          secondary: '#475569',
          muted:     '#94A3B8',
          disabled:  '#CBD5E1',
          brand:     '#6366F1',
          inverse:   '#FFFFFF',
        },
        // ── App background ──────────────────────────────────────────────
        bg: {
          DEFAULT: '#F8F9FC',
          subtle:  '#F1F5F9',
        },
        // ── Semantic ────────────────────────────────────────────────────
        success: {
          DEFAULT: '#10B981',
          light:   '#ECFDF5',
          border:  '#A7F3D0',
          text:    '#065F46',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light:   '#FFFBEB',
          border:  '#FDE68A',
          text:    '#92400E',
        },
        danger: {
          DEFAULT: '#EF4444',
          light:   '#FEF2F2',
          border:  '#FECACA',
          text:    '#991B1B',
        },
        info: {
          DEFAULT: '#3B82F6',
          light:   '#EFF6FF',
          border:  '#BFDBFE',
          text:    '#1E40AF',
        },
        // ── Legacy ink colours (keep backward compat) ───────────────────
        ink: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          500: '#64748B',
          300: '#CBD5E1',
        },
        // ── Legacy glass colours ─────────────────────────────────────────
        glass: {
          DEFAULT: 'rgba(255,255,255,0.7)',
          dark:    'rgba(15,23,42,0.8)',
        },
      },

      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '0.875rem' }],
        'xs':  ['0.75rem',   { lineHeight: '1rem'     }],
        'sm':  ['0.8125rem', { lineHeight: '1.25rem'  }],
        'base':['0.875rem',  { lineHeight: '1.5rem'   }],
        'md':  ['0.9375rem', { lineHeight: '1.5rem'   }],
        'lg':  ['1rem',      { lineHeight: '1.625rem' }],
        'xl':  ['1.125rem',  { lineHeight: '1.75rem'  }],
        '2xl': ['1.25rem',   { lineHeight: '1.875rem' }],
        '3xl': ['1.5rem',    { lineHeight: '2rem'     }],
        '4xl': ['1.875rem',  { lineHeight: '2.375rem' }],
        '5xl': ['2.25rem',   { lineHeight: '2.75rem'  }],
        '6xl': ['3rem',      { lineHeight: '1.15'     }],
      },

      boxShadow: {
        'xs':      '0 1px 2px 0 rgba(0,0,0,0.05)',
        'sm':      '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'DEFAULT': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'md':      '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'lg':      '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06)',
        'xl':      '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.06)',
        '2xl':     '0 25px 50px -12px rgba(0,0,0,0.18)',
        'brand':   '0 4px 14px 0 rgba(99,102,241,0.25)',
        'brand-lg':'0 8px 24px 0 rgba(99,102,241,0.30)',
        'inner':   'inset 0 2px 4px 0 rgba(0,0,0,0.06)',
        'none':    'none',
        // Legacy compat
        'glass':   '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.06)',
        'premium': '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.06)',
        'glow':    '0 4px 14px 0 rgba(99,102,241,0.25)',
      },

      borderRadius: {
        'none':    '0',
        'sm':      '4px',
        'DEFAULT': '6px',
        'md':      '8px',
        'lg':      '10px',
        'xl':      '12px',
        '2xl':     '16px',
        '3xl':     '20px',
        '4xl':     '24px',
        'full':    '9999px',
      },

      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '17':  '4.25rem',
        '18':  '4.5rem',
        '68':  '17rem',
        '72':  '18rem',
        '76':  '19rem',
        '80':  '20rem',
      },

      animation: {
        'fade-in':    'fadeIn 150ms ease-out forwards',
        'fade-up':    'fadeUp 200ms cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-down': 'slideDown 200ms cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-up':   'slideUp 200ms cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':   'scaleIn 150ms cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':    'shimmer 1.6s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'spin':       'spin 1s linear infinite',
        'pulse':      'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },

      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },

      backgroundImage: {
        // Legacy gradient kept for compat
        'mesh-gradient':  "radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)",
        'glass-gradient': 'linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))',
        // New — subtle brand gradient for hero sections
        'brand-gradient': 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
        'brand-subtle':   'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
      },
    },
  },
  plugins: [],
};
