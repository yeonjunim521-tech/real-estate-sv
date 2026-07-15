export type HistoryStatus = "collecting" | "complete"

export type HistoryProgress = {
  readonly status: HistoryStatus
  readonly completedCount: number
  readonly totalCount: number
  readonly availableMonths: readonly string[]
  readonly missingMonths: readonly string[]
  readonly nextCollectionMonths: readonly string[]
}

export function listRecentMonths(endMonth: string, count = 60): readonly string[] {
  const year = Number(endMonth.slice(0, 4))
  const monthIndex = Number(endMonth.slice(4, 6)) - 1

  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(year, monthIndex - offset, 1))
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`
  })
}

export function createHistoryProgress(
  months: readonly string[],
  storedMonths: readonly string[],
  batchLimit: number,
): HistoryProgress {
  const storedMonthSet = new Set(storedMonths)
  const availableMonths = months.filter((month) => storedMonthSet.has(month))
  const missingMonths = months.filter((month) => !storedMonthSet.has(month))

  return {
    status: missingMonths.length === 0 ? "complete" : "collecting",
    completedCount: availableMonths.length,
    totalCount: months.length,
    availableMonths,
    missingMonths,
    nextCollectionMonths: missingMonths.slice(0, batchLimit),
  }
}
