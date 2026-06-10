import { PictureSearchState } from '@/components/scanner/scannerShared'
import { ImageSearchFeatureState } from '@/lib/types'

type ScannerImageSearchPanelProps = {
  imageSearch: PictureSearchState
  imageSearchFeatureState: ImageSearchFeatureState
  imageSearchUnavailableMessage: string | null
  onImageFileSelected: (file: File | null) => void
}

function formatImageSearchStatus(
  imageSearch: PictureSearchState,
  imageSearchFeatureState: ImageSearchFeatureState
) {
  if (imageSearchFeatureState.status !== 'available') {
    return 'Unavailable'
  }

  if (imageSearch.status === 'uploading') {
    return 'Analyzing picture...'
  }

  if (imageSearch.status === 'error') {
    return 'Retry photo'
  }

  if (imageSearch.detectedTitle) {
    return 'Search added'
  }

  if (imageSearch.fallbackMessage) {
    return 'No match found'
  }

  return 'Ready for photo'
}

export function ScannerImageSearchPanel({
  imageSearch,
  imageSearchFeatureState,
  imageSearchUnavailableMessage,
  onImageFileSelected
}: ScannerImageSearchPanelProps) {
  const isImageSearchConfigured = imageSearchFeatureState.status === 'available'
  const hasPictureResult =
    imageSearch.status !== 'idle' ||
    Boolean(imageSearch.previewUrl) ||
    Boolean(imageSearch.previewName) ||
    Boolean(imageSearch.detectedTitle) ||
    Boolean(imageSearch.fallbackMessage) ||
    Boolean(imageSearch.error)

  return (
    <section className="panel panel--subtle scanner-image">
      <div className="panel__split">
        <div>
          <p className="eyebrow">Picture search</p>
          <h3>Use a photo to search eBay listings.</h3>
          <p className="panel__lede">
            Upload a picture or take one on mobile. When eBay finds a match, the app adds a ready
            session with active listings to the board below.
          </p>
        </div>
        <div className="status-chip">
          {formatImageSearchStatus(imageSearch, imageSearchFeatureState)}
        </div>
      </div>

      <label className="scanner-image__picker">
        Take or upload picture
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null
            onImageFileSelected(file)
            event.currentTarget.value = ''
          }}
          disabled={!isImageSearchConfigured || imageSearch.status === 'uploading'}
        />
      </label>

      {!isImageSearchConfigured && imageSearchUnavailableMessage ? (
        <p className="status-banner" role="status" aria-live="polite">
          {imageSearchUnavailableMessage}
        </p>
      ) : null}

      {hasPictureResult ? (
        <div className="scanner-image__results">
          {imageSearch.previewUrl ? (
            <div className="scanner-image__preview-card">
              <img
                src={imageSearch.previewUrl}
                alt={
                  imageSearch.previewName
                    ? `Preview of ${imageSearch.previewName}`
                    : 'Selected item preview'
                }
                className="scanner-image__preview"
              />
              <div>
                <strong>{imageSearch.previewName ?? 'Selected image'}</strong>
                <p className="helper-text">
                  {imageSearch.detectedTitle
                    ? 'The matched search was added to the board below. Refine the search words there before opening eBay.'
                    : 'Retake the photo or switch to keyword or GTIN search if eBay cannot match the image.'}
                </p>
              </div>
            </div>
          ) : null}

          {imageSearch.detectedTitle ? (
            <div className="scanner-image__query">
              <p className="eyebrow">Detected item</p>
              <strong>{imageSearch.detectedTitle}</strong>
            </div>
          ) : null}

          {imageSearch.error ? (
            <p className="error-banner" role="alert">
              {imageSearch.error}
            </p>
          ) : null}

          {imageSearch.fallbackMessage ? (
            <p className="status-banner" role="status" aria-live="polite">
              {imageSearch.fallbackMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
