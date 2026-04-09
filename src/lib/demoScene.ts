import * as THREE from 'three'
import { DEFAULT_ANIMATION } from './constants'
import { createPortNode, createPortTemplateNode } from './portVisual'
import type { LiftEntity, PortEntity, ReadOnlyEntity, SceneBundle } from '../types'
import { computePortPosition } from './utils'

function meta(id: string, objectType: string, extra: Record<string, unknown> = {}) {
  return { editorMeta: { id, objectType, ...extra } }
}

const materials = {
  liftFrame: new THREE.MeshStandardMaterial({ color: '#d8dee9', roughness: 0.58, metalness: 0.18 }),
  liftCage: new THREE.MeshPhysicalMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0.05, transmission: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
  liftCarriage: new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.34, metalness: 0.18 }),
  liftAccent: new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.42, metalness: 0.22 }),
  liftGuide: new THREE.MeshStandardMaterial({ color: '#cbd5e1', emissive: '#334155', emissiveIntensity: 0.28, roughness: 0.36, metalness: 0.18 }),
  liftBandTop: new THREE.MeshStandardMaterial({ color: '#67e8f9', transparent: true, opacity: 0.55, emissive: '#0e7490', emissiveIntensity: 0.95, roughness: 0.26, metalness: 0.08 }),
  liftBandBottom: new THREE.MeshStandardMaterial({ color: '#fdba74', transparent: true, opacity: 0.55, emissive: '#c2410c', emissiveIntensity: 0.95, roughness: 0.28, metalness: 0.08 }),
  liftBandNeutral: new THREE.MeshStandardMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.28, roughness: 0.32, metalness: 0.06 }),
  bridge: new THREE.MeshStandardMaterial({ color: '#94a3b8', transparent: true, opacity: 0.28, roughness: 0.7, metalness: 0.18 }),
  rail: new THREE.MeshStandardMaterial({ color: '#64748b', transparent: true, opacity: 0.32, roughness: 0.62, metalness: 0.3 }),
  stockerShell: new THREE.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.24, roughness: 0.58, metalness: 0.1 }),
  stockerFrame: new THREE.MeshStandardMaterial({ color: '#64748b', transparent: true, opacity: 0.34, roughness: 0.6, metalness: 0.25 }),
  stockerWindow: new THREE.MeshStandardMaterial({ color: '#93c5fd', transparent: true, opacity: 0.1, roughness: 0.12, metalness: 0.02 }),
  stockerCarriage: new THREE.MeshStandardMaterial({ color: '#60a5fa', transparent: true, opacity: 0.4, roughness: 0.3, metalness: 0.2 }),
  stockerBay: new THREE.MeshStandardMaterial({ color: '#334155', transparent: true, opacity: 0.28, roughness: 0.72, metalness: 0.14 }),
  transportBody: new THREE.MeshStandardMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.4, roughness: 0.42, metalness: 0.24 }),
  transportAccent: new THREE.MeshStandardMaterial({ color: '#2563eb', transparent: true, opacity: 0.46, roughness: 0.35, metalness: 0.18 }),
  cleanroomPanel: new THREE.MeshStandardMaterial({ color: '#f8fafc', transparent: true, opacity: 0.1, roughness: 0.95, metalness: 0.02 }),
  cleanroomGrid: new THREE.MeshStandardMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.08, roughness: 0.9, metalness: 0.02 }),
  cleanroomColumn: new THREE.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.14, roughness: 0.78, metalness: 0.06 }),
  cleanroomSupport: new THREE.MeshStandardMaterial({ color: '#cfd8e3', transparent: true, opacity: 0.12, roughness: 0.82, metalness: 0.08 }),
}

