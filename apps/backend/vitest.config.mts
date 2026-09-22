import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// swc rather than esbuild: Nest's DI needs emitDecoratorMetadata, which esbuild cannot produce.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: { transform: { decoratorMetadata: true, legacyDecorator: true }, target: 'es2022' },
    }),
  ],
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: 'default',
  },
});
