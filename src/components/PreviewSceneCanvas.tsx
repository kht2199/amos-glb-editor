import { Environment, Grid, OrbitControls } from '@react-three/drei'
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
    const distance = planarSpan * 0.92

    camera.position.set(center.x, center.y + distance, center.z + distance)
    camera.near = 0.1
    camera.far = Math.max(1200, planarSpan * 8)
    camera.updateProjectionMatrix()

    const controls = controlsRef.current
    if (controls) {
      controls.target.copy(center)
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
      <color attach="background" args={['#020617']} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[70, 90, 45]} intensity={1.15} />
      <Grid args={[400, 400]} cellColor="#1e293b" sectionColor="#334155" position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <AnimatedScene scene={scene} />
      <Environment preset="city" />
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
