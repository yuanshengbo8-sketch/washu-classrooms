// Turns an OpenStreetMap extract and a list of rooms into the map the site
// draws: named campus buildings with their room counts, the surrounding
// context buildings, paths, green space, trees and street names.
//
// Shared between the campus sites; what differs per campus is passed in.

export const slugify = text =>
  text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function within (point, polygon) {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/**
 * @param {object} options
 * @param {object} options.osm            Overpass JSON with geometry
 * @param {[number, number]} options.origin   latitude and longitude of the map's centre
 * @param {[number, number]} [options.bounds] half-width and half-height in metres kept for trees and labels
 * @param {object[]} options.classrooms   rooms with `building` (id), `floor` and `capacity`
 * @param {RegExp} options.notCampus      named buildings to treat as plain surroundings
 * @param {RegExp} options.minor          named buildings drawn but not labelled
 * @param {RegExp} options.flatRoof       buildings with flat roofs; the rest are pitched
 * @param {object} [options.managedBy]    building name -> school that schedules its rooms
 * @param {object} [options.photos]       building id -> exterior photo
 * @param {boolean} [options.withinCampus] only buildings inside a mapped university boundary are campus buildings
 * @param {boolean} [options.plantCampus]  also generate trees around campus buildings, for campuses whose trees are mostly unmapped
 */
export function buildCampus ({ osm, origin, bounds = [1500, 1000], classrooms, notCampus, minor, flatRoof, managedBy = {}, photos = {}, withinCampus = false, plantCampus = false }) {
  const NOT_CAMPUS = notCampus
  const MANAGED_BY = managedBy
  const MINOR = minor
  const FLAT_ROOF = flatRoof
  const LAT0 = origin[0]
  const LON0 = origin[1]
  const M_PER_LAT = 110574
  const M_PER_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180)
  const round = value => Math.round(value * 10) / 10
  const project = ({ lat, lon }) => [round((lon - LON0) * M_PER_LON), round((lat - LAT0) * M_PER_LAT)]

  function ring (geometry) {
    const points = []
    for (const node of geometry) {
      const point = project(node)
      const last = points[points.length - 1]
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.3) points.push(point)
    }
    if (points.length > 1) {
      const [first, last] = [points[0], points[points.length - 1]]
      if (first[0] === last[0] && first[1] === last[1]) points.pop()
    }
    return points
  }

  function area (points) {
    let sum = 0
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % points.length]
      sum += x1 * y2 - x2 * y1
    }
    return sum / 2
  }

  function centroid (points) {
    let x = 0
    let y = 0
    let total = 0
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % points.length]
      const cross = x1 * y2 - x2 * y1
      x += (x1 + x2) * cross
      y += (y1 + y2) * cross
      total += cross
    }
    return total === 0 ? points[0] : [round(x / (3 * total)), round(y / (3 * total))]
  }




  // University grounds as mapped in OpenStreetMap, used to tell campus buildings from the town's.
  const campusRings = []
  if (withinCampus) {
    for (const element of osm.elements) {
      if (element.tags?.amenity !== 'university') continue
      if (element.type === 'way' && element.geometry) campusRings.push(ring(element.geometry))
      for (const member of element.members ?? []) {
        if (member.role === 'outer' && member.geometry) campusRings.push(ring(member.geometry))
      }
    }
  }

  const roomsByBuilding = new Map()
  for (const room of classrooms) {
    const list = roomsByBuilding.get(room.building) ?? []
    list.push(room)
    roomsByBuilding.set(room.building, list)
  }

  const named = new Map()
  const context = []
  for (const element of osm.elements) {
    const tags = element.tags ?? {}
    if (!tags.building) continue
    const rings = []
    if (element.type === 'way' && element.geometry) rings.push({ outer: ring(element.geometry), holes: [] })
    if (element.type === 'relation') {
      const holes = []
      for (const member of element.members ?? []) {
        if (!member.geometry) continue
        const points = ring(member.geometry)
        if (points.length < 3) continue
        if (member.role === 'inner') holes.push(points)
        else rings.push({ outer: points, holes: [] })
      }
      if (rings.length === 1) rings[0].holes = holes
    }
    for (const part of rings) {
      if (part.outer.length < 3) continue
      const size = Math.abs(area(part.outer))
      if (size < 12) continue
      const levels = parseFloat(tags['building:levels']) || null
      const height = parseFloat(tags.height) || null
      const onCampus = !campusRings.length || campusRings.some(campusRing => within(centroid(part.outer), campusRing))
      const name = tags.name && onCampus && !NOT_CAMPUS.test(tags.name) ? tags.name.replace(/\s+/g, ' ').trim() : null
      if (name) {
        const id = slugify(name)
        const building = named.get(id) ?? { id, name, parts: [], levels: null, height: null }
        building.parts.push({ poly: part.outer, holes: part.holes, size })
        building.levels = Math.max(building.levels ?? 0, levels ?? 0) || null
        building.height = Math.max(building.height ?? 0, height ?? 0) || null
        named.set(id, building)
      } else {
        context.push({ poly: part.outer, h: height ?? (levels ? levels * 3.5 : size < 160 ? 5 : size < 600 ? 7.5 : 10) })
      }
    }
  }

  const buildings = []
  for (const building of named.values()) {
    building.parts.sort((a, b) => b.size - a.size)
    const rooms = roomsByBuilding.get(building.id) ?? []
    const topFloor = rooms.reduce((max, room) => Math.max(max, room.floor), 0)
    const hasLower = rooms.some(room => room.floor === 0)
    const footprint = building.parts.reduce((sum, part) => sum + part.size, 0)
    // Storeys above ground. OSM tags win; otherwise use the highest classroom
    // floor, or a guess from footprint size for buildings without classrooms.
    const guessed = footprint < 250 ? 2 : footprint < 1200 ? 3 : 4
    const levels = Math.max(building.levels ?? 0, topFloor, building.levels ? 0 : rooms.length ? Math.max(topFloor, 2) : guessed)
    const height = building.height ?? round(levels * 4.2 + 1.5)
    const main = building.parts[0]
    const [cx, cy] = centroid(main.poly)
    buildings.push({
      id: building.id,
      name: building.name,
      levels,
      lower: hasLower,
      h: height,
      c: [cx, cy],
      ll: [Number((LAT0 + cy / M_PER_LAT).toFixed(6)), Number((LON0 + cx / M_PER_LON).toFixed(6))],
      rooms: rooms.length,
      seats: rooms.reduce((sum, room) => sum + (room.capacity ?? 0), 0),
      ...(MANAGED_BY[building.name] ? { managedBy: MANAGED_BY[building.name] } : {}),
      ...(rooms.length === 0 && MINOR.test(building.name) ? { minor: true } : {}),
      area: Math.round(footprint),
      parts: building.parts.map(part => (part.holes.length ? { poly: part.poly, holes: part.holes } : { poly: part.poly }))
    })
  }
  buildings.sort((a, b) => a.name.localeCompare(b.name))

  const missing = [...roomsByBuilding.keys()].filter(id => !named.has(id))
  if (missing.length) console.warn('classroom buildings with no footprint:', missing)

  const PATH_KINDS = {
    footway: 'path', path: 'path', pedestrian: 'path', steps: 'path', cycleway: 'path', corridor: null,
    service: 'service', residential: 'road', unclassified: 'road', tertiary: 'road', tertiary_link: 'road',
    secondary: 'major', secondary_link: 'major', primary: 'major', primary_link: 'major',
    trunk: 'major', trunk_link: 'major', motorway: 'major', motorway_link: 'major', living_street: 'road'
  }
  const AREA_KINDS = {
    pitch: 'pitch', track: 'track', park: 'grass', garden: 'garden', flowerbed: 'garden', playground: 'play',
    grass: 'grass', meadow: 'grass', recreation_ground: 'grass', forest: 'wood', wood: 'wood', scrub: 'scrub',
    water: 'water', fountain: 'water', swimming_pool: 'pool', parking: 'parking'
  }
  const SPORTS = { tennis: 'tennis', basketball: 'court', volleyball: 'court', running: 'track', athletics: 'track' }

  const paths = []
  const areas = []
  const trees = []
  const namedRoads = new Map()
  const inBounds = ([x, y]) => Math.abs(x) < bounds[0] && Math.abs(y) < bounds[1]

  for (const element of osm.elements) {
    const tags = element.tags ?? {}
    if (tags.building) continue
    if (element.type === 'node') {
      if (tags.natural === 'tree') trees.push(project(element))
      continue
    }
    if (element.type === 'relation') {
      // Multipolygon lawns and plazas: keep the outer rings.
      const kind = tags.highway === 'pedestrian' ? 'plaza' : AREA_KINDS[tags.landuse]
      if (!kind) continue
      for (const member of element.members ?? []) {
        if (member.role !== 'outer' || !member.geometry) continue
        const points = ring(member.geometry)
        if (points.length >= 3 && Math.abs(area(points)) > 20) areas.push({ k: kind, p: points })
      }
      continue
    }
    if (!element.geometry) continue
    if (tags.railway) {
      if (tags.tunnel !== 'yes') paths.push({ k: 'rail', p: ring(element.geometry) })
      continue
    }
    if (tags.natural === 'tree_row') {
      // One tree every nine metres along the row.
      const points = ring(element.geometry)
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i]
        const [x2, y2] = points[i + 1]
        const steps = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 9))
        for (let step = 0; step < steps; step++) trees.push([round(x1 + ((x2 - x1) * step) / steps), round(y1 + ((y2 - y1) * step) / steps)])
      }
      continue
    }
    if (tags.highway) {
      if (tags.tunnel === 'yes' || tags.indoor === 'yes') continue
      const closed = element.geometry.length > 2 && element.nodes?.[0] === element.nodes?.[element.nodes.length - 1]
      const points = ring(element.geometry)
      if (tags.area === 'yes' || (closed && tags.highway === 'pedestrian')) {
        if (points.length >= 3 && Math.abs(area(points)) > 20) areas.push({ k: 'plaza', p: points })
        continue
      }
      const kind = tags.highway === 'steps' ? 'steps' : PATH_KINDS[tags.highway]
      if (!kind) continue
      if (closed) points.push(points[0])
      if (points.length < 2) continue
      paths.push({ k: kind, p: points })
      if (tags.name && (kind === 'major' || kind === 'road')) {
        const list = namedRoads.get(tags.name) ?? []
        list.push({ kind, points })
        namedRoads.set(tags.name, list)
      }
      continue
    }
    const kind = AREA_KINDS[tags.leisure] ?? AREA_KINDS[tags.landuse] ?? AREA_KINDS[tags.natural] ?? AREA_KINDS[tags.amenity]
    if (!kind) continue
    const points = ring(element.geometry)
    if (points.length < 3 || Math.abs(area(points)) < (kind === 'water' || kind === 'pool' ? 6 : 20)) continue
    const sport = kind === 'pitch' ? SPORTS[(tags.sport ?? '').split(';')[0]] : null
    areas.push(sport === 'track' ? { k: 'track', p: points } : sport ? { k: 'pitch', s: sport, p: points } : { k: kind, p: points })
  }

  /** Street names laid along the road: one every 420 m, on the straightest stretch nearby. */
  const roadLabels = []
  const ROAD_NAMES = { Boulevard: 'Blvd', Avenue: 'Ave', Parkway: 'Pkwy', Drive: 'Dr', Street: 'St', Road: 'Rd', Place: 'Pl', Lane: 'Ln', North: 'N', South: 'S' }
  for (const [name, list] of namedRoads) {
    const text = name.split(' ').map(word => ROAD_NAMES[word] ?? word).join(' ')
    const spots = []
    for (const { kind, points } of list) {
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i]
        const [x2, y2] = points[i + 1]
        const length = Math.hypot(x2 - x1, y2 - y1)
        if (length < (kind === 'major' ? 45 : 32)) continue
        spots.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, a: Math.atan2(y2 - y1, x2 - x1), length, kind })
      }
    }
    spots.sort((a, b) => b.length - a.length)
    const kept = []
    for (const spot of spots) {
      if (!inBounds([spot.x, spot.y])) continue
      if (kept.some(other => Math.hypot(other.x - spot.x, other.y - spot.y) < 420)) continue
      kept.push(spot)
      // Keep the text upright when north is up.
      let angle = spot.a
      if (angle > Math.PI / 2) angle -= Math.PI
      if (angle <= -Math.PI / 2) angle += Math.PI
      roadLabels.push({ t: text, k: spot.kind, x: round(spot.x), y: round(spot.y), a: Math.round(angle * 1000) / 1000 })
    }
  }

  for (const building of buildings) building.roof = FLAT_ROOF.test(building.name) ? 'flat' : 'pitched'

  for (const building of buildings) {
    const photo = photos[building.id]
    if (photo) building.photo = { src: photo.src, page: photo.page, by: photo.by, license: photo.license }
  }

  // OpenStreetMap has the campus trees but almost none in the neighbourhoods
  // around it. Fill those in so the surroundings do not look bare: street trees
  // along residential roads and one or two yard trees per house. These are
  // decoration, placed by a fixed-seed generator, not surveyed trees.
  {
    let seed = 20261113
    const next = () => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const footprints = [...context.map(item => item.poly), ...buildings.flatMap(building => building.parts.map(part => part.poly))].map(poly => {
      const xs = poly.map(point => point[0])
      const ys = poly.map(point => point[1])
      return { poly, box: [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2] }
    })
    const within = (point, poly) => {
      let hit = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]
        const [xj, yj] = poly[j]
        if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit
      }
      return hit
    }
    const roads = paths.filter(path => path.k !== 'path' && path.k !== 'steps')
    const nearRoad = (point, limit) => roads.some(path => {
      for (let i = 0; i < path.p.length - 1; i++) {
        const [x1, y1] = path.p[i]
        const [x2, y2] = path.p[i + 1]
        const dx = x2 - x1
        const dy = y2 - y1
        const t = Math.max(0, Math.min(1, ((point[0] - x1) * dx + (point[1] - y1) * dy) / (dx * dx + dy * dy || 1)))
        if (Math.hypot(point[0] - x1 - t * dx, point[1] - y1 - t * dy) < limit) return true
      }
      return false
    })
    const hard = areas.filter(item => ['parking', 'plaza', 'pitch', 'track', 'pool', 'water', 'play'].includes(item.k)).map(item => item.p)
    const taken = []
    const free = (point, roadGap) =>
      inBounds(point) &&
      !footprints.some(item => point[0] > item.box[0] && point[0] < item.box[2] && point[1] > item.box[1] && point[1] < item.box[3] && within(point, item.poly)) &&
      !hard.some(poly => within(point, poly)) &&
      !nearRoad(point, roadGap) &&
      !taken.some(other => Math.hypot(other[0] - point[0], other[1] - point[1]) < 6) &&
      !trees.some(other => Math.hypot(other[0] - point[0], other[1] - point[1]) < 6)
    const before = trees.length
    for (const path of paths) {
      if (path.k !== 'road') continue
      for (let i = 0; i < path.p.length - 1; i++) {
        const [x1, y1] = path.p[i]
        const [x2, y2] = path.p[i + 1]
        const length = Math.hypot(x2 - x1, y2 - y1)
        if (length < 10) continue
        const nx = -(y2 - y1) / length
        const ny = (x2 - x1) / length
        for (let d = 6 + next() * 6; d < length - 4; d += 12 + next() * 7) {
          for (const side of [-1, 1]) {
            if (next() < 0.2) continue
            const point = [round(x1 + ((x2 - x1) * d) / length + nx * side * 7.6), round(y1 + ((y2 - y1) * d) / length + ny * side * 7.6)]
            if (free(point, 5.5)) taken.push(point)
          }
        }
      }
    }
    for (const item of context) {
      const [cx, cy] = centroid(item.poly)
      const reach = Math.sqrt(Math.abs(area(item.poly))) * 0.75 + 5
      for (let count = next() < 0.55 ? 2 : 1; count > 0; count--) {
        const angle = next() * Math.PI * 2
        const point = [round(cx + Math.cos(angle) * reach), round(cy + Math.sin(angle) * reach)]
        if (free(point, 6.5)) taken.push(point)
      }
    }
    if (plantCampus) {
      // A few trees around each campus building, kept off the footpaths.
      const walks = paths.filter(path => path.k === 'path' || path.k === 'steps')
      const onWalk = point => walks.some(path => {
        for (let i = 0; i < path.p.length - 1; i++) {
          const [x1, y1] = path.p[i]
          const [x2, y2] = path.p[i + 1]
          const dx = x2 - x1
          const dy = y2 - y1
          const t = Math.max(0, Math.min(1, ((point[0] - x1) * dx + (point[1] - y1) * dy) / (dx * dx + dy * dy || 1)))
          if (Math.hypot(point[0] - x1 - t * dx, point[1] - y1 - t * dy) < 2.6) return true
        }
        return false
      })
      for (const building of buildings) {
        const size = Math.sqrt(building.area)
        for (let count = Math.max(2, Math.min(7, Math.round(size / 9))), tries = 0; count > 0 && tries < 40; tries++) {
          const angle = next() * Math.PI * 2
          const reach = size * 0.62 + 5 + next() * 12
          const point = [round(building.c[0] + Math.cos(angle) * reach), round(building.c[1] + Math.sin(angle) * reach)]
          if (!free(point, 5.5) || onWalk(point)) continue
          taken.push(point)
          count--
        }
      }
    }
    trees.push(...taken)
    console.log(`${before} mapped trees, ${taken.length} added around the neighbourhood`)
  }

  const campus = {
    origin: [LAT0, LON0],
    attribution: 'Map data © OpenStreetMap contributors, ODbL',
    buildings,
    context,
    paths,
    areas,
    trees: trees.filter(inBounds).flat(),
    roadLabels
  }


  return { campus, buildings, context, paths, areas, roomsByBuilding }
}
