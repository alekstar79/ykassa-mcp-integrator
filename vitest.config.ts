import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['./apps/api/vitest.config.ts', './apps/web/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/api',
      include: [
        'apps/api/src/allowlist.ts',
        'apps/api/src/risky.ts',
        'apps/api/src/sanitize.ts',
        'apps/api/src/sse-parser.ts',
        'apps/api/src/prompts.ts',
        'apps/api/src/config.ts',
        'apps/api/src/http.ts',
        'apps/api/src/audit.ts',
        'apps/api/src/routes/ask.ts',
        'apps/api/src/routes/approve.ts',
      ],
      exclude: ['apps/api/tests/**/*.test.ts'],
    },
  },
});
