import { getCurrentEbayEnvironment, getEbayCredentialEnvVarNames } from '@/lib/ebay/auth'
import { ImageSearchFeatureState } from '@/lib/types'

export const IMAGE_SEARCH_UNSUPPORTED_ENVIRONMENT = 'sandbox'

function getImageSearchRequiredEnvVars() {
  const credentialEnvVars = getEbayCredentialEnvVarNames()

  return [
    credentialEnvVars.clientIdVarName,
    credentialEnvVars.clientSecretVarName,
    'EBAY_MARKETPLACE_ID'
  ] as const
}

function getMissingImageSearchConfiguration() {
  return getImageSearchRequiredEnvVars().filter((envVar) => !process.env[envVar]?.trim())
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
