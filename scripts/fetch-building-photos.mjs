// Looks for a freely licensed exterior photo of each labelled building on
// Wikimedia Commons and writes the candidates to data/raw/photo-candidates.json.
// The photos actually used are picked by hand into data/building-photos.json,
// because a search hit is not always the right building.
//
//   node scripts/fetch-building-photos.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'washu-classrooms-data-build/1.0 (static campus map; Wikimedia Commons search)'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const campus = JSON.parse(await readFile(join(root, 'public', 'data', 'campus.json'), 'utf8'))
const buildings = campus.buildings.filter(building => !building.minor)

const strip = html => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim()
/** The part of a building's name that tells it apart: "Simon Hall", "Olin Library". */
const site = JSON.parse(await readFile(join(root, 'campus.data.json'), 'utf8'))
const core = name => (site.nameNoise ?? []).reduce((text, noise) => (text.startsWith(noise) ? text.slice(noise.length) : text), name)

async function search (query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.search = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '12', gsrsearch: query,
    prop: 'imageinfo|categories', cllimit: '50', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '800'
  })
  let response
  for (let attempt = 0; ; attempt++) {
    response = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(40000) })
    if (response.status !== 429 || attempt >= 4) break
    // Commons limits search requests: wait as long as it asks, then try again.
    await sleep((Number(response.headers.get('retry-after')) || 30) * 1000 + 2000)
  }
  if (!response.ok) throw new Error(String(response.status))
  const data = await response.json()
  return Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index)
}

// Words that tie a photo to this campus; set in campus.data.json.
const WASHU = new RegExp(site.commonsMatch, 'i')
const NOT_EXTERIOR = /interior|inside|lecture|plaque|sign|statue|map|logo|seal|portrait|construction|aerial|panorama of the|window detail|stained|organ|commencement|ceremony|protest|encampment|debate|speaker|speech|\b(18|19[0-4])\d\b/i

// Resumable: buildings already searched are kept.
let out = {}
try {
  out = JSON.parse(await readFile(join(root, 'data', 'raw', 'photo-candidates.json'), 'utf8'))
} catch {}
for (const building of buildings) {
  if (out[building.id]?.searched) continue
  const name = core(building.name)
  let pages = []
  try {
    pages = await search(`"${name}" "${site.commonsQuery}"`)
  } catch (error) {
    console.warn(`${building.name}: ${error.message}`)
    continue
  }
  const candidates = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info || !/jpe?g|png/i.test(info.mime ?? '') || info.width < 700) continue
    const meta = info.extmetadata ?? {}
    const title = page.title.replace(/^File:/, '')
    const text = `${title} ${strip(meta.ImageDescription?.value)} ${(page.categories ?? []).map(category => category.title).join(' ')}`
    // The photo has to name this building and tie it to WashU, and not be an interior, a sign or an event.
    if (!text.toLowerCase().includes(name.toLowerCase().replace(/ (hall|building)$/, '')) || !WASHU.test(text) || NOT_EXTERIOR.test(title)) continue
    const license = meta.LicenseShortName?.value ?? ''
    if (!/^(CC|Public domain|PD)/i.test(license)) continue
    candidates.push({
      title,
      thumb: info.thumburl,
      page: info.descriptionurl,
      by: strip(meta.Artist?.value).slice(0, 80),
      license,
      licenseUrl: meta.LicenseUrl?.value ?? '',
      landscape: info.width >= info.height,
      inTitle: title.toLowerCase().includes(name.toLowerCase().replace(/ (hall|building)$/, ''))
    })
  }
  candidates.sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || Number(b.landscape) - Number(a.landscape))
  out[building.id] = { name: building.name, searched: true, candidates: candidates.slice(0, 4) }
  await writeFile(join(root, 'data', 'raw', 'photo-candidates.json'), JSON.stringify(out, null, 1))
  console.log(`${building.name.padEnd(40)} ${candidates.length}`)
  await sleep(2500)
}

await mkdir(join(root, 'data', 'raw'), { recursive: true })
await writeFile(join(root, 'data', 'raw', 'photo-candidates.json'), JSON.stringify(out, null, 1))
console.log(`${Object.values(out).filter(item => item.candidates.length).length} of ${buildings.length} buildings have a candidate`)
