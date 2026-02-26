interface LiveViewCanvasProps {
  frameData: string | null
  stale?: boolean
  platform?: string
  onBack?: () => void
}

export default function LiveViewCanvas({
  frameData,
  stale,
  platform,
  onBack
}: LiveViewCanvasProps): React.JSX.Element {
  if (!frameData) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)]">
        <p className="text-sm">Waiting for first frame...</p>
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center h-full bg-black overflow-hidden">
      <img
        src={`data:image/jpeg;base64,${frameData}`}
        alt="Live browser view"
        className="max-w-full max-h-full object-contain"
        draggable={false}
      />

      {/* Top-left: back button + platform label */}
      {(onBack || platform) && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-[var(--cos-text-secondary)] text-xs hover:bg-black/90 transition-colors cursor-pointer"
            >
              <span className="text-sm leading-none">&larr;</span>
              All sessions
            </button>
          )}
          {platform && (
            <span className="px-2 py-1 rounded-full bg-black/70 text-[var(--cos-text-secondary)] text-xs capitalize">
              {platform}
            </span>
          )}
        </div>
      )}

      {/* Stale indicator */}
      {stale && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 text-[var(--cos-text-muted)] text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ca8a04]" />
          Stream idle — no visual changes
        </div>
      )}
    </div>
  )
}
