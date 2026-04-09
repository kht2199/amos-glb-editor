import { Eye, FileDown, FileUp, Layers3, Move, Plus, Redo2, RotateCw, Save, SearchCheck, Undo2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { EditorMode, VisibilityMode } from '../types'

interface ToolbarProps {
  onOpenFile: () => void
}

const modeButtons: Array<{ id: EditorMode; label: string; icon: typeof Move }> = [
  { id: 'select', label: 'Select', icon: Layers3 },
  { id: 'moveLift', label: 'Move Lift', icon: Move },
]

export function Toolbar({ onOpenFile }: ToolbarProps) {
  const {
    fileName,
    selectedId,
    lifts,
    mode,
    visibilityMode,
    snapEnabled,
    saveState,
    validationIssues,
    collisionIssues,
    canUndo,
    canRedo,
    setMode,
    setVisibilityMode,
    setSnapEnabled,
    setPreviewOpen,
    rotateLift,
    beginAddPort,
    runValidation,
    saveSession,
    exportCurrentGlb,
    undo,
    redo,
  } = useEditorStore(useShallow((state) => ({
    fileName: state.fileName,
    selectedId: state.selectedId,
    lifts: state.lifts,
    mode: state.mode,
    visibilityMode: state.visibilityMode,
    snapEnabled: state.snapEnabled,
    saveState: state.saveState,
    validationIssues: state.validationIssues,
    collisionIssues: state.collisionIssues,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    setMode: state.setMode,
    setVisibilityMode: state.setVisibilityMode,
    setSnapEnabled: state.setSnapEnabled,
    setPreviewOpen: state.setPreviewOpen,
    rotateLift: state.rotateLift,
    beginAddPort: state.beginAddPort,
    runValidation: state.runValidation,
    saveSession: state.saveSession,
    exportCurrentGlb: state.exportCurrentGlb,
    undo: state.undo,
    redo: state.redo,
  })))

  const selectedLift = lifts.find((lift) => lift.editorId === selectedId)
  const disabled = !fileName
  const errorCount = validationIssues.filter((issue) => issue.severity === 'error').length

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">Three.js Object Editor</h1>
          <p className="text-xs text-slate-400">Lift / Port constrained editor · React + TypeScript + R3F</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
            {fileName ?? 'No file loaded'} · {saveState.toUpperCase()}
          </div>
          <div className={cn('rounded-full border px-3 py-1', errorCount ? 'border-rose-500/40 text-rose-100' : 'border-emerald-500/30 text-emerald-100')}>
            Errors {errorCount} · Collisions {collisionIssues.length}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ToolGroup title="File">
          <ToolButton icon={FileUp} onClick={onOpenFile}>Open GLB</ToolButton>
          <ToolButton icon={Save} disabled={disabled} onClick={saveSession}>Save</ToolButton>
          <ToolButton icon={FileDown} disabled={disabled} onClick={() => void exportCurrentGlb()}>Export GLB</ToolButton>
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
          <ToolButton icon={Plus} disabled={disabled} onClick={beginAddPort}>Add Port</ToolButton>
          <ToolButton icon={RotateCw} disabled={!selectedLift} onClick={() => selectedLift && rotateLift(selectedLift.editorId)}>Rotate 90°</ToolButton>
        </ToolGroup>

        <ToolGroup title="View & Validate">
          <SegmentedToggle<VisibilityMode>
            options={[{ label: 'TOP_ONLY', value: 'TOP_ONLY' }, { label: 'BOTTOM_ONLY', value: 'BOTTOM_ONLY' }]}
            value={visibilityMode}
            onChange={setVisibilityMode}
            disabled={disabled}
          />
          <ToolButton icon={Layers3} disabled={disabled} active={snapEnabled} onClick={() => setSnapEnabled(!snapEnabled)}>Snap {snapEnabled ? 'ON' : 'OFF'}</ToolButton>
          <ToolButton icon={SearchCheck} disabled={disabled} onClick={runValidation}>Validate</ToolButton>
          <ToolButton icon={Eye} disabled={disabled} onClick={() => setPreviewOpen(true)}>Expand Preview</ToolButton>
        </ToolGroup>
      </div>
    </header>
  )
}

function ToolGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</span>
      {children}
    </div>
  )
}

function ToolButton({ icon: Icon, children, disabled, active, onClick }: { icon: typeof Move; children: React.ReactNode; disabled?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
        disabled ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600' : active ? 'border-blue-500 bg-blue-500/20 text-blue-100' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

function SegmentedToggle<T extends string>({ options, value, onChange, disabled }: { options: Array<{ label: string; value: T }>; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  return (
    <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition', option.value === value ? 'bg-blue-500/20 text-blue-100' : 'text-slate-400 hover:text-slate-200')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
