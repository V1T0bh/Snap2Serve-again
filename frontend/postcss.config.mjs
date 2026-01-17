const config = {
  plugins: {
    // Use the new Tailwind PostCSS entry point to avoid plugin resolution errors
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

export default config;
