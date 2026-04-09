import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { computeVisibilityPivot, matchesVisibilityMode, visibilityModeLabel } from '../lib/visibilityMode'
import { cn, round } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { LiftEntity, PortEntity, ReadOnlyEntity } from '../types'

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function computeBounds(lifts: LiftEntity[], ports: PortEntity[], readonlyObjects: ReadOnlyEntity[]): Bounds {
  const entities = [...lifts, ...ports.filter((port) => !port.deleted), ...readonlyObjects]
  if (!entities.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
  return entities.reduce<Bounds>((acc, item) => ({
    minX: Math.min(acc.minX, item.position.x - item.width / 2 - 20),
    maxX: Math.max(acc.maxX, item.position.x + item.width / 2 + 20),
    minY: Math.min(acc.minY, item.position.y - item.depth / 2 - 20),
    maxY: Math.max(acc.maxY, item.position.y + item.depth / 2 + 20),
  }), { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY })
}

function project(bounds: Bounds, width: number, height: number, x: number, y: number) {
  const padding = 40
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.min(usableWidth / worldWidth, usableHeight / worldHeight)
  return { x: padding + (x - bounds.minX) * scale, y: padding + (bounds.maxY - y) * scale, scale }
}

function unproject(bounds: Bounds, width: number, height: number, px: number, py: number) {
  const padding = 40
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.min(usableWidth / worldWidth, usableHeight / worldHeight)
  return { x: round((px - padding) / scale + bounds.minX), y: round(bounds.maxY - (py - padding) / scale) }
}

export function TopViewCanvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 700 })
  const {
    lifts,
    ports,
    readonlyObjects,
    selectedId,
    selectObject,
    moveLift,
    movePortByWorld,
    visibilityMode,
    mode,
    beginAddPort,
    collisionIndex,
    collisionIssues,
  } = useEditorStore(useShallow((state) => ({
    lifts: state.lifts,
    ports: state.ports,
    readonlyObjects: state.readonlyObjects,
    selectedId: state.selectedId,
    selectObject: state.selectObject,
    moveLift: state.moveLift,
    movePortByWorld: state.movePortByWorld,
    visibilityMode: state.visibilityMode,
    mode: state.mode,
    beginAddPort: state.beginAddPort,
    collisionIndex: state.collisionIndex,
    collisionIssues: state.collisionIssues,
  })))

  const visibilityPivot = useMemo(() => computeVisibilityPivot(ports, lifts), [ports, lifts])
  const visiblePorts = useMemo(
    () => ports.filter((port) => !port.deleted && matchesVisibilityMode(port, visibilityMode, visibilityPivot)),
    [ports, visibilityMode, visibilityPivot],
  )
  const bounds = useMemo(() => computeBounds(lifts, visiblePorts, readonlyObjects), [lifts, readonlyObjects, visiblePorts])
  const visibleEntities = useMemo(() => Object.fromEntries([...lifts, ...visiblePorts, ...readonlyObjects].map((entity) => [entity.editorId, entity] as const)), [lifts, readonlyObjects, visiblePorts])
  const collisionConnections = useMemo(() => {
    const seen = new Set<string>()
    return collisionIssues.flatMap((issue) => {
      const source = visibleEntities[issue.sourceId]
      const target = visibleEntities[issue.targetId]
      if (!source || !target) return []
      const key = [issue.sourceId, issue.targetId].sort().join('::')
      if (seen.has(key)) return []
      seen.add(key)
      return [{ key, source, target, severity: issue.severity }]
    })
  }, [collisionIssues, visibleEntities])

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined') return

    let active = true
    const updateSize = () => {
      if (!active) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      setCanvasSize((current) => {
        const next = { width: Math.max(rect.width, 320), height: Math.max(rect.height, 240) }
        return current.width === next.width && current.height === next.height ? current : next
      })
    }

    updateSize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null
    observer?.observe(canvasRef.current)
    window.addEventListener('resize', updateSize)
    return () => {
      active = false
      observer?.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingId || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const world = unproject(bounds, rect.width, rect.height, event.clientX - rect.left, event.clientY - rect.top)
    if (lifts.some((lift) => lift.editorId === draggingId) && mode === 'moveLift') moveLift(draggingId, world.x, world.y)
    else if (visiblePorts.some((port) => port.editorId === draggingId)) movePortByWorld(draggingId, world.x, world.y)
  }

  return (
    <section className="relative flex h-full flex-col bg-slate-950/30">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm text-slate-300">
        <div>
          <h2 className="font-semibold text-slate-100">XY Plane Editor</h2>
          <p className="text-xs text-slate-500">XY plane editing · lift-to-lift snap · port-to-nearest-lift attach</p>
        </div>
        <button type="button" onClick={beginAddPort} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500">Add Port Mode</button>
      </div>

      <div ref={canvasRef} className="editor-grid relative flex-1 overflow-hidden" onPointerMove={handlePointerMove} onPointerUp={() => setDraggingId(null)} onPointerLeave={() => setDraggingId(null)}>
        <div className="absolute left-4 top-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">{visibilityModeLabel(visibilityMode, visibilityPivot)} · {mode}{collisionIssues.length ? ` · collisions ${collisionIssues.length}` : ''}</div>

        {collisionConnections.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {collisionConnections.map((connection) => {
              const source = project(bounds, canvasSize.width, canvasSize.height, connection.source.position.x, connection.source.position.y)
              const target = project(bounds, canvasSize.width, canvasSize.height, connection.target.position.x, connection.target.position.y)
              const stroke = connection.severity === 'error' ? 'rgba(251, 113, 133, 0.9)' : 'rgba(251, 191, 36, 0.8)'
              return (
                <g key={connection.key}>
                  <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={stroke} strokeWidth="2.5" strokeDasharray={connection.severity === 'error' ? '0' : '6 6'} />
                  <circle cx={source.x} cy={source.y} r="4" fill={stroke} />
                  <circle cx={target.x} cy={target.y} r="4" fill={stroke} />
                </g>
              )
            })}
          </svg>
        )}

        {readonlyObjects.map((item) => {
          const center = project(bounds, canvasSize.width, canvasSize.height, item.position.x, item.position.y)
          const colliding = Boolean(collisionIndex[item.editorId]?.length)
          return (
            <div
              key={item.editorId}
              role="button"
              tabIndex={0}
              onClick={() => selectObject(item.editorId)}
              className={cn(
                'absolute rounded-xl border border-dashed bg-slate-700/15 text-[11px] text-slate-400',
                colliding ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-slate-600',
                selectedId === item.editorId && 'border-violet-400 bg-violet-500/10 text-violet-100',
              )}
              style={{ left: center.x - (item.width * center.scale) / 2, top: center.y - (item.depth * center.scale) / 2, width: item.width * center.scale, height: Math.max(18, item.depth * center.scale) }}
            >
              <div className="flex h-full items-center justify-center">{item.id} (RO)</div>
              {colliding && <span className="absolute -right-2 -top-2 rounded-full border border-rose-200 bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{collisionIndex[item.editorId].length}</span>}
            </div>
          )
        })}

        {lifts.map((lift) => {
          const center = project(bounds, canvasSize.width, canvasSize.height, lift.position.x, lift.position.y)
          const colliding = Boolean(collisionIndex[lift.editorId]?.length)
          return (
            <div
              key={lift.editorId}
              role="button"
              tabIndex={0}
              onClick={() => selectObject(lift.editorId)}
              onPointerDown={(event) => { event.stopPropagation(); selectObject(lift.editorId); if (mode === 'moveLift') setDraggingId(lift.editorId) }}
              className={cn(
                'absolute rounded-2xl border text-xs',
                colliding ? 'border-rose-400 bg-rose-500/12 text-rose-50 shadow-[0_0_0_2px_rgba(251,113,133,0.25)]' : 'bg-blue-500/10 text-blue-100',
                selectedId === lift.editorId ? 'shadow-[0_0_0_2px_rgba(191,219,254,0.4)]' : '',
                !colliding && (selectedId === lift.editorId ? 'border-blue-300' : 'border-blue-500/40'),
                mode === 'moveLift' ? 'cursor-move' : 'cursor-default',
              )}
              style={{ left: center.x - (lift.width * center.scale) / 2, top: center.y - (lift.depth * center.scale) / 2, width: lift.width * center.scale, height: Math.max(32, lift.depth * center.scale), transform: `rotate(${-lift.rotation}deg)` }}
            >
              {colliding && <span className="absolute -right-2 -top-2 rounded-full border border-rose-200 bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{collisionIndex[lift.editorId].length}</span>}
              <div className="flex h-full flex-col justify-between p-2">
                <span className="font-semibold">{lift.id}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] opacity-80">slots {lift.slotsPerFace}</span>
              </div>
            </div>
          )
        })}

        {visiblePorts.map((port) => {
          const center = project(bounds, canvasSize.width, canvasSize.height, port.position.x, port.position.y)
          const colliding = Boolean(collisionIndex[port.editorId]?.length)
          return (
            <button
              key={port.editorId}
              type="button"
              aria-label={port.id}
              onClick={() => selectObject(port.editorId)}
              onPointerDown={(event) => { event.stopPropagation(); selectObject(port.editorId); setDraggingId(port.editorId) }}
              className={cn(
                'absolute flex h-5 min-w-5 items-center justify-center rounded-full border text-[10px] font-semibold uppercase transition',
                colliding ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(251,113,133,0.35)]' : selectedId === port.editorId ? 'border-orange-300 bg-orange-400 text-slate-950' : 'border-orange-400/60 bg-orange-500/15 text-orange-100 hover:bg-orange-500/30',
              )}
              style={{ left: center.x - 12, top: center.y - 12, width: 24, height: 24 }}
            >
              {port.slot}
              {colliding && <span className="absolute -right-2 -top-2 rounded-full border border-rose-200 bg-rose-500 px-1 py-0 text-[9px] font-bold text-white">!</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