function addBox(parent: THREE.Object3D, geometry: THREE.BoxGeometry, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function createCleanroomShell() {
  const shell = new THREE.Group()
  shell.name = 'CleanroomShell'

  const floor = new THREE.Mesh(new THREE.BoxGeometry(260, 220, 2), materials.cleanroomPanel)
  floor.position.set(0, 8, -1)
  shell.add(floor)

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(260, 220, 2), materials.cleanroomPanel)
  ceiling.position.set(0, 8, 40)
  shell.add(ceiling)

  const ceilingGrid = new THREE.Group()
  ceilingGrid.name = 'CeilingGrid'
  for (let x = -110; x <= 110; x += 44) {
    addBox(ceilingGrid, new THREE.BoxGeometry(6, 210, 0.6), materials.cleanroomGrid, x, 8, 38.8)
  }
  for (let y = -86; y <= 102; y += 36) {
    addBox(ceilingGrid, new THREE.BoxGeometry(250, 4, 0.6), materials.cleanroomGrid, 0, y, 38.8)
  }

  for (const x of [-72, 0, 72]) {
    addBox(ceilingGrid, new THREE.BoxGeometry(4, 24, 1.2), materials.cleanroomSupport, x, 70, 37.7)
    addBox(ceilingGrid, new THREE.BoxGeometry(4, 24, 1.2), materials.cleanroomSupport, x, -64, 37.7)
  }
  shell.add(ceilingGrid)

  const columnPositions = [
    [-112, -86],
    [112, -86],
    [-112, 102],
    [112, 102],
  ]
  for (const [x, y] of columnPositions) {
    addBox(shell, new THREE.BoxGeometry(6, 6, 40), materials.cleanroomColumn, x, y, 20)
  }

  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(260, 2, 34), materials.cleanroomGrid)
  rearWall.position.set(0, -100, 17)
  shell.add(rearWall)

  const serviceTray = new THREE.Group()
  serviceTray.name = 'ServiceTray'
  addBox(serviceTray, new THREE.BoxGeometry(144, 3, 1.2), materials.cleanroomSupport, 0, 74, 34)
  addBox(serviceTray, new THREE.BoxGeometry(2.2, 18, 1.2), materials.cleanroomSupport, -70, 74, 34)
  addBox(serviceTray, new THREE.BoxGeometry(2.2, 18, 1.2), materials.cleanroomSupport, 70, 74, 34)
  shell.add(serviceTray)

  return shell
}

