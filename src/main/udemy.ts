import { net } from 'electron'
import { z } from 'zod'

export function sanitizeToken(token: string): string {
  if (!token) return ''
  let cleaned = token.trim()
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim()
  cleaned = cleaned.replace(/^Bearer\s+/i, '').trim()
  cleaned = cleaned.replace(/^access_token\s*=\s*/i, '').trim()
  cleaned = cleaned.split(';')[0].trim()
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '').trim()
  return cleaned
}

const RawCourseSchema = z
  .object({
    id: z.coerce.number(),
    title: z.string().optional().nullable(),
    published_title: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    image_480x270: z.string().optional().nullable(),
    image_240x135: z.string().optional().nullable(),
    image_125_H: z.string().optional().nullable(),
    course: z
      .object({
        id: z.coerce.number().optional().nullable(),
        title: z.string().optional().nullable(),
        published_title: z.string().optional().nullable(),
        url: z.string().optional().nullable(),
        image_480x270: z.string().optional().nullable(),
        image_240x135: z.string().optional().nullable(),
        image_125_H: z.string().optional().nullable()
      })
      .loose()
      .optional()
      .nullable()
  })
  .loose()

export const UdemyCourseSchema = RawCourseSchema.transform((item) => {
  const inner = item.course && typeof item.course === 'object' ? item.course : null
  const id = inner?.id ?? item.id
  const title =
    inner?.title || inner?.published_title || item.title || item.published_title || `Course ${id}`
  let url = inner?.url || item.url || `/course/${id}/`
  if (!url.startsWith('http') && !url.startsWith('/')) {
    url = `/${url}`
  }
  const image_480x270 =
    inner?.image_480x270 ||
    inner?.image_240x135 ||
    inner?.image_125_H ||
    item.image_480x270 ||
    item.image_240x135 ||
    item.image_125_H ||
    null

  return {
    id,
    title,
    url,
    image_480x270
  }
})

export type UdemyCourse = z.infer<typeof UdemyCourseSchema>

export const CurriculumItemSchema = z
  .object({
    _class: z.string(),
    id: z.coerce.number(),
    title: z.string().default('Untitled Lecture'),
    object_index: z.coerce.number().optional().nullable(),
    sort_order: z.coerce.number(),
    is_free: z.boolean().optional().nullable(),
    asset: z
      .object({
        asset_type: z.string().optional().nullable(),
        time_estimation: z.coerce.number().optional().nullable()
      })
      .loose()
      .optional()
      .nullable()
  })
  .loose()

export type CurriculumItem = z.infer<typeof CurriculumItemSchema>

export const getHeaders = (token: string, baseUrl: string): Record<string, string> => {
  const cleanToken = sanitizeToken(token)
  return {
    Authorization: `Bearer ${cleanToken}`,
    Cookie: `access_token=${cleanToken}`,
    Accept: 'application/json, text/plain, */*',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    'Accept-Language': 'en-US,en;q=0.9'
  }
}

