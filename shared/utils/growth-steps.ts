/**
 * The Personal Growth prompts, in order.
 *
 * Answers are stored against `key`, so keys are permanent: renaming one orphans
 * whatever was written against it. Adding a step is just another entry here —
 * the page and the API pick it up with no further changes.
 */
export interface GrowthStep {
  key: string
  question: string
  hint: string
}

export const GROWTH_STEPS: GrowthStep[] = [
  {
    key: 'why-alive',
    question: 'Why am I alive?',
    hint: 'Not how you got here — what you are here for.'
  },
  {
    key: 'give-life',
    question: 'For what would I be willing to give my life?',
    hint: 'The answer tends to name what you actually value most.'
  }
]

export const GROWTH_STEP_KEYS = GROWTH_STEPS.map(step => step.key)

export function isGrowthStepKey(value: string) {
  return GROWTH_STEP_KEYS.includes(value)
}
