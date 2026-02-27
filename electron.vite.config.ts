import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@openorbit/core': resolve('packages/core/src'),
        '@openorbit/ext-ai-claude-sdk': resolve('packages/extensions/ext-ai-claude-sdk/src'),
        '@openorbit/ext-ai-claude': resolve('packages/extensions/ext-ai-claude/src'),
        '@openorbit/ext-ai-openai': resolve('packages/extensions/ext-ai-openai/src'),
        '@openorbit/ext-ai-ollama': resolve('packages/extensions/ext-ai-ollama/src'),
        '@openorbit/ext-ai-lm-studio': resolve('packages/extensions/ext-ai-lm-studio/src'),
        '@openorbit/ext-jobs': resolve('packages/extensions/ext-jobs/src'),
        '@openorbit/ext-telegram': resolve('packages/extensions/ext-telegram/src'),
        '@openorbit/ext-imessage': resolve('packages/extensions/ext-imessage/src'),
        '@openorbit/ext-db-viewer': resolve('packages/extensions/ext-db-viewer/src'),
        '@openorbit/ext-whatsapp': resolve('packages/extensions/ext-whatsapp/src'),
        '@openorbit/ext-discord': resolve('packages/extensions/ext-discord/src'),
        '@openorbit/ext-zillow': resolve('packages/extensions/ext-zillow/src'),
        '@openorbit/ext-ghl': resolve('packages/extensions/ext-ghl/src')
      }
    },
    build: {
      rollupOptions: {
        external: [
          'better-sqlite3',
          'sqlite-vec',
          'ws',
          '@anthropic-ai/claude-agent-sdk',
          '@whiskeysockets/baileys',
          'discord.js'
        ]
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@openorbit/core': resolve('packages/core/src')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@openorbit/core': resolve('packages/core/src'),
        '@openorbit/ext-ai-claude-sdk': resolve('packages/extensions/ext-ai-claude-sdk/src'),
        '@openorbit/ext-ai-claude': resolve('packages/extensions/ext-ai-claude/src'),
        '@openorbit/ext-ai-openai': resolve('packages/extensions/ext-ai-openai/src'),
        '@openorbit/ext-ai-ollama': resolve('packages/extensions/ext-ai-ollama/src'),
        '@openorbit/ext-ai-lm-studio': resolve('packages/extensions/ext-ai-lm-studio/src'),
        '@openorbit/ext-jobs': resolve('packages/extensions/ext-jobs/src'),
        '@openorbit/ext-telegram': resolve('packages/extensions/ext-telegram/src'),
        '@openorbit/ext-imessage': resolve('packages/extensions/ext-imessage/src'),
        '@openorbit/ext-db-viewer': resolve('packages/extensions/ext-db-viewer/src'),
        '@openorbit/ext-whatsapp': resolve('packages/extensions/ext-whatsapp/src'),
        '@openorbit/ext-discord': resolve('packages/extensions/ext-discord/src'),
        '@openorbit/ext-zillow': resolve('packages/extensions/ext-zillow/src'),
        '@openorbit/ext-ghl': resolve('packages/extensions/ext-ghl/src')
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    plugins: [react(), tailwindcss()]
  }
})
