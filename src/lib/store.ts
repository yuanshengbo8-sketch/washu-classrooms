import { CAMPUS } from '../campus'
import { safeGet, safeSet } from './i18n'

const FAVORITES_KEY = `${CAMPUS.id}.favorites`

export function loadFavorites (): Set<string> {
  try {
    const parsed: unknown = JSON.parse(safeGet(FAVORITES_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveFavorites (favorites: Set<string>): void {
  safeSet(FAVORITES_KEY, JSON.stringify([...favorites]))
}

export interface UrlState {
  building: string | null
  room: string | null
}

export function readUrl (): UrlState {
  const params = new URLSearchParams(location.search)
  return { building: params.get('b'), room: params.get('r') }
}

export function writeUrl (state: UrlState): void {
  const params = new URLSearchParams()
  if (state.room) params.set('r', state.room)
  else if (state.building) params.set('b', state.building)
  const query = params.toString()
  const url = `${location.pathname}${query ? `?${query}` : ''}`
  if (url !== `${location.pathname}${location.search}`) history.replaceState(null, '', url)
}

export function shareUrl (state: UrlState): string {
  const params = new URLSearchParams()
  if (state.room) params.set('r', state.room)
  else if (state.building) params.set('b', state.building)
  return `${location.origin}${location.pathname}?${params.toString()}`
}

/** Google Maps walking directions to a point; works on desktop and phones. */
export function directionsUrl (lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`
}

/** Google Street View at the nearest panorama to a point. */
export function streetViewUrl (lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
}
