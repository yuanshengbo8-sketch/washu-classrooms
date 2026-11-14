import { CAMPUS } from '../campus'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Room } from '../lib/types'

// A schematic classroom built from the seat count and seating style in the CTL
// directory. It answers "roughly what would I see from back there", and is not
// a model of the real room. The board wall is at z = 0 and seats face it.

export interface SeatInfo {
  row: number
  rows: number
  /** Metres from the seat to the middle of the board. */
  distance: number
  /** Degrees off the board's centre line. */
  angle: number
}

export type SeatPreset = 'front' | 'middle' | 'back' | 'corner'

interface Seat {
  x: number
  y: number
  z: number
  row: number
  /** Rotation about the vertical axis; 0 faces the board. */
  facing: number
}

interface Table {
  x: number
  y: number
  z: number
  w: number
  d: number
  round: boolean
}

interface Layout {
  kind: 'tiered' | 'chairs' | 'tables' | 'seminar' | 'round'
  seats: Seat[]
  tables: Table[]
  /** Tier platforms as [front edge z, height]. */
  tiers: [number, number][]
  rowDepth: number
  width: number
  depth: number
  height: number
  rows: number
}

function kindOf (style: string): Layout['kind'] {
  const text = style.toLowerCase()
  if (/auditorium|case|tiered/.test(text)) return 'tiered'
  if (/seminar|conference/.test(text)) return 'seminar'
  if (/round|pod|alc|group/.test(text)) return 'round'
  if (/table|lab|fixed/.test(text)) return 'tables'
  return 'chairs'
}

/** Splits a row of `count` seats into blocks separated by aisles and returns each seat's x. */
function rowXs (count: number, pitch: number, aisles: number, aisleWidth: number): number[] {
  const blocks = aisles + 1
  const sizes: number[] = []
  if (blocks === 3) {
    const side = Math.max(1, Math.round(count / 4))
    sizes.push(side, count - side * 2, side)
  } else if (blocks === 2) {
    sizes.push(Math.ceil(count / 2), Math.floor(count / 2))
  } else sizes.push(count)
  const total = count * pitch + aisles * aisleWidth
  const xs: number[] = []
  let cursor = -total / 2
  for (const size of sizes) {
    for (let i = 0; i < size; i++) xs.push(cursor + pitch * (i + 0.5))
    cursor += size * pitch + aisleWidth
  }
  return xs
}

