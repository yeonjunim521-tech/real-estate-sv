import { describe, expect, it, vi } from "vitest"
import { handleApiRequest } from "../src/worker"
import type {
  D1Value,
  SnapshotDatabase,
  SnapshotStatement,
  TransactionPageRow,
} from "../src/transaction-store"

const request = new Request(
  "https://example.com/api/real-estate?type=apt&lawdCd=11230&dealYmd=202504",
)

function pagePayload(pageNo: number, items: readonly Record<string, unknown>[]) {
  return JSON.stringify({
    response: {
      header: { resultCode: "000" },
      body: { items: { item: items }, numOfRows: 100, pageNo, totalCount: 101 },
    },
  })
}

function databaseWithRows(rows: readonly TransactionPageRow[]): SnapshotDatabase {
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

function completeRows(): readonly TransactionPageRow[] {
  const firstItems = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
  return [
    {
      property_type: "apt",
      lawd_cd: "11230",
      deal_ymd: "202504",
      page_no: 1,
      payload_json: pagePayload(1, firstItems),
      item_count: 100,
      total_count: 101,
      fetched_at: "2026-07-15T08:00:00.000Z",
    },
    {
      property_type: "apt",
      lawd_cd: "11230",
      deal_ymd: "202504",
      page_no: 2,
      payload_json: pagePayload(2, [{ id: 101 }]),
      item_count: 1,
      total_count: 101,
      fetched_at: "2026-07-15T08:00:01.000Z",
    },
  ]
}

describe("D1 transaction fallback", () => {
  it("returns a complete stored month when MOLIT is unavailable", async () => {
    const firstItems = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
    const database = databaseWithRows(completeRows())
    const fetchUpstream = vi.fn(async () => new Response(null, { status: 503 }))

    const response = await handleApiRequest(
      request,
      { serviceKey: "test-secret", fetchUpstream, database },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Data-Source")).toBe("d1-fallback")
    expect(response.headers.get("X-Data-Status")).toBe("complete")
    expect(response.headers.get("X-Data-Fetched-At")).toBe("2026-07-15T08:00:01.000Z")
    await expect(response.json()).resolves.toMatchObject({
      response: { body: { totalCount: 101, items: { item: [...firstItems, { id: 101 }] } } },
    })
  })

  it("returns a complete stored month when MOLIT reports an application error", async () => {
    const database = databaseWithRows(completeRows())
    const fetchUpstream = vi.fn(async () =>
      Response.json({ response: { header: { resultCode: "30", resultMsg: "SERVICE ERROR" } } }),
    )

    const response = await handleApiRequest(
      request,
      { serviceKey: "test-secret", fetchUpstream, database },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Data-Source")).toBe("d1-fallback")
  })

  it("returns a complete stored month when the MOLIT connection fails", async () => {
    const database = databaseWithRows(completeRows())
    const fetchUpstream = vi.fn(async () => {
      throw new TypeError("network unavailable")
    })

    const response = await handleApiRequest(request, {
      serviceKey: "test-secret",
      fetchUpstream,
      database,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Data-Source")).toBe("d1-fallback")
  })

  it("keeps the upstream error when the stored month is incomplete", async () => {
    const database = databaseWithRows([
      {
        property_type: "apt",
        lawd_cd: "11230",
        deal_ymd: "202504",
        page_no: 1,
        payload_json: pagePayload(1, [{ id: 1 }]),
        item_count: 100,
        total_count: 101,
        fetched_at: "2026-07-15T08:00:00.000Z",
      },
    ])
    const fetchUpstream = vi.fn(async () => new Response(null, { status: 503 }))

    const response = await handleApiRequest(
      request,
      { serviceKey: "test-secret", fetchUpstream, database },
    )

    expect(response.status).toBe(503)
    expect(response.headers.get("X-Data-Source")).toBeNull()
  })
})
