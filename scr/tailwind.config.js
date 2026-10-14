/** @type {import('tailwindcss').Config} */

// Cada cor aponta para uma variável CSS (canais RGB) definida em src/index.css.
// O tema escuro troca os valores das variáveis, então as classes existentes
// (bg-white, text-slate-900, bg-sky-50…) se adaptam automaticamente.
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name) =>
  Object.fromEntries(steps.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "Segoe UI", "sans-serif"],
        heading: ['"Sora"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        slate: scale("slate"),
        gray: scale("slate"),
        sky: scale("sky"),
        blue: scale("sky"),
        emerald: scale("emerald"),
        green: scale("emerald"),
        purple: scale("purple"),
        violet: scale("purple"),
        amber: scale("amber"),
        rose: scale("rose"),
        red: scale("rose"),
        orange: scale("orange"),

        // Cores fixas da marca (não mudam com o tema)
        glass: "#ffffff", // branco fixo para efeitos sobre o navy
        navy: { DEFAULT: "#020c2b", 800: "#071640", 700: "#0c1f52" },
        brand: {
          blue: "#1a8cff",
          cyan: "#14c8ec",
          green: "#2ee88a",
          lime: "#b4f24a",
          violet: "#8b52f6",
        },

        // Tokens semânticos (usados pelos componentes ui/*)
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("surface"), foreground: token("foreground") },
        popover: { DEFAULT: token("surface"), foreground: token("foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("muted"), foreground: token("foreground") },
        secondary: { DEFAULT: token("muted"), foreground: token("foreground") },
        primary: { DEFAULT: token("primary"), foreground: "rgb(255 255 255 / <alpha-value>)" },
        success: { DEFAULT: token("success"), foreground: "rgb(255 255 255 / <alpha-value>)" },
        warning: { DEFAULT: token("warning"), foreground: "rgb(255 255 255 / <alpha-value>)" },
        destructive: { DEFAULT: token("destructive"), foreground: "rgb(255 255 255 / <alpha-value>)" },
        border: token("border"),
        input: token("border"),
        ring: token("primary"),
      },
      // "bg-white" vira a superfície do tema; "text-white" continua branco.
      backgroundColor: { white: token("surface") },
      gradientColorStops: { white: token("surface") },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        glow: "0 8px 24px -8px rgb(26 140 255 / 0.55)",
        "glow-green": "0 8px 24px -8px rgb(46 232 138 / 0.5)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(90deg, #1a8cff 0%, #14c8ec 50%, #2ee88a 100%)",
        "brand-gradient-text": "linear-gradient(90deg, #14c8ec 0%, #2ee88a 70%, #b4f24a 100%)",
        "navy-gradient": "linear-gradient(160deg, #071640 0%, #020c2b 60%, #04122f 100%)",
      },
    },
  },
  plugins: [],
};
