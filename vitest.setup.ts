import { afterAll } from 'vitest'

process.env.DATABASE_URL ??= 'file:./dev.db'
process.env.EBAY_MARKETPLACE_ID ??= 'EBAY_US'
process.env.EBAY_RU_NAME ??= 'test-runame'
process.env.APP_SECRET ??= 'test-app-secret'

afterAll(async () => {
  const { prisma } = await import('@/lib/db/client')
  await prisma.$disconnect()
})
