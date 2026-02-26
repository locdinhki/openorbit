import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    root: './src',
    include: ['**/__tests__/**/*.test.ts']
  }
})
