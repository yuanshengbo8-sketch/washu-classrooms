import { useEffect, useMemo, useRef, useState } from 'react'
import type { Building, Course, Room } from '../lib/types'
import type { Lang, StringKey } from '../lib/i18n'
import { term } from '../lib/i18n'
import { searchBuildings, searchCourses, searchRooms } from '../lib/search'
import { CAMPUS } from '../campus'
import { Icon } from './Icon'

interface TopBarProps {
  lang: Lang
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  buildings: Building[]
  rooms: Room[]
  /** Null until the course list has loaded. */
  courses: Course[] | null
  finderOpen: boolean
  studyOpen: boolean
  /** Bookable study rooms free right now; 0 hides the badge. */
  studyFree: number
  filterCount: number
  favoriteCount: number
  onNeedCourses: () => void
  onBuilding: (id: string) => void
  onRoom: (room: Room) => void
  onCourse: (course: Course) => void
  onFinder: () => void
  onStudy: () => void
  onFavorites: () => void
  onLang: () => void
  onAbout: () => void
}

export function TopBar (props: TopBarProps) {
  const { lang, t, buildings, rooms, courses } = props
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const text = query.trim()
    if (!text) return null
    return {
      buildings: searchBuildings(buildings, text),
      rooms: searchRooms(rooms, text),
      courses: courses ? searchCourses(courses, text) : null
    }
  }, [query, buildings, rooms, courses])

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const pick = (action: () => void) => {
    action()
    setOpen(false)
    input.current?.blur()
  }
  const empty = results && results.buildings.length === 0 && results.rooms.length === 0 && results.courses !== null && results.courses.length === 0

  return (
    <div className='topbar'>
      <div className='search' ref={box}>
        <div className='search__field'>
          <span className='search__brand' aria-hidden='true'>{CAMPUS.brand}</span>
          <input
            ref={input}
            className='search__input'
            type='search'
            value={query}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            onChange={event => { setQuery(event.target.value); setOpen(true) }}
            onFocus={() => { setOpen(true); props.onNeedCourses() }}
            onKeyDown={event => {
              if (event.key === 'Escape') { setOpen(false); input.current?.blur() }
              if (event.key === 'Enter' && results) {
                const first = results.rooms[0]
                if (first) pick(() => props.onRoom(first))
                else if (results.buildings[0]) pick(() => props.onBuilding(results.buildings[0].id))
                else if (results.courses?.[0]) pick(() => props.onCourse((results.courses as Course[])[0]))
              }
            }}
          />
          {query ? (
            <button type='button' className='icon-button icon-button--small' onClick={() => { setQuery(''); input.current?.focus() }} aria-label={t('close')}>
              <Icon name='close' size={16} />
            </button>
          ) : (
            <span className='search__icon'><Icon name='search' /></span>
          )}
        </div>
        {open && results ? (
          <div className='search__results'>
            {results.buildings.length > 0 ? (
              <div className='search__group'>
                <div className='search__group-title'>{t('buildings')}</div>
                {results.buildings.map(building => (
                  <button key={building.id} type='button' className='search__item' onClick={() => pick(() => props.onBuilding(building.id))}>
                    <span className='search__item-icon'><Icon name='building' size={16} /></span>
                    <span className='search__item-main'>{building.name}</span>
                    <span className='search__item-side'>{building.rooms > 0 ? `${building.rooms} ${building.rooms === 1 ? t('room') : t('rooms')}` : building.managedBy ?? ''}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {results.rooms.length > 0 ? (
              <div className='search__group'>
                <div className='search__group-title'>{t('classrooms')}</div>
                {results.rooms.map(room => (
                  <button key={room.id} type='button' className='search__item' onClick={() => pick(() => props.onRoom(room))}>
                    <span className='search__item-icon'><Icon name='seat' size={16} /></span>
                    <span className='search__item-main'>{room.buildingName} {room.room}</span>
                    <span className='search__item-side'>{[room.capacity !== null ? `${room.capacity} ${t('seats')}` : room.largestClass ? `${room.largestClass}+ ${t('seats')}` : '', term(lang, room.style) || (room.source === 'listings' ? t('listedRoom') : '')].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className='search__group'>
              {results.courses === null ? (
                <div className='search__note'>{t('loadingCourses')}</div>
              ) : results.courses.length > 0 ? (
                <>
                  <div className='search__group-title'>{t('courses')}</div>
                  {results.courses.map(course => (
                    <button key={`${course.code}|${course.title}`} type='button' className='search__item' onClick={() => pick(() => props.onCourse(course))}>
                      <span className='search__item-icon'><Icon name='book' size={16} /></span>
                      <span className='search__item-main'><b>{course.code}</b> {course.title}</span>
                      <span className='search__item-side'>{[...new Set(course.sections.map(section => section.inst).filter(Boolean))].slice(0, 2).join(' · ')}</span>
                    </button>
                  ))}
                </>
              ) : null}
            </div>
            {empty ? <div className='search__note'>{t('noResults')}</div> : null}
          </div>
        ) : null}
      </div>
      <div className='toolbar'>
        <button type='button' className={props.finderOpen ? 'pill pill--on' : 'pill'} onClick={props.onFinder}>
          <Icon name='filter' size={16} />
          <span>{t('findRoom')}</span>
          {props.filterCount > 0 ? <span className='pill__badge'>{props.filterCount}</span> : null}
        </button>
        <button type='button' className={props.studyOpen ? 'pill pill--on pill--study' : 'pill pill--study'} onClick={props.onStudy}>
          <Icon name='desk' size={16} />
          <span>{t('studyRooms')}</span>
          {props.studyFree > 0 ? <span className='pill__badge pill__badge--green'>{props.studyFree}</span> : null}
        </button>
        <button type='button' className='pill' onClick={props.onFavorites}>
          <Icon name='star' size={16} />
          <span>{t('favorites')}</span>
          {props.favoriteCount > 0 ? <span className='pill__badge'>{props.favoriteCount}</span> : null}
        </button>
        <button type='button' className='pill pill--icon' onClick={props.onLang} aria-label='Language' title='中文 / English'>
          <Icon name='globe' size={16} />
          <span>{lang === 'zh' ? 'EN' : '中文'}</span>
        </button>
        <button type='button' className='pill pill--icon' onClick={props.onAbout} aria-label={t('about')} title={t('about')}>
          <Icon name='info' size={16} />
        </button>
      </div>
    </div>
  )
}
