import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { useEditorStore } from '../store/editor-store'
import { buildAppliedScene } from '../lib/glb'
import type { LiftEntity, PortEntity, BackgroundObjectEntity } from '../types'

type SceneEntity = LiftEntity | PortEntity | BackgroundObjectEntity
type OrbitControlsHandle = ComponentRef<typeof OrbitControls>
type CameraViewMode = 'overview' | 'selection'

function clampDistance(value: number) {
  return Math.min(Math.max(value, 120), 320)
}

function computeCameraPose(target: THREE.Vector3, size: THREE.Vector3, mode: CameraViewMode) {
  const planarSpan = Math.max(size.x, size.y)
  const heightSpan = Math.max(size.z, 60)
  const distance = mode === 'selection'
    ? clampDistance(Math.max(planarSpan * 1.6, heightSpan * 2, 90))
    : clampDistance(Math.max(planarSpan * 1.3, heightSpan * 1.9, 150))

  const offset = mode === 'selection'
    ? new THREE.Vector3(-0.9, -0.95, 0.78)
    : new THREE.Vector3(-0.82, -1.08, 0.92)

  return target.clone().add(offset.normalize().multiplyScalar(distance))
}

function visiblePorts(ports: PortEntity[]) {
  return ports.filter((port) => !port.deleted)
}

function allEntities(lifts: LiftEntity[], ports: PortEntity[], backgroundObjects: BackgroundObjectEntity[]) {
  return [...backgroundObjects, ...lifts, ...visiblePorts(ports)]
}

function entityCenter(entity: SceneEntity) {
  return new THREE.Vector3(
    entity.position.x,
    entity.position.y,
    entity.position.z + entity.height / 2,
  )
}

function computeBounds(entities: SceneEntity[]) {
  if (!entities.length) {
    return {
      center: new THREE.Vector3(0, 0, 20),
      size: new THREE.Vector3(160, 160, 80),
    }
  }

  const box = new THREE.Box3()
  entities.forEach((entity) => {
    const center = entityCenter(entity)
    const half = new THREE.Vector3(entity.width / 2, entity.depth / 2, entity.height / 2)
    box.expandByPoint(center.clone().sub(half))
    box.expandByPoint(center.clone().add(half))
  })

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  return {
    center,
    size: new THREE.Vector3(
      Math.max(size.x, 160),
      Math.max(size.y, 160),
      Math.max(size.z, 80),
    ),
  }
}

function findSceneNodeByEditorId(root: THREE.Object3D, editorId: string | null) {
  if (!editorId) return null
  let result: THREE.Object3D | null = null
  root.traverse((child) => {
    if (result) return
    if (child.userData?.editorMeta?.id === editorId) result = child
  })
  return result
}

function computeSceneBounds(sceneRoot: THREE.Object3D) {
  sceneRoot.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(sceneRoot)
  if (box.isEmpty()) return null
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  return {
    center,
    size: new THREE.Vector3(
      Math.max(size.x, 160),
      Math.max(size.y, 160),
      Math.max(size.z, 80),
    ),
  }
}

function selectedEntity(entities: SceneEntity[], selectedId: string | null) {
  if (!selectedId) return null
  return entities.find((entity) => entity.editorId === selectedId) ?? null
}

function selectionBounds(sceneRoot: THREE.Object3D | null, entities: SceneEntity[], selectedId: string | null) {
  if (!selectedId) return null

  const selectedSceneNode = sceneRoot ? findSceneNodeByEditorId(sceneRoot, selectedId) : null
  const selectedSceneBounds = selectedSceneNode ? computeSceneBounds(selectedSceneNode) : null
  if (selectedSceneBounds) return selectedSceneBounds

  const focused = selectedEntity(entities, selectedId)
  if (!focused) return null

  return {
    center: entityCenter(focused),
    size: new THREE.Vector3(
      Math.max(focused.width, 40),
      Math.max(focused.depth, 40),
      Math.max(focused.height, 40),
    ),
  }
}

