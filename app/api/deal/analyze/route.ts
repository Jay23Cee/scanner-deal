import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { prisma } from '@/lib/db/client'
import { calculateDealMetrics } from '@/lib/deal/calculator'
import { evaluateDeal } from '@/lib/deal/scoring'
import { hasManualSoldCompContent, normalizeManualSoldComp } from '@/lib/manual-sold-comps'
import { analyzeRequestSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = analyzeRequestSchema.parse(await request.json())
    const listings = body.comparisonListings
    if (listings.length === 0) {
      return NextResponse.json({ error: 'No active listings are available to analyze.' }, { status: 400 })
    }

    const metrics = calculateDealMetrics({
      ...body,
      listings
    })
    const verdict = evaluateDeal(metrics, {
      mode: body.mode,
      condition: body.condition,
      targetProfit: body.targetProfit
    })
    const manualSoldComps = body.manualSoldComps
      .map(normalizeManualSoldComp)
      .filter(hasManualSoldCompContent)

    const savedScan = await prisma.scanRecord.create({
      data: {
        mode: body.mode,
        query: body.query.trim(),
        selectedCondition: body.condition,
        storePrice: body.storePrice,
        sellerShippingCost: body.sellerShippingCost,
        feeRate: body.feeRate,
        packagingCost: body.packagingCost,
        promotedListingCost: body.promotedListingCost,
        safetyBuffer: body.safetyBuffer,
        targetProfit: body.targetProfit,
        estimatedLowPrice: metrics.estimatedLowPrice,
        estimatedMedianPrice: metrics.estimatedMedianPrice,
        estimatedHighPrice: metrics.estimatedHighPrice,
        suggestedListPrice: metrics.suggestedListPrice,
        estimatedProfit: metrics.estimatedProfit,
        roi: metrics.roi,
        confidence: verdict.confidence,
        decision: verdict.decision,
        reason: verdict.reason,
        listingCount: metrics.listingCount,
        excludedCount: body.excludedCount ?? 0,
        ...(manualSoldComps.length > 0
          ? {
              manualSoldComps: {
                create: manualSoldComps.map((comp, index) => ({
                  displayOrder: index,
                  title: comp.title,
                  soldPrice: comp.soldPrice,
                  shippingCost: comp.shippingCost,
                  conditionLabel: comp.condition,
                  soldDate: comp.soldDate,
                  notes: comp.notes
                }))
              }
            }
          : {}),
        listings: {
          create: listings.map((listing) => ({
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
            shippingCost: listing.shippingCost,
            shippingKnown: listing.shippingKnown,
            totalPrice: listing.totalPrice,
            conditionLabel: listing.condition,
            conditionId: listing.conditionId,
            sellerUsername: listing.sellerUsername,
            sellerFeedbackPercentage: listing.sellerFeedbackPercentage,
            itemLocation: listing.itemLocation ?? Prisma.JsonNull,
            itemUrl: listing.itemUrl,
            itemId: listing.itemId,
            matchScore: listing.matchScore,
            primaryImageUrl: listing.primaryImageUrl,
            thumbnailUrl: listing.thumbnailUrl,
            additionalImageUrls: listing.additionalImageUrls,
            itemCreationDate: listing.itemCreationDate,
            itemOriginDate: listing.itemOriginDate,
            itemEndDate: listing.itemEndDate,
            buyingOptions: listing.buyingOptions
          }))
        }
      }
    })

    return NextResponse.json({
      scanId: savedScan.id,
      decision: verdict.decision,
      estimatedLowPrice: metrics.estimatedLowPrice,
      estimatedMedianPrice: metrics.estimatedMedianPrice,
      estimatedHighPrice: metrics.estimatedHighPrice,
      suggestedListPrice: metrics.suggestedListPrice,
      estimatedProfit: metrics.estimatedProfit,
      roi: metrics.roi,
      confidence: verdict.confidence,
      reason: verdict.reason,
      listingCount: metrics.listingCount
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request body.' }, { status: 400 })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed.' }, { status: 500 })
  }
}
