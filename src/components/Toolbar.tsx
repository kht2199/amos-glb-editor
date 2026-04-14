import { Check, Copy, Eye, FileDown, FileUp, Layers3, Move, Redo2, RefreshCcw, RotateCw, Settings2, Trash2, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { EditorMode, ObjectTypeCategory } from '../types'

interface ToolbarProps {
  onOpenFile: () => void
  onImportFile?: () => void
}

const modeButtons: Array<{ id: EditorMode; label: string; icon: typeof Move }> = [
  { id: 'select', label: 'Select', icon: Layers3 },
  { id: 'move', label: 'Move', icon: Move },
]

export function Toolbar({ onOpenFile, onImportFile }: ToolbarProps) {
  const [isTypeSettingsOpen, setIsTypeSettingsOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeCategory, setNewTypeCategory] = useState<ObjectTypeCategory>('background')

  const {
    fileName,
    selectedId,
    lifts,
    ports,
    backgroundObjects,
    appliedLifts,
    appliedPorts,
    appliedBackgroundObjects,
    objectTypeDefinitions,
    mode,
    snapEnabled,
    hasPendingChanges,
    collisionIssues,
    canUndo,
    canRedo,
    setMode,
    setSnapEnabled,
    setPreviewOpen,
    addObjectTypeDefinition,
    removeObjectTypeDefinition,
    rotateLift,
    duplicateSelectedObject,
    exportCurrentGlb,
    applyDraftChanges,
    revertDraftChanges,
    undo,
    redo,
  } = useEditorStore(useShallow((state) => ({
    fileName: state.fileName,
    selectedId: state.selectedId,
    lifts: state.draftLifts,
    ports: state.draftPorts,
    backgroundObjects: state.draftBackgroundObjects,
    appliedLifts: state.appliedLifts,
    appliedPorts: state.appliedPorts,
    appliedBackgroundObjects: state.appliedBackgroundObjects,
    objectTypeDefinitions: state.objectTypeDefinitions,
    mode: state.mode,
    snapEnabled: state.snapEnabled,
    hasPendingChanges: state.hasPendingChanges,
    collisionIssues: state.collisionIssues,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    setMode: state.setMode,
    setSnapEnabled: state.setSnapEnabled,
    setPreviewOpen: state.setPreviewOpen,
    addObjectTypeDefinition: state.addObjectTypeDefinition,
    removeObjectTypeDefinition: state.removeObjectTypeDefinition,
    rotateLift: state.rotateLift,
    duplicateSelectedObject: state.duplicateSelectedObject,
    exportCurrentGlb: state.exportCurrentGlb,
    applyDraftChanges: state.applyDraftChanges,
    revertDraftChanges: state.revertDraftChanges,
    undo: state.undo,
    redo: state.redo,
  })))

  const selectedLift = lifts.find((lift) => lift.editorId === selectedId)
  const disabled = !fileName
  const typeUsage = useMemo(() => {
    const usage = new Map<string, Set<string>>()
    for (const entity of [
      ...lifts,
      ...ports.filter((port) => !port.deleted),
      ...backgroundObjects,
      ...appliedLifts,
      ...appliedPorts.filter((port) => !port.deleted),
      ...appliedBackgroundObjects,
    ]) {
      const entries = usage.get(entity.objectType) ?? new Set<string>()
      entries.add(`${entity.editorId}:${entity.objectType}`)
      usage.set(entity.objectType, entries)
    }
    return new Map([...usage.entries()].map(([typeName, entries]) => [typeName, entries.size]))
  }, [appliedBackgroundObjects, appliedLifts, appliedPorts, backgroundObjects, lifts, ports])

  const handleAddType = () => {
    const trimmed = newTypeName.trim()
    if (!trimmed) return
    addObjectTypeDefinition({ name: trimmed, category: newTypeCategory })
    setNewTypeName('')
    setNewTypeCategory('background')
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 backdrop-blur sm:px-4 sm:py-3">
      <div className="mb-2 flex flex-col gap-2 lg:mb-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">GLB Scene Object Editor</h1>
          <p className="hidden text-xs text-slate-400 sm:block">Top-view scene object editor · React + TypeScript + R3F</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs lg:gap-3">
          <div className="max-w-full rounded-full border border-slate-700 px-2.5 py-1 text-slate-300 sm:px-3">
            {fileName ?? 'No file loaded'} · {hasPendingChanges ? 'Draft pending' : 'Draft synced'}
          </div>
          <div className={cn('rounded-full border px-2.5 py-1 sm:px-3', collisionIssues.length ? 'border-amber-500/40 text-amber-100' : 'border-emerald-500/30 text-emerald-100')}>
            Col {collisionIssues.length}
          </div>
        </div>
      </div>

      <div data-testid="toolbar-action-rail" className="grid grid-cols-2 gap-2 pb-1 lg:flex lg:flex-wrap lg:overflow-visible lg:pb-0">
        <ToolGroup title="File">
          <ToolButton icon={FileUp} onClick={onOpenFile}>Open GLB</ToolButton>
          {fileName ? <ToolButton icon={FileUp} onClick={onImportFile}>Import GLB</ToolButton> : null}
          <ToolButton icon={FileDown} disabled={disabled} onClick={() => void exportCurrentGlb()}>Export GLB</ToolButton>
          <ToolButton icon={Check} disabled={disabled || !hasPendingChanges} onClick={applyDraftChanges}>Apply</ToolButton>
          <ToolButton icon={RefreshCcw} disabled={disabled || !hasPendingChanges} onClick={revertDraftChanges}>Revert</ToolButton>
        </ToolGroup>

        <ToolGroup title="History">
          <ToolButton icon={Undo2} disabled={!canUndo} onClick={undo}>Undo</ToolButton>
          <ToolButton icon={Redo2} disabled={!canRedo} onClick={redo}>Redo</ToolButton>
        </ToolGroup>

        <ToolGroup title="Edit">
          {modeButtons.map((button) => (
            <ToolButton key={button.id} icon={button.icon} active={mode === button.id} disabled={disabled} onClick={() => setMode(button.id)}>
              {button.label}
            </ToolButton>
          ))}
          <ToolButton icon={Copy} disabled={disabled || !selectedId} onClick={duplicateSelectedObject}>Duplicate</ToolButton>
          <ToolButton icon={RotateCw} disabled={!selectedLift} onClick={() => selectedLift && rotateLift(selectedLift.editorId)}>Rotate 90°</ToolButton>
        </ToolGroup>

        <ToolGroup title="View">
          <ToolButton icon={Layers3} disabled={disabled} active={snapEnabled} onClick={() => setSnapEnabled(!snapEnabled)}>Snap {snapEnabled ? 'ON' : 'OFF'}</ToolButton>
          <ToolButton icon={Eye} disabled={disabled} onClick={() => setPreviewOpen(true)}>Expand Preview</ToolButton>
          <ToolButton icon={Settings2} disabled={disabled} active={isTypeSettingsOpen} onClick={() => setIsTypeSettingsOpen((open) => !open)}>Type Settings</ToolButton>
        </ToolGroup>
      </div>

      {isTypeSettingsOpen ? (
        <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex-1 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Type Name</span>
              <input
                aria-label="Type Name"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400"
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                placeholder="e.g. Tool"
              />
            </label>
            <label className="w-full space-y-1.5 lg:max-w-[220px]">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Type Behavior</span>
              <select
                aria-label="Type Behavior"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400"
                value={newTypeCategory}
                onChange={(event) => setNewTypeCategory(event.target.value as ObjectTypeCategory)}
              >
                <option value="background">background</option>
                <option value="lift">lift</option>
                <option value="port">port</option>
              </select>
            </label>
            <ToolButton icon={Check} onClick={handleAddType}>Add Type</ToolButton>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {objectTypeDefinitions.map((definition) => {
              const usageCount = typeUsage.get(definition.name) ?? 0
              const isProtected = definition.name === 'Lift' || definition.name === 'Port' || usageCount > 0
              return (
                <div key={definition.name} className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-2">
                  <button type="button" className="text-sm text-slate-100">
                    {definition.name}
                  </button>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{definition.category}</span>
                  {usageCount > 0 ? <span className="text-[11px] text-slate-500">in use {usageCount}</span> : null}
                  <button
                    type="button"
                    aria-label={`Remove ${definition.name}`}
                    disabled={isProtected}
                    onClick={() => removeObjectTypeDefinition(definition.name)}
                    className={cn('rounded-full border p-1', isProtected ? 'cursor-not-allowed border-slate-800 text-slate-700' : 'border-slate-700 text-slate-400 hover:border-rose-400 hover:text-rose-200')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </header>
  )
}

function ToolGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/70 p-1.5 sm:gap-2 sm:p-2 lg:min-w-0 lg:flex-wrap">
      <span className="w-full px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-[11px]">{title}</span>
      {children}
    </div>
  )
}

function ToolButton({ icon: Icon, children, disabled, active, onClick }: { icon: typeof Move; children: React.ReactNode; disabled?: boolean; active?: boolean; onClick?: () => void }) {
  const labelText = typeof children === 'string' ? children : undefined
  const shortLabel =
    labelText === 'Open GLB' ? 'Open'
      : labelText === 'Import GLB' ? 'Import'
      : labelText === 'Export GLB' ? 'Export'
      : labelText === 'Rotate 90°' ? 'Rotate'
        : labelText === 'Duplicate' ? 'Copy'
          : labelText === 'Snap ON' || labelText === 'Snap OFF' ? 'Snap'
        : labelText === 'Expand Preview' ? 'Preview'
          : labelText === 'Type Settings' ? 'Types'
            : labelText

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={labelText}
      className={cn(
        'inline-flex min-h-10 min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] transition sm:gap-2 sm:px-3 sm:text-sm lg:min-w-fit lg:flex-initial lg:basis-auto',
        disabled ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600' : active ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
      {shortLabel ? <span>{shortLabel}</span> : children}
    </button>
  )
}
