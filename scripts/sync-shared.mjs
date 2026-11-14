// Copies the shared core (see shared.json) from this repository into another
// campus site's checkout, or reports how the two differ.
//
//   node scripts/sync-shared.mjs ../ucd-classrooms           copy this repository's shared files there
//   node scripts/sync-shared.mjs ../ucd-classrooms --check   only list the files that differ
//
// Campus-specific files (src/campus.ts, data, index.html, README) are never touched.
import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]
const check = process.argv.includes('--check')
if (!target) {
  console.error('usage: node scripts/sync-shared.mjs <other repository> [--check]')
  process.exit(1)
}
const manifest = JSON.parse(await readFile(join(here, 'shared.json'), 'utf8'))
const exists = path => stat(path).then(() => true, () => false)

async function walk (folder, base = folder) {
  const out = []
  for (const entry of await readdir(join(here, folder), { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`
    if (entry.isDirectory()) out.push(...await walk(path, base))
    else out.push(path)
  }
  return out
}

const files = [...manifest.files]
for (const folder of manifest.folders) files.push(...await walk(folder))

let changed = 0
for (const file of files) {
  if (!(await exists(join(here, file)))) continue
  const mine = await readFile(join(here, file))
  const theirs = (await exists(join(target, file))) ? await readFile(join(target, file)) : null
  if (theirs && mine.equals(theirs)) continue
  changed++
  console.log(`${theirs ? 'differs' : 'missing'}  ${file}`)
  if (check) continue
  await mkdir(dirname(join(target, file)), { recursive: true })
  await cp(join(here, file), join(target, file))
}
// A shared file deleted here should go there too.
for (const folder of manifest.folders) {
  if (!(await exists(join(target, folder)))) continue
  for (const entry of await readdir(join(target, folder), { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue
    const path = join(entry.parentPath ?? entry.path, entry.name)
    const relative = path.slice(join(target).length + 1).replace(/\\/g, '/')
    if (await exists(join(here, relative))) continue
    changed++
    console.log(`extra    ${relative}`)
    if (!check) await rm(path)
  }
}
console.log(changed === 0 ? 'shared files are identical' : check ? `${changed} shared files differ` : `${changed} shared files updated in ${target}`)
