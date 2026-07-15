import { describe, expect, it, vi } from "vitest"
import { routeRequest } from "../src/worker"
import type { ApiDependencies } from "../src/worker"
import type { D1Value, SnapshotDatabase, SnapshotStatement } from "../src/transaction-store"

function recordingDatabase() {
  const bindings: D1Value[][] = []
  const statement: SnapshotStatement = {
    bind(...values) {
      bindings.push(values)
      return statement
    },
    async run() {
      return { success: true }
    },
    async all() {
      return { results: [] }
    },
  }
  const database: SnapshotDatabase = { prepare: vi.fn(() => statement) }
  return { database, bindings }
}

describe("rental Worker route", () => {
  it("fetches the official rental API, normalizes it, and stores it separately from trades", async () => {
    const recorder = recordingDatabase()
    const officialItem = {
      sggCd: "11230",
      umdNm: "답십리동",
      aptNm: "테스트아파트",
      excluUseAr: "84.97",
      dealYear: "2026",
      dealMonth: "6",
      dealDay: "9",
      deposit: "10,000",
      monthlyRent: "0",
    }
    const fetchUpstream = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({
        response: {
          header: { resultCode: "000" },
          body: { items: { item: [officialItem] }, totalCount: 1 },
        },
      }),
    )
    const fetchAsset = vi.fn(async () => new Response("asset"))
    const dependencies: ApiDependencies = {
      serviceKey: "test-secret",
      fetchUpstream,
      database: recorder.database,
      now: () => "2026-07-15T10:00:00.000Z",
    }

    const response = await routeRequest(
      new Request(
        "https://example.com/api/real-estate/rent?type=apt&lawdCd=11230&dealYmd=202606",
      ),
      dependencies,
      fetchAsset,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Transaction-Type")).toBe("rent")
    expect(fetchAsset).not.toHaveBeenCalled()
    const upstreamUrl = new URL(String(fetchUpstream.mock.calls[0]?.[0]))
    expect(upstreamUrl.pathname).toBe(
      "/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
    )
    await expect(response.json()).resolves.toMatchObject({
      normalizedRent: {
        itemCount: 1,
        issueCount: 0,
        items: [{ transactionType: "rent", rentType: "jeonse" }],
      },
    })
    expect(recorder.bindings[0]?.[0]).toBe("rent-apt")
    expect(recorder.bindings[1]?.[0]).toBe("rent-apt")
  })
})
