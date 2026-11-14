// Reads the list of bookable spaces out of a LibCal "all spaces" page
// (<host>/allspaces), which embeds them as script data. Shared between the
// campus sites, whose libraries both run LibCal.

/**
 * @param {string} html the /allspaces page
 * @returns {{ eid: number, gid: number, lid: number, title: string, url: string, capacity: number, group: string }[]}
 */
export function listSpaces (html) {
  const spaces = []
  for (const match of (html ?? '').matchAll(/resources\.push\(\{([\s\S]*?)\}\);/g)) {
    const field = name => match[1].match(new RegExp(`\\b${name}: (?:"([^"]*)"|(\\d+))`))
    // Titles are written with  -style escapes.
    const text = name => JSON.parse(`"${field(name)?.[1] ?? ''}"`)
    const number = name => Number(field(name)?.[2] ?? 0)
    spaces.push({ eid: number('eid'), gid: number('gid'), lid: number('lid'), title: text('title'), url: text('url'), capacity: number('capacity'), group: text('grouping') })
  }
  return spaces
}