export function buildLayout (style: string, capacity: number): Layout {
  const kind = kindOf(style)
  const total = Math.max(capacity, 4)
  const seats: Seat[] = []
  const tables: Table[] = []
  const tiers: [number, number][] = []
  let rowDepth = 1

  if (kind === 'tiered' || kind === 'chairs') {
    const tiered = kind === 'tiered'
    const perRow = tiered
      ? THREE.MathUtils.clamp(Math.round(Math.sqrt(total * 2.2)), 8, 30)
      : THREE.MathUtils.clamp(Math.round(Math.sqrt(total * 1.5)), 4, 12)
    const pitch = tiered ? 0.58 : 0.76
    rowDepth = tiered ? 1.02 : 1.08
    const aisles = tiered ? (perRow >= 16 ? 2 : perRow >= 10 ? 1 : 0) : perRow >= 6 ? 1 : 0
    const rise = tiered ? 0.24 : 0
    const firstZ = tiered ? 4.2 : 3.2
    const rows = Math.ceil(total / perRow)
    for (let row = 0; row < rows; row++) {
      const remaining = total - seats.length
      const count = Math.min(perRow, remaining)
      const y = row * rise
      const z = firstZ + row * rowDepth
      if (tiered) tiers.push([z - rowDepth * 0.42, y])
      for (const x of rowXs(count, pitch, count >= perRow * 0.6 ? aisles : 0, 1.1)) {
        seats.push({ x, y, z, row: row + 1, facing: 0 })
      }
    }
  } else if (kind === 'tables') {
    const perRow = THREE.MathUtils.clamp(Math.round(Math.sqrt((total / 2) * 1.3)), 2, 6)
    rowDepth = 1.75
    const tablePitch = 1.72
    const aisle = perRow >= 4 ? 1.2 : 0
    const rows = Math.ceil(total / (perRow * 2))
    for (let row = 0; row < rows && seats.length < total; row++) {
      const z = 3.4 + row * rowDepth
      for (const x of rowXs(perRow, tablePitch, aisle ? 1 : 0, aisle)) {
        if (seats.length >= total) break
        tables.push({ x, y: 0, z: z - 0.5, w: 1.5, d: 0.6, round: false })
        for (const offset of [-0.38, 0.38]) {
          if (seats.length < total) seats.push({ x: x + offset, y: 0, z, row: row + 1, facing: 0 })
        }
      }
    }
  } else if (kind === 'seminar') {
    const ends = total > 22 ? 2 : 1
    const perSide = Math.max(2, Math.ceil((total - ends) / 2))
    const length = perSide * 0.74
    const tableWidth = total > 22 ? 1.9 : 1.4
    const z0 = 2.8
    tables.push({ x: 0, y: 0, z: z0 + length / 2, w: tableWidth, d: length, round: false })
    for (let i = 0; i < perSide; i++) {
      const z = z0 + (i + 0.5) * 0.74
      for (const side of [-1, 1]) {
        if (seats.length < total - ends) {
          seats.push({ x: side * (tableWidth / 2 + 0.42), y: 0, z, row: i + 1, facing: side * (Math.PI / 2) * 0.82 })
        }
      }
    }
    for (let i = 0; i < ends && seats.length < total; i++) {
      seats.push({ x: ends === 1 ? 0 : (i - 0.5) * 0.8, y: 0, z: z0 + length + 0.45, row: perSide + 1, facing: 0 })
    }
    rowDepth = 0.74
  } else {
    const perTable = total <= 24 ? 6 : 8
    const count = Math.ceil(total / perTable)
    const columns = Math.max(2, Math.ceil(Math.sqrt(count * 1.3)))
    const spacing = 3.5
    rowDepth = spacing
    for (let index = 0; index < count; index++) {
      const column = index % columns
      const row = Math.floor(index / columns)
      const inRow = Math.min(columns, count - row * columns)
      const cx = (column - (inRow - 1) / 2) * spacing
      const cz = 4 + row * spacing
      tables.push({ x: cx, y: 0, z: cz, w: 1.7, d: 1.7, round: true })
      const here = Math.min(perTable, total - seats.length)
      for (let i = 0; i < here; i++) {
        const angle = (i / here) * Math.PI * 2 + Math.PI / here
        seats.push({ x: cx + Math.sin(angle) * 1.28, y: 0, z: cz + Math.cos(angle) * 1.28, row: row + 1, facing: 0 })
      }
    }
  }

  const maxX = seats.reduce((max, seat) => Math.max(max, Math.abs(seat.x)), 0)
  const maxZ = seats.reduce((max, seat) => Math.max(max, seat.z), 0)
  const rows = seats.reduce((max, seat) => Math.max(max, seat.row), 1)
  const topY = seats.reduce((max, seat) => Math.max(max, seat.y), 0)
  return {
    kind,
    seats,
    tables,
    tiers,
    rowDepth,
    width: Math.max(maxX * 2 + 3, 6.5),
    depth: maxZ + 1.9,
    height: kind === 'tiered' ? Math.max(4.6, topY + 3.1) : 3.2,
    rows
  }
}

function slideTexture (title: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 640
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 1024, 640)
  context.fillStyle = CAMPUS.colors.primary
  context.fillRect(0, 0, 1024, 108)
  context.fillStyle = '#ffffff'
  context.font = '600 54px Georgia, serif'
  context.fillText(title, 44, 72)
  context.fillStyle = '#1f2a24'
  context.font = '600 46px system-ui, sans-serif'
  context.fillText('Can you read this from your seat?', 44, 200)
  const sizes = [40, 32, 25, 19, 14]
  let y = 280
  for (const size of sizes) {
    context.font = `${size}px system-ui, sans-serif`
    context.fillStyle = '#3d4a43'
    context.fillText(`${size}px  The quick brown fox jumps over the lazy dog`, 44, y)
    y += size + 30
  }
  context.fillStyle = CAMPUS.colors.accent
  context.fillRect(44, 590, 936, 8)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