function CameraRig({
  entities,
  selectedId,
  controlsRef,
  sceneRoot,
  viewMode,
  viewNonce,
}: {
  entities: SceneEntity[]
  selectedId: string | null
  controlsRef: React.RefObject<OrbitControlsHandle | null>
  sceneRoot: THREE.Object3D | null
  viewMode: CameraViewMode
  viewNonce: number
}) {
  const { camera } = useThree()

  useEffect(() => {
    const sceneBounds = sceneRoot ? computeSceneBounds(sceneRoot) : null
    const fallbackBounds = computeBounds(entities)
    const bounds = sceneBounds ?? fallbackBounds
    const focusedBounds = selectionBounds(sceneRoot, entities, selectedId)
    const activeBounds = viewMode === 'selection' && focusedBounds ? focusedBounds : bounds
    const target = activeBounds.center.clone()
    const cameraPosition = computeCameraPose(target, activeBounds.size, viewMode)

    camera.up.set(0, 0, 1)
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
    camera.lookAt(target.x, target.y, target.z)

    const controls = controlsRef.current
    if (controls) {
      controls.object.up.set(0, 0, 1)
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, controlsRef, entities, sceneRoot, selectedId, viewMode, viewNonce])

  return null
}

export function PreviewSceneCanvas() {
  const controlsRef = useRef<OrbitControlsHandle | null>(null)
  const [viewMode, setViewMode] = useState<CameraViewMode>('overview')
  const [viewNonce, setViewNonce] = useState(0)
  const { lifts, ports, backgroundObjects, selectedId, pristineScene } = useEditorStore(useShallow((state) => ({
    lifts: state.appliedLifts,
    ports: state.appliedPorts,
    backgroundObjects: state.appliedBackgroundObjects,
    selectedId: state.selectedId,
    pristineScene: state.runtime.pristineScene,
  })))

  const entities = useMemo(() => allEntities(lifts, ports, backgroundObjects), [lifts, ports, backgroundObjects])
  const previewScene = useMemo(() => {
    if (!pristineScene) return null
    return buildAppliedScene({
      pristineScene,
      lifts,
      ports,
      backgroundObjects,
    })
  }, [pristineScene, lifts, ports, backgroundObjects])

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setViewMode('overview')
            setViewNonce((value) => value + 1)
          }}
          className="pointer-events-auto rounded-lg border border-slate-700/80 bg-slate-950/85 px-3 py-2 text-xs font-medium text-slate-100 shadow-sm transition hover:border-slate-500 hover:text-white"
        >
          Reset View
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => {
            if (!selectedId) return
            setViewMode('selection')
            setViewNonce((value) => value + 1)
          }}
          className="pointer-events-auto rounded-lg border border-slate-700/80 bg-slate-950/85 px-3 py-2 text-xs font-medium text-slate-100 shadow-sm transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        >
          Focus Selection
        </button>
      </div>
      <Canvas
        camera={{ position: [120, 120, 90], fov: 34, near: 0.1, far: 1600 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#dbeafe', 1)
        }}
      >
        <CameraRig
          entities={entities}
          selectedId={selectedId}
          controlsRef={controlsRef}
          sceneRoot={previewScene}
          viewMode={viewMode}
          viewNonce={viewNonce}
        />
        <color attach="background" args={['#dbeafe']} />
        <ambientLight intensity={1.4} />
        <hemisphereLight args={['#ffffff', '#cbd5e1', 1.1]} />
        <directionalLight position={[80, 100, 80]} intensity={1.35} color="#ffffff" />
        <directionalLight position={[-70, 40, 90]} intensity={0.9} color="#dbeafe" />
        <pointLight position={[-40, 10, 60]} intensity={1.1} distance={360} color="#ffffff" />
        <Grid args={[420, 420]} cellColor="#94a3b8" sectionColor="#64748b" fadeDistance={460} fadeStrength={1.1} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <axesHelper args={[80]} />
        {previewScene ? <primitive object={previewScene} /> : null}
        <GizmoHelper alignment="bottom-right" margin={[88, 88]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#0f172a" />
        </GizmoHelper>
        <OrbitControls
          ref={controlsRef}
          makeDefault
          minDistance={40}
          maxDistance={320}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
      </Canvas>
    </div>
  )
}
