import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createDemoScene } from '../lib/demoScene'
import { exportGlb } from '../lib/glb'
import { computePortPosition } from '../lib/utils'
import { useEditorStore } from './editor-store'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

describe('editor store', () => {
  it('loads demo scene and allows selecting plus moving a lift', () => {
    const state = useEditorStore.getState()
    expect(state.fileName).toBe('demo-scene.glb')

    const lift = state.draftLifts[0]
    state.selectObject(lift.editorId)
    state.setMode('move')
    state.moveEntity(lift.editorId, 25, 35)

    const next = useEditorStore.getState().draftLifts.find((item) => item.editorId === lift.editorId)
    expect(next?.position.x).toBe(25)
    expect(next?.position.y).toBe(35)
    expect(useEditorStore.getState().statusMessage).toBe('Lift moved')
  })

  it('duplicates the selected port as a new draft port', () => {
    const state = useEditorStore.getState()
    const sourcePort = state.draftPorts.find((item) => !item.deleted && item.parentLiftId)

    expect(sourcePort).toBeTruthy()
    state.selectObject(sourcePort!.editorId)
    state.duplicateSelectedObject()

    const next = useEditorStore.getState()
    const created = next.draftPorts.find((item) => item.editorId === next.selectedId)
    expect(created).toBeTruthy()
    expect(created?.created).toBe(true)
    expect(created?.id).toMatch(new RegExp(`^${sourcePort!.id}_copy_`))
    expect(created?.editorId).not.toBe(sourcePort?.editorId)
    expect(created?.slot).toBeGreaterThanOrEqual(sourcePort!.slot)
  })

  it('supports undo and redo for lift movement', () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]
    const originalX = lift.position.x

    state.moveLift(lift.editorId, originalX + 40, lift.position.y)
    expect(useEditorStore.getState().canUndo).toBe(true)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().draftLifts[0].position.x).toBe(originalX)
    expect(useEditorStore.getState().canRedo).toBe(true)

    useEditorStore.getState().redo()
    expect(useEditorStore.getState().draftLifts[0].position.x).toBe(originalX + 40)
  })

  it('moves a port freely without snapping it back to a lift', () => {
    const state = useEditorStore.getState()
    const sourcePort = state.draftPorts.find((port) => !port.deleted)
    const targetLift = state.draftLifts[1]
    expect(sourcePort).toBeTruthy()
    expect(targetLift).toBeTruthy()

    useEditorStore.getState().movePortByWorld(sourcePort!.editorId, targetLift.position.x + 23, targetLift.position.y - 19)
    const moved = useEditorStore.getState().draftPorts.find((port) => port.editorId === sourcePort!.editorId)

    expect(moved?.position.x).toBe(targetLift.position.x + 23)
    expect(moved?.position.y).toBe(targetLift.position.y - 19)
    expect(moved?.parentLiftId).toBeUndefined()
    expect(moved?.domainParentType).toBe('Transport')
  })

  it('detaches a lift-linked port when x/y is edited directly', () => {
    const state = useEditorStore.getState()
    const port = state.draftPorts.find((item) => !item.deleted && item.parentLiftId)

    expect(port).toBeTruthy()
    state.updatePort(port!.editorId, {
      position: {
        x: port!.position.x + 11,
        y: port!.position.y + 7,
        z: port!.position.z,
      },
    })

    const updated = useEditorStore.getState().draftPorts.find((item) => item.editorId === port!.editorId)
    expect(updated?.position.x).toBe(port!.position.x + 11)
    expect(updated?.position.y).toBe(port!.position.y + 7)
    expect(updated?.parentLiftId).toBeUndefined()
    expect(updated?.domainParentId).toBe('')
    expect(updated?.domainParentType).toBe('Transport')
  })

  it('keeps lift-linked ports synchronized when the parent lift moves', () => {
    const state = useEditorStore.getState()
    const port = state.draftPorts.find((item) => !item.deleted && item.parentLiftId)
    const lift = state.draftLifts.find((item) => item.editorId === port?.parentLiftId)

    expect(port).toBeTruthy()
    expect(lift).toBeTruthy()

    state.moveEntity(lift!.editorId, lift!.position.x + 15, lift!.position.y - 9)

    const updatedLift = useEditorStore.getState().draftLifts.find((item) => item.editorId === lift!.editorId)
    const updatedPort = useEditorStore.getState().draftPorts.find((item) => item.editorId === port!.editorId)
    const expectedPosition = computePortPosition(updatedLift!, port!.face, port!.slot, port!.zOffset ?? (port!.position.z - lift!.position.z))

    expect(updatedPort?.position).toEqual(expectedPosition)
  })

  it('moves background objects in move mode', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.selectObject(stocker!.editorId)
    state.setMode('move')
    state.moveEntity(stocker!.editorId, stocker!.position.x + 20, stocker!.position.y - 15)

    const moved = useEditorStore.getState().draftBackgroundObjects.find((item) => item.editorId === stocker!.editorId)
    expect(moved?.position.x).toBe(stocker!.position.x + 20)
    expect(moved?.position.y).toBe(stocker!.position.y - 15)
    expect(useEditorStore.getState().statusMessage).toBe('Stocker moved')
  })

  it('keeps a custom port z offset when face or slot changes', () => {
    const state = useEditorStore.getState()
    const port = state.draftPorts.find((item) => !item.deleted && item.parentLiftId)

    expect(port).toBeTruthy()
    state.updatePort(port!.editorId, { position: { ...port!.position, z: port!.position.z + 17 } })
    state.updatePort(port!.editorId, { face: 'RIGHT', slot: 2 })

    const updated = useEditorStore.getState().draftPorts.find((item) => item.editorId === port!.editorId)
    expect(updated?.position.z).toBe(port!.position.z + 17)
  })

  it('keeps a lift-linked port attached when only z changes', () => {
    const state = useEditorStore.getState()
    const port = state.draftPorts.find((item) => !item.deleted && item.parentLiftId)

    expect(port).toBeTruthy()
    state.updatePort(port!.editorId, {
      position: {
        ...port!.position,
        z: port!.position.z + 9,
      },
    })

    const updated = useEditorStore.getState().draftPorts.find((item) => item.editorId === port!.editorId)
    expect(updated?.parentLiftId).toBe(port!.parentLiftId)
    expect(updated?.domainParentType).toBe('Lift')
    expect(updated?.position.z).toBe(port!.position.z + 9)
  })

  it('reclassifies a background object into a lift', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.selectObject(stocker!.editorId)
    state.setObjectType(stocker!.editorId, 'Lift')

    const next = useEditorStore.getState()
    const convertedLift = next.draftLifts.find((item) => item.editorId === stocker!.editorId)

    expect(convertedLift).toBeTruthy()
    expect(convertedLift?.objectType).toBe('Lift')
    expect(convertedLift?.animation.enabled).toBe(true)
    expect(next.draftBackgroundObjects.some((item) => item.editorId === stocker!.editorId)).toBe(false)
    expect(next.selectedId).toBe(stocker!.editorId)
  })

  it('reclassifies a background object into a standalone port', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.setObjectType(stocker!.editorId, 'Port')

    const next = useEditorStore.getState()
    const convertedPort = next.draftPorts.find((item) => item.editorId === stocker!.editorId)

    expect(convertedPort).toBeTruthy()
    expect(convertedPort?.domainParentId).toBe('')
    expect(convertedPort?.domainParentType).toBe('Transport')
  })

  it('allows adding a screen-configured type and reclassifying an object to it', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.addObjectTypeDefinition({ name: 'Tool', category: 'background' })
    state.setObjectType(stocker!.editorId, 'Tool')

    const next = useEditorStore.getState()
    const converted = next.draftBackgroundObjects.find((item) => item.editorId === stocker!.editorId)

    expect(next.objectTypeDefinitions.some((item) => item.name === 'Tool' && item.category === 'background')).toBe(true)
    expect(converted?.objectType).toBe('Tool')
    expect(next.selectedId).toBe(stocker!.editorId)
  })

  it('prevents removing a custom type while any draft or applied entity still uses it', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.addObjectTypeDefinition({ name: 'Tool', category: 'lift' })
    state.setObjectType(stocker!.editorId, 'Tool')
    state.applyDraftChanges()
    state.removeObjectTypeDefinition('Tool')

    const next = useEditorStore.getState()
    expect(next.objectTypeDefinitions.some((item) => item.name === 'Tool')).toBe(true)
    expect(next.statusMessage).toBe('Tool is in use and cannot be removed')
  })

  it('applies draft changes into applied state and clears pending history', () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]
    const originalApplied = state.appliedLifts.find((item) => item.editorId === lift.editorId)

    state.moveLift(lift.editorId, lift.position.x + 55, lift.position.y)
    const moved = useEditorStore.getState().draftLifts.find((item) => item.editorId === lift.editorId)
    expect(moved).toBeTruthy()
    expect(moved?.position.x).not.toBe(originalApplied?.position.x)
    expect(useEditorStore.getState().hasPendingChanges).toBe(true)
    expect(useEditorStore.getState().canUndo).toBe(true)

    state.applyDraftChanges()

    const next = useEditorStore.getState()
    const applied = next.appliedLifts.find((item) => item.editorId === lift.editorId)
    const currentDraft = next.draftLifts.find((item) => item.editorId === lift.editorId)
    expect(next.hasPendingChanges).toBe(false)
    expect(applied?.position.x).toBe(moved?.position.x)
    expect(currentDraft?.position.x).toBe(moved?.position.x)
    expect(next.canUndo).toBe(false)
    expect(next.canRedo).toBe(false)
  })

  it('reverts draft changes back to the applied state', () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]
    const originalApplied = state.appliedLifts.find((item) => item.editorId === lift.editorId)

    state.moveLift(lift.editorId, lift.position.x + 70, lift.position.y)
    const moved = useEditorStore.getState().draftLifts.find((item) => item.editorId === lift.editorId)
    expect(moved?.position.x).not.toBe(originalApplied?.position.x)
    expect(useEditorStore.getState().hasPendingChanges).toBe(true)

    state.revertDraftChanges()

    const next = useEditorStore.getState()
    const reverted = next.draftLifts.find((item) => item.editorId === lift.editorId)
    const applied = next.appliedLifts.find((item) => item.editorId === lift.editorId)
    expect(next.hasPendingChanges).toBe(false)
    expect(reverted?.position.x).toBe(originalApplied?.position.x)
    expect(applied?.position.x).toBe(originalApplied?.position.x)
    expect(next.canUndo).toBe(false)
    expect(next.canRedo).toBe(false)
  })

  it('updates top-view frame without affecting undo history or pending draft state', () => {
    const state = useEditorStore.getState()

    state.setTopViewFrame({
      originX: 120,
      originY: -35,
      xAxisDirection: 'left',
      yAxisDirection: 'down',
      editPlane: 'xz',
    })

    const next = useEditorStore.getState()
    expect(next.topViewFrame).toEqual({
      originX: 120,
      originY: -35,
      xAxisDirection: 'left',
      yAxisDirection: 'down',
      editPlane: 'xz',
    })
    expect(next.hasPendingChanges).toBe(false)
    expect(next.canUndo).toBe(false)
    expect(next.canRedo).toBe(false)
  })

  it('applies uniform scale to lifts and keeps dimensions in sync', () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]

    state.updateLift(lift.editorId, { scale: { x: 1.5, y: 1.5, z: 1.5 } })

    const next = useEditorStore.getState().draftLifts.find((item) => item.editorId === lift.editorId)
    expect(next?.scale).toEqual({ x: 1.5, y: 1.5, z: 1.5 })
    expect(next?.width).toBeCloseTo(lift.width * 1.5, 5)
    expect(next?.depth).toBeCloseTo(lift.depth * 1.5, 5)
    expect(next?.height).toBeCloseTo(lift.height * 1.5, 5)
  })

  it('applies uniform scale to ports and background objects', () => {
    const state = useEditorStore.getState()
    const port = state.draftPorts.find((item) => !item.deleted)
    const background = state.draftBackgroundObjects[0]

    expect(port).toBeTruthy()
    state.updatePort(port!.editorId, { scale: { x: 1.25, y: 1.25, z: 1.25 } })
    state.updateBackgroundObject(background.editorId, { scale: { x: 0.8, y: 0.8, z: 0.8 } })

    const next = useEditorStore.getState()
    const scaledPort = next.draftPorts.find((item) => item.editorId === port!.editorId)
    const scaledBackground = next.draftBackgroundObjects.find((item) => item.editorId === background.editorId)

    expect(scaledPort?.scale).toEqual({ x: 1.25, y: 1.25, z: 1.25 })
    expect(scaledPort?.width).toBeCloseTo(port!.width * 1.25, 5)
    expect(scaledBackground?.scale).toEqual({ x: 0.8, y: 0.8, z: 0.8 })
    expect(scaledBackground?.height).toBeCloseTo(background.height * 0.8, 5)
  })

  it('imports another GLB into the current scene instead of replacing it', async () => {
    const initial = useEditorStore.getState()
    const { scene, bundle } = createDemoScene()
    const blob = await exportGlb({
      pristineScene: scene,
      lifts: bundle.lifts,
      ports: bundle.ports,
      backgroundObjects: bundle.backgroundObjects,
      animations: [],
    })

    await initial.importFile(new File([blob], 'extra-scene.glb', { type: 'model/gltf-binary' }))

    const next = useEditorStore.getState()
    expect(next.draftLifts.length).toBe(initial.draftLifts.length * 2)
    expect(next.draftPorts.length).toBe(initial.draftPorts.length * 2)
    expect(next.draftBackgroundObjects.length).toBe(initial.draftBackgroundObjects.length * 2)
    expect(new Set(next.draftLifts.map((item) => item.id)).size).toBe(next.draftLifts.length)
    expect(new Set(next.draftLifts.map((item) => item.editorId)).size).toBe(next.draftLifts.length)
    expect(next.statusMessage).toBe('extra-scene.glb imported')
    expect(next.hasPendingChanges).toBe(false)
  })

  it('remaps imported animation track targets to the renamed nodes', async () => {
    const initial = useEditorStore.getState()
    const { scene, bundle } = createDemoScene()
    const sourceLift = bundle.lifts[0]
    const clip = new THREE.AnimationClip('lift-bob', 1, [
      new THREE.NumberKeyframeTrack(`${sourceLift.nodeName}.position[z]`, [0, 1], [sourceLift.position.z, sourceLift.position.z + 5]),
    ])
    const blob = await exportGlb({
      pristineScene: scene,
      lifts: bundle.lifts,
      ports: bundle.ports,
      backgroundObjects: bundle.backgroundObjects,
      animations: [clip],
    })

    await initial.importFile(new File([blob], 'animated-extra.glb', { type: 'model/gltf-binary' }))

    const next = useEditorStore.getState()
    const importedTrackNames = next.runtime.animations.flatMap((animation) => animation.tracks.map((track) => track.name))
    const remappedTrackName = importedTrackNames.find((trackName) => trackName !== `${sourceLift.nodeName}.position[z]`)

    expect(remappedTrackName).toBeTruthy()
    expect(remappedTrackName).toContain('.')
    expect(remappedTrackName).not.toBe(`${sourceLift.nodeName}.position`)
    expect(remappedTrackName).toBe(`Lift_A_02.position`)
    expect(importedTrackNames.filter((trackName) => trackName === `${sourceLift.nodeName}.position[z]`)).toHaveLength(0)
  })

  it('blocks export while draft changes are still pending', async () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]

    state.moveLift(lift.editorId, lift.position.x + 15, lift.position.y)
    expect(useEditorStore.getState().hasPendingChanges).toBe(true)

    await useEditorStore.getState().exportCurrentGlb()

    expect(useEditorStore.getState().exportFeedback.status).toBe('blocked')
    expect(useEditorStore.getState().exportFeedback.message).toMatch(/Apply or revert/i)
  })

  it('blocks importing another GLB while draft changes are pending', async () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]
    const initialLiftCount = state.draftLifts.length
    const { scene, bundle } = createDemoScene()
    const blob = await exportGlb({
      pristineScene: scene,
      lifts: bundle.lifts,
      ports: bundle.ports,
      backgroundObjects: bundle.backgroundObjects,
      animations: [],
    })

    state.moveLift(lift.editorId, lift.position.x + 10, lift.position.y)
    expect(useEditorStore.getState().hasPendingChanges).toBe(true)

    await useEditorStore.getState().importFile(new File([blob], 'blocked-extra.glb', { type: 'model/gltf-binary' }))

    const next = useEditorStore.getState()
    expect(next.statusMessage).toMatch(/Apply or revert draft changes before importing another GLB/i)
    expect(next.draftLifts).toHaveLength(initialLiftCount)
  })
})
