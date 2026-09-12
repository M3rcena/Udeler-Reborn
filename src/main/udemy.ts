import { net } from 'electron'
import { z } from 'zod'
import { Course, CurriculumItem } from '../preload/types/ipc-types'
import { logDiagnostic } from './index'

const CourseSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    url: z.string().optional().default(''),
    image_480x270: z.string().optional().default(''),
    image_240x135: z.string().optional().default(''),
    _class: z.string().optional()
  })
  .loose()

const UdemyCourseResponseSchema = z
  .object({
    count: z.number().optional().default(0),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(CourseSchema).optional().default([])
  })
  .loose()

const CurriculumItemSchema = z
  .object({
    _class: z.enum(['chapter', 'lecture', 'quiz', 'practice']),
    id: z.number(),
    title: z.string(),
    asset: z
      .object({
        asset_type: z.string(),
        time_estimation: z.number().optional()
      })
      .loose()
      .optional()
  })
  .loose()

const UdemyCurriculumResponseSchema = z
  .object({
    results: z.array(CurriculumItemSchema).optional()
  })
  .loose()

interface UserContextResponse {
  header?: {
    isLoggedIn?: boolean
    user?: {
      enableLabsInPersonalPlan?: boolean
      consumer_subscription_active?: boolean
    }
  }
}

async function requestUdemy(url: string, token: string, baseDomain: string): Promise<Response> {
  return await net.fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-udemy-authorization': `Bearer ${token}`,
      Cookie: `access_token=${token};`,
      Accept: 'application/json, text/plain, */*',
      Origin: baseDomain,
      Referer: `${baseDomain}/home/my-courses/learning/`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  })
}

export async function validateTokenAndCheckSubscription(
  token: string,
  subdomain?: string
): Promise<{ isValid: boolean; isSubscriber: boolean }> {
  const baseDomain =
    subdomain && subdomain.trim() !== ''
      ? `https://${subdomain.trim()}.udemy.com`
      : 'https://www.udemy.com'

  const profileUrl = `${baseDomain}/api-2.0/contexts/me/?header=True`

  try {
    const res = await requestUdemy(profileUrl, token, baseDomain)
    if (!res.ok) return { isValid: false, isSubscriber: false }

    const data = (await res.json()) as UserContextResponse
    const isLoggedIn = data?.header?.isLoggedIn ?? false
    const isSubscriber = Boolean(
      data?.header?.user?.enableLabsInPersonalPlan ||
      data?.header?.user?.consumer_subscription_active
    )

    return { isValid: isLoggedIn, isSubscriber }
  } catch (err) {
    logDiagnostic('ERROR', 'Profile validation failed', { error: String(err) })
    return { isValid: false, isSubscriber: false }
  }
}

export async function fetchSubscribedCourses(token: string, subdomain?: string): Promise<Course[]> {
  if (!token) {
    logDiagnostic('ERROR', 'fetchSubscribedCourses aborted: No token provided')
    throw new Error('No authentication token found.')
  }

  const baseDomain =
    subdomain && subdomain.trim() !== ''
      ? `https://${subdomain.trim()}.udemy.com`
      : 'https://www.udemy.com'

  const { isSubscriber } = await validateTokenAndCheckSubscription(token, subdomain)
  logDiagnostic('INFO', 'Starting course retrieval', {
    baseDomain,
    isBusiness: !!subdomain,
    isSubscriber
  })

  const standardUrl = `${baseDomain}/api-2.0/users/me/subscribed-courses/?page_size=30&ordering=-last_accessed&fields[course]=@min,title,url,image_480x270,image_240x135`
  const subscriptionUrl = `${baseDomain}/api-2.0/users/me/subscription-course-enrollments/?page_size=30&ordering=-last_accessed&fields[course]=@min,title,url,image_480x270,image_240x135`

  const targetUrls = isSubscriber ? [standardUrl, subscriptionUrl] : [standardUrl]
  const courseMap = new Map<number, Course>()

  for (const initialUrl of targetUrls) {
    let nextUrl: string | null = initialUrl

    while (nextUrl) {
      logDiagnostic('NETWORK', 'Fetching courses page', { url: nextUrl })
      let response: Response

      try {
        response = await requestUdemy(nextUrl, token, baseDomain)
      } catch (netErr: unknown) {
        logDiagnostic('ERROR', 'Network connection failed during course fetch', {
          error: netErr instanceof Error ? netErr.message : String(netErr)
        })
        break
      }

      if (!response.ok) {
        logDiagnostic('WARN', `Endpoint returned status ${response.status}`, { url: nextUrl })
        break
      }

      const rawJson: unknown = await response.json()
      const parsed = UdemyCourseResponseSchema.safeParse(rawJson)

      if (parsed.success && parsed.data.results) {
        for (const item of parsed.data.results) {
          if (!courseMap.has(item.id)) {
            courseMap.set(item.id, {
              id: item.id,
              title: item.title,
              url: item.url || '',
              image_480x270: item.image_480x270 || item.image_240x135 || ''
            })
          }
        }
        nextUrl = parsed.data.next || null
      } else {
        nextUrl = null
      }
    }
  }

  const allCourses = Array.from(courseMap.values())
  logDiagnostic('INFO', `Course fetch completed. Total: ${allCourses.length}`)
  return allCourses
}

export async function fetchCourseCurriculum(
  courseId: number,
  token: string,
  subdomain?: string
): Promise<CurriculumItem[]> {
  if (!token) throw new Error('No authentication token found.')

  const baseDomain =
    subdomain && subdomain.trim() !== ''
      ? `https://${subdomain.trim()}.udemy.com`
      : 'https://www.udemy.com'

  const allCurriculum: CurriculumItem[] = []
  let nextUrl: string | null =
    `${baseDomain}/api-2.0/courses/${courseId}/cached-subscriber-curriculum-items?page_size=200&fields[lecture]=title,asset,supplementary_assets&fields[chapter]=title&fields[asset]=asset_type,time_estimation`

  while (nextUrl) {
    let response = await requestUdemy(nextUrl, token, baseDomain)

    if (!response.ok && response.status === 503) {
      // Fallback endpoint used by Udemy when cache layer is under load
      const fallbackUrl = `${baseDomain}/api-2.0/courses/${courseId}/subscriber-curriculum-items/?page_size=50&fields[lecture]=title,asset,supplementary_assets&fields[chapter]=title&fields[asset]=asset_type,time_estimation`
      response = await requestUdemy(fallbackUrl, token, baseDomain)
    }

    if (!response.ok) {
      logDiagnostic('ERROR', `Failed to fetch curriculum for course ${courseId}`, {
        status: response.status
      })
      throw new Error(`Failed to fetch curriculum: ${response.status}`)
    }

    const rawJson: unknown = await response.json()
    const parsed = UdemyCurriculumResponseSchema.safeParse(rawJson)

    if (parsed.success && parsed.data.results) {
      const items: CurriculumItem[] = parsed.data.results.map((item) => ({
        _class: item._class,
        id: item.id,
        title: item.title,
        asset: item.asset
      }))
      allCurriculum.push(...items)
    }

    const record = rawJson as { next?: string | null }
    nextUrl = record?.next ? decodeURI(record.next) : null
  }

  return allCurriculum
}
