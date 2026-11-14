import * as THREE from 'three'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Building, BuildingPart, Campus, Point } from '../lib/types'
import { floorLabel } from '../lib/types'
import { CAMPUS } from '../campus'
import { SCHOOLS, schoolOf } from '../lib/schools'

const COLORS = {
  sky: 0xe9eee6,
  ground: 0xdce8cc,
  grass: 0xbcdba2,
  garden: 0xa5d08f,
  scrub: 0x9cc887,
  wood: 0x93c07f,
  pitch: 0x9fd085,
  tennis: 0x5d93b3,
  court: 0xd29a6c,
  track: 0xc9705a,
  play: 0xead9ae,
  water: 0x9fd0ea,
  pool: 0x7ccbee,
  parking: 0xb3b7ba,
  plaza: 0xefe7d8,
  path: 0xfbf8f0,
  steps: 0xe4dccb,
  service: 0xc9cbcc,
  kerb: 0xe6e2d7,
  road: 0x8d9196,
  major: 0x767a80,
  line: 0xf3d98b,
  rail: 0x6f747a,
  ballast: 0xcbc6ba,
  context: 0xe9e3d6,
  contextRoof: 0xb9aea1,
  granite: CAMPUS.colors.wall,
  graniteDim: CAMPUS.colors.wallDim,
  slate: 0x7f8d8a,
  slateDim: 0xcdd3cf,
  flatRoof: 0xd4d2cb,
  school: CAMPUS.colors.managedRoof,
  schoolHover: CAMPUS.colors.managedRoofHover,
  red: CAMPUS.colors.roof,
  redHover: CAMPUS.colors.roofHover,
  redDim: CAMPUS.colors.roofDim,
  match: CAMPUS.colors.match,
  green: CAMPUS.colors.study,
  studyRoof: CAMPUS.colors.studyRoof,
  leaf: [0x5f9d57, 0x6fae5f, 0x4f8f52, 0x7db968, 0x5a9a63],
  floorEmpty: 0xf6f1e8,
  floorRooms: CAMPUS.colors.floor
}

const SLAB = 3.2

export interface CampusCallbacks {
  onSelect: (id: string) => void
  onFloor: (floor: number) => void
}

interface BuildingEntry {
  building: Building
  /** Walls, roof and rooftop units; hidden while the floor stack is shown. */
  group: THREE.Group
  walls: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  roof: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  label: HTMLButtonElement | null
  labelSize: [number, number]
  radius: number
  /** Height of the roof top, for placing the label. */
  top: number
}

interface FloorEntry {
  floor: number
  index: number
  rooms: number
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  edges: THREE.LineSegments
  label: HTMLButtonElement
}

interface Tween {
  start: number
  duration: number
  fromPosition: THREE.Vector3
  toPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function shapeOf (part: BuildingPart): THREE.Shape {
  const shape = new THREE.Shape(part.poly.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const hole of part.holes ?? []) {
    shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
  }
  return shape
}

/** Extrudes footprints upward. Campus x/y (east/north) become x/-z. */
function extrude (parts: BuildingPart[], height: number): THREE.BufferGeometry {
  const pieces = parts.map(part => new THREE.ExtrudeGeometry(shapeOf(part), { depth: height, bevelEnabled: false }))
  const merged = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces)
  merged.rotateX(-Math.PI / 2)
  return merged
}

function flat (polygons: Point[][], y: number): THREE.BufferGeometry | null {
  const pieces = polygons.map(poly => new THREE.ShapeGeometry(shapeOf({ poly })))
  if (pieces.length === 0) return null
  const merged = mergeGeometries(pieces)
  merged.rotateX(-Math.PI / 2)
  merged.translate(0, y, 0)
  return merged
}

/** Flat strips along each polyline, used for roads and walkways. */
function ribbons (lines: Point[][], width: number, y: number): THREE.BufferGeometry {
  const positions: number[] = []
  const half = width / 2
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i]
      const [x2, y2] = line[i + 1]
      const length = Math.hypot(x2 - x1, y2 - y1)
      if (length < 0.01) continue
      const nx = (-(y2 - y1) / length) * half
      const ny = ((x2 - x1) / length) * half
      // Extend each strip slightly so consecutive segments overlap at bends.
      const ex = ((x2 - x1) / length) * half * 0.6
      const ey = ((y2 - y1) / length) * half * 0.6
      const a = [x1 - ex + nx, y, -(y1 - ey + ny)]
      const b = [x1 - ex - nx, y, -(y1 - ey - ny)]
      const c = [x2 + ex + nx, y, -(y2 + ey + ny)]
      const d = [x2 + ex - nx, y, -(y2 + ey - ny)]
      positions.push(...a, ...b, ...c, ...b, ...d, ...c)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geometry
}

/** Copies one draw group out of a non-indexed geometry. */
function sliceGroup (geometry: THREE.BufferGeometry, group: { start: number; count: number }): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = geometry.getAttribute(name) as THREE.BufferAttribute
    const size = attribute.itemSize
    out.setAttribute(name, new THREE.BufferAttribute((attribute.array as Float32Array).slice(group.start * size, (group.start + group.count) * size), size))
  }
  return out
}

function perimeter (points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += Math.hypot(x2 - x1, y2 - y1)
  }
  return sum
}

function shoelace (points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum / 2)
}

