import { describe, expect, it } from 'vitest'
import { CurriculumItemSchema, UdemyCourseSchema } from './udemy'

describe('Udemy API Schemas', () => {
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
})
