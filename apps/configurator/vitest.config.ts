import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'configurator',
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/configurator',
      include: ['src/composables/**/*.ts', 'src/export/**/*.ts', 'src/components/PreviewPanel.vue'],
      exclude: ['tests/**/*.test.ts'],
    },
  },
});
