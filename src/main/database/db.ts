import Database from 'better-sqlite3'
import * as path from 'path'

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

export function getStorageStats(): number {
  if (!db) return 0
  const row = db.prepare('SELECT reclaimed_bytes FROM stats WHERE id = 1').get() as {
    reclaimed_bytes: number
  }
  return row ? row.reclaimed_bytes : 0
}
