import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['projects/zero-angular/src/**/*.spec.ts'],
    setupFiles: ['./test-setup.ts'],
  },
});
