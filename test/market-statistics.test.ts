import { describe, expect, it, vi } from "vitest"
import {
  listMarketStatistics,
  parseMarketStatisticsQuery,
  saveMarketStatistic,
  type MarketDatabase,
  type MarketStatisticRow,
  type MarketStatement,
} from "../src/market-statistics"

function recordingDatabase(rows: readonly MarketStatisticRow[] = []) {
  const queries: string[] = []
  const bindings: (string | number)[][] = []
  const run = vi.fn(async () => ({ success: true }))
  const database: MarketDatabase = {
    prepare(query) {
      queries.push(query)
      const statement: MarketStatement = {
        bind(...values) {
          bindings.push(values)
          return statement
        },
        run,
        async all() {
          return { results: rows }
        },
      }
      return statement
    },
  }
  return { database, queries, bindings, run }
}

describe("monthly market statistics", () => {
  it("parses a region and month query when both values follow the public contract", () => {
    const url = new URL("https://example.com/api/market-statistics?regionCode=11680&month=202606")

    expect(parseMarketStatisticsQuery(url)).toEqual({ regionCode: "11680", month: "202606" })
  })

  it("rejects an invalid region or month at the request boundary", () => {
    const url = new URL("https://example.com/api/market-statistics?regionCode=1168&month=202613")

    expect(parseMarketStatisticsQuery(url)).toBeUndefined()
  })

  it("upserts one official monthly metric with its source dates", async () => {
    const recorder = recordingDatabase()

    await saveMarketStatistic(recorder.database, {
      regionCode: "11680",
      month: "202606",
      metric: "unsold-units",
      value: 125,
      unit: "unit",
      source: "MOLIT",
      sourceUpdatedAt: "2026-07-01",
      fetchedAt: "2026-07-15T12:00:00.000Z",
    })

    expect(recorder.queries[0]).toContain("INSERT INTO market_statistics")
    expect(recorder.bindings[0]).toEqual([
      "11680",
      "202606",
      "unsold-units",
      125,
      "unit",
      "MOLIT",
      "2026-07-01",
      "2026-07-15T12:00:00.000Z",
    ])
    expect(recorder.run).toHaveBeenCalledOnce()
  })

  it("returns comparable metrics in stable metric order", async () => {
    const recorder = recordingDatabase([
      {
        region_code: "11680",
        reference_month: "202606",
        metric: "population",
        value: 560000,
        unit: "person",
        source: "MOIS",
        source_updated_at: "2026-07-01",
        fetched_at: "2026-07-15T12:00:00.000Z",
      },
      {
        region_code: "11680",
        reference_month: "202606",
        metric: "unsold-units",
        value: 125,
        unit: "unit",
        source: "MOLIT",
        source_updated_at: "2026-07-01",
        fetched_at: "2026-07-15T12:00:00.000Z",
      },
    ])

    const result = await listMarketStatistics(recorder.database, { regionCode: "11680", month: "202606" })

    expect(recorder.queries[0]).toContain("ORDER BY metric ASC")
    expect(recorder.bindings[0]).toEqual(["11680", "202606"])
    expect(result.map((item) => item.metric)).toEqual(["population", "unsold-units"])
    expect(result[0]?.source).toBe("MOIS")
  })
})
