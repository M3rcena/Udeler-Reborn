import * as crypto from 'crypto'
import { BrowserWindow, net } from 'electron'
import * as fs from 'fs'
import type { ClientRequest, IncomingMessage } from 'http'
import * as https from 'https'
import * as path from 'path'
import { z } from 'zod'
import { DownloadRequest } from '../preload/ipc-types'
import { addReclaimedBytes, checkBlobExists, insertBlob, recordLectureLink } from './database/db'
import { ThrottleStream } from './network/throttle'

const activeStreams = new Map<
  number,
  { req: ClientRequest; file: fs.WriteStream; filePath: string }
>()
const canceledDownloads = new Set<number>()

const sanitizeName = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]+/g, '-').trim()
}

const DownloadUrlSchema = z
  .object({
    file: z.string(),
    label: z.string().optional().nullable()
  })
  .loose()

const CaptionSchema = z
  .object({
    file: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    locale: z.string().optional().nullable(),
    title: z.string().optional().nullable()
  })
  .loose()

const UdemyAssetResponseSchema = z
  .object({
    asset: z
      .object({
        body: z.string().optional().nullable(),
        filename: z.string().optional().nullable(),
        external_url: z.string().optional().nullable(),
        download_urls: z
          .object({
            Video: z.array(DownloadUrlSchema).optional().nullable(),
            File: z.array(DownloadUrlSchema).optional().nullable(),
            'E-Book': z.array(DownloadUrlSchema).optional().nullable()
          })
          .loose()
          .optional()
          .nullable(),
        captions: z.array(CaptionSchema).optional().nullable()
      })
      .loose()
      .optional()
      .nullable(),
    supplementary_assets: z
      .array(
        z
          .object({
            filename: z.string().optional().nullable(),
            download_urls: z
              .object({
                File: z.array(DownloadUrlSchema).optional().nullable()
              })
              .loose()
              .optional()
              .nullable()
          })
          .loose()
      )
      .optional()
      .nullable()
  })
  .loose()

type UdemyAssetResponse = z.infer<typeof UdemyAssetResponseSchema>

function downloadExtraFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve): void => {
    const file = fs.createWriteStream(destPath)
    const requestOptions = { agent: false }

    https
      .get(url, requestOptions, (res): void => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          https
            .get(res.headers.location!, requestOptions, (redirectRes) => {
              redirectRes.pipe(file)
              redirectRes.on('end', (): void => {
                file.close()
                resolve()
              })
            })
            .on('error', (): void => {
              file.close()
              resolve()
            })
        } else {
          res.pipe(file)
          res.on('end', (): void => {
            file.close()
            resolve()
          })
        }
      })
      .on('error', (): void => {
        file.close()
        resolve()
      })
  })
}

