import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f6f2ea",
        ink: "#1f1a17",
        card: "#fffdf8",
        accent: "#1c7c54"
      }
    }
  },
  plugins: []
};

export default config;

