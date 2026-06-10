import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getAppSecretKey() {
  const secret = process.env.APP_SECRET?.trim()
  if (!secret) {
    throw new Error('Missing required environment variable(s): APP_SECRET.')
  }

  return createHash('sha256').update(secret).digest()
}

export function encryptString(value: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getAppSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptString(value: string) {
  const [ivValue, authTagValue, encryptedValue] = value.split('.')
  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error('Encrypted token value is malformed.')
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getAppSecretKey(),
    Buffer.from(ivValue, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}
