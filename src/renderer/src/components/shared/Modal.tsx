import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  className = ''
}: ModalProps): React.JSX.Element | null {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className={`bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg shadow-xl max-w-lg w-full mx-4 animate-slide-up ${className}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cos-border)]">
          <h2 className="text-sm font-semibold text-[var(--cos-text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
