import { Expand } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'
import { PreviewSceneCanvas } from './PreviewSceneCanvas'

export function PreviewPanel() {
  const { isPreviewOpen, runtime, selectedId, setPreviewOpen } = useEditorStore(useShallow((state) => ({
    isPreviewOpen: state.isPreviewOpen,
    runtime: state.runtime,
    selectedId: state.selectedId,
    setPreviewOpen: state.setPreviewOpen,
  })))

  if (!runtime.workingScene || isPreviewOpen) return null

  return (
    <section className="flex h-[320px] min-h-[280px] flex-col border-l border-t border-slate-800 bg-slate-950/65">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Live Preview</h2>
          <p className="mt-1 text-xs text-slate-400">Selected {selectedId ?? 'None'} · read-only orbit view · XYZ gizmo</p>
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
        <PreviewSceneCanvas scene={runtime.workingScene} />
      </div>
    </section>
  )
}
