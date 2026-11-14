export type Point = [number, number]

export interface SeatMap {
  file: string
  image: string
}

export interface Room {
  id: string
  /** Building id, shared with {@link Building.id}. */
  building: string
  buildingName: string
  room: string
  note: string
  /** 0 is the lower level. */
  floor: number
  capacity: number | null
  style: string
  boardType: string
  boards: number | null
  screens: number | null
  wirelessMics: number | null
  micFor: string
  darkening: string
  accessible: boolean
  equipment: string[]
  photos: string[]
  seatMaps: SeatMap[]
  tour: string | null
  /** The CTL page, or for a school-managed room the public page that names it. */
  url: string
  /** Set when a school, not the Registrar, schedules the room. Such rooms have no CTL details. */
  managedBy?: string
  /** 'listings': known only from WashU's archived public course listings. */
  source?: 'listings'
  /** Largest enrolment cap of a class listed in the room. A lower bound on its size, not its capacity. */
  largestClass?: number | null
  /** Last year the archived listings show a class in the room. */
  lastYear?: number
  /** Archived section rows that met in the room. */
  sections?: number
}

/** Seats to filter and sort by: the real capacity, or the largest class a room is known to have held. */
export function roomSize (room: Room): number | null {
  return room.capacity ?? room.largestClass ?? null
}

export interface ClassroomData {
  source: string
  fetched: string
  rooms: Room[]
}

export interface BuildingPart {
  poly: Point[]
  holes?: Point[][]
}

export interface Building {
  id: string
  name: string
  /** Storeys above ground. */
  levels: number
  /** Whether a lower level holds classrooms. */
  lower: boolean
  /** Height in metres. */
  h: number
  /** Centre in local metres: x east, y north. */
  c: Point
  /** Latitude and longitude, for directions links. */
  ll: Point
  rooms: number
  seats: number
  /** The school that schedules this building's classrooms itself. */
  managedBy?: string
  /** Housing, garages and outbuildings: drawn but not labelled or selectable. */
  minor?: boolean
  /** Footprint in square metres. */
  area: number
  /** A freely licensed exterior photo from Wikimedia Commons, with its credit. */
  photo?: { src: string; page: string; by: string; license: string }
  /** Roof form, for drawing. */
  roof?: 'flat' | 'pitched'
  parts: BuildingPart[]
}

export interface Campus {
  origin: Point
  attribution: string
  buildings: Building[]
  context: { poly: Point[]; h: number }[]
  paths: { k: 'path' | 'steps' | 'service' | 'road' | 'major' | 'rail'; p: Point[] }[]
  areas: { k: string; s?: string; p: Point[] }[]
  /** Tree positions as a flat x, y list. */
  trees: number[]
  /** Street names: text, road kind, position and angle (radians, counter-clockwise from east). */
  roadLabels: { t: string; k: 'road' | 'major'; x: number; y: number; a: number }[]
}

export interface Section {
  n: string
  term: string
  inst: string
  mode: string
  /** Day letters: M T W R F S U. */
  days: string
  /** Minutes after midnight, Central Time. */
  start: number | null
  end: number | null
  taken: number | null
  cap: number | null
}

export interface Course {
  code: string
  title: string
  units: number
  dept: string
  school: string
  level: string
  sections: Section[]
}

export interface CourseData {
  term: string
  source: string
  fetched: string
  note: string
  courses: Course[]
}

export interface Filters {
  minCapacity: number
  style: string
  accessible: boolean
  tour: boolean
  /** Equipment names that must all be present. */
  equipment: string[]
}

export const NO_FILTERS: Filters = { minCapacity: 0, style: '', accessible: false, tour: false, equipment: [] }

export function filtersActive (filters: Filters): boolean {
  return filters.minCapacity > 0 || filters.style !== '' || filters.accessible || filters.tour || filters.equipment.length > 0
}

export function matchesFilters (room: Room, filters: Filters): boolean {
  if ((roomSize(room) ?? 0) < filters.minCapacity) return false
  if (filters.style && room.style !== filters.style) return false
  if (filters.accessible && !room.accessible) return false
  if (filters.tour && !room.tour) return false
  return filters.equipment.every(item => room.equipment.includes(item))
}

export function floorLabel (floor: number): string {
  return floor === 0 ? 'LL' : `${floor}F`
}