function inside (point: Point, polygon: Point[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Small deterministic generator, so the scenery is the same on every load. */
function random (seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash (text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return value >>> 0
}

/** Drops vertices that sit within `tolerance` metres of the line between their neighbours. */
function simplify (points: Point[], tolerance: number): Point[] {
  const current = points.slice()
  for (let changed = true; changed && current.length > 4;) {
    changed = false
    for (let i = 0; i < current.length && current.length > 4; i++) {
      const count = current.length
      const [ax, ay] = current[(i - 1 + count) % count]
      const [bx, by] = current[i]
      const [cx, cy] = current[(i + 1) % count]
      const length = Math.hypot(cx - ax, cy - ay)
      const distance = length < 0.01 ? Math.hypot(bx - ax, by - ay) : Math.abs((cx - ax) * (ay - by) - (ax - bx) * (cy - ay)) / length
      if (distance < tolerance) {
        // Drop this vertex and leave its neighbour alone for this pass.
        current.splice(i, 1)
        changed = true
      }
    }
  }
  return current
}

interface Shell {
  walls: THREE.BufferGeometry
  roof: THREE.BufferGeometry
  /** How far the roof rises above the walls. */
  rise: number
}

/**
 * Walls and roof for a set of footprints. A pitched roof slopes in from every
 * edge to a flat ridge, which reads as hipped or gabled from map distance; a
 * flat roof is a thin slab with a chamfered edge.
 */
function shell (parts: BuildingPart[], height: number, roofKind: 'flat' | 'pitched'): Shell {
  const walls: THREE.BufferGeometry[] = []
  const roofs: THREE.BufferGeometry[] = []
  let rise = 0
  for (const part of parts) {
    const shape = shapeOf(part)
    const body = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
    walls.push(sliceGroup(body, body.groups[1]))
    body.dispose()
    // Mean width of the footprint: twice its area over its perimeter.
    const width = (2 * shoelace(part.poly)) / Math.max(perimeter(part.poly), 1)
    const inset = roofKind === 'pitched' ? THREE.MathUtils.clamp(width * 0.46, 1.2, 6.5) : 0.7
    const up = roofKind === 'pitched' ? Math.min(inset * 0.82, 5.2) : 0.55
    const outline = roofKind === 'pitched' ? shapeOf({ poly: simplify(part.poly, 1.6), holes: part.holes }) : shape
    const roof = new THREE.ExtrudeGeometry(outline, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: up,
      bevelSize: inset,
      bevelOffset: -inset,
      bevelSegments: 1
    })
    roof.translate(0, 0, height)
    roofs.push(roof)
    rise = Math.max(rise, up)
  }
  const wall = walls.length === 1 ? walls[0] : mergeGeometries(walls)
  const roof = roofs.length === 1 ? roofs[0] : mergeGeometries(roofs)
  wall.rotateX(-Math.PI / 2)
  roof.rotateX(-Math.PI / 2)
  roof.clearGroups()
  return { walls: wall, roof, rise }
}

/** One storey of one bay: a pale wall with a darker window in it. */
function windowImage (): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 64, 64)
  context.fillStyle = '#e9e4dc'
  context.fillRect(0, 0, 64, 5)
  context.fillStyle = '#8496a8'
  context.fillRect(20, 16, 24, 32)
  context.fillStyle = '#a9b8c6'
  context.fillRect(20, 16, 24, 9)
  context.fillStyle = '#f4f1ec'
  context.fillRect(31, 16, 2, 32)
  return canvas
}

