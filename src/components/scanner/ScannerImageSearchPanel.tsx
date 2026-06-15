import { useRef, type ChangeEvent, type RefObject } from 'react'
import { ListingSwipeDeck } from '@/components/results/ListingSwipeDeck'
import { SoldCompsButton } from '@/components/scanner/EbaySearchButtons'
import { PictureSearchItem, PictureSearchState } from '@/components/scanner/scannerShared'
import { ImageSearchFeatureState } from '@/lib/types'

type ScannerImageSearchPanelProps = {
  imageSearch: PictureSearchState
  imageSearchFeatureState: ImageSearchFeatureState
  imageSearchUnavailableMessage: string | null
  onImageFilesSelected: (files: File[]) => void
  onImageSearchActiveIndexChange: (index: number) => void
  onFocusImageSession: (sessionId: string) => void
  getImageSessionSoldQuery: (sessionId: string) => string | null
}

const TAKE_PHOTO_INPUT_ID = 'scanner-image-take-photo-input'
const CHOOSE_PHOTO_INPUT_ID = 'scanner-image-choose-photo-input'
const TAKE_PHOTO_BUTTON_ID = 'scanner-image-take-photo-button'
const CHOOSE_PHOTO_BUTTON_ID = 'scanner-image-choose-photo-button'

function formatImageSearchStatus(
  imageSearch: PictureSearchState,
  imageSearchFeatureState: ImageSearchFeatureState
) {
  if (imageSearchFeatureState.status !== 'available') {
    return 'Unavailable'
  }

  if (imageSearch.items.length === 0) {
    return 'Ready for photos'
  }

  if (imageSearch.status === 'processing') {
    const startedCount = imageSearch.items.filter((item) => item.status !== 'queued').length
    return imageSearch.items.length === 1
      ? 'Analyzing picture...'
      : `Analyzing ${Math.max(startedCount, 1)} of ${imageSearch.items.length}`
  }

  if (imageSearch.items.some((item) => item.status === 'ready')) {
    return 'Search added'
  }

  if (imageSearch.items.every((item) => item.status === 'no_match')) {
    return 'No match found'
  }

  if (imageSearch.items.every((item) => item.status === 'error')) {
    return 'Retry photo'
  }

  return 'Batch ready'
}

function openImagePicker(inputRef: RefObject<HTMLInputElement | null>) {
  inputRef.current?.click()
}

function handleImageInputChange(
  event: ChangeEvent<HTMLInputElement>,
  onImageFilesSelected: ScannerImageSearchPanelProps['onImageFilesSelected']
) {
  const files = Array.from(event.currentTarget.files ?? [])
  onImageFilesSelected(files)
  event.currentTarget.value = ''
}

function getItemStatusLabel(item: PictureSearchItem) {
  if (item.status === 'queued') {
    return 'Queued'
  }

  if (item.status === 'uploading') {
    return 'Analyzing'
  }

  if (item.status === 'ready') {
    return 'Search added'
  }

  if (item.status === 'no_match') {
    return 'No match found'
  }

  return 'Needs attention'
}

function getItemHelperText(item: PictureSearchItem) {
  if (item.status === 'queued') {
    return 'Waiting for its turn in this batch.'
  }

  if (item.status === 'uploading') {
    return 'Checking this picture against eBay now.'
  }

  if (item.status === 'ready') {
    return 'The matched search was added to the board below.'
  }

  if (item.status === 'no_match') {
    return 'Retake the photo or switch to keyword or GTIN search if eBay cannot match the image.'
  }

  return 'This photo could not be searched. Try another image or use keyword search above.'
}

function buildBatchSummary(imageSearch: PictureSearchState) {
  if (imageSearch.items.length === 0) {
    return null
  }

  const matchedCount = imageSearch.items.filter((item) => item.status === 'ready').length
  const noMatchCount = imageSearch.items.filter((item) => item.status === 'no_match').length
  const errorCount = imageSearch.items.filter((item) => item.status === 'error').length

  if (imageSearch.status === 'processing') {
    const processedCount = imageSearch.items.filter(
      (item) => item.status !== 'queued' && item.status !== 'uploading'
    ).length
    return `Processing ${processedCount} of ${imageSearch.items.length}. Swipe to review each photo as it finishes.`
  }

  const summaryParts = [
    matchedCount > 0 ? `${matchedCount} matched` : null,
    noMatchCount > 0 ? `${noMatchCount} no match` : null,
    errorCount > 0 ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : null
  ].filter((part): part is string => Boolean(part))

  return summaryParts.length > 0 ? summaryParts.join(' / ') : null
}

