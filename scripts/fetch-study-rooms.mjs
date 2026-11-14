// Builds public/data/study-rooms.json: the study rooms WashU Libraries list at
// library.washu.edu/study-rooms, joined to the rooms that can be booked on the
// Libraries' public LibCal site (wustl.libcal.com).
//
//   node scripts/fetch-study-rooms.mjs
//
// The library site sometimes answers 500; the last good download is kept in
// data/raw/study/ and reused when that happens.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const raw = join(root, 'data', 'raw', 'study')
const UA = 'washu-classrooms data build (https://github.com/yuanshengbo8-sketch/washu-classrooms)'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function cached (name, url, json) {
  const file = join(raw, name)
  for (let attempt = 0; attempt < (process.argv.includes('--offline') ? 0 : 3); attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) })
      if (response.status === 400) return null
      if (!response.ok) throw new Error(String(response.status))
      const text = await response.text()
      if (json) JSON.parse(text)
      await writeFile(file, text)
      return json ? JSON.parse(text) : text
    } catch (error) {
      console.warn(`${url}: ${error.message}`)
      await sleep(8000)
    }
  }
  try {
    const text = await readFile(file, 'utf8')
    console.warn(`using the saved copy of ${name}`)
    return json ? JSON.parse(text) : text
  } catch {
    return null
  }
}

const strip = html => String(html ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#8217;|&rsquo;/g, "'")
  .replace(/&#8211;|&ndash;/g, '-')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/** Library branch -> the building it sits in, by its OpenStreetMap name. */
const LOCATIONS = {
  'olin-library': { library: 'Olin Library', building: 'Olin Library' },
  'kopolow-business-library': { library: 'Kopolow Business Library', building: 'Bauer Hall' },
  'kranzberg-library': { library: 'Kranzberg Art & Architecture Library', building: 'Mildred Lane Kemper Art Museum' },
  'east-asian-library': { library: 'East Asian Library', building: 'January Hall' }
}
const slugify = text => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fourteen: 14, sixteen: 16 }

await mkdir(raw, { recursive: true })

// ---- LibCal: what can be booked --------------------------------------------
const libcal = await cached('libcal-allspaces.html', 'https://wustl.libcal.com/allspaces', false)
const bookable = []
for (const match of (libcal ?? '').matchAll(/resources\.push\(\{([\s\S]*?)\}\);/g)) {
  const field = name => match[1].match(new RegExp(`\\b${name}: (?:"([^"]*)"|(\\d+))`))
  const text = name => JSON.parse(`"${field(name)?.[1] ?? ''}"`)
  const number = name => Number(field(name)?.[2] ?? 0)
  bookable.push({ eid: number('eid'), gid: number('gid'), lid: number('lid'), title: text('title'), url: text('url'), capacity: number('capacity'), group: text('grouping') })
}
const rooms = bookable.filter(item => !/Display|Terminal/i.test(item.group + item.title))
console.log(`${rooms.length} bookable study spaces on LibCal`)

// ---- library directory -----------------------------------------------------
const directory = []
for (let page = 1; page <= 5; page++) {
  const list = await cached(`page-${page}.json`, `https://library.washu.edu/wp-json/wp/v2/study-rooms?per_page=20&page=${page}`, true)
  if (!list || list.length === 0) break
  directory.push(...list)
  if (list.length < 20) break
  await sleep(3000)
}

const out = []
for (const item of directory) {
  const classes = item.class_list ?? []
  const locationSlug = classes.find(name => name.startsWith('washu_tax_studyroom_location-'))?.replace('washu_tax_studyroom_location-', '')
  const location = LOCATIONS[locationSlug] ?? LOCATIONS['olin-library']
  const features = classes.filter(name => name.startsWith('washu_tax_studyroom_feature-')).map(name => name.replace('washu_tax_studyroom_feature-', ''))
  const name = strip(item.title?.rendered)
  const text = strip(item.content?.rendered)
  const number = name.match(/\b([AB]?\d{2,3}[A-Z]?)\b/)?.[1] ?? item.slug.match(/-([ab]?\d{2,3}[a-z]?)$/i)?.[1]?.toUpperCase() ?? ''
  const level = /^[AB]/.test(number) ? number[0] : number.length === 3 ? number[0] : ''
  const count = '(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fourteen|sixteen|\\d+)'
  const seatWord = (
    text.match(new RegExp(`seating (?:space )?for ${count}`, 'i')) ??
    text.match(new RegExp(`${count} (?:study )?(?:carrels|terminals|chairs)`, 'i')) ??
    text.match(new RegExp(`for ${count} individuals`, 'i'))
  )?.[1]
  const seats = text.match(/\/(\d+) seats/)?.[1] ?? (seatWord ? WORDS[seatWord.toLowerCase()] ?? Number(seatWord) : null)
  // Match the directory entry to its LibCal page by room number or name.
  const booking = rooms.find(room =>
    (number && new RegExp(`\\b(RM |Room )?${number}\\b`).test(room.title) && location.library === 'Olin Library') ||
    (/Newman Exploration/i.test(name) && /Newman/i.test(room.title)) ||
    (/Rome Seminar/i.test(name) && /Rome/i.test(room.title)) ||
    (/^Study Pod (\d)/.test(name) && room.title.includes(name.match(/^Study Pod \d/)[0])))
  out.push({
    id: item.slug,
    name,
    library: location.library,
    building: slugify(location.building),
    buildingName: location.building,
    room: number,
    level,
    seats: booking?.capacity || (seats ? Number(seats) : null),
    reservable: features.includes('reservable'),
    features: features.filter(feature => feature !== 'reservable'),
    text,
    url: item.link,
    ...(booking ? { book: `https://wustl.libcal.com${booking.url}`, eid: booking.eid, gid: booking.gid, lid: booking.lid } : {})
  })
}
const order = library => (library === 'Olin Library' ? '0' : '1') + library
out.sort((a, b) => order(a.library).localeCompare(order(b.library)) || Number(b.reservable) - Number(a.reservable) || a.name.localeCompare(b.name, 'en', { numeric: true }))

await writeFile(
  join(root, 'public', 'data', 'study-rooms.json'),
  JSON.stringify({
    source: 'https://library.washu.edu/study-rooms/',
    booking: 'https://wustl.libcal.com/allspaces',
    fetched: new Date().toISOString().slice(0, 10),
    rooms: out
  })
)
console.log(`${out.length} study rooms, ${out.filter(room => room.eid).length} with live booking, ${out.filter(room => room.reservable && !room.eid).length} reservable elsewhere`)
for (const room of out) console.log(` ${room.library.slice(0, 12).padEnd(12)} ${room.name.padEnd(48)} L${room.level || '-'} seats ${room.seats ?? '-'} ${room.reservable ? 'reservable' : ''} ${room.eid ?? ''} ${room.features.join(',')}`)
