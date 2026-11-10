/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#f6f7fb',
        ink: '#16181d',
        subtle: '#5b6472',
        // 强调色阶：SkillHub 皇家蓝（明亮为默认主题，蓝为唯一强调）
        brand: {
          50: '#eef4ff', 100: '#dbe7ff', 200: '#bfd3ff', 300: '#93b4ff',
          400: '#6193ff', 500: '#3b76fb', 600: '#2563eb', 700: '#1d4fd0',
          800: '#1c3fa8', 900: '#1b3883',
        },
        violet2: '#7c3aed',
      },
      borderRadius: {
        bento: '1rem',
        bento2: '1.25rem',
      },
      boxShadow: {
        bento: '0 1px 2px rgba(16,24,40,.04), 0 10px 24px -14px rgba(16,24,40,.14)',
        bentoHover: '0 2px 6px rgba(16,24,40,.06), 0 16px 36px -16px rgba(37,99,235,.26)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC',
          'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
