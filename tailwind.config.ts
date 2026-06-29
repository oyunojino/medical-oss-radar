import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F7F9",
        panel: "#FFFFFF",
        ink: "#11181F",
        muted: "#5B6672",
        line: "#DCE1E6",
        vital: "#0F9D8C",
        "vital-soft": "#E7F4F1",
        amber: "#C98A1D",
        "amber-soft": "#FBF1E1",
        coral: "#C4453B",
        "coral-soft": "#FAEAE8",
      },
      fontFamily: {
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tagcode: "0.12em",
      },
    },
  },
  plugins: [],
};

export default config;
