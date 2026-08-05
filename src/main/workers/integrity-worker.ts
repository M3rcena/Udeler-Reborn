import Database from 'better-sqlite3'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { parentPort, workerData } from 'worker_threads'
import { VAULT_MAGIC_HEADER } from '../security/vault'

import type { IntegrityIssue } from '../../preload/types/ipc-types'

const { downloadPath, vaultKey } = workerData

function hashFileStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')

    const fd = fs.openSync(filePath, 'r')
    const header = Buffer.alloc(VAULT_MAGIC_HEADER.length)
    let bytesRead = 0
    try {
      bytesRead = fs.readSync(fd, header, 0, VAULT_MAGIC_HEADER.length, 0)
    } catch (e) {
      fs.closeSync(fd)
      return reject(e)
    }
    fs.closeSync(fd)

    const isEncrypted = bytesRead === VAULT_MAGIC_HEADER.length && header.equals(VAULT_MAGIC_HEADER)

    const stream = fs.createReadStream(filePath)

    if (isEncrypted && vaultKey) {
      const keyBuffer = Buffer.from(vaultKey)
      let headerBuffer = Buffer.alloc(0)
      let decipher: crypto.DecipherGCM | null = null
      let isInitialized = false
      let tailBuffer = Buffer.alloc(0)

      stream.on('data', (chunk: Buffer) => {
        let processBuffer: Buffer
        if (!isInitialized) {
          headerBuffer = Buffer.concat([headerBuffer, chunk])
          if (headerBuffer.length >= 22) {
            const iv = headerBuffer.subarray(6, 22)
            decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
            processBuffer = headerBuffer.subarray(22)
            isInitialized = true
          } else {
            return
          }
        } else {
          processBuffer = chunk
        }

        const combined = Buffer.concat([tailBuffer, processBuffer])
        if (combined.length > 16) {
          const dataToDecrypt = combined.subarray(0, combined.length - 16)
          tailBuffer = combined.subarray(combined.length - 16)
          try {
            const decrypted = decipher!.update(dataToDecrypt)
            if (decrypted.length > 0) {
              hash.update(decrypted)
            }
          } catch (err) {
            stream.destroy()
            reject(err)
          }
        } else {
          tailBuffer = combined
        }
      })

      stream.on('end', () => {
        if (decipher && tailBuffer.length === 16) {
          try {
            decipher.setAuthTag(tailBuffer)
            const final = decipher.final()
            if (final.length > 0) {
              hash.update(final)
            }
            resolve(hash.digest('hex'))
          } catch (err) {
            reject(err)
          }
        } else {
          reject(new Error('File truncated or missing Auth Tag'))
        }
      })
      stream.on('error', reject)
    } else {
      stream.on('data', (chunk) => {
        hash.update(chunk)
      })
      stream.on('end', () => {
        resolve(hash.digest('hex'))
      })
      stream.on('error', reject)
    }
  })
}

async function runScan(): Promise<void> {
  if (!fs.existsSync(downloadPath)) {
    parentPort?.postMessage({ type: 'done', issues: [] })
    return
  }

  const dbPath = path.join(downloadPath, '.manifest.db')
  if (!fs.existsSync(dbPath)) {
    parentPort?.postMessage({ type: 'done', issues: [] })
    return
  }

  const db = new Database(dbPath, { readonly: true })
  const expectedLectures = db
    .prepare(
      'SELECT l.lecture_id, l.hash, b.size, b.ext FROM lectures l JOIN blobs b ON l.hash = b.hash'
    )
    .all() as { lecture_id: number; hash: string; size: number; ext: string }[]

  const lectureMap = new Map(expectedLectures.map((l) => [l.lecture_id, l]))
  const issues: IntegrityIssue[] = []

  let scanned = 0
  let totalFiles = 0

  const courses = fs.readdirSync(downloadPath)
  for (const course of courses) {
    const coursePath = path.join(downloadPath, course)
    if (!fs.statSync(coursePath).isDirectory()) continue

    const chapters = fs.readdirSync(coursePath)
    for (const chapter of chapters) {
      const chapterPath = path.join(coursePath, chapter)
      if (fs.statSync(chapterPath).isDirectory()) {
        totalFiles += fs.readdirSync(chapterPath).filter((f) => f.match(/\[ID_(\d+)\]/)).length
      }
    }
  }

  for (const course of courses) {
    const coursePath = path.join(downloadPath, course)
    if (!fs.statSync(coursePath).isDirectory()) continue

    const chapters = fs.readdirSync(coursePath)
    for (const chapter of chapters) {
      const chapterPath = path.join(coursePath, chapter)
      if (!fs.statSync(chapterPath).isDirectory()) continue

      const isArchived = chapter.toLowerCase().includes('archived')
      const files = fs.readdirSync(chapterPath)

      for (const file of files) {
        const match = file.match(/\[ID_(\d+)\]/)
        if (!match) continue

        const lectureId = parseInt(match[1], 10)
        const filePath = path.join(chapterPath, file)
        const expected = lectureMap.get(lectureId)

        if (expected && file.endsWith(expected.ext)) {
          scanned++
          parentPort?.postMessage({
            type: 'progress',
            data: { scanned, total: totalFiles, currentFile: file, issuesFound: issues.length }
          })

          const stats = fs.statSync(filePath)
          if (stats.size !== expected.size) {
            issues.push({
              lectureId,
              courseTitle: course,
              chapterTitle: chapter,
              fileName: file,
              filePath,
              status: isArchived ? 'archived_corrupted' : 'size_mismatch',
              expectedHash: expected.hash
            })
            continue
          }

          const actualHash = await hashFileStream(filePath)
          if (actualHash !== expected.hash) {
            issues.push({
              lectureId,
              courseTitle: course,
              chapterTitle: chapter,
              fileName: file,
              filePath,
              status: isArchived ? 'archived_corrupted' : 'hash_mismatch',
              expectedHash: expected.hash
            })
          }
        }
      }
    }
  }

  db.close()
  parentPort?.postMessage({ type: 'done', issues })
}

runScan().catch((err) => {
  parentPort?.postMessage({ type: 'error', error: err.message })
})
