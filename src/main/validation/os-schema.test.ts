import { describe, expect, it } from 'vitest'
import { OsProgressSchema, RecentCourseSchema, TrayTooltipSchema } from './os-schema'

describe('OS Integration Validation', () => {
  it('validates progress percentage boundaries', () => {
    expect(OsProgressSchema.parse({ progress: 0.5 })).toEqual({ progress: 0.5 })
    expect(OsProgressSchema.parse({ progress: -1 })).toEqual({ progress: -1 })
    expect(() => OsProgressSchema.parse({ progress: 1.5 })).toThrow()
    expect(() => OsProgressSchema.parse({ progress: -2 })).toThrow()
  })

  it('enforces tray tooltip length limits', () => {
    expect(TrayTooltipSchema.parse({ text: 'Active' })).toEqual({ text: 'Active' })
    expect(() => TrayTooltipSchema.parse({ text: 'a'.repeat(256) })).toThrow()
  })

  it('validates recent course structures', () => {
    const payload = { id: 123, title: 'Advanced TypeScript' }
    expect(RecentCourseSchema.parse(payload)).toEqual(payload)
    expect(() => RecentCourseSchema.parse({ id: -1, title: 'Invalid' })).toThrow()
  })
})
