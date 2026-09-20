import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#2563eb", hover: "#1d4ed8" },
        accent: { DEFAULT: "#9333ea", hover: "#7e22ce" },
        danger: { DEFAULT: "#dc2626", hover: "#b91c1c" },
        success: { DEFAULT: "#16a34a", hover: "#15803d" },
      },
      borderRadius: {
        DEFAULT: "0.25rem",
      },
      keyframes: {
        "pulse-glow": {
          "0%": { boxShadow: "0 0 0 0 rgba(176, 23, 108, 0)" },
          "25%": { boxShadow: "0 0 20px 4px rgba(176, 23, 108, 0.35)" },
          "55%": { boxShadow: "0 0 20px 4px rgba(176, 23, 108, 0.35)" },
          "100%": { boxShadow: "0 0 0 0 rgba(176, 23, 108, 0)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
