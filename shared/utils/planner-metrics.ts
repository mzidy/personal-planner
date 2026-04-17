export function calculateCompletionRate(total: number, completed: number) {
  if (total <= 0) {
    return 0
  }

  return Math.round((completed / total) * 100)
}

export function calculateSavingsRate(income: number, spend: number) {
  if (income <= 0) {
    return 0
  }

  return Math.max(Math.round(((income - spend) / income) * 100), 0)
}

export function calculateBudgetHealth(limit: number | null | undefined, spend: number) {
  if (!limit || limit <= 0) {
    return 82
  }

  return Math.max(Math.round(100 - (spend / limit) * 100), 0)
}
