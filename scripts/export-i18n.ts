/// <reference types="node" />
import * as fs from 'fs'
import * as path from 'path'
import { EnglishUS } from '../src/renderer/src/locales/EnglishUS'

function exportToJson(): void {
  const outputPath = path.resolve(__dirname, '../src/renderer/src/locales/EnglishUS.json')

  try {
    const jsonString = JSON.stringify(EnglishUS, null, 2)
    fs.writeFileSync(outputPath, jsonString, 'utf-8')
    console.log(`\x1b[32m✔ Successfully exported EnglishUS.ts -> ${outputPath}\x1b[0m`)
  } catch (error) {
    console.error('\x1b[31m✖ Failed to export i18n JSON:\x1b[0m', error)
    process.exit(1)
  }
}

exportToJson()
