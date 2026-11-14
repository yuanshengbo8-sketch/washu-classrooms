import { useEffect, useMemo, useState } from 'react'
import type { Lang, StringKey } from '../lib/i18n'
import type { Availability, FloorPlans, StudyRoom, StudyStatus } from '../lib/study'
import { campusNow, clock, gridFor, isFresh, statusOf } from '../lib/study'
import { CAMPUS } from '../campus'
import { Icon } from './Icon'

type T = (key: StringKey, vars?: Record<string, string | number>) => string

const FEATURES: Record<string, StringKey> = {
  'group-study': 'studyGroup',
  'quiet-study': 'studyQuiet',
  'silent-study': 'studySilent',
  'graduate-study': 'studyGrad',
  'faculty-study': 'studyFaculty',
  whiteboard: 'studyWhiteboard',
  computer: 'studyComputer',
  'a-v-equipment': 'studyAv',
  'accessible-seating': 'accessible',
  'washu-key-access-only': 'studyCard',
  'presentation-screen': 'studyScreen'
}

function statusText (status: StudyStatus, t: T): string {
  switch (status.kind) {
    case 'free': return t('studyFreeUntil', { time: clock(status.until) })
    case 'busy': return t('studyBusyUntil', { time: clock(status.until) })
    case 'closed': return status.opens === null ? t('studyClosed') : t('studyOpensAt', { time: clock(status.opens) })
    case 'walkin': return t('studyWalkIn')
    default: return t('studyCheckLibcal')
  }
}

/** Today's bookable hours as a strip, booked stretches filled in. */
function DayStrip ({ room, availability, date, label, nowMinutes }: { room: StudyRoom; availability: Availability | null; date: string; label: string; nowMinutes: number | null }) {
  const grid = gridFor(room, availability, date)
  if (!grid) return null
  const [open, close] = grid.open
  const span = Math.max(close - open, 1)
  const hours: number[] = []
  for (let hour = Math.ceil(open / 60); hour * 60 <= close; hour += 2) hours.push(hour)
  return (
    <div className='day-strip'>
      <div className='day-strip__label'>{label} · {clock(open)} – {clock(close)}</div>
      <div className='day-strip__bar'>
        {grid.busy.map(([from, to]) => (
          <span key={from} className='day-strip__busy' style={{ left: `${((from - open) / span) * 100}%`, width: `${((to - from) / span) * 100}%` }} title={`${clock(from)} – ${clock(to)}`} />
        ))}
        {nowMinutes !== null && nowMinutes >= open && nowMinutes <= close ? (
          <span className='day-strip__now' style={{ left: `${((nowMinutes - open) / span) * 100}%` }} />
        ) : null}
      </div>
      <div className='day-strip__hours'>
        {hours.map(hour => <span key={hour} style={{ left: `${((hour * 60 - open) / span) * 100}%` }}>{clock(hour * 60).replace(' ', '')}</span>)}
      </div>
    </div>
  )
}

export interface PlanPin {
  id: string
  name: string
  spot: [number, number]
  kind: StudyStatus['kind']
  active: boolean
}

interface FloorPlanProps {
  /** The plan image on the library's site. */
  src: string
  /** The page the plan comes from, linked if the image cannot load. */
  page: string
  pins: PlanPin[]
  t: T
  onPick?: (id: string) => void
}

/**
 * A published floor plan with the study rooms marked on it. The image stays
 * on the library's site; if that fails, the Internet Archive's copy is tried.
 */
export function FloorPlan ({ src, page, pins, t, onPick }: FloorPlanProps) {
  const [attempt, setAttempt] = useState({ src, step: 0 })
  if (attempt.src !== src) setAttempt({ src, step: 0 })
  const step = attempt.src === src ? attempt.step : 0
  const [loaded, setLoaded] = useState('')
  const url = step === 0 ? src : `https://web.archive.org/web/2025im_/${src}`
  // The library's server is sometimes very slow: after four seconds, try the archived copy.
  useEffect(() => {
    if (step !== 0 || loaded === url) return
    const timer = window.setTimeout(() => setAttempt(current => (current.src === src && current.step === 0 ? { src, step: 1 } : current)), 4000)
    return () => window.clearTimeout(timer)
  }, [src, step, url, loaded])
  if (step >= 2) {
    return <p className='notice notice--plain'>{t('planFailed')} <a href={page} target='_blank' rel='noreferrer'>{t('planPage')}</a></p>
  }
  return (
    <figure className='plan'>
      <div className='plan__frame'>
        <a href={url} target='_blank' rel='noreferrer' title={t('planOpen')}>
          <img key={url} className='plan__image' src={url} alt={t('floorPlan')} referrerPolicy='no-referrer' onLoad={() => setLoaded(url)} onError={() => setAttempt({ src, step: step + 1 })} />
        </a>
        {loaded === url && pins.map(pin => (
          <button
            key={pin.id}
            type='button'
            className={`plan__pin plan__pin--${pin.kind}${pin.active ? ' plan__pin--active' : ''}`}
            style={{ left: `${pin.spot[0] * 100}%`, top: `${pin.spot[1] * 100}%` }}
            title={pin.name}
            aria-label={pin.name}
            onClick={() => onPick?.(pin.id)}
          />
        ))}
      </div>
      <figcaption className='plan__caption'>
        <a href={page} target='_blank' rel='noreferrer'>{t('planCredit')}</a>
      </figcaption>
    </figure>
  )
}

