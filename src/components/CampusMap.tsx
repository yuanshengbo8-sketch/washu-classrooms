import { useEffect, useRef, useState } from 'react'
import type { Campus } from '../lib/types'
import type { StringKey } from '../lib/i18n'
import { CampusScene } from '../three/campus'
import { Icon } from './Icon'

interface CampusMapProps {
  campus: Campus
  t: (key: StringKey) => string
  selectedId: string | null
  /** Classroom count per floor for the selected building. */
  roomsByFloor: Map<number, number>
  highlightedFloor: number | null
  /** Matching classroom count per building, or null when no filter is on. */
  matches: Map<string, number> | null
  /** What `matches` counts: classrooms under a filter, or study rooms. */
  matchMode: 'rooms' | 'study'
  /** Study rooms per building. */
  studyCounts: Map<string, number>
  onSelect: (id: string) => void
  onFloor: (floor: number) => void
  onUnavailable: () => void
}

export default function CampusMap ({ campus, t, selectedId, roomsByFloor, highlightedFloor, matches, matchMode, studyCounts, onSelect, onFloor, onUnavailable }: CampusMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<CampusScene | null>(null)
  const callbacks = useRef({ onSelect, onFloor })
  callbacks.current = { onSelect, onFloor }
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!host.current) return
    try {
      scene.current = new CampusScene(host.current, campus, {
        onSelect: id => callbacks.current.onSelect(id),
        onFloor: floor => callbacks.current.onFloor(floor)
      })
      setReady(true)
    } catch (error) {
      console.error(error)
      onUnavailable()
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
    // The scene is built once per campus; callbacks are read through the ref.
  }, [campus])

  useEffect(() => {
    if (ready) scene.current?.select(selectedId, roomsByFloor)
  }, [ready, selectedId, roomsByFloor])

  useEffect(() => {
    if (ready) scene.current?.highlightFloor(highlightedFloor)
  }, [ready, highlightedFloor, selectedId])

  useEffect(() => {
    if (ready) scene.current?.setStudyBuildings(studyCounts)
  }, [ready, studyCounts])

  useEffect(() => {
    if (ready) scene.current?.setMatches(matches, matchMode)
  }, [ready, matches, matchMode])

  return (
    <div className='map'>
      <div className='map__host' ref={host} />
      <div className='map-controls'>
        <button type='button' className='map-controls__button' onClick={() => scene.current?.zoom(0.7)} aria-label={t('zoomIn')} title={t('zoomIn')}>
          <Icon name='plus' />
        </button>
        <button type='button' className='map-controls__button' onClick={() => scene.current?.zoom(1.45)} aria-label={t('zoomOut')} title={t('zoomOut')}>
          <Icon name='minus' />
        </button>
        <button type='button' className='map-controls__button' onClick={() => scene.current?.resetView()} aria-label={t('resetView')} title={t('resetView')}>
          <Icon name='compass' />
        </button>
      </div>
    </div>
  )
}
