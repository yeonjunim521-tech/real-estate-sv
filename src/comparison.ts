export type ComparisonTransaction = {
  readonly priceTenThousandWon: number
  readonly areaSquareMeters: number | null
  readonly cancelled: boolean
}

export type ComparisonRentTransaction = {
  readonly depositTenThousandWon: number
  readonly monthlyRentTenThousandWon: number
}

export type ComparisonRegulation = {
  readonly buildingCoverageLimitPercent: number
  readonly floorAreaRatioLimitPercent: number
}

export type ComparisonTarget = {
  readonly id: string
  readonly label: string
  readonly period: string
  readonly transactions: readonly ComparisonTransaction[]
  readonly rentTransactions: readonly ComparisonRentTransaction[]
  readonly regulation: ComparisonRegulation | null
}

type ComparisonMetrics = {
  readonly id: string
  readonly label: string
  readonly period: string
  readonly transactionCount: number
  readonly medianPriceTenThousandWon: number | null
  readonly medianPricePerPyeongTenThousandWon: number | null
  readonly rent: {
    readonly jeonseCount: number
    readonly monthlyCount: number
    readonly medianDepositTenThousandWon: number
    readonly medianMonthlyRentTenThousandWon: number
  } | null
  readonly regulation: ComparisonRegulation | null
}

export type ComparisonResult =
  | { readonly kind: "compared"; readonly period: string; readonly targets: readonly ComparisonMetrics[] }
  | {
      readonly kind: "rejected"
      readonly reason: "no-targets" | "too-many-targets" | "duplicate-target" | "period-mismatch"
    }

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]
  if (upper === undefined) return null
  if (sorted.length % 2 === 1) return upper
  const lower = sorted[middle - 1]
  return lower === undefined ? null : (lower + upper) / 2
}

function summarizeTarget(target: ComparisonTarget): ComparisonMetrics {
  const transactions = target.transactions.filter(
    transaction => !transaction.cancelled && transaction.priceTenThousandWon > 0,
  )
  const pricesPerPyeong = transactions.flatMap(transaction => {
    if (transaction.areaSquareMeters === null || transaction.areaSquareMeters <= 0) return []
    return [transaction.priceTenThousandWon / (transaction.areaSquareMeters * 0.3025)]
  })
  const deposits = target.rentTransactions.map(transaction => transaction.depositTenThousandWon)
  const monthlyRents = target.rentTransactions.map(transaction => transaction.monthlyRentTenThousandWon)
  const medianDeposit = median(deposits)
  const medianMonthlyRent = median(monthlyRents)

  return {
    id: target.id,
    label: target.label,
    period: target.period,
    transactionCount: transactions.length,
    medianPriceTenThousandWon: median(transactions.map(transaction => transaction.priceTenThousandWon)),
    medianPricePerPyeongTenThousandWon: median(pricesPerPyeong),
    rent:
      medianDeposit === null || medianMonthlyRent === null
        ? null
        : {
            jeonseCount: target.rentTransactions.filter(
              transaction => transaction.monthlyRentTenThousandWon === 0,
            ).length,
            monthlyCount: target.rentTransactions.filter(
              transaction => transaction.monthlyRentTenThousandWon > 0,
            ).length,
            medianDepositTenThousandWon: medianDeposit,
            medianMonthlyRentTenThousandWon: medianMonthlyRent,
          },
    regulation: target.regulation,
  }
}

export function compareTargets(targets: readonly ComparisonTarget[]): ComparisonResult {
  if (targets.length === 0) return { kind: "rejected", reason: "no-targets" }
  if (targets.length > 3) return { kind: "rejected", reason: "too-many-targets" }
  if (new Set(targets.map(target => target.id)).size !== targets.length) {
    return { kind: "rejected", reason: "duplicate-target" }
  }
  const period = targets[0]?.period
  if (period === undefined || targets.some(target => target.period !== period)) {
    return { kind: "rejected", reason: "period-mismatch" }
  }
  return { kind: "compared", period, targets: targets.map(summarizeTarget) }
}
