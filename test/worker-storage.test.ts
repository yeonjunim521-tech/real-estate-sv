import { describe, expect, it, vi } from "vitest"
import { handleApiRequest } from "../src/worker"
import type { ApiDependencies } from "../src/worker"
import type { D1Value, SnapshotDatabase, SnapshotStatement } from "../src/transaction-store"

const secret = "test-secret"
const request = new Request(
  "https://example.com/api/real-estate?type=apt&lawdCd=11680&dealYmd=202606",
)

type DependencyOverrides = Omit<Partial<ApiDependencies>, "serviceKey" | "fetchUpstream">

function dependencies(
  fetchUpstream: ApiDependencies["fetchUpstream"],
  overrides: DependencyOverrides = {},
): ApiDependencies {
  return { serviceKey: secret, fetchUpstream, ...overrides }
}

describe("Worker storage", () => {
  it("caches successful responses with a key that excludes the service key", async () => {
    const entries = new Map<string, Response>()
    const cache = {
      match: vi.fn(async (cacheRequest: Request) => entries.get(cacheRequest.url)?.clone()),
      put: vi.fn(async (cacheRequest: Request, response: Response) => {
        entries.set(cacheRequest.url, response.clone())
      }),
    }
    const fetchUpstream = vi.fn(async () =>
      Response.json({ response: { header: { resultCode: "000" } } }),
    )

    const firstResponse = await handleApiRequest(
      request,
      dependencies(fetchUpstream, { cache }),
    )

    expect(firstResponse.status).toBe(200)
    expect(cache.put).toHaveBeenCalledOnce()
    const cacheKey = cache.put.mock.calls[0]?.[0]?.url ?? ""
    expect(cacheKey).toContain("type=apt")
    expect(cacheKey).not.toContain("serviceKey")
    expect(cacheKey).not.toContain(secret)

    const secondFetch = vi.fn(async () => {
      throw new Error("cache miss")
    })
    const secondResponse = await handleApiRequest(
      request,
      dependencies(secondFetch, { cache }),
    )

    expect(secondResponse.status).toBe(200)
    expect(secondResponse.headers.get("X-Data-Source")).toBe("molit")
    expect(secondResponse.headers.get("X-Data-Status")).toBe("complete")
    expect(secondFetch).not.toHaveBeenCalled()
  })

  it("caches a successful fetch response without mutating immutable headers", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async (_request: Request, _response: Response) => undefined),
    }
    const fetchUpstream = vi.fn(async () =>
      fetch("data:application/json,%7B%22response%22%3A%7B%22header%22%3A%7B%22resultCode%22%3A%22000%22%7D%7D%7D"),
    )

    const response = await handleApiRequest(request, dependencies(fetchUpstream, { cache }))

    expect(response.status).toBe(200)
    expect(cache.put).toHaveBeenCalledOnce()
    expect(cache.put.mock.calls[0]?.[1]?.headers.get("Cache-Control")).toBe("s-maxage=300")
  })

  it("does not cache a successful response with Set-Cookie", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async (_request: Request, _response: Response) => undefined),
    }
    const fetchUpstream = vi.fn(async () =>
      new Response(JSON.stringify({ response: { header: { resultCode: "000" } } }), {
        headers: { "Content-Type": "application/json", "Set-Cookie": "session=test" },
      }),
    )

    await handleApiRequest(request, dependencies(fetchUpstream, { cache }))

    expect(cache.put).not.toHaveBeenCalled()
  })

  it("does not cache a MOLIT application error", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async (_request: Request, _response: Response) => undefined),
    }
    const fetchUpstream = vi.fn(async () =>
      Response.json({ response: { header: { resultCode: "29000" } } }),
    )

    await handleApiRequest(request, dependencies(fetchUpstream, { cache }))

    expect(cache.put).not.toHaveBeenCalled()
  })

  it("stores a successful MOLIT page in D1 without delaying the response", async () => {
    const bindings: D1Value[][] = []
    const queries: string[] = []
    let finishWrite: (() => void) | undefined
    const writeFinished = new Promise<void>((resolve) => {
      finishWrite = resolve
    })
    const statement: SnapshotStatement = {
      bind(...values) {
        bindings.push(values)
        return statement
      },
      run: vi.fn(() => writeFinished),
      async all() {
        return { results: [] }
      },
    }
    const database: SnapshotDatabase = {
      prepare: vi.fn((query) => {
        queries.push(query)
        return statement
      }),
    }
    const waitUntil = vi.fn<(promise: Promise<unknown>) => void>()
    const payload = {
      response: {
        header: { resultCode: "000" },
        body: { items: { item: [{ aptNm: "테스트아파트" }] }, totalCount: 1 },
      },
    }
    const fetchUpstream = vi.fn(async () => Response.json(payload))

    const response = await handleApiRequest(
      request,
      dependencies(fetchUpstream, {
        waitUntil,
        database,
        now: () => "2026-07-15T08:00:00.000Z",
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Data-Source")).toBe("molit")
    expect(response.headers.get("X-Data-Status")).toBe("complete")
    expect(response.headers.get("X-Data-Fetched-At")).toBe("2026-07-15T08:00:00.000Z")
    expect(waitUntil).toHaveBeenCalledOnce()
    expect(bindings[0]?.slice(0, 7)).toEqual([
      "apt",
      "11680",
      "202606",
      1,
      JSON.stringify(payload),
      1,
      1,
    ])
    expect(queries.some((query) => query.includes("INSERT INTO ingestion_runs"))).toBe(false)
    finishWrite?.()
    await waitUntil.mock.calls[0]?.[0]
    expect(queries.some((query) => query.includes("INSERT INTO ingestion_runs"))).toBe(true)
    expect(bindings[1]).toEqual([
      "apt",
      "11680",
      "202606",
      "complete",
      "2026-07-15T08:00:00.000Z",
      "2026-07-15T08:00:00.000Z",
      1,
      1,
      null,
    ])
  })
})
