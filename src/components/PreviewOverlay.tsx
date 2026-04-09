import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Grid, OrbitControls } from '@react-three/drei'
import { X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { cubicInOut } from '../lib/utils'
import { useEditorStore } from '../store/editor-store'

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

export function PreviewOverlay() {
  const { isPreviewOpen, runtime, selectedId, setPreviewOpen } = useEditorStore(useShallow((state) => ({
    isPreviewOpen: state.isPreviewOpen,
    runtime: state.runtime,
    selectedId: state.selectedId,
    setPreviewOpen: state.setPreviewOpen,
  })))

  if (!isPreviewOpen || !runtime.workingScene) return null

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-50">Preview Overlay</h2>
            <p className="text-xs text-slate-400">Read-only orbit preview · selected {selectedId ?? 'None'}</p>
          </div>
          <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1">
          <Canvas camera={{ position: [120, 120, 120], fov: 40 }}>
            <color attach="background" args={['#020617']} />
            <ambientLight intensity={0.9} />
            <directionalLight position={[60, 80, 40]} intensity={1.2} />
            <Grid args={[400, 400]} cellColor="#1e293b" sectionColor="#334155" position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <AnimatedScene scene={runtime.workingScene} />
            <Environment preset="city" />
            <OrbitControls makeDefault />
          </Canvas>
        </div>
      </div>
    </div>
  )
}