const SEAT_COLOR = new THREE.Color(0x66727a)
const SEAT_COLOR_TIERED = new THREE.Color(0x8f2f41)
const SEAT_HOVER = new THREE.Color(0xe0a400)
const SEAT_SELECTED = new THREE.Color(0x2c8a4a)

export class SeatScene {
  private readonly container: HTMLElement
  private readonly onSeat: (info: SeatInfo | null) => void
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400)
  private readonly controls: OrbitControls
  private readonly layout: Layout
  private readonly cushions: THREE.InstancedMesh
  private readonly backs: THREE.InstancedMesh
  private readonly raycaster = new THREE.Raycaster()
  private readonly observer: ResizeObserver
  private readonly baseColor: THREE.Color
  private readonly boardCentre = new THREE.Vector3(0, 1.6, 0)
  private selected: number | null = null
  private hovered: number | null = null
  private dirty = true
  private disposed = false
  private frame = 0
  private pointerDown: { x: number; y: number } | null = null
  private tween: { start: number; fromPosition: THREE.Vector3; toPosition: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromFov: number; toFov: number } | null = null

  constructor (container: HTMLElement, room: Room, onSeat: (info: SeatInfo | null) => void) {
    this.container = container
    this.onSeat = onSeat
    this.layout = buildLayout(room.style, room.capacity ?? 30)
    this.baseColor = this.layout.kind === 'tiered' ? SEAT_COLOR_TIERED : SEAT_COLOR

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)
    this.scene.background = new THREE.Color(0xe9ece6)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.addEventListener('change', () => { this.dirty = true })
    this.controls.addEventListener('start', () => { this.tween = null })

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 1.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.3)
    key.position.set(3, 10, 6)
    this.scene.add(key)

    this.buildRoom(room)
    const seatCount = this.layout.seats.length
    const cushionGeometry = new THREE.BoxGeometry(0.46, 0.07, 0.44)
    const backGeometry = new THREE.BoxGeometry(0.46, 0.4, 0.05)
    this.cushions = new THREE.InstancedMesh(cushionGeometry, new THREE.MeshLambertMaterial(), seatCount)
    this.backs = new THREE.InstancedMesh(backGeometry, new THREE.MeshLambertMaterial(), seatCount)
    const matrix = new THREE.Matrix4()
    const rotation = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const unit = new THREE.Vector3(1, 1, 1)
    this.layout.seats.forEach((seat, index) => {
      rotation.setFromAxisAngle(up, seat.facing)
      matrix.compose(new THREE.Vector3(seat.x, seat.y + 0.45, seat.z), rotation, unit)
      this.cushions.setMatrixAt(index, matrix)
      const behind = new THREE.Vector3(0, 0, 0.22).applyQuaternion(rotation)
      matrix.compose(new THREE.Vector3(seat.x + behind.x, seat.y + 0.67, seat.z + behind.z), rotation, unit)
      this.backs.setMatrixAt(index, matrix)
      this.cushions.setColorAt(index, this.baseColor)
      this.backs.setColorAt(index, this.baseColor)
    })
    this.scene.add(this.cushions, this.backs)

    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointermove', this.onPointerMove)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()
    this.overview(false)
    this.loop()
  }

  private buildRoom (room: Room): void {
    const { width, depth, height, tiers, rowDepth } = this.layout
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xb6ad9f })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, depth / 2)
    this.scene.add(floor)

    tiers.forEach(([z, y], index) => {
      if (y <= 0) return
      const last = index === tiers.length - 1
      const length = last ? depth - z : rowDepth
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(width, y, length),
        new THREE.MeshLambertMaterial({ color: index % 2 ? 0xaea596 : 0xb9b0a2 })
      )
      step.position.set(0, y / 2, z + length / 2)
      this.scene.add(step)
    })

    // Walls face inward only, so the overview camera can see in from outside.
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xf4f0e8 })
    const wall = (w: number, h: number, x: number, z: number, rotationY: number, material = wallMaterial) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
      mesh.position.set(x, h / 2, z)
      mesh.rotation.y = rotationY
      this.scene.add(mesh)
    }
    wall(width, height, 0, 0, 0, new THREE.MeshLambertMaterial({ color: 0xece6da }))
    wall(width, height, 0, depth, Math.PI)
    wall(depth, height, -width / 2, depth / 2, Math.PI / 2)
    wall(depth, height, width / 2, depth / 2, -Math.PI / 2)
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshLambertMaterial({ color: 0xfaf8f3 }))
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(0, height, depth / 2)
    this.scene.add(ceiling)
    const band = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.16), new THREE.MeshBasicMaterial({ color: CAMPUS.colors.match }))
    band.position.set(0, height - 0.24, 0.01)
    this.scene.add(band)

    // Boards along the front wall.
    const boardCount = THREE.MathUtils.clamp(room.boards ?? 2, 1, 8)
    const columns = Math.min(boardCount, 4)
    const boardRows = Math.ceil(boardCount / columns)
    const usable = Math.min(width - 1.6, columns * 2.1)
    const boardWidth = usable / columns - 0.08
    const boardHeight = 1.15
    const white = /white/i.test(room.boardType) && !/chalk/i.test(room.boardType)
    const mixed = /mix/i.test(room.boardType)
    for (let index = 0; index < boardCount; index++) {
      const column = index % columns
      const row = Math.floor(index / columns)
      const isWhite = mixed ? index % 2 === 1 : white
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(boardWidth + 0.06, boardHeight + 0.06),
        new THREE.MeshLambertMaterial({ color: 0x8a8378 })
      )
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(boardWidth, boardHeight),
        new THREE.MeshLambertMaterial({ color: isWhite ? 0xfafaf6 : 0x2f4a3f })
      )
      const x = (column - (columns - 1) / 2) * (usable / columns)
      const y = 1.55 + row * (boardHeight + 0.1)
      frame.position.set(x, y, 0.02)
      board.position.set(x, y, 0.03)
      this.scene.add(frame, board)
    }
    const boardsTop = 1.55 + (boardRows - 1) * (boardHeight + 0.1) + boardHeight / 2
    this.boardCentre.set(0, (0.975 + boardsTop) / 2, 0)

    // Projection screens, pulled down in front of the boards.
    const screenCount = THREE.MathUtils.clamp(room.screens ?? 1, 1, 3)
    const screenWidth = THREE.MathUtils.clamp((width - 1.2) / screenCount - 0.3, 1.8, 3.4)
    const screenHeight = screenWidth * 0.625
    const texture = slideTexture(`${room.buildingName} ${room.room}`)
    for (let index = 0; index < screenCount; index++) {
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth, screenHeight), new THREE.MeshBasicMaterial({ map: texture }))
      const x = (index - (screenCount - 1) / 2) * (screenWidth + 0.4)
      // Hung from the top of the wall; in low rooms it covers the upper boards.
      screen.position.set(x, height - 0.42 - screenHeight / 2, 0.06)
      this.scene.add(screen)
    }

    const podium = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.6), new THREE.MeshLambertMaterial({ color: 0x5b4636 }))
    podium.position.set(-Math.min(width / 2 - 1.1, 2.6), 0.525, 1.5)
    this.scene.add(podium)

    const tableMaterial = new THREE.MeshLambertMaterial({ color: 0xd9c7a8 })
    for (const table of this.layout.tables) {
      const geometry = table.round ? new THREE.CylinderGeometry(table.w / 2, table.w / 2, 0.05, 32) : new THREE.BoxGeometry(table.w, 0.05, table.d)
      const mesh = new THREE.Mesh(geometry, tableMaterial)
      mesh.position.set(table.x, table.y + 0.74, table.z)
      this.scene.add(mesh)
    }
  }

  // ---- public API ----------------------------------------------------------

  overview (animate = true): void {
    const { width, depth, height } = this.layout
    this.setSelected(null)
    this.controls.enableZoom = true
    this.controls.enablePan = true
    this.controls.rotateSpeed = 0.8
    this.controls.minDistance = 2
    this.controls.maxDistance = Math.max(width, depth) * 3
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(86)
    this.controls.minPolarAngle = 0
    const span = Math.max(width, depth)
    const position = new THREE.Vector3(width * 0.55, height + span * 0.75, depth + span * 0.55)
    const target = new THREE.Vector3(0, 0.8, depth * 0.45)
    this.fly(position, target, 42, animate)
    this.onSeat(null)
  }

  sitAt (preset: SeatPreset): void {
    const { seats, rows } = this.layout
    const wantedRow = preset === 'front' ? 1 : preset === 'middle' ? Math.ceil(rows / 2) : rows
    const inRow = seats.map((seat, index) => ({ seat, index })).filter(item => item.seat.row === wantedRow)
    const pool = inRow.length ? inRow : seats.map((seat, index) => ({ seat, index }))
    const best = pool.reduce((a, b) =>
      preset === 'corner' ? (Math.abs(b.seat.x) > Math.abs(a.seat.x) ? b : a) : Math.abs(b.seat.x) < Math.abs(a.seat.x) ? b : a
    )
    this.sit(best.index)
  }

  dispose (): void {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.controls.dispose()
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      for (const item of Array.isArray(material) ? material : material ? [material] : []) {
        const map = (item as THREE.MeshBasicMaterial).map
        map?.dispose()
        item.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ---- internals -----------------------------------------------------------

  private sit (index: number): void {
    const seat = this.layout.seats[index]
    this.setSelected(index)
    const eye = new THREE.Vector3(seat.x, seat.y + 1.2, seat.z - 0.05)
    const direction = this.boardCentre.clone().sub(eye).normalize()
    // Orbiting a point just ahead of the eye turns the head instead of moving it.
    const target = eye.clone().add(direction.multiplyScalar(0.05))
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.rotateSpeed = -0.32
    this.controls.minDistance = 0.01
    this.controls.maxDistance = 1
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(40)
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(140)
    this.fly(eye, target, 64, true)
    this.onSeat({
      row: seat.row,
      rows: this.layout.rows,
      distance: Math.round(Math.hypot(seat.x, seat.z) * 2) / 2,
      angle: Math.round(THREE.MathUtils.radToDeg(Math.atan2(Math.abs(seat.x), seat.z)))
    })
  }

  private fly (position: THREE.Vector3, target: THREE.Vector3, fov: number, animate: boolean): void {
    if (!animate) {
      this.camera.position.copy(position)
      this.controls.target.copy(target)
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
      this.controls.update()
      this.dirty = true
      return
    }
    this.tween = {
      start: performance.now(),
      fromPosition: this.camera.position.clone(),
      toPosition: position,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      fromFov: this.camera.fov,
      toFov: fov
    }
  }

  private paint (index: number | null, color: THREE.Color): void {
    if (index === null) return
    this.cushions.setColorAt(index, color)
    this.backs.setColorAt(index, color)
    if (this.cushions.instanceColor) this.cushions.instanceColor.needsUpdate = true
    if (this.backs.instanceColor) this.backs.instanceColor.needsUpdate = true
    this.dirty = true
  }

  private setSelected (index: number | null): void {
    this.paint(this.selected, this.baseColor)
    this.selected = index
    this.paint(index, SEAT_SELECTED)
  }

  private setHovered (index: number | null): void {
    if (index === this.hovered) return
    if (this.hovered !== this.selected) this.paint(this.hovered, this.baseColor)
    this.hovered = index
    if (index !== this.selected) this.paint(index, SEAT_HOVER)
    this.renderer.domElement.style.cursor = index === null ? '' : 'pointer'
  }

  private pick (event: PointerEvent): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(pointer, this.camera)
    const hit = this.raycaster.intersectObjects([this.cushions, this.backs], false)[0]
    return hit?.instanceId ?? null
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown
    this.pointerDown = null
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return
    const index = this.pick(event)
    if (index !== null) this.sit(index)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return
    this.setHovered(this.pick(event))
  }

  private resize (): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  private readonly loop = (): void => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    if (this.tween) {
      const t = Math.min((performance.now() - this.tween.start) / 650, 1)
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      this.camera.position.lerpVectors(this.tween.fromPosition, this.tween.toPosition, k)
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k)
      this.camera.fov = THREE.MathUtils.lerp(this.tween.fromFov, this.tween.toFov, k)
      this.camera.updateProjectionMatrix()
      this.camera.lookAt(this.controls.target)
      if (t >= 1) this.tween = null
      this.dirty = true
    } else {
      // The controls clamp camera distance, so they stay out of the way mid-flight.
      this.controls.update()
    }
    if (!this.dirty) return
    this.dirty = false
    this.renderer.render(this.scene, this.camera)
  }
}
