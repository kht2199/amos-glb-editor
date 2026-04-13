import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn, round } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { BackgroundObjectEntity, LiftEntity, PortEntity, TopViewFrame } from '../types'

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function axisDirectionSign(direction: TopViewFrame['xAxisDirection'] | TopViewFrame['yAxisDirection']) {
  return direction === 'right' || direction === 'up' ? 1 : -1
}

function toFrameCoordinates(frame: TopViewFrame, x: number, y: number) {
  return {
    x: round((x - frame.originX) * axisDirectionSign(frame.xAxisDirection)),
    y: round((y - frame.originY) * axisDirectionSign(frame.yAxisDirection)),
  }
}

function fromFrameCoordinates(frame: TopViewFrame, x: number, y: number) {
  return {
    x: round(frame.originX + x * axisDirectionSign(frame.xAxisDirection)),
    y: round(frame.originY + y * axisDirectionSign(frame.yAxisDirection)),
  }
}

function computeBounds(
  lifts: LiftEntity[],
  ports: PortEntity[],
  backgroundObjects: BackgroundObjectEntity[],
  frame: TopViewFrame,
): Bounds {
  const entities = [...lifts, ...ports.filter((port) => !port.deleted), ...backgroundObjects]
  if (!entities.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
  return entities.reduce<Bounds>((acc, item) => {
    const point = toFrameCoordinates(frame, item.position.x, item.position.y)
    return {
      minX: Math.min(acc.minX, point.x - item.width / 2 - 20),
      maxX: Math.max(acc.maxX, point.x + item.width / 2 + 20),
      minY: Math.min(acc.minY, point.y - item.depth / 2 - 20),
      maxY: Math.max(acc.maxY, point.y + item.depth / 2 + 20),
    }
  }, {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  })
}

function getProjectionScale(bounds: Bounds, width: number, height: number) {
  const padding = 40
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1)
  return Math.min(usableWidth / worldWidth, usableHeight / worldHeight)
}

function project(bounds: Bounds, width: number, height: number, x: number, y: number, frame: TopViewFrame) {
  const padding = 40
  const scale = getProjectionScale(bounds, width, height)
  const point = toFrameCoordinates(frame, x, y)
  return {
    x: padding + (point.x - bounds.minX) * scale,
    y: padding + (bounds.maxY - point.y) * scale,
    scale,
  }
}

function unproject(bounds: Bounds, width: number, height: number, px: number, py: number, frame: TopViewFrame) {
  const padding = 40
  const scale = getProjectionScale(bounds, width, height)
  const point = {
    x: round((px - padding) / scale + bounds.minX),
    y: round(bounds.maxY - (py - padding) / scale),
  }
  return fromFrameCoordinates(frame, point.x, point.y)
}

