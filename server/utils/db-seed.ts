import type { PlannerDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createDemoState } from '~~/server/utils/demo-state'

export async function seedDemoData(db: PlannerDatabase) {
  const config = useRuntimeConfig()
  const state = await createDemoState(config.demoUserEmail, config.demoUserPassword)

  await db.transaction(async tx => {
    await tx.insert(tables.users).values(state.users)
    if (state.objectives.length) await tx.insert(tables.objectives).values(state.objectives)
    if (state.tasks.length) await tx.insert(tables.tasks).values(state.tasks)
    if (state.timeBlocks.length) await tx.insert(tables.timeBlocks).values(state.timeBlocks)
    if (state.focusSessions.length) await tx.insert(tables.focusSessions).values(state.focusSessions)
    if (state.journalEntries.length) await tx.insert(tables.journalEntries).values(state.journalEntries)
    if (state.goalAreas.length) await tx.insert(tables.goalAreas).values(state.goalAreas)
    if (state.goalMilestones.length) await tx.insert(tables.goalMilestones).values(state.goalMilestones)
    if (state.financeAccounts.length) await tx.insert(tables.financeAccounts).values(state.financeAccounts)
    if (state.financeCategories.length) await tx.insert(tables.financeCategories).values(state.financeCategories)
    if (state.financeTransactions.length) await tx.insert(tables.financeTransactions).values(state.financeTransactions)
    if (state.monthlyTargets.length) await tx.insert(tables.monthlyTargets).values(state.monthlyTargets)
    if (state.aiBriefs.length) await tx.insert(tables.aiBriefs).values(state.aiBriefs)
  })
}

export async function wipeAllData(db: PlannerDatabase) {
  await db.transaction(async tx => {
    // Child tables first, then parents, to satisfy foreign keys.
    await tx.delete(tables.auditEvents)
    await tx.delete(tables.aiBriefs)
    await tx.delete(tables.monthlyTargets)
    await tx.delete(tables.financeTransactions)
    await tx.delete(tables.financeCategories)
    await tx.delete(tables.financeAccounts)
    await tx.delete(tables.goalMilestones)
    await tx.delete(tables.goalAreas)
    await tx.delete(tables.journalEntries)
    await tx.delete(tables.focusSessions)
    await tx.delete(tables.timeBlocks)
    await tx.delete(tables.tasks)
    await tx.delete(tables.objectives)
    await tx.delete(tables.passwordResetTokens)
    await tx.delete(tables.emailVerificationTokens)
    await tx.delete(tables.authIdentities)
    await tx.delete(tables.users)
  })
}
