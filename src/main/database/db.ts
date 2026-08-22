import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { CourseVolumeMapping, CourseVolumeRow, VolumeRow } from '../../preload/types/ipc-types'

let db: Database.Database | null = null

export function initDb(downloadPath: string): void {
  const dbPath = path.join(downloadPath, '.manifest.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS blobs (
      hash TEXT PRIMARY KEY,
      size INTEGER,
      ext TEXT
    );
    CREATE TABLE IF NOT EXISTS lectures (
      course_id INTEGER,
      lecture_id INTEGER,
      hash TEXT,
      PRIMARY KEY (course_id, lecture_id),
      FOREIGN KEY(hash) REFERENCES blobs(hash)
    );
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      reclaimed_bytes INTEGER DEFAULT 0
    );
    INSERT OR IGNORE INTO stats (id, reclaimed_bytes) VALUES (1, 0);
    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY,
      name TEXT,
      root_path TEXT,
      is_available INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS course_volumes (
      course_id INTEGER PRIMARY KEY,
      volume_id TEXT,
      FOREIGN KEY(volume_id) REFERENCES volumes(id)
    );
  `)
}

export function checkBlobExists(hash: string): boolean {
  if (!db) return false
  const row = db.prepare('SELECT 1 FROM blobs WHERE hash = ?').get(hash)
  return !!row
}

export function insertBlob(hash: string, size: number, ext: string): void {
  if (!db) return
  db.prepare('INSERT OR IGNORE INTO blobs (hash, size, ext) VALUES (?, ?, ?)').run(hash, size, ext)
}

export function recordLectureLink(courseId: number, lectureId: number, hash: string): void {
  if (!db) return
  db.prepare('INSERT OR REPLACE INTO lectures (course_id, lecture_id, hash) VALUES (?, ?, ?)').run(
    courseId,
    lectureId,
    hash
  )
}

export function addReclaimedBytes(bytes: number): void {
  if (!db) return
  db.prepare('UPDATE stats SET reclaimed_bytes = reclaimed_bytes + ? WHERE id = 1').run(bytes)
}

export function subtractReclaimedBytes(bytes: number): number {
  if (!db) return 0
  db.prepare('UPDATE stats SET reclaimed_bytes = MAX(0, reclaimed_bytes - ?) WHERE id = 1').run(
    bytes
  )

  const row = db.prepare('SELECT reclaimed_bytes FROM stats WHERE id = 1').get() as {
    reclaimed_bytes: number
  }
  return row ? row.reclaimed_bytes : 0
}

export function getStorageStats(): number {
  if (!db) return 0
  const row = db.prepare('SELECT reclaimed_bytes FROM stats WHERE id = 1').get() as {
    reclaimed_bytes: number
  }
  return row ? row.reclaimed_bytes : 0
}

export function runGarbageCollector(downloadPath: string): {
  purgedCount: number
  freedBytes: number
  newTotalReclaimed: number
} {
  if (!db) return { purgedCount: 0, freedBytes: 0, newTotalReclaimed: 0 }

  const blobsDir = path.join(downloadPath, '.blobs')
  if (!fs.existsSync(blobsDir)) return { purgedCount: 0, freedBytes: 0, newTotalReclaimed: 0 }

  let purgedCount = 0
  let freedBytes = 0

  const files = fs.readdirSync(blobsDir)
  for (const file of files) {
    if (
      file.startsWith('temp_') ||
      file.endsWith('.db') ||
      file.endsWith('.db-wal') ||
      file.endsWith('.db-shm')
    ) {
      continue
    }

    const blobPath = path.join(blobsDir, file)
    const stats = fs.statSync(blobPath)

    if (stats.nlink === 1) {
      freedBytes += stats.size
      purgedCount++

      fs.unlinkSync(blobPath)

      const hash = file.split('.')[0]
      db.prepare('DELETE FROM lectures WHERE hash = ?').run(hash)
      db.prepare('DELETE FROM blobs WHERE hash = ?').run(hash)
    }
  }

  let newTotalReclaimed = 0
  if (freedBytes > 0) {
    newTotalReclaimed = subtractReclaimedBytes(freedBytes)
  } else {
    newTotalReclaimed = getStorageStats()
  }

  return { purgedCount, freedBytes, newTotalReclaimed }
}

/* --- VOLUME MANAGEMENT HELPERS --- */
export function getAllVolumes(): VolumeRow[] {
  if (!db) return []
  return db.prepare('SELECT * FROM volumes').all() as VolumeRow[]
}

export function registerVolume(id: string, name: string, rootPath: string): void {
  if (!db) return
  db.prepare(
    'INSERT OR IGNORE INTO volumes (id, name, root_path, is_available) VALUES (?, ?, ?, 1)'
  ).run(id, name, rootPath)
}

export function unregisterVolume(volumeId: string): void {
  if (!db) return
  const stmt = db.prepare('DELETE FROM volumes WHERE id = ?')
  stmt.run(volumeId)
}

export function updateVolumeStatus(id: string, isAvailable: number): void {
  if (!db) return
  db.prepare('UPDATE volumes SET is_available = ? WHERE id = ?').run(isAvailable, id)
}

export function pinCourseToVolume(courseId: number, volumeId: string): void {
  if (!db) return
  db.prepare('INSERT OR REPLACE INTO course_volumes (course_id, volume_id) VALUES (?, ?)').run(
    courseId,
    volumeId
  )
}

export function unpinCourseFromVolume(courseId: number): void {
  if (!db) return
  db.prepare('DELETE FROM course_volumes WHERE course_id = ?').run(courseId)
}

export function getBlobsForCourse(courseId: number): { hash: string; ext: string }[] {
  if (!db) return []
  return db
    .prepare(
      'SELECT b.hash, b.ext FROM lectures l JOIN blobs b ON l.hash = b.hash WHERE l.course_id = ?'
    )
    .all(courseId) as { hash: string; ext: string }[]
}

export function getCourseVolumeMappings(): Record<number, CourseVolumeMapping> {
  if (!db) return {}
  const rows = db
    .prepare(
      `
    SELECT cv.course_id, v.id as volumeId, v.name, v.is_available, v.root_path
    FROM course_volumes cv
    JOIN volumes v ON cv.volume_id = v.id
  `
    )
    .all() as CourseVolumeRow[]

  const map: Record<number, CourseVolumeMapping> = {}
  for (const row of rows) {
    map[row.course_id] = {
      volumeId: row.volumeId,
      name: row.name,
      isAvailable: row.is_available === 1,
      rootPath: row.root_path
    }
  }
  return map
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
