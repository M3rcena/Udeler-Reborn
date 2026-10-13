export const appVersion = '4.0.0-dev.1.0'

export interface GitHubReleaseInfo {
  tag_name: string
  name: string
  published_at?: string
  html_url: string
}

/**
 * Compares two semantic version strings.
 * Returns:
 *  1 if a > b
 * -1 if a < b
 *  0 if a === b
 */
export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/, '').split('-')[0]
  const cleanB = b.replace(/^v/, '').split('-')[0]

  const partsA = cleanA.split('.').map((p) => parseInt(p, 10) || 0)
  const partsB = cleanB.split('.').map((p) => parseInt(p, 10) || 0)

  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

/**
 * Checks whether the current app version is ahead of the official release
 * or is tagged as a development/pre-release build.
 */
export function isUnreleasedVersion(current: string, releasedTag?: string): boolean {
  if (
    current.includes('dev') ||
    current.includes('alpha') ||
    current.includes('beta') ||
    current.includes('canary') ||
    current.includes('rc')
  ) {
    return true
  }
  if (!releasedTag) return false
  return compareSemver(current, releasedTag) > 0
}
