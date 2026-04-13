import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { cn, round } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'
import type { BackgroundObjectEntity, LiftEntity, PortEntity, TopViewEditPlane, TopViewFrame, Vec3 } from '../types'

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type PlaneAxis = 'x' | 'y' | 'z'

type SceneEntity = LiftEntity | PortEntity | BackgroundObjectEntity

const PLANE_AXES: Record<TopViewEditPlane, { horizontal: PlaneAxis; vertical: PlaneAxis }> = {
  xy: { horizontal: 'x', vertical: 'y' },
  xz: { horizontal: 'x', vertical: 'z' },
  yz: { horizontal: 'y', vertical: 'z' },
}

function axisDirectionSign(direction: TopViewFrame['xAxisDirection'] | TopViewFrame['yAxisDirection']) {
  return direction === 'right' || direction === 'up' ? 1 : -1
}

function axisValue(position: Vec3, axis: PlaneAxis) {
  return position[axis]
}

function axisSize(entity: SceneEntity, axis: PlaneAxis) {
  if (axis === 'x') return entity.width
  if (axis === 'y') return entity.depth
  return entity.height
}

function planeAxes(frame: TopViewFrame) {
  return PLANE_AXES[frame.editPlane]
}

function lockedAxis(frame: TopViewFrame): PlaneAxis {
  const axes = planeAxes(frame)
  return (['x', 'y', 'z'] as const).find((axis) => axis !== axes.horizontal && axis !== axes.vertical) ?? 'z'
}

