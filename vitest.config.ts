import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 10_000,
  },
});
