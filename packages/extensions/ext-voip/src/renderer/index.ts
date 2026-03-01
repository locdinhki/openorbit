// ============================================================================
// ext-voip — Renderer Process Entry Point
// ============================================================================

import type { ExtensionRendererAPI } from '@openorbit/core/extensions/types'

const extension: ExtensionRendererAPI = {
  contributes: {
    sidebar: {
      'voip-sidebar': {
        component: 'VoipSidebar',
        props: {}
      }
    }
  }
}

export default extension
