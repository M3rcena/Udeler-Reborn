import { net } from 'electron'
import { z } from 'zod'

export const UdemyCourseSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    url: z.string(),
    image_480x270: z.string().optional().nullable()
  })
  .loose()

export type UdemyCourse = z.infer<typeof UdemyCourseSchema>

const UdemyApiResponseSchema = z
  .object({
    results: z.array(UdemyCourseSchema),
    next: z.string().optional().nullable()
  })
  .loose()

export const CurriculumItemSchema = z
  .object({
    _class: z.string(),
    id: z.number(),
    title: z.string(),
    object_index: z.number().optional().nullable(),
    sort_order: z.number(),
    is_free: z.boolean().optional().nullable(),
    asset: z
      .object({
        asset_type: z.string().optional().nullable(),
        time_estimation: z.number().optional().nullable()
      })
      .loose()
      .optional()
      .nullable()
  })
  .loose()

export type CurriculumItem = z.infer<typeof CurriculumItemSchema>

const CurriculumResponseSchema = z
  .object({
    results: z.array(CurriculumItemSchema),
    next: z.string().optional().nullable()
  })
  .loose()

const getHeaders = (token: string, baseUrl: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: baseUrl,
  Referer: `${baseUrl}/`,
  'Accept-Language': 'en-US,en;q=0.9'
})

export async function fetchSubscribedCourses(
  token: string,
  subdomain?: string
): Promise<UdemyCourse[]> {
  try {
    const baseUrl = subdomain ? `https://${subdomain}.udemy.com` : 'https://www.udemy.com'
    const headers = getHeaders(token, baseUrl)

    // Helper function to recursively fetch all pages securely
    const fetchAllPages = async (
      url: string
    ): Promise<
      {
        [x: string]: unknown
        id: number
        title: string
        url: string
        image_480x270?: string | null | undefined
      }[]
    > => {
      const courses: UdemyCourse[] = []
      let nextUrl: string | null | undefined = url

      while (nextUrl) {
        const res = await net.fetch(nextUrl, { method: 'GET', headers })
        if (!res.ok) break

        const rawData = await res.json()
        const data = UdemyApiResponseSchema.parse(rawData)

        courses.push(...data.results)

        if (data.next) {
          const nextUrlObj = new URL(data.next)
          nextUrl = `${baseUrl}${nextUrlObj.pathname}${nextUrlObj.search}`
        } else {
          nextUrl = null
        }
      }
      return courses
    }

    const standardUrl = `${baseUrl}/api-2.0/users/me/subscribed-courses/?page_size=100`
    const enrolledUrl = `${baseUrl}/api-2.0/users/me/subscription-course-enrollments/?page_size=100`

    const [standardCourses, enrolledCourses] = await Promise.allSettled([
      fetchAllPages(standardUrl),
      fetchAllPages(enrolledUrl)
    ])

    const allCourses: UdemyCourse[] = []

    if (standardCourses.status === 'fulfilled') {
      allCourses.push(...standardCourses.value)
    }
    if (enrolledCourses.status === 'fulfilled') {
      allCourses.push(...enrolledCourses.value)
    }

    if (allCourses.length === 0) {
      console.warn('No courses found or both endpoints failed.')
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
      const response = await net.fetch(apiUrl, {
        method: 'GET',
        headers
      })

      if (!response.ok) {
        throw new Error(`Udemy returned status: ${response.status}`)
      }

      const rawData = await response.json()

      try {
        const data = CurriculumResponseSchema.parse(rawData)
        allItems.push(...data.results)

        if (data.next) {
          const nextUrlObj = new URL(data.next)
          apiUrl = `${baseUrl}${nextUrlObj.pathname}${nextUrlObj.search}`
        } else {
          apiUrl = null
        }
      } catch (err) {
        console.error('Zod Parsing Error (Curriculum):', err)
        throw new Error('Udemy API structure changed. Failed to parse curriculum.')
      }
    }

    // Sort strictly by descending sort_order to maintain exact top-to-bottom flow
    return allItems.sort((a, b) => b.sort_order - a.sort_order)
  } catch (error: unknown) {
    console.error('Curriculum Fetch Error:', error)
    throw new Error('Failed to fetch course curriculum.')
  }
}
