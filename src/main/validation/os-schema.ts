import { z } from 'zod'

export const OsProgressSchema = z.object({
  progress: z.number().min(-1).max(1)
})

export const TrayTooltipSchema = z.object({
  text: z.string().max(255, 'Tooltip text cannot exceed 255 characters')
})

export const RecentCourseSchema = z.object({
  title: z.string().min(1).max(200),
  id: z.number().positive()
})

export type OsProgressPayload = z.infer<typeof OsProgressSchema>
export type TrayTooltipPayload = z.infer<typeof TrayTooltipSchema>
export type RecentCoursePayload = z.infer<typeof RecentCourseSchema>
