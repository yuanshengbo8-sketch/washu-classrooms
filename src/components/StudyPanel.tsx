import { useMemo, useState } from 'react'
import type { Lang, StringKey } from '../lib/i18n'
import type { Availability, StudyRoom, StudyStatus } from '../lib/study'
import { campusNow, clock, gridFor, isFresh, statusOf } from '../lib/study'
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
  'washu-key-access-only': 'studyCard'
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

interface StudyCardProps {
  room: StudyRoom
  availability: Availability | null
  t: T
  open: boolean
  showLibrary: boolean
  onToggle: () => void
  onLocate?: (room: StudyRoom) => void
}

export function StudyCard ({ room, availability, t, open, showLibrary, onToggle, onLocate }: StudyCardProps) {
  const status = statusOf(room, availability)
  const now = campusNow()
  const tomorrow = campusNow(new Date(Date.now() + 86400000)).date
  const place = [showLibrary ? room.library : '', room.level ? t('studyLevel', { level: room.level }) : ''].filter(Boolean).join(' · ')
  return (
    <div className={open ? 'study-card study-card--open' : 'study-card'}>
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
  lang: Lang
  t: T
  onLocate: (room: StudyRoom) => void
  onClose: () => void
}

type Chip = 'free' | 'reservable' | 'group' | 'quiet'

export function StudyPanel ({ rooms, availability, lang, t, onLocate, onClose }: StudyPanelProps) {
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

        <h3 className='section-title'>{t('studyElsewhere')}</h3>
        <div className='notice notice--plain'>
          <p><b>{t('studyOlinTitle')}</b></p>
          <p>{t('studyOlinBody')}</p>
          <p><a href='https://reserve.wustl.edu/' target='_blank' rel='noreferrer'>reserve.wustl.edu</a> · <a href='https://sites.wustl.edu/olings/reserving-group-rooms/' target='_blank' rel='noreferrer'>{t('studyOlinGuide')}</a></p>
        </div>
        <div className='notice notice--plain'>
          <p><b>{t('studyClassroomsTitle')}</b></p>
          <p>{t('studyClassroomsBody')}</p>
          <p><a href='https://sites.wustl.edu/olings/reserving-a-classroom/' target='_blank' rel='noreferrer'>{t('studyClassroomsLink')}</a></p>
        </div>
        <p className='study-source'>
          {t('studySource')} <a href='https://library.washu.edu/study-rooms/' target='_blank' rel='noreferrer'>library.washu.edu/study-rooms</a> · <a href='https://wustl.libcal.com/allspaces' target='_blank' rel='noreferrer'>wustl.libcal.com</a>
        </p>
      </div>
    </section>
  )
}
