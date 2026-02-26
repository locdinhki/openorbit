import type { PlatformStatus } from '@openorbit/core/types'

interface LiveViewGalleryProps {
  framesByPlatform: Record<string, string>
  platforms: PlatformStatus[]
  streamingPlatforms: string[]
  onSelectPlatform: (platform: string) => void
}

export default function LiveViewGallery({
  framesByPlatform,
  platforms,
  streamingPlatforms,
  onSelectPlatform
}: LiveViewGalleryProps): React.JSX.Element {
  if (streamingPlatforms.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)]">
        <p className="text-sm">No active sessions — start automation to see live views</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full p-6 bg-[var(--cos-bg-primary)]">
      <div className="grid grid-cols-2 gap-4 max-w-4xl w-full">
        {streamingPlatforms.map((platform) => {
          const frame = framesByPlatform[platform]
          const status = platforms.find((p) => p.platform === platform)

          return (
            <button
              key={platform}
              onClick={() => onSelectPlatform(platform)}
              className="group relative rounded-lg border border-[var(--cos-border)] bg-black overflow-hidden cursor-pointer transition-all hover:border-[var(--cos-accent)] hover:ring-1 hover:ring-[var(--cos-accent)]/30 text-left"
            >
              {/* Thumbnail */}
              <div className="aspect-video relative">
                {frame ? (
                  <img
                    src={`data:image/jpeg;base64,${frame}`}
                    alt={`${platform} live view`}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)]">
                    <p className="text-xs">Waiting for frames...</p>
                  </div>
                )}

                {/* Running indicator */}
                {status?.state === 'running' && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-[#22c55e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                    Live
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="px-3 py-2 bg-[var(--cos-bg-secondary)] border-t border-[var(--cos-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--cos-text-primary)] capitalize">
                    {platform}
                  </span>
                  {status && (
                    <span className="text-[10px] text-[var(--cos-text-muted)]">
                      {status.jobsExtracted} jobs
                    </span>
                  )}
                </div>
                {status?.currentAction && (
                  <p className="text-[11px] text-[var(--cos-text-muted)] truncate mt-0.5">
                    {status.currentAction}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
