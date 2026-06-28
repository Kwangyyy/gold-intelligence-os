import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // PRD §9 palette: black, dark navy, neon blue, silver, gold
        base: {
          black: "#05070d",
          navy: "#0b1220",
          panel: "#0f1828",
          card: "#121d31",
          border: "#1e2c44",
        },
        neon: "#38bdf8",
        gold: { DEFAULT: "#f5c451", soft: "#fbe6a2", deep: "#d9a23b" },
        royal: { DEFAULT: "#a855f7", soft: "#c084fc", deep: "#7c3aed" },
        silver: "#c7d0dd",
        bull: "#22c55e",
        bear: "#ef4444",
        warn: "#f59e0b",
      },
      boxShadow: {
        glow: "0 0 24px rgba(56, 189, 248, 0.18)",
        goldglow: "0 0 24px rgba(245, 196, 81, 0.18)",
        royalglow: "0 0 32px rgba(168, 85, 247, 0.22)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
