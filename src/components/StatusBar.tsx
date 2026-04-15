import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'

export function StatusBar() {
  const { selectedId, lifts, ports, backgroundObjects, snapEnabled, statusMessage, collisionIssues, hasPendingChanges, canUndo, canRedo } = useEditorStore(useShallow((state) => ({
    selectedId: state.selectedId,
    lifts: state.draftLifts,
    ports: state.draftPorts,
    backgroundObjects: state.draftBackgroundObjects,
    snapEnabled: state.snapEnabled,
    statusMessage: state.statusMessage,
    collisionIssues: state.collisionIssues,
    hasPendingChanges: state.hasPendingChanges,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
  })))

  const selected = lifts.find((lift) => lift.editorId === selectedId)
    || ports.find((port) => port.editorId === selectedId)
    || backgroundObjects.find((item) => item.editorId === selectedId)
  const visiblePortCount = ports.filter((port) => !port.deleted).length

  return (
    <footer className="flex flex-col gap-2 border-t border-slate-800 bg-slate-950/80 px-4 py-2 text-xs text-slate-400 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span>Draft: <strong className="text-slate-200">{hasPendingChanges ? 'Pending' : 'Synced'}</strong></span>
        <span>Selected: <strong className="text-slate-200">{selected?.id ?? 'None'}</strong></span>
        <span>Coordinates: <strong className="text-slate-200">{selected ? `X ${selected.position.x} · Y ${selected.position.y} · Z ${selected.position.z}` : '-'}</strong></span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span>Grid Snap: <strong className="text-slate-200">{snapEnabled ? 'ON' : 'OFF'}</strong></span>
        <span>Ports: <strong className="text-slate-200">{visiblePortCount}</strong></span>
        <span>Collisions: <strong className="text-slate-200">{collisionIssues.length}</strong></span>
        <span>Undo/Redo: <strong className="text-slate-200">{canUndo ? 'Y' : 'N'} / {canRedo ? 'Y' : 'N'}</strong></span>
        <span>{statusMessage}</span>
      </div>
    </footer>
  )
}
