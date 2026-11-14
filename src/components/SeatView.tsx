import { useEffect, useRef, useState } from 'react'
import type { Room } from '../lib/types'
import type { Lang, StringKey } from '../lib/i18n'
import { term } from '../lib/i18n'
import { SeatScene } from '../three/seatview'
import type { SeatInfo, SeatPreset } from '../three/seatview'
import { Icon } from './Icon'

interface SeatViewProps {
  room: Room
  lang: Lang
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  onClose: () => void
}

const PRESETS: [SeatPreset, StringKey][] = [
  ['front', 'frontRow'],
  ['middle', 'middleRow'],
  ['back', 'backRow'],
  ['corner', 'corner']
]

export default function SeatView ({ room, lang, t, onClose }: SeatViewProps) {
  const stage = useRef<HTMLDivElement>(null)
  const scene = useRef<SeatScene | null>(null)
  const [seat, setSeat] = useState<SeatInfo | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!stage.current) return
    try {
      scene.current = new SeatScene(stage.current, room, setSeat)
    } catch {
      setFailed(true)
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
  }, [room])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className='modal-backdrop' onClick={onClose}>
      <div className='modal modal--seat' role='dialog' aria-modal='true' aria-label={t('seatViewTitle')} onClick={event => event.stopPropagation()}>
        <header className='modal__header'>
          <div>
            <h2 className='modal__title'>{t('seatViewTitle')} · {room.buildingName} {room.room}</h2>
            <p className='modal__subtitle'>
              {room.capacity ?? '—'} {t('seats')} · {term(lang, room.style)}
            </p>
          </div>
          <button type='button' className='icon-button' onClick={onClose} aria-label={t('close')}><Icon name='close' /></button>
        </header>
        <div className='seat-stage' ref={stage}>
          {failed ? <p className='empty'>{t('noWebgl')}</p> : null}
          <div className='seat-hud'>
            {seat ? (
              <>
                <span className='seat-hud__pill'>{t('rowOf', { a: seat.row, b: seat.rows })}</span>
                <span className='seat-hud__pill'>{t('toBoard', { n: seat.distance })}</span>
                <span className='seat-hud__pill'>{t('offAxis', { n: seat.angle })}</span>
                <span className='seat-hud__hint'>{t('dragLook')}</span>
              </>
            ) : (
              <span className='seat-hud__pill seat-hud__pill--prompt'>{t('seatViewPick')}</span>
            )}
          </div>
        </div>
        <footer className='seat-footer'>
          <div className='segmented'>
            <button type='button' className={seat ? 'segmented__item' : 'segmented__item segmented__item--on'} onClick={() => scene.current?.overview()}>
              {t('overview')}
            </button>
            {PRESETS.map(([preset, key]) => (
              <button key={preset} type='button' className='segmented__item' onClick={() => scene.current?.sitAt(preset)}>
                {t(key)}
              </button>
            ))}
          </div>
          <p className='seat-footer__note'>{t('seatViewNote')}</p>
          <div className='seat-footer__links'>
            {room.tour ? (
              <a className='button button--green' href={room.tour} target='_blank' rel='noreferrer'><Icon name='pano' size={16} />{t('virtualTour')}</a>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
