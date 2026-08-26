import { describe, expect, it } from 'vitest'
import { handleSearchQuery } from './search-service'

describe('Search Service Engine', () => {
  it('returns empty array on blank query', () => {
    expect(handleSearchQuery('')).toEqual([])
    expect(handleSearchQuery('   ')).toEqual([])
  })
})
