import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        cream: "#EFECE3",
        "blue-light": "#8FABD4",
        "blue-mid": "#4A70A9",
        space: {
          900: "#050810",
          800: "#080f1a",
          700: "#0d1829",
        },
        ink: "#EFECE3",
        deep: "#8FABD4",
        mist: "#080f1a",
        mint: "#4A70A9",
        coral: "#8FABD4",
      },
      boxShadow: {
        soft: "0 12px 35px rgba(5, 8, 16, 0.6)",
        glow: "0 0 0 1px rgba(74, 112, 169, 0.35), 0 20px 40px rgba(74, 112, 169, 0.25)",
        "glow-blue": "0 0 30px rgba(74, 112, 169, 0.6)",
        "glow-blue-lg": "0 0 60px rgba(74, 112, 169, 0.4)",
        "glow-cream": "0 0 30px rgba(239, 236, 227, 0.3)",
        "glow-light": "0 0 20px rgba(143, 171, 212, 0.5)",
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 12% 18%, rgba(74,112,169,0.22), transparent 38%), radial-gradient(circle at 82% 8%, rgba(143,171,212,0.2), transparent 30%), radial-gradient(circle at 50% 82%, rgba(13,24,41,0.75), transparent 55%)",
        "nebula-radial": "radial-gradient(circle, rgba(74,112,169,0.25) 0%, rgba(5,8,16,0) 65%)",
        "circuit-grid": "linear-gradient(to right, rgba(143,171,212,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(143,171,212,0.09) 1px, transparent 1px)",
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        rise: "rise 0.5s ease-out",
        twinkle: "twinkle 3s ease-in-out infinite",
        "pulse-slow": "pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin-slow 20s linear infinite",
        "gradient-x": "gradient-x 8s ease infinite",
        scanline: "scanline 4s linear infinite",
        glitch: "glitch 8s ease-in-out infinite",
        orbit: "orbit 14s linear infinite",
        "pulse-ring": "pulse-ring 3.4s ease-out infinite",
        "float-y": "float-y 10s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.3", transform: "scale(0.8)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.75", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        glitch: {
          "0%, 100%": {
            transform: "translate(0)",
            textShadow: "0 0 0 rgba(74,112,169,0), 0 0 0 rgba(143,171,212,0)",
          },
          "20%": {
            transform: "translate(-2px, 1px)",
            textShadow: "2px 0 0 rgba(74,112,169,0.7), -2px 0 0 rgba(143,171,212,0.6)",
          },
          "40%": {
            transform: "translate(2px, -1px)",
            textShadow: "-2px 0 0 rgba(74,112,169,0.7), 2px 0 0 rgba(143,171,212,0.6)",
          },
          "60%": { transform: "translate(-1px, 2px)" },
          "80%": { transform: "translate(1px, -2px)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-20px) rotate(2deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
