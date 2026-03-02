import { useState, useEffect } from 'react'
import { ipc } from '@renderer/lib/ipc-client'
import { ipc as extJobsIpc } from '../../lib/ipc-client'
import Button from '@renderer/components/shared/Button'
import type { ResumeAnalysis } from '../../../main/db/resume-analysis-repo'

interface ResumeEntry {
  name: string
  path: string
  isDefault: boolean
  addedAt: string
}

export default function Resumes(): React.JSX.Element {
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [analyses, setAnalyses] = useState<Map<string, ResumeAnalysis>>(new Map())
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load(): Promise<void> {
      const [resumeResult, analysisResult] = await Promise.all([
        ipc.settings.get('resumes'),
        extJobsIpc.resumeAnalysis.list()
      ])
      if (resumeResult.success && resumeResult.data) {
        try {
          setResumes(JSON.parse(resumeResult.data) as ResumeEntry[])
        } catch {
          // ignore
        }
      }
      if (analysisResult.success && analysisResult.data) {
        const map = new Map<string, ResumeAnalysis>()
        for (const a of analysisResult.data) {
          map.set(a.resumeName, a)
        }
        setAnalyses(map)
      }
    }
    load()
  }, [])

  const saveResumes = async (updated: ResumeEntry[]): Promise<void> => {
    setLoading(true)
    await ipc.settings.update('resumes', JSON.stringify(updated))
    setResumes(updated)
    setLoading(false)
  }

  const analyzeResume = async (name: string, path: string): Promise<void> => {
    setAnalyzing((prev) => new Set(prev).add(name))
    try {
      const result = await extJobsIpc.resumeAnalysis.analyze(name, path)
      if (result.success && result.data) {
        setAnalyses((prev) => new Map(prev).set(name, result.data!))
      }
    } catch {
      // non-fatal
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  const handleAdd = async (): Promise<void> => {
    const result = await ipc.dialog.openFile({
      title: 'Select Resume',
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.success || !result.data || result.data.length === 0) return

    const sourcePath = result.data[0]
    const copyResult = await ipc.fs.copyToData(sourcePath, 'resumes')
    if (!copyResult.success || !copyResult.data) return

    const storedPath = copyResult.data
    const name = storedPath.split('/').pop() || storedPath
    const entry: ResumeEntry = {
      name,
      path: storedPath,
      isDefault: resumes.length === 0,
      addedAt: new Date().toISOString()
    }
    await saveResumes([...resumes, entry])

    // Trigger AI analysis immediately after upload
    analyzeResume(name, storedPath)
  }

  const handleRemove = async (index: number): Promise<void> => {
    const removed = resumes[index]
    const updated = resumes.filter((_, i) => i !== index)
    if (updated.length > 0 && !updated.some((r) => r.isDefault)) {
      updated[0].isDefault = true
    }
    await saveResumes(updated)
    // Clean up analysis from DB
    await extJobsIpc.resumeAnalysis.delete(removed.name)
    setAnalyses((prev) => {
      const next = new Map(prev)
      next.delete(removed.name)
      return next
    })
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
          Resumes are analyzed by AI to understand your skills and experience. The AI uses this
          during job matching and applications.
        </p>
      </div>

      {resumes.length > 0 ? (
        <div className="space-y-2">
          {resumes.map((resume, index) => {
            const analysis = analyses.get(resume.name)
            const isAnalyzing = analyzing.has(resume.name)
            return (
              <div
                key={index}
                className="p-2.5 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-[var(--cos-text-primary)] truncate">
                      {resume.name}
                    </span>
                    {resume.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 font-medium shrink-0">
                        Default
                      </span>
                    )}
                    {isAnalyzing ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 font-medium shrink-0 animate-pulse">
                        Analyzing…
                      </span>
                    ) : analysis ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400 font-medium shrink-0">
                        {analysis.analysis.skills.length} skills
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--cos-border)] text-[var(--cos-text-muted)] font-medium shrink-0">
                        Not analyzed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => analyzeResume(resume.name, resume.path)}
                      disabled={isAnalyzing}
                    >
                      {analysis ? 'Re-analyze' : 'Analyze'}
                    </Button>
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
                {analysis && !isAnalyzing && (
                  <p className="text-[11px] text-[var(--cos-text-muted)] mt-1.5 leading-relaxed">
                    {analysis.analysis.seniorityLevel} · {analysis.analysis.yearsOfExperience}y exp
                    {analysis.analysis.targetRoles.length > 0 &&
                      ` · ${analysis.analysis.targetRoles.slice(0, 2).join(', ')}`}
                  </p>
                )}
              </div>
            )
          })}
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