/** Level tabs and the plan for one library, with every placed room pinned. */
export function LibraryPlans ({ plans, rooms, availability, t, activeId, onPick }: {
  plans: FloorPlans
  rooms: StudyRoom[]
  availability: Availability | null
  t: T
  activeId: string | null
  onPick: (id: string) => void
}) {
  const active = rooms.find(room => room.id === activeId)
  const [chosen, setChosen] = useState<string | null>(null)
  const [followed, setFollowed] = useState<string | null>(null)
  // Opening a room's card switches to its level once.
  if (active?.spot && active.level && followed !== active.id) {
    setFollowed(active.id)
    setChosen(active.level)
  }
  const levels = plans.order.filter(level => plans.levels[level])
  const level = chosen && plans.levels[chosen] ? chosen : levels.find(item => rooms.some(room => room.level === item && room.spot)) ?? levels[0]
  const pins: PlanPin[] = rooms
    .filter(room => room.level === level && room.spot)
    .map(room => ({ id: room.id, name: room.name, spot: room.spot as [number, number], kind: statusOf(room, availability).kind, active: room.id === activeId }))
  return (
    <div className='plans'>
      <div className='segmented segmented--wrap' role='tablist'>
        {levels.map(item => (
          <button key={item} type='button' className={item === level ? 'segmented__item segmented__item--on' : 'segmented__item'} onClick={() => setChosen(item)}>
            {t('studyLevel', { level: item })}
          </button>
        ))}
      </div>
      <FloorPlan src={plans.levels[level]} page={plans.page} pins={pins} t={t} onPick={onPick} />
      <p className='plan__legend'>
        <span className='plan__dot plan__dot--free' />{t('studyFreeNow')}
        <span className='plan__dot plan__dot--busy' />{t('planBooked')}
        <span className='plan__dot plan__dot--walkin' />{t('planOther')}
      </p>
    </div>
  )
}

interface StudyCardProps {
  room: StudyRoom
  availability: Availability | null
  /** Floor plans of the room's library, when it publishes them. */
  plans?: FloorPlans
  t: T
  open: boolean
  showLibrary: boolean
  onToggle: () => void
  onLocate?: (room: StudyRoom) => void
}

