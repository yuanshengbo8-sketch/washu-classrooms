// Turns the raw downloads in data/raw/ into the files the site loads:
//
//   public/data/classrooms.json   rooms from the CTL Classroom Directory
//   public/data/campus.json       building footprints, paths and green space
//
//   node scripts/build-data.mjs

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RAW = join(ROOT, 'data', 'raw')
const OUT = join(ROOT, 'public', 'data')

// ---- classrooms ------------------------------------------------------------

const decode = text =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;|&#0?38;/g, '&')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** CTL building label -> the building's name in OpenStreetMap. */
const BUILDING_ALIASES = {
  Brown: 'Brown Hall',
  Busch: 'Busch Hall',
  Crow: 'Crow Hall',
  'Cupples I': 'Cupples I Hall',
  'Cupples II': 'Cupples II Hall',
  Duncker: 'Duncker Hall',
  Eads: 'Eads Hall',
  // The room sits where the two connected halls meet; CTL files it under Eads.
  'Eads/Ridgley Hall': 'Eads Hall',
  Hillman: 'Hillman Hall',
  January: 'January Hall',
  'Life Sciences': 'Life Sciences Building',
  'Lopata House': 'Lucy and Stanley Lopata House',
  Louderman: 'Louderman Hall',
  Mallinckrodt: 'Mallinckrodt Student Center',
  'Mallinckrodt Center': 'Mallinckrodt Student Center',
  McDonnell: 'McDonnell Hall',
  McMillan: 'McMillan Hall',
  Rebstock: 'Rebstock Hall',
  Ridgley: 'Ridgley Hall',
  Rudolph: 'Scott Rudolph Hall',
  'Rudolph Hall': 'Scott Rudolph Hall',
  Sever: 'Sever Hall',
  Simon: 'Simon Hall',
  Somers: 'Somers Family Hall',
  Steinberg: 'Steinberg Hall',
  Umrath: 'Umrath Hall',
  Weil: 'Weil Hall',
  Whitaker: 'Whitaker Hall',
  Wilson: 'Wilson Hall',
  Wrighton: 'Wrighton Hall',
  'Mark S. Wrighton Hall': 'Wrighton Hall'
}

const slugify = text =>
  text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Floor index from a WashU room number. 0 is the lower level. Rooms numbered
 * below 100 (14, 017) or prefixed L, B or G sit on the lower level; 301 is
 * on floor 3. The engineering buildings use four digits with the floor first
 * (Jolley 2101, Brauer 3015).
 */
export function floorOf (room) {
  const text = room.trim().toUpperCase()
  if (/^[LBG]\d/.test(text)) return 0
  // Named rooms such as "ST1" carry no floor.
  if (!/^\d/.test(text)) return 1
  const digits = text.match(/\d+/)[0]
  return digits.length >= 3 ? Number(digits[0]) : 0
}

function parseClassroom (html, slug) {
  const titleMatch = html.match(/class="classroom-single__title">([\s\S]*?)<span class="classroom-number">([\s\S]*?)<\/span>/)
  if (!titleMatch) return null
  let buildingLabel = decode(titleMatch[1])
  let room = decode(titleMatch[2])
  // Some pages put a department after the room number ("203 - Earth & ...").
  let note = ''
  const noteMatch = room.match(/^(\S+)\s*[-–]\s*(.+)$/)
  if (noteMatch) {
    room = noteMatch[1]
    note = noteMatch[2]
  }

  const header = {}
  for (const match of html.matchAll(/<li class="classroom-single__detail">\s*<p><strong>([\s\S]*?)<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>/g)) {
    header[decode(match[1])] = decode(match[2])
  }

  const slideshow = html.match(/classroom-single__header-slideshow[\s\S]*?<\/header>/)?.[0] ?? ''
  const photos = [...slideshow.matchAll(/<img[^>]*?\ssrc="([^"]+)"/g)].map(match => match[1])

  const tour = html.match(/id="tour-button"[^>]*href="\s*([^"]+?)\s*"/)?.[1] ?? null

  const equipBlock = html.match(/classroom-single__details-list--equip">([\s\S]*?)<\/ul>/)?.[1] ?? ''
  const equipment = [...equipBlock.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => decode(match[1])).filter(Boolean)

  const details = {}
  for (const match of html.matchAll(/classroom-single__details-title"><strong>([\s\S]*?)<\/strong><\/div>\s*<div>([\s\S]*?)<\/div>/g)) {
    details[decode(match[1])] = decode(match[2])
  }

  const mapBlock = html.match(/<div id="room-map-div"[\s\S]*?<\/ul>/)?.[0] ?? ''
  const absolute = url => (url.startsWith('/') ? `https://ctl.wustl.edu${url}` : url)
  const seatMaps = [...mapBlock.matchAll(/<a href="([^"]+)"[^>]*>\s*<img src="([^"]+)"/g)].map(match => ({
    file: absolute(match[1]),
    image: absolute(match[2])
  }))

  const number = text => {
    const value = parseInt(text ?? '', 10)
    return Number.isFinite(value) ? value : null
  }

  // Drop department notes such as "Rudolph Hall (Earth and Planetary Science)".
  const department = buildingLabel.match(/\(([^)]+)\)/)?.[1]
  if (department && !note) note = department
  buildingLabel = buildingLabel.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  const osmName = BUILDING_ALIASES[buildingLabel] ?? buildingLabel
  return {
    id: slug,
    building: slugify(osmName),
    buildingName: osmName,
    room,
    note,
    floor: floorOf(room),
    capacity: number(header['Seating Capacity']),
    style: header['Seating Style'] ?? details['Seating Style'] ?? '',
    boardType: details['Board Type'] ?? header['Board Type'] ?? '',
    boards: number(details['Number of Boards'] ?? header['Board #']),
    screens: number(details['Projection Screens']),
    wirelessMics: number(details['Wireless Microphones']),
    micFor: details['Microphone Available For'] ?? '',
    darkening: details['Darkening Grade'] ?? '',
    accessible: /yes/i.test(details['Wheelchair Accessible'] ?? ''),
    equipment,
    photos,
    seatMaps,
    tour,
    url: `https://ctl.wustl.edu/classrooms/${slug}/`
  }
}

