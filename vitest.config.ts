import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Test-only config; kept separate from vite.config.ts so the app build is untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
