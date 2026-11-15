import { CAMPUS } from '../campus'
import { campusNow } from './study'

/** One weekly class meeting in a room: day letters (M T W R F S U), start and end in minutes after midnight, and the section when it is published. */
export type Meeting = [days: string, start: number, end: number, section?: string]

/** The term's class meetings by room id. It holds classes only: no exams, events or one-off bookings. */
export interface ClassSchedule {
  term: string
  /** First and last day of classes, as YYYY-MM-DD. */
  from: string
  to: string
  /** Days inside the term with no classes. */
  off: string[]
  fetched: string
  rooms: Record<string, Meeting[]>
}

export type ClassStatus =
  /** No class now; `until` is the next class today, or null when there is none. */
  | { kind: 'free'; until: number | null }
  | { kind: 'busy'; until: number; section?: string }
  /** Outside the term, a day without classes, or a room the schedule does not cover. */
  | { kind: 'unknown' }

const LETTERS = 'UMTWRFS'

/** The day letter for a campus date. */
export function dayLetter (date: string): string {
  return LETTERS[new Date(`${date}T12:00:00Z`).getUTCDay()]
}

/** Whether classes meet on this campus date. */
export function inSession (schedule: ClassSchedule, date: string): boolean {
  return date >= schedule.from && date <= schedule.to && !schedule.off.includes(date)
}

/** The room's meetings on one day letter, earliest first. */
export function meetingsOn (schedule: ClassSchedule, roomId: string, letter: string): Meeting[] {
  return (schedule.rooms[roomId] ?? []).filter(meeting => meeting[0].includes(letter)).sort((a, b) => a[1] - b[1])
}

export function classStatus (schedule: ClassSchedule | null, roomId: string, now = new Date()): ClassStatus {
  if (!schedule || !schedule.rooms[roomId]) return { kind: 'unknown' }
  const { date, minutes } = campusNow(now)
  if (!inSession(schedule, date)) return { kind: 'unknown' }
  const today = meetingsOn(schedule, roomId, dayLetter(date))
  const current = today.find(meeting => minutes >= meeting[1] && minutes < meeting[2])
  if (current) {
    // Classes that follow within a passing period count as one busy stretch.
    let until = current[2]
    for (const meeting of today) if (meeting[1] <= until + 10 && meeting[2] > until) until = meeting[2]
    return { kind: 'busy', until, section: current[3] }
  }
  const next = today.find(meeting => meeting[1] > minutes)
  return { kind: 'free', until: next ? next[1] : null }
}

/** Ids of the rooms with no class right now, or null when the schedule cannot say (no data, or outside the term). */
export function freeRooms (schedule: ClassSchedule | null, now = new Date()): Set<string> | null {
  if (!schedule || !inSession(schedule, campusNow(now).date)) return null
  const free = new Set<string>()
  for (const roomId of Object.keys(schedule.rooms)) if (classStatus(schedule, roomId, now).kind === 'free') free.add(roomId)
  return free
}

/** Whether this campus publishes a class schedule at all. */
export const HAS_SCHEDULE = CAMPUS.classSchedule
