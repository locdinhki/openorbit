// ============================================================================
// OpenOrbit — Skills Panel (Codex-style catalog grid)
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import type { SkillCategory } from '@openorbit/core/skills/skill-types'
import type { CatalogListItem } from '@openorbit/core/skills/skill-catalog'
import { ipc } from '../../../lib/ipc-client'
import SvgIcon from '../../shared/SvgIcon'
import SkillCard from './SkillCard'
import CreateSkillModal from './CreateSkillModal'
import type { SkillFormData } from './CreateSkillModal'

// ---------------------------------------------------------------------------
// Category tabs
// ---------------------------------------------------------------------------

type TabKey = 'all' | SkillCategory

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'document', label: 'Document' },
  { key: 'data', label: 'Data' },
  { key: 'media', label: 'Media' },
  { key: 'communication', label: 'Communication' },
  { key: 'utility', label: 'Utility' }
]

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function SkillsPanel(): React.JSX.Element {
  const [skills, setSkills] = useState<CatalogListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editData, setEditData] = useState<SkillFormData | null>(null)

  const loadSkills = useCallback(async () => {
    const res = await ipc.skillCatalog.list()
    if (res.success && res.data) {
      setSkills(res.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ipc.skillCatalog.list().then((res) => {
      if (res.success && res.data) setSkills(res.data)
      setLoading(false)
    })
  }, [])

  const handleInstall = useCallback(async (id: string) => {
    // Optimistic update
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, isInstalled: true } : s)))
    await ipc.skillCatalog.install(id)
  }, [])

  const handleUninstall = useCallback(async (id: string) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, isInstalled: false } : s)))
    await ipc.skillCatalog.uninstall(id)
  }, [])

  const handleCreate = useCallback(
    async (data: SkillFormData) => {
      if (data.id) {
        // Editing existing custom skill
        await ipc.skillCatalog.updateCustom({
          id: data.id,
          displayName: data.displayName,
          description: data.description,
          category: data.category,
          content: data.content
        })
      } else {
        await ipc.skillCatalog.createCustom({
          displayName: data.displayName,
          description: data.description,
          category: data.category,
          content: data.content
        })
      }
      setModalOpen(false)
      setEditData(null)
      await loadSkills()
    },
    [loadSkills]
  )

  const handleEdit = useCallback(
    (id: string) => {
      const skill = skills.find((s) => s.id === id)
      if (!skill || !skill.isCustom) return
      setEditData({
        id: skill.id,
        displayName: skill.displayName,
        description: skill.description,
        category: skill.category,
        content: ''
      })
      setModalOpen(true)
    },
    [skills]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await ipc.skillCatalog.deleteCustom(id)
      await loadSkills()
    },
    [loadSkills]
  )

  // Filter skills by tab + search
  const filtered = skills.filter((s) => {
    if (activeTab !== 'all' && s.category !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      return s.displayName.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--cos-border)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
            Skills
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSkills}
              title="Refresh"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-secondary)] transition-colors"
            >
              <SvgIcon name="shuffle" size={14} />
            </button>
            <button
              onClick={() => {
                setEditData(null)
                setModalOpen(true)
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-[var(--cos-accent)] text-white hover:bg-[var(--cos-accent-hover)] transition-colors"
            >
              <SvgIcon name="plus" size={12} />
              New Skill
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="w-full px-3 py-1.5 text-xs rounded-md bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500/50"
        />

        {/* Category tabs */}
        <div className="flex items-center gap-1 -mb-3 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-t-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)] border border-[var(--cos-border)] border-b-transparent -mb-px'
                  : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[var(--cos-text-muted)]">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="text-[var(--cos-text-muted)] mb-2 flex justify-center">
                <SvgIcon name="sparkles" size={28} />
              </div>
              <p className="text-sm text-[var(--cos-text-muted)]">
                {search ? 'No skills match your search' : 'No skills in this category'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onEdit={skill.isCustom ? handleEdit : undefined}
                onDelete={skill.isCustom ? handleDelete : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <CreateSkillModal
        open={modalOpen}
        editData={editData}
        onSave={handleCreate}
        onClose={() => {
          setModalOpen(false)
          setEditData(null)
        }}
      />
    </div>
  )
}
