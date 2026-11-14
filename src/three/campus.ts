import * as THREE from 'three'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Building, BuildingPart, Campus, Point } from '../lib/types'
import { floorLabel } from '../lib/types'

const COLORS = {
  sky: 0xeef0ea,
  ground: 0xf4f1ea,
  grass: 0xcfe3c0,
  wood: 0xb4d3a4,
  pitch: 0xc0dcaa,
  water: 0xb5d6e8,
  parking: 0xe9e6de,
  path: 0xffffff,
  service: 0xfcfaf5,
  road: 0xffffff,
  context: 0xebe7de,
  stone: 0xd8ccba,
  stoneDim: 0xe4ddd0,
  red: 0xba0c2f,
  redHover: 0xd8254a,
  redDim: 0xdcb4bb,
  green: 0x2c5234,
  floorEmpty: 0xf6f1e8,
  floorRooms: 0xc8324f
}

const SLAB = 3.2

export interface CampusCallbacks {
  onSelect: (id: string) => void
  onFloor: (floor: number) => void
}

interface BuildingEntry {
  building: Building
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  edges: THREE.LineSegments | null
  label: HTMLButtonElement | null
  labelSize: [number, number]
  radius: number
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

export function shortName (name: string): string {
  return name
    .replace(/^Lucy and Stanley /, '')
    .replace(/^Scott /, '')
    .replace(/ (Hall|Building|Student Center)$/, '')
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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xf1ece2, 2.0))
    const sun = new THREE.DirectionalLight(0xfffaf0, 1.9)
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

    const addFlat = (geometry: THREE.BufferGeometry | null, color: number) => {
      if (!geometry) return
      const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }))
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }
    const areaLevels: Record<string, [number, number]> = {
      parking: [COLORS.parking, 0.04],
      grass: [COLORS.grass, 0.06],
      pitch: [COLORS.pitch, 0.09],
      wood: [COLORS.wood, 0.12],
      water: [COLORS.water, 0.14]
    }
    for (const [kind, [color, y]] of Object.entries(areaLevels)) {
      addFlat(flat(campus.areas.filter(area => area.k === kind).map(area => area.p), y), color)
    }
    const pathLevels: Record<string, [number, number, number]> = {
      service: [COLORS.service, 4.2, 0.18],
      path: [COLORS.path, 2.6, 0.2],
      road: [COLORS.road, 7.5, 0.22],
      major: [COLORS.road, 13, 0.24]
    }
    for (const [kind, [color, width, y]] of Object.entries(pathLevels)) {
      addFlat(ribbons(campus.paths.filter(path => path.k === kind).map(path => path.p), width, y), color)
    }
  }

  private buildBuildings (campus: Campus): void {
    if (campus.context.length) {
      const pieces = campus.context.map(item => {
        const geometry = new THREE.ExtrudeGeometry(shapeOf({ poly: item.poly }), { depth: item.h, bevelEnabled: false })
        return geometry
      })
      const merged = mergeGeometries(pieces)
      merged.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: COLORS.context }))
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
    }

    for (const building of campus.buildings) {
      const geometry = extrude(building.parts, building.h)
      const hasRooms = building.rooms > 0
      const material = new THREE.MeshLambertMaterial({ color: hasRooms ? COLORS.red : COLORS.stone })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.id = building.id
      this.scene.add(mesh)
      this.pickable.push(mesh)

      let edges: THREE.LineSegments | null = null
      if (hasRooms) {
        edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 30),
          new THREE.LineBasicMaterial({ color: 0x6d0519, transparent: true, opacity: 0.45 })
        )
        this.scene.add(edges)
      }

      geometry.computeBoundingSphere()
      const radius = geometry.boundingSphere?.radius ?? 40

      let label: HTMLButtonElement | null = null
      if (hasRooms) {
        label = document.createElement('button')
        label.type = 'button'
        label.className = 'map-label'
        const name = document.createElement('span')
        name.className = 'map-label__name'
        name.textContent = shortName(building.name)
        const count = document.createElement('span')
        count.className = 'map-label__count'
        count.textContent = String(building.rooms)
        label.append(name, count)
        label.title = building.name
        label.addEventListener('click', () => this.callbacks.onSelect(building.id))
        label.addEventListener('pointerenter', () => this.setHovered(building.id))
        label.addEventListener('pointerleave', () => this.setHovered(null))
        this.labelLayer.appendChild(label)
      }
      this.entries.set(building.id, { building, mesh, edges, label, labelSize: [0, 0], radius })
    }
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

  /** Classroom counts per building under the current filters, or null for no filter. */
  setMatches (matches: Map<string, number> | null): void {
    this.matches = matches
    for (const entry of this.entries.values()) {
      if (!entry.label) continue
      const count = matches ? matches.get(entry.building.id) ?? 0 : entry.building.rooms
      const badge = entry.label.querySelector('.map-label__count')
      if (badge) badge.textContent = String(count)
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
      const edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x6d0519, transparent: true, opacity: 0.5 }))
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
    entry.mesh.visible = false
    if (entry.edges) entry.edges.visible = false
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
    if (previous) {
      previous.mesh.visible = true
      if (previous.edges) previous.edges.visible = true
    }
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

  private applyColors (): void {
    for (const entry of this.entries.values()) {
      const { building, mesh, label } = entry
      const hasRooms = building.rooms > 0
      const filteredOut = hasRooms && this.matches !== null && (this.matches.get(building.id) ?? 0) === 0
      const dim = filteredOut || (this.selectedId !== null && this.selectedId !== building.id)
      let color = hasRooms ? COLORS.red : COLORS.stone
      if (dim) color = hasRooms ? COLORS.redDim : COLORS.stoneDim
      if (hasRooms && !filteredOut && this.hoveredId === building.id) color = COLORS.redHover
      mesh.material.color.setHex(color)
      if (entry.edges) (entry.edges.material as THREE.LineBasicMaterial).opacity = dim ? 0.15 : 0.45
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
    const hits = this.raycaster.intersectObjects(this.pickable.filter(object => object.visible), false)
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
    if (entry && entry.building.rooms > 0) this.callbacks.onSelect(entry.building.id)
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
    this.renderer.domElement.style.cursor = floor !== null || (entry && entry.building.rooms > 0) ? 'pointer' : ''
    if (entry && entry.building.rooms === 0) {
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
    for (const entry of ordered) {
      const label = entry.label as HTMLButtonElement
      if (entry.building.id === this.selectedId) {
        label.style.visibility = 'hidden'
        continue
      }
      if (entry.labelSize[0] === 0) entry.labelSize = [label.offsetWidth, label.offsetHeight]
      const [w, h] = entry.labelSize
      const [x, y, visible] = this.project(entry.building.c[0], entry.building.h + 6, -entry.building.c[1])
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
    const count = this.matches ? this.matches.get(entry.building.id) ?? 0 : entry.building.rooms
    return count + (entry.building.id === this.hoveredId ? 1000 : 0)
  }
}
