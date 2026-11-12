import { describe, expect, it } from 'vitest'
import { CurriculumItemSchema, sanitizeToken, UdemyCourseSchema } from './udemy'

describe('Udemy API Schemas & Helpers', () => {
  it('parses valid course objects', () => {
    const rawCourse = {
      id: 999123,
      title: 'React Native Masterclass',
      url: '/course/react-native/',
      image_480x270: 'https://img.udemy.com/course.jpg',
      ignored_extra_field: true
    }
    const parsed = UdemyCourseSchema.parse(rawCourse)
    expect(parsed.id).toBe(999123)
    expect(parsed.title).toBe('React Native Masterclass')
    expect(parsed.url).toBe('/course/react-native/')
    expect(parsed.image_480x270).toBe('https://img.udemy.com/course.jpg')
  })

  it('parses subscription course enrollments with nested course object', () => {
    const rawEnrollment = {
      id: 54321,
      course: {
        id: 777,
        title: 'Subscription Masterclass',
        url: '/course/subscription-masterclass/',
        image_240x135: 'https://img.udemy.com/thumb.jpg'
      }
    }
    const parsed = UdemyCourseSchema.parse(rawEnrollment)
    expect(parsed.id).toBe(777)
    expect(parsed.title).toBe('Subscription Masterclass')
    expect(parsed.url).toBe('/course/subscription-masterclass/')
    expect(parsed.image_480x270).toBe('https://img.udemy.com/thumb.jpg')
  })

  it('falls back to published_title and constructs course URL if missing', () => {
    const rawCourse = {
      id: 12345,
      published_title: 'fallback-slug',
      title: null
    }
    const parsed = UdemyCourseSchema.parse(rawCourse)
    expect(parsed.id).toBe(12345)
    expect(parsed.title).toBe('fallback-slug')
    expect(parsed.url).toBe('/course/12345/')
  })

  it('parses valid curriculum items with optional assets', () => {
    const rawLecture = {
      _class: 'lecture',
      id: 555,
      title: 'Introduction',
      sort_order: 1,
      asset: {
        asset_type: 'Video',
        time_estimation: 300
      }
    }
    const parsed = CurriculumItemSchema.parse(rawLecture)
    expect(parsed.asset?.asset_type).toBe('Video')
  })

  it('throws on missing required curriculum fields', () => {
    expect(() => CurriculumItemSchema.parse({ _class: 'chapter', id: 1 })).toThrowError()
  })

  describe('sanitizeToken', () => {
    it('strips Bearer prefix, quotes, and whitespace', () => {
      expect(sanitizeToken('  Bearer mySecretToken123  ')).toBe('mySecretToken123')
      expect(sanitizeToken('"mySecretToken123"')).toBe('mySecretToken123')
      expect(sanitizeToken("'Bearer mySecretToken123'")).toBe('mySecretToken123')
    })

    it('strips access_token= prefix and cookies trailing parts', () => {
      expect(sanitizeToken('access_token=mySecretToken123; client_id=abc')).toBe('mySecretToken123')
    })

    it('removes non-ASCII characters that cause ByteString conversion crashes', () => {
      // 0xFFFD is character code 65533
      const badToken = `token\uFFFDwith\u2013special\u0000chars`
      const cleaned = sanitizeToken(badToken)
      expect(cleaned).toBe('tokenwithspecialchars')
      for (let i = 0; i < cleaned.length; i++) {
        expect(cleaned.charCodeAt(i)).toBeLessThanOrEqual(127)
      }
    })
  })
})
