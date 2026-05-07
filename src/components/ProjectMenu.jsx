import { useEffect, useRef, useState } from 'react'
import {
  Save, FolderOpen, Plus, Trash2, Download, Upload, Edit3, Check,
} from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * Save button in the top bar. Single click opens a popover with:
 *   - Inline project-name edit
 *   - Save (overwrite the loaded project) / Save as new
 *   - Recent projects list (load / delete each)
 *   - New project (clears state)
 *   - Download / Open from file
 *
 * Auto-save runs in the background regardless of this menu, so the user
 * can ignore it entirely if they want.
 */
export default function ProjectMenu({
  projectName, onRenameProject,
  onSave,            // overwrite current named project (or save as new if none)
  onSaveAsNew,       // always create a new entry (prompts for name)
  onNewProject,
  onLoadProject,
  onDeleteProject,
  onDownload,
  onOpenFile,
  recentProjects = [],
  hasUnsavedChanges = true,
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const ref = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { setDraftName(projectName) }, [projectName])

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const commitName = () => {
    const trimmed = (draftName || '').trim() || 'Untitled'
    onRenameProject?.(trimmed)
    setEditing(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="chip px-3 py-1.5 flex items-center gap-2 text-[12px] hover:bg-[#33334d]"
      >
        <Save className="w-3 h-3 text-ink-secondary" />
        <span style={{ color: 'var(--text-2)' }} className="hidden lg:inline">
          {hasUnsavedChanges ? 'Save' : 'Saved'}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 surface shadow-2xl"
          style={{ width: 320 }}
        >
          {/* Project name */}
          <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--line-soft)' }}>
            <div className="text-[10px] mono mb-1" style={{ color: 'var(--text-3)' }}>
              CURRENT PROJECT
            </div>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName()
                    if (e.key === 'Escape') { setDraftName(projectName); setEditing(false) }
                  }}
                  className="flex-1 bg-[#1a1a2e] border border-[#3a3a55] rounded px-2 py-1 text-[12px] focus:outline-none focus:border-accent-pink/50"
                  placeholder="Project name"
                />
                <button
                  onClick={commitName}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#33334d]"
                  aria-label="Save name"
                >
                  <Check className="w-3 h-3 text-accent-teal" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full flex items-center gap-2 hover:opacity-90 text-left"
              >
                <span className="text-[13px] font-medium flex-1 truncate">{projectName}</span>
                <Edit3 className="w-3 h-3 text-ink-secondary shrink-0" />
              </button>
            )}
            <div className="text-[10px] mt-1 mono" style={{ color: hasUnsavedChanges ? '#f5a524' : '#4ecdc4' }}>
              {hasUnsavedChanges ? 'Auto-saving draft…' : 'Saved'}
            </div>
          </div>

          {/* Save actions */}
          <div className="p-1.5">
            <MenuItem
              icon={<Save className="w-3.5 h-3.5" />}
              label="Save"
              hint="Update this project"
              onClick={() => { onSave?.(); setOpen(false) }}
            />
            <MenuItem
              icon={<Plus className="w-3.5 h-3.5" />}
              label="Save as new"
              hint="Create a copy"
              onClick={() => { onSaveAsNew?.(); setOpen(false) }}
            />
          </div>

          {/* Recent projects */}
          <div className="border-t" style={{ borderColor: 'var(--line-soft)' }}>
            <div
              className="px-3 pt-2.5 pb-1 text-[10px] mono flex items-center gap-1.5"
              style={{ color: 'var(--text-3)' }}
            >
              <FolderOpen className="w-3 h-3" /> RECENT PROJECTS
            </div>
            {recentProjects.length === 0 ? (
              <div className="px-3 pb-2.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
                No saved projects yet.
              </div>
            ) : (
              <div className="px-1 pb-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
                {recentProjects.map(p => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-[#33334d]"
                  >
                    <button
                      onClick={() => { onLoadProject?.(p.id); setOpen(false) }}
                      className="flex-1 flex flex-col items-start min-w-0 text-left"
                    >
                      <span className="text-[12px] truncate w-full">{p.name}</span>
                      <span className="text-[9px] mono" style={{ color: 'var(--text-3)' }}>
                        {formatRelative(p.savedAt)}
                      </span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteProject?.(p.id) }}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center hover:bg-[#ff6b9d]/10"
                      aria-label="Delete project"
                    >
                      <Trash2 className="w-3 h-3 text-ink-secondary" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File / new */}
          <div className="border-t p-1.5" style={{ borderColor: 'var(--line-soft)' }}>
            <MenuItem
              icon={<Plus className="w-3.5 h-3.5" />}
              label="New project"
              hint="Start with a blank sketch"
              onClick={() => { onNewProject?.(); setOpen(false) }}
            />
            <MenuItem
              icon={<Download className="w-3.5 h-3.5" />}
              label="Download as file"
              hint=".chordflow.json — for backup or another device"
              onClick={() => { onDownload?.(); setOpen(false) }}
            />
            <MenuItem
              icon={<Upload className="w-3.5 h-3.5" />}
              label="Open from file"
              hint=".chordflow.json"
              onClick={() => fileRef.current?.click()}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onOpenFile?.(f)
                e.target.value = ''
                setOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-[#33334d] text-left"
    >
      <span className="text-ink-secondary">{icon}</span>
      <span className="flex-1 min-w-0">
        <div className="text-[12px] font-medium">{label}</div>
        {hint && (
          <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{hint}</div>
        )}
      </span>
    </button>
  )
}

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24)   return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 7)     return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
