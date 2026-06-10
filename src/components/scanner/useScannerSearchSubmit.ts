'use client'

import { RefObject, useEffect, useRef } from 'react'

export type SearchSubmitSource =
  | 'button_pointerdown'
  | 'button_touchstart'
  | 'button_click'
  | 'form_submit'

const SEARCH_SUBMIT_DEDUPE_WINDOW_MS = 700

function hasPointerEventSupport() {
  return typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined'
}

function isCoarseTouchPointer(pointerType: string) {
  const prefersCoarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches

  return pointerType === 'touch' || prefersCoarsePointer
}

type UseScannerSearchSubmitParams = {
  queryInputRef: RefObject<HTMLInputElement | null>
  onSubmitSearch: (rawQuery: string) => Promise<void>
}

export function useScannerSearchSubmit({
  queryInputRef,
  onSubmitSearch
}: UseScannerSearchSubmitParams) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const searchButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastSubmitSourceRef = useRef<SearchSubmitSource | null>(null)
  const lastSubmitTimestampRef = useRef(0)
  const submitSearchRef = useRef(onSubmitSearch)

  useEffect(() => {
    submitSearchRef.current = onSubmitSearch
  }, [onSubmitSearch])

  function getLiveQueryValue() {
    return queryInputRef.current?.value ?? ''
  }

  function isQueryInputFocused() {
    return document.activeElement === queryInputRef.current
  }

  function blurQueryInput() {
    if (queryInputRef.current && document.activeElement === queryInputRef.current) {
      queryInputRef.current.blur()
    }
  }

  function markSubmitStarted(source: SearchSubmitSource) {
    lastSubmitSourceRef.current = source
    lastSubmitTimestampRef.current = Date.now()
  }

  function shouldSuppressSubmit(source: SearchSubmitSource) {
    if (source !== 'button_click' && source !== 'form_submit') {
      return false
    }

    const submittedRecently = Date.now() - lastSubmitTimestampRef.current <= SEARCH_SUBMIT_DEDUPE_WINDOW_MS
    return (
      submittedRecently &&
      (lastSubmitSourceRef.current === 'button_pointerdown' ||
        lastSubmitSourceRef.current === 'button_touchstart')
    )
  }

  async function submitFromSource(
    source: SearchSubmitSource,
    options?: { blurAfterStart?: boolean }
  ) {
    if (shouldSuppressSubmit(source)) {
      return
    }

    markSubmitStarted(source)
    const submitPromise = submitSearchRef.current(getLiveQueryValue().trim())

    if (options?.blurAfterStart) {
      blurQueryInput()
    }

    await submitPromise
  }

  useEffect(() => {
    const form = formRef.current
    const searchButton = searchButtonRef.current

    if (!form || !searchButton) {
      return
    }

    const handleNativeSubmit = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation()
      }
      void submitFromSource('form_submit')
    }

    const handleButtonPointerDown = (event: globalThis.PointerEvent) => {
      if (!isCoarseTouchPointer(event.pointerType) || !isQueryInputFocused()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void submitFromSource('button_pointerdown', { blurAfterStart: true })
    }

    const handleButtonTouchStart = (event: globalThis.TouchEvent) => {
      if (hasPointerEventSupport() || !isQueryInputFocused()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void submitFromSource('button_touchstart', { blurAfterStart: true })
    }

    const handleButtonClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      void submitFromSource('button_click')
    }

    form.addEventListener('submit', handleNativeSubmit, true)
    searchButton.addEventListener('pointerdown', handleButtonPointerDown)
    searchButton.addEventListener('click', handleButtonClick)

    if (!hasPointerEventSupport()) {
      searchButton.addEventListener('touchstart', handleButtonTouchStart)
    }

    return () => {
      form.removeEventListener('submit', handleNativeSubmit, true)
      searchButton.removeEventListener('pointerdown', handleButtonPointerDown)
      searchButton.removeEventListener('click', handleButtonClick)

      if (!hasPointerEventSupport()) {
        searchButton.removeEventListener('touchstart', handleButtonTouchStart)
      }
    }
  }, [queryInputRef])

  return {
    formRef,
    searchButtonRef
  }
}
