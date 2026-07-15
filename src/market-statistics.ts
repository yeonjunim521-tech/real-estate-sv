const MARKET_METRICS = [
  "supply-units",
  "move-in-units",
  "unsold-units",
  "presale-units",
  "population",
  "households",
  "net-migration",
] as const

export type MarketMetric = (typeof MARKET_METRICS)[number]
export type MarketUnit = "unit" | "person" | "household"

export type MarketStatisticsQuery = {
  readonly regionCode: string
  readonly month: string
}

export type MarketStatistic = MarketStatisticsQuery & {
  readonly metric: MarketMetric
  readonly value: number
  readonly unit: MarketUnit
  readonly source: string
  readonly sourceUpdatedAt: string
  readonly fetchedAt: string
}

export type MarketStatisticRow = {
  readonly region_code: string
  readonly reference_month: string
  readonly metric: MarketMetric
  readonly value: number
  readonly unit: MarketUnit
  readonly source: string
  readonly source_updated_at: string
  readonly fetched_at: string
}

type MarketValue = string | number

export type MarketStatement = {
  bind(...values: MarketValue[]): MarketStatement
  run(): Promise<unknown>
  all(): Promise<{ readonly results: readonly MarketStatisticRow[] }>
}

export type MarketDatabase = {
  prepare(query: string): MarketStatement
}

export function parseMarketStatisticsQuery(url: URL): MarketStatisticsQuery | undefined {
  const regionCode = url.searchParams.get("regionCode")
  const month = url.searchParams.get("month")
  if (!regionCode || !/^\d{5}$/.test(regionCode) || !month || !/^\d{4}(0[1-9]|1[0-2])$/.test(month)) {
    return undefined
  }
  return { regionCode, month }
}

export async function saveMarketStatistic(database: MarketDatabase, statistic: MarketStatistic): Promise<void> {
  await database
    .prepare(`
      INSERT INTO market_statistics (
        region_code, reference_month, metric, value, unit, source, source_updated_at, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (region_code, reference_month, metric, source) DO UPDATE SET
        value = excluded.value,
        unit = excluded.unit,
        source_updated_at = excluded.source_updated_at,
        fetched_at = excluded.fetched_at
    `)
    .bind(
      statistic.regionCode,
      statistic.month,
      statistic.metric,
      statistic.value,
      statistic.unit,
      statistic.source,
      statistic.sourceUpdatedAt,
      statistic.fetchedAt,
    )
    .run()
}

export async function listMarketStatistics(
  database: MarketDatabase,
  query: MarketStatisticsQuery,
): Promise<readonly MarketStatistic[]> {
  const result = await database
    .prepare(`
      SELECT region_code, reference_month, metric, value, unit, source, source_updated_at, fetched_at
      FROM market_statistics
      WHERE region_code = ? AND reference_month = ?
      ORDER BY metric ASC
    `)
    .bind(query.regionCode, query.month)
    .all()

  return result.results.map((row) => ({
    regionCode: row.region_code,
    month: row.reference_month,
    metric: row.metric,
    value: row.value,
    unit: row.unit,
    source: row.source,
    sourceUpdatedAt: row.source_updated_at,
    fetchedAt: row.fetched_at,
  }))
}
