import { lazy, Suspense } from 'react'
import { Expand } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'

const PreviewSceneCanvas = lazy(async () => import('./PreviewSceneCanvas').then((module) => ({ default: module.PreviewSceneCanvas })))

export function PreviewPanel() {
  const { fileName, hasPendingChanges, isPreviewOpen, selectedId, setPreviewOpen } = useEditorStore(useShallow((state) => ({
    fileName: state.fileName,
    hasPendingChanges: state.hasPendingChanges,
    isPreviewOpen: state.isPreviewOpen,
    selectedId: state.selectedId,
    setPreviewOpen: state.setPreviewOpen,
  })))

  if (!fileName || isPreviewOpen) return null

  return (
    <section className="flex h-[220px] min-h-[200px] flex-col border-t border-slate-800 bg-slate-950/65 sm:h-[320px] sm:min-h-[280px] lg:border-l">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Live Preview</h2>
          <p className="mt-1 text-xs text-slate-400">Selected {selectedId ?? 'None'} · applied preview · {hasPendingChanges ? 'draft pending' : 'draft synced'} · XYZ gizmo</p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          <Expand className="h-4 w-4" />
          Expand
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="h-full w-full bg-slate-950/40" />}>
          <PreviewSceneCanvas />
        </Suspense>
      </div>
    </section>
  )
}
