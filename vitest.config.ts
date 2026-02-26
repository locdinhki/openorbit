import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          root: './src/main',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src')
          }
        }
      },
      {
        test: {
          name: 'core',
          root: './packages/core/src',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'renderer',
          root: './src/renderer',
          environment: 'jsdom',
          include: ['**/__tests__/**/*.test.ts?(x)'],
          alias: {
            '@renderer': resolve(__dirname, 'src/renderer/src'),
            '@openorbit/core': resolve(__dirname, 'packages/core/src')
          }
        }
      },
      {
        test: {
          name: 'cli',
          root: './packages/cli/src',
          environment: 'node',
          include: ['__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src')
          }
        }
      },
      {
        test: {
          name: 'extension',
          root: './extension',
          environment: 'node',
          include: ['__tests__/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'ext-ai-claude-sdk',
          root: './packages/extensions/ext-ai-claude-sdk/src',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src')
          }
        }
      },
      {
        test: {
          name: 'ext-jobs',
          root: './packages/extensions/ext-jobs/src',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src')
          }
        }
      },
      {
        test: {
          name: 'ext-telegram',
          root: './packages/extensions/ext-telegram/src',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src'),
            '@openorbit/ext-jobs': resolve(__dirname, 'packages/extensions/ext-jobs/src')
          }
        }
      },
      {
        test: {
          name: 'ext-imessage',
          root: './packages/extensions/ext-imessage/src',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src'),
            '@openorbit/ext-jobs': resolve(__dirname, 'packages/extensions/ext-jobs/src')
          }
        }
      },
      {
        test: {
          name: 'ext-db-viewer',
          root: './packages/extensions/ext-db-viewer/src',
          environment: 'node',
          include: ['**/__tests__/**/*.test.ts'],
          alias: {
            '@openorbit/core': resolve(__dirname, 'packages/core/src')
          }
        }
      }
    ]
  }
})
