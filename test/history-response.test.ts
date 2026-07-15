import { describe, expect, it } from "vitest"
import { handleHistoryRequest } from "../src/history-response"
import type {
  D1Value,
  SnapshotDatabase,
  SnapshotStatement,
  TransactionPageRow,
} from "../src/transaction-store"

const historyUrl =
  "https://example.com/api/real-estate/history?type=apt&lawdCd=11230&dealYmd=202606"

function databaseWithMonths(months: readonly string[]): SnapshotDatabase {
  const rows: readonly TransactionPageRow[] = months.map((dealYmd) => ({
    property_type: "apt",
    lawd_cd: "11230",
    deal_ymd: dealYmd,
    page_no: 1,
    payload_json: "{}",
    item_count: 1,
    total_count: 1,
    fetched_at: "2026-07-15T08:00:00.000Z",
  }))
  return {
    prepare() {
      const statement: SnapshotStatement = {
        bind(..._values: D1Value[]) {
          return statement
        },
        async run() {
          return { success: true }
        },
        async all() {
          return { results: rows }
        },
      }
      return statement
    },
  }
}

describe("five-year history response", () => {
  it("reports stored, missing, and the next three collection months", async () => {
    const response = await handleHistoryRequest(
      new Request(historyUrl),
      databaseWithMonths(["202606", "202604"]),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      query: {
        propertyType: "apt",
        lawdCd: "11230",
        fromDealYmd: "202107",
        toDealYmd: "202606",
      },
      progress: {
        status: "collecting",
        completedCount: 2,
        totalCount: 60,
        availableMonths: ["202606", "202604"],
        nextCollectionMonths: ["202605", "202603", "202602"],
      },
    })
  })

  it("rejects invalid history query parameters", async () => {
    const response = await handleHistoryRequest(
      new Request("https://example.com/api/real-estate/history?type=apt&lawdCd=1123&dealYmd=202606"),
      databaseWithMonths([]),
    )

    expect(response.status).toBe(400)
  })

  it("returns 503 when D1 is unavailable", async () => {
    const response = await handleHistoryRequest(new Request(historyUrl), undefined)

    expect(response.status).toBe(503)
  })
})
