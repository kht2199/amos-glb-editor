import { createDemoScene } from '../src/lib/demoScene.ts'
import { exportGlb, loadGlbFile } from '../src/lib/glb.ts'

class SimpleFileReader {
  result: ArrayBuffer | string | null = null
  onload: ((event: { target: SimpleFileReader }) => void) | null = null
  onloadend: ((event: { target: SimpleFileReader }) => void) | null = null
  onerror: ((error: unknown) => void) | null = null

  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer
        this.onload?.({ target: this })
        this.onloadend?.({ target: this })
      })
      .catch((error) => this.onerror?.(error))
  }

  readAsDataURL(blob: Blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        const base64 = Buffer.from(buffer).toString('base64')
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`
        this.onload?.({ target: this })
        this.onloadend?.({ target: this })
      })
      .catch((error) => this.onerror?.(error))
  }
}

globalThis.FileReader = SimpleFileReader as unknown as typeof FileReader

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const { scene, bundle } = createDemoScene()
  const blob = await exportGlb({
    pristineScene: scene,
    lifts: bundle.lifts,
    ports: bundle.ports,
    backgroundObjects: bundle.backgroundObjects,
    animations: [],
  })

  const roundtripFile = new File([blob], 'roundtrip-demo-scene.glb', { type: 'model/gltf-binary' })
  const loaded = await loadGlbFile(roundtripFile)

  assert(loaded.bundle.lifts.length === bundle.lifts.length, `Lift count mismatch: ${loaded.bundle.lifts.length} !== ${bundle.lifts.length}`)
  assert(loaded.bundle.ports.length === bundle.ports.length, `Port count mismatch: ${loaded.bundle.ports.length} !== ${bundle.ports.length}`)
  assert(loaded.bundle.backgroundObjects.length === bundle.backgroundObjects.length, `Background object count mismatch: ${loaded.bundle.backgroundObjects.length} !== ${bundle.backgroundObjects.length}`)

  const liftA = loaded.bundle.lifts.find((lift) => lift.id === 'lift_a')
  assert(liftA, 'lift_a missing after round-trip')
  assert(liftA.slotsPerFace === 6, `lift_a slotsPerFace mismatch: ${liftA.slotsPerFace}`)

  const stockerAccess = loaded.bundle.ports.find((port) => port.id === 'stocker_access_01')
  assert(stockerAccess, 'stocker_access_01 missing after round-trip')
  assert(stockerAccess.semanticRole === 'STOCKER_ACCESS', `stocker_access_01 semanticRole mismatch: ${stockerAccess.semanticRole}`)
  assert(stockerAccess.domainParentType === 'Stocker', `stocker_access_01 domainParentType mismatch: ${stockerAccess.domainParentType}`)
  assert(stockerAccess.domainParentId === 'stocker_01', `stocker_access_01 domainParentId mismatch: ${stockerAccess.domainParentId}`)

  const summary = {
    bytes: (await blob.arrayBuffer()).byteLength,
    lifts: loaded.bundle.lifts.map((lift) => ({ id: lift.id, rotation: lift.rotation, slotsPerFace: lift.slotsPerFace })),
    ports: loaded.bundle.ports.map((port) => ({
      id: port.id,
      semanticRole: port.semanticRole,
      domainParentType: port.domainParentType,
      domainParentId: port.domainParentId,
      slot: port.slot,
      face: port.face,
      z: port.position.z,
      zOffset: port.zOffset ?? null,
    })),
    backgroundObjects: loaded.bundle.backgroundObjects.map((item) => ({ id: item.id, objectType: item.objectType })),
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
