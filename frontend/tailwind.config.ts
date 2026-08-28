import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#07111f",
        panel: "#0d2134",
        cyanCore: "#19c7f3",
        limeCore: "#a7f131"
      },
      boxShadow: {
        glow: "0 0 32px rgba(25, 199, 243, 0.22)"
      }
    }
  },
  plugins: []
} satisfies Config;
