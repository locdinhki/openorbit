import { useEffect, useState } from 'react'
import ShellLayout from './components/Shell/ShellLayout'
import { useShellStore } from './store/shell-store'
import { loadRendererExtension, registerShellView } from './lib/extension-renderer'
import ExtensionsPanel from './components/Shell/views/ExtensionsPanel'
import AutomationsPanel from './components/Shell/views/AutomationsPanel'
import SkillsPanel from './components/Shell/views/SkillsPanel'
import type { ExtensionManifest, ExtensionRendererAPI } from '@openorbit/core/extensions/types'
import { IPC } from '@openorbit/core/ipc-channels'

// Built-in extension renderer modules (statically imported so Vite bundles them)
import extAiClaudeRenderer from '@openorbit/ext-ai-claude/renderer/index'
import extJobsRenderer from '@openorbit/ext-jobs/renderer/index'
import extDbViewerRenderer from '@openorbit/ext-db-viewer/renderer/index'
import extZillowRenderer from '@openorbit/ext-zillow/renderer/index'
import extGhlRenderer from '@openorbit/ext-ghl/renderer/index'

const rendererModules = new Map<string, ExtensionRendererAPI>([
  ['ext-ai-claude', extAiClaudeRenderer],
  ['ext-jobs', extJobsRenderer],
  ['ext-db-viewer', extDbViewerRenderer],
  ['ext-zillow', extZillowRenderer],
  ['ext-ghl', extGhlRenderer]
])

function App(): React.JSX.Element {
  const setExtensions = useShellStore((s) => s.setExtensions)
  const loadLayoutSizes = useShellStore((s) => s.loadLayoutSizes)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      // Register shell-level views before extensions load
      registerShellView('shell-extensions', ExtensionsPanel as never)
      registerShellView('shell-automations', AutomationsPanel as never)
      registerShellView('shell-skills', SkillsPanel as never)

      // Fetch discovered extension manifests and enabled state from the main process
      const { manifests, enabledMap } = (await window.api.invoke(IPC.SHELL_EXTENSIONS)) as {
        manifests: ExtensionManifest[]
        enabledMap: Record<string, boolean>
      }

      // Activate renderer-side extensions (only enabled ones)
      for (const manifest of manifests) {
        if (enabledMap[manifest.id] === false) continue
        const mod = rendererModules.get(manifest.id)
        if (mod) {
          await loadRendererExtension(manifest, mod)
        }
      }

      // Hydrate persisted layout sizes before setting extensions
      try {
        const sizesResult = (await window.api.invoke(IPC.SETTINGS_GET, {
          key: 'ui.layout-sizes'
        })) as { success?: boolean; data?: string }
        if (sizesResult?.success && sizesResult.data) {
          loadLayoutSizes(JSON.parse(sizesResult.data))
        }
      } catch {
        // Ignore — use defaults
      }

      // Push manifests into shell store (sets default active views)
      setExtensions(manifests, enabledMap)
      setReady(true)
    }

    bootstrap()
  }, [setExtensions, loadLayoutSizes])

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
