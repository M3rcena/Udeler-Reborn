import * as fs from 'node:fs'
import * as path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppLogger } from '../../shared/logger'

describe('AppLogger Diagnostics System', () => {
  let loggerInstance: AppLogger

  beforeEach(() => {
    loggerInstance = AppLogger.getInstance()
    loggerInstance.clearBuffer()
  })

  it('redacts bearer tokens and secrets from strings', () => {
    const sanitized = loggerInstance.sanitize(
      'Request header Authorization: Bearer abc123secretTokenHere'
    ) as string
    expect(sanitized).toBe('Request header Authorization: Bearer [REDACTED]')
    expect(sanitized).not.toContain('abc123secretTokenHere')
  })

  it('redacts sensitive keys in nested metadata objects', () => {
    const payload = {
      endpoint: '/api/v1/auth',
      access_token: 'secret_token_value',
      headers: {
        cookie: 'session=12345'
      }
    }
    const sanitized = loggerInstance.sanitize(payload) as Record<string, unknown>
    expect(sanitized.access_token).toBe('[REDACTED]')
    expect((sanitized.headers as Record<string, string>).cookie).toBe('[REDACTED]')
  })

  it('records log entries in FIFO order up to buffer limit', () => {
    loggerInstance.info('TEST', 'Event 1')
    loggerInstance.warn('TEST', 'Event 2')
    loggerInstance.error('TEST', 'Event 3')

    const logs = loggerInstance.getRecentLogs()
    expect(logs.length).toBe(3)
    expect(logs[0].message).toBe('Event 1')
    expect(logs[0].level).toBe('INFO')
    expect(logs[2].level).toBe('ERROR')
  })

  it('exports log dump file with metadata header', async () => {
    loggerInstance.info('EXPORT_TEST', 'Diagnostic entry for export verification')
    const testFile = path.resolve(process.cwd(), 'test-export-dump.log')

    const success = await loggerInstance.exportLogs(testFile)
    expect(success).toBe(true)
    expect(fs.existsSync(testFile)).toBe(true)

    const content = fs.readFileSync(testFile, 'utf-8')
    expect(content).toContain('Udeler-Reborn Diagnostic Log Dump')
    expect(content).toContain('Diagnostic entry for export verification')

    fs.unlinkSync(testFile)
  })
})