export async function fetchSubscribedCourses(
  token: string,
  subdomain?: string
): Promise<UdemyCourse[]> {
  try {
    const baseUrl = subdomain ? `https://${subdomain}.udemy.com` : 'https://www.udemy.com'
    const headers = getHeaders(token, baseUrl)

    // Helper function to recursively fetch all pages securely
    const fetchAllPages = async (url: string): Promise<UdemyCourse[]> => {
      const courses: UdemyCourse[] = []
      let nextUrl: string | null | undefined = url

      while (nextUrl) {
        let res: Response
        try {
          res = await net.fetch(nextUrl, { method: 'GET', headers })
        } catch (fetchErr) {
          console.error(`Udemy API network fetch failed for ${nextUrl}:`, fetchErr)
          break
        }

        if (!res.ok) {
          console.error(
            `Udemy API request to ${nextUrl} returned status ${res.status}: ${res.statusText}`
          )
          break
        }

        let rawData: Record<string, unknown>
        try {
          rawData = (await res.json()) as Record<string, unknown>
        } catch (jsonErr) {
          console.error(`Udemy API failed to parse JSON response from ${nextUrl}:`, jsonErr)
          break
        }

        if (!rawData || typeof rawData !== 'object') break

        const rawResults = Array.isArray(rawData.results) ? rawData.results : []
        for (const rawItem of rawResults) {
          const parsed = UdemyCourseSchema.safeParse(rawItem)
          if (parsed.success) {
            courses.push(parsed.data)
          } else {
            console.warn('Skipping unparseable course item:', parsed.error)
          }
        }

        if (typeof rawData.next === 'string' && rawData.next.trim() !== '') {
          try {
            const nextUrlObj = new URL(rawData.next, baseUrl)
            nextUrl = nextUrlObj.href
          } catch {
            nextUrl = null
          }
        } else {
          nextUrl = null
        }
      }
      return courses
    }

    const standardUrl = `${baseUrl}/api-2.0/users/me/subscribed-courses/?fields[course]=@min,title,published_title,url,image_480x270,is_practice_test_course&page_size=100&ordering=-last_accessed`
    const enrolledUrl = `${baseUrl}/api-2.0/users/me/subscription-course-enrollments/?page_size=100`
    const archivedUrl = `${baseUrl}/api-2.0/users/me/subscribed-courses/?is_archived=true&fields[course]=@min,title,published_title,url,image_480x270&page_size=100`

    const [standardCourses, enrolledCourses, archivedCourses] = await Promise.allSettled([
      fetchAllPages(standardUrl),
      fetchAllPages(enrolledUrl),
      fetchAllPages(archivedUrl)
    ])

    const allCourses: UdemyCourse[] = []

    if (standardCourses.status === 'fulfilled') {
      allCourses.push(...standardCourses.value)
    }
    if (enrolledCourses.status === 'fulfilled') {
      allCourses.push(...enrolledCourses.value)
    }
    if (archivedCourses.status === 'fulfilled') {
      allCourses.push(...archivedCourses.value)
    }

    if (allCourses.length === 0) {
      console.warn('No courses found or all endpoints failed.')
    }

    const uniqueCourses = Array.from(new Map(allCourses.map((c) => [c.id, c])).values())
    return uniqueCourses
  } catch (error: unknown) {
    console.error('Udemy API Error:', error)
    throw new Error('Failed to fetch courses. Your token might be expired or invalid.')
  }
}

export async function fetchCourseCurriculum(
  token: string,
  courseId: number,
  subdomain?: string
): Promise<CurriculumItem[]> {
  try {
    const baseUrl = subdomain ? `https://${subdomain}.udemy.com` : 'https://www.udemy.com'
    let apiUrl: string | null | undefined =
      `${baseUrl}/api-2.0/courses/${courseId}/subscriber-curriculum-items/?curriculum_types=chapter,lecture,practice,quiz,role-play&page_size=200&fields[lecture]=title,object_index,is_published,sort_order,created,asset,supplementary_assets,is_free&fields[quiz]=title,object_index,is_published,sort_order,type&fields[practice]=title,object_index,is_published,sort_order&fields[chapter]=title,object_index,is_published,sort_order&fields[asset]=title,filename,asset_type,status,time_estimation,is_external,course_is_drmed,media_sources,download_urls`
    const headers = getHeaders(token, baseUrl)

    const allItems: CurriculumItem[] = []

    while (apiUrl) {
      let response: Response
      try {
        response = await net.fetch(apiUrl, {
          method: 'GET',
          headers
        })
      } catch (fetchErr) {
        console.error(`Curriculum fetch network error for ${apiUrl}:`, fetchErr)
        throw new Error('Failed to fetch course curriculum due to network error.')
      }

      if (!response.ok) {
        console.error(
          `Curriculum API returned HTTP status ${response.status}: ${response.statusText}`
        )
        throw new Error(`Udemy returned status: ${response.status}`)
      }

      let rawData: Record<string, unknown>
      try {
        rawData = (await response.json()) as Record<string, unknown>
      } catch (jsonErr) {
        console.error('Failed to parse curriculum JSON response:', jsonErr)
        throw new Error('Udemy API structure changed. Failed to parse curriculum.')
      }

      if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.results)) {
        console.error('Invalid curriculum response structure (missing results array):', rawData)
        throw new Error('Udemy API structure changed. Failed to parse curriculum.')
      }

      for (const rawItem of rawData.results) {
        const parsed = CurriculumItemSchema.safeParse(rawItem)
        if (parsed.success) {
          allItems.push(parsed.data)
        } else {
          console.warn('Skipping unparseable curriculum item:', parsed.error)
        }
      }

      if (typeof rawData.next === 'string' && rawData.next.trim() !== '') {
        try {
          const nextUrlObj = new URL(rawData.next, baseUrl)
          apiUrl = nextUrlObj.href
        } catch {
          apiUrl = null
        }
      } else {
        apiUrl = null
      }
    }

    // Sort strictly by descending sort_order to maintain exact top-to-bottom flow
    return allItems.sort((a, b) => b.sort_order - a.sort_order)
  } catch (error: unknown) {
    console.error('Curriculum Fetch Error:', error)
    throw error instanceof Error ? error : new Error('Failed to fetch course curriculum.')
  }
}