export function StudyCard ({ room, availability, plans, t, open, showLibrary, onToggle, onLocate }: StudyCardProps) {
  const status = statusOf(room, availability)
  const now = campusNow()
  const tomorrow = campusNow(new Date(Date.now() + 86400000)).date
  const place = [showLibrary ? room.library : '', room.level ? t('studyLevel', { level: room.level }) : ''].filter(Boolean).join(' · ')
  return (
    <div className={open ? 'study-card study-card--open' : 'study-card'} id={`study-${room.id}`}>
      <button type='button' className='study-card__head' onClick={onToggle} aria-expanded={open}>
        <span className='study-card__main'>
          <span className='study-card__name'>{room.name}</span>
          <span className='study-card__meta'>
            {place}
            {place && room.seats ? ' · ' : ''}
            {room.seats ? `${room.seats} ${t('seats')}` : ''}
          </span>
        </span>
        <span className={`status status--${status.kind}`}>{statusText(status, t)}</span>
      </button>
      {open ? (
        <div className='study-card__body'>
          <p className='study-card__text'>{room.text}</p>
          {room.features.length > 0 ? (
            <div className='chips chips--static'>
              {room.features.map(feature => <span key={feature} className='chip chip--static'>{FEATURES[feature] ? t(FEATURES[feature]) : feature}</span>)}
            </div>
          ) : null}
          {plans && room.spot && plans.levels[room.level] ? (
            <>
              <FloorPlan
                src={plans.levels[room.level]}
                page={plans.page}
                pins={[{ id: room.id, name: room.name, spot: room.spot, kind: status.kind, active: true }]}
                t={t}
              />
              {room.spotArea ? <p className='plan__note'>{t('planArea', { area: room.spotArea })}</p> : null}
            </>
          ) : null}
          {room.eid && isFresh(availability) ? (
            <>
              <DayStrip room={room} availability={availability} date={now.date} label={t('today')} nowMinutes={now.minutes} />
              <DayStrip room={room} availability={availability} date={tomorrow} label={t('tomorrow')} nowMinutes={null} />
            </>
          ) : null}
          <div className='action-grid'>
            {room.book ? (
              <a className='button button--green' href={room.book} target='_blank' rel='noreferrer'><Icon name='external' size={16} />{t('studyBook')}</a>
            ) : null}
            <a className='button button--ghost' href={room.url} target='_blank' rel='noreferrer'><Icon name='external' size={16} />{t('studyLibraryPage')}</a>
            {onLocate ? (
              <button type='button' className='button button--ghost' onClick={() => onLocate(room)}><Icon name='building' size={16} />{t('studyShowBuilding')}</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface StudyPanelProps {
  rooms: StudyRoom[]
  availability: Availability | null
  plans: Record<string, FloorPlans>
  lang: Lang
  t: T
  onLocate: (room: StudyRoom) => void
  onClose: () => void
}

type Chip = 'free' | 'reservable' | 'group' | 'quiet'

export function StudyPanel ({ rooms, availability, plans, lang, t, onLocate, onClose }: StudyPanelProps) {
  const [chips, setChips] = useState<Set<Chip>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const fresh = isFresh(availability)

  const shown = useMemo(() => rooms.filter(room => {
    if (chips.has('free') && statusOf(room, availability).kind !== 'free') return false
    if (chips.has('reservable') && !room.reservable) return false
    if (chips.has('group') && !room.features.includes('group-study')) return false
    if (chips.has('quiet') && !room.features.some(feature => feature === 'quiet-study' || feature === 'silent-study')) return false
    return true
  }), [rooms, chips, availability])

  const libraries = [...new Set(shown.map(room => room.library))]
  const freeNow = rooms.filter(room => statusOf(room, availability).kind === 'free').length
  const toggle = (chip: Chip) => setChips(current => {
    const next = new Set(current)
    if (next.has(chip)) next.delete(chip)
    else next.add(chip)
    return next
  })
  const updated = availability ? new Date(availability.updated).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  const chipList: [Chip, StringKey][] = [['free', 'studyFreeNow'], ['reservable', 'studyReservable'], ['group', 'studyGroup'], ['quiet', 'studyQuiet']]

  return (
    <section className='panel' aria-label={t('studyRooms')}>
      <header className='panel__header'>
        <h2 className='panel__title panel__title--grow'>{t('studyRooms')}</h2>
        <button type='button' className='icon-button' onClick={onClose} aria-label={t('close')}><Icon name='close' /></button>
      </header>
      <div className='panel__scroll'>
        <p className={fresh ? 'notice notice--top' : 'notice notice--plain notice--top'}>
          {fresh ? t('studyLive', { n: freeNow, time: updated }) : t('studyNotLive')}
        </p>
        <div className='chips study-chips'>
          {chipList.map(([chip, key]) => (
            <button key={chip} type='button' className={chips.has(chip) ? 'chip chip--on' : 'chip'} onClick={() => toggle(chip)} disabled={chip === 'free' && !fresh}>
              {t(key)}
            </button>
          ))}
        </div>
        {shown.length === 0 ? <p className='empty'>{t('studyNone')}</p> : null}
        {libraries.map(library => (
          <div key={library} className='floor-group'>
            <h3 className='floor-group__title'>{library}</h3>
            <div className='study-list'>
              {shown.filter(room => room.library === library).map(room => (
                <StudyCard
                  key={room.id}
                  room={room}
                  availability={availability}
                  plans={plans[room.library]}
                  t={t}
                  open={openId === room.id}
                  showLibrary={false}
                  onToggle={() => setOpenId(openId === room.id ? null : room.id)}
                  onLocate={onLocate}
                />
              ))}
            </div>
          </div>
        ))}

        {CAMPUS.studyElsewhere.length > 0 ? <h3 className='section-title'>{t('studyElsewhere')}</h3> : null}
        {CAMPUS.studyElsewhere.map(card => (
          <div key={card.title.en} className='notice notice--plain'>
            <p><b>{card.title[lang]}</b></p>
            <p>{card.body[lang]}</p>
            <p>
              {card.links.map((link, index) => (
                <span key={link.url}>{index > 0 ? ' · ' : ''}<a href={link.url} target='_blank' rel='noreferrer'>{link.label[lang]}</a></span>
              ))}
            </p>
          </div>
        ))}
        {CAMPUS.sources.study ? (
          <p className='study-source'>
            {t('studySource')} <a href={CAMPUS.sources.study.url} target='_blank' rel='noreferrer'>{CAMPUS.sources.study.label}</a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
