import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  decryptFileSync,
  encryptAndWriteFileSync,
  isFileEncrypted,
  VAULT_MAGIC_HEADER
} from './vault'

describe('Vault Encryption Engine', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'udeler-test-'))
  const mockKey = crypto.randomBytes(32)
  const testFile = path.join(tempDir, 'secret.vtt')
  const rawContent = 'WEBVTT\n\n00:00.000 --> 00:05.000\nHello World'

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('encrypts file and appends magic header', () => {
    encryptAndWriteFileSync(testFile, rawContent, mockKey)
    expect(fs.existsSync(testFile)).toBe(true)
    expect(isFileEncrypted(testFile)).toBe(true)

    // Verify magic header is exactly at the start
    const buffer = Buffer.alloc(VAULT_MAGIC_HEADER.length)
    const fd = fs.openSync(testFile, 'r')
    fs.readSync(fd, buffer, 0, VAULT_MAGIC_HEADER.length, 0)
    fs.closeSync(fd)
    expect(buffer.equals(VAULT_MAGIC_HEADER)).toBe(true)
  })

  it('decrypts the file back to original string', () => {
    const decrypted = decryptFileSync(testFile, mockKey)
    expect(decrypted.toString('utf-8')).toBe(rawContent)
  })

  it('throws error when decrypting with wrong key', () => {
    const wrongKey = crypto.randomBytes(32)
    expect(() => decryptFileSync(testFile, wrongKey)).toThrowError()
  })
})
