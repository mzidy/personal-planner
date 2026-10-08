import type { GrowthStep } from '~~/shared/utils/growth-steps'

export interface GrowthAnswerRecord {
  id: string
  userId: string
  stepKey: string
  answer: string
  createdAt: string
  updatedAt: string
}

export interface GrowthStepState extends GrowthStep {
  answer: string
  answeredAt: string | null
}

export interface GrowthOverview {
  steps: GrowthStepState[]
  answeredCount: number
  totalCount: number
}
