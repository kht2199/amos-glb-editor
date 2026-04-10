import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { useEditorStore } from '../store/editor-store'
import { buildAppliedScene } from '../lib/glb'
import type { LiftEntity, PortEntity, ReadOnlyEntity } from '../types'

type SceneEntity = LiftEntity | PortEntity | ReadOnlyEntity
type OrbitControlsHandle = ComponentRef<typeof OrbitControls>

function visiblePorts(ports: PortEntity[]) {
  return ports.filter((port) => !port.deleted)
}

function allEntities(lifts: LiftEntity[], ports: PortEntity[], readonlyObjects: ReadOnlyEntity[]) {
  return [...readonlyObjects, ...lifts, ...visiblePorts(ports)]
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

function CameraRig({
  entities,
  selectedId,
  controlsRef,
  sceneRoot,
}: {
  entities: SceneEntity[]
  selectedId: string | null
  controlsRef: React.RefObject<OrbitControlsHandle | null>
  sceneRoot: THREE.Object3D | null
}) {
  const { camera } = useThree()

  useEffect(() => {
    const sceneBounds = sceneRoot ? computeSceneBounds(sceneRoot) : null
    const fallbackBounds = computeBounds(entities)
    const bounds = sceneBounds ?? fallbackBounds
    const selectedSceneNode = sceneRoot ? findSceneNodeByEditorId(sceneRoot, selectedId) : null
    const selectedSceneBounds = selectedSceneNode ? computeSceneBounds(selectedSceneNode) : null
    const focused = selectedEntity(entities, selectedId)
    const target = selectedSceneBounds?.center
      ?? (focused ? entityCenter(focused) : bounds.center.clone())
    const planarSpan = Math.max(bounds.size.x, bounds.size.y)
    const heightSpan = Math.max(bounds.size.z, 60)
    const distance = Math.max(planarSpan * 0.95, 120)

    camera.up.set(0, 0, 1)
    camera.position.set(
      target.x - distance * 0.42,
      target.y - distance * 1.08,
      target.z + heightSpan * 1.18,
    )
    camera.lookAt(target)

    const controls = controlsRef.current
    if (controls) {
      controls.object.up.set(0, 0, 1)
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, controlsRef, entities, sceneRoot, selectedId])

  return null
}

export function PreviewSceneCanvas() {
  const controlsRef = useRef<OrbitControlsHandle | null>(null)
  const { lifts, ports, readonlyObjects, selectedId, pristineScene } = useEditorStore(useShallow((state) => ({
    lifts: state.appliedLifts,
    ports: state.appliedPorts,
    readonlyObjects: state.appliedReadonlyObjects,
    selectedId: state.selectedId,
    pristineScene: state.runtime.pristineScene,
  })))

  const entities = useMemo(() => allEntities(lifts, ports, readonlyObjects), [lifts, ports, readonlyObjects])
  const previewScene = useMemo(() => {
    if (!pristineScene) return null
    return buildAppliedScene({
      pristineScene,
      lifts,
      ports,
      readonlyObjects,
    })
  }, [pristineScene, lifts, ports, readonlyObjects])

  return (
    <Canvas
      camera={{ position: [120, 120, 90], fov: 34, near: 0.1, far: 1600 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#dbeafe', 1)
      }}
    >
      <CameraRig entities={entities} selectedId={selectedId} controlsRef={controlsRef} sceneRoot={previewScene} />
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
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.08}
      />
    </Canvas>
  )
}
