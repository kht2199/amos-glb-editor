import { useShallow } from 'zustand/react/shallow'
import { computeVisibilityPivot, visibilityModeLabel } from '../lib/visibilityMode'
import { useEditorStore } from '../store/editor-store'

export function StatusBar() {
  const { selectedId, lifts, ports, snapEnabled, visibilityMode, statusMessage, validationIssues, collisionIssues, saveState, hasPendingChanges, canUndo, canRedo } = useEditorStore(useShallow((state) => ({
    selectedId: state.selectedId,
    lifts: state.draftLifts,
    ports: state.draftPorts,
    snapEnabled: state.snapEnabled,
    visibilityMode: state.visibilityMode,
    statusMessage: state.statusMessage,
    validationIssues: state.validationIssues,
    collisionIssues: state.collisionIssues,
    saveState: state.saveState,
    hasPendingChanges: state.hasPendingChanges,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  })))

  const selected = lifts.find((lift) => lift.editorId === selectedId) || ports.find((port) => port.editorId === selectedId)
  const visibilityPivot = computeVisibilityPivot(ports, lifts)

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/80 px-4 py-2 text-xs text-slate-400">
      <div className="flex flex-wrap items-center gap-3">
        <span>Status: <strong className="text-slate-200">{saveState === 'saved' ? 'Saved' : 'Unsaved changes'}</strong></span>
        <span>Draft: <strong className="text-slate-200">{hasPendingChanges ? 'Pending apply' : 'Applied sync'}</strong></span>
        <span>Selected: <strong className="text-slate-200">{selected?.id ?? 'None'}</strong></span>
        <span>Coordinates: <strong className="text-slate-200">{selected ? `X ${selected.position.x} · Y ${selected.position.y} · Z ${selected.position.z}` : '-'}</strong></span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span>Snap: <strong className="text-slate-200">{snapEnabled ? 'ON' : 'OFF'}</strong></span>
        <span>View: <strong className="text-slate-200">{visibilityModeLabel(visibilityMode, visibilityPivot)}</strong></span>
        <span>Issues: <strong className="text-slate-200">{validationIssues.length}</strong></span>
        <span>Collisions: <strong className="text-slate-200">{collisionIssues.length}</strong></span>
        <span>Undo/Redo: <strong className="text-slate-200">{canUndo ? 'Y' : 'N'} / {canRedo ? 'Y' : 'N'}</strong></span>
        <span>{statusMessage}</span>
      </div>
    </footer>
  )
}
