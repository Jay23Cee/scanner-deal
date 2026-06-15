import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined
}

function createPrismaClient() {
  const log: ('warn' | 'error')[] =
    process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim()

  if (tursoUrl || tursoAuthToken) {
    if (!tursoUrl || !tursoAuthToken) {
      throw new Error(
        'Both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required when using Turso.'
      )
    }

    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: tursoAuthToken
    })

    return new PrismaClient({ adapter, log })
  }

  return new PrismaClient({ log })
}

export const prisma =
  global.__prisma__ ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma
}
