import { useEffect, useMemo, useRef, useState } from 'react'
import type { Building, Filters, Room } from '../lib/types'
import { NO_FILTERS, filtersActive, floorLabel, matchesFilters, roomSize } from '../lib/types'
import type { Lang, StringKey } from '../lib/i18n'
import { term } from '../lib/i18n'
import { directionsUrl, shareUrl, streetViewUrl } from '../lib/store'
import { CAMPUS } from '../campus'
import { Icon } from './Icon'
import { schoolName, schoolOf, schoolStyle } from '../lib/schools'
import type { Availability, FloorPlans, StudyRoom } from '../lib/study'
import { LibraryPlans, StudyCard } from './StudyPanel'
import { REPO_URL } from './Modals'

type T = (key: StringKey, vars?: Record<string, string | number>) => string

const CAPACITY_STEPS = [0, 20, 40, 80, 150]
/** Equipment worth filtering on; the rest is near-universal or rare. */

function compareRooms (a: Room, b: Room): number {
  return a.buildingName.localeCompare(b.buildingName) || a.floor - b.floor || a.room.localeCompare(b.room, 'en', { numeric: true })
}

// ---- room card -------------------------------------------------------------

interface RoomCardProps {
  room: Room
  lang: Lang
  t: T
  showBuilding: boolean
  favorite: boolean
  onOpen: (room: Room) => void
  onHover?: (room: Room | null) => void
}

export function RoomCard ({ room, lang, t, showBuilding, favorite, onOpen, onHover }: RoomCardProps) {
  return (
    <button
      type='button'
      className='room-card'
      onClick={() => onOpen(room)}
      onPointerEnter={() => onHover?.(room)}
      onPointerLeave={() => onHover?.(null)}
    >
      <span className='room-card__thumb'>
        {room.thumb ? (
          <img src={room.thumb} alt='' loading='lazy' referrerPolicy='no-referrer' />
        ) : (
          <span className='room-card__placeholder'><Icon name='seat' size={22} /></span>
        )}
      </span>
      <span className='room-card__body'>
        <span className='room-card__title'>
          {showBuilding ? <span className='room-card__building'>{room.buildingName.replace(/ Hall$/, '')}</span> : null}
          <span className='room-card__number'>{room.room}</span>
          {favorite ? <span className='room-card__star'><Icon name='starFilled' size={14} /></span> : null}
        </span>
        <span className='room-card__meta'>
          {[room.note, term(lang, room.style)].filter(Boolean).join(' · ') || (room.source === 'listings' ? t('listedRoom') : room.managedBy) || '—'}
        </span>
        <span className='room-card__tags'>
          {room.capacity !== null ? (
            <span className='tag tag--strong'><Icon name='people' size={13} />{room.capacity}</span>
          ) : room.largestClass ? (
            <span className='tag' title={t('atLeastSeats', { n: room.largestClass })}><Icon name='people' size={13} />{room.largestClass}+</span>
          ) : null}
          {room.accessible ? <span className='tag' title={t('accessible')}><Icon name='wheelchair' size={13} /></span> : null}
          {room.tour ? <span className='tag' title={t('hasTour')}>360°</span> : null}
          {!room.thumb && room.photos.length > 0 ? <span className='tag'>{t('photoCount', { n: room.photos.length })}</span> : null}
        </span>
      </span>
    </button>
  )
}

// ---- finder ----------------------------------------------------------------

interface FinderProps {
  rooms: Room[]
  lang: Lang
  t: T
  filters: Filters
  favorites: Set<string>
  favoritesOnly: boolean
  onFilters: (filters: Filters) => void
  onFavoritesOnly: (value: boolean) => void
  onOpen: (room: Room) => void
  onClose: () => void
}

type Sort = 'small' | 'large' | 'building'

