/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { ThrottleStream } from './throttle'

describe('ThrottleStream', () => {
  it('passes data immediately when kbps limit is 0 (unlimited)', () => {
    return new Promise<void>((resolve, reject) => {
      const throttle = new ThrottleStream(0)
      const chunk = Buffer.alloc(1024 * 50) // 50KB
      const start = Date.now()

      throttle.on('data', (receivedChunk: Buffer) => {
        expect(receivedChunk.length).toBe(chunk.length)
        const duration = Date.now() - start
        expect(duration).toBeLessThan(100)
        resolve()
      })

      throttle.on('error', reject)
      throttle.write(chunk)
    })
  })

  it('initializes tokens correctly based on kbps', () => {
    const throttle = new ThrottleStream(100) // 100 KB/s
    // @ts-expect-error accessing private property for test verification
    expect(throttle.maxTokens).toBe(100 * 1024)
  })
})
