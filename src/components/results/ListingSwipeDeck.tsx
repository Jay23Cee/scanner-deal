'use client'

import { ReactNode, useEffect, useRef } from 'react'

type ListingSwipeDeckProps<T> = {
  deckId: string
  sectionLabel: string
  itemLabel: string
  items: T[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  renderItem: (item: T, index: number) => ReactNode
}

export function ListingSwipeDeck<T>({
  deckId,
  sectionLabel,
  itemLabel,
  items,
  activeIndex,
  onActiveIndexChange,
  renderItem
}: ListingSwipeDeckProps<T>) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const lastReportedIndexRef = useRef(safeClampIndex(activeIndex, items.length))
  const programmaticTargetIndexRef = useRef<number | null>(null)
  const safeActiveIndex = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1)

  function clearSettleTimer() {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }

  function getSlide(index: number) {
    return trackRef.current?.querySelector<HTMLElement>(`[data-slide-index="${index}"]`) ?? null
  }

  function hasScrollableTrack(track: HTMLDivElement) {
    return track.scrollWidth > track.clientWidth + 1
  }

  function reportIndex(index: number) {
    if (index === lastReportedIndexRef.current) {
      return
    }

    lastReportedIndexRef.current = index
    onActiveIndexChange(index)
  }

  function getNearestSlideIndex(track: HTMLDivElement) {
    const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-slide-index]'))
    if (slides.length === 0) {
      return 0
    }

    const nearestSlide = slides.reduce((closest, slide) => {
      if (!closest) {
        return slide
      }

      return Math.abs(slide.offsetLeft - track.scrollLeft) < Math.abs(closest.offsetLeft - track.scrollLeft)
        ? slide
        : closest
    }, slides[0] ?? null)

    const nextIndex = Number(nearestSlide?.dataset.slideIndex ?? '0')
    return Number.isFinite(nextIndex) ? safeClampIndex(nextIndex, items.length) : 0
  }

  function scheduleSettle() {
    clearSettleTimer()
    settleTimerRef.current = window.setTimeout(() => {
      const track = trackRef.current
      if (!track || !hasScrollableTrack(track)) {
        return
      }

      const settledIndex = getNearestSlideIndex(track)
      const targetIndex = programmaticTargetIndexRef.current
      if (targetIndex !== null && settledIndex === targetIndex) {
        programmaticTargetIndexRef.current = null
      } else if (targetIndex !== null) {
        programmaticTargetIndexRef.current = null
      }
      reportIndex(settledIndex)
    }, 140)
  }

  function scrollToIndex(index: number, behavior: ScrollBehavior) {
    const track = trackRef.current
    const slide = getSlide(index)
    if (!track || !slide || !hasScrollableTrack(track)) {
      return
    }

    programmaticTargetIndexRef.current = index
    track.scrollTo({
      left: slide.offsetLeft,
      behavior
    })
    scheduleSettle()
  }

  function navigateToIndex(index: number) {
    const nextIndex = safeClampIndex(index, items.length)
    const track = trackRef.current

    if (!track || !hasScrollableTrack(track)) {
      reportIndex(nextIndex)
      return
    }

    if (nextIndex !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = nextIndex
      onActiveIndexChange(nextIndex)
    }

    scrollToIndex(nextIndex, 'smooth')
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track || !hasScrollableTrack(track)) {
      lastReportedIndexRef.current = safeActiveIndex
      return
    }

    if (safeActiveIndex !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = safeActiveIndex
      scrollToIndex(safeActiveIndex, 'auto')
    }
  }, [items.length, safeActiveIndex])

  useEffect(() => {
    const track = trackRef.current
    if (!track) {
      return
    }

    const handleScroll = () => {
      if (track.clientWidth === 0 || items.length <= 1 || !hasScrollableTrack(track)) {
        return
      }

      scheduleSettle()
    }

    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      clearSettleTimer()
      track.removeEventListener('scroll', handleScroll)
    }
  }, [items.length, onActiveIndexChange])

  return (
    <div className="listing-deck" data-testid={`${deckId}-deck`}>
      {items.length > 1 ? (
        <div className="listing-deck__toolbar">
          <div className="status-chip" aria-live="polite">
            {safeActiveIndex + 1} / {items.length}
          </div>
          <div className="listing-deck__controls">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => navigateToIndex(safeActiveIndex - 1)}
              disabled={safeActiveIndex === 0}
              aria-label={`Previous ${itemLabel}`}
            >
              Previous
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => navigateToIndex(safeActiveIndex + 1)}
              disabled={safeActiveIndex === items.length - 1}
              aria-label={`Next ${itemLabel}`}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={trackRef}
        className="listing-deck__track"
        role="region"
        aria-label={`${sectionLabel} swipe deck`}
      >
        {items.map((item, index) => (
          <div
            key={`${deckId}-${index}`}
            className="listing-deck__slide"
            data-slide-index={index}
            aria-current={index === safeActiveIndex ? 'true' : undefined}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {items.length > 1 ? (
        <div className="listing-deck__dots" aria-label={`${sectionLabel} positions`}>
          {items.map((_, index) => (
            <button
              key={`${deckId}-dot-${index}`}
              type="button"
              className={`listing-deck__dot${index === safeActiveIndex ? ' listing-deck__dot--active' : ''}`}
              aria-label={`Go to ${itemLabel} ${index + 1}`}
              aria-pressed={index === safeActiveIndex}
              onClick={() => navigateToIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function safeClampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0
  }

  return Math.max(0, Math.min(length - 1, index))
}
