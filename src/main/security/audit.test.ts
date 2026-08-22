import { describe, expect, it } from 'vitest'
import { getAuditStats } from './audit'

describe('Security Audit Manifest', () => {
  it('provides security audit metrics', () => {
    const stats = getAuditStats()
    expect(stats).toHaveProperty('passedChecks')
    expect(stats).toHaveProperty('anomalies')
    expect(typeof stats.passedChecks).toBe('number')
    expect(typeof stats.anomalies).toBe('number')
  })
})