function createLiftVisual(lift: LiftEntity) {
  const group = new THREE.Group()
  group.name = lift.nodeName
  group.position.set(lift.position.x, lift.position.y, lift.position.z)
  group.rotation.z = (lift.rotation * Math.PI) / 180
  group.userData = meta(lift.editorId, 'Lift', {
    entityId: lift.id,
    slotsPerFace: lift.slotsPerFace,
    animation: lift.animation,
  })

  const isPrimaryLift = lift.editorId === 'lift_a'
  const lowerBandZ = 2.2
  const upperBandZ = lift.height - 2.2
  const bandMaterialTop = isPrimaryLift ? materials.liftBandTop : materials.liftBandNeutral
  const bandMaterialBottom = isPrimaryLift ? materials.liftBandBottom : materials.liftBandNeutral

  addBox(group, new THREE.BoxGeometry(lift.width, lift.depth, 1.2), materials.liftAccent, 0, 0, 0.6)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.92, lift.depth * 0.82, 1.2), materials.liftFrame, 0, 0, lift.height - 0.6)

  const cageShell = new THREE.Mesh(new THREE.BoxGeometry(lift.width * 0.9, lift.depth * 0.74, lift.height - 2.4), materials.liftCage)
  cageShell.position.set(0, 0, lift.height / 2)
  group.add(cageShell)

  const columnOffsetX = lift.width / 2 - 4
  const columnOffsetY = lift.depth / 2 - 4
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      addBox(group, new THREE.BoxGeometry(3, 3, lift.height - 2), materials.liftFrame, sx * columnOffsetX, sy * columnOffsetY, lift.height / 2)
    }
  }

  addBox(group, new THREE.BoxGeometry(lift.width * 0.88, 2.4, 1.4), materials.liftAccent, 0, lift.depth / 2 - 1.2, 2)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.88, 2.4, 1.4), materials.liftAccent, 0, -lift.depth / 2 + 1.2, 2)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.88, 2.4, 1.4), materials.liftAccent, 0, lift.depth / 2 - 1.2, lift.height - 2)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.88, 2.4, 1.4), materials.liftAccent, 0, -lift.depth / 2 + 1.2, lift.height - 2)

  addBox(group, new THREE.BoxGeometry(2.6, lift.depth * 0.68, lift.height - 3.2), materials.liftFrame, -lift.width * 0.18, 0, lift.height / 2)
  addBox(group, new THREE.BoxGeometry(2.6, lift.depth * 0.68, lift.height - 3.2), materials.liftFrame, lift.width * 0.18, 0, lift.height / 2)
  addBox(group, new THREE.BoxGeometry(1.4, lift.depth * 0.64, lift.height - 5), materials.liftAccent, -lift.width * 0.18, 0, lift.height / 2)
  addBox(group, new THREE.BoxGeometry(1.4, lift.depth * 0.64, lift.height - 5), materials.liftAccent, lift.width * 0.18, 0, lift.height / 2)
  addBox(group, new THREE.BoxGeometry(4.4, lift.depth * 0.26, lift.height - 4.4), materials.liftGuide, 0, 0, lift.height / 2)

  addBox(group, new THREE.BoxGeometry(lift.width * 0.86, lift.depth * 0.9, 1.1), bandMaterialBottom, 0, 0, lowerBandZ)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.86, lift.depth * 0.9, 1.1), bandMaterialTop, 0, 0, upperBandZ)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.52, 3.4, 1.4), bandMaterialBottom, 0, -lift.depth / 2 + 1.7, lowerBandZ + 0.4)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.52, 3.4, 1.4), bandMaterialTop, 0, -lift.depth / 2 + 1.7, upperBandZ + 0.4)

  const carriageZ = Math.min(lift.height * 0.58, Math.max(7, lift.animation.maxZ * 0.5 + 4))
  addBox(group, new THREE.BoxGeometry(lift.width * 0.54, lift.depth * 0.54, 2.8), materials.liftCarriage, 0, 0, carriageZ)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.48, lift.depth * 0.16, 1.4), materials.liftAccent, 0, lift.depth * 0.18, carriageZ + 1.5)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.28, lift.depth * 0.12, 1), materials.liftCarriage, 0, -lift.depth * 0.14, carriageZ + 2.4)
  addBox(group, new THREE.BoxGeometry(2.2, lift.depth * 0.38, 3.4), materials.liftAccent, -lift.width * 0.16, 0, carriageZ + 0.8)
  addBox(group, new THREE.BoxGeometry(2.2, lift.depth * 0.38, 3.4), materials.liftAccent, lift.width * 0.16, 0, carriageZ + 0.8)

  addBox(group, new THREE.BoxGeometry(1, 1, lift.height - carriageZ - 0.8), materials.liftFrame, -lift.width * 0.08, 0, carriageZ + (lift.height - carriageZ - 0.8) / 2)
  addBox(group, new THREE.BoxGeometry(1, 1, lift.height - carriageZ - 0.8), materials.liftFrame, lift.width * 0.08, 0, carriageZ + (lift.height - carriageZ - 0.8) / 2)
  addBox(group, new THREE.BoxGeometry(lift.width * 0.26, 1.2, 1.2), materials.liftAccent, 0, 0, lift.height - 1.6)

  if (isPrimaryLift) {
    addBox(group, new THREE.BoxGeometry(3.8, 3.8, lift.height - 3.2), materials.liftGuide, 0, lift.depth * 0.24, lift.height / 2)
    addBox(group, new THREE.BoxGeometry(12, 2.4, 0.9), bandMaterialTop, 0, -lift.depth / 2 + 1.2, upperBandZ + 1.2)
    addBox(group, new THREE.BoxGeometry(12, 2.4, 0.9), bandMaterialBottom, 0, -lift.depth / 2 + 1.2, lowerBandZ + 1.2)
  }

  return group
}

function createBridgeVisual(item: ReadOnlyEntity) {
  const group = new THREE.Group()
  group.name = item.nodeName
  group.position.set(item.position.x, item.position.y, item.position.z)
  group.userData = meta(item.editorId, item.objectType, { entityId: item.id })

  addBox(group, new THREE.BoxGeometry(item.width, item.depth * 0.5, 3), materials.bridge, 0, 0, item.height * 0.68)
  addBox(group, new THREE.BoxGeometry(item.width, 2, 2), materials.bridge, 0, item.depth * 0.24, item.height * 0.94)
  addBox(group, new THREE.BoxGeometry(item.width, 2, 2), materials.bridge, 0, -item.depth * 0.24, item.height * 0.94)

  for (const x of [-item.width * 0.32, 0, item.width * 0.32]) {
    addBox(group, new THREE.BoxGeometry(3, 3, item.height * 0.68), materials.bridge, x, 0, item.height * 0.34)
  }

  return group
}

