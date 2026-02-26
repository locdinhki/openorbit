import { useState, useEffect } from 'react'
import { ipc } from '@renderer/lib/ipc-client'
import Button from '@renderer/components/shared/Button'

interface ResumeEntry {
  name: string
  path: string
  isDefault: boolean
  addedAt: string
}

export default function Resumes(): React.JSX.Element {
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadResumes(): Promise<void> {
      const result = await ipc.settings.get('resumes')
      if (result.success && result.data) {
        try {
          setResumes(JSON.parse(result.data) as ResumeEntry[])
        } catch {
          // ignore
        }
      }
    }
    loadResumes()
  }, [])

  const saveResumes = async (updated: ResumeEntry[]): Promise<void> => {
    setLoading(true)
    await ipc.settings.update('resumes', JSON.stringify(updated))
    setResumes(updated)
    setLoading(false)
  }

  const handleAdd = (): void => {
    // In a real implementation, this would use Electron's dialog.showOpenDialog
    // For now, prompt for a path
    const path = prompt('Enter resume file path:')
    if (!path) return

    const name = path.split('/').pop() || path
    const entry: ResumeEntry = {
      name,
      path,
      isDefault: resumes.length === 0,
      addedAt: new Date().toISOString()
    }
    saveResumes([...resumes, entry])
  }

  const handleRemove = (index: number): void => {
    const updated = resumes.filter((_, i) => i !== index)
    // If we removed the default, make the first one default
    if (updated.length > 0 && !updated.some((r) => r.isDefault)) {
      updated[0].isDefault = true
    }
    saveResumes(updated)
  }

  const handleSetDefault = (index: number): void => {
    const updated = resumes.map((r, i) => ({ ...r, isDefault: i === index }))
    saveResumes(updated)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-1">Resumes</h3>
        <p className="text-xs text-[var(--cos-text-muted)]">
          Manage your resume files for job applications.
        </p>
      </div>

      {resumes.length > 0 ? (
        <div className="space-y-2">
          {resumes.map((resume, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-[var(--cos-text-primary)] truncate">
                  {resume.name}
                </span>
                {resume.isDefault && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 font-medium shrink-0">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!resume.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(index)}>
                    Set Default
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => handleRemove(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-[var(--cos-bg-tertiary)] rounded-md border border-[var(--cos-border)]">
          <p className="text-sm text-[var(--cos-text-muted)]">No resumes uploaded</p>
          <p className="text-xs text-[var(--cos-text-muted)] mt-1">
            Add a resume to use in applications
          </p>
        </div>
      )}

      <Button variant="secondary" size="md" onClick={handleAdd} disabled={loading}>
        Add Resume
      </Button>
    </div>
  )
}
