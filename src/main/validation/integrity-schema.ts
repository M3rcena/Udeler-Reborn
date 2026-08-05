import { z } from 'zod'

export const IntegrityProgressSchema = z.object({
  scanned: z.number(),
  total: z.number(),
  currentFile: z.string(),
  issuesFound: z.number()
})

export const IntegrityIssueSchema = z.object({
  lectureId: z.number(),
  courseTitle: z.string(),
  chapterTitle: z.string(),
  fileName: z.string(),
  filePath: z.string(),
  status: z.enum(['size_mismatch', 'hash_mismatch', 'archived_corrupted']),
  expectedHash: z.string().optional()
})