function createRailVisual(item: ReadOnlyEntity) {
  const group = new THREE.Group()
  group.name = item.nodeName
  group.position.set(item.position.x, item.position.y, item.position.z)
  group.userData = meta(item.editorId, item.objectType, { entityId: item.id })

  addBox(group, new THREE.BoxGeometry(item.width, 2.2, 1.6), materials.rail, 0, -2.2, item.height * 0.78)
  addBox(group, new THREE.BoxGeometry(item.width, 2.2, 1.6), materials.rail, 0, 2.2, item.height * 0.78)
  addBox(group, new THREE.BoxGeometry(item.width, 4.8, 1), materials.bridge, 0, 0, item.height * 0.52)

  for (const x of [-item.width * 0.35, 0, item.width * 0.35]) {
    addBox(group, new THREE.BoxGeometry(2, 2, item.height * 0.52), materials.bridge, x, 0, item.height * 0.26)
  }

  return group
}

function createStockerVisual(item: ReadOnlyEntity) {
  const group = new THREE.Group()
  group.name = item.nodeName
  group.position.set(item.position.x, item.position.y, item.position.z)
  group.userData = meta(item.editorId, item.objectType, { entityId: item.id })

  addBox(group, new THREE.BoxGeometry(item.width, item.depth, 1.4), materials.stockerFrame, 0, 0, 0.7)
  addBox(group, new THREE.BoxGeometry(item.width, item.depth, 1.2), materials.stockerFrame, 0, 0, item.height - 0.6)
  addBox(group, new THREE.BoxGeometry(2.2, item.depth, item.height - 2), materials.stockerFrame, -item.width / 2 + 1.1, 0, item.height / 2)
  addBox(group, new THREE.BoxGeometry(2.2, item.depth, item.height - 2), materials.stockerFrame, item.width / 2 - 1.1, 0, item.height / 2)
  addBox(group, new THREE.BoxGeometry(item.width - 4.4, 2.2, item.height - 2), materials.stockerFrame, 0, -item.depth / 2 + 1.1, item.height / 2)
  addBox(group, new THREE.BoxGeometry(item.width - 4.4, 2.2, item.height - 2), materials.stockerFrame, 0, item.depth / 2 - 1.1, item.height / 2)
  addBox(group, new THREE.BoxGeometry(item.width - 5.4, item.depth - 5, item.height - 4), materials.stockerWindow, 0, 0, item.height / 2)

  const shelfCount = Math.max(4, Math.floor(item.height / 5))
  for (let index = 0; index < shelfCount; index += 1) {
    const z = 4 + index * ((item.height - 8) / Math.max(1, shelfCount - 1))
    addBox(group, new THREE.BoxGeometry(item.width - 8, item.depth - 8, 0.5), materials.stockerShell, 0, 0, z)
    addBox(group, new THREE.BoxGeometry(item.width * 0.36, 4.6, 2.1), materials.stockerBay, item.width * 0.2, item.depth * 0.19, z + 1)
    addBox(group, new THREE.BoxGeometry(item.width * 0.36, 4.6, 2.1), materials.stockerBay, item.width * 0.2, -item.depth * 0.19, z + 1)
  }

  const guideOffsetX = -item.width * 0.22
  addBox(group, new THREE.BoxGeometry(1.2, 2.2, item.height - 6), materials.stockerFrame, guideOffsetX - 2.3, 0, item.height / 2)
  addBox(group, new THREE.BoxGeometry(1.2, 2.2, item.height - 6), materials.stockerFrame, guideOffsetX + 2.3, 0, item.height / 2)

  const carriageZ = Math.min(item.height * 0.58, item.height - 7)
  addBox(group, new THREE.BoxGeometry(7.2, item.depth * 0.42, 2.4), materials.stockerCarriage, guideOffsetX, 0, carriageZ)
  addBox(group, new THREE.BoxGeometry(6.8, 2.4, 1.6), materials.stockerCarriage, guideOffsetX + 2.6, -item.depth * 0.24, carriageZ + 0.9)
  addBox(group, new THREE.BoxGeometry(3.6, 1.2, 0.8), materials.transportAccent, guideOffsetX + 5.2, -item.depth * 0.24, carriageZ + 1.6)

  addBox(group, new THREE.BoxGeometry(item.width * 0.52, 2.2, 1.6), materials.stockerFrame, 0, 0, item.height - 1.8)
  addBox(group, new THREE.BoxGeometry(item.width * 0.38, 1.4, 1), materials.stockerCarriage, 0, 0, item.height - 0.6)
  addBox(group, new THREE.BoxGeometry(2.2, 6.4, 1.2), materials.stockerFrame, 0, -item.depth * 0.34, item.height - 2)

  addBox(group, new THREE.BoxGeometry(item.width * 0.7, 2.6, 3.6), materials.stockerFrame, 0, -item.depth / 2 + 0.3, 5.6)
  addBox(group, new THREE.BoxGeometry(item.width * 0.52, 1.8, 2.4), materials.stockerShell, 0, -item.depth / 2 + 0.2, 7.8)
  addBox(group, new THREE.BoxGeometry(item.width * 0.58, 1.1, 1.2), materials.stockerFrame, 0, -item.depth / 2 + 2.2, 10.8)

  return group
}

