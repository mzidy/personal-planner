import type { PlannerState } from '~~/shared/types/planner'
import { createDemoState } from '~~/server/utils/demo-state'

const STORAGE_KEY = 'planner:state'

export async function readPlannerState() {
  const storage = useStorage()
  const existing = await storage.getItem<PlannerState>(STORAGE_KEY)

  if (existing) {
    return existing
  }

  const config = useRuntimeConfig()
  const seeded = await createDemoState(config.demoUserEmail, config.demoUserPassword)
  await storage.setItem(STORAGE_KEY, seeded)
  return seeded
}

export async function writePlannerState(state: PlannerState) {
  await useStorage().setItem(STORAGE_KEY, state)
  return state
}

export async function resetPlannerState() {
  await useStorage().removeItem(STORAGE_KEY)
}
