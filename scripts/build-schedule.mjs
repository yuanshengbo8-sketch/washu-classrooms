// Turns a list of course sections read from Workday's "Find Course Sections"
// report into public/data/schedule.json: for each classroom, the weekly class
// meetings of the term.
//
//   node scripts/build-schedule.mjs [--sections]
//
// The input, data/raw/workday/sections.json, is not in the repository: room
// assignments are only shown to signed-in members of the university. A
// signed-in student reads the report in their own browser and saves the rows
// as { rows: [{ p, c, t, u, d, f, m, cap }] }, where d holds lines such as
// "SIMON, Room 00105 | Mon/Wed | 8:30 AM - 9:50 AM".
//
// By default the output only says when a room is in use. With --sections it
// also names the section that is using it.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const WITH_SECTIONS = process.argv.includes('--sections')

/** Fall 2026 on the Danforth Campus, from the Registrar's academic calendar. */
const TERM = {
  term: 'Fall 2026',
  from: '2026-08-24',
  to: '2026-12-07',
  // Labor Day, fall break, Thanksgiving break.
  off: ['2026-09-07', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'],
  // Half-semester periods: only the one running now belongs in a weekly grid.
  periods: { 'F26-UG': true, 'F26-GR': true, 'F26-A': false, 'F26-B': true }
}

/** Workday's building label -> building id on the map. */
const BUILDINGS = {
  'AB HALL': 'anheuser-busch-hall',
  ACADEMY: 'academy-building',
  BAUER: 'bauer-hall',
  BIXBY: 'bixby-hall',
  BRAUER: 'brauer-hall',
  BROWN: 'brown-hall',
  BRYAN: 'bryan-hall',
  'BUSCH HALL': 'busch-hall',
  'BUSCH LAB': 'busch-laboratory',
  CROW: 'crow-hall',
  'CUPPLES I': 'cupples-i-hall',
  'CUPPLES II': 'cupples-ii-hall',
  DUC: 'danforth-university-center',
  DUNCKER: 'duncker-hall',
  EADS: 'eads-hall',
  GIVENS: 'givens-hall',
  GOLDFARB: 'goldfarb-hall',
  GREEN: 'green-hall',
  HILLMAN: 'hillman-hall',
  JANUARY: 'january-hall',
  JOLLEY: 'jolley-hall',
  JUBEL: 'jubel-hall',
  KEMPER: 'mildred-lane-kemper-art-museum',
  KNIGHT: 'knight-hall',
  LIFESCI: 'life-sciences-building',
  'LOPATA HALL': 'lopata-hall',
  'LOPATA HSE': 'lucy-and-stanley-lopata-house',
  LOUDERMAN: 'louderman-hall',
  MALLINCKRODT: 'mallinckrodt-student-center',
  MCDONNELL: 'mcdonnell-hall',
  MCKELVEY: 'mckelvey-hall',
  'MCMILL HALL': 'mcmillan-hall',
  'MCMILL X': 'mcmillan-hall',
  REBSTOCK: 'rebstock-hall',
  RIDGLEY: 'ridgley-hall',
  RUDOLPH: 'scott-rudolph-hall',
  SCHNUCK: 'schnuck-pavilion',
  SEIGLE: 'seigle-hall',
  SEVER: 'sever-hall',
  SIMON: 'simon-hall',
  SOMERS: 'somers-family-hall',
  STEINBERG: 'steinberg-hall',
  UMRATH: 'umrath-hall',
  URBAUER: 'urbauer-hall',
  VILLAGEHSE: 'village-house',
  WALKER: 'earl-e-and-myrtle-e-walker-hall',
  WEIL: 'weil-hall',
  WHITAKER: 'whitaker-hall',
  WILSON: 'wilson-hall',
  WOMENS: 'ann-w-olin-women-s-building',
  WRIGHTON: 'wrighton-hall'
}

const DAYS = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'R', Fri: 'F', Sat: 'S', Sun: 'U' }

const minutes = text => {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i)
  if (!match) return null
  return (Number(match[1]) % 12 + (match[3].toUpperCase() === 'P' ? 12 : 0)) * 60 + Number(match[2])
}

/** "00105" -> "105", "0L001" -> "L001": Workday pads room numbers to five characters. */
const roomNumber = text => text.replace(/^0+(?=.)/, '')

/**
 * Room numbers compared loosely. Workday writes Seigle L006 as 00006 and
 * Bauer 230 as BH230, so the lower-level L, a building prefix before the
 * digits, leading zeros and case do not count.
 */
const loose = text => text.toUpperCase().replace(/^(?:L|BH|KH)(?=\d)/, '').replace(/^0+(?=.)/, '')

const { rows } = JSON.parse(await readFile(join(ROOT, 'data', 'raw', 'workday', 'sections.json'), 'utf8'))
const { rooms } = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'classrooms.json'), 'utf8'))

const known = new Map()
for (const room of rooms) known.set(`${room.building}|${loose(room.room)}`, room.id)

const schedule = {}
const unknownBuildings = new Map()
const unknownRooms = new Map()
let meetings = 0
let skipped = 0
for (const row of rows) {
  if (TERM.periods[row.p] !== true) continue
  for (const line of row.d) {
    const parts = line.split('|').map(part => part.trim())
    const place = parts.length === 3 ? parts[0].match(/^(.*), Room (\S+)$/) : null
    const days = (parts.at(-2) ?? '').split('/').map(day => DAYS[day]).join('')
    const [start, end] = (parts.at(-1) ?? '').split(' - ').map(minutes)
    if (!place || !days || start == null || end == null) { skipped++; continue }
    const building = BUILDINGS[place[1]]
    if (!building) { unknownBuildings.set(place[1], (unknownBuildings.get(place[1]) ?? 0) + 1); continue }
    const id = known.get(`${building}|${loose(roomNumber(place[2]))}`)
    if (!id) {
      const key = `${place[1]} ${roomNumber(place[2])}`
      unknownRooms.set(key, (unknownRooms.get(key) ?? 0) + 1)
      continue
    }
    const meeting = WITH_SECTIONS ? [days, start, end, row.c] : [days, start, end]
    const list = (schedule[id] ??= [])
    // Cross-listed sections share one meeting.
    if (!list.some(other => other[0] === days && other[1] === start && other[2] === end)) list.push(meeting)
    meetings++
  }
}
for (const list of Object.values(schedule)) list.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))

const { periods, ...term } = TERM
await mkdir(join(ROOT, 'public', 'data'), { recursive: true })
await writeFile(
  join(ROOT, 'public', 'data', 'schedule.json'),
  JSON.stringify({ ...term, fetched: new Date().toISOString().slice(0, 10), rooms: Object.fromEntries(Object.entries(schedule).sort()) })
)

const top = map => [...map].sort((a, b) => b[1] - a[1]).map(([key, count]) => `${key} (${count})`).join(', ')
console.log(`${rows.length} sections read, ${meetings} meetings placed in ${Object.keys(schedule).length} of ${rooms.length} rooms${WITH_SECTIONS ? ', with section codes' : ''}`)
console.log(`${skipped} meetings without a room or a time`)
if (unknownBuildings.size) console.log('buildings not mapped:', top(unknownBuildings))
if (unknownRooms.size) console.log(`${unknownRooms.size} rooms not in classrooms.json:`, top(unknownRooms))