export async function processDownload(req: DownloadRequest): Promise<string> {
  canceledDownloads.delete(req.lectureId)

  const minutes = req.timeEstimation ? ` (${Math.ceil(req.timeEstimation / 60)}m)` : ''
  const cleanCourse = sanitizeName(req.courseTitle)
  const cleanChapter = sanitizeName(req.chapterTitle)
  const cleanLecture = `${String(req.lectureIndex).padStart(2, '0')} - ${sanitizeName(req.lectureTitle)}${minutes} [ID_${req.lectureId}]`

  const targetDir = path.join(req.downloadPath, cleanCourse, cleanChapter)

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  if (req.type === 'Quiz') {
    const filePath = path.join(targetDir, `${cleanLecture}.html`)
    const htmlShortcut = `
      <html>
        <head><meta http-equiv="refresh" content="0; url=https://www.udemy.com/course/${req.courseId}/learn/quiz/${req.lectureId}" /></head>
        <body>Redirecting to Udemy Quiz...</body>
      </html>
    `
    fs.writeFileSync(filePath, htmlShortcut)
    return filePath
  }

  const apiUrl = `https://www.udemy.com/api-2.0/users/me/subscribed-courses/${req.courseId}/lectures/${req.lectureId}/?fields[lecture]=asset,supplementary_assets&fields[asset]=@min,download_urls,external_url,body,filename,captions`

  let response: Response | null = null
  let attempt = 0
  const maxAttempts = req.autoRetry ? 5 : 1

  while (attempt < maxAttempts) {
    if (canceledDownloads.has(req.lectureId)) return 'USER_CANCELED'

    response = await net.fetch(apiUrl, {
      headers: { Authorization: `Bearer ${req.token}` }
    })

    if (response.ok) break

    if (response.status === 429 || response.status >= 500) {
      attempt++
      if (attempt >= maxAttempts)
        throw new Error(`API failed after ${maxAttempts} retries: ${response.status}`)

      await new Promise<void>((resolve): void => {
        setTimeout(resolve, attempt * 2000)
      })
      continue
    }

    throw new Error(`Failed to fetch lecture details: ${response.status}`)
  }

  const rawData = await response!.json()
  let data: UdemyAssetResponse

  try {
    data = UdemyAssetResponseSchema.parse(rawData)
  } catch (err) {
    console.error('Zod Parsing Error (Download Asset):', err)
    return 'USER_CANCELED'
  }

  const asset = data.asset

  if (!asset) throw new Error('No asset found for this lecture')
  if (canceledDownloads.has(req.lectureId)) return 'USER_CANCELED'

  if (!req.skipSubtitles && asset.captions && asset.captions.length > 0) {
    for (const cap of asset.captions) {
      if (canceledDownloads.has(req.lectureId)) return 'USER_CANCELED'
      try {
        const subtitleUrl = cap.url || cap.file

        let localeName = cap.locale || cap.title || 'unknown'
        localeName = localeName.replace(/\.vtt$/i, '').replace(/[<>:"/\\|?*]+/g, '-')

        if (!subtitleUrl) {
          console.warn(`No URL found for subtitle: ${localeName}`)
          continue
        }

        const capRes = await net.fetch(subtitleUrl)
        if (capRes.ok) {
          const capText = await capRes.text()
          fs.writeFileSync(path.join(targetDir, `${cleanLecture}_${localeName}.vtt`), capText)
        }
      } catch (err) {
        console.warn(`Failed to download subtitle: ${cap.locale || cap.title}`, err)
      }
    }
  }

  if (!req.skipAttachments && data.supplementary_assets && data.supplementary_assets.length > 0) {
    for (const supp of data.supplementary_assets) {
      if (canceledDownloads.has(req.lectureId)) return 'USER_CANCELED'
      const fileUrl = supp.download_urls?.File?.[0]?.file
      if (fileUrl && supp.filename) {
        await downloadExtraFile(fileUrl, path.join(targetDir, supp.filename))
      }
    }
  }

  if (req.type === 'Article') {
    const filePath = path.join(targetDir, `${cleanLecture}.html`)
    const articleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8"> <title>${req.lectureTitle}</title>
          <style>
            body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
            @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
            img { max-width: 100%; height: auto; border-radius: 8px; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
            @media (prefers-color-scheme: dark) { pre { background: #222; } }
          </style>
        </head>
        <body>
          <h1>${req.lectureTitle}</h1>
          <hr/>
          ${asset.body || '<p>No text content provided.</p>'}
        </body>
        </html>
      `
    fs.writeFileSync(filePath, articleHtml)
    return filePath
  }

  let downloadUrl = ''
  let fileExtension = '.mp4'

  if (asset.download_urls) {
    const videoUrls = asset.download_urls.Video
    if (videoUrls && videoUrls.length > 0) {
      const sortedVideos = [...videoUrls].sort(
        (a, b) => parseInt(b.label || '0') - parseInt(a.label || '0')
      )

      if (req.videoQuality === 'Highest' || req.videoQuality === 'Auto') {
        downloadUrl = sortedVideos[0].file
      } else if (req.videoQuality === 'Lowest') {
        downloadUrl = sortedVideos[sortedVideos.length - 1].file
      } else {
        const exactMatch = sortedVideos.find((v) => v.label === req.videoQuality)
        downloadUrl = exactMatch ? exactMatch.file : sortedVideos[0].file
      }
    } else {
      const otherUrls = asset.download_urls.File || asset.download_urls['E-Book']
      if (otherUrls && otherUrls.length > 0) downloadUrl = otherUrls[0].file
    }
  } else if (asset.external_url) {
    downloadUrl = asset.external_url
  }

  if (asset.filename) {
    fileExtension = path.extname(asset.filename) || fileExtension
  }

  if (!downloadUrl)
    throw new Error('No download URL found for this asset. It might be DRM protected.')

  const filePath = path.join(targetDir, `${cleanLecture}${fileExtension}`)
  const blobsDir = path.join(req.downloadPath, '.blobs')

  if (!fs.existsSync(blobsDir)) {
    fs.mkdirSync(blobsDir, { recursive: true })
  }

  if (canceledDownloads.has(req.lectureId)) return 'USER_CANCELED'

  const tempFilePath = path.join(blobsDir, `temp_${req.lectureId}${fileExtension}`)
  let downloadedBytes = 0
  let fileOptions: { flags: 'w' | 'a' } = { flags: 'w' }

  if (fs.existsSync(tempFilePath)) {
    const stats = fs.statSync(tempFilePath)
    if (stats.size > 0) {
      downloadedBytes = stats.size
      fileOptions = { flags: 'a' }
    }
  } else if (fs.existsSync(filePath)) {
    return filePath
  }

  const hashStream = crypto.createHash('sha256')

  if (downloadedBytes > 0) {
    const existingStream = fs.createReadStream(tempFilePath, { start: 0, end: downloadedBytes - 1 })
    await new Promise<void>((res) => {
      existingStream.on('data', (chunk) => hashStream.update(chunk))
      existingStream.on('end', () => res())
    })
  }

  return new Promise((resolve, reject): void => {
    if (canceledDownloads.has(req.lectureId)) return resolve('USER_CANCELED')

    const requestOptions = {
      agent: false,
      headers: downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {}
    }

    const file = fs.createWriteStream(tempFilePath, fileOptions)

    const attachStreamHandlers = (res: IncomingMessage, totalBytes: number): void => {
      const throttle = new ThrottleStream(req.maxKbps || 0)
      let lastSpeedTime = Date.now()
      let bytesInWindow = 0
      let displaySpeed = 0
      let lastIpcTime = 0

      throttle.on('data', (chunk: Buffer): void => {
        hashStream.update(chunk)
        downloadedBytes += chunk.length
        bytesInWindow += chunk.length

        const now = Date.now()
        if (now - lastSpeedTime >= 1000) {
          displaySpeed = (bytesInWindow / (now - lastSpeedTime)) * 1000
          bytesInWindow = 0
          lastSpeedTime = now
        }

        const isFinished = downloadedBytes === totalBytes
        if (now - lastIpcTime >= 250 || isFinished) {
          const percentage = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0
          const mainWindow = BrowserWindow.getAllWindows()[0]
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
              lectureId: req.lectureId,
              percentage,
              speed: displaySpeed
            })
          }
          lastIpcTime = now
        }
      })

      res.pipe(throttle).pipe(file)

      res.on('error', (err: Error): void => {
        throttle.destroy()
        file.close()
        activeStreams.delete(req.lectureId)
        if (err.message === 'USER_PAUSED') resolve('USER_PAUSED')
        else if (err.message === 'USER_CANCELED') resolve('USER_CANCELED')
        else {
          fs.unlink(tempFilePath, (): void => {})
          reject(err)
        }
      })

      res.on('end', (): void => {
        file.close()
        activeStreams.delete(req.lectureId)

        const finalHash = hashStream.digest('hex')
        const blobPath = path.join(blobsDir, finalHash + fileExtension)

        if (checkBlobExists(finalHash) && fs.existsSync(blobPath)) {
          const tempStats = fs.statSync(tempFilePath)
          addReclaimedBytes(tempStats.size)
          fs.unlinkSync(tempFilePath)
        } else {
          fs.renameSync(tempFilePath, blobPath)
          const blobStats = fs.statSync(blobPath)
          insertBlob(finalHash, blobStats.size, fileExtension)
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        fs.linkSync(blobPath, filePath)
        recordLectureLink(req.courseId, req.lectureId, finalHash)

        resolve(filePath)
      })
    }

    const requestStream = https
      .get(downloadUrl, requestOptions, (res): void => {
        if (res.statusCode === 200 && downloadedBytes > 0) {
          downloadedBytes = 0
          fs.truncateSync(tempFilePath, 0)
        }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10) + downloadedBytes

        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectStream = https
            .get(res.headers.location!, requestOptions, (redirectRes): void => {
              if (redirectRes.statusCode === 200 && downloadedBytes > 0) {
                downloadedBytes = 0
                fs.truncateSync(tempFilePath, 0)
              }
              const redirectTotalBytes =
                parseInt(redirectRes.headers['content-length'] || '0', 10) + downloadedBytes
              attachStreamHandlers(redirectRes, redirectTotalBytes)
            })
            .on('error', (err: Error): void => {
              file.close()
              activeStreams.delete(req.lectureId)
              if (err.message === 'USER_PAUSED') resolve('USER_PAUSED')
              else if (err.message === 'USER_CANCELED') resolve('USER_CANCELED')
              else {
                fs.unlink(tempFilePath, (): void => {})
                reject(err)
              }
            })
          activeStreams.set(req.lectureId, { req: redirectStream, file, filePath: tempFilePath })
        } else {
          attachStreamHandlers(res, totalBytes)
        }
      })
      .on('error', (err: Error): void => {
        file.close()
        activeStreams.delete(req.lectureId)
        if (err.message === 'USER_PAUSED') resolve('USER_PAUSED')
        else if (err.message === 'USER_CANCELED') resolve('USER_CANCELED')
        else {
          fs.unlink(tempFilePath, (): void => {})
          reject(err)
        }
      })

    activeStreams.set(req.lectureId, { req: requestStream, file, filePath: tempFilePath })
  })
}

export function scanExistingDownloads(
  downloadPath: string,
  courseTitle: string
): Record<number, string> {
  const syncMap: Record<number, string> = {}

  const cleanCourse = courseTitle.replace(/[<>:"/\\|?*]+/g, '-').trim()
  const courseFullPath = path.join(downloadPath, cleanCourse)

  if (!fs.existsSync(courseFullPath)) {
    return syncMap
  }

  const chapters = fs.readdirSync(courseFullPath)
  for (const chapter of chapters) {
    const chapterPath = path.join(courseFullPath, chapter)
    if (fs.statSync(chapterPath).isDirectory()) {
      const files = fs.readdirSync(chapterPath)
      for (const file of files) {
        // Regex to look for "[ID_XXXXXX]" right before the file extension
        const match = file.match(/\[ID_(\d+)\]\.[^.]+$/)
        if (match) {
          const id = parseInt(match[1], 10)
          if (!isNaN(id)) {
            syncMap[id] = 'success'
          }
        }
      }
    }
  }

  return syncMap
}

export function cancelDownload(lectureId: number): boolean {
  canceledDownloads.add(lectureId)

  const active = activeStreams.get(lectureId)
  if (active) {
    active.req.destroy(new Error('USER_CANCELED'))
    active.file.close()

    if (fs.existsSync(active.filePath)) {
      fs.unlinkSync(active.filePath)
    }

    activeStreams.delete(lectureId)
    return true
  }
  return false
}

export function pauseDownload(lectureId: number): boolean {
  const active = activeStreams.get(lectureId)
  if (active) {
    active.req.destroy(new Error('USER_PAUSED'))
    active.file.close()
    activeStreams.delete(lectureId)
    return true
  }
  return false
}

export function deleteLectureFile(
  downloadPath: string,
  courseTitle: string,
  lectureId: number
): boolean {
  const cleanCourse = courseTitle.replace(/[<>:"/\\|?*]+/g, '-').trim()
  const courseFullPath = path.join(downloadPath, cleanCourse)

  if (!fs.existsSync(courseFullPath)) return false

  const chapters = fs.readdirSync(courseFullPath)
  for (const chapter of chapters) {
    const chapterPath = path.join(courseFullPath, chapter)
    if (fs.statSync(chapterPath).isDirectory()) {
      const files = fs.readdirSync(chapterPath)
      for (const file of files) {
        const match = file.match(/\[ID_(\d+)\]\.[^.]+$/)
        if (match && parseInt(match[1], 10) === lectureId) {
          fs.unlinkSync(path.join(chapterPath, file))
          return true
        }
      }
    }
  }
  return false
}