export function TopViewCanvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [frameDragStart, setFrameDragStart] = useState<null | {
    pointerX: number
    pointerY: number
    scale: number
    originX: number
    originY: number
    xAxisDirection: TopViewFrame['xAxisDirection']
    yAxisDirection: TopViewFrame['yAxisDirection']
  }>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 700 })
  const {
    lifts,
    ports,
    backgroundObjects,
    selectedId,
    selectObject,
    moveEntity,
    mode,
    collisionIndex,
    collisionIssues,
    topViewFrame,
    setTopViewFrame,
  } = useEditorStore(useShallow((state) => ({
    lifts: state.draftLifts,
    ports: state.draftPorts,
    backgroundObjects: state.draftBackgroundObjects,
    selectedId: state.selectedId,
    selectObject: state.selectObject,
    moveEntity: state.moveEntity,
    mode: state.mode,
    collisionIndex: state.collisionIndex,
    collisionIssues: state.collisionIssues,
    topViewFrame: state.topViewFrame,
    setTopViewFrame: state.setTopViewFrame,
  })))

  const visiblePorts = useMemo(() => ports.filter((port) => !port.deleted), [ports])
  const bounds = useMemo(
    () => computeBounds(lifts, visiblePorts, backgroundObjects, topViewFrame),
    [backgroundObjects, lifts, topViewFrame, visiblePorts],
  )
  const visibleEntities = useMemo(
    () => Object.fromEntries([...lifts, ...visiblePorts, ...backgroundObjects].map((entity) => [entity.editorId, entity] as const)),
    [backgroundObjects, lifts, visiblePorts],
  )
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
  const frameSummary = `Origin (${topViewFrame.originX}, ${topViewFrame.originY}) · X+ ${topViewFrame.xAxisDirection} · Y+ ${topViewFrame.yAxisDirection}`

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

  function handleFrameNumberChange(key: 'originX' | 'originY', value: string) {
    const parsed = Number(value)
    setTopViewFrame({ [key]: Number.isFinite(parsed) ? parsed : 0 })
  }

  function clearDragState() {
    setDraggingId(null)
    setFrameDragStart(null)
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    setFrameDragStart({
      pointerX: event.clientX,
      pointerY: event.clientY,
      scale: getProjectionScale(bounds, rect.width, rect.height),
      originX: topViewFrame.originX,
      originY: topViewFrame.originY,
      xAxisDirection: topViewFrame.xAxisDirection,
      yAxisDirection: topViewFrame.yAxisDirection,
    })
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (frameDragStart) {
      const deltaX = (event.clientX - frameDragStart.pointerX) / frameDragStart.scale
      const deltaY = (event.clientY - frameDragStart.pointerY) / frameDragStart.scale
      setTopViewFrame({
        originX: round(frameDragStart.originX - deltaX * axisDirectionSign(frameDragStart.xAxisDirection)),
        originY: round(frameDragStart.originY - deltaY * axisDirectionSign(frameDragStart.yAxisDirection)),
      })
      return
    }

    if (!draggingId || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const world = unproject(bounds, rect.width, rect.height, event.clientX - rect.left, event.clientY - rect.top, topViewFrame)
    if (mode !== 'move') return
    if ([...lifts, ...visiblePorts, ...backgroundObjects].some((entity) => entity.editorId === draggingId)) moveEntity(draggingId, world.x, world.y)
  }

  return (
    <section className="relative flex min-h-[52dvh] flex-col bg-slate-950/30 lg:h-full lg:min-h-0">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-300 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">XY Plane Editor</h2>
          <p className="text-xs text-slate-500">XY plane editing · lift-to-lift snap · port-to-nearest-lift attach</p>
          <p className="mt-1 text-xs text-slate-400">{frameSummary}</p>
        </div>

        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex min-w-[8rem] flex-col gap-1">
            <span>Reference X</span>
            <input
              aria-label="Reference X"
              type="number"
              value={topViewFrame.originX}
              onChange={(event) => handleFrameNumberChange('originX', event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            />
          </label>
          <label className="flex min-w-[8rem] flex-col gap-1">
            <span>Reference Y</span>
            <input
              aria-label="Reference Y"
              type="number"
              value={topViewFrame.originY}
              onChange={(event) => handleFrameNumberChange('originY', event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            />
          </label>
          <label className="flex min-w-[8rem] flex-col gap-1">
            <span>X Axis Positive</span>
            <select
              aria-label="X Axis Positive"
              value={topViewFrame.xAxisDirection}
              onChange={(event) => setTopViewFrame({ xAxisDirection: event.target.value as TopViewFrame['xAxisDirection'] })}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            >
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </label>
          <label className="flex min-w-[8rem] flex-col gap-1">
            <span>Y Axis Positive</span>
            <select
              aria-label="Y Axis Positive"
              value={topViewFrame.yAxisDirection}
              onChange={(event) => setTopViewFrame({ yAxisDirection: event.target.value as TopViewFrame['yAxisDirection'] })}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            >
              <option value="up">up</option>
              <option value="down">down</option>
            </select>
          </label>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="editor-grid relative flex-1 overflow-hidden"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDragState}
        onPointerLeave={clearDragState}
      >
        <div className="absolute left-4 top-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">Ports {visiblePorts.length} · {mode}{collisionIssues.length ? ` · collisions ${collisionIssues.length}` : ''}</div>

        {collisionConnections.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {collisionConnections.map((connection) => {
              const source = project(bounds, canvasSize.width, canvasSize.height, connection.source.position.x, connection.source.position.y, topViewFrame)
              const target = project(bounds, canvasSize.width, canvasSize.height, connection.target.position.x, connection.target.position.y, topViewFrame)
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

        {backgroundObjects.map((item) => {
          const center = project(bounds, canvasSize.width, canvasSize.height, item.position.x, item.position.y, topViewFrame)
          const colliding = Boolean(collisionIndex[item.editorId]?.length)
          return (
            <div
              key={item.editorId}
              role="button"
              tabIndex={0}
              onClick={() => selectObject(item.editorId)}
              onPointerDown={(event) => { event.stopPropagation(); selectObject(item.editorId); if (mode === 'move') setDraggingId(item.editorId) }}
              className={cn(
                'absolute rounded-xl border border-dashed bg-slate-700/15 text-[11px] text-slate-400',
                colliding ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-slate-600',
                selectedId === item.editorId && 'border-violet-400 bg-violet-500/10 text-violet-100',
                mode === 'move' ? 'cursor-move' : 'cursor-default',
              )}
              style={{ left: center.x - (item.width * center.scale) / 2, top: center.y - (item.depth * center.scale) / 2, width: item.width * center.scale, height: Math.max(18, item.depth * center.scale) }}
            >
              <div className="flex h-full items-center justify-center">{item.id}</div>
              {colliding && <span className="absolute -right-2 -top-2 rounded-full border border-rose-200 bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{collisionIndex[item.editorId].length}</span>}
            </div>
          )
        })}

        {lifts.map((lift) => {
          const center = project(bounds, canvasSize.width, canvasSize.height, lift.position.x, lift.position.y, topViewFrame)
          const colliding = Boolean(collisionIndex[lift.editorId]?.length)
          return (
            <div
              key={lift.editorId}
              role="button"
              tabIndex={0}
              onClick={() => selectObject(lift.editorId)}
              onPointerDown={(event) => { event.stopPropagation(); selectObject(lift.editorId); if (mode === 'move') setDraggingId(lift.editorId) }}
              className={cn(
                'absolute rounded-2xl border text-xs',
                colliding ? 'border-rose-400 bg-rose-500/12 text-rose-50 shadow-[0_0_0_2px_rgba(251,113,133,0.25)]' : 'bg-blue-500/10 text-blue-100',
                selectedId === lift.editorId ? 'shadow-[0_0_0_2px_rgba(191,219,254,0.4)]' : '',
                !colliding && (selectedId === lift.editorId ? 'border-blue-300' : 'border-blue-500/40'),
                mode === 'move' ? 'cursor-move' : 'cursor-default',
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
          const center = project(bounds, canvasSize.width, canvasSize.height, port.position.x, port.position.y, topViewFrame)
          const colliding = Boolean(collisionIndex[port.editorId]?.length)
          return (
            <button
              key={port.editorId}
              type="button"
              aria-label={port.id}
              onClick={() => selectObject(port.editorId)}
              onPointerDown={(event) => { event.stopPropagation(); selectObject(port.editorId); if (mode === 'move') setDraggingId(port.editorId) }}
              className={cn(
                'absolute flex h-5 min-w-5 items-center justify-center rounded-full border text-[10px] font-semibold uppercase transition',
                colliding ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(251,113,133,0.35)]' : selectedId === port.editorId ? 'border-orange-300 bg-orange-400 text-slate-950' : 'border-orange-400/60 bg-orange-500/15 text-orange-100 hover:bg-orange-500/30',
                mode === 'move' ? 'cursor-move' : 'cursor-pointer',
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
