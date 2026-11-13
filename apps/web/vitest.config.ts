import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/web',
      include: ['src/composables/**/*.ts'],
      exclude: ['tests/**/*.test.ts'],
    },
  },
});
