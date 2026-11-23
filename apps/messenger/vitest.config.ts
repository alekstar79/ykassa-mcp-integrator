import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'messenger',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
