// Tailwind v4 is handled by @tailwindcss/vite in vite.config.ts.
// Running the PostCSS tailwind plugin as well causes double-processing and errors.
export default {
  plugins: {
    autoprefixer: {}
  }
}
