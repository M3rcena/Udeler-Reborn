import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { LogEntry, LogLevel } from './types'

export class AppLogger {
  private static instance: AppLogger
  private ringBuffer: LogEntry[] = []
  private readonly maxBufferSize: number = 2000
  private logFilePath: string = ''

  private constructor() {
    this.initFilePath()
    this.interceptConsole()
  }

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger()
    }
    return AppLogger.instance
  }

  private initFilePath(): void {
    try {
      if (app?.getPath) {
        const logsDir = path.join(app.getPath('userData'), 'logs')
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true })
        }
        const dateStr = new Date().toISOString().slice(0, 10)
        this.logFilePath = path.join(logsDir, `udeler-${dateStr}.log`)
        return
      }
    } catch {
      // Fallback for tests or before app is ready
    }
    this.logFilePath = path.resolve(process.cwd(), 'udeler-debug.log')
  }

  private interceptConsole(): void {
    const originalError = console.error
    console.error = (...args: unknown[]): void => {
      const message = args
        .map((arg) => (typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg)))
        .join(' ')
      this.error('CONSOLE', message)
      originalError(...args)
    }

    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (err: Error) => {
        this.error('CRASH_UNCAUGHT', err.message, { stack: err.stack })
      })
      process.on('unhandledRejection', (reason: unknown) => {
        this.error('CRASH_REJECTION', String(reason))
      })
    }
  }

  public sanitize(data: unknown): unknown {
    if (typeof data === 'string') {
      return data
        .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
        .replace(/(access_token|token|password|secret|cookie)=([^&;\s]+)/gi, '$1=[REDACTED]')
    }
    if (typeof data === 'object' && data !== null) {
      const copy: Record<string, unknown> = Array.isArray(data)
        ? ([] as unknown as Record<string, unknown>)
        : {}
      for (const [key, value] of Object.entries(data)) {
        if (/token|password|secret|cookie|authorization/i.test(key)) {
          copy[key] = '[REDACTED]'
        } else {
          copy[key] = this.sanitize(value)
        }
      }
      return copy
    }
    return data
  }

  public log(
    level: LogLevel,
    subsystem: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      message: typeof message === 'string' ? (this.sanitize(message) as string) : String(message),
      context: context ? (this.sanitize(context) as Record<string, unknown>) : undefined
    }

    this.ringBuffer.push(entry)
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift()
    }

    const formatted = `[${entry.timestamp}] [${entry.level}] [${entry.subsystem}] ${entry.message} ${
      entry.context ? JSON.stringify(entry.context) : ''
    }\n`

    if (process.env.NODE_ENV === 'development') {
      process.stdout.write(formatted)
    }

    if (this.logFilePath) {
      fs.appendFile(this.logFilePath, formatted, () => {})
    }
  }

  public debug(subsystem: string, message: string, context?: Record<string, unknown>): void {
    this.log('DEBUG', subsystem, message, context)
  }

  public info(subsystem: string, message: string, context?: Record<string, unknown>): void {
    this.log('INFO', subsystem, message, context)
  }

  public warn(subsystem: string, message: string, context?: Record<string, unknown>): void {
    this.log('WARN', subsystem, message, context)
  }

  public error(subsystem: string, message: string, context?: Record<string, unknown>): void {
    this.log('ERROR', subsystem, message, context)
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.ringBuffer]
  }

  public clearBuffer(): void {
    this.ringBuffer = []
  }

  public async exportLogs(targetPath: string): Promise<boolean> {
    try {
      const header = [
        `=== Udeler-Reborn Diagnostic Log Dump ===`,
        `Generated: ${new Date().toISOString()}`,
        `Platform: ${process.platform} (${process.arch})`,
        `Node: ${process.version}`,
        `=========================================\n\n`
      ].join('\n')

      const entries = this.ringBuffer
        .map(
          (e) =>
            `[${e.timestamp}] [${e.level}] [${e.subsystem}] ${e.message} ${e.context ? JSON.stringify(e.context) : ''}`
        )
        .join('\n')

      await fs.promises.writeFile(targetPath, header + entries, 'utf-8')
      return true
    } catch {
      return false
    }
  }
}

export const logger = AppLogger.getInstance()
