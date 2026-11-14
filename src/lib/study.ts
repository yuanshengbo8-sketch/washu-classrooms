import { CAMPUS } from '../campus'

/** A study space from the campus library's directory. */
export interface StudyRoom {
  id: string
  name: string
  library: string
  /** Building id, shared with the map. */
  building: string
  buildingName: string
  room: string
  /** Library level: 'A', 'B', '1', '2', '3' or '' when the directory does not say. */
  level: string
  seats: number | null
  reservable: boolean
  features: string[]
  text: string
  /** The room's page on the library's site. */
  url: string
  /** Where the room is on its level's floor plan, as fractions of the image's width and height. */
  spot?: [number, number]
  /** Set when the plan names only the area the room is in. */
  spotArea?: string
  /** Its booking page on LibCal, when it can be booked there. */
  book?: string
  eid?: number
}

/** A library's published floor plans: one image per level. */
export interface FloorPlans {
  page: string
  /** Levels from the top floor down. */
  order: string[]
  levels: Record<string, string>
}

export interface StudyData {
  source: string
  booking: string
  fetched: string
  plans?: Record<string, FloorPlans>
  rooms: StudyRoom[]
}

/** Bookable window and booked intervals for one day, in minutes after midnight. */
export interface DayGrid {
  open: [number, number]
  busy: [number, number][]
}

export interface Availability {
  updated: string
  timeZone: string
  rooms: Record<string, Record<string, DayGrid>>
}

export type StudyStatus =
  | { kind: 'free'; until: number }
  | { kind: 'busy'; until: number }
  | { kind: 'closed'; opens: number | null }
  | { kind: 'walkin' }
  | { kind: 'unknown' }

/** Older than this, the grid is not shown as live. */
const STALE_MS = 75 * 60 * 1000

async function getJson<T> (url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

/** The newest grid available: the published live copy, or the one built into the site. */
export async function loadAvailability (bundledUrl: string): Promise<Availability | null> {
  const [live, bundled] = await Promise.all([
    CAMPUS.liveAvailabilityUrl ? getJson<Availability>(CAMPUS.liveAvailabilityUrl) : Promise.resolve(null),
    getJson<Availability>(bundledUrl)
  ])
  if (live && bundled) return live.updated >= bundled.updated ? live : bundled
  return live ?? bundled
}

export function isFresh (availability: Availability | null, now = Date.now()): boolean {
  return availability !== null && now - Date.parse(availability.updated) < STALE_MS
}

/** Date and minutes after midnight on campus, whatever the viewer's own time zone. */
export function campusNow (now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '0'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function gridFor (room: StudyRoom, availability: Availability | null, date: string): DayGrid | null {
  if (!room.eid || !availability) return null
  return availability.rooms[String(room.eid)]?.[date] ?? null
}

export function statusOf (room: StudyRoom, availability: Availability | null, now = new Date()): StudyStatus {
  if (!room.eid) return room.reservable ? { kind: 'unknown' } : { kind: 'walkin' }
  if (!isFresh(availability, now.getTime())) return { kind: 'unknown' }
  const { date, minutes } = campusNow(now)
  const grid = gridFor(room, availability, date)
  if (!grid) return { kind: 'closed', opens: null }
  if (minutes < grid.open[0]) return { kind: 'closed', opens: grid.open[0] }
  if (minutes >= grid.open[1]) return { kind: 'closed', opens: null }
  const current = grid.busy.find(([from, to]) => minutes >= from && minutes < to)
  if (current) {
    // Back-to-back bookings: follow them to the first gap.
    let until = current[1]
    for (const [from, to] of grid.busy) if (from <= until && to > until) until = to
    return { kind: 'busy', until }
  }
  const next = grid.busy.find(([from]) => from > minutes)
  return { kind: 'free', until: next ? next[0] : grid.open[1] }
}

export function clock (minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24
  const minute = minutes % 60
  const suffix = hour >= 12 ? 'pm' : 'am'
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${suffix}`
}
