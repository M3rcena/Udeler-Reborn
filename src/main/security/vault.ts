import { safeStorage } from 'electron'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import { Transform, TransformCallback } from 'node:stream'
import { store } from '../database/store'

export const VAULT_MAGIC_HEADER = Buffer.from('UDLRV4')

/**
 * Retrieves or generates the AES-256 Master Key backed by the OS Keychain.
 */
export function getVaultKey(): Buffer | null {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('OS Keychain encryption is unavailable on this system.')
    return null
  }

  let encryptedKey = store.get('vault_key') as string | undefined

  if (!encryptedKey) {
    const rawKey: Buffer = crypto.randomBytes(32)
    encryptedKey = safeStorage.encryptString(rawKey.toString('hex')).toString('base64')
    store.set('vault_key', encryptedKey)
    return rawKey
  }

  try {
    const rawHex: string = safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'))
    return Buffer.from(rawHex, 'hex')
  } catch (error: unknown) {
    console.error('Failed to decrypt vault master key from OS keychain:', error)
    return null
  }
}

/**
 * Securely encrypts or decrypts small strings (like Udemy auth tokens)
 */
export function encryptToken(token: string): string {
  if (!safeStorage.isEncryptionAvailable()) return token
  return safeStorage.encryptString(token).toString('base64')
}

export function decryptToken(encryptedToken: string): string {
  if (!safeStorage.isEncryptionAvailable()) return encryptedToken
  try {
    return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
  } catch {
    return encryptedToken
  }
}

/**
 * Checks if a file starts with the Vault Magic Header
 */
export function isFileEncrypted(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false
  const buffer: Buffer = Buffer.alloc(VAULT_MAGIC_HEADER.length)
  const fd: number = fs.openSync(filePath, 'r')
  fs.readSync(fd, buffer, 0, VAULT_MAGIC_HEADER.length, 0)
  fs.closeSync(fd)
  return buffer.equals(VAULT_MAGIC_HEADER)
}

/**
 * Synchronously encrypts and writes a small file (used for HTML and VTT files).
 */
export function encryptAndWriteFileSync(
  filePath: string,
  data: string | Buffer,
  key: Buffer
): void {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()
  fs.writeFileSync(filePath, Buffer.concat([VAULT_MAGIC_HEADER, iv, encrypted, authTag]))
}

/**
 * Synchronously reads and decrypts a small file (used for HTML and VTT files).
 */
export function decryptFileSync(filePath: string, key: Buffer): Buffer {
  const fileData = fs.readFileSync(filePath)
  if (fileData.length < 38) throw new Error('File too small to be encrypted')

  const header = fileData.subarray(0, 6)
  if (header.toString() !== 'UDLRV4') return fileData

  const iv = fileData.subarray(6, 22)
  const authTag = fileData.subarray(fileData.length - 16)
  const ciphertext = fileData.subarray(22, fileData.length - 16)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/**
 * Transform Stream to inject the Header and IV before the AES-256-GCM ciphertext,
 * and append the Auth Tag at the very end.
 */
export class VaultEncryptStream extends Transform {
  private cipher: crypto.CipherGCM
  private isHeaderWritten: boolean = false
  private iv: Buffer

  constructor(key: Buffer) {
    super()
    this.iv = crypto.randomBytes(16)
    this.cipher = crypto.createCipheriv('aes-256-gcm', key, this.iv)
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    if (!this.isHeaderWritten) {
      this.push(VAULT_MAGIC_HEADER)
      this.push(this.iv)
      this.isHeaderWritten = true
    }
    const encrypted: Buffer = this.cipher.update(chunk)
    if (encrypted.length > 0) {
      this.push(encrypted)
    }
    callback()
  }

  _flush(callback: TransformCallback): void {
    try {
      if (this.destroyed) return callback()
      const final: Buffer = this.cipher.final()

      if (final.length > 0) this.push(final)
      this.push(this.cipher.getAuthTag())

      callback()
    } catch {
      callback()
    }
  }
}

/**
 * Transform Stream to extract the Header and IV, stream the decryption,
 * and validate the Auth Tag at the end.
 */
export class VaultDecryptStream extends Transform {
  private decipher: crypto.DecipherGCM | null = null
  private key: Buffer
  private headerBuffer: Buffer = Buffer.alloc(0)
  private headerLength: number = VAULT_MAGIC_HEADER.length + 16
  private isInitialized: boolean = false

  private tailBuffer: Buffer = Buffer.alloc(0)

  constructor(key: Buffer) {
    super()
    this.key = key
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    let processBuffer: Buffer

    if (!this.isInitialized) {
      this.headerBuffer = Buffer.concat([this.headerBuffer, chunk])
      if (this.headerBuffer.length >= this.headerLength) {
        const magic: Buffer = this.headerBuffer.subarray(0, VAULT_MAGIC_HEADER.length)
        if (!magic.equals(VAULT_MAGIC_HEADER)) {
          return callback(new Error('Invalid Vault Magic Header'))
        }
        const iv: Buffer = this.headerBuffer.subarray(VAULT_MAGIC_HEADER.length, this.headerLength)
        this.decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv)

        processBuffer = this.headerBuffer.subarray(this.headerLength)
        this.isInitialized = true
      } else {
        return callback()
      }
    } else {
      processBuffer = chunk
    }

    const combined: Buffer = Buffer.concat([this.tailBuffer, processBuffer])
    if (combined.length > 16) {
      const dataToDecrypt: Buffer = combined.subarray(0, combined.length - 16)
      this.tailBuffer = combined.subarray(combined.length - 16)

      try {
        const decrypted: Buffer = this.decipher!.update(dataToDecrypt)
        if (decrypted.length > 0) this.push(decrypted)
      } catch (err: unknown) {
        return callback(err as Error)
      }
    } else {
      this.tailBuffer = combined
    }

    callback()
  }

  _flush(callback: TransformCallback): void {
    try {
      if (this.destroyed) return callback()
      if (!this.decipher) return callback()

      if (this.tailBuffer.length !== 16) return callback()

      this.decipher.setAuthTag(this.tailBuffer)
      const final: Buffer = this.decipher.final()
      if (final.length > 0) this.push(final)
      callback()
    } catch {
      callback()
    }
  }
}
