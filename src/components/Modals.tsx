import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Course } from '../lib/types'
import type { StringKey } from '../lib/i18n'
import { formatMeeting } from '../lib/search'
import { CAMPUS } from '../campus'
import { Icon } from './Icon'

type T = (key: StringKey, vars?: Record<string, string | number>) => string

export const REPO_URL = CAMPUS.repoUrl

function Modal ({ title, subtitle, onClose, closeLabel, children }: { title: string; subtitle?: string; onClose: () => void; closeLabel: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className='modal-backdrop' onClick={onClose}>
      <div className='modal' role='dialog' aria-modal='true' aria-label={title} onClick={event => event.stopPropagation()}>
        <header className='modal__header'>
          <div>
            <h2 className='modal__title'>{title}</h2>
            {subtitle ? <p className='modal__subtitle'>{subtitle}</p> : null}
          </div>
          <button type='button' className='icon-button' onClick={onClose} aria-label={closeLabel}><Icon name='close' /></button>
        </header>
        <div className='modal__body'>{children}</div>
      </div>
    </div>
  )
}

interface CourseModalProps {
  course: Course
  loading: boolean
  t: T
  terms: { id: string; label: string }[]
  termId: string
  onTerm: (id: string) => void
  onClose: () => void
}

export function CourseModal ({ course, loading, t, terms, termId, onTerm, onClose }: CourseModalProps) {
  const dayNames = t('days').split(',')
  return (
    <Modal
      title={course.title ? `${course.code} · ${course.title}` : course.code}
      subtitle={[course.school, course.dept, course.level, `${course.units} ${t('units')}`].filter(Boolean).join(' · ')}
      onClose={onClose}
      closeLabel={t('close')}
    >
      <div className='segmented'>
        {terms.map(item => (
          <button key={item.id} type='button' className={item.id === termId ? 'segmented__item segmented__item--on' : 'segmented__item'} onClick={() => onTerm(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {course.sections.length === 0 ? <p className='empty'>{loading ? t('loadingCourses') : t('noResults')}</p> : null}
      <div className='table-wrap' hidden={course.sections.length === 0}>
        <table className='sections'>
          <thead>
            <tr>
              <th>{t('section')}</th>
              <th>{t('when')}</th>
              <th>{t('instructor')}</th>
              <th>{t('enrolled')}</th>
            </tr>
          </thead>
          <tbody>
            {course.sections.map((section, index) => {
              const full = section.taken !== null && section.cap !== null && section.cap > 0 && section.taken >= section.cap
              return (
                <tr key={`${section.n}-${index}`}>
                  <td>
                    <b>{section.n}</b>
                    {/Half|Mini|Session/i.test(section.term) ? <span className='sections__term'>{section.term.replace(/^\d{4}\s+\w+\s*/, '')}</span> : null}
                  </td>
                  <td>{formatMeeting(section, dayNames, t('tba'))}{section.mode && section.mode !== 'In-Person' ? <span className='sections__term'>{section.mode}</span> : null}</td>
                  <td>{section.inst || t('tba')}</td>
                  <td className={full ? 'sections__full' : ''}>{section.taken ?? '—'} / {section.cap ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className='notice'>{t('roomNotPublic')}</p>
    </Modal>
  )
}

export function AboutModal ({ t, fetched, onClose }: { t: T; fetched: string; onClose: () => void }) {
  return (
    <Modal title={t('appName')} onClose={onClose} closeLabel={t('close')}>
      <p>{t('aboutBody1')}</p>
      <h3 className='section-title'>{t('aboutData')}</h3>
      <ul className='about-list'>
        <li>{t('aboutClassrooms')} <a href={CAMPUS.sources.classrooms.url} target='_blank' rel='noreferrer'>{CAMPUS.sources.classrooms.label}</a></li>
        {CAMPUS.sources.courses ? (
          <li>{t('aboutCourses')} <a href={CAMPUS.sources.courses.url} target='_blank' rel='noreferrer'>{CAMPUS.sources.courses.label}</a></li>
        ) : null}
        {CAMPUS.sources.study ? (
          <li>{t('aboutStudy')} <a href={CAMPUS.sources.study.url} target='_blank' rel='noreferrer'>{CAMPUS.sources.study.label}</a></li>
        ) : null}
        <li>{t('aboutMap')} <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noreferrer'>openstreetmap.org/copyright</a></li>
        <li>{t('aboutFloors')}</li>
      </ul>
      <p>{t('aboutCredit')} <a href='https://github.com/zhenzhenfufu/ucsd-classrooms' target='_blank' rel='noreferrer'>zhenzhenfufu/ucsd-classrooms</a></p>
      <p className='about-meta'>
        <a href={REPO_URL} target='_blank' rel='noreferrer'>{t('sourceCode')}</a> · {t('dataAsOf', { d: fetched })}
      </p>
    </Modal>
  )
}
