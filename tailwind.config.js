/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#f5f6fa',
        ink: '#111827',
        subtle: '#6b7280',
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81',
        },
        violet2: '#7c3aed',
      },
      borderRadius: {
        bento: '1.25rem',
        bento2: '1.75rem',
      },
      boxShadow: {
        bento: '0 1px 2px rgba(16,24,40,.04), 0 10px 28px -10px rgba(16,24,40,.10)',
        bentoHover: '0 2px 4px rgba(16,24,40,.05), 0 18px 44px -12px rgba(79,70,229,.20)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC',
          'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
