import electron from 'electron'
import { logger } from '../../shared/logger'
import type {
  CourseItem,
  PlatformSession,
  UdemyPaginatedResponse,
  UdemyRawCourse
} from '../../shared/types'

const { net } = electron

export class UdemyService {
  private static readonly PAGE_SIZE = 50
  private static readonly MAX_CONCURRENCY = 4

  private static getBaseUrl(session: PlatformSession): string {
    if (session.isBusiness && session.subdomain) {
      return `https://${session.subdomain}.udemy.com`
    }
    return 'https://www.udemy.com'
  }

  private static getHeaders(session: PlatformSession): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${session.token}`
    }

    if (session.cookies) {
      const cookieStr = Object.entries(session.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
      if (cookieStr) headers['Cookie'] = cookieStr
    }

    return headers
  }

  private static async fetchPage(
    baseUrl: string,
    endpoint: string,
    page: number,
    headers: Record<string, string>
  ): Promise<UdemyPaginatedResponse> {
    const url = new URL(endpoint, baseUrl)
    url.searchParams.set('page', String(page))
    url.searchParams.set('page_size', String(this.PAGE_SIZE))
    url.searchParams.set(
      'fields[course]',
      'id,title,headline,url,image_480x270,image_240x135,visible_instructors,num_published_lectures,estimated_content_length,completion_ratio,last_accessed_time'
    )

    const res = await net.fetch(url.toString(), { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Udemy API error [${res.status}]: ${body || res.statusText}`)
    }

    return (await res.json()) as UdemyPaginatedResponse
  }

  private static async fetchAllFromEndpoint(
    baseUrl: string,
    endpoint: string,
    headers: Record<string, string>
  ): Promise<UdemyRawCourse[]> {
    try {
      // 1. Fetch first page to assess total count
      const firstPage = await this.fetchPage(baseUrl, endpoint, 1, headers)
      const allResults: UdemyRawCourse[] = [...(firstPage.results || [])]
      const totalCount = firstPage.count || allResults.length

      if (totalCount <= this.PAGE_SIZE || !firstPage.next) {
        return allResults
      }

      const totalPages = Math.ceil(totalCount / this.PAGE_SIZE)
      const remainingPages: number[] = []
      for (let p = 2; p <= totalPages; p++) {
        remainingPages.push(p)
      }

      // 2. Worker pool to fetch remaining pages concurrently
      const executing = new Set<Promise<void>>()
      for (const pageNum of remainingPages) {
        const task = (async (): Promise<void> => {
          try {
            const pageData = await this.fetchPage(baseUrl, endpoint, pageNum, headers)
            if (pageData.results) {
              allResults.push(...pageData.results)
            }
          } catch (err: unknown) {
            logger.warn(
              'UDEMY_SERVICE',
              `Failed to fetch page ${pageNum} from ${endpoint}: ${String(err)}`
            )
          }
        })()

        const wrapped = task.then(() => {
          executing.delete(wrapped)
        })
        executing.add(wrapped)

        if (executing.size >= this.MAX_CONCURRENCY) {
          await Promise.race(executing)
        }
      }

      await Promise.all(executing)
      return allResults
    } catch (err: unknown) {
      logger.error('UDEMY_SERVICE', `Failed query on ${endpoint}: ${String(err)}`)
      return []
    }
  }

  private static mapRawToCourseItem(raw: UdemyRawCourse, baseUrl: string): CourseItem {
    const instructors = (raw.visible_instructors || []).map((inst) => ({
      id: String(inst.id),
      name: inst.display_name || inst.title || 'Instructor',
      avatarUrl: inst.image_50x50
    }))

    const parsedCompletion = raw.completion_ratio ? Math.round(raw.completion_ratio) : 0
    const fullUrl = raw.url?.startsWith('http') ? raw.url : `${baseUrl}${raw.url || ''}`

    return {
      id: String(raw.id),
      platformId: 'udemy',
      title: raw.title || 'Untitled Course',
      headline: raw.headline || '',
      thumbnailUrl: raw.image_480x270 || raw.image_240x135 || '',
      instructors,
      totalLectures: raw.num_published_lectures || 0,
      totalDurationSeconds: raw.estimated_content_length ? raw.estimated_content_length * 60 : 0,
      progressPercent: parsedCompletion,
      isDownloaded: false,
      downloadedLecturesCount: 0,
      lastAccessedAt: raw.last_accessed_time
        ? new Date(raw.last_accessed_time).getTime()
        : undefined,
      url: fullUrl
    }
  }

  public static async fetchEnrolledCourses(session: PlatformSession): Promise<CourseItem[]> {
    const baseUrl = this.getBaseUrl(session)
    const headers = this.getHeaders(session)

    logger.info('UDEMY_SERVICE', `Fetching enrolled courses for ${session.username}...`)

    // Query standard subscribed courses and personal subscription courses concurrently
    const [purchasedCourses, subscriptionCourses] = await Promise.all([
      this.fetchAllFromEndpoint(baseUrl, '/api-2.0/users/me/subscribed-courses/', headers),
      this.fetchAllFromEndpoint(
        baseUrl,
        '/api-2.0/users/me/subscription-course-enrollments/',
        headers
      )
    ])

    // De-duplicate courses across both pools
    const courseMap = new Map<number, UdemyRawCourse>()

    for (const course of purchasedCourses) {
      if (course?.id) courseMap.set(course.id, course)
    }

    for (const course of subscriptionCourses) {
      if (course?.id && !courseMap.has(course.id)) {
        courseMap.set(course.id, course)
      }
    }

    const unifiedCourses = Array.from(courseMap.values()).map((raw) =>
      this.mapRawToCourseItem(raw, baseUrl)
    )

    logger.info('UDEMY_SERVICE', `Successfully resolved ${unifiedCourses.length} total courses`)
    return unifiedCourses
  }
}
