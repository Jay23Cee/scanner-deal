// @vitest-environment jsdom

import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ListingSwipeDeck } from '@/components/results/ListingSwipeDeck'

function DeckHarness({
  onIndexChange = vi.fn()
}: {
  onIndexChange?: (index: number) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div>
      <ListingSwipeDeck
        deckId="test-deck"
        sectionLabel="Test listings"
        itemLabel="listing"
        items={['One', 'Two', 'Three']}
        activeIndex={activeIndex}
        onActiveIndexChange={(index) => {
          onIndexChange(index)
          setActiveIndex(index)
        }}
        renderItem={(item) => <div>{item}</div>}
      />
      <button type="button" onClick={() => setActiveIndex(0)}>
        Reset deck
      </button>
    </div>
  )
}

function installDeckLayout() {
  const track = screen.getByRole('region', {
    name: 'Test listings swipe deck'
  }) as HTMLDivElement

  Object.defineProperty(track, 'clientWidth', {
    configurable: true,
    value: 320
  })
  Object.defineProperty(track, 'scrollWidth', {
    configurable: true,
    value: 960
  })
  Object.defineProperty(track, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: 0
  })

  const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-slide-index]'))
  slides.forEach((slide, index) => {
    Object.defineProperty(slide, 'offsetLeft', {
      configurable: true,
      value: index * 320
    })
  })

  const scrollTo = vi.fn(({ left }: { left?: number }) => {
    track.scrollLeft = left ?? 0
    fireEvent.scroll(track)
  })

  Object.defineProperty(track, 'scrollTo', {
    configurable: true,
    value: scrollTo
  })

  return {
    track,
    scrollTo
  }
}

describe('ListingSwipeDeck', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('moves forward and backward exactly one card with explicit navigation', () => {
    render(<DeckHarness />)
    installDeckLayout()

    expect(screen.getByText('1 / 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next listing' }))
    act(() => {
      vi.advanceTimersByTime(160)
    })
    expect(screen.getByText('2 / 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Previous listing' }))
    act(() => {
      vi.advanceTimersByTime(160)
    })
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('does not enter a programmatic navigation loop after button navigation', () => {
    const onIndexChange = vi.fn()

    render(<DeckHarness onIndexChange={onIndexChange} />)
    const { scrollTo } = installDeckLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Next listing' }))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(onIndexChange).toHaveBeenCalledTimes(1)
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
    expect(screen.getByText('2 / 3')).toBeTruthy()
  })

  it('updates the active card once after a swipe-settled scroll', () => {
    const onIndexChange = vi.fn()

    render(<DeckHarness onIndexChange={onIndexChange} />)
    const { track } = installDeckLayout()

    track.scrollLeft = 640
    fireEvent.scroll(track)

    act(() => {
      vi.advanceTimersByTime(160)
    })

    expect(onIndexChange).toHaveBeenCalledTimes(1)
    expect(onIndexChange).toHaveBeenLastCalledWith(2)
    expect(screen.getByText('3 / 3')).toBeTruthy()
  })

  it('returns to the first card when the deck is externally reset', () => {
    render(<DeckHarness />)
    const { scrollTo } = installDeckLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Next listing' }))
    act(() => {
      vi.advanceTimersByTime(160)
    })
    expect(screen.getByText('2 / 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset deck' }))
    act(() => {
      vi.advanceTimersByTime(160)
    })

    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })
})
