import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'

export function ValidationDrawer() {
  const { isValidationOpen, validationIssues, selectObject, setValidationOpen } = useEditorStore(useShallow((state) => ({
    isValidationOpen: state.isValidationOpen,
    validationIssues: state.validationIssues,
    selectObject: state.selectObject,
    setValidationOpen: state.setValidationOpen,
  })))

  const errorCount = validationIssues.filter((issue) => issue.severity === 'error').length

  return (
    <aside className={cn(
      'fixed inset-y-0 right-0 z-20 w-full max-w-none border-l border-slate-800 bg-slate-950/95 p-4 transition-transform duration-200 lg:absolute lg:h-full lg:w-[360px] lg:max-w-[360px]',
      isValidationOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full',
    )}>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-50">Validation Results</h2>
          <p className="text-xs text-slate-500">Errors {errorCount} · Total {validationIssues.length}</p>
        </div>
        <button type="button" onClick={() => setValidationOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      <div className="scrollbar-thin space-y-2 overflow-y-auto pr-1">
        {validationIssues.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Validation passed. Export can proceed.</div>
        ) : validationIssues.map((issue) => (
          <button key={issue.id} type="button" onClick={() => issue.targetId && selectObject(issue.targetId)} className={cn('w-full rounded-2xl border px-3 py-3 text-left text-sm', issue.severity === 'error' ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-amber-500/20 bg-amber-500/10 text-amber-100')}>
            <div className="mb-1 text-[11px] uppercase tracking-[0.18em] opacity-80">{issue.severity}</div>
            <div>{issue.message}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
