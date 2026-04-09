import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'

export function ExportFeedbackModal() {
  const { exportFeedback, closeExportFeedback } = useEditorStore(useShallow((state) => ({
    exportFeedback: state.exportFeedback,
    closeExportFeedback: state.closeExportFeedback,
  })))

  if (exportFeedback.status === 'idle') return null

  const title = exportFeedback.status === 'success' ? 'Export completed' : exportFeedback.status === 'blocked' ? 'Export blocked' : exportFeedback.status === 'exporting' ? 'Exporting' : 'Export failed'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        <p className="mt-3 text-sm text-slate-300">{exportFeedback.message}</p>
        {exportFeedback.fileName ? <p className="mt-2 text-xs text-slate-500">{exportFeedback.fileName}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {exportFeedback.downloadUrl ? <a className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-slate-950" href={exportFeedback.downloadUrl} download={exportFeedback.fileName}>Download</a> : null}
          {exportFeedback.status !== 'exporting' ? <button type="button" className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200" onClick={closeExportFeedback}>Close</button> : null}
        </div>
      </div>
    </div>
  )
}
