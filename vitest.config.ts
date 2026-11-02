// Cấu hình test riêng (không dùng vite.config.ts để khỏi chạy plugin PWA / proxy Gemini khi test)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'api/**/*.test.js'],
    environment: 'node',
  },
});
