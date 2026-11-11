/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'evaldo-azul': '#1A1AB8',
        'evaldo-azul-escuro': '#10107A',
        'evaldo-azul-claro': '#EEF0FB',
        'evaldo-amarelo': '#E1D800',
        'evaldo-amarelo-claro': '#FBF8C9',
        'evaldo-vermelho': '#CC1439',
        'evaldo-vermelho-claro': '#FCE4E9',
        positivo: '#1E8E4E',
        fundo: '#F5F6FA',
        texto: '#1B1D2A',
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(16, 16, 122, 0.08)',
      },
    },
  },
  plugins: [],
};
