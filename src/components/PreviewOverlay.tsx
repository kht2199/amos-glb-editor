import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'
import { PreviewSceneCanvas } from './PreviewSceneCanvas'

export function PreviewOverlay() {
  const { fileName, isPreviewOpen, selectedId, setPreviewOpen } = useEditorStore(useShallow((state) => ({
    fileName: state.fileName,
    isPreviewOpen: state.isPreviewOpen,
    selectedId: state.selectedId,
    setPreviewOpen: state.setPreviewOpen,
  })))

  if (!isPreviewOpen || !fileName) return null

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-50">Preview Overlay</h2>
            <p className="text-xs text-slate-400">Expanded store-based simplified preview · selected {selectedId ?? 'None'} · XYZ gizmo</p>
          </div>
          <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1">
          <PreviewSceneCanvas />
        </div>
      </div>
    </div>
  )
}
