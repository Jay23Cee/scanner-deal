'use client'

import { useEffect, useState } from 'react'
import {
  formatBuyingOptions,
  formatListingLocation,
  getListingAbsoluteAgeLabel,
  getListingAgeDateLabel,
  getListingRelativeAgeLabel
} from '@/lib/listings'
import { ListingResult } from '@/lib/types'

function currency(value: number, code: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2
  }).format(value)
}

function buildImageSet(listing: ListingResult) {
  const allImages = [
    listing.primaryImageUrl,
    listing.thumbnailUrl,
    ...listing.additionalImageUrls
  ].filter((imageUrl): imageUrl is string => Boolean(imageUrl))

  return Array.from(new Set(allImages))
}

function getShippingLabel(listing: ListingResult) {
  if (!listing.shippingKnown) {
    return 'Not available'
  }

  if (listing.shippingCost === 0) {
    return 'Free'
  }

  return currency(listing.shippingCost, listing.currency)
}

function getTotalLabel(listing: ListingResult) {
  if (!listing.shippingKnown) {
    return 'Not available'
  }

  return currency(listing.totalPrice, listing.currency)
}

function getSellerRatingLabel(listing: ListingResult) {
  if (listing.sellerFeedbackPercentage === null) {
    return 'Not available'
  }

  return `${listing.sellerFeedbackPercentage.toFixed(1)}%`
}

export function ListingCard({
  listing,
  defaultExpanded = false,
  isSuggested = false,
  isSelected = false,
  onToggleSelection
}: {
  listing: ListingResult
  defaultExpanded?: boolean
  isSuggested?: boolean
  isSelected?: boolean
  onToggleSelection?: () => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [relativeAgeLabel, setRelativeAgeLabel] = useState<string | null>(null)
  const absoluteAgeLabel = getListingAbsoluteAgeLabel(listing)
  const dateLabel = getListingAgeDateLabel(listing) ?? 'Not available'
  const imageSet = buildImageSet(listing)
  const heroImage = imageSet[0] ?? null
  const extraImages = imageSet.slice(1)
  const conditionLabel = listing.condition === 'Unknown' ? 'Not available' : listing.condition
  const formatLabel = formatBuyingOptions(listing.buyingOptions)
  const locationLabel = formatListingLocation(listing.itemLocation) ?? 'Not available'
  const sellerLabel = listing.sellerUsername ?? 'Not available'
  const ageLabel = relativeAgeLabel ?? absoluteAgeLabel

  useEffect(() => {
    setRelativeAgeLabel(getListingRelativeAgeLabel(listing))
  }, [listing])

  return (
    <article className={`listing-card${isSelected ? ' listing-card--selected' : ''}`}>
      <button
        type="button"
        className="listing-card__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="listing-card__media">
          {heroImage ? (
            <img src={heroImage} alt={listing.title} className="listing-card__image" />
          ) : (
            <div className="listing-card__image listing-card__image--placeholder">No image</div>
          )}
        </div>

        <div className="listing-card__content">
          <div className="listing-card__header">
            <div>
              <div className="listing-card__badges">
                {isSuggested ? <span className="listing-badge listing-badge--suggested">Suggested</span> : null}
                {isSelected ? <span className="listing-badge listing-badge--selected">Selected</span> : null}
              </div>
              <h3>{listing.title}</h3>
            </div>
          </div>

          <dl className="listing-card__summary">
            <div>
              <dt>Condition</dt>
              <dd>{conditionLabel}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{Math.round(listing.matchScore * 100)}%</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{getTotalLabel(listing)}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{ageLabel}</dd>
            </div>
          </dl>
        </div>
      </button>

      <div className="listing-card__actions">
        {onToggleSelection ? (
          <button
            type="button"
            className={`button ${isSelected ? 'button--ghost' : 'button--accent'}`}
            onClick={onToggleSelection}
          >
            {isSelected ? 'Remove from comparison' : 'Add to comparison'}
          </button>
        ) : null}

        <a href={listing.itemUrl} target="_blank" rel="noreferrer" className="button button--ghost">
          Open listing
        </a>
      </div>

      {expanded ? (
        <div className="listing-card__body">
          <dl className="listing-card__stats">
            <div>
              <dt>Item price</dt>
              <dd>{currency(listing.price, listing.currency)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{getShippingLabel(listing)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{getTotalLabel(listing)}</dd>
            </div>
            <div>
              <dt>Listed date</dt>
              <dd>{dateLabel}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{ageLabel}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{formatLabel}</dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd>{sellerLabel}</dd>
            </div>
            <div>
              <dt>Seller rating</dt>
              <dd>{getSellerRatingLabel(listing)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{locationLabel}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{conditionLabel}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{Math.round(listing.matchScore * 100)}%</dd>
            </div>
          </dl>

          {extraImages.length > 0 ? (
            <div className="listing-card__gallery">
              {extraImages.map((imageUrl) => (
                <img key={imageUrl} src={imageUrl} alt={listing.title} className="listing-card__gallery-image" />
              ))}
            </div>
          ) : null}

          <details className="listing-card__debug">
            <summary>Debug details</summary>
            <dl className="listing-card__debug-grid">
              <div>
                <dt>Item ID</dt>
                <dd>{listing.itemId}</dd>
              </div>
              <div>
                <dt>Condition ID</dt>
                <dd>{listing.conditionId ?? 'Not available'}</dd>
              </div>
              <div>
                <dt>Raw buying options</dt>
                <dd>{listing.buyingOptions.length > 0 ? listing.buyingOptions.join(', ') : 'Not available'}</dd>
              </div>
              <div>
                <dt>Shipping state</dt>
                <dd>{listing.shippingKnown ? 'Known' : 'Missing'}</dd>
              </div>
            </dl>
          </details>
        </div>
      ) : null}
    </article>
  )
}
