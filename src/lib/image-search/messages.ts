import { ImageSearchFeatureState } from '@/lib/types'

export function getImageSearchUnavailableMessage(featureState: ImageSearchFeatureState) {
  if (featureState.status === 'unsupported_environment') {
    return 'Picture search requires EBAY_ENV=production because eBay image search is not available in sandbox. Use keyword search above in the meantime.'
  }

  if (featureState.status === 'missing_configuration') {
    return `Picture search is unavailable until ${featureState.missingConfiguration.join(', ')} is configured. Use keyword search above in the meantime.`
  }

  return null
}
