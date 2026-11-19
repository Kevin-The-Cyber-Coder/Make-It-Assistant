import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const alias = Object.fromEntries(
  [
    'shared',
    'database',
    'ai-gateway',
    'agents',
    'project-intelligence',
    'security-engine',
    'dev-engine',
    'github-integration',
  ].map((name) => [
    `@make-it-ai/${name}`,
    resolve(__dirname, `packages/${name}/src`),
  ]),
);
alias['@'] = resolve(__dirname, 'apps/web/src');

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    include: [
      'packages/*/tests/**/*.test.ts',
      'apps/api/tests/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      'apps/web/src/**/*.test.tsx',
    ],
    globals: true,
    coverage: { reporter: ['text', 'html'], reportsDirectory: 'coverage' },
  },
});
