// Condenses the archived Course Listings pages in data/raw/archive/ into
// data/listing-rooms.json: every building / room pair that had a class
// scheduled in it, how many sections were seen there, the largest enrolment
// cap among them and the last year it appeared.
//
//   node scripts/fetch-archive.mjs schools
//   node scripts/fetch-archive.mjs terms
//   node scripts/build-archive.mjs
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'data', 'raw', 'archive')

const NOT_A_BUILDING = /^(\(None\)|See Dept|See Instructor|Remote|TBA|)$/i
const NOT_A_ROOM = /^(\(None\)|NONE|TBD|TBA|FLR\d*|SUM|GYM|[A-Z]|)$/i

/** "Eads / 212 Ridgley / 107" (older parses of two-room sections) -> two pairs. */
function pairs (location) {
  const parts = location.split('/').map(part => part.trim())
  const out = []
  let building = parts[0]
  for (let i = 1; i < parts.length; i++) {
    const match = i < parts.length - 1 ? parts[i].match(/^(\S+)\s+(.+)$/) : null
    if (match) {
      out.push([building, match[1]])
      building = match[2]
    } else {
      out.push([building, parts[i]])
    }
  }
  return out
}

const rooms = new Map()
let pages = 0
let sections = 0
for (const folder of await readdir(dir)) {
  const path = join(dir, folder)
  if (!(await stat(path)).isDirectory()) continue
  for (const name of await readdir(path)) {
    let page
    try {
      page = JSON.parse(await readFile(join(path, name), 'utf8'))
    } catch {
      continue
    }
    pages++
    const year = Number(page.sem ? page.sem.slice(2) : String(page.captured).slice(0, 4))
    for (const row of page.rows ?? []) {
      sections++
      const found = pairs(row.loc)
      for (const [building, room] of found) {
        if (NOT_A_BUILDING.test(building) || NOT_A_ROOM.test(room)) continue
        const key = `${building}|${room.replace(/^0+(?=\d)/, '').toUpperCase()}`
        const entry = rooms.get(key) ?? { b: building, r: room, n: 0, seats: 0, last: 0, forms: new Map() }
        entry.n++
        entry.forms.set(room, (entry.forms.get(room) ?? 0) + 1)
        // A cap only says something about this room when the section met in one room.
        if (found.length === 1 && row.seats > 0 && row.seats <= 500) entry.seats = Math.max(entry.seats, row.seats)
        entry.last = Math.max(entry.last, year)
        if (row.ll && !entry.ll) entry.ll = row.ll
        rooms.set(key, entry)
      }
    }
  }
}

const list = [...rooms.values()]
  .map(entry => {
    // Use the spelling the listings used most ("017" rather than "17").
    const room = [...entry.forms].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
    return { b: entry.b, r: room, n: entry.n, seats: entry.seats || null, last: entry.last, ...(entry.ll ? { ll: entry.ll } : {}) }
  })
  .sort((a, b) => a.b.localeCompare(b.b) || a.r.localeCompare(b.r, 'en', { numeric: true }))

await writeFile(
  join(root, 'data', 'listing-rooms.json'),
  JSON.stringify({
    source: 'WashU Course Listings (courses.wustl.edu and acadinfo.wustl.edu/CourseListings), public pages archived by the Internet Archive',
    note: 'n is the number of archived section rows that met in the room; seats is the largest enrolment cap among them, not the room capacity.',
    built: new Date().toISOString().slice(0, 10),
    pages,
    rooms: list
  }, null, 1)
)
console.log(`${pages} pages, ${sections} section rows, ${list.length} rooms in ${new Set(list.map(item => item.b)).size} buildings`)