/** A tiling ground texture. `paint` draws one tile; `width` and `depth` are its size in metres. */
function tile (width: number, depth: number, size: [number, number], paint: (context: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size[0]
  canvas.height = size[1]
  paint(canvas.getContext('2d') as CanvasRenderingContext2D, size[0], size[1])
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  // Flat shapes carry their position in metres as UVs.
  texture.repeat.set(1 / width, 1 / depth)
  return texture
}

function textPlane (text: string, height: number, color: string, outline: string): THREE.Mesh {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  const font = '600 44px "Avenir Next", "Segoe UI", system-ui, sans-serif'
  context.font = font
  const label = text.toUpperCase().split('').join('\u200a')
  const width = Math.ceil(context.measureText(label).width) + 24
  canvas.width = width
  canvas.height = 64
  context.font = font
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  context.lineWidth = 7
  context.strokeStyle = outline
  context.strokeText(label, 12, 34)
  context.fillStyle = color
  context.fillText(label, 12, 34)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry((height * width) / 64, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

export function shortName (name: string): string {
  return CAMPUS.labelNames[name] ?? name.replace(/ (Hall|Building|Student Center)$/, '')
}

export class CampusScene {
  private readonly container: HTMLElement
  private readonly callbacks: CampusCallbacks
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: MapControls
  private readonly labelLayer: HTMLDivElement
  private readonly tooltip: HTMLDivElement
  private readonly entries = new Map<string, BuildingEntry>()
  private readonly pickable: THREE.Object3D[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly observer: ResizeObserver
  private readonly home = { position: new THREE.Vector3(), target: new THREE.Vector3() }

  private stack: THREE.Group | null = null
  private floors: FloorEntry[] = []
  private stackGap = 6
  private explode = 0
  private explodeStart = 0
  private selectedId: string | null = null
  private highlightedFloor: number | null = null
  private hoveredId: string | null = null
  private hoveredFloor: number | null = null
  private matches: Map<string, number> | null = null
  private matchMode: 'rooms' | 'study' = 'rooms'
  /** Study rooms per building, for buildings that have any. */
  private study = new Map<string, number>()
  private tween: Tween | null = null
  private dirty = true
  private frame = 0
  private disposed = false
  private pointerDown: { x: number; y: number } | null = null
  private width = 1
  private height = 1

  constructor (container: HTMLElement, campus: Campus, callbacks: CampusCallbacks) {
    this.container = container
    this.callbacks = callbacks

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.domElement.className = 'map-canvas'
    container.appendChild(this.renderer.domElement)

    this.labelLayer = document.createElement('div')
    this.labelLayer.className = 'map-labels'
    container.appendChild(this.labelLayer)
    this.tooltip = document.createElement('div')
    this.tooltip.className = 'map-tooltip'
    this.labelLayer.appendChild(this.tooltip)

    this.scene.background = new THREE.Color(COLORS.sky)
    this.scene.fog = new THREE.Fog(COLORS.sky, 2600, 7000)

    this.camera = new THREE.PerspectiveCamera(36, 1, 5, 12000)
    this.controls = new MapControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 70
    this.controls.maxDistance = 4200
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(78)
    this.controls.zoomToCursor = true
    this.controls.addEventListener('change', () => { this.dirty = true })
    this.controls.addEventListener('start', () => { this.tween = null })

    this.buildLights()
    this.buildGround(campus)
    this.buildBuildings(campus)

    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', this.onPointerLeave)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()
    this.setHome(campus)
    this.renderer.shadowMap.needsUpdate = true
    this.loop()
  }

  // ---- construction --------------------------------------------------------

  private buildLights (): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e4d6, 1.75))
    const sun = new THREE.DirectionalLight(0xfff6e6, 2.3)
    // Low in the east-south-east, so shadows fall toward the viewer's left
    // instead of hiding behind the buildings.
    sun.position.set(880, 640, 330)
    sun.castShadow = true
    sun.shadow.mapSize.set(4096, 4096)
    const shadowCamera = sun.shadow.camera
    shadowCamera.left = -1300
    shadowCamera.right = 1300
    shadowCamera.top = 1300
    shadowCamera.bottom = -1300
    shadowCamera.near = 100
    shadowCamera.far = 2600
    shadowCamera.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.6
    this.scene.add(sun)
  }

  private buildGround (campus: Campus): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshLambertMaterial({ color: COLORS.ground }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    ground.material.depthWrite = false
    ground.renderOrder = -100

    // Everything on the ground is drawn in a fixed order without writing
    // depth, so thin layers never flicker against each other from far away.
    let order = -99
    const addFlat = (geometry: THREE.BufferGeometry | null, color: number, map?: THREE.Texture) => {
      if (!geometry) return
      const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: map ? 0xffffff : color, map, side: THREE.DoubleSide, depthWrite: false }))
      mesh.receiveShadow = true
      mesh.renderOrder = order++
      this.scene.add(mesh)
    }
    const polygons = (kind: string, sport?: string) =>
      campus.areas.filter(area => area.k === kind && (sport === undefined || (area.s ?? '') === sport)).map(area => area.p)
    const lines = (kind: string) => campus.paths.filter(path => path.k === kind).map(path => path.p)

    addFlat(flat(polygons('grass'), 0.02), COLORS.grass)
    addFlat(flat(polygons('wood'), 0.03), COLORS.wood)
    addFlat(flat(polygons('garden'), 0.04), COLORS.garden)
    addFlat(flat(polygons('scrub'), 0.05), COLORS.scrub)
    // Two rows of parking bays either side of an aisle.
    const bays = tile(2.7, 17, [32, 128], (context, w, h) => {
      context.fillStyle = '#b3b7ba'
      context.fillRect(0, 0, w, h)
      context.fillStyle = '#a4a8ac'
      context.fillRect(0, h * 0.34, w, h * 0.32)
      context.fillStyle = '#e9eaea'
      context.fillRect(0, 0, 3, h * 0.34)
      context.fillRect(0, h * 0.66, 3, h * 0.34)
    })
    // Square pavers.
    const paving = tile(3.2, 3.2, [64, 64], (context, w, h) => {
      context.fillStyle = '#efe7d8'
      context.fillRect(0, 0, w, h)
      context.fillStyle = '#e3dac8'
      context.fillRect(0, 0, w, 2)
      context.fillRect(0, 0, 2, h)
    })
    // Mowing stripes.
    const turf = tile(14, 14, [64, 8], (context, w, h) => {
      context.fillStyle = '#a3d389'
      context.fillRect(0, 0, w, h)
      context.fillStyle = '#95c97b'
      context.fillRect(0, 0, w / 2, h)
    })
    addFlat(flat(polygons('parking'), 0.06), COLORS.parking, bays)
    addFlat(flat(polygons('plaza'), 0.07), COLORS.plaza, paving)
    addFlat(flat(polygons('play'), 0.08), COLORS.play)
    addFlat(flat(polygons('track'), 0.09), COLORS.track)
    addFlat(flat(polygons('pitch', ''), 0.1), COLORS.pitch, turf)
    addFlat(flat(polygons('pitch', 'tennis'), 0.1), COLORS.tennis)
    addFlat(flat(polygons('pitch', 'court'), 0.1), COLORS.court)
    addFlat(flat(polygons('water'), 0.11), COLORS.water)
    addFlat(flat(polygons('pool'), 0.11), COLORS.pool)
    // White boundary lines on courts and fields.
    addFlat(ribbons(campus.areas.filter(area => area.k === 'pitch').map(area => [...area.p, area.p[0]]), 0.5, 0.12), 0xffffff)

    addFlat(ribbons(lines('rail'), 6.5, 0.13), COLORS.ballast)
    addFlat(ribbons(lines('rail'), 2.2, 0.14), COLORS.rail)
    addFlat(ribbons(lines('service'), 4.4, 0.15), COLORS.service)
    addFlat(ribbons(lines('road'), 11, 0.16), COLORS.kerb)
    addFlat(ribbons(lines('major'), 18, 0.16), COLORS.kerb)
    addFlat(ribbons(lines('road'), 8, 0.17), COLORS.road)
    addFlat(ribbons(lines('major'), 14, 0.18), COLORS.major)
    addFlat(ribbons(lines('major'), 0.45, 0.19), COLORS.line)
    addFlat(ribbons(lines('steps'), 2.6, 0.2), COLORS.steps)
    addFlat(ribbons(lines('path'), 2.5, 0.21), COLORS.path)

    for (const label of campus.roadLabels ?? []) {
      const major = label.k === 'major'
      const mesh = textPlane(label.t, major ? 10.5 : 6.2, '#ffffff', major ? '#5f6368' : '#74787d')
      mesh.position.set(label.x, 0.3, -label.y)
      mesh.rotation.z = label.a
      mesh.renderOrder = -1
      this.scene.add(mesh)
    }
    this.buildTrees(campus)
  }

  private buildTrees (campus: Campus): void {
    const next = random(20261113)
    const spots: { x: number; y: number; size: number }[] = []
    const list = campus.trees ?? []
    for (let i = 0; i < list.length; i += 2) spots.push({ x: list[i], y: list[i + 1], size: 2.8 + next() * 2.5 })
    // Shrub beds and woods are mapped as areas: fill them with smaller crowns.
    for (const area of campus.areas) {
      if (area.k !== 'scrub' && area.k !== 'wood') continue
      const xs = area.p.map(point => point[0])
      const ys = area.p.map(point => point[1])
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      const wood = area.k === 'wood'
      const wanted = Math.min(Math.round(shoelace(area.p) / (wood ? 70 : 26)), wood ? 60 : 9)
      for (let tries = 0, placed = 0; placed < wanted && tries < wanted * 6; tries++) {
        const point: Point = [minX + next() * (maxX - minX), minY + next() * (maxY - minY)]
        if (!inside(point, area.p)) continue
        placed++
        spots.push({ x: point[0], y: point[1], size: wood ? 3 + next() * 2 : 1 + next() * 0.9 })
      }
    }
    if (spots.length === 0) return

    // A crown of two faceted blobs on a short trunk, coloured per vertex.
    const lower = new THREE.IcosahedronGeometry(1, 0)
    lower.scale(1, 0.82, 1)
    lower.translate(0, 1.25, 0)
    const upper = new THREE.IcosahedronGeometry(0.66, 0)
    upper.translate(0.22, 2, 0.12)
    const trunk = new THREE.CylinderGeometry(0.09, 0.13, 0.7, 5).toNonIndexed()
    trunk.translate(0, 0.35, 0)
    const paint = (geometry: THREE.BufferGeometry, r: number, g: number, b: number) => {
      const count = geometry.getAttribute('position').count
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3)
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.deleteAttribute('uv')
      return geometry
    }
    const tree = mergeGeometries([paint(lower, 1, 1, 1), paint(upper, 1.08, 1.08, 1.08), paint(trunk, 0.62, 0.42, 0.34)])
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
    const mesh = new THREE.InstancedMesh(tree, material, spots.length)
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const color = new THREE.Color()
    spots.forEach((spot, index) => {
      rotation.setFromAxisAngle(up, next() * Math.PI * 2)
      const tall = spot.size * (0.9 + next() * 0.35)
      matrix.compose(new THREE.Vector3(spot.x, 0, -spot.y), rotation, new THREE.Vector3(spot.size, tall, spot.size))
      mesh.setMatrixAt(index, matrix)
      color.setHex(COLORS.leaf[Math.floor(next() * COLORS.leaf.length)])
      color.offsetHSL(0, 0, (next() - 0.5) * 0.06)
      mesh.setColorAt(index, color)
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)
  }

  private buildBuildings (campus: Campus): void {
    const image = windowImage()
    const windows = (storey: number, bay: number): THREE.CanvasTexture => {
      const texture = new THREE.CanvasTexture(image)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 4
      // Wall UVs are in metres: one texture tile per bay and per storey.
      texture.repeat.set(1 / bay, 1 / storey)
      texture.offset.set(0, -1 / storey)
      return texture
    }

    if (campus.context.length) {
      // Neighbouring houses and shops: plain walls, small pitched roofs.
      const walls: THREE.BufferGeometry[] = []
      const roofs: THREE.BufferGeometry[] = []
      for (const item of campus.context) {
        const small = shoelace(item.poly) < 420
        const piece = shell([{ poly: item.poly }], item.h, small ? 'pitched' : 'flat')
        walls.push(piece.walls)
        roofs.push(piece.roof)
      }
      const wallMesh = new THREE.Mesh(mergeGeometries(walls), new THREE.MeshLambertMaterial({ color: COLORS.context, map: windows(3.4, 4.2) }))
      const roofMesh = new THREE.Mesh(mergeGeometries(roofs), new THREE.MeshLambertMaterial({ color: COLORS.contextRoof, flatShading: true }))
      for (const mesh of [wallMesh, roofMesh]) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.scene.add(mesh)
      }
    }

    const unitMaterial = new THREE.MeshLambertMaterial({ color: 0xb9bcbb })
    for (const building of campus.buildings) {
      const hasRooms = building.rooms > 0
      const roofKind = building.roof ?? 'pitched'
      const piece = shell(building.parts, building.h, roofKind)
      const storey = building.h / Math.max(building.levels, 1)
      const walls = new THREE.Mesh(piece.walls, new THREE.MeshLambertMaterial({ color: COLORS.granite, map: windows(storey, 3.8) }))
      const roof = new THREE.Mesh(piece.roof, new THREE.MeshLambertMaterial({ color: this.roofColor(building), flatShading: true }))
      const group = new THREE.Group()
      group.add(walls, roof)
      for (const mesh of [walls, roof]) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.id = building.id
        this.pickable.push(mesh)
      }
      if (roofKind === 'flat') {
        const units = this.rooftopUnits(building, unitMaterial)
        if (units) group.add(units)
      }
      this.scene.add(group)

      piece.walls.computeBoundingSphere()
      const radius = piece.walls.boundingSphere?.radius ?? 40

      let label: HTMLButtonElement | null = null
      if (!building.minor) {
        label = document.createElement('button')
        label.type = 'button'
        label.className = hasRooms ? 'map-label' : 'map-label map-label--plain'
        // The label takes its school's colour; see lib/schools.ts.
        const school = SCHOOLS[schoolOf(building.id)]
        label.style.setProperty('--school', school.color)
        label.style.setProperty('--school-dark', school.dark)
        const name = document.createElement('span')
        name.className = 'map-label__name'
        name.textContent = shortName(building.name)
        label.append(name)
        const count = document.createElement('span')
        count.className = 'map-label__count'
        count.textContent = hasRooms ? String(building.rooms) : ''
        label.append(count)
        label.title = building.name
        label.addEventListener('click', () => this.callbacks.onSelect(building.id))
        label.addEventListener('pointerenter', () => this.setHovered(building.id))
        label.addEventListener('pointerleave', () => this.setHovered(null))
        this.labelLayer.appendChild(label)
      }
      this.entries.set(building.id, { building, group, walls, roof, label, labelSize: [0, 0], radius, top: building.h + piece.rise })
    }
  }

  /** A few plant boxes on a flat roof, placed the same way on every load. */
  private rooftopUnits (building: Building, material: THREE.Material): THREE.Mesh | null {
    const part = building.parts[0]
    if (building.area < 500) return null
    const next = random(hash(building.id))
    const xs = part.poly.map(point => point[0])
    const ys = part.poly.map(point => point[1])
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const wanted = THREE.MathUtils.clamp(Math.round(building.area / 900), 1, 5)
    const boxes: THREE.BufferGeometry[] = []
    for (let tries = 0; boxes.length < wanted && tries < 60; tries++) {
      const w = 3 + next() * 6
      const d = 3 + next() * 5
      const x = minX + next() * (maxX - minX)
      const y = minY + next() * (maxY - minY)
      // Keep the whole box on the roof and out of any courtyard.
      const corners: Point[] = [[x - w, y - d], [x + w, y - d], [x + w, y + d], [x - w, y + d], [x, y]]
      if (!corners.every(corner => inside(corner, part.poly) && !(part.holes ?? []).some(hole => inside(corner, hole)))) continue
      const tall = 1.4 + next() * 1.6
      const box = new THREE.BoxGeometry(w, tall, d)
      box.translate(x, building.h + 0.55 + tall / 2, -y)
      boxes.push(box)
    }
    if (boxes.length === 0) return null
    const mesh = new THREE.Mesh(mergeGeometries(boxes), material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private setHome (campus: Campus): void {
    const withRooms = campus.buildings.filter(building => building.rooms > 0)
    const list = withRooms.length ? withRooms : campus.buildings
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const building of list) {
      minX = Math.min(minX, building.c[0])
      maxX = Math.max(maxX, building.c[0])
      minY = Math.min(minY, building.c[1])
      maxY = Math.max(maxY, building.c[1])
    }
    const target = new THREE.Vector3((minX + maxX) / 2, 0, -(minY + maxY) / 2)
    // Far enough back that every classroom building fits the viewport.
    const vertical = THREE.MathUtils.degToRad(this.camera.fov) / 2
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect)
    const distance = Math.max((maxX - minX + 260) / (2 * Math.tan(horizontal)), (maxY - minY + 260) / (2 * Math.tan(vertical)) * 0.8, 500)
    this.home.target.copy(target)
    this.home.position.copy(target).add(this.offset(Math.min(distance, 4000), 0.16, 46))
    this.camera.position.copy(this.home.position)
    this.controls.target.copy(this.home.target)
    this.controls.update()
  }

  /** Camera offset from its target for a distance, azimuth (radians) and tilt (degrees from vertical). */
  private offset (distance: number, azimuth: number, tilt: number): THREE.Vector3 {
    const polar = THREE.MathUtils.degToRad(tilt)
    return new THREE.Vector3(
      Math.sin(azimuth) * Math.sin(polar) * distance,
      Math.cos(polar) * distance,
      Math.cos(azimuth) * Math.sin(polar) * distance
    )
  }

  /**
   * Roof colour carries the meaning. Red: classrooms we have data for. Rose: a
   * school runs its rooms and we know none. Slate or pale grey: everything else.
   */
  private roofColor (building: Building): number {
    const studyOnly = building.rooms === 0 && this.study.has(building.id) && this.matches === null
    const base = building.rooms > 0 ? COLORS.red : studyOnly ? COLORS.studyRoof : building.managedBy ? COLORS.school : building.roof === 'flat' ? COLORS.flatRoof : COLORS.slate
    const shift = ((hash(building.id) % 9) - 4) / 100
    return new THREE.Color(base).offsetHSL(0, 0, shift * 0.8).getHex()
  }

  // ---- public API ----------------------------------------------------------

  /**
   * Selects a building and splits it into floors, or clears the selection.
   * `roomsByFloor` maps a floor index to its classroom count.
   */
  select (id: string | null, roomsByFloor?: Map<number, number>): void {
    if (id === this.selectedId) {
      if (id && roomsByFloor) this.updateFloorCounts(roomsByFloor)
      return
    }
    this.clearStack()
    this.selectedId = id
    this.highlightedFloor = null
    const entry = id ? this.entries.get(id) : undefined
    if (entry) {
      this.buildStack(entry, roomsByFloor ?? new Map())
      this.flyTo(entry)
    }
    this.applyColors()
    this.renderer.shadowMap.needsUpdate = true
    this.dirty = true
  }

  highlightFloor (floor: number | null): void {
    if (floor === this.highlightedFloor) return
    this.highlightedFloor = floor
    this.applyFloorColors()
    this.dirty = true
  }

  /** Buildings with study rooms get a green roof and a count, even without classrooms. */
  setStudyBuildings (counts: Map<string, number>): void {
    this.study = counts
    this.setMatches(this.matches, this.matchMode)
  }

  /**
   * Counts per building to show instead of the classroom totals, or null for
   * none: matching classrooms under a filter ('rooms'), or study rooms ('study').
   */
  setMatches (matches: Map<string, number> | null, mode: 'rooms' | 'study' = 'rooms'): void {
    this.matches = matches
    this.matchMode = matches ? mode : 'rooms'
    for (const entry of this.entries.values()) {
      if (!entry.label) continue
      const count = matches ? matches.get(entry.building.id) ?? 0 : entry.building.rooms || (this.study.get(entry.building.id) ?? 0)
      const plain = this.isPlain(entry.building)
      const badge = entry.label.querySelector('.map-label__count')
      if (badge) badge.textContent = plain ? '' : String(count)
      entry.label.classList.toggle('map-label--plain', plain)
      entry.label.classList.toggle('map-label--study', !plain && (this.matchMode === 'study' || entry.building.rooms === 0))
      entry.labelSize = [0, 0]
    }
    this.applyColors()
    this.dirty = true
  }

  zoom (factor: number): void {
    const direction = this.camera.position.clone().sub(this.controls.target)
    const distance = THREE.MathUtils.clamp(direction.length() * factor, this.controls.minDistance, this.controls.maxDistance)
    this.startTween(this.controls.target.clone().add(direction.setLength(distance)), this.controls.target.clone(), 260)
  }

  resetView (): void {
    this.startTween(this.home.position.clone(), this.home.target.clone(), 900)
  }

  dispose (): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.controls.dispose()
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      const material = mesh.material
      if (Array.isArray(material)) material.forEach(item => item.dispose())
      else material?.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.labelLayer.remove()
  }

  // ---- selection and floors ------------------------------------------------

  private buildStack (entry: BuildingEntry, roomsByFloor: Map<number, number>): void {
    const { building } = entry
    const floors: number[] = []
    if (building.lower) floors.push(0)
    for (let floor = 1; floor <= building.levels; floor++) floors.push(floor)

    this.stack = new THREE.Group()
    this.stackGap = THREE.MathUtils.clamp(entry.radius * 0.24, 7, 18)
    const geometry = extrude(building.parts, SLAB)
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 30)
    floors.forEach((floor, index) => {
      const rooms = roomsByFloor.get(floor) ?? 0
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({ color: COLORS.floorEmpty, transparent: true, opacity: 0.9 })
      )
      mesh.userData.floor = floor
      const edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: CAMPUS.colors.floorEdge, transparent: true, opacity: 0.5 }))
      const label = document.createElement('button')
      label.type = 'button'
      label.className = 'floor-label'
      label.addEventListener('click', () => this.callbacks.onFloor(floor))
      label.addEventListener('pointerenter', () => { this.hoveredFloor = floor; this.applyFloorColors(); this.dirty = true })
      label.addEventListener('pointerleave', () => { this.hoveredFloor = null; this.applyFloorColors(); this.dirty = true })
      this.labelLayer.appendChild(label)
      this.stack?.add(mesh, edges)
      this.floors.push({ floor, index, rooms, mesh, edges, label })
      this.pickable.push(mesh)
    })
    this.updateFloorCounts(roomsByFloor)
    this.scene.add(this.stack)
    entry.group.visible = false
    this.explode = 0
    this.explodeStart = performance.now()
    this.layoutStack()
  }

  private updateFloorCounts (roomsByFloor: Map<number, number>): void {
    for (const entry of this.floors) {
      entry.rooms = roomsByFloor.get(entry.floor) ?? 0
      entry.label.textContent = ''
      const name = document.createElement('span')
      name.textContent = floorLabel(entry.floor)
      entry.label.appendChild(name)
      if (entry.rooms > 0) {
        const count = document.createElement('b')
        count.textContent = String(entry.rooms)
        entry.label.appendChild(count)
      }
      entry.label.classList.toggle('floor-label--empty', entry.rooms === 0)
    }
    this.applyFloorColors()
    this.dirty = true
  }

  private clearStack (): void {
    if (this.stack) {
      this.scene.remove(this.stack)
      const first = this.floors[0]
      first?.mesh.geometry.dispose()
      first?.edges.geometry.dispose()
      for (const entry of this.floors) {
        entry.mesh.material.dispose()
        ;(entry.edges.material as THREE.Material).dispose()
        entry.label.remove()
        const index = this.pickable.indexOf(entry.mesh)
        if (index !== -1) this.pickable.splice(index, 1)
      }
    }
    this.stack = null
    this.floors = []
    this.hoveredFloor = null
    const previous = this.selectedId ? this.entries.get(this.selectedId) : undefined
    if (previous) previous.group.visible = true
  }

  private layoutStack (): void {
    for (const entry of this.floors) {
      const y = entry.index * (SLAB + this.stackGap * this.explode)
      entry.mesh.position.y = y
      entry.edges.position.y = y
    }
  }

  private stackHeight (count: number): number {
    return Math.max(count - 1, 0) * (SLAB + this.stackGap) + SLAB
  }

  private flyTo (entry: BuildingEntry): void {
    const { building } = entry
    const count = building.levels + (building.lower ? 1 : 0)
    const height = this.stackHeight(count)
    const target = new THREE.Vector3(building.c[0], height / 2, -building.c[1])
    const narrow = this.width / this.height < 0.9
    const distance = Math.max(entry.radius * (narrow ? 5.6 : 4.4), height * 3.4, 240)
    // Keep the current compass direction so the fly-in doesn't spin the map.
    const current = this.camera.position.clone().sub(this.controls.target)
    const azimuth = Math.atan2(current.x, current.z)
    this.startTween(target.clone().add(this.offset(distance, azimuth, 62)), target, 950)
  }

  private startTween (toPosition: THREE.Vector3, toTarget: THREE.Vector3, duration: number): void {
    this.tween = {
      start: performance.now(),
      duration,
      fromPosition: this.camera.position.clone(),
      toPosition,
      fromTarget: this.controls.target.clone(),
      toTarget
    }
    this.dirty = true
  }

  /** A building with nothing to count in the current mode gets a small grey label. */
  private isPlain (building: Building): boolean {
    if (this.matchMode === 'study') return (this.matches?.get(building.id) ?? 0) === 0
    // Under a classroom filter only classroom buildings count.
    if (this.matches !== null) return building.rooms === 0
    return building.rooms === 0 && !this.study.has(building.id)
  }

  private applyColors (): void {
    for (const entry of this.entries.values()) {
      const { building, label } = entry
      const hasRooms = building.rooms > 0
      const study = this.matchMode === 'study'
      const filteredOut = (hasRooms || study) && this.matches !== null && (this.matches.get(building.id) ?? 0) === 0
      const dim = filteredOut || (this.selectedId !== null && this.selectedId !== building.id)
      let color = study && !filteredOut ? COLORS.green : this.matches !== null && hasRooms && !filteredOut ? COLORS.match : this.roofColor(building)
      if (dim) color = hasRooms && !study ? COLORS.redDim : COLORS.slateDim
      else if (this.hoveredId === building.id && !building.minor) {
        color = study && !filteredOut ? 0x3d6e47 : hasRooms ? COLORS.redHover : building.managedBy ? COLORS.schoolHover : 0x9fb0ab
      }
      entry.roof.material.color.setHex(color)
      entry.walls.material.color.setHex(dim ? COLORS.graniteDim : COLORS.granite)
      if (label) {
        label.classList.toggle('map-label--dim', dim)
        label.classList.toggle('map-label--none', filteredOut)
        label.classList.toggle('map-label--selected', this.selectedId === building.id)
        label.classList.toggle('map-label--hover', this.hoveredId === building.id)
      }
    }
  }

  private applyFloorColors (): void {
    for (const entry of this.floors) {
      const active = entry.floor === this.highlightedFloor
      const hover = entry.floor === this.hoveredFloor
      const material = entry.mesh.material
      if (active) material.color.setHex(COLORS.green)
      else if (entry.rooms > 0) material.color.setHex(hover ? COLORS.redHover : COLORS.floorRooms)
      else material.color.setHex(COLORS.floorEmpty)
      material.opacity = active ? 0.97 : entry.rooms > 0 ? 0.92 : hover ? 0.75 : 0.5
      entry.label.classList.toggle('floor-label--active', active)
    }
  }

  private setHovered (id: string | null): void {
    if (id === this.hoveredId) return
    this.hoveredId = id
    this.applyColors()
    this.dirty = true
  }

  // ---- pointer -------------------------------------------------------------

  private pick (event: PointerEvent): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickable.filter(object => object.visible && object.parent?.visible !== false), false)
    return hits[0]?.object ?? null
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown
    this.pointerDown = null
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return
    const object = this.pick(event)
    if (!object) return
    if (typeof object.userData.floor === 'number') {
      this.callbacks.onFloor(object.userData.floor)
      return
    }
    const entry = this.entries.get(object.userData.id)
    if (entry && !entry.building.minor) this.callbacks.onSelect(entry.building.id)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return
    const object = this.pick(event)
    const floor = typeof object?.userData.floor === 'number' ? (object.userData.floor as number) : null
    if (floor !== this.hoveredFloor) {
      this.hoveredFloor = floor
      this.applyFloorColors()
      this.dirty = true
    }
    const id = floor === null ? ((object?.userData.id as string | undefined) ?? null) : null
    this.setHovered(id)
    const entry = id ? this.entries.get(id) : undefined
    this.renderer.domElement.style.cursor = floor !== null || (entry && !entry.building.minor) ? 'pointer' : ''
    if (entry && entry.building.minor) {
      const rect = this.container.getBoundingClientRect()
      this.tooltip.textContent = entry.building.name
      this.tooltip.style.transform = `translate(${event.clientX - rect.left + 14}px, ${event.clientY - rect.top + 14}px)`
      this.tooltip.classList.add('map-tooltip--visible')
    } else {
      this.tooltip.classList.remove('map-tooltip--visible')
    }
  }

  private readonly onPointerLeave = (): void => {
    this.tooltip.classList.remove('map-tooltip--visible')
    this.setHovered(null)
  }

  // ---- frame ---------------------------------------------------------------

  private resize (): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  private readonly loop = (): void => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    const now = performance.now()

    if (this.tween) {
      const t = Math.min((now - this.tween.start) / this.tween.duration, 1)
      const k = ease(t)
      this.camera.position.lerpVectors(this.tween.fromPosition, this.tween.toPosition, k)
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k)
      if (t >= 1) this.tween = null
      this.dirty = true
    }
    if (this.stack && this.explode < 1) {
      this.explode = ease(Math.min((now - this.explodeStart) / 750, 1))
      this.layoutStack()
      this.dirty = true
    }
    this.controls.update()
    if (!this.dirty) return
    this.dirty = false
    this.renderer.render(this.scene, this.camera)
    this.layoutLabels()
  }

  private project (x: number, y: number, z: number): [number, number, boolean] {
    const point = new THREE.Vector3(x, y, z).project(this.camera)
    return [(point.x + 1) * 0.5 * this.width, (1 - point.y) * 0.5 * this.height, point.z < 1 && point.z > -1]
  }

  private layoutLabels (): void {
    const placed: [number, number, number, number][] = []
    const ordered = [...this.entries.values()]
      .filter(entry => entry.label)
      .sort((a, b) => this.labelPriority(b) - this.labelPriority(a))
    const distance = this.camera.position.distanceTo(this.controls.target)
    for (const entry of ordered) {
      const label = entry.label as HTMLButtonElement
      // Buildings without classroom data only get a label once the map is
      // close enough to have room for it, and never while a filter is on.
      const plain = this.isPlain(entry.building)
      const tooFar = plain && (this.matches !== null || distance > (entry.building.managedBy ? 2400 : 1250))
      if (entry.building.id === this.selectedId || tooFar) {
        label.style.visibility = 'hidden'
        continue
      }
      if (entry.labelSize[0] === 0) entry.labelSize = [label.offsetWidth, label.offsetHeight]
      const [w, h] = entry.labelSize
      const [x, y, visible] = this.project(entry.building.c[0], entry.top + 4, -entry.building.c[1])
      const left = x - w / 2
      const top = y - h - 4
      const onScreen = visible && x > -40 && x < this.width + 40 && y > 0 && y < this.height + 40
      const overlaps = placed.some(rect => left < rect[2] && left + w > rect[0] && top < rect[3] && top + h > rect[1])
      if (!onScreen || overlaps) {
        label.style.visibility = 'hidden'
        continue
      }
      placed.push([left - 4, top - 3, left + w + 4, top + h + 3])
      label.style.visibility = 'visible'
      label.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    }

    if (this.floors.length && this.selectedId) {
      const entry = this.entries.get(this.selectedId)
      if (!entry) return
      // Anchor floor chips just past the building's edge, on the camera's left.
      const left = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize().multiplyScalar(-(entry.radius * 0.72 + 6))
      for (const floor of this.floors) {
        const [x, y, visible] = this.project(
          entry.building.c[0] + left.x,
          floor.mesh.position.y + SLAB / 2,
          -entry.building.c[1] + left.z
        )
        floor.label.style.visibility = visible ? 'visible' : 'hidden'
        floor.label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-100%, -50%)`
      }
    }
  }

  private labelPriority (entry: BuildingEntry): number {
    const { building } = entry
    const hover = building.id === this.hoveredId ? 100000 : 0
    if (this.isPlain(building)) return hover + (building.managedBy ? 5000 : Math.min(building.area / 10, 4000))
    if (building.rooms === 0 && this.matchMode === 'rooms') return hover + 10000 + (this.study.get(building.id) ?? 0)
    const count = this.matches ? this.matches.get(building.id) ?? 0 : building.rooms
    return hover + 10000 + count
  }
}
