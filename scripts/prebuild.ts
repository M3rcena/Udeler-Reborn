import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import pkg from '../package.json' with { type: 'json' }

const version = `v${pkg.version}`

const content = `/**
 * THIS FILE IS AUTO GENERATED TO PROVIDE APP VERSION!
 *
 * MODIFYING THIS FILE OR REMOVING IT WILL CAUSE THE APP TO CRASH
 *
 */

export const appVersion = '${version}'
`

const files = [
  join(import.meta.dirname, '../src/main/version.ts'),
  join(import.meta.dirname, '../src/renderer/src/version.ts'),
]

for (const file of files) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}
