// ============================================================================
// OpenOrbit — Resize Handle (VS Code-style drag divider)
// ============================================================================

import { useRef, useCallback } from 'react'

interface ResizeHandleProps {
  /** Called continuously during drag with the horizontal pixel delta since last frame. */
  onResize: (delta: number) => void
}

export default function ResizeHandle({ onResize }: ResizeHandleProps): React.JSX.Element {
  const lastX = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      lastX.current = e.clientX

      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      target.dataset.dragging = '1'

      const onMove = (ev: PointerEvent): void => {
        const delta = ev.clientX - lastX.current
        lastX.current = ev.clientX
        if (delta !== 0) onResize(delta)
      }

      const onUp = (): void => {
        target.releasePointerCapture(e.pointerId)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        delete target.dataset.dragging
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
      }

      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
    },
    [onResize]
  )

  return (
    <div
      onPointerDown={handlePointerDown}
      className="w-1 flex-shrink-0 cursor-col-resize hover:bg-indigo-500/40 data-[dragging]:bg-indigo-500/60 transition-colors"
    />
  )
}