export function FinderPanel ({ rooms, lang, t, filters, favorites, favoritesOnly, onFilters, onFavoritesOnly, onOpen, onClose }: FinderProps) {
  const [sort, setSort] = useState<Sort>('small')
  const styles = useMemo(() => {
    const counts = new Map<string, number>()
    for (const room of rooms) if (room.style) counts.set(room.style, (counts.get(room.style) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])
  }, [rooms])
  const equipment = useMemo(
    () => CAMPUS.finderEquipment.filter(item => rooms.some(room => room.equipment.includes(item))),
    [rooms]
  )
  const results = useMemo(() => {
    const list = rooms.filter(room => matchesFilters(room, filters) && (!favoritesOnly || favorites.has(room.id)))
    if (sort === 'building') return list.sort(compareRooms)
    const direction = sort === 'small' ? 1 : -1
    // Rooms with no published seat count go last either way.
    const size = (room: Room) => roomSize(room) ?? (sort === 'small' ? Infinity : -1)
    return list.sort((a, b) => (size(a) === size(b) ? 0 : direction * (size(a) - size(b))) || compareRooms(a, b))
  }, [rooms, filters, favoritesOnly, favorites, sort])
  const active = filtersActive(filters) || favoritesOnly

  const toggleEquipment = (item: string) =>
    onFilters({
      ...filters,
      equipment: filters.equipment.includes(item) ? filters.equipment.filter(other => other !== item) : [...filters.equipment, item]
    })

  return (
    <section className='panel' aria-label={t('findRoom')}>
      <header className='panel__header'>
        <h2 className='panel__title panel__title--grow'>{favoritesOnly ? t('favorites') : t('findRoom')}</h2>
        <button type='button' className='icon-button' onClick={onClose} aria-label={t('close')}><Icon name='close' /></button>
      </header>
      <div className='panel__scroll'>
        <div className='filters'>
          <div className='filters__group'>
            <span className='filters__label'>{t('capacity')}</span>
            <div className='segmented'>
              {CAPACITY_STEPS.map(step => (
                <button
                  key={step}
                  type='button'
                  className={step === filters.minCapacity ? 'segmented__item segmented__item--on' : 'segmented__item'}
                  onClick={() => onFilters({ ...filters, minCapacity: step })}
                >
                  {step === 0 ? t('anyCapacity') : `${step}+`}
                </button>
              ))}
            </div>
          </div>
          <div className='filters__group'>
            <label className='filters__label' htmlFor='filter-style'>{t('seatingStyle')}</label>
            <select id='filter-style' className='select' value={filters.style} onChange={event => onFilters({ ...filters, style: event.target.value })}>
              <option value=''>{t('anyStyle')}</option>
              {styles.map(([style, count]) => (
                <option key={style} value={style}>{term(lang, style)} ({count})</option>
              ))}
            </select>
          </div>
          <div className='filters__group'>
            <span className='filters__label'>{t('features')}</span>
            <div className='chips'>
              {/* A chip only makes sense when the directory records the feature at all. */}
              {rooms.some(room => room.accessible) ? (
                <button type='button' className={filters.accessible ? 'chip chip--on' : 'chip'} onClick={() => onFilters({ ...filters, accessible: !filters.accessible })}>
                  <Icon name='wheelchair' size={14} />{t('accessible')}
                </button>
              ) : null}
              {rooms.some(room => room.tour) ? (
                <button type='button' className={filters.tour ? 'chip chip--on' : 'chip'} onClick={() => onFilters({ ...filters, tour: !filters.tour })}>
                  {t('hasTour')}
                </button>
              ) : null}
              {equipment.map(item => (
                <button key={item} type='button' className={filters.equipment.includes(item) ? 'chip chip--on' : 'chip'} onClick={() => toggleEquipment(item)}>
                  {term(lang, item)}
                </button>
              ))}
              <button type='button' className={favoritesOnly ? 'chip chip--on' : 'chip'} onClick={() => onFavoritesOnly(!favoritesOnly)}>
                <Icon name={favoritesOnly ? 'starFilled' : 'star'} size={14} />{t('favorites')}
              </button>
            </div>
          </div>
        </div>
        <div className='list-head'>
          <span>{active ? t('matching', { n: results.length }) : t('allClassrooms', { n: results.length })}</span>
          <span className='list-head__actions'>
            {active ? (
              <button type='button' className='text-button' onClick={() => { onFilters(NO_FILTERS); onFavoritesOnly(false) }}>{t('clearFilters')}</button>
            ) : null}
            <select className='select select--small' aria-label={t('sortBy')} value={sort} onChange={event => setSort(event.target.value as Sort)}>
              <option value='small'>{t('sortSmall')}</option>
              <option value='large'>{t('sortLarge')}</option>
              <option value='building'>{t('sortBuilding')}</option>
            </select>
          </span>
        </div>
        {results.length === 0 ? (
          <p className='empty'>{favoritesOnly && favorites.size === 0 ? t('noSaved') : t('noMatches')}</p>
        ) : (
          <div className='room-list'>
            {results.map(room => (
              <RoomCard key={room.id} room={room} lang={lang} t={t} showBuilding favorite={favorites.has(room.id)} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ---- building --------------------------------------------------------------

interface BuildingPanelProps {
  building: Building
  rooms: Room[]
  studyRooms: StudyRoom[]
  availability: Availability | null
  plans: Record<string, FloorPlans>
  lang: Lang
  t: T
  filters: Filters
  floor: number | null
  favorites: Set<string>
  onFloor: (floor: number | null) => void
  onHoverFloor: (floor: number | null) => void
  onOpen: (room: Room) => void
  onClose: () => void
}

export function BuildingPanel ({ building, rooms, studyRooms, availability, plans, lang, t, filters, floor, favorites, onFloor, onHoverFloor, onOpen, onClose }: BuildingPanelProps) {
  const [openStudy, setOpenStudy] = useState<string | null>(null)
  const floors = useMemo(() => [...new Set(rooms.map(room => room.floor))].sort((a, b) => a - b), [rooms])
  const shown = rooms.filter(room => floor === null || room.floor === floor).sort(compareRooms)
  const filtering = filtersActive(filters)
  const floorName = (value: number) => (value === 0 ? t('lowerLevel') : t('floorN', { n: value }))

  return (
    <section className='panel' aria-label={building.name}>
      <header
        className='panel__header panel__header--building'
        style={schoolStyle(building.id)}
      >
        <div>
          <p className='panel__school'>{schoolName(schoolOf(building.id), lang)}</p>
          <h2 className='panel__title panel__title--serif'>{building.name}</h2>
          <p className='panel__subtitle'>
            {building.rooms === 0
              ? studyRooms.length > 0 ? t('studyRoomsCount', { n: studyRooms.length }) : building.managedBy ?? t('noRoomsListed')
              : [
                  `${building.rooms} ${building.rooms === 1 ? t('room') : t('rooms')}`,
                  building.seats > 0 ? `${building.seats} ${t('seatsTotal')}` : '',
                  building.managedBy ?? ''
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type='button' className='icon-button icon-button--light' onClick={onClose} aria-label={t('close')}><Icon name='close' /></button>
      </header>
      <div className='panel__scroll'>
        {building.photo ? (
          <figure className='building-photo'>
            <img src={building.photo.src} alt={building.name} loading='lazy' />
            <figcaption>
              <a href={building.photo.page} target='_blank' rel='noreferrer'>{t('photoCredit', { by: building.photo.by, license: building.photo.license })}</a>
            </figcaption>
          </figure>
        ) : null}
        <div className='panel__actions'>
          <a className='button button--ghost' href={directionsUrl(building.ll[0], building.ll[1])} target='_blank' rel='noreferrer'>
            <Icon name='walk' size={16} />{t('directions')}
          </a>
          <a className='button button--ghost' href={streetViewUrl(building.ll[0], building.ll[1])} target='_blank' rel='noreferrer'>
            <Icon name='pano' size={16} />{t('streetView')}
          </a>
        </div>
        {building.managedBy || (building.rooms === 0 && studyRooms.length === 0) || rooms.some(room => room.source === 'listings') ? (
          <div className='notice notice--plain'>
            {building.managedBy ? <p>{t('schoolManaged', { school: building.managedBy })}</p> : building.rooms === 0 && studyRooms.length === 0 ? <p>{t('notPooled')}</p> : null}
            {rooms.some(room => room.source === 'listings') ? <p>{t('partialList')}</p> : null}
            {building.managedBy ? (
              <p><a href={`${REPO_URL}/blob/main/data/extra-rooms.json`} target='_blank' rel='noreferrer'>{t('knowRoom')}</a></p>
            ) : null}
          </div>
        ) : null}
        {studyRooms.length > 0 ? (
          <div className='floor-group'>
            {(() => {
              // Floor plans, for the library in this building that publishes them.
              const library = studyRooms.find(item => plans[item.library] && item.spot)?.library
              if (!library) return null
              return (
                <>
                  <h3 className='floor-group__title'>{t('floorPlan')}</h3>
                  <LibraryPlans
                    plans={plans[library]}
                    rooms={studyRooms.filter(item => item.library === library)}
                    availability={availability}
                    t={t}
                    activeId={openStudy}
                    onPick={id => {
                      setOpenStudy(id)
                      window.setTimeout(() => document.getElementById(`study-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
                    }}
                  />
                </>
              )
            })()}
            <h3 className='floor-group__title'>{t('studyHere')}</h3>
            <div className='study-list'>
              {studyRooms.map(item => (
                <StudyCard
                  key={item.id}
                  room={item}
                  availability={availability}
                  t={t}
                  open={openStudy === item.id}
                  showLibrary={item.library !== building.name}
                  onToggle={() => setOpenStudy(openStudy === item.id ? null : item.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
        {floors.length > 1 ? (
          <div className='segmented segmented--wrap' role='tablist'>
            <button type='button' className={floor === null ? 'segmented__item segmented__item--on' : 'segmented__item'} onClick={() => onFloor(null)}>
              {t('allFloors')}
            </button>
            {floors.map(value => (
              <button
                key={value}
                type='button'
                className={floor === value ? 'segmented__item segmented__item--on' : 'segmented__item'}
                onClick={() => onFloor(value)}
                onPointerEnter={() => onHoverFloor(value)}
                onPointerLeave={() => onHoverFloor(null)}
              >
                {floorLabel(value)}
              </button>
            ))}
          </div>
        ) : null}
        {(floor === null ? floors : [floor]).map(value => {
          const onFloorRooms = shown.filter(room => room.floor === value)
          if (onFloorRooms.length === 0) return null
          return (
            <div key={value} className='floor-group'>
              <h3 className='floor-group__title'>{floorName(value)}</h3>
              <div className='room-list'>
                {onFloorRooms.map(room => (
                  <div key={room.id} className={filtering && !matchesFilters(room, filters) ? 'room-list__item room-list__item--muted' : 'room-list__item'}>
                    <RoomCard
                      room={room}
                      lang={lang}
                      t={t}
                      showBuilding={false}
                      favorite={favorites.has(room.id)}
                      onOpen={onOpen}
                      onHover={hovered => onHoverFloor(hovered ? hovered.floor : null)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---- room detail -----------------------------------------------------------

interface RoomDetailProps {
  room: Room
  building: Building | undefined
  lang: Lang
  t: T
  favorite: boolean
  onFavorite: (room: Room) => void
  onSeatView: (room: Room) => void
  onBack: () => void
  onClose: () => void
}

export function RoomDetail ({ room, building, lang, t, favorite, onFavorite, onSeatView, onBack, onClose }: RoomDetailProps) {
  const [photo, setPhoto] = useState(0)
  const [copied, setCopied] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPhoto(0)
    setCopied(false)
    scroller.current?.scrollTo({ top: 0 })
  }, [room.id])

  const copy = async () => {
    const url = shareUrl({ building: room.building, room: room.id })
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt(t('share'), url)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const boardsText = [room.boards !== null ? String(room.boards) : '', term(lang, room.boardType)].filter(Boolean).join(' × ')
  const facts: [string, string][] = [
    [t('boards'), boardsText],
    [t('screens'), room.screens !== null ? String(room.screens) : ''],
    [t('wirelessMics'), room.wirelessMics !== null ? String(room.wirelessMics) : ''],
    [t('micFor'), term(lang, room.micFor)],
    [t('darkening'), term(lang, room.darkening)],
    [t('accessible'), room.accessible ? '✓' : '']
  ]
  const count = room.photos.length

  return (
    <section className='panel' aria-label={`${room.buildingName} ${room.room}`}>
      <header className='panel__header'>
        <button type='button' className='icon-button' onClick={onBack} aria-label={t('back')}><Icon name='back' /></button>
        <h2 className='panel__title panel__title--grow'>
          <span className='panel__title-building'>{room.buildingName}</span> {room.room}
        </h2>
        <button type='button' className='icon-button' onClick={onClose} aria-label={t('close')}><Icon name='close' /></button>
      </header>
      <div className='panel__scroll' ref={scroller}>
        {count > 0 ? (
          <div className='gallery'>
            <img key={room.photos[photo]} className='gallery__image' src={room.photos[photo]} alt={`${room.buildingName} ${room.room}`} referrerPolicy='no-referrer' />
            {count > 1 ? (
              <>
                <button type='button' className='gallery__nav gallery__nav--prev' onClick={() => setPhoto((photo + count - 1) % count)} aria-label={t('back')}>
                  <Icon name='back' />
                </button>
                <button type='button' className='gallery__nav gallery__nav--next' onClick={() => setPhoto((photo + 1) % count)} aria-label='Next'>
                  <Icon name='next' />
                </button>
                <span className='gallery__count'>{t('photoOf', { a: photo + 1, b: count })}</span>
              </>
            ) : null}
          </div>
        ) : null}

        {room.source === 'listings' ? (
          <div className='notice notice--plain notice--top'>
            <p>{t('listedNotice', { n: room.sections ?? 0, year: room.lastYear ?? '' })}</p>
            {room.largestClass ? <p>{t('atLeastSeats', { n: room.largestClass })}</p> : null}
          </div>
        ) : room.managedBy ? (
          <p className='notice notice--plain notice--top'>{t('schoolRoom', { school: room.managedBy })}</p>
        ) : null}
        <div className='stats'>
          <div className='stat'>
            <span className='stat__value'>{room.capacity ?? (room.largestClass ? `${room.largestClass}+` : '—')}</span>
            <span className='stat__label'>{t('seats')}</span>
          </div>
          <div className='stat stat--wide'>
            <span className='stat__value stat__value--text'>{term(lang, room.style) || '—'}</span>
            <span className='stat__label'>{t('seatingStyle')}</span>
          </div>
          <div className='stat'>
            <span className='stat__value'>{floorLabel(room.floor)}</span>
            <span className='stat__label'>{room.floor === 0 ? t('lowerLevel') : t('floorN', { n: room.floor })}</span>
          </div>
        </div>
        {room.note ? <p className='room-note'>{room.note}</p> : null}

        <div className='action-grid'>
          {room.capacity !== null ? (
            <button type='button' className='button button--primary' onClick={() => onSeatView(room)}>
              <Icon name='seat' size={16} />{t('seatView')}
            </button>
          ) : null}
          {room.tour ? (
            <a className='button button--green' href={room.tour} target='_blank' rel='noreferrer'>
              <Icon name='pano' size={16} />{t('virtualTour')}
            </a>
          ) : null}
          <button type='button' className={favorite ? 'button button--ghost button--on' : 'button button--ghost'} onClick={() => onFavorite(room)}>
            <Icon name={favorite ? 'starFilled' : 'star'} size={16} />{favorite ? t('saved') : t('save')}
          </button>
          <button type='button' className='button button--ghost' onClick={copy}>
            <Icon name='link' size={16} />{copied ? t('copied') : t('share')}
          </button>
          {building ? (
            <a className='button button--ghost' href={directionsUrl(building.ll[0], building.ll[1])} target='_blank' rel='noreferrer'>
              <Icon name='walk' size={16} />{t('directions')}
            </a>
          ) : null}
          {room.url ? (
            <a className='button button--ghost' href={room.url} target='_blank' rel='noreferrer'>
              <Icon name='external' size={16} />{room.managedBy ? t('sourcePage') : t('directoryPage')}
            </a>
          ) : null}
        </div>

        {room.equipment.length > 0 ? (
          <>
            <h3 className='section-title'>{t('equipment')}</h3>
            <div className='chips chips--static'>
              {room.equipment.map(item => <span key={item} className='chip chip--static'>{term(lang, item)}</span>)}
            </div>
          </>
        ) : null}

        {facts.some(([, value]) => value) ? (
          <>
            <h3 className='section-title'>{t('details')}</h3>
            <dl className='facts'>
              {facts.filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className='facts__row'>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}

        {room.seatMaps.length > 0 ? (
          <>
            <h3 className='section-title'>{t('seatMap')}</h3>
            {room.seatMaps.map(map => (
              <a key={map.file} className='seat-map' href={map.file} target='_blank' rel='noreferrer' title={t('openPdf')}>
                <img src={map.image} alt={t('seatMap')} loading='lazy' referrerPolicy='no-referrer' />
                <span className='seat-map__hint'><Icon name='external' size={14} />{t('openPdf')}</span>
              </a>
            ))}
          </>
        ) : null}
      </div>
    </section>
  )
}
