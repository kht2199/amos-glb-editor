import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { useEditorStore } from '../store/editor-store'
import type { LiftEntity, PortEntity, ReadOnlyEntity } from '../types'

type SceneEntity = LiftEntity | PortEntity | ReadOnlyEntity

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

function selectedEntity(entities: SceneEntity[], selectedId: string | null) {
  if (!selectedId) return null
  return entities.find((entity) => entity.editorId === selectedId) ?? null
}

function CameraRig({ entities, selectedId, controlsRef }: { entities: SceneEntity[]; selectedId: string | null; controlsRef: React.RefObject<any> }) {
  const { camera } = useThree()

  useEffect(() => {
    const bounds = computeBounds(entities)
    const focused = selectedEntity(entities, selectedId)
    const target = focused ? entityCenter(focused) : bounds.center.clone()
    const planarSpan = Math.max(bounds.size.x, bounds.size.y)
    const heightSpan = Math.max(bounds.size.z, 60)
    const distance = Math.max(planarSpan * 0.95, 120)

    camera.position.set(
      target.x - distance * 0.42,
      target.y + distance,
      target.z + heightSpan * 1.1,
    )
    camera.near = 0.1
    camera.far = Math.max(1600, distance * 12)
    camera.updateProjectionMatrix()
    camera.lookAt(target)

    const controls = controlsRef.current
    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, controlsRef, entities, selectedId])

  return null
}

function ReadonlyProxy({ entity, selected }: { entity: ReadOnlyEntity; selected: boolean }) {
  return (
    <group position={[entity.position.x, entity.position.y, entity.position.z + entity.height / 2]}>
      <mesh>
        <boxGeometry args={[entity.width, entity.depth, entity.height]} />
        <meshStandardMaterial color="#64748b" transparent opacity={0.2} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh scale={[1.03, 1.03, 1.03]}>
        <boxGeometry args={[entity.width, entity.depth, entity.height]} />
        <meshBasicMaterial color={selected ? '#f8fafc' : '#94a3b8'} wireframe transparent opacity={selected ? 0.9 : 0.42} />
      </mesh>
    </group>
  )
}

function LiftProxy({ lift, selected }: { lift: LiftEntity; selected: boolean }) {
  const rotation = THREE.MathUtils.degToRad(lift.rotation)
  const shaftWidth = Math.max(lift.width * 0.42, 12)
  const shaftDepth = Math.max(lift.depth * 0.42, 12)
  const bandHeight = Math.max(lift.height * 0.08, 4)

  return (
    <group position={[lift.position.x, lift.position.y, lift.position.z]} rotation={[0, 0, rotation]}>
      <mesh position={[0, 0, lift.height / 2]}>
        <boxGeometry args={[lift.width, lift.depth, lift.height]} />
        <meshStandardMaterial color="#2563eb" transparent opacity={0.18} roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, lift.height / 2]}>
        <boxGeometry args={[shaftWidth, shaftDepth, lift.height]} />
        <meshStandardMaterial color="#bfdbfe" emissive="#60a5fa" emissiveIntensity={0.48} roughness={0.36} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0, bandHeight / 2 + 1]}>
        <boxGeometry args={[lift.width * 1.06, lift.depth * 1.06, bandHeight]} />
        <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.42} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0, lift.height - bandHeight / 2 - 1]}>
        <boxGeometry args={[lift.width * 1.06, lift.depth * 1.06, bandHeight]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.42} transparent opacity={0.88} />
      </mesh>
      <mesh scale={[1.04, 1.04, 1.02]} position={[0, 0, lift.height / 2]}>
        <boxGeometry args={[lift.width, lift.depth, lift.height]} />
        <meshBasicMaterial color={selected ? '#f8fafc' : '#0f172a'} wireframe transparent opacity={selected ? 0.95 : 0.46} />
      </mesh>
    </group>
  )
}

function PortProxy({ port, selected }: { port: PortEntity; selected: boolean }) {
  const isTop = port.level === 'TOP'
  const bodyColor = isTop ? '#22d3ee' : '#fb923c'
  const emissive = isTop ? '#0891b2' : '#ea580c'
  const accentColor = isTop ? '#67e8f9' : '#fdba74'

  return (
    <group position={[port.position.x, port.position.y, port.position.z + port.height / 2]}>
      <mesh>
        <boxGeometry args={[Math.max(port.width, 8), Math.max(port.depth, 8), Math.max(port.height, 8)]} />
        <meshStandardMaterial color={bodyColor} emissive={emissive} emissiveIntensity={0.9} roughness={0.32} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0, -Math.max(port.height, 8) * 0.32]}>
        <boxGeometry args={[Math.max(port.width * 1.45, 12), Math.max(port.depth * 0.4, 4), 3]} />
        <meshStandardMaterial color={accentColor} emissive={emissive} emissiveIntensity={0.35} transparent opacity={0.92} />
      </mesh>
      <mesh scale={[1.12, 1.12, 1.12]}>
        <boxGeometry args={[Math.max(port.width, 8), Math.max(port.depth, 8), Math.max(port.height, 8)]} />
        <meshBasicMaterial color={selected ? '#f8fafc' : accentColor} wireframe transparent opacity={selected ? 0.95 : 0.72} />
      </mesh>
    </group>
  )
}

function PreviewProxyScene() {
  const { lifts, ports, readonlyObjects, selectedId } = useEditorStore(useShallow((state) => ({
    lifts: state.appliedLifts,
    ports: state.appliedPorts,
    readonlyObjects: state.appliedReadonlyObjects,
    selectedId: state.selectedId,
  })))

  return (
    <group>
      {readonlyObjects.map((entity) => <ReadonlyProxy key={entity.editorId} entity={entity} selected={entity.editorId === selectedId} />)}
      {lifts.map((lift) => <LiftProxy key={lift.editorId} lift={lift} selected={lift.editorId === selectedId} />)}
      {visiblePorts(ports).map((port) => <PortProxy key={port.editorId} port={port} selected={port.editorId === selectedId} />)}
    </group>
  )
}

export function PreviewSceneCanvas() {
  const controlsRef = useRef<any>(null)
  const { lifts, ports, readonlyObjects, selectedId } = useEditorStore(useShallow((state) => ({
    lifts: state.appliedLifts,
    ports: state.appliedPorts,
    readonlyObjects: state.appliedReadonlyObjects,
    selectedId: state.selectedId,
  })))

  const entities = useMemo(() => allEntities(lifts, ports, readonlyObjects), [lifts, ports, readonlyObjects])

  return (
    <Canvas camera={{ position: [120, 120, 90], fov: 34 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <CameraRig entities={entities} selectedId={selectedId} controlsRef={controlsRef} />
      <color attach="background" args={['#dbeafe']} />
      <ambientLight intensity={1.4} />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.1]} />
      <directionalLight position={[80, 100, 80]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-70, 40, 90]} intensity={0.9} color="#dbeafe" />
      <pointLight position={[-40, 10, 60]} intensity={1.1} distance={360} color="#ffffff" />
      <Grid args={[420, 420]} cellColor="#94a3b8" sectionColor="#64748b" fadeDistance={460} fadeStrength={1.1} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <axesHelper args={[80]} />
      <PreviewProxyScene />
      <GizmoHelper alignment="bottom-right" margin={[88, 88]} renderPriority={2}>
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
