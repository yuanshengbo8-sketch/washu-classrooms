import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { Campus, ClassroomData, Course, CourseData, Filters, Room } from './lib/types'
import { NO_FILTERS, filtersActive, matchesFilters } from './lib/types'
import type { Lang, StringKey } from './lib/i18n'
import { initialLang, safeSet, translate } from './lib/i18n'
import { loadFavorites, readUrl, saveFavorites, writeUrl } from './lib/store'
import type { Availability, StudyData } from './lib/study'
import { isFresh, loadAvailability, statusOf } from './lib/study'
import { TopBar } from './components/TopBar'
import { BuildingPanel, FinderPanel, RoomDetail } from './components/Panels'
import { AboutModal, CourseModal } from './components/Modals'
import { StudyPanel } from './components/StudyPanel'
import { CAMPUS } from './campus'
import { LEGEND_TITLE, SCHOOLS, SCHOOL_ORDER } from './lib/schools'

const CampusMap = lazy(() => import('./components/CampusMap'))
const SeatView = lazy(() => import('./components/SeatView'))

/** Course terms; a campus without course data has none and gets no course search. */
const TERMS = CAMPUS.terms

const dataUrl = (name: string) => `${import.meta.env.BASE_URL}data/${name}`

async function loadJson<T> (name: string): Promise<T> {
  const response = await fetch(dataUrl(name))
  if (!response.ok) throw new Error(`${response.status} ${name}`)
  return response.json() as Promise<T>
}

