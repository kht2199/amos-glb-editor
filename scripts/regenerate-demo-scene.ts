import { writeFileSync } from 'node:fs'
import { createDemoScene } from '../src/lib/demoScene.ts'
import { exportGlb } from '../src/lib/glb.ts'

class SimpleFileReader {
  result: ArrayBuffer | string | null = null
  onload: ((event: { target: SimpleFileReader }) => void) | null = null
  onerror: ((error: unknown) => void) | null = null

  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer
        this.onload?.({ target: this })
      })
      .catch((error) => this.onerror?.(error))
  }

  readAsDataURL(blob: Blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        const base64 = Buffer.from(buffer).toString('base64')
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`
        this.onload?.({ target: this })
      })
      .catch((error) => this.onerror?.(error))
  }
}

globalThis.FileReader = SimpleFileReader as unknown as typeof FileReader

async function main() {
  const { scene, bundle } = createDemoScene()
  const blob = await exportGlb({
    pristineScene: scene,
    lifts: bundle.lifts,
    ports: bundle.ports,
    animations: [],
  })

  const buffer = Buffer.from(await blob.arrayBuffer())
  writeFileSync(new URL('../samples/demo-scene.glb', import.meta.url), buffer)

  console.log(JSON.stringify({
    fileName: bundle.fileName,
    lifts: bundle.lifts.length,
    ports: bundle.ports.length,
    readonlyObjects: bundle.readonlyObjects.length,
    bytes: buffer.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