const ctlDir = join(RAW, 'ctl')
const classrooms = []
for (const name of (await readdir(ctlDir)).filter(name => name.endsWith('.html')).sort()) {
  const slug = name.replace(/\.html$/, '')
  const room = parseClassroom(await readFile(join(ctlDir, name), 'utf8'), slug)
  if (room) classrooms.push(room)
  else console.warn(`could not parse ${name}`)
}
// Rooms a school runs itself are not in the CTL directory. data/extra-rooms.json
// lists the ones a public page names; they carry no photos or equipment.
const extra = JSON.parse(await readFile(join(ROOT, 'data', 'extra-rooms.json'), 'utf8'))
let extraCount = 0
for (const item of extra.rooms) {
  const building = slugify(item.building)
  if (classrooms.some(room => room.building === building && room.room === item.room)) continue
  extraCount++
  classrooms.push({
    id: `${building}-${slugify(item.room)}`,
    building,
    buildingName: item.building,
    room: item.room,
    note: item.name ?? '',
    floor: floorOf(item.room),
    capacity: item.capacity ?? null,
    style: item.style ?? '',
    boardType: '',
    boards: null,
    screens: null,
    wirelessMics: null,
    micFor: '',
    darkening: '',
    accessible: false,
    equipment: [],
    photos: [],
    seatMaps: [],
    tour: null,
    url: item.source,
    managedBy: item.managedBy
  })
}
// Rooms that held classes according to WashU's old public Course Listings
// (see scripts/fetch-archive.mjs). They add the rooms the CTL directory leaves
// out: school-run classrooms, department seminar rooms and studios.
const LISTING_BUILDINGS = {
  'AB Law Bldg': 'Anheuser-Busch Hall', 'Academy Bldg': 'Academy Building', Bauer: 'Bauer Hall', Bixby: 'Bixby Hall', Blewett: 'Blewett Hall',
  'Brauer Hall': 'Brauer Hall', Brown: 'Brown Hall', Busch: 'Busch Hall', 'Busch Lab': 'Busch Laboratory', Compton: 'Compton Laboratory',
  Crow: 'Crow Hall', 'Cupples I': 'Cupples I Hall', 'Cupples II': 'Cupples II Hall', 'Danforth Ctr': 'Danforth University Center',
  Duncker: 'Duncker Hall', Eads: 'Eads Hall', Gaylord: 'Gaylord Music Library', Givens: 'Givens Hall', Goldfarb: 'Goldfarb Hall',
  'Green Hall': 'Green Hall', Hillman: 'Hillman Hall', 'January Hall': 'January Hall', Jolley: 'Jolley Hall', Jubel: 'Jubel Hall',
  Kemper: 'Mildred Lane Kemper Art Museum', 'Knight Hall': 'Knight Hall', 'Life Sciences': 'Life Sciences Building',
  'Lopata Hall': 'Lopata Hall', 'Lopata House': 'Lucy and Stanley Lopata House', Louderman: 'Louderman Hall',
  Mallinckrodt: 'Mallinckrodt Student Center', McDonnell: 'McDonnell Hall', 'McKelvey Hall': 'McKelvey Hall', McMillan: 'McMillan Hall',
  McMillen: 'McMillen Laboratory', 'Music Cls Bldg': 'Music Classroom Building', Rebstock: 'Rebstock Hall', Ridgley: 'Ridgley Hall',
  Rudolph: 'Scott Rudolph Hall', 'Schnuck Pav': 'Schnuck Pavilion', Seigle: 'Seigle Hall', Sever: 'Sever Hall', Simon: 'Simon Hall',
  'Somers Family': 'Somers Family Hall', Steinberg: 'Steinberg Hall', 'Tietjens Hall': 'Tietjens Hall', Umrath: 'Umrath Hall',
  Urbauer: 'Urbauer Hall', 'Village House': 'Village House', 'Walker Hall': 'Earl E. and Myrtle E. Walker Hall', Weil: 'Weil Hall',
  Whitaker: 'Whitaker Hall', Wilson: 'Wilson Hall', 'Wom Bldg': "Ann W. Olin Women's Building", Wrighton: 'Wrighton Hall'
}
/** Who schedules the rooms of these buildings that are not in the CTL pool. */
const ROOM_MANAGERS = {
  'Simon Hall': 'Olin Business School', 'Bauer Hall': 'Olin Business School', 'Knight Hall': 'Olin Business School',
  'Anheuser-Busch Hall': 'School of Law', 'Goldfarb Hall': 'Brown School', 'Hillman Hall': 'Brown School',
  'Givens Hall': 'Sam Fox School of Design & Visual Arts', 'Bixby Hall': 'Sam Fox School of Design & Visual Arts',
  'Earl E. and Myrtle E. Walker Hall': 'Sam Fox School of Design & Visual Arts', 'Steinberg Hall': 'Sam Fox School of Design & Visual Arts',
  'Weil Hall': 'Sam Fox School of Design & Visual Arts', 'Mildred Lane Kemper Art Museum': 'Sam Fox School of Design & Visual Arts',
  'Brauer Hall': 'McKelvey School of Engineering', 'Green Hall': 'McKelvey School of Engineering', 'McKelvey Hall': 'McKelvey School of Engineering',
  'Urbauer Hall': 'McKelvey School of Engineering', 'Jolley Hall': 'McKelvey School of Engineering', 'Jubel Hall': 'McKelvey School of Engineering',
  'Whitaker Hall': 'McKelvey School of Engineering', 'Lopata Hall': 'McKelvey School of Engineering'
}
const roomKey = text => text.toUpperCase().replace(/^0+(?=\d)/, '')
let listingCount = 0
const unknownLabels = new Map()
let listings = { rooms: [] }
try {
  listings = JSON.parse(await readFile(join(ROOT, 'data', 'listing-rooms.json'), 'utf8'))
} catch {
  console.warn('data/listing-rooms.json not found: run scripts/build-archive.mjs')
}
for (const item of listings.rooms) {
  const name = LISTING_BUILDINGS[item.b]
  if (!name) {
    unknownLabels.set(item.b, (unknownLabels.get(item.b) ?? 0) + item.n)
    continue
  }
  const building = slugify(name)
  const known = classrooms.find(room => room.building === building && roomKey(room.room) === roomKey(item.r))
  if (known) {
    // Keep the directory entry and note how recently classes met there.
    known.lastYear = item.last
    known.sections = item.n
    continue
  }
  // One sighting can be a typo in the listing; two or more is a room.
  if (item.n < 2) continue
  listingCount++
  classrooms.push({
    id: `${building}-${slugify(item.r)}`,
    building,
    buildingName: name,
    room: item.r,
    note: '',
    floor: floorOf(item.r),
    capacity: null,
    style: '',
    boardType: '',
    boards: null,
    screens: null,
    wirelessMics: null,
    micFor: '',
    darkening: '',
    accessible: false,
    equipment: [],
    photos: [],
    seatMaps: [],
    tour: null,
    url: '',
    source: 'listings',
    largestClass: item.seats,
    lastYear: item.last,
    sections: item.n,
    ...(ROOM_MANAGERS[name] ? { managedBy: ROOM_MANAGERS[name] } : {})
  })
}
classrooms.sort((a, b) => a.buildingName.localeCompare(b.buildingName) || a.room.localeCompare(b.room, 'en', { numeric: true }))

