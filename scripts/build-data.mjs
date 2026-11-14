// Turns the raw downloads in data/raw/ into the files the site loads:
//
//   public/data/classrooms.json   rooms from the CTL Classroom Directory
//   public/data/campus.json       building footprints, paths and green space
//
//   node scripts/build-data.mjs

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCampus, slugify } from './lib/campus-map.mjs'

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
    // CTL's uploads come in several sizes; the small one is enough for a list.
    ...(photos[0]?.includes('-800x533') ? { thumb: photos[0].replace('-800x533', '-300x200') } : {}),
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
const site = JSON.parse(await readFile(join(ROOT, 'campus.data.json'), 'utf8'))

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

/** Roof form. Most of the Danforth Campus is Collegiate Gothic with pitched slate roofs. */
const FLAT_ROOF = /Olin Library|Mallinckrodt|Athletic|Field House|Recreation|Kemper|Steinberg|Weil|Givens|Bixby|Walker|Schnuck|Jubel|McKelvey|Garage|Parking|Bryan|Compton|Lopata Hall|Jolley|Urbauer|Laboratory|Radiochemistry|Life Sciences|Monsanto|McMillen|Millbrook|Facility|Welcome Center|Knight Center|Village East|Music Classroom|Gaylord/

// Exterior photos, picked by hand from Wikimedia Commons (scripts/fetch-building-photos.mjs lists candidates).
let photos = {}
try {
  photos = JSON.parse(await readFile(join(ROOT, 'data', 'building-photos.json'), 'utf8')).photos
} catch {
  console.warn('data/building-photos.json not found: buildings will have no photos')
}

const { campus, buildings, context, paths, areas, roomsByBuilding } = buildCampus({
  osm,
  origin: site.origin,
  bounds: site.bounds,
  classrooms,
  notCampus: NOT_CAMPUS,
  minor: MINOR,
  flatRoof: FLAT_ROOF,
  managedBy: MANAGED_BY,
  photos
})
console.log(`${buildings.filter(building => building.photo).length} buildings have an exterior photo`)

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
