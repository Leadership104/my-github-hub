import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kipita: {
          red: 'hsl(var(--kipita-red))',
          'red-dk': 'hsl(var(--kipita-red-dk))',
          'red-lt': 'hsl(var(--kipita-red-lt))',
          navy: 'hsl(var(--kipita-navy))',
          'navy-card': 'hsl(var(--kipita-navy-card))',
          green: 'hsl(var(--kipita-green))',
          teal: 'hsl(var(--kipita-teal))',
          warning: 'hsl(var(--kipita-warning))',
          blue: 'hsl(var(--kipita-blue))',
          btc: 'hsl(var(--kipita-btc))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        border: 'hsl(var(--border))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      borderRadius: {
        kipita: '18px',
        'kipita-sm': '10px',
        'kipita-lg': '24px',
      },
    },
  },
  plugins: [],
} satisfies Config;
