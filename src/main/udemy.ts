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
    results: z.array(UdemyCourseSchema)
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
    results: z.array(CurriculumItemSchema)
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

    const standardUrl = `${baseUrl}/api-2.0/users/me/subscribed-courses/?page_size=100`
    const enrolledUrl = `${baseUrl}/api-2.0/users/me/subscription-course-enrollments/?page_size=100`

    const [standardRes, enrolledRes] = await Promise.allSettled([
      net.fetch(standardUrl, { method: 'GET', headers }),
      net.fetch(enrolledUrl, { method: 'GET', headers })
    ])

    const allCourses: UdemyCourse[] = []

    if (standardRes.status === 'fulfilled' && standardRes.value.ok) {
      const rawData = await standardRes.value.json()
      const data = UdemyApiResponseSchema.parse(rawData)
      allCourses.push(...data.results)
    }

    if (enrolledRes.status === 'fulfilled' && enrolledRes.value.ok) {
      const rawData = await enrolledRes.value.json()
      const data = UdemyApiResponseSchema.parse(rawData)
      allCourses.push(...data.results)
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
    const apiUrl = `${baseUrl}/api-2.0/courses/${courseId}/subscriber-curriculum-items/?curriculum_types=chapter,lecture,practice,quiz,role-play&page_size=200&fields[lecture]=title,object_index,is_published,sort_order,created,asset,supplementary_assets,is_free&fields[quiz]=title,object_index,is_published,sort_order,type&fields[practice]=title,object_index,is_published,sort_order&fields[chapter]=title,object_index,is_published,sort_order&fields[asset]=title,filename,asset_type,status,time_estimation,is_external,course_is_drmed,media_sources,download_urls`

    const response = await net.fetch(apiUrl, {
      method: 'GET',
      headers: getHeaders(token, baseUrl)
    })

    if (!response.ok) {
      throw new Error(`Udemy returned status: ${response.status}`)
    }

    const rawData = await response.json()
    try {
      const data = CurriculumResponseSchema.parse(rawData)
      return data.results.sort((a, b) => (a.object_index ?? 0) - (b.object_index ?? 0))
    } catch (err) {
      console.error('Zod Parsing Error (Curriculum):', err)
      throw new Error('Udemy API structure changed. Failed to parse curriculum.')
    }
  } catch (error: unknown) {
    console.error('Curriculum Fetch Error:', error)
    throw new Error('Failed to fetch course curriculum.')
  }
}
