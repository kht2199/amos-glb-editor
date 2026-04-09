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

    const lift = state.lifts[0]
    state.selectObject(lift.editorId)
    state.setMode('moveLift')
    state.moveLift(lift.editorId, 25, 35)

    const next = useEditorStore.getState().lifts.find((item) => item.editorId === lift.editorId)
    expect(next?.position.x).toBe(25)
    expect(next?.position.y).toBe(35)
    expect(useEditorStore.getState().saveState).toBe('unsaved')
  })

  it('creates a new port from add-port draft', () => {
    const state = useEditorStore.getState()
    state.beginAddPort()
    state.updateAddPortDraft({ id: 'port_new_01', slot: 2, face: 'LEFT', level: 'BOTTOM', portType: 'OUT' })
    state.confirmAddPort()

    const created = useEditorStore.getState().ports.find((item) => item.id === 'port_new_01')
    expect(created).toBeTruthy()
    expect(created?.created).toBe(true)
    expect(created?.face).toBe('LEFT')
  })

  it('supports undo and redo for lift movement', () => {
    const state = useEditorStore.getState()
    const lift = state.lifts[0]
    const originalX = lift.position.x

    state.moveLift(lift.editorId, originalX + 40, lift.position.y)
    expect(useEditorStore.getState().canUndo).toBe(true)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().lifts[0].position.x).toBe(originalX)
    expect(useEditorStore.getState().canRedo).toBe(true)

    useEditorStore.getState().redo()
    expect(useEditorStore.getState().lifts[0].position.x).toBe(originalX + 40)
  })

  it('reassigns a port to the nearest lift when dragged', () => {
    const state = useEditorStore.getState()
    const sourcePort = state.ports.find((port) => !port.deleted)
    const targetLift = state.lifts[1]
    expect(sourcePort).toBeTruthy()
    expect(targetLift).toBeTruthy()

    useEditorStore.getState().movePortByWorld(sourcePort!.editorId, targetLift.position.x, targetLift.position.y)
    const moved = useEditorStore.getState().ports.find((port) => port.editorId === sourcePort!.editorId)

    expect(moved?.parentLiftId).toBe(targetLift.editorId)
  })

  it('reclassifies a readonly object into a lift', () => {
    const state = useEditorStore.getState()
    const stocker = state.readonlyObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    state.selectObject(stocker!.editorId)
    state.setObjectType(stocker!.editorId, 'Lift')

    const next = useEditorStore.getState()
    const convertedLift = next.lifts.find((item) => item.editorId === stocker!.editorId)

    expect(convertedLift).toBeTruthy()
    expect(convertedLift?.objectType).toBe('Lift')
    expect(convertedLift?.animation.enabled).toBe(true)
    expect(next.readonlyObjects.some((item) => item.editorId === stocker!.editorId)).toBe(false)
    expect(next.selectedId).toBe(stocker!.editorId)
  })
})
