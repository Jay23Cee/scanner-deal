import { getCurrentEbayEnvironment } from '@/lib/ebay/auth'
import { ImageSearchFeatureState } from '@/lib/types'

const IMAGE_SEARCH_REQUIRED_ENV_VARS = [
  'EBAY_CLIENT_ID',
  'EBAY_CLIENT_SECRET',
  'EBAY_MARKETPLACE_ID'
] as const
export const IMAGE_SEARCH_UNSUPPORTED_ENVIRONMENT = 'sandbox'

function getMissingImageSearchConfiguration() {
  return IMAGE_SEARCH_REQUIRED_ENV_VARS.filter((envVar) => !process.env[envVar]?.trim())
}

export function getImageSearchFeatureState(): ImageSearchFeatureState {
  const missingConfiguration = getMissingImageSearchConfiguration()

  if (missingConfiguration.length > 0) {
    return {
      status: 'missing_configuration',
      missingConfiguration
    }
  }

  if (getCurrentEbayEnvironment(process.env.EBAY_ENV) === IMAGE_SEARCH_UNSUPPORTED_ENVIRONMENT) {
    return {
      status: 'unsupported_environment',
      missingConfiguration: []
    }
  }

  return {
    status: 'available',
    missingConfiguration: []
  }
}

export function assertImageSearchConfigured() {
  const featureState = getImageSearchFeatureState()

  if (featureState.status === 'missing_configuration') {
    throw new Error(
      `Missing required environment variable(s): ${featureState.missingConfiguration.join(', ')}.`
    )
  }

  if (featureState.status === 'unsupported_environment') {
    throw new Error(
      'Picture search requires EBAY_ENV=production because eBay searchByImage is not supported in sandbox.'
    )
  }
}
