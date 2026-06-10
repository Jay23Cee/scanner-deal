// @vitest-environment jsdom

import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { useScannerSearchSubmit } from '@/components/scanner/useScannerSearchSubmit'

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ??
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')

  descriptor?.set?.call(input, value)
}

function SearchSubmitHarness({
  onSubmitSearch
}: {
  onSubmitSearch: (rawQuery: string) => Promise<void>
}) {
  const queryInputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const { formRef, searchButtonRef } = useScannerSearchSubmit({
    queryInputRef,
    onSubmitSearch
  })

  return (
    <form ref={formRef} role="search" aria-label="Submit harness">
      <label>
        Query
        <input
          ref={queryInputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <button ref={searchButtonRef} type="button">
        Search
      </button>
      <input type="submit" hidden tabIndex={-1} value="Submit" />
    </form>
  )
}

describe('useScannerSearchSubmit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('intercepts native form submit and prevents the browser default action', async () => {
    const submitSpy = vi.fn().mockResolvedValue(undefined)
    render(<SearchSubmitHarness onSubmitSearch={submitSpy} />)

    const input = screen.getByLabelText('Query')
    const form = screen.getByRole('search', { name: 'Submit harness' }) as HTMLFormElement

    fireEvent.change(input, { target: { value: 'iphone 15 pro max' } })

    const submitEvent = createEvent.submit(form)
    fireEvent(form, submitEvent)

    expect(submitEvent.defaultPrevented).toBe(true)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith('iphone 15 pro max')
  })

  it('uses the visible button click path without relying on form submission', async () => {
    const submitSpy = vi.fn().mockResolvedValue(undefined)
    render(<SearchSubmitHarness onSubmitSearch={submitSpy} />)

    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'sony wh-1000xm5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith('sony wh-1000xm5')
  })

  it('prefers the live input DOM value over React state when submitting', async () => {
    const submitSpy = vi.fn().mockResolvedValue(undefined)
    render(<SearchSubmitHarness onSubmitSearch={submitSpy} />)

    const input = screen.getByLabelText('Query')
    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith('iphone 15 pro max')
  })

  it('submits immediately on touch pointerdown when the input is focused', async () => {
    const submitSpy = vi.fn().mockResolvedValue(undefined)
    render(<SearchSubmitHarness onSubmitSearch={submitSpy} />)

    const input = screen.getByLabelText('Query')
    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')
    input.focus()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Search' }), { pointerType: 'touch' })

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith('iphone 15 pro max')
    expect(document.activeElement).not.toBe(input)
  })

  it('dedupes follow-up click and form submit after pointerdown already started the search', async () => {
    const submitSpy = vi.fn().mockResolvedValue(undefined)
    render(<SearchSubmitHarness onSubmitSearch={submitSpy} />)

    const input = screen.getByLabelText('Query')
    const button = screen.getByRole('button', { name: 'Search' })
    const form = screen.getByRole('search', { name: 'Submit harness' }) as HTMLFormElement

    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')
    input.focus()

    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent.click(button)

    const submitEvent = createEvent.submit(form)
    fireEvent(form, submitEvent)

    expect(submitEvent.defaultPrevented).toBe(true)
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
  })

  it('falls back to touchstart when PointerEvent is unavailable', async () => {
    vi.stubGlobal('PointerEvent', undefined)

    const submitSpy = vi.fn().mockResolvedValue(undefined)
    render(<SearchSubmitHarness onSubmitSearch={submitSpy} />)

    const input = screen.getByLabelText('Query')
    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')
    input.focus()

    fireEvent.touchStart(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1))
    expect(submitSpy).toHaveBeenCalledWith('iphone 15 pro max')
  })
})
