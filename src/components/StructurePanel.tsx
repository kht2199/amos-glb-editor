import { AlertTriangle, Search } from 'lucide-react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { ObjectKind } from '../types'

const FILTERS: Array<'All' | ObjectKind> = ['All', 'Lift', 'Port', 'Rail', 'Bridge', 'Stocker', 'Transport']

export function StructurePanel() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | ObjectKind>('All')
  const { draftLifts, draftPorts, draftReadonlyObjects, selectedId, selectObject, collisionIndex, validationIssues } = useEditorStore(useShallow((state) => ({
    draftLifts: state.draftLifts,
    draftPorts: state.draftPorts,
    draftReadonlyObjects: state.draftReadonlyObjects,
    selectedId: state.selectedId,
    selectObject: state.selectObject,
    collisionIndex: state.collisionIndex,
    validationIssues: state.validationIssues,
  })))

  const visiblePorts = draftPorts.filter((port) => !port.deleted)
  const floatingPorts = visiblePorts.filter((port) => !port.parentLiftId || !draftLifts.some((lift) => lift.editorId === port.parentLiftId))
  const issueCount = (editorId: string) => (collisionIndex[editorId]?.length ?? 0) + validationIssues.filter((issue) => issue.targetId === editorId).length

  const filtered = (() => {
    const text = query.trim().toLowerCase()
    const match = (value: string) => !text || value.toLowerCase().includes(text)
    return {
      lifts: draftLifts.filter((lift) => (filter === 'All' || filter === 'Lift') && match(lift.id)),
      ports: visiblePorts.filter((port) => (filter === 'All' || filter === 'Port') && match(port.id)),
      readonlyObjects: draftReadonlyObjects.filter((item) => (filter === 'All' || filter === item.objectType) && match(item.id)),
    }
  })()

  return (
    <aside className="flex max-h-[40vh] min-h-[280px] flex-col border-b border-slate-800 bg-slate-950/40 lg:h-full lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Structure</h2>
        <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          <Search className="h-4 w-4 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Search by ID" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={cn('rounded-full border px-2.5 py-1 text-xs transition', filter === item ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200')}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-4 text-sm">
        {filtered.lifts.map((lift) => {
          const liftIssues = issueCount(lift.editorId)
          return (
            <div key={lift.editorId} className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
              <button type="button" onClick={() => selectObject(lift.editorId)} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left', selectedId === lift.editorId ? 'bg-blue-500/15 text-blue-100' : 'text-slate-200 hover:bg-slate-800')}>
                <span className="flex items-center gap-2">
                  {lift.id}
                  {liftIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                </span>
                <span className="text-xs text-slate-500">Lift {liftIssues > 0 ? `· ${liftIssues}` : ''}</span>
              </button>
              <div className="mt-2 space-y-1 pl-2">
                {visiblePorts
                  .filter((portItem) => portItem.parentLiftId === lift.editorId)
                  .filter(() => filter === 'All' || filter === 'Port')
                  .filter((portItem) => !query || portItem.id.toLowerCase().includes(query.toLowerCase()))
                  .map((port) => {
                    const portIssues = issueCount(port.editorId)
                    return (
                      <button key={port.editorId} type="button" onClick={() => selectObject(port.editorId)} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm', selectedId === port.editorId ? 'bg-orange-500/15 text-orange-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                        <span className="flex items-center gap-2">
                          {port.id}
                          {portIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">Z {port.position.z}{portIssues > 0 ? ` · ${portIssues}` : ''}</span>
                      </button>
                    )
                  })}
              </div>
            </div>
          )
        })}

        {(filter === 'All' || filter === 'Port') && floatingPorts.length > 0 ? (
          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">External Ports</div>
            <div className="space-y-1">
              {floatingPorts
                .filter((port) => !query || port.id.toLowerCase().includes(query.toLowerCase()))
                .map((port) => {
                  const portIssues = issueCount(port.editorId)
                  return (
                    <button key={port.editorId} type="button" onClick={() => selectObject(port.editorId)} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm', selectedId === port.editorId ? 'bg-orange-500/15 text-orange-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                      <span className="flex items-center gap-2">
                        {port.id}
                        {portIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">{port.semanticRole}{portIssues > 0 ? ` · ${portIssues}` : ''}</span>
                    </button>
                  )
                })}
            </div>
          </div>
        ) : null}

        {filtered.readonlyObjects.map((item) => {
          const itemIssues = issueCount(item.editorId)
          return (
            <button key={item.editorId} type="button" onClick={() => selectObject(item.editorId)} className={cn('mb-2 flex w-full items-center justify-between rounded-xl border border-slate-800 px-3 py-2 text-left', selectedId === item.editorId ? 'bg-violet-500/15 text-violet-100' : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800')}>
              <span className="flex items-center gap-2">
                {item.id}
                {itemIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{item.objectType} · RO{itemIssues > 0 ? ` · ${itemIssues}` : ''}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
