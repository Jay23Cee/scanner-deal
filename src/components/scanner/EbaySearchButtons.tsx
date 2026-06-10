'use client'

import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import {
  buildEbayActiveSearchUrl,
  buildEbaySoldCompsUrl,
  cleanEbayQuery,
  openEbayUrl
} from '@/lib/ebayLinks'

type EbaySearchButtonProps = {
  query: string
} & Omit<ComponentPropsWithoutRef<'button'>, 'type'>

type BaseSearchButtonProps = EbaySearchButtonProps & {
  buildUrl: (query: string) => string
}

function BaseSearchButton({
  query,
  buildUrl,
  className = 'button',
  children,
  onClick,
  disabled,
  ...rest
}: BaseSearchButtonProps) {
  const cleanQuery = cleanEbayQuery(query)
  const isDisabled = disabled || cleanQuery.length === 0
  const [showPopupWarning, setShowPopupWarning] = useState(false)

  useEffect(() => {
    setShowPopupWarning(false)
  }, [cleanQuery])

  return (
    <div className="ebay-search-button">
      <button
        {...rest}
        type="button"
        className={className}
        disabled={isDisabled}
        onClick={(event) => {
          onClick?.(event)

          if (event.defaultPrevented || isDisabled) {
            return
          }

          const opened = openEbayUrl(buildUrl(cleanQuery))
          setShowPopupWarning(!opened)
        }}
      >
        {children}
      </button>

      {showPopupWarning ? (
        <p className="helper-text ebay-search-button__warning" role="status" aria-live="polite">
          Allow pop-ups to open eBay in a new tab.
        </p>
      ) : null}
    </div>
  )
}

export function SoldCompsButton({ children = 'Open Sold Comps', ...rest }: EbaySearchButtonProps) {
  return (
    <BaseSearchButton {...rest} buildUrl={buildEbaySoldCompsUrl}>
      {children}
    </BaseSearchButton>
  )
}

export function ActiveListingsButton({
  children = 'Open Active Listings',
  className = 'button button--ghost',
  ...rest
}: EbaySearchButtonProps) {
  return (
    <BaseSearchButton {...rest} className={className} buildUrl={buildEbayActiveSearchUrl}>
      {children}
    </BaseSearchButton>
  )
}
