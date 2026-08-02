import Database from 'better-sqlite3'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { parentPort, workerData } from 'worker_threads'
import { IntegrityIssue } from '../preload/ipc-types'

const { downloadPath } = workerData

function hashFileStream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
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
  console.error('Integrity Worker Error:', err)
  parentPort?.postMessage({ type: 'error', error: err.message })
})