export function App () {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])

  const [campus, setCampus] = useState<Campus | null>(null)
  const [data, setData] = useState<ClassroomData | null>(null)
  const [error, setError] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)

  const [buildingId, setBuildingId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomOrigin, setRoomOrigin] = useState<'finder' | 'building'>('building')
  const [floor, setFloor] = useState<number | null>(null)
  const [hoverFloor, setHoverFloor] = useState<number | null>(null)
  const [finderOpen, setFinderOpen] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites)

  const [studyOpen, setStudyOpen] = useState(false)
  const [study, setStudy] = useState<StudyData | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [, setTick] = useState(0)

  // The colour key starts open where there is room for it.
  const [legendOpen, setLegendOpen] = useState(() => window.innerWidth > 780)
  const [seatRoom, setSeatRoom] = useState<Room | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [termId, setTermId] = useState(TERMS[0]?.id ?? '')
  const [courseData, setCourseData] = useState<Record<string, Course[]>>({})
  const [courseCode, setCourseCode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadJson<Campus>('campus.json'), loadJson<ClassroomData>('classrooms.json')])
      .then(([loadedCampus, loadedData]) => {
        if (cancelled) return
        setCampus(loadedCampus)
        setData(loadedData)
        const url = readUrl()
        const room = url.room ? loadedData.rooms.find(item => item.id === url.room) : undefined
        if (room) {
          setBuildingId(room.building)
          setRoomId(room.id)
        } else if (url.building && loadedCampus.buildings.some(item => item.id === url.building && !item.minor)) {
          setBuildingId(url.building)
        }
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  // Study rooms and their bookings load on their own, so a slow library
  // feed never holds up the map.
  useEffect(() => {
    let cancelled = false
    loadJson<StudyData>('study-rooms.json').then(loaded => { if (!cancelled) setStudy(loaded) }).catch(() => {})
    const refresh = () => loadAvailability(dataUrl('study-availability.json')).then(loaded => { if (!cancelled && loaded) setAvailability(loaded) })
    refresh()
    const reload = window.setInterval(refresh, 5 * 60 * 1000)
    // Re-evaluate "free until" as the clock moves.
    const tick = window.setInterval(() => setTick(value => value + 1), 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(reload)
      window.clearInterval(tick)
    }
  }, [])

  const studyRooms = useMemo(() => study?.rooms ?? [], [study])
  const studyCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of studyRooms) counts.set(item.building, (counts.get(item.building) ?? 0) + 1)
    return counts
  }, [studyRooms])
  const buildingStudyRooms = useMemo(() => studyRooms.filter(item => item.building === buildingId), [studyRooms, buildingId])
  const studyFree = isFresh(availability) ? studyRooms.filter(item => statusOf(item, availability).kind === 'free').length : 0

  const rooms = useMemo(() => data?.rooms ?? [], [data])
  const buildings = useMemo(() => campus?.buildings ?? [], [campus])
  const building = buildings.find(item => item.id === buildingId)
  const room = rooms.find(item => item.id === roomId)
  const buildingRooms = useMemo(() => rooms.filter(item => item.building === buildingId), [rooms, buildingId])

  const roomsByFloor = useMemo(() => {
    const counts = new Map<number, number>()
    for (const item of buildingRooms) counts.set(item.floor, (counts.get(item.floor) ?? 0) + 1)
    return counts
  }, [buildingRooms])

  const matches = useMemo(() => {
    if (!filtersActive(filters)) return null
    const counts = new Map<string, number>()
    for (const item of rooms) {
      if (matchesFilters(item, filters)) counts.set(item.building, (counts.get(item.building) ?? 0) + 1)
    }
    return counts
  }, [rooms, filters])

  useEffect(() => {
    if (data) writeUrl({ building: buildingId, room: roomId })
  }, [data, buildingId, roomId])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    const place = room ? `${room.buildingName} ${room.room}` : building?.name
    document.title = place ? `${place} · ${translate(lang, 'appName')}` : translate(lang, 'appName')
  }, [lang, room, building])

  const loadTerm = useCallback((id: string) => {
    setCourseData(current => {
      if (current[id]) return current
      loadJson<CourseData>(`courses-${id}.json`)
        .then(loaded => setCourseData(latest => ({ ...latest, [id]: loaded.courses })))
        .catch(() => setCourseData(latest => ({ ...latest, [id]: [] })))
      return current
    })
  }, [])

  const openBuilding = useCallback((id: string) => {
    setBuildingId(id)
    setRoomId(null)
    setFloor(null)
    setHoverFloor(null)
  }, [])

  const openRoom = useCallback((target: Room, origin: 'finder' | 'building') => {
    setBuildingId(target.building)
    setRoomId(target.id)
    setRoomOrigin(origin)
    setHoverFloor(null)
  }, [])

  const closePanel = useCallback(() => {
    setBuildingId(null)
    setRoomId(null)
    setFloor(null)
    setHoverFloor(null)
    setFinderOpen(false)
    setStudyOpen(false)
  }, [])

  const toggleFavorite = useCallback((target: Room) => {
    setFavorites(current => {
      const next = new Set(current)
      if (next.has(target.id)) next.delete(target.id)
      else next.add(target.id)
      saveFavorites(next)
      return next
    })
  }, [])

  const openFinder = (onlyFavorites: boolean) => {
    const same = finderOpen && !buildingId && favoritesOnly === onlyFavorites
    setBuildingId(null)
    setRoomId(null)
    setFloor(null)
    setFavoritesOnly(onlyFavorites)
    setFinderOpen(!same)
    setStudyOpen(false)
  }

  const openStudy = () => {
    const same = studyOpen && !buildingId
    setBuildingId(null)
    setRoomId(null)
    setFloor(null)
    setFinderOpen(false)
    setStudyOpen(!same)
  }

  const filterCount =
    (filters.minCapacity > 0 ? 1 : 0) + (filters.style ? 1 : 0) + (filters.accessible ? 1 : 0) + (filters.tour ? 1 : 0) + filters.equipment.length
  const courses = courseData[termId] ?? null
  const course = courseCode ? courses?.find(item => item.code === courseCode) ?? null : null

  let panel = null
  if (room) {
    panel = (
      <RoomDetail
        room={room}
        building={building}
        lang={lang}
        t={t}
        favorite={favorites.has(room.id)}
        onFavorite={toggleFavorite}
        onSeatView={setSeatRoom}
        onBack={() => {
          setRoomId(null)
          if (roomOrigin === 'finder') {
            setBuildingId(null)
            setFinderOpen(true)
          }
        }}
        onClose={closePanel}
      />
    )
  } else if (building) {
    panel = (
      <BuildingPanel
        building={building}
        rooms={buildingRooms}
        studyRooms={buildingStudyRooms}
        availability={availability}
        plans={study?.plans ?? {}}
        lang={lang}
        t={t}
        filters={filters}
        floor={floor}
        favorites={favorites}
        onFloor={setFloor}
        onHoverFloor={setHoverFloor}
        onOpen={target => openRoom(target, 'building')}
        // Opened from the study list: closing goes back to it.
        onClose={studyOpen ? () => { setBuildingId(null); setFloor(null) } : closePanel}
      />
    )
  } else if (studyOpen) {
    panel = (
      <StudyPanel
        rooms={studyRooms}
        availability={availability}
        plans={study?.plans ?? {}}
        lang={lang}
        t={t}
        onLocate={target => setBuildingId(target.building)}
        onClose={closePanel}
      />
    )
  } else if (finderOpen) {
    panel = (
      <FinderPanel
        rooms={rooms}
        lang={lang}
        t={t}
        filters={filters}
        favorites={favorites}
        favoritesOnly={favoritesOnly}
        onFilters={setFilters}
        onFavoritesOnly={setFavoritesOnly}
        onOpen={target => openRoom(target, 'finder')}
        onClose={closePanel}
      />
    )
  }

  if (error) return <div className='splash'><p>{t('loadError')}</p></div>
  if (!campus || !data) {
    return (
      <div className='splash'>
        <div className='splash__mark'>{CAMPUS.brand}</div>
        <p>{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className={panel ? 'app app--panel' : 'app'}>
      <main className='stage'>
        {mapFailed ? (
          <div className='splash splash--inline'><p>{t('noWebgl')}</p></div>
        ) : (
          <Suspense fallback={<div className='splash splash--inline'><div className='splash__mark'>{CAMPUS.brand}</div><p>{t('loading')}</p></div>}>
            <CampusMap
              campus={campus}
              t={t}
              selectedId={buildingId}
              roomsByFloor={roomsByFloor}
              highlightedFloor={hoverFloor ?? (room ? room.floor : floor)}
              matches={studyOpen ? studyCounts : matches}
              matchMode={studyOpen ? 'study' : 'rooms'}
              studyCounts={studyCounts}
              onSelect={openBuilding}
              onFloor={value => {
                setRoomId(null)
                setFloor(current => (current === value ? null : value))
              }}
              onUnavailable={() => { setMapFailed(true); setFinderOpen(true) }}
            />
          </Suspense>
        )}
        <TopBar
          lang={lang}
          t={t}
          buildings={buildings}
          rooms={rooms}
          courses={TERMS.length > 0 ? courses : []}
          finderOpen={finderOpen && !buildingId && !favoritesOnly}
          studyOpen={studyOpen && !buildingId}
          studyFree={studyFree}
          onStudy={openStudy}
          filterCount={filterCount}
          favoriteCount={favorites.size}
          onNeedCourses={() => { if (TERMS.length > 0) loadTerm(termId) }}
          onBuilding={openBuilding}
          onRoom={target => openRoom(target, 'building')}
          onCourse={target => setCourseCode(target.code)}
          onFinder={() => openFinder(false)}
          onFavorites={() => openFinder(true)}
          onLang={() => {
            const next: Lang = lang === 'zh' ? 'en' : 'zh'
            safeSet(`${CAMPUS.id}.lang`, next)
            setLang(next)
          }}
          onAbout={() => setAboutOpen(true)}
        />
        {mapFailed ? null : (
          <div className='legend'>
            <button type='button' className='legend__toggle' onClick={() => setLegendOpen(!legendOpen)} aria-expanded={legendOpen}>
              {LEGEND_TITLE[lang]} {legendOpen ? '−' : '+'}
            </button>
            {legendOpen ? SCHOOL_ORDER.map(id => (
              <span key={id} className='legend__item'>
                <span className='legend__swatch' style={{ background: SCHOOLS[id].color }} />{SCHOOLS[id][lang]}
              </span>
            )) : null}
          </div>
        )}
        <div className='map-footer'>
          <span className='map-footer__hint'>{t(matchMedia('(pointer: coarse)').matches ? 'hintMapTouch' : 'hintMap')}</span>
          <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noreferrer'>© OpenStreetMap</a>
        </div>
      </main>
      {panel ? <aside className='side'>{panel}</aside> : null}

      {courseCode ? (
        <CourseModal
          course={course ?? { code: courseCode, title: '', units: 0, dept: '', school: '', level: '', sections: [] }}
          loading={courses === null}
          t={t}
          terms={TERMS}
          termId={termId}
          onTerm={id => { setTermId(id); loadTerm(id) }}
          onClose={() => setCourseCode(null)}
        />
      ) : null}
      {aboutOpen ? <AboutModal t={t} fetched={data.fetched} onClose={() => setAboutOpen(false)} /> : null}
      {seatRoom ? (
        <Suspense fallback={null}>
          <SeatView room={seatRoom} lang={lang} t={t} onClose={() => setSeatRoom(null)} />
        </Suspense>
      ) : null}
    </div>
  )
}
