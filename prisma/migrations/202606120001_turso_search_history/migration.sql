-- CreateTable
CREATE TABLE "ScanRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "selectedCondition" TEXT NOT NULL,
    "storePrice" REAL NOT NULL,
    "sellerShippingCost" REAL NOT NULL,
    "feeRate" REAL NOT NULL,
    "packagingCost" REAL NOT NULL,
    "promotedListingCost" REAL NOT NULL,
    "safetyBuffer" REAL NOT NULL,
    "targetProfit" REAL NOT NULL,
    "estimatedLowPrice" REAL NOT NULL,
    "estimatedMedianPrice" REAL NOT NULL,
    "estimatedHighPrice" REAL NOT NULL,
    "suggestedListPrice" REAL NOT NULL,
    "estimatedProfit" REAL NOT NULL,
    "roi" REAL NOT NULL,
    "confidence" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "listingCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "selectedCondition" TEXT NOT NULL,
    "resultsCondition" TEXT NOT NULL,
    "buyingOptions" TEXT NOT NULL,
    "minPrice" REAL,
    "maxPrice" REAL,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "sort" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "excludeWords" TEXT NOT NULL,
    "minMatchScore" REAL,
    "listingAgeDays" INTEGER,
    "marketplaceId" TEXT,
    "environment" TEXT,
    "totalReturned" INTEGER,
    "excludedCount" INTEGER,
    "fallbackApplied" BOOLEAN NOT NULL DEFAULT false,
    "fallbackReason" TEXT,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "ListingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "shippingCost" REAL NOT NULL,
    "shippingKnown" BOOLEAN NOT NULL DEFAULT false,
    "totalPrice" REAL NOT NULL,
    "conditionLabel" TEXT NOT NULL,
    "conditionId" TEXT,
    "sellerUsername" TEXT,
    "sellerFeedbackPercentage" REAL,
    "itemLocation" JSONB,
    "itemUrl" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "matchScore" REAL NOT NULL,
    "primaryImageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "additionalImageUrls" JSONB,
    "itemCreationDate" TEXT,
    "itemOriginDate" TEXT,
    "itemEndDate" TEXT,
    "buyingOptions" JSONB,
    CONSTRAINT "ListingSnapshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "ScanRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualSoldCompSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "soldPrice" REAL,
    "shippingCost" REAL,
    "conditionLabel" TEXT NOT NULL,
    "soldDate" TEXT,
    "notes" TEXT NOT NULL,
    CONSTRAINT "ManualSoldCompSnapshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "ScanRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SellerConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "singletonKey" TEXT NOT NULL DEFAULT 'default',
    "environment" TEXT NOT NULL,
    "sellerId" TEXT,
    "sellerLabel" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "accessTokenExpiresAt" DATETIME NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "isTokenInvalid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SellerOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "creationDate" DATETIME NOT NULL,
    "lastModifiedDate" DATETIME NOT NULL,
    "orderFulfillmentStatus" TEXT NOT NULL,
    "orderPaymentStatus" TEXT NOT NULL,
    "buyerUsername" TEXT,
    "currency" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "lineItemCount" INTEGER NOT NULL,
    "salesRecordReference" TEXT,
    "rawOrder" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerOrder_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SellerConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_query_idx" ON "SearchLog"("query");

-- CreateIndex
CREATE INDEX "SearchLog_mode_idx" ON "SearchLog"("mode");

-- CreateIndex
CREATE INDEX "ManualSoldCompSnapshot_scanId_displayOrder_idx" ON "ManualSoldCompSnapshot"("scanId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SellerConnection_singletonKey_key" ON "SellerConnection"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "SellerOrder_orderId_key" ON "SellerOrder"("orderId");

-- CreateIndex
CREATE INDEX "SellerOrder_connectionId_creationDate_idx" ON "SellerOrder"("connectionId", "creationDate");

-- CreateIndex
CREATE INDEX "SellerOrder_connectionId_lastModifiedDate_idx" ON "SellerOrder"("connectionId", "lastModifiedDate");

-- CreateIndex
CREATE INDEX "SellerOrder_connectionId_orderFulfillmentStatus_idx" ON "SellerOrder"("connectionId", "orderFulfillmentStatus");

