// Downloads the public WashU Class Schedule Search results for one term into
// data/raw/courses/<term>/ and writes public/data/courses-<term>.json.
//
// The public search lists course, section, instructor, days, time and seats.
// It does not publish room assignments, so this file cannot say which room a
// section meets in.
//
//   node scripts/fetch-courses.mjs "2026 Fall" [--refresh]

import { mkdir, readFile, writeFile, access, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const URL_SEARCH = 'https://registrar.washu.edu/classes-registration/class-schedule-search/'
const UA = 'washu-classrooms-explorer/0.1 (open-source student project; polite crawler)'
const DELAY_MS = 3000
const MAX_PAGES = 60

const SCHOOLS = [
  'Arts & Sciences',
  'Brown School',
  'Bursky School of Public Health',
  'McKelvey School of Engineering',
  'Olin Business School',
  'Sam Fox School of Design & Visual Arts',
  'School of Continuing & Professional Studies',
  'School of Law',
  'Washington University in St. Louis'
]

const term = process.argv[2]
if (!term || term.startsWith('--')) {
  console.error('usage: node scripts/fetch-courses.mjs "2026 Fall" [--refresh]')
  process.exit(1)
}
const refresh = process.argv.includes('--refresh')
const termSlug = term.replace(/^(\d{4}) (\w)\w*$/, (_, year, season) => `${year}${season}`).replace(/\s+/g, '')
const RAW = join(ROOT, 'data', 'raw', 'courses', termSlug)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const exists = path => access(path).then(() => true, () => false)

async function fetchPage (school, page) {
  const body = new URLSearchParams({ term, school })
  if (page === 1) body.set('filter_submit', 'Submit')
  else {
    body.set('paged', String(page))
    body.set('pagination-submit', '')
  }
  const response = await fetch(URL_SEARCH, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) throw new Error(`${response.status} for ${school} page ${page}`)
  return response.text()
}

/** Keep only the results block; the rest of the page is site chrome. */
function resultsOnly (html) {
  const start = html.indexOf('<div class="scpi__classes">')
  const end = html.indexOf('</form>', start)
  const counter = html.match(/class="scpi__counter">([^<]*)</)?.[1] ?? ''
  if (start === -1) return `<!--counter:${counter}-->`
  return `<!--counter:${counter}-->` + html.slice(start, end)
}

await mkdir(RAW, { recursive: true })
for (const [schoolIndex, school] of SCHOOLS.entries()) {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const file = join(RAW, `${schoolIndex}-${String(page).padStart(2, '0')}.html`)
    let html
    if (!refresh && (await exists(file))) {
      html = await readFile(file, 'utf8')
    } else {
      html = resultsOnly(await fetchPage(school, page))
      await writeFile(file, html)
      console.log(`${school} page ${page}: ${html.match(/counter:([^-]*)-/)?.[1]}`)
      await sleep(DELAY_MS)
    }
    if (!html.includes('name="pagination-submit"')) break
  }
}

// ---- parse ---------------------------------------------------------------

const decode = text =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;|&#0?38;/g, '&')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const DAY_CODES = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'R', Fri: 'F', Sat: 'S', Sun: 'U' }

function minutes (clock) {
  const match = clock.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null
  let hour = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hour += 12
  return hour * 60 + Number(match[2])
}

const value = (block, name) =>
  decode(block.match(new RegExp(`class="scpi-class__value ${name}[^"]*">([\\s\\S]*?)</div>`))?.[1] ?? '')

const courses = new Map()
const files = (await readdir(RAW)).filter(name => name.endsWith('.html')).sort()
for (const name of files) {
  const school = SCHOOLS[Number(name.split('-')[0])]
  const html = await readFile(join(RAW, name), 'utf8')
  for (const row of html.split('<div class="scpi__classes--row"').slice(1)) {
    const department = decode(row.match(/class="scpi-class__department">([\s\S]*?)<\/div>/)?.[1] ?? '')
    const headings = [...row.matchAll(/class="scpi-class__heading \w+">([\s\S]*?)<\/div>/g)].map(match => decode(match[1]))
    const [title, code, unitText] = headings
    if (!code) continue
    const level = decode(row.match(/class="scpi-class__details--title">([\s\S]*?)<\/div>/)?.[1] ?? '')
    const key = `${code}|${title}`
    let course = courses.get(key)
    if (!course) {
      course = { code, title, units: parseFloat(unitText) || 0, dept: department, school, level, sections: [] }
      courses.set(key, course)
    }
    for (const block of row.split('<div class="scpi-class__data" data-section-id="').slice(1)) {
      const id = block.slice(0, block.indexOf('"'))
      if (course.sections.some(section => section.id === id)) continue
      const days = value(block, 'value-days')
        .split(/\s+/)
        .map(day => DAY_CODES[day] ?? '')
        .join('')
      const [start, end] = value(block, 'value-time').split('-').map(minutes)
      const seats = value(block, 'value-seating').match(/(\d+)\s*\/\s*(\d+)/)
      course.sections.push({
        id,
        n: value(block, 'value-section-number'),
        term: value(block, 'value-term'),
        inst: value(block, 'value-instructor'),
        mode: value(block, 'value-delivery-mode'),
        days,
        start: start ?? null,
        end: end ?? null,
        taken: seats ? Number(seats[1]) : null,
        cap: seats ? Number(seats[2]) : null
      })
    }
  }
}

const list = [...courses.values()].sort((a, b) => a.code.localeCompare(b.code))
for (const course of list) {
  course.sections.sort((a, b) => a.n.localeCompare(b.n))
  for (const section of course.sections) delete section.id
}
const sectionCount = list.reduce((sum, course) => sum + course.sections.length, 0)
const out = {
  term,
  source: URL_SEARCH,
  fetched: new Date().toISOString().slice(0, 10),
  note: 'Public class schedule search. Room assignments are not published there.',
  courses: list
}
await mkdir(join(ROOT, 'public', 'data'), { recursive: true })
await writeFile(join(ROOT, 'public', 'data', `courses-${termSlug}.json`), JSON.stringify(out))
console.log(`${list.length} courses, ${sectionCount} sections -> public/data/courses-${termSlug}.json`)