export function ScannerImageSearchPanel({
  imageSearch,
  imageSearchFeatureState,
  imageSearchUnavailableMessage,
  onImageFilesSelected,
  onImageSearchActiveIndexChange,
  onFocusImageSession,
  getImageSessionSoldQuery
}: ScannerImageSearchPanelProps) {
  const takePhotoInputRef = useRef<HTMLInputElement | null>(null)
  const choosePhotoInputRef = useRef<HTMLInputElement | null>(null)
  const isImageSearchConfigured = imageSearchFeatureState.status === 'available'
  const isPickerDisabled = !isImageSearchConfigured || imageSearch.status === 'processing'
  const hasPictureResult = imageSearch.items.length > 0
  const batchSummary = buildBatchSummary(imageSearch)

  return (
    <section className="panel panel--subtle scanner-image">
      <div className="panel__split">
        <div>
          <p className="eyebrow">Picture search</p>
          <h3>Use a photo to search eBay listings.</h3>
          <p className="panel__lede">
            Use Take Photo for the camera or Choose Photo for saved images. When eBay finds a
            match, the app adds a ready session with active listings to the board below.
          </p>
        </div>
        <div className="status-chip">
          {formatImageSearchStatus(imageSearch, imageSearchFeatureState)}
        </div>
      </div>

      <div className="scanner-image__picker">
        <div className="scanner-image__picker-actions" role="group" aria-label="Picture source">
          <button
            id={TAKE_PHOTO_BUTTON_ID}
            type="button"
            className="button scanner-image__trigger"
            aria-controls={TAKE_PHOTO_INPUT_ID}
            onClick={() => openImagePicker(takePhotoInputRef)}
            disabled={isPickerDisabled}
          >
            Take Photo
          </button>
          <button
            id={CHOOSE_PHOTO_BUTTON_ID}
            type="button"
            className="button button--ghost scanner-image__trigger"
            aria-controls={CHOOSE_PHOTO_INPUT_ID}
            onClick={() => openImagePicker(choosePhotoInputRef)}
            disabled={isPickerDisabled}
          >
            Choose Photo
          </button>
        </div>
        <input
          ref={takePhotoInputRef}
          id={TAKE_PHOTO_INPUT_ID}
          className="scanner-image__input"
          type="file"
          accept="image/*"
          capture="environment"
          aria-labelledby={TAKE_PHOTO_BUTTON_ID}
          onChange={(event) => handleImageInputChange(event, onImageFilesSelected)}
          disabled={isPickerDisabled}
        />
        <input
          ref={choosePhotoInputRef}
          id={CHOOSE_PHOTO_INPUT_ID}
          className="scanner-image__input"
          type="file"
          accept="image/*"
          multiple
          aria-labelledby={CHOOSE_PHOTO_BUTTON_ID}
          onChange={(event) => handleImageInputChange(event, onImageFilesSelected)}
          disabled={isPickerDisabled}
        />
        <p className="helper-text scanner-image__picker-note">
          Take Photo captures one picture at a time. Choose Photo can select one or more saved
          images. Exact gallery behavior depends on the browser and device.
        </p>
      </div>

      {!isImageSearchConfigured && imageSearchUnavailableMessage ? (
        <p className="status-banner" role="status" aria-live="polite">
          {imageSearchUnavailableMessage}
        </p>
      ) : null}

      {hasPictureResult ? (
        <div className="scanner-image__results">
          {batchSummary ? (
            <p className="status-banner scanner-image__batch-summary" role="status" aria-live="polite">
              {batchSummary}
            </p>
          ) : null}

          <ListingSwipeDeck
            deckId="scanner-image-results"
            sectionLabel="Picture search results"
            itemLabel="photo result"
            items={imageSearch.items}
            activeIndex={imageSearch.activeIndex}
            onActiveIndexChange={onImageSearchActiveIndexChange}
            renderItem={(item, index) => {
              const soldCompsQuery = item.sessionId ? getImageSessionSoldQuery(item.sessionId) : null

              return (
                <div className="scanner-image__preview-card">
                  {item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={
                        item.previewName
                          ? `Preview of ${item.previewName}`
                          : `Selected item preview ${index + 1}`
                      }
                      className="scanner-image__preview"
                    />
                  ) : (
                    <div className="scanner-image__preview scanner-image__preview--placeholder">
                      No preview
                    </div>
                  )}
                  <div className="scanner-image__preview-copy">
                    <div className="scanner-image__preview-meta">
                      <p className="eyebrow">{`Photo ${index + 1}`}</p>
                      <span className="status-chip">{getItemStatusLabel(item)}</span>
                    </div>
                    <strong>{item.previewName || 'Selected image'}</strong>
                    <p className="helper-text">{getItemHelperText(item)}</p>

                    {item.detectedTitle ? (
                      <div className="scanner-image__query">
                        <p className="eyebrow">Detected item</p>
                        <strong>{item.detectedTitle}</strong>
                      </div>
                    ) : null}

                    {item.error ? (
                      <p className="error-banner" role="alert">
                        {item.error}
                      </p>
                    ) : null}

                    {item.status === 'no_match' && item.fallbackMessage ? (
                      <p className="status-banner" role="status" aria-live="polite">
                        {item.fallbackMessage}
                      </p>
                    ) : null}

                    {item.sessionId ? (
                      <div className="scanner-image__actions">
                        {soldCompsQuery ? <SoldCompsButton query={soldCompsQuery} /> : null}
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => onFocusImageSession(item.sessionId!)}
                        >
                          Focus session
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }}
          />
        </div>
      ) : null}
    </section>
  )
}
