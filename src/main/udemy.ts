import { net } from 'electron'

export interface UdemyCourse {
  id: number
  title: string
  url: string
  image_480x270: string
}

interface UdemyApiResponse {
  results: UdemyCourse[]
}

export interface CurriculumItem {
  _class: 'chapter' | 'lecture' | 'quiz' | 'practice'
  id: number
  title: string
  object_index: number
  sort_order: number
  is_free?: boolean
  asset?: {
    asset_type: string
    time_estimation?: number
  }
}

interface CurriculumResponse {
  results: CurriculumItem[]
}

const getHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://www.udemy.com',
  Referer: 'https://www.udemy.com/',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
})

export async function fetchSubscribedCourses(token: string): Promise<UdemyCourse[]> {
  try {
    const apiUrl = 'https://www.udemy.com/api-2.0/users/me/subscribed-courses/?page_size=50'

    const response = await net.fetch(apiUrl, {
      method: 'GET',
      headers: getHeaders(token)
    })

    if (!response.ok) {
      throw new Error(`Udemy returned status: ${response.status}`)
    }

    const data = (await response.json()) as UdemyApiResponse

    return data.results
  } catch (error: unknown) {
    console.error('Udemy API Error:', error)
    throw new Error('Failed to fetch courses. Your token might be expired or invalid.')
  }
}

export async function fetchCourseCurriculum(
  token: string,
  courseId: number
): Promise<CurriculumItem[]> {
  try {
    const apiUrl = `https://www.udemy.com/api-2.0/courses/${courseId}/subscriber-curriculum-items/?curriculum_types=chapter,lecture,practice,quiz,role-play&page_size=200&fields[lecture]=title,object_index,is_published,sort_order,created,asset,supplementary_assets,is_free&fields[quiz]=title,object_index,is_published,sort_order,type&fields[practice]=title,object_index,is_published,sort_order&fields[chapter]=title,object_index,is_published,sort_order&fields[asset]=title,filename,asset_type,status,time_estimation,is_external,course_is_drmed,media_sources,download_urls`

    const response = await net.fetch(apiUrl, {
      method: 'GET',
      headers: getHeaders(token)
    })

    if (!response.ok) {
      throw new Error(`Udemy returned status: ${response.status}`)
    }

    const data = (await response.json()) as CurriculumResponse

    return data.results.sort((a, b) => b.sort_order - a.sort_order)
  } catch (error: unknown) {
    console.error('Curriculum Fetch Error:', error)
    throw new Error('Failed to fetch course curriculum.')
  }
}