// ---- campus ----------------------------------------------------------------

const osm = JSON.parse(await readFile(join(RAW, 'osm.json'), 'utf8'))
const LAT0 = 38.6483
const LON0 = -90.3078
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

/** Buildings near but not part of the university, kept as plain context. */
const NOT_CAMPUS = /church|ministry|vedanta|adventist|wydown|historical society|st\. michael|copy center|scientist|hillel|chabad|catholic/i

/** Buildings whose classrooms the school schedules itself. */
const MANAGED_BY = {
  'Bauer Hall': 'Olin Business School',
  'Knight Hall': 'Olin Business School',
  'Charles F. Knight Center': 'Olin Business School',
  'Anheuser-Busch Hall': 'School of Law',
  'Goldfarb Hall': 'Brown School',
  'Givens Hall': 'Sam Fox School of Design & Visual Arts',
  'Bixby Hall': 'Sam Fox School of Design & Visual Arts',
  'Earl E. and Myrtle E. Walker Hall': 'Sam Fox School of Design & Visual Arts',
  'Brauer Hall': 'McKelvey School of Engineering',
  'Green Hall': 'McKelvey School of Engineering',
  'McKelvey Hall': 'McKelvey School of Engineering',
  'Urbauer Hall': 'McKelvey School of Engineering'
}

