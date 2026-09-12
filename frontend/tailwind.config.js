/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D1113",
        surface: "#161B1E",
        surface2: "#1D2327",
        borderc: "#262E33",
        text: "#EDF1F2",
        muted: "#7C8A90",
        amber: "#E8A33D",
        violation: "#E4483E",
        clear: "#3FB87F",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      keyframes: {
        pulseOnce: {
          "0%": { boxShadow: "0 0 0 0 rgba(228, 72, 62, 0.5)" },
          "100%": { boxShadow: "0 0 0 8px rgba(228, 72, 62, 0)" },
        },
      },
      animation: {
        "pulse-once": "pulseOnce 0.6s ease-out 1",
      },
    },
  },
  plugins: [],
};
