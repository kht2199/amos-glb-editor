import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { createDemoScene } from './demoScene'
import { exportGlb, loadGlbFile } from './glb'
import { createPortNode } from './portVisual'
import type { PortEntity } from '../types'

function makePort(overrides: Partial<PortEntity> = {}): PortEntity {
  return {
    id: 'port_test_01',
    editorId: 'port_test_01',
    label: 'Port Test 01',
    objectType: 'Port',
    nodeName: 'Port_Test_01',
    parentLiftId: 'lift_a',
    domainParentId: 'lift_a',
    domainParentType: 'Lift',
    semanticRole: 'LIFT_DOCK',
    portType: 'IN',
    face: 'FRONT',
    slot: 1,
    position: { x: 0, y: 0, z: 10 },
    width: 8,
    depth: 8,
    height: 8,
    created: true,
    ...overrides,
  }
}

async function exportRawSceneToFile(scene: THREE.Scene, fileName: string) {
  const exporter = new GLTFExporter()
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true }) as ArrayBuffer
  return new File([arrayBuffer], fileName, { type: 'model/gltf-binary' })
}

describe('GLB round-trip and visual bounds', () => {
  it('keeps lift dimensions and port domain metadata after export/import', async () => {
    const { scene, bundle } = createDemoScene()
    const blob = await exportGlb({
      pristineScene: scene,
      lifts: bundle.lifts,
      ports: bundle.ports,
      readonlyObjects: bundle.readonlyObjects,
      animations: [],
    })

    const file = new File([blob], 'roundtrip.glb', { type: 'model/gltf-binary' })
    const loaded = await loadGlbFile(file)

    expect(loaded.bundle.lifts).toHaveLength(bundle.lifts.length)
    expect(loaded.bundle.ports).toHaveLength(bundle.ports.length)
    expect(loaded.bundle.readonlyObjects).toHaveLength(bundle.readonlyObjects.length)

    const originalLift = bundle.lifts.find((lift) => lift.id === 'lift_a')
    const loadedLift = loaded.bundle.lifts.find((lift) => lift.id === 'lift_a')
    expect(loadedLift).toBeTruthy()
    expect(loadedLift?.slotsPerFace).toBe(originalLift?.slotsPerFace)
    expect(loadedLift?.rotation).toBe(originalLift?.rotation)
    expect(loadedLift?.width).toBeCloseTo(originalLift?.width ?? 0, 0)
    expect(loadedLift?.depth).toBeCloseTo(originalLift?.depth ?? 0, 0)

    const stockerAccess = loaded.bundle.ports.find((port) => port.id === 'stocker_access_01')
    expect(stockerAccess).toBeTruthy()
    expect(stockerAccess?.semanticRole).toBe('STOCKER_ACCESS')
    expect(stockerAccess?.domainParentType).toBe('Stocker')
    expect(stockerAccess?.domainParentId).toBe('stocker_01')
    expect(stockerAccess?.parentLiftId).toBeUndefined()

    expect(loaded.bundle.ports.some((port) => port.id === 'Port_Template')).toBe(false)
  })

  it('preserves custom port z offset during export/import round-trip', async () => {
    const { scene, bundle } = createDemoScene()
    const source = bundle.ports.find((port) => port.id === 'port_a_01')
    const shiftedPorts = bundle.ports.map((port) => port.id === 'port_a_01'
      ? {
        ...port,
        zOffset: (source?.zOffset ?? source?.position.z ?? 0) + 13,
        position: { ...port.position, z: ((source?.zOffset ?? source?.position.z ?? 0) + 13) + (bundle.lifts.find((lift) => lift.editorId === port.parentLiftId)?.position.z ?? 0) },
      }
      : port)

    const blob = await exportGlb({
      pristineScene: scene,
      lifts: bundle.lifts,
      ports: shiftedPorts,
      readonlyObjects: bundle.readonlyObjects,
      animations: [],
    })

    const file = new File([blob], 'port-z-offset.glb', { type: 'model/gltf-binary' })
    const loaded = await loadGlbFile(file)
    const reloaded = loaded.bundle.ports.find((port) => port.id === 'port_a_01')
    const expected = shiftedPorts.find((port) => port.id === 'port_a_01')

    expect(reloaded?.zOffset).toBe(expected?.zOffset)
    expect(reloaded?.position.z).toBe(expected?.position.z)
  })

  it('preserves explicit readonly objectType metadata over name heuristics during round-trip', async () => {
    const { scene, bundle } = createDemoScene()
    const reclassified = bundle.readonlyObjects.map((item) => item.id === 'stocker_01'
      ? { ...item, objectType: 'Bridge' as const }
      : item)

    const blob = await exportGlb({
      pristineScene: scene,
      lifts: bundle.lifts,
      ports: bundle.ports,
      readonlyObjects: reclassified,
      animations: [],
    })

    const file = new File([blob], 'object-type-priority.glb', { type: 'model/gltf-binary' })
    const loaded = await loadGlbFile(file)
    const reloaded = loaded.bundle.readonlyObjects.find((item) => item.id === 'stocker_01')

    expect(reloaded?.objectType).toBe('Bridge')
  })

  it('infers stocker access metadata from raw node names when editorMeta is missing', async () => {
    const scene = new THREE.Scene()

    const lift = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 18), new THREE.MeshBasicMaterial())
    lift.name = 'Lift_A'
    lift.position.set(0, 0, 9)
    scene.add(lift)

    const stocker = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 24), new THREE.MeshBasicMaterial())
    stocker.name = 'Stocker_01'
    stocker.position.set(40, 0, 12)
    scene.add(stocker)

    const accessPort = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial())
    accessPort.name = 'Stocker_Access_Port_07_Bottom_Out'
    accessPort.position.set(36, 0, 4)
    scene.add(accessPort)

    const loaded = await loadGlbFile(await exportRawSceneToFile(scene, 'raw-name-inference.glb'))
    const inferred = loaded.bundle.ports.find((port) => port.nodeName === 'Stocker_Access_Port_07_Bottom_Out')

    expect(inferred).toBeTruthy()
    expect(inferred?.semanticRole).toBe('STOCKER_ACCESS')
    expect(inferred?.domainParentType).toBe('Stocker')
    expect(inferred?.domainParentId).toBe('Stocker_01')
    expect(inferred?.portType).toBe('OUT')
    expect(inferred?.slot).toBe(7)
  })

  it('ignores nested child meshes under typed parents during import', async () => {
    const scene = new THREE.Scene()
    const lift = new THREE.Group()
    lift.name = 'Lift_A'
    lift.position.set(0, 0, 0)

    const shell = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 18), new THREE.MeshBasicMaterial())
    shell.name = 'lift_shell_panel'
    shell.position.set(0, 0, 9)
    lift.add(shell)
    scene.add(lift)

    const loaded = await loadGlbFile(await exportRawSceneToFile(scene, 'nested-children.glb'))

    expect(loaded.bundle.lifts).toHaveLength(1)
    expect(loaded.bundle.readonlyObjects).toHaveLength(0)
    expect(loaded.bundle.ports).toHaveLength(0)
  })

  it('creates port visuals that stay within a predictable logical envelope', () => {
    const liftDock = createPortNode(makePort())
    const stockerAccess = createPortNode(makePort({
      id: 'stocker_access_01',
      editorId: 'stocker_access_01',
      nodeName: 'Stocker_Access_01',
      domainParentId: 'stocker_01',
      domainParentType: 'Stocker',
      semanticRole: 'STOCKER_ACCESS',
      parentLiftId: undefined,
      width: 10,
      depth: 10,
      height: 10,
    }))

    const liftDockSize = new THREE.Vector3()
    new THREE.Box3().setFromObject(liftDock).getSize(liftDockSize)

    const stockerAccessSize = new THREE.Vector3()
    new THREE.Box3().setFromObject(stockerAccess).getSize(stockerAccessSize)

    expect(liftDock.userData.editorMeta?.semanticRole).toBe('LIFT_DOCK')
    expect(stockerAccess.userData.editorMeta?.semanticRole).toBe('STOCKER_ACCESS')

    expect(liftDockSize.x).toBeLessThanOrEqual(8.5)
    expect(liftDockSize.y).toBeLessThanOrEqual(8.5)
    expect(liftDockSize.z).toBeLessThanOrEqual(8.5)

    expect(stockerAccessSize.x).toBeLessThanOrEqual(10.5)
    expect(stockerAccessSize.y).toBeLessThanOrEqual(10.5)
    expect(stockerAccessSize.z).toBeLessThanOrEqual(10.5)
  })
})
