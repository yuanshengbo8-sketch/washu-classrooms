// Downloads the public WashU CTL Classroom Directory pages into data/raw/ctl/.
// The site's robots.txt asks for a 10 second crawl delay, which this honors.
// Pages already on disk are skipped, so the script can be stopped and resumed.
//
//   node scripts/fetch-classrooms.mjs [--refresh]

import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'data', 'raw', 'ctl')
const UA = 'washu-classrooms-explorer/0.1 (open-source student project; polite crawler)'
const DELAY_MS = 10_000
const refresh = process.argv.includes('--refresh')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const exists = path => access(path).then(() => true, () => false)

async function get (url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

await mkdir(OUT, { recursive: true })

const sitemapPath = join(OUT, '_sitemap.xml')
if (refresh || !(await exists(sitemapPath))) {
  await writeFile(sitemapPath, await get('https://ctl.wustl.edu/classroom-sitemap.xml'))
  await sleep(DELAY_MS)
}
const sitemap = await readFile(sitemapPath, 'utf8')
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(match => match[1].trim())
  .filter(url => /\/classrooms\/[^/]+\/$/.test(url))

console.log(`${urls.length} classroom pages`)
let fetched = 0
for (const url of urls) {
  const slug = url.split('/').filter(Boolean).pop()
  const file = join(OUT, `${slug}.html`)
  if (!refresh && (await exists(file))) continue
  try {
    await writeFile(file, await get(url))
    fetched++
    console.log(`[${fetched}] ${slug}`)
  } catch (error) {
    console.error(`failed: ${slug}: ${error.message}`)
  }
  await sleep(DELAY_MS)
}
console.log(`done, ${fetched} new pages`)
