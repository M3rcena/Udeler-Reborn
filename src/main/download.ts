import { net } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'

const sanitizeName = (name: string): string => {
  return name.replace(/[<>:"/\\|?*]+/g, '-').trim()
}

export interface DownloadRequest {
  token: string
  downloadPath: string
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
      Video?: { file: string }[]
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

  const response = await net.fetch(apiUrl, {
    headers: { Authorization: `Bearer ${req.token}` }
  })

  if (!response.ok) throw new Error(`Failed to fetch lecture details: ${response.status}`)
  const data = (await response.json()) as UdemyAssetResponse
  const asset = data.asset

  if (!asset) throw new Error('No asset found for this lecture')

  if (req.type === 'Article') {
    const filePath = path.join(targetDir, `${cleanLecture}.html`)
    const articleHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${req.lectureTitle}</title>
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
    const urls =
      asset.download_urls.Video || asset.download_urls.File || asset.download_urls['E-Book']
    if (urls && urls.length > 0) {
      downloadUrl = urls[0].file
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

    https
      .get(downloadUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Handle redirects if Udemy sends one
          https
            .get(res.headers.location!, (redirectRes) => {
              redirectRes.pipe(file)
              redirectRes.on('end', () => resolve(filePath))
            })
            .on('error', reject)
        } else {
          res.pipe(file)
          res.on('end', () => resolve(filePath))
        }
      })
      .on('error', (err) => {
        fs.unlink(filePath, () => {}) // Delete corrupted file on error
        reject(err)
      })
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
