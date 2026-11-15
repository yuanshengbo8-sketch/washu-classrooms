import type { Building, Course, Room, Section } from './types'

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '')
const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** True when every query token appears in the haystack, or the query matches with spaces and punctuation removed. */
function matches (haystack: string, haystackCompact: string, queryTokens: string[], queryCompact: string): boolean {
  if (queryCompact && haystackCompact.includes(queryCompact)) return true
  return queryTokens.every(token => haystack.includes(token))
}

export function searchBuildings (buildings: Building[], query: string, limit = 5): Building[] {
  const queryTokens = tokens(query)
  const queryCompact = compact(query)
  if (!queryCompact) return []
  return buildings
    .filter(building => !building.minor && matches(building.name.toLowerCase(), compact(building.name), queryTokens, queryCompact))
    .sort((a, b) => b.rooms - a.rooms)
    .slice(0, limit)
}

export function searchRooms (rooms: Room[], query: string, limit = 8): Room[] {
  const queryTokens = tokens(query)
  const queryCompact = compact(query)
  if (!queryCompact) return []
  const scored: { room: Room; score: number }[] = []
  for (const room of rooms) {
    const short = room.buildingName.replace(/ (Hall|Building|Student Center)$/, '')
    const haystack = `${room.buildingName} ${room.room} ${room.style} ${room.note}`.toLowerCase()
    const haystackCompact = `${compact(short + room.room)} ${compact(room.buildingName + room.room)}`
    if (!matches(haystack, haystackCompact, queryTokens, queryCompact)) continue
    const exact = queryTokens.includes(room.room.toLowerCase()) || haystackCompact.split(' ').includes(queryCompact)
    scored.push({ room, score: (exact ? 1000 : 0) + (room.capacity ?? 0) / 1000 })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.room.id.localeCompare(b.room.id, 'en', { numeric: true }))
    .slice(0, limit)
    .map(item => item.room)
}

const courseIndex = new WeakMap<Course[], { text: string; compactCode: string }[]>()

export function searchCourses (courses: Course[], query: string, limit = 12): Course[] {
  const queryTokens = tokens(query)
  const queryCompact = compact(query)
  if (queryCompact.length < 2) return []
  let index = courseIndex.get(courses)
  if (!index) {
    index = courses.map(course => ({
      text: `${course.code} ${course.title} ${course.dept} ${[...new Set(course.sections.map(section => section.inst))].join(' ')}`.toLowerCase(),
      compactCode: compact(course.code)
    }))
    courseIndex.set(courses, index)
  }
  const scored: { course: Course; score: number }[] = []
  for (let i = 0; i < courses.length; i++) {
    const { text, compactCode } = index[i]
    const codeHit = compactCode.startsWith(queryCompact)
    if (!codeHit && !queryTokens.every(token => text.includes(token))) continue
    const titleHit = courses[i].title.toLowerCase().startsWith(query.trim().toLowerCase())
    const subjectHit = queryTokens.length > 0 && compactCode.startsWith(queryTokens[0])
    scored.push({ course: courses[i], score: (codeHit ? 4 : 0) + (subjectHit ? 2 : 0) + (titleHit ? 1 : 0) })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.course.code.localeCompare(b.course.code))
    .slice(0, limit)
    .map(item => item.course)
}

export function formatClock (minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')}${suffix}`
}

export const DAY_ORDER = 'MTWRFSU'

export function formatMeeting (section: Section, dayNames: string[], tba: string): string {
  if (!section.days || section.start === null || section.end === null) return tba
  const days = [...section.days].map(letter => dayNames[DAY_ORDER.indexOf(letter)] ?? letter)
  const joiner = dayNames[0].length <= 2 ? '、' : ' '
  return `${days.join(joiner)} ${formatClock(section.start)}–${formatClock(section.end)}`
}
