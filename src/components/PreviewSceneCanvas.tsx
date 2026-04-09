import { Environment, GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useEditorStore } from '../store/editor-store'
import { cubicInOut } from '../lib/utils'
import * as THREE from 'three'

function AnimatedScene({ scene }: { scene: THREE.Group }) {
  const lifts = useEditorStore((state) => state.lifts)
  const animatedRef = useRef(scene.clone(true))
  const liftAnimations = useMemo(() => new Map(lifts.map((lift) => [lift.editorId, lift.animation])), [lifts])

  useFrame(({ clock }) => {
    animatedRef.current.traverse((child: THREE.Object3D) => {
      const meta = child.userData?.editorMeta
      if (!meta || meta.objectType !== 'Lift') return
      const animation = liftAnimations.get(meta.id)
      if (!animation?.enabled) return
      const duration = Math.max(animation.speed, 0.2)
      const elapsed = (clock.getElapsedTime() / duration) % 1
      const eased = cubicInOut(elapsed)
      const range = animation.maxZ - animation.minZ
      child.position.z = animation.minZ + range * eased + 10
    })
  })

  return <primitive object={animatedRef.current} />
}

function CameraRig({ scene, controlsRef }: { scene: THREE.Group; controlsRef: { current: any } }) {
  const { camera } = useThree()

  useEffect(() => {
    const bounds = new THREE.Box3().setFromObject(scene)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const planarSpan = Math.max(size.x, size.y, 120)
    const distance = planarSpan * 0.82
    const target = center.clone()
    target.z = center.z + Math.max(4, size.z * 0.12)

    camera.position.set(center.x - planarSpan * 0.12, center.y + distance, center.z + distance * 0.78)
    camera.near = 0.1
    camera.far = Math.max(1200, planarSpan * 8)
    camera.updateProjectionMatrix()
    camera.lookAt(target)

    const controls = controlsRef.current
    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, controlsRef, scene])

  return null
}

export function PreviewSceneCanvas({ scene }: { scene: THREE.Group }) {
  const controlsRef = useRef<any>(null)

  return (
    <Canvas camera={{ position: [150, 170, 150], fov: 38 }}>
      <CameraRig scene={scene} controlsRef={controlsRef} />
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 220, 540]} />
      <ambientLight intensity={1.18} />
      <hemisphereLight args={['#dbeafe', '#0f172a', 1.12]} />
      <directionalLight position={[70, 90, 45]} intensity={1.35} />
      <directionalLight position={[-80, 40, 90]} intensity={0.72} color="#dbeafe" />
      <pointLight position={[-60, -26, 24]} intensity={0.9} distance={180} color="#7dd3fc" />
      <pointLight position={[-60, -26, 4]} intensity={0.85} distance={160} color="#fdba74" />
      <Grid args={[400, 400]} cellColor="#334155" sectionColor="#475569" fadeDistance={260} fadeStrength={1.4} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <AnimatedScene scene={scene} />
      <Environment preset="city" />
      <GizmoHelper alignment="bottom-right" margin={[88, 88]} renderPriority={2}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#e2e8f0" />
      </GizmoHelper>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={80}
        maxDistance={420}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />
    </Canvas>
  )
}
