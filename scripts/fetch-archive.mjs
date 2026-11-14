// Downloads archived copies of WashU's old public Course Listings from the
// Internet Archive and keeps the section rows: days, time, building / room,
// seats. The listings were public and gave the room of every section, which
// the current public schedule search does not. WashU retired them when it
// moved to Workday in 2025.
//
// Two hosts carried the same pages:
//   courses.wustl.edu/CourseInfo.aspx                 no term in the URL
//   acadinfo.wustl.edu/CourseListings/CourseInfo.aspx one term per URL
//
//   node scripts/fetch-archive.mjs schools   # every school except Arts & Sciences
//   node scripts/fetch-archive.mjs terms     # Arts & Sciences, FL2021 to SP2025
//
// Resumable: finished pages are skipped. Output goes to data/raw/archive/.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'data', 'raw', 'archive')
const UA = 'washu-classrooms data build (https://github.com/yuanshengbo8-sketch/washu-classrooms)'
const TERMS = ['SP2025', 'FL2024', 'SP2024', 'FL2023', 'SP2023', 'FL2022', 'SP2022', 'FL2021', 'SU2024', 'SU2023', 'SU2022']
// Business, engineering, architecture, art, social work, law, continuing
// studies, interdisciplinary. Medical-campus schools are left out.
const SCHOOLS = ['B', 'E', 'A', 'F', 'S', 'W', 'I', 'U']
const WORKERS = 4
const PAUSE_MS = 300

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const exists = path => access(path).then(() => true, () => false)

async function get (url, tries = 6) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) })
      if (response.ok) return await response.text()
      if (response.status === 404) return null
      throw new Error(String(response.status))
    } catch (error) {
      if (attempt >= tries) throw error
      await sleep(attempt * 20000)
    }
  }
}

async function captureList (name, pattern) {
  const cache = join(out, name)
  if (await exists(cache)) return readFile(cache, 'utf8')
  const text = await get(`https://web.archive.org/cdx/search/cdx?url=${pattern}&output=txt&filter=statuscode:200&fl=original,timestamp&limit=80000`)
  await writeFile(cache, text)
  return text
}

const decode = text => text
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;?/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim()

/** Pulls the section rows out of one CourseInfo page. A section that meets in two rooms gives two rows. */
export function parseSections (html) {
  const rows = []
  for (const match of html.matchAll(/<tr id='tr[^']*'>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(cell => cell[1])
    if (cells.length < 10) continue
    const split = cell => cell.split(/<br\s*\/?>/i)
    const days = split(cells[2]).map(decode)
    const times = split(cells[3]).map(decode)
    const places = split(cells[4])
    places.forEach((place, index) => {
      const location = decode(place)
      if (!location.includes('/')) return
      const at = place.match(/%40(-?[\d.]+),(-?[\d.]+)/)
      rows.push({
        sec: decode(cells[1]),
        days: days[index] ?? days[0] ?? '',
        time: times[index] ?? times[0] ?? '',
        loc: location,
        ll: at ? [Number(at[1]), Number(at[2])] : null,
        seats: Number(decode(cells[7])) || 0,
        enroll: Number(decode(cells[8])) || 0
      })
    })
  }
  return rows
}

function params (original) {
  const query = new URLSearchParams((original.split('?')[1] ?? '').replace(/&amp;/g, '&'))
  return {
    sem: query.get('sem'),
    dept: (query.get('dept') ?? '').toUpperCase(),
    crs: (query.get('crs') ?? '').toUpperCase()
  }
}

async function jobsFor (mode) {
  const latest = new Map()
  const keep = (key, capture) => {
    const previous = latest.get(key)
    if (!previous || previous.timestamp < capture.timestamp) latest.set(key, capture)
  }
  const clean = text => text.replace(/[^\w-]/g, '_')
  if (mode === 'schools') {
    const list = await captureList('captures-old.txt', 'courses.wustl.edu/CourseInfo.aspx*')
    for (const line of list.split('\n')) {
      const [original, timestamp] = line.trim().split(' ')
      if (!original || !timestamp || timestamp < '2019') continue
      const { dept, crs } = params(original)
      if (!dept) continue
      if (!crs) {
        // A whole department on one page. Each half-year capture shows a different term.
        const level = (original.match(/crslvl=([^&]+)/i)?.[1] ?? "all").replace(/%3A/gi, ":")
        const half = timestamp.slice(0, 4) + (timestamp.slice(4, 6) < "07" ? "a" : "b")
        keep(`lists/${clean(`${dept}-${level}-${half}`)}`, { original, timestamp, sem: "", dept, crs: "" })
        continue
      }
      if (!SCHOOLS.includes(dept[0])) continue
      keep(`old/${clean(`${dept}-${crs}`)}`, { original, timestamp, sem: "", dept, crs })
    }
    const rank = ([key, capture]) => (key.startsWith("lists/") ? 0 : 100) + (SCHOOLS.indexOf(capture.dept[0]) + 1 || 50)
    return [...latest.entries()].sort((a, b) => rank(a) - rank(b))
  }
  const list = await captureList('captures.txt', 'acadinfo.wustl.edu/CourseListings/CourseInfo.aspx*')
  for (const line of list.split('\n')) {
    const [original, timestamp] = line.trim().split(' ')
    if (!original || !timestamp) continue
    const { sem, dept, crs } = params(original)
    if (!sem || !dept || !crs || !TERMS.includes(sem)) continue
    keep(`${sem}/${clean(`${dept}-${crs}`)}`, { original, timestamp, sem, dept, crs })
  }
  return [...latest.entries()].sort((a, b) => TERMS.indexOf(a[1].sem) - TERMS.indexOf(b[1].sem))
}

async function main () {
  const mode = process.argv[2] === 'terms' ? 'terms' : 'schools'
  await mkdir(join(out, 'old'), { recursive: true })
  await mkdir(join(out, 'lists'), { recursive: true })
  for (const sem of TERMS) await mkdir(join(out, sem), { recursive: true })
  const jobs = await jobsFor(mode)
  console.log(`${jobs.length} archived course pages (${mode})`)

  let done = 0
  let failed = 0
  const worker = async () => {
    for (;;) {
      const job = jobs.shift()
      if (!job) return
      const [key, capture] = job
      const file = join(out, `${key}.json`)
      done++
      if (await exists(file)) continue
      try {
        const html = await get(`https://web.archive.org/web/${capture.timestamp}id_/${capture.original.replace(/&amp;/g, '&')}`)
        const rows = html ? parseSections(html) : []
        await writeFile(file, JSON.stringify({ sem: capture.sem, dept: capture.dept, crs: capture.crs, captured: capture.timestamp, rows }))
      } catch (error) {
        failed++
        console.log(`failed ${key}: ${error.message}`)
      }
      if (done % 100 === 0) console.log(`${done} done, ${jobs.length} left, ${failed} failed`)
      await sleep(PAUSE_MS)
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))
  console.log(`finished, ${failed} failed`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
