import type { CSSProperties } from 'react'
import type { Lang } from './i18n'

/**
 * Which school a building belongs to, for colouring its map label.
 *
 * Sources: each school's own list of its buildings where it publishes one
 * (McKelvey's facilities page), otherwise the school that taught most of the
 * sections listed in the building in WashU's archived course listings, and
 * for buildings with no listed classes what the building houses. Shared
 * buildings get the school that uses most of them: Seigle is Arts & Sciences
 * here although Law teaches there too. Corrections are welcome.
 */
export type SchoolId = 'artsci' | 'olin' | 'mckelvey' | 'samfox' | 'law' | 'brown' | 'library' | 'campus'

export interface School {
  en: string
  zh: string
  /** Label gradient, light to dark. */
  color: string
  dark: string
}

export const SCHOOLS: Record<SchoolId, School> = {
  artsci: { en: 'Arts & Sciences', zh: '文理学院', color: '#b8232f', dark: '#8a1420' },
  olin: { en: 'Olin Business', zh: 'Olin 商学院', color: '#2a6bbd', dark: '#1a4683' },
  mckelvey: { en: 'McKelvey Engineering', zh: 'McKelvey 工学院', color: '#0e8f94', dark: '#0a6569' },
  samfox: { en: 'Sam Fox Design & Art', zh: 'Sam Fox 设计与艺术', color: '#8145ad', dark: '#582b7c' },
  law: { en: 'Law', zh: '法学院', color: '#8a5d38', dark: '#5c3b1e' },
  brown: { en: 'Brown School', zh: 'Brown 社工与公卫', color: '#d67d14', dark: '#a85c06' },
  library: { en: 'Libraries', zh: '图书馆', color: '#2f7a43', dark: '#1f4f2c' },
  campus: { en: 'Campus life & admin', zh: '校园生活与行政', color: '#75807a', dark: '#525c56' }
}

export const SCHOOL_ORDER: SchoolId[] = ['artsci', 'mckelvey', 'olin', 'samfox', 'brown', 'law', 'library', 'campus']

const BY_SCHOOL: Record<SchoolId, string[]> = {
  artsci: [
    'bayer-laboratory', 'blewett-hall', 'bryan-hall', 'busch-hall', 'busch-laboratory', 'compton-laboratory', 'crow-hall',
    'cupples-i-hall', 'cupples-ii-hall', 'duncker-hall', 'eads-hall', 'january-hall', 'life-sciences-building', 'louderman-hall',
    'mcdonnell-hall', 'mcmillan-hall', 'mcmillen-laboratory', 'music-classroom-building', 'radiochemistry-building',
    'rebstock-hall', 'ridgley-hall', 'scott-rudolph-hall', 'seigle-hall', 'sever-hall', 'somers-family-hall', 'tietjens-hall',
    'umrath-hall', 'wilson-hall', 'wrighton-hall'
  ],
  olin: ['simon-hall', 'bauer-hall', 'knight-hall', 'charles-f-knight-center'],
  mckelvey: ['brauer-hall', 'green-hall', 'jubel-hall', 'lopata-hall', 'mckelvey-hall', 'urbauer-hall', 'whitaker-hall', 'jolley-hall'],
  samfox: ['givens-hall', 'bixby-hall', 'earl-e-and-myrtle-e-walker-hall', 'steinberg-hall', 'weil-hall', 'mildred-lane-kemper-art-museum'],
  law: ['anheuser-busch-hall'],
  brown: ['brown-hall', 'goldfarb-hall', 'hillman-hall'],
  library: ['olin-library', 'gaylord-music-library'],
  campus: [
    'academy-building', 'ann-w-olin-women-s-building', 'brookings-hall', 'danforth-university-center', 'graham-chapel',
    'holmes-lounge', 'lucy-and-stanley-lopata-house', 'mallinckrodt-student-center', 'risa-commons', 'schnuck-pavilion',
    'sumers-recreation-center', 'sumers-welcome-center', 'village-house'
  ]
}

const SCHOOL_OF = new Map<string, SchoolId>()
for (const id of SCHOOL_ORDER) for (const building of BY_SCHOOL[id]) SCHOOL_OF.set(building, id)

/** A building we have not assigned falls under campus life and administration. */
export function schoolOf (buildingId: string): SchoolId {
  return SCHOOL_OF.get(buildingId) ?? 'campus'
}

/** The school's colours as CSS variables, for a label or panel header. */
export function schoolStyle (buildingId: string): CSSProperties {
  const school = SCHOOLS[schoolOf(buildingId)]
  return { '--school': school.color, '--school-dark': school.dark } as CSSProperties
}

export function schoolName (id: SchoolId, lang: Lang): string {
  return SCHOOLS[id][lang]
}

export const LEGEND_TITLE: Record<Lang, string> = { en: 'Label colour = school', zh: '标签颜色 = 所属学院' }
