import { useEffect, useState } from 'react'
import ShellLayout from './components/Shell/ShellLayout'
import { useShellStore } from './store/shell-store'
import { loadRendererExtension, registerShellView } from './lib/extension-renderer'
import ExtensionsPanel from './components/Shell/views/ExtensionsPanel'
import AutomationsPanel from './components/Shell/views/AutomationsPanel'
import type { ExtensionManifest, ExtensionRendererAPI } from '@openorbit/core/extensions/types'
import { IPC } from '@openorbit/core/ipc-channels'

// Built-in extension renderer modules (statically imported so Vite bundles them)
import extAiClaudeRenderer from '@openorbit/ext-ai-claude/renderer/index'
import extJobsRenderer from '@openorbit/ext-jobs/renderer/index'
import extDbViewerRenderer from '@openorbit/ext-db-viewer/renderer/index'

const rendererModules = new Map<string, ExtensionRendererAPI>([
  ['ext-ai-claude', extAiClaudeRenderer],
  ['ext-jobs', extJobsRenderer],
  ['ext-db-viewer', extDbViewerRenderer]
])

function App(): React.JSX.Element {
  const setExtensions = useShellStore((s) => s.setExtensions)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      // Register shell-level views before extensions load
      registerShellView('shell-extensions', ExtensionsPanel as never)
      registerShellView('shell-automations', AutomationsPanel as never)

      // Fetch discovered extension manifests from the main process
      const manifests = (await window.api.invoke(IPC.SHELL_EXTENSIONS)) as ExtensionManifest[]

      // Activate renderer-side extensions
      for (const manifest of manifests) {
        const mod = rendererModules.get(manifest.id)
        if (mod) {
          await loadRendererExtension(manifest, mod)
        }
      }

      // Push manifests into shell store (sets default active views)
      setExtensions(manifests)
      setReady(true)
    }

    bootstrap()
  }, [setExtensions])

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--cos-bg-primary)]">
        <div className="text-[var(--cos-text-secondary)] text-sm">Loading extensions...</div>
      </div>
    )
  }

  return <ShellLayout />
}

export default App
