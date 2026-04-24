import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/layouts/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/core/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'theme-bg': 'var(--bg-main)',
        'theme-card': 'var(--bg-card)',
        'theme-sidebar': 'var(--bg-sidebar)',
        'theme-topbar': 'var(--bg-topbar)',
        'theme-input': 'var(--bg-input)',
        'theme-hover': 'var(--bg-hover)',
        'theme-active': 'var(--bg-active)',
        'theme-border': 'var(--border-color)',
        'theme-border-light': 'var(--border-light)',
        'theme-border-active': 'var(--border-active)',
        'theme-text': 'var(--text-primary)',
        'theme-text-secondary': 'var(--text-secondary)',
        'theme-text-muted': 'var(--text-muted)',
        'theme-text-accent': 'var(--text-accent)',
        'theme-text-heading': 'var(--text-heading)',
        'theme-accent': 'var(--accent-primary)',
        'theme-accent-hover': 'var(--accent-primary-hover)',
        'theme-accent-secondary': 'var(--accent-secondary)',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        'theme-card': 'var(--shadow-card)',
        'theme-dropdown': 'var(--shadow-dropdown)',
      },
      borderRadius: {
        'theme': 'var(--radius-card)',
      },
    },
  },
  plugins: [],
};
export default config;
