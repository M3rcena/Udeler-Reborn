import * as fs from 'fs'
import * as path from 'path'
import { AppSettings, Course, SafeStore, SearchDocument, SearchResult } from '../preload/ipc-types'

let documents: SearchDocument[] = []

export async function rebuildIndex(store: SafeStore): Promise<boolean> {
  const settings = store.get('app_settings') as AppSettings | undefined
  if (!settings || !settings.downloadPath || !fs.existsSync(settings.downloadPath)) {
    return false
  }

  const cachedCourses = (store.get('cached_courses') || []) as Course[]

  documents = []
  const courses = fs.readdirSync(settings.downloadPath)

  for (const course of courses) {
    const coursePath = path.join(settings.downloadPath, course)
    if (!fs.statSync(coursePath).isDirectory()) continue

    const matchedCourse = cachedCourses.find(
      (c) => c.title.replace(/[<>:"/\\|?*]+/g, '-').trim() === course
    )
    const courseId = matchedCourse?.id

    const chapters = fs.readdirSync(coursePath)
    for (const chapter of chapters) {
      const chapterPath = path.join(coursePath, chapter)
      if (!fs.statSync(chapterPath).isDirectory()) continue

      const files = fs.readdirSync(chapterPath)
      const lectureMap = new Map<number, SearchDocument>()

      for (const file of files) {
        const match = file.match(/\[ID_(\d+)\]/)
        if (!match) continue

        const lectureId = parseInt(match[1], 10)

        if (courseId) {
          const isDrm = store.get(`drm_${courseId}.${lectureId}`)
          if (isDrm) continue
        }

        const lectureTitle = file
          .replace(/\.[^/.]+$/, '')
          .replace(/\[ID[_:]?\s*\d+\]/gi, '')
          .replace(/_.*?$/, '')
          .replace(/^\d+\s*-\s*/, '')
          .trim()

        const filePath = path.join(chapterPath, file)

        if (!lectureMap.has(lectureId)) {
          lectureMap.set(lectureId, {
            id: `${course}-${lectureId}`,
            courseTitle: course,
            chapterTitle: chapter,
            lectureTitle,
            lectureId,
            text: '',
            filePath
          })
        }

        const doc = lectureMap.get(lectureId)!

        if (file.endsWith('.mp4') || file.endsWith('.html') || file.endsWith('.pdf')) {
          doc.filePath = filePath
        }

        if (file.endsWith('.vtt')) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const cleanText = content
            .replace(/WEBVTT/g, '')
            .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*?\n/g, ' ')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()

          doc.text += ' ' + cleanText.toLowerCase()
        } else if (file.endsWith('.html')) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const cleanText = content
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          doc.text += ' ' + cleanText.toLowerCase()
        }
      }

      documents.push(...Array.from(lectureMap.values()))
    }
  }
  return true
}

export function handleSearchQuery(query: string): SearchResult[] {
  if (!query || !query.trim()) return []

  const terms = query.toLowerCase().trim().split(/\s+/)
  const scoredResults: SearchResult[] = []

  for (const doc of documents) {
    let score = 0
    let matchedLectureTitle = false
    let matchedTranscript = false
    let firstMatchIndex = -1

    for (const term of terms) {
      if (doc.courseTitle.toLowerCase().includes(term)) score += 2
      if (doc.chapterTitle.toLowerCase().includes(term)) score += 3

      if (doc.lectureTitle.toLowerCase().includes(term)) {
        score += 10
        matchedLectureTitle = true
      }

      const textIndex = doc.text.indexOf(term)
      if (textIndex !== -1) {
        score += 5
        matchedTranscript = true
        if (firstMatchIndex === -1) firstMatchIndex = textIndex
      }
    }

    if (score > 0) {
      let matchType: 'title' | 'transcript' = 'title'
      let snippet = ''

      if (matchedTranscript) {
        matchType = 'transcript'
        const start = Math.max(0, firstMatchIndex - 40)
        const end = Math.min(doc.text.length, firstMatchIndex + 80)
        snippet = doc.text.substring(start, end)
        if (start > 0) snippet = '...' + snippet
        if (end < doc.text.length) snippet = snippet + '...'
      }

      if (matchedLectureTitle || !matchedTranscript) {
        matchType = 'title'
        snippet = ''
      }

      scoredResults.push({
        id: doc.id,
        courseTitle: doc.courseTitle,
        chapterTitle: doc.chapterTitle,
        lectureTitle: doc.lectureTitle,
        lectureId: doc.lectureId,
        textSnippet: snippet,
        score,
        filePath: doc.filePath,
        matchType
      })
    }
  }

  return scoredResults.sort((a, b) => b.score - a.score).slice(0, 15)
}
