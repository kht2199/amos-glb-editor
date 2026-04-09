import type { EditorAnimation } from '../types'

export const STORAGE_KEY = 'threejs-object-editor-session'

export const DEFAULT_ANIMATION: EditorAnimation = {
  enabled: false,
  speed: 1,
  initialPosition: 0,
  initialDirection: 'UP',
  acceleration: 0.2,
  easing: 'cubicInOut',
  minZ: 0,
  maxZ: 20,
}
