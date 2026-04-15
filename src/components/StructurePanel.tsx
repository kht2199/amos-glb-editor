import { AlertTriangle, ChevronRight, Copy, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { BackgroundObjectEntity, LiftEntity, ObjectKind, PortEntity } from '../types'

type SelectedSceneObject =
  | { kind: 'lift'; item: LiftEntity }
  | { kind: 'port'; item: PortEntity }
  | { kind: 'background'; item: BackgroundObjectEntity }

const quickInputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400'
const quickButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50'

export function StructurePanel() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | ObjectKind>('All')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const {
    draftLifts,
    draftPorts,
    draftBackgroundObjects,
    objectTypeDefinitions,
    selectedId,
    selectObject,
    collisionIndex,
    duplicateSelectedObject,
    updateLift,
    updatePort,
    updateBackgroundObject,
  } = useEditorStore(useShallow((state) => ({
    draftLifts: state.draftLifts,
    draftPorts: state.draftPorts,
    draftBackgroundObjects: state.draftBackgroundObjects,
    objectTypeDefinitions: state.objectTypeDefinitions,
    selectedId: state.selectedId,
    selectObject: state.selectObject,
    collisionIndex: state.collisionIndex,
    duplicateSelectedObject: state.duplicateSelectedObject,
    updateLift: state.updateLift,
    updatePort: state.updatePort,
    updateBackgroundObject: state.updateBackgroundObject,
  })))

  const visiblePorts = draftPorts.filter((port) => !port.deleted)
  const floatingPorts = visiblePorts.filter((port) => !port.parentLiftId || !draftLifts.some((lift) => lift.editorId === port.parentLiftId))
  const issueCount = (editorId: string) => collisionIndex[editorId]?.length ?? 0
  const filters = useMemo<Array<'All' | ObjectKind>>(() => ['All', ...objectTypeDefinitions.map((definition) => definition.name)], [objectTypeDefinitions])
  const activeFilter = filter === 'All' || filters.includes(filter) ? filter : 'All'
  const isExpanded = (nodeId: string) => expandedNodes[nodeId] ?? false
  const toggleNode = (nodeId: string) => setExpandedNodes((current) => ({ ...current, [nodeId]: !(current[nodeId] ?? false) }))

  const selectedObject = useMemo<SelectedSceneObject | null>(() => {
    const selectedLift = draftLifts.find((item) => item.editorId === selectedId)
    if (selectedLift) return { kind: 'lift', item: selectedLift }

    const selectedPort = visiblePorts.find((item) => item.editorId === selectedId)
    if (selectedPort) return { kind: 'port', item: selectedPort }

    const selectedBackground = draftBackgroundObjects.find((item) => item.editorId === selectedId)
    if (selectedBackground) return { kind: 'background', item: selectedBackground }

    return null
  }, [draftBackgroundObjects, draftLifts, selectedId, visiblePorts])

  const filtered = (() => {
    const text = query.trim().toLowerCase()
    const match = (value: string) => !text || value.toLowerCase().includes(text)
    return {
      lifts: draftLifts.filter((lift) => (activeFilter === 'All' || activeFilter === 'Lift') && match(lift.id)),
      ports: visiblePorts.filter((port) => (activeFilter === 'All' || activeFilter === 'Port') && match(port.id)),
      backgroundObjects: draftBackgroundObjects.filter((item) => (activeFilter === 'All' || activeFilter === item.objectType) && match(item.id)),
    }
  })()

  const updateQuickPosition = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedObject) return

    if (selectedObject.kind === 'lift') {
      updateLift(selectedObject.item.editorId, { position: { ...selectedObject.item.position, [axis]: value } })
      return
    }

    if (selectedObject.kind === 'port') {
      updatePort(selectedObject.item.editorId, { position: { ...selectedObject.item.position, [axis]: value } })
      return
    }

    updateBackgroundObject(selectedObject.item.editorId, { position: { ...selectedObject.item.position, [axis]: value } })
  }

  return (
    <aside className="order-2 flex max-h-[48svh] min-h-[260px] flex-col border-b border-slate-800 bg-slate-950/40 lg:order-1 lg:h-full lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Structure</h2>
        <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          <Search className="h-4 w-4 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Search by ID" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={cn('rounded-full border px-2.5 py-1 text-xs transition', activeFilter === item ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200')}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 text-sm">
        {filtered.lifts.map((lift) => {
          const liftIssues = issueCount(lift.editorId)
          const liftPorts = visiblePorts
            .filter((portItem) => portItem.parentLiftId === lift.editorId)
            .filter(() => activeFilter === 'All' || activeFilter === 'Port')
            .filter((portItem) => !query || portItem.id.toLowerCase().includes(query.toLowerCase()))
          const expanded = isExpanded(`lift:${lift.editorId}`)
          return (
            <div key={lift.editorId} className="mb-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${lift.id}`}
                  aria-expanded={expanded}
                  onClick={() => toggleNode(`lift:${lift.editorId}`)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
                </button>
                <button type="button" onClick={() => selectObject(lift.editorId)} className={cn('flex min-w-0 w-full items-center justify-between rounded-lg px-2 py-2 text-left', selectedId === lift.editorId ? 'bg-blue-500/15 text-blue-100' : 'text-slate-200 hover:bg-slate-800')}>
                  <span className="flex items-center gap-2">
                    {lift.id}
                    {liftIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">Lift {liftIssues > 0 ? `· ${liftIssues}` : ''}{liftPorts.length ? ` · ${liftPorts.length}` : ''}</span>
                </button>
              </div>
              {expanded ? (
                <div className="ml-7 space-y-2 rounded-xl border-l border-slate-700/80 bg-slate-950/35 pl-3 pt-1 pb-1" data-testid={`structure-children-${lift.editorId}`}>
                  {liftPorts.length ? liftPorts.map((port) => {
                    const portIssues = issueCount(port.editorId)
                    return (
                      <button key={port.editorId} type="button" onClick={() => selectObject(port.editorId)} className={cn('flex min-h-10 w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm', selectedId === port.editorId ? 'bg-orange-500/15 text-orange-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                        <span className="flex items-center gap-2">
                          {port.id}
                          {portIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">Z {port.position.z}{portIssues > 0 ? ` · ${portIssues}` : ''}</span>
                      </button>
                    )
                  }) : <div className="rounded-lg border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500">No child ports</div>}
                </div>
              ) : null}
            </div>
          )
        })}

        {(activeFilter === 'All' || activeFilter === 'Port') && floatingPorts.length > 0 ? (
          <div className="mb-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`${isExpanded('group:external-ports') ? 'Collapse' : 'Expand'} external ports`}
                aria-expanded={isExpanded('group:external-ports')}
                onClick={() => toggleNode('group:external-ports')}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              >
                <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded('group:external-ports') && 'rotate-90')} />
              </button>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">External Ports · {floatingPorts.length}</div>
            </div>
            {isExpanded('group:external-ports') ? (
              <div className="ml-7 space-y-2 rounded-xl border-l border-slate-700/80 bg-slate-950/35 pl-3 pt-1 pb-1">
                {floatingPorts
                  .filter((port) => !query || port.id.toLowerCase().includes(query.toLowerCase()))
                  .map((port) => {
                    const portIssues = issueCount(port.editorId)
                    return (
                      <button key={port.editorId} type="button" onClick={() => selectObject(port.editorId)} className={cn('flex min-h-10 w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm', selectedId === port.editorId ? 'bg-orange-500/15 text-orange-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}>
                        <span className="flex items-center gap-2">
                          {port.id}
                          {portIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">{port.semanticRole}{portIssues > 0 ? ` · ${portIssues}` : ''}</span>
                      </button>
                    )
                  })}
              </div>
            ) : null}
          </div>
        ) : null}

        {filtered.backgroundObjects.length > 0 ? (
          <div className="mb-3 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`${isExpanded('group:background-objects') ? 'Collapse' : 'Expand'} background objects`}
                aria-expanded={isExpanded('group:background-objects')}
                onClick={() => toggleNode('group:background-objects')}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              >
                <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded('group:background-objects') && 'rotate-90')} />
              </button>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Background Objects · {filtered.backgroundObjects.length}</div>
            </div>
            {isExpanded('group:background-objects') ? (
              <div className="ml-7 space-y-2 rounded-xl border-l border-slate-700/80 bg-slate-950/35 pl-3 pt-1 pb-1">
                {filtered.backgroundObjects.map((item) => {
                  const itemIssues = issueCount(item.editorId)
                  return (
                    <button key={item.editorId} type="button" onClick={() => selectObject(item.editorId)} className={cn('flex w-full items-center justify-between rounded-xl border border-slate-800 px-3 py-2 text-left', selectedId === item.editorId ? 'bg-violet-500/15 text-violet-100' : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800')}>
                      <span className="flex items-center gap-2">
                        {item.id}
                        {itemIssues > 0 && <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}
                      </span>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{item.objectType}{itemIssues > 0 ? ` · ${itemIssues}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedObject ? (
        <section className="border-t border-slate-800 bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Quick actions</h3>
              <p className="mt-1 text-xs text-slate-400">선택한 객체를 이 목록 패널 안에서 바로 복사하고 좌표를 수정합니다.</p>
            </div>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{selectedObject.item.objectType}</span>
          </div>

          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-sm font-medium text-slate-100">{selectedObject.item.id}</div>
            <div className="mt-1 text-xs text-slate-500">Top View Canvas로 이동하지 않아도 Structure 목록 기준으로 편집을 이어갈 수 있습니다.</div>
          </div>

          <button type="button" className={quickButtonClass} onClick={duplicateSelectedObject} aria-label="Duplicate selected object">
            <Copy className="h-4 w-4" />
            Duplicate selected object
          </button>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <QuickNumberField label="Quick X" value={selectedObject.item.position.x} onChange={(value) => updateQuickPosition('x', value)} />
            <QuickNumberField label="Quick Y" value={selectedObject.item.position.y} onChange={(value) => updateQuickPosition('y', value)} />
            <QuickNumberField label="Quick Z" value={selectedObject.item.position.z} onChange={(value) => updateQuickPosition('z', value)} />
          </div>
        </section>
      ) : null}
    </aside>
  )
}

function QuickNumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        aria-label={label}
        className={quickInputClass}
        type="number"
        value={value}
        onChange={(event) => {
          const parsed = Number.parseFloat(event.target.value)
          if (!Number.isNaN(parsed)) {
            onChange(parsed)
          }
        }}
      />
    </label>
  )
}
