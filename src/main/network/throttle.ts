import { Transform, TransformCallback } from 'stream'

export class ThrottleStream extends Transform {
  private tokens: number
  private readonly maxTokens: number
  private lastRefill: number
  private readonly bytesPerSecond: number

  constructor(kbps: number) {
    super()
    this.bytesPerSecond = kbps * 1024
    this.maxTokens = this.bytesPerSecond
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    if (this.bytesPerSecond <= 0) {
      this.push(chunk)
      return callback()
    }

    this.refill()
    this.tokens -= chunk.length
    this.push(chunk)

    if (this.tokens < 0) {
      const timeToWait = (-this.tokens / this.bytesPerSecond) * 1000
      setTimeout(() => callback(), timeToWait)
    } else {
      callback()
    }
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const newTokens = (elapsed / 1000) * this.bytesPerSecond

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens)
    this.lastRefill = now
  }
}
