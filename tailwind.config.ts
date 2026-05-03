import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./screens/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "Inter", "sans-serif"],
        manrope: ["var(--font-manrope)", "Manrope", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#00665E",
          dark: "#004D46",
          light: "#E6F2F1",
        },
        navy: {
          DEFAULT: "#0F172A",
        },
        teal: {
          DEFAULT: "#0D9488",
        },
        surface: "#F7F9FB",
        error: "#BA1A1A",
        tooth: {
          healthy: "#FFFFFF",
          treated: "#3B82F6",
          caries: "#EF4444",
          removed: "#9CA3AF",
          crown: "#F59E0B",
          implant: "#8B5CF6",
        },
      },
      borderRadius: {
        card: "12px",
        "card-lg": "16px",
        btn: "4px",
        tooth: "2px",
      },
      maxWidth: {
        mobile: "390px",
      },
    },
  },
  plugins: [],
};

export default config;
