/** A sentence in both interface languages. */
export interface Text {
  en: string
  zh: string
}

export interface SourceLink {
  /** Shown as the link text, e.g. the site's host and path. */
  label: string
  url: string
}

/** Strings every campus writes for itself: they name its systems and data sources. */
export type CampusStringKey =
  | 'appName'
  | 'searchPlaceholder'
  | 'directoryPage'
  | 'roomNotPublic'
  | 'schoolManaged'
  | 'notPooled'
  | 'partialList'
  | 'schoolRoom'
  | 'listedNotice'
  | 'studyCard'
  | 'studyBook'
  | 'studyLive'
  | 'studyNotLive'
  | 'planCredit'
  | 'aboutBody1'
  | 'aboutClassrooms'
  | 'aboutCourses'
  | 'aboutStudy'
  | 'aboutFloors'
  | 'aboutSchedule'
  | 'aboutCredit'
  | 'studySource'

/**
 * Everything that differs between campuses and is not data. The rest of
 * src/ is shared between the campus sites and copied by scripts/sync-shared.mjs.
 */
export interface CampusConfig {
  /** Prefix for browser storage keys. */
  id: string
  /** Letter in the logo tile. */
  brand: string
  /** IANA time zone of the campus, for "free now". */
  timeZone: string
  repoUrl: string
  /** Where the scheduled job publishes study-room bookings; '' when the site has none. */
  liveAvailabilityUrl: string
  /** Whether data/schedule.json lists this term's class meetings by room. */
  classSchedule: boolean
  /** Map labels for buildings whose full name is too long: building name -> label. */
  labelNames: Record<string, string>
  /** Equipment worth a filter chip in the room finder, as it is spelled in the data. */
  finderEquipment: string[]
  /** Course terms that have a data file, newest first. Empty: no course search. */
  terms: { id: string; label: string }[]
  colors: {
    /** Interface colours as CSS values. */
    primary: string
    primaryDark: string
    primarySoft: string
    accent: string
    accentSoft: string
    /** Map colours as hex numbers: roofs of classroom buildings, their hover and dimmed states. */
    roof: number
    roofHover: number
    roofDim: number
    /** Walls of campus buildings, and their dimmed state. */
    wall: number
    wallDim: number
    /** Floors that hold rooms in the floor stack, and the stack's outlines. */
    floor: number
    floorEdge: number
    /** Roofs of buildings matching a classroom filter. */
    match: number
    /** Roofs highlighted in study-room mode, and of buildings that only have study rooms. */
    study: number
    studyRoof: number
    /** Roofs of buildings a school schedules itself and we know no rooms in. */
    managedRoof: number
    managedRoofHover: number
  }
  sources: {
    classrooms: SourceLink
    courses: SourceLink | null
    study: SourceLink | null
  }
  /** Rooms that are booked somewhere this site cannot read, shown under the study-room list. */
  studyElsewhere: { title: Text; body: Text; links: { label: Text; url: string }[] }[]
  strings: Record<CampusStringKey, Text>
}