function planePoint(frame: TopViewFrame, position: Vec3) {
  const axes = planeAxes(frame)
  return {
    x: axisValue(position, axes.horizontal),
    y: axisValue(position, axes.vertical),
  }
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

function projectEntityPoint(frame: TopViewFrame, position: Vec3) {
  const point = planePoint(frame, position)
  return toFrameCoordinates(frame, point.x, point.y)
}

function applyProjectedPosition(position: Vec3, frame: TopViewFrame, projectedX: number, projectedY: number): Vec3 {
  const world = fromFrameCoordinates(frame, projectedX, projectedY)
  const axes = planeAxes(frame)
  return {
    ...position,
    [axes.horizontal]: world.x,
    [axes.vertical]: world.y,
  }
}

function computeBounds(
  lifts: LiftEntity[],
  ports: PortEntity[],
  backgroundObjects: BackgroundObjectEntity[],
  frame: TopViewFrame,
): Bounds {
  const entities = [...lifts, ...ports.filter((port) => !port.deleted), ...backgroundObjects]
  const axes = planeAxes(frame)
  if (!entities.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
  return entities.reduce<Bounds>((acc, item) => {
    const point = projectEntityPoint(frame, item.position)
    return {
      minX: Math.min(acc.minX, point.x - axisSize(item, axes.horizontal) / 2 - 20),
      maxX: Math.max(acc.maxX, point.x + axisSize(item, axes.horizontal) / 2 + 20),
      minY: Math.min(acc.minY, point.y - axisSize(item, axes.vertical) / 2 - 20),
      maxY: Math.max(acc.maxY, point.y + axisSize(item, axes.vertical) / 2 + 20),
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

function project(bounds: Bounds, width: number, height: number, position: Vec3, frame: TopViewFrame) {
  const padding = 40
  const scale = getProjectionScale(bounds, width, height)
  const point = projectEntityPoint(frame, position)
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
    updateLift,
    updatePort,
    updateBackgroundObject,
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
    updateLift: state.updateLift,
    updatePort: state.updatePort,
    updateBackgroundObject: state.updateBackgroundObject,
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

  const currentAxes = planeAxes(topViewFrame)
  const freeAxis = lockedAxis(topViewFrame)
  const primaryAxisLabel = currentAxes.horizontal.toUpperCase()
  const secondaryAxisLabel = currentAxes.vertical.toUpperCase()
  const freeAxisLabel = freeAxis.toUpperCase()
  const planeLabel = topViewFrame.editPlane.toUpperCase()
  const frameSummary = `Edit plane ${planeLabel} · Origin (${topViewFrame.originX}, ${topViewFrame.originY}) · ${primaryAxisLabel}+ ${topViewFrame.xAxisDirection} · ${secondaryAxisLabel}+ ${topViewFrame.yAxisDirection}`
  const selectedEntity = selectedId ? visibleEntities[selectedId] ?? null : null

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

  function handleFreeAxisChange(value: string) {
    if (!selectedEntity) return
    const parsed = Number(value)
    const nextValue = Number.isFinite(parsed) ? parsed : 0
    const nextPosition = { ...selectedEntity.position, [freeAxis]: nextValue }

    if ('rotation' in selectedEntity) {
      updateLift(selectedEntity.editorId, { position: nextPosition })
      return
    }

    if ('portType' in selectedEntity) {
      updatePort(selectedEntity.editorId, { position: nextPosition })
      return
    }

    updateBackgroundObject(selectedEntity.editorId, { position: nextPosition })
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

  function updateDraggedEntity(editorId: string, projectedX: number, projectedY: number) {
    const entity = visibleEntities[editorId]
    if (!entity) return
    const nextPosition = applyProjectedPosition(entity.position, topViewFrame, projectedX, projectedY)

    if (topViewFrame.editPlane === 'xy') {
      moveEntity(editorId, nextPosition.x, nextPosition.y)
      return
    }

    if ('rotation' in entity) {
      updateLift(editorId, { position: nextPosition })
      return
    }

    if ('portType' in entity) {
      updatePort(editorId, { position: nextPosition })
      return
    }

    updateBackgroundObject(editorId, { position: nextPosition })
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
    if (visibleEntities[draggingId]) updateDraggedEntity(draggingId, world.x, world.y)
  }

  return (
    <section className="order-1 relative flex min-h-[62svh] flex-col bg-slate-950/30 lg:order-2 lg:h-full lg:min-h-0">
      <div data-testid="top-view-settings" className="order-2 flex flex-col gap-2 border-b border-slate-800 px-3 py-2 text-sm text-slate-300 sm:px-4 sm:py-3 lg:order-1 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="font-semibold text-slate-100">GLB Plane Editor</h2>
          <p className="text-xs text-slate-500">{planeLabel} plane editing · XY snap/attach 유지 · XZ/YZ alternate up-axis 지원</p>
          <p className="mt-1 text-xs text-slate-400">{frameSummary}</p>
        </div>

        <div data-testid="top-view-settings-grid" className="grid grid-cols-2 gap-2 text-xs text-slate-300 xl:grid-cols-6">
          <label className="flex min-w-0 flex-col gap-1">
            <span>Edit Plane</span>
            <select
              aria-label="Edit Plane"
              value={topViewFrame.editPlane}
              onChange={(event) => setTopViewFrame({ editPlane: event.target.value as TopViewEditPlane })}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            >
              <option value="xy">xy</option>
              <option value="xz">xz</option>
              <option value="yz">yz</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span>{`Reference ${primaryAxisLabel}`}</span>
            <input
              aria-label={`Reference ${primaryAxisLabel}`}
              type="number"
              value={topViewFrame.originX}
              onChange={(event) => handleFrameNumberChange('originX', event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span>{`Reference ${secondaryAxisLabel}`}</span>
            <input
              aria-label={`Reference ${secondaryAxisLabel}`}
              type="number"
              value={topViewFrame.originY}
              onChange={(event) => handleFrameNumberChange('originY', event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span>{`${primaryAxisLabel} Axis Positive`}</span>
            <select
              aria-label={`${primaryAxisLabel} Axis Positive`}
              value={topViewFrame.xAxisDirection}
              onChange={(event) => setTopViewFrame({ xAxisDirection: event.target.value as TopViewFrame['xAxisDirection'] })}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            >
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </label>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 xl:col-span-1">
            <span>{`${secondaryAxisLabel} Axis Positive`}</span>
            <select
              aria-label={`${secondaryAxisLabel} Axis Positive`}
              value={topViewFrame.yAxisDirection}
              onChange={(event) => setTopViewFrame({ yAxisDirection: event.target.value as TopViewFrame['yAxisDirection'] })}
              className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
            >
              <option value="up">up</option>
              <option value="down">down</option>
            </select>
          </label>
          {selectedEntity ? (
            <label className="col-span-2 flex min-w-0 flex-col gap-1 xl:col-span-1">
              <span>{`${freeAxisLabel} Position`}</span>
              <input
                aria-label={`${freeAxisLabel} Position`}
                type="number"
                value={selectedEntity.position[freeAxis]}
                onChange={(event) => handleFreeAxisChange(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-slate-100"
              />
              <span className="text-[11px] text-slate-500">{`${planeLabel} plane에서 이동되지 않는 축: ${freeAxisLabel}`}</span>
            </label>
          ) : null}
        </div>
      </div>

      <div
        data-testid="top-view-canvas-surface"
        ref={canvasRef}
        className="editor-grid order-1 relative min-h-[34svh] flex-1 overflow-hidden lg:order-2 lg:min-h-0"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDragState}
        onPointerLeave={clearDragState}
      >
        <div className="absolute left-4 top-4 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">Ports {visiblePorts.length} · {mode}{collisionIssues.length ? ` · collisions ${collisionIssues.length}` : ''}</div>

        {collisionConnections.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {collisionConnections.map((connection) => {
              const source = project(bounds, canvasSize.width, canvasSize.height, connection.source.position, topViewFrame)
              const target = project(bounds, canvasSize.width, canvasSize.height, connection.target.position, topViewFrame)
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
          const center = project(bounds, canvasSize.width, canvasSize.height, item.position, topViewFrame)
          const colliding = Boolean(collisionIndex[item.editorId]?.length)
          const projectedWidth = axisSize(item, currentAxes.horizontal) * center.scale
          const projectedHeight = Math.max(18, axisSize(item, currentAxes.vertical) * center.scale)
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
              style={{ left: center.x - projectedWidth / 2, top: center.y - projectedHeight / 2, width: projectedWidth, height: projectedHeight }}
            >
              <div className="flex h-full items-center justify-center">{item.id}</div>
              {colliding && <span className="absolute -right-2 -top-2 rounded-full border border-rose-200 bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{collisionIndex[item.editorId].length}</span>}
            </div>
          )
        })}

        {lifts.map((lift) => {
          const center = project(bounds, canvasSize.width, canvasSize.height, lift.position, topViewFrame)
          const colliding = Boolean(collisionIndex[lift.editorId]?.length)
          const projectedWidth = axisSize(lift, currentAxes.horizontal) * center.scale
          const projectedHeight = Math.max(32, axisSize(lift, currentAxes.vertical) * center.scale)
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
              style={{ left: center.x - projectedWidth / 2, top: center.y - projectedHeight / 2, width: projectedWidth, height: projectedHeight, transform: topViewFrame.editPlane === 'xy' ? `rotate(${-lift.rotation}deg)` : undefined }}
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
          const center = project(bounds, canvasSize.width, canvasSize.height, port.position, topViewFrame)
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
