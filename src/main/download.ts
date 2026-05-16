import { net } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import type { ClientRequest } from 'http'

const activeStreams = new Map<
  number,
  { req: ClientRequest; file: fs.WriteStream; filePath: string }
>()

const sanitizeName = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]+/g, '-').trim()
}

export interface DownloadRequest {
  token: string
  downloadPath: string
  videoQuality: string
  courseId: number
  courseTitle: string
  chapterTitle: string
  lectureId: number
  lectureTitle: string
  lectureIndex: number
  type: 'Video' | 'Article' | 'Quiz' | 'File' | 'E-Book'
  timeEstimation?: number
}

interface UdemyAssetResponse {
  asset?: {
    body?: string
    filename?: string
    external_url?: string
    download_urls?: {
      Video?: { file: string; label: string }[]
      File?: { file: string }[]
      'E-Book'?: { file: string }[]
    }
  }
}

export async function processDownload(req: DownloadRequest): Promise<string> {
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

  const apiUrl = `https://www.udemy.com/api-2.0/users/me/subscribed-courses/${req.courseId}/lectures/${req.lectureId}/?fields[lecture]=asset&fields[asset]=@min,download_urls,external_url,body,filename`

  let response: Response | null = null
  let attempt = 0
  const maxAttempts = 3

  while (attempt < maxAttempts) {
    response = await net.fetch(apiUrl, {
      headers: { Authorization: `Bearer ${req.token}` }
    })

    if (response.ok) break

    if (response.status === 429 || response.status >= 500) {
      attempt++
      if (attempt >= maxAttempts)
        throw new Error(`API failed after ${maxAttempts} retries: ${response.status}`)

      await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
      continue
    }

    throw new Error(`Failed to fetch lecture details: ${response.status}`)
  }

  const data = (await response!.json()) as UdemyAssetResponse
  const asset = data.asset

  if (!asset) throw new Error('No asset found for this lecture')

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
      const sortedVideos = [...videoUrls].sort((a, b) => parseInt(b.label) - parseInt(a.label))

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

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath)

    const requestStream = https
      .get(downloadUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Handle redirects if Udemy sends one
          const redirectStream = https
            .get(res.headers.location!, (redirectRes) => {
              redirectRes.pipe(file)
              redirectRes.on('end', () => {
                file.close()
                activeStreams.delete(req.lectureId)
                resolve(filePath)
              })
            })
            .on('error', (err) => {
              file.close()
              activeStreams.delete(req.lectureId)
              reject(err)
            })

          activeStreams.set(req.lectureId, { req: redirectStream, file, filePath })
        } else {
          res.pipe(file)
          res.on('end', () => {
            file.close()
            activeStreams.delete(req.lectureId)
            resolve(filePath)
          })
        }
      })
      .on('error', (err) => {
        file.close()
        activeStreams.delete(req.lectureId)
        fs.unlink(filePath, () => {}) // Delete corrupted file
        reject(err)
      })

    activeStreams.set(req.lectureId, { req: requestStream, file, filePath })
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
  const active = activeStreams.get(lectureId)
  if (active) {
    active.req.destroy()
    active.file.close()

    if (fs.existsSync(active.filePath)) {
      fs.unlinkSync(active.filePath)
    }

    activeStreams.delete(lectureId)
    return true
  }
  return false
}
