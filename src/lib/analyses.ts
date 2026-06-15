import { prisma } from '@/lib/db/client'
import { ListingResult, ManualSoldComp, ScanDetail, ScanSummary } from '@/lib/types'

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

function mapStoredListing(listing: {
  title: string
  price: number
  currency: string
  shippingCost: number
  shippingKnown: boolean
  totalPrice: number
  conditionLabel: string
  conditionId: string | null
  sellerUsername: string | null
  sellerFeedbackPercentage: number | null
  itemLocation: unknown
  itemUrl: string
  itemId: string
  matchScore: number
  primaryImageUrl: string | null
  thumbnailUrl: string | null
  additionalImageUrls: unknown
  itemCreationDate: string | null
  itemOriginDate: string | null
  itemEndDate: string | null
  buyingOptions: unknown
}): ListingResult {
  return {
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    shippingCost: listing.shippingCost,
    shippingKnown: listing.shippingKnown,
    totalPrice: listing.totalPrice,
    condition: listing.conditionLabel,
    conditionId: listing.conditionId,
    sellerUsername: listing.sellerUsername,
    sellerFeedbackPercentage: listing.sellerFeedbackPercentage,
    itemLocation:
      listing.itemLocation && typeof listing.itemLocation === 'object'
        ? {
            city:
              'city' in listing.itemLocation && typeof listing.itemLocation.city === 'string'
                ? listing.itemLocation.city
                : null,
            stateOrProvince:
              'stateOrProvince' in listing.itemLocation &&
              typeof listing.itemLocation.stateOrProvince === 'string'
                ? listing.itemLocation.stateOrProvince
                : null,
            country:
              'country' in listing.itemLocation && typeof listing.itemLocation.country === 'string'
                ? listing.itemLocation.country
                : null,
            postalCode:
              'postalCode' in listing.itemLocation && typeof listing.itemLocation.postalCode === 'string'
                ? listing.itemLocation.postalCode
                : null
          }
        : null,
    itemUrl: listing.itemUrl,
    itemId: listing.itemId,
    matchScore: listing.matchScore,
    primaryImageUrl: listing.primaryImageUrl,
    thumbnailUrl: listing.thumbnailUrl,
    additionalImageUrls: parseStringArray(listing.additionalImageUrls),
    itemCreationDate: listing.itemCreationDate,
    itemOriginDate: listing.itemOriginDate,
    itemEndDate: listing.itemEndDate,
    buyingOptions: parseStringArray(listing.buyingOptions)
  }
}

function mapStoredManualSoldComp(comp: {
  title: string
  soldPrice: number | null
  shippingCost: number | null
  conditionLabel: string
  soldDate: string | null
  notes: string
}): ManualSoldComp {
  return {
    title: comp.title,
    soldPrice: comp.soldPrice,
    shippingCost: comp.shippingCost,
    condition: comp.conditionLabel,
    soldDate: comp.soldDate,
    notes: comp.notes
  }
}

export async function getRecentScans(limit = 50): Promise<ScanSummary[]> {
  return prisma.scanRecord.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      query: true,
      mode: true,
      selectedCondition: true,
      storePrice: true,
      estimatedProfit: true,
      roi: true,
      confidence: true,
      decision: true,
      reason: true,
      listingCount: true,
      estimatedLowPrice: true,
      estimatedMedianPrice: true,
      estimatedHighPrice: true
    }
  }) as Promise<ScanSummary[]>
}

export async function getScanById(scanId: string): Promise<ScanDetail | null> {
  const scan = await prisma.scanRecord.findUnique({
    where: {
      id: scanId
    },
    select: {
      id: true,
      createdAt: true,
      query: true,
      soldSearchQuery: true,
      mode: true,
      selectedCondition: true,
      storePrice: true,
      sellerShippingCost: true,
      feeRate: true,
      packagingCost: true,
      promotedListingCost: true,
      safetyBuffer: true,
      targetProfit: true,
      estimatedLowPrice: true,
      estimatedMedianPrice: true,
      estimatedHighPrice: true,
      suggestedListPrice: true,
      estimatedProfit: true,
      roi: true,
      confidence: true,
      decision: true,
      reason: true,
      listingCount: true,
      excludedCount: true,
      manualSoldComps: {
        orderBy: {
          displayOrder: 'asc'
        },
        select: {
          title: true,
          soldPrice: true,
          shippingCost: true,
          conditionLabel: true,
          soldDate: true,
          notes: true
        }
      },
      listings: {
        orderBy: {
          matchScore: 'desc'
        },
        select: {
          title: true,
          price: true,
          currency: true,
          shippingCost: true,
          shippingKnown: true,
          totalPrice: true,
          conditionLabel: true,
          conditionId: true,
          sellerUsername: true,
          sellerFeedbackPercentage: true,
          itemLocation: true,
          itemUrl: true,
          itemId: true,
          matchScore: true,
          primaryImageUrl: true,
          thumbnailUrl: true,
          additionalImageUrls: true,
          itemCreationDate: true,
          itemOriginDate: true,
          itemEndDate: true,
          buyingOptions: true
        }
      }
    }
  })

  if (!scan) {
    return null
  }

  return {
    id: scan.id,
    createdAt: scan.createdAt,
    query: scan.query,
    soldSearchQuery: scan.soldSearchQuery,
    mode: scan.mode as ScanSummary['mode'],
    selectedCondition: scan.selectedCondition as ScanSummary['selectedCondition'],
    storePrice: scan.storePrice,
    sellerShippingCost: scan.sellerShippingCost,
    feeRate: scan.feeRate,
    packagingCost: scan.packagingCost,
    promotedListingCost: scan.promotedListingCost,
    safetyBuffer: scan.safetyBuffer,
    targetProfit: scan.targetProfit,
    estimatedLowPrice: scan.estimatedLowPrice,
    estimatedMedianPrice: scan.estimatedMedianPrice,
    estimatedHighPrice: scan.estimatedHighPrice,
    suggestedListPrice: scan.suggestedListPrice,
    estimatedProfit: scan.estimatedProfit,
    roi: scan.roi,
    confidence: scan.confidence as ScanSummary['confidence'],
    decision: scan.decision as ScanSummary['decision'],
    reason: scan.reason,
    listingCount: scan.listingCount,
    excludedCount: scan.excludedCount,
    manualSoldComps: scan.manualSoldComps.map(mapStoredManualSoldComp),
    listings: scan.listings.map(mapStoredListing)
  }
}
