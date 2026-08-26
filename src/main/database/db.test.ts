import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  addReclaimedBytes,
  checkBlobExists,
  closeDb,
  getAllVolumes,
  getCourseVolumeMappings,
  getStorageStats,
  initDb,
  insertBlob,
  pinCourseToVolume,
  recordLectureLink,
  registerVolume,
  runGarbageCollector,
  unpinCourseFromVolume
} from './db'

describe('Database & Blob Manifest Engine', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'udeler-db-test-'))
  const blobsDir = path.join(tempDir, '.blobs')

  beforeAll(() => {
    fs.mkdirSync(blobsDir, { recursive: true })
    initDb(tempDir)
  })

  afterAll(() => {
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('inserts and verifies blob existence', () => {
    insertBlob('abc123hash', 1048576, '.mp4')
    expect(checkBlobExists('abc123hash')).toBe(true)
    expect(checkBlobExists('nonexistent')).toBe(false)
  })

  it('tracks storage savings and links lectures', () => {
    recordLectureLink(101, 202, 'abc123hash')
    addReclaimedBytes(5242880) // 5MB
    expect(getStorageStats()).toBe(5242880)
  })

  it('purges orphaned blobs with nlink === 1 during garbage collection', () => {
    const dummyBlob = path.join(blobsDir, 'orphan123.mp4')
    fs.writeFileSync(dummyBlob, 'dummy content')
    insertBlob('orphan123', 13, '.mp4')

    const result = runGarbageCollector(tempDir)
    expect(result.purgedCount).toBe(1)
    expect(fs.existsSync(dummyBlob)).toBe(false)
    expect(checkBlobExists('orphan123')).toBe(false)
  })

  it('handles volume registration and course pinning', () => {
    registerVolume('vol-1', 'External SSD', '/Volumes/SSD')
    const volumes = getAllVolumes()
    expect(volumes.some((v) => v.id === 'vol-1')).toBe(true)

    pinCourseToVolume(101, 'vol-1')
    const mappings = getCourseVolumeMappings()
    expect(mappings[101]).toBeDefined()
    expect(mappings[101].volumeId).toBe('vol-1')

    unpinCourseFromVolume(101)
    const updatedMappings = getCourseVolumeMappings()
    expect(updatedMappings[101]).toBeUndefined()
  })
})