function createTransportVisual(item: ReadOnlyEntity) {
  const group = new THREE.Group()
  group.name = item.nodeName
  group.position.set(item.position.x, item.position.y, item.position.z)
  group.userData = meta(item.editorId, item.objectType, { entityId: item.id })

  addBox(group, new THREE.BoxGeometry(item.width * 0.72, item.depth * 0.7, item.height * 0.34), materials.transportBody, 0, 0, item.height * 0.68)
  addBox(group, new THREE.BoxGeometry(item.width * 0.52, item.depth * 0.32, item.height * 0.2), materials.transportAccent, 0, 0, item.height * 0.88)
  addBox(group, new THREE.BoxGeometry(item.width * 0.16, item.depth * 0.16, item.height * 0.58), materials.transportBody, 0, 0, item.height * 0.34)
  addBox(group, new THREE.BoxGeometry(item.width * 0.46, item.depth * 0.16, item.height * 0.12), materials.transportAccent, 0, 0, item.height * 0.1)
  addBox(group, new THREE.BoxGeometry(item.width * 0.22, item.depth * 0.28, item.height * 0.12), materials.transportBody, 0, 0, item.height * 0.02)

  return group
}

export function createDemoScene() {
  const scene = new THREE.Group()
  scene.name = 'DemoRoot'
  scene.add(createCleanroomShell())

  const lifts: LiftEntity[] = [
    {
      id: 'lift_a', editorId: 'lift_a', label: 'Lift A', objectType: 'Lift', nodeName: 'Lift_A',
      position: { x: -60, y: -10, z: 0 }, width: 56, depth: 32, height: 20, rotation: 0, slotsPerFace: 6,
      animation: { ...DEFAULT_ANIMATION, enabled: true, maxZ: 18 }, domainLabel: 'Inter-floor lift module A',
    },
    {
      id: 'lift_b', editorId: 'lift_b', label: 'Lift B', objectType: 'Lift', nodeName: 'Lift_B',
      position: { x: 65, y: 20, z: 0 }, width: 64, depth: 34, height: 20, rotation: 90, slotsPerFace: 6,
      animation: { ...DEFAULT_ANIMATION }, domainLabel: 'Single-level dock lift module B',
    },
  ]

  const readonlyObjects: ReadOnlyEntity[] = [
    { id: 'bridge_01', editorId: 'bridge_01', label: 'Bridge 01', objectType: 'Bridge', nodeName: 'Bridge_01', position: { x: 0, y: -72, z: 0 }, width: 180, depth: 12, height: 10, readOnly: true, domainLabel: 'Overhead bridge frame' },
    { id: 'rail_01', editorId: 'rail_01', label: 'Rail 01', objectType: 'Rail', nodeName: 'Rail_01', position: { x: 0, y: 62, z: 0 }, width: 180, depth: 8, height: 8, readOnly: true, domainLabel: 'Ceiling guide rail' },
    { id: 'stocker_01', editorId: 'stocker_01', label: 'Stocker 01', objectType: 'Stocker', nodeName: 'Stocker_01', position: { x: 8, y: 100, z: 0 }, width: 32, depth: 24, height: 28, readOnly: true, domainLabel: 'Secondary stocker cabinet context' },
    { id: 'transport_01', editorId: 'transport_01', label: 'Transport 01', objectType: 'Transport', nodeName: 'Transport_01', position: { x: 28, y: 62, z: 0 }, width: 16, depth: 10, height: 10, readOnly: true, domainLabel: 'Secondary overhead carrier context' },
  ]

  const ports: PortEntity[] = [
    {
      id: 'port_a_01', editorId: 'port_a_01', label: 'Port A-01', objectType: 'Port', nodeName: 'Port_A_01',
      parentLiftId: 'lift_a', domainParentId: 'lift_a', domainParentType: 'Lift', semanticRole: 'LIFT_DOCK',
      portType: 'IN', level: 'TOP', face: 'FRONT', slot: 2, position: { x: 0, y: 0, z: 0 }, width: 8, depth: 8, height: 8,
      created: false, templateNodeName: 'Port_Template', domainLabel: 'Upper lift handoff port',
    },
    {
      id: 'port_a_02', editorId: 'port_a_02', label: 'Port A-02', objectType: 'Port', nodeName: 'Port_A_02',
      parentLiftId: 'lift_a', domainParentId: 'lift_a', domainParentType: 'Lift', semanticRole: 'LIFT_DOCK',
      portType: 'OUT', level: 'BOTTOM', face: 'FRONT', slot: 4, position: { x: 0, y: 0, z: 0 }, width: 8, depth: 8, height: 8,
      created: false, templateNodeName: 'Port_Template', domainLabel: 'Lower lift handoff port',
    },
    {
      id: 'port_b_01', editorId: 'port_b_01', label: 'Port B-01', objectType: 'Port', nodeName: 'Port_B_01',
      parentLiftId: 'lift_b', domainParentId: 'lift_b', domainParentType: 'Lift', semanticRole: 'LIFT_DOCK',
      portType: 'INOUT', level: 'BOTTOM', face: 'LEFT', slot: 3, position: { x: 0, y: 0, z: 0 }, width: 8, depth: 8, height: 8,
      created: false, templateNodeName: 'Port_Template', domainLabel: 'Secondary lower lift port',
    },
    {
      id: 'stocker_access_01', editorId: 'stocker_access_01', label: 'Stocker Access 01', objectType: 'Port', nodeName: 'Stocker_Access_01',
      domainParentId: 'stocker_01', domainParentType: 'Stocker', semanticRole: 'STOCKER_ACCESS',
      portType: 'INOUT', level: 'BOTTOM', face: 'FRONT', slot: 1, position: { x: 0, y: 72, z: 0 }, width: 10, depth: 10, height: 10,
      created: false, templateNodeName: 'Port_Template', domainLabel: 'Stocker access handoff point',
    },
  ]

  for (const lift of lifts) {
    scene.add(createLiftVisual(lift))
  }

  scene.add(createPortTemplateNode())

  for (const port of ports) {
    if (port.domainParentType === 'Lift' && port.parentLiftId) {
      const lift = lifts.find((item) => item.editorId === port.parentLiftId)!
      port.position = computePortPosition(lift, port.face, port.slot, port.level)
    }
    scene.add(createPortNode(port))
  }

  for (const item of readonlyObjects) {
    if (item.objectType === 'Bridge') {
      scene.add(createBridgeVisual(item))
    } else if (item.objectType === 'Rail') {
      scene.add(createRailVisual(item))
    } else if (item.objectType === 'Stocker') {
      scene.add(createStockerVisual(item))
    } else if (item.objectType === 'Transport') {
      scene.add(createTransportVisual(item))
    }
  }

  const bundle: SceneBundle = { fileName: 'demo-scene.glb', lifts, ports, readonlyObjects, originalAnimationsCount: 0 }
  return { scene, bundle }
}
