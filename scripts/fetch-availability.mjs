// Reads today's and tomorrow's booking grid for the library study rooms from
// the public LibCal pages (the same request the booking page makes, no login)
// and writes it in a compact form the site can load.
//
//   node scripts/fetch-availability.mjs [output.json]
//
// A scheduled GitHub Action runs this and publishes the result on the
// `live-data` branch; see .github/workflows/study-availability.yml.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const output = process.argv[2] ?? join(root, 'public', 'data', 'study-availability.json')
const site = JSON.parse(await readFile(join(root, 'campus.data.json'), 'utf8'))
const UA = site.userAgent
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const directory = JSON.parse(await readFile(join(root, 'public', 'data', 'study-rooms.json'), 'utf8'))
const groups = new Map()
for (const room of directory.rooms) {
  if (room.eid) groups.set(`${room.lid}:${room.gid}`, { lid: room.lid, gid: room.gid })
}

/** Calendar date on campus, `offset` days from today. */
function day (offset) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: site.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.now() + offset * 86400000))
  const get = type => parts.find(part => part.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}
const start = day(0)
const end = day(2)
const minutes = text => Number(text.slice(11, 13)) * 60 + Number(text.slice(14, 16))

const rooms = {}
let first = true
for (const { lid, gid } of groups.values()) {
  // robots.txt asks for ten seconds between requests.
  if (!first) await sleep(10500)
  first = false
  const response = await fetch(`${site.libcal}/spaces/availability/grid`, {
    method: 'POST',
    headers: {
      'user-agent': UA,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      referer: `${site.libcal}/allspaces`
    },
    body: new URLSearchParams({ lid, gid, eid: -1, seat: 0, seatId: 0, zone: 0, start, end, pageIndex: 0, pageSize: 50 }),
    signal: AbortSignal.timeout(45000)
  })
  if (!response.ok) throw new Error(`LibCal answered ${response.status} for group ${gid}`)
  const data = await response.json()
  for (const slot of data.slots ?? []) {
    const date = slot.start.slice(0, 10)
    const room = (rooms[slot.itemId] ??= {})
    const entry = (room[date] ??= { open: [minutes(slot.start), 0], busy: [] })
    const from = minutes(slot.start)
    // A slot that ends at midnight reads 00:00 on the next day.
    const to = slot.end.slice(0, 10) === date ? minutes(slot.end) : 1440
    entry.open[0] = Math.min(entry.open[0], from)
    entry.open[1] = Math.max(entry.open[1], to)
    if (slot.className) {
      const last = entry.busy[entry.busy.length - 1]
      if (last && last[1] === from) last[1] = to
      else entry.busy.push([from, to])
    }
  }
}

if (Object.keys(rooms).length === 0) throw new Error('LibCal returned no slots')
await writeFile(output, JSON.stringify({ updated: new Date().toISOString(), timeZone: site.timeZone, source: `${site.libcal}/allspaces`, rooms }))
console.log(`${Object.keys(rooms).length} rooms, ${start} to ${end}, written to ${output}`)
