import * as THREE from 'three'
import type { PortEntity } from '../types'

export const PORT_TEMPLATE_NAME = 'Port_Template'

const materials = {
  portFrameNeutral: new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.52, metalness: 0.12 }),
  portFramePrimary: new THREE.MeshStandardMaterial({ color: '#67e8f9', emissive: '#155e75', emissiveIntensity: 0.95, roughness: 0.32, metalness: 0.14 }),
  portDockPrimary: new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0c4a6e', emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.12 }),
  portAccent: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4, metalness: 0.04 }),
  portAccess: new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5, metalness: 0.16 }),
  portShelf: new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.36, metalness: 0.08 }),
  portIndicatorIn: new THREE.MeshStandardMaterial({ color: '#10b981', emissive: '#065f46', emissiveIntensity: 0.5 }),
  portIndicatorOut: new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#7f1d1d', emissiveIntensity: 0.5 }),
  portIndicatorInOut: new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#78350f', emissiveIntensity: 0.45 }),
}

function addBox(parent: THREE.Object3D, geometry: THREE.BoxGeometry, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function faceRotation(face: PortEntity['face']) {
  if (face === 'RIGHT') return -Math.PI / 2
  if (face === 'LEFT') return Math.PI / 2
  if (face === 'BACK') return Math.PI
  return 0
}

function indicatorMaterial(portType: PortEntity['portType']) {
  if (portType === 'IN') return materials.portIndicatorIn
  if (portType === 'OUT') return materials.portIndicatorOut
  return materials.portIndicatorInOut
}

function buildPortVisual(group: THREE.Group, port: Pick<PortEntity, 'width' | 'depth' | 'height' | 'semanticRole' | 'portType'>) {
  const frameWidth = Math.max(7, port.width)
  const frameDepth = Math.max(5, port.depth * 0.72)
  const dockDepth = Math.max(2.8, frameDepth * 0.52)
  const baseHeight = Math.max(1.1, port.height * 0.16)
  const dockHeight = Math.max(1.8, port.height * 0.28)
  const accessHeight = Math.max(1.1, port.height * 0.14)
  const frameMaterial = materials.portFramePrimary
  const dockMaterial = materials.portDockPrimary

  addBox(group, new THREE.BoxGeometry(frameWidth, frameDepth, baseHeight), materials.portFrameNeutral, 0, 0, baseHeight / 2)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.92, frameDepth * 0.28, accessHeight), materials.portAccess, 0, frameDepth * 0.34, baseHeight + accessHeight / 2)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.82, dockDepth, dockHeight), dockMaterial, 0, -frameDepth * 0.04, baseHeight + dockHeight / 2)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.72, dockDepth * 0.58, Math.max(0.8, dockHeight * 0.36)), materials.portAccent, 0, -frameDepth * 0.2, baseHeight + dockHeight * 0.72)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.82, 0.7, 0.5), frameMaterial, 0, frameDepth * 0.36, baseHeight + dockHeight * 0.7)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.76, 0.9, 1.3), materials.portShelf, 0, -frameDepth * 0.58, baseHeight + 1.1)
  addBox(group, new THREE.BoxGeometry(0.9, 0.7, 0.6), indicatorMaterial(port.portType), frameWidth * 0.28, frameDepth * 0.36, baseHeight + dockHeight + 0.24)

  if (port.semanticRole === 'STOCKER_ACCESS') {
    addBox(group, new THREE.BoxGeometry(frameWidth * 0.94, 1.2, 1.4), materials.portFrameNeutral, 0, -frameDepth * 0.52, baseHeight + 0.7)
    addBox(group, new THREE.BoxGeometry(frameWidth * 0.62, 1, 0.9), materials.portAccess, 0, -frameDepth * 0.6, baseHeight + 1.7)
    return
  }

  addBox(group, new THREE.BoxGeometry(frameWidth * 0.22, frameDepth * 0.72, 1.1), frameMaterial, -frameWidth * 0.34, 0, baseHeight + 0.55)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.08, frameDepth * 0.72, 1.7), dockMaterial, frameWidth * 0.36, 0, baseHeight + 0.85)

  addBox(group, new THREE.BoxGeometry(frameWidth * 0.18, 1.1, 1.1), frameMaterial, -frameWidth * 0.18, frameDepth * 0.18, baseHeight + dockHeight + 0.1)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.18, 1.1, 1.1), frameMaterial, frameWidth * 0.18, frameDepth * 0.18, baseHeight + dockHeight + 0.1)
  addBox(group, new THREE.BoxGeometry(frameWidth * 0.48, 0.9, 0.8), frameMaterial, 0, frameDepth * 0.28, baseHeight + dockHeight + 0.55)
}

export function createPortNode(port: PortEntity, options?: { visible?: boolean; objectType?: 'Port' | 'PortTemplate'; editorId?: string; name?: string }) {
  const group = new THREE.Group()
  group.name = options?.name ?? port.nodeName
  group.visible = options?.visible ?? true
  group.position.set(port.position.x, port.position.y, port.position.z)
  group.rotation.z = faceRotation(port.face)
  group.userData = {
    editorMeta: {
      id: options?.editorId ?? port.editorId,
      objectType: options?.objectType ?? 'Port',
      entityId: port.id,
      semanticRole: port.semanticRole,
      domainParentId: port.domainParentId,
      domainParentType: port.domainParentType,
      parentLiftId: port.parentLiftId,
      portType: port.portType,
      face: port.face,
      slot: port.slot,
    },
  }

  buildPortVisual(group, port)
  return group
}

export function createPortTemplateNode() {
  const templatePort: PortEntity = {
    id: 'port_template',
    editorId: 'port_template',
    label: 'Port Template',
    objectType: 'Port',
    nodeName: PORT_TEMPLATE_NAME,
    parentLiftId: 'lift_template',
    domainParentId: 'lift_template',
    domainParentType: 'Lift',
    semanticRole: 'LIFT_DOCK',
    portType: 'INOUT',
    face: 'FRONT',
    slot: 1,
    position: { x: 0, y: 0, z: 0 },
    width: 8,
    depth: 8,
    height: 8,
    created: false,
    templateNodeName: PORT_TEMPLATE_NAME,
  }

  return createPortNode(templatePort, {
    visible: false,
    objectType: 'PortTemplate',
    editorId: 'port_template',
    name: PORT_TEMPLATE_NAME,
  })
}