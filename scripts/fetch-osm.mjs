// Downloads the campus geometry (buildings, paths, green space, trees) from
// OpenStreetMap through the Overpass API into data/raw/osm.json. The area is
// the `bbox` in campus.data.json: south, west, north, east.
// Map data © OpenStreetMap contributors, ODbL.
//
//   node scripts/fetch-osm.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const BBOX = JSON.parse(await readFile(join(ROOT, 'campus.data.json'), 'utf8')).bbox
const box = BBOX.join(',')
const query = `[out:json][timeout:90];
(
  way["building"](${box});
  relation["building"](${box});
  way["highway"](${box});
  relation["highway"="pedestrian"](${box});
  way["railway"~"light_rail|rail"](${box});
  way["leisure"~"pitch|park|garden|track|swimming_pool|playground"](${box});
  way["landuse"~"grass|forest|recreation_ground|flowerbed|meadow"](${box});
  relation["landuse"~"grass|forest"](${box});
  way["natural"~"wood|water|scrub|tree_row"](${box});
  node["natural"="tree"](${box});
  way["amenity"~"parking|fountain"](${box});
  way["amenity"="university"](${box});
  relation["amenity"="university"](${box});
);
out body geom;`

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

for (let attempt = 0; attempt < MIRRORS.length * 2; attempt++) {
  const url = MIRRORS[attempt % MIRRORS.length]
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'washu-classrooms-explorer/0.1 (open-source student project)'
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(150000)
    })
    const text = await response.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data.elements) || data.elements.length === 0) {
      throw new Error('empty result')
    }
    await mkdir(join(ROOT, 'data', 'raw'), { recursive: true })
    await writeFile(join(ROOT, 'data', 'raw', 'osm.json'), JSON.stringify(data))
    console.log(`${data.elements.length} elements from ${url}`)
    process.exit(0)
  } catch (error) {
    console.error(`${url}: ${String(error.message).slice(0, 80)}`)
    await sleep(4000 * (attempt + 1))
  }
}
console.error('all Overpass mirrors failed')
process.exit(1)
