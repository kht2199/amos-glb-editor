import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'

beforeEach(() => {
  localStorage.clear()
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
    expect(useEditorStore.getState().saveState).toBe('unsaved')
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

  it('reassigns a port to the nearest lift when dragged', () => {
    const state = useEditorStore.getState()
    const sourcePort = state.draftPorts.find((port) => !port.deleted)
    const targetLift = state.draftLifts[1]
    expect(sourcePort).toBeTruthy()
    expect(targetLift).toBeTruthy()

    useEditorStore.getState().movePortByWorld(sourcePort!.editorId, targetLift.position.x, targetLift.position.y)
    const moved = useEditorStore.getState().draftPorts.find((port) => port.editorId === sourcePort!.editorId)

    expect(moved?.parentLiftId).toBe(targetLift.editorId)
  })

  it('moves readonly objects in move mode', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftReadonlyObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.selectObject(stocker!.editorId)
    state.setMode('move')
    state.moveEntity(stocker!.editorId, stocker!.position.x + 20, stocker!.position.y - 15)

    const moved = useEditorStore.getState().draftReadonlyObjects.find((item) => item.editorId === stocker!.editorId)
    expect(moved?.position.x).toBe(stocker!.position.x + 20)
    expect(moved?.position.y).toBe(stocker!.position.y - 15)
    expect(useEditorStore.getState().saveState).toBe('unsaved')
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

  it('reclassifies a readonly object into a lift', () => {
    const state = useEditorStore.getState()
    const stocker = state.draftReadonlyObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.selectObject(stocker!.editorId)
    state.setObjectType(stocker!.editorId, 'Lift')

    const next = useEditorStore.getState()
    const convertedLift = next.draftLifts.find((item) => item.editorId === stocker!.editorId)

    expect(convertedLift).toBeTruthy()
    expect(convertedLift?.objectType).toBe('Lift')
    expect(convertedLift?.animation.enabled).toBe(true)
    expect(next.draftReadonlyObjects.some((item) => item.editorId === stocker!.editorId)).toBe(false)
    expect(next.selectedId).toBe(stocker!.editorId)
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

  it('blocks export while draft changes are still pending', async () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]

    state.moveLift(lift.editorId, lift.position.x + 15, lift.position.y)
    expect(useEditorStore.getState().hasPendingChanges).toBe(true)

    await useEditorStore.getState().exportCurrentGlb()

    expect(useEditorStore.getState().exportFeedback.status).toBe('blocked')
    expect(useEditorStore.getState().exportFeedback.message).toMatch(/Apply or revert/i)
  })
})