/** Housing, garages and outbuildings: drawn, but not labelled on the map. */
const MINOR = /House$|Apartment|Garage|Parking|Tool Shed|^Alpha |^Kappa |^Sigma |^Theta |Village East|Millbrook|Facility$|Pavillion$|Tech Den|^East Building$|^Science Building$|^Academy Building$|Rand Center|Taylor Library/

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
    const name = tags.name && !NOT_CAMPUS.test(tags.name) ? tags.name.replace(/\s+/g, ' ').trim() : null
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
const inBounds = ([x, y]) => Math.abs(x) < 1500 && Math.abs(y) < 1000

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

/** Roof form. Most of the Danforth Campus is Collegiate Gothic with pitched slate roofs. */
const FLAT_ROOF = /Olin Library|Mallinckrodt|Athletic|Field House|Recreation|Kemper|Steinberg|Weil|Givens|Bixby|Walker|Schnuck|Jubel|McKelvey|Garage|Parking|Bryan|Compton|Lopata Hall|Jolley|Urbauer|Laboratory|Radiochemistry|Life Sciences|Monsanto|McMillen|Millbrook|Facility|Welcome Center|Knight Center|Village East|Music Classroom|Gaylord/
for (const building of buildings) building.roof = FLAT_ROOF.test(building.name) ? 'flat' : 'pitched'

// Exterior photos, picked by hand from Wikimedia Commons (scripts/fetch-building-photos.mjs lists candidates).
try {
  const picked = JSON.parse(await readFile(join(ROOT, 'data', 'building-photos.json'), 'utf8')).photos
  for (const building of buildings) {
    const photo = picked[building.id]
    if (photo) building.photo = { src: photo.src, page: photo.page, by: photo.by, license: photo.license }
  }
  console.log(`${buildings.filter(building => building.photo).length} buildings have an exterior photo`)
} catch {
  console.warn('data/building-photos.json not found: buildings will have no photos')
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

const styles = new Map()
const equipment = new Map()
for (const room of classrooms) {
  styles.set(room.style, (styles.get(room.style) ?? 0) + 1)
  for (const item of room.equipment) equipment.set(item, (equipment.get(item) ?? 0) + 1)
}

await mkdir(OUT, { recursive: true })
await writeFile(
  join(OUT, 'classrooms.json'),
  JSON.stringify({
    source: 'https://ctl.wustl.edu/classrooms/',
    fetched: new Date().toISOString().slice(0, 10),
    rooms: classrooms
  })
)
await writeFile(join(OUT, 'campus.json'), JSON.stringify(campus))

console.log(`${classrooms.length} rooms in ${roomsByBuilding.size} buildings (${extraCount} from extra-rooms.json, ${listingCount} from archived course listings)`)
console.log('listing buildings not on this map:', [...unknownLabels].sort((a, b) => b[1] - a[1]).map(([label, count]) => `${label} (${count})`).join(', '))
console.log('labelled without rooms:', buildings.filter(b => b.rooms === 0 && !b.minor).map(b => b.name).join(' | '))
console.log(`${buildings.length} named buildings, ${context.length} context buildings, ${paths.length} paths, ${areas.length} areas`)
console.log('styles:', Object.fromEntries([...styles].sort((a, b) => b[1] - a[1])))
console.log('equipment:', Object.fromEntries([...equipment].sort((a, b) => b[1] - a[1])))
console.log('with tour:', classrooms.filter(room => room.tour).length, 'with seat map:', classrooms.filter(room => room.seatMaps.length).length, 'no photos:', classrooms.filter(room => !room.photos.length).map(room => room.id))
