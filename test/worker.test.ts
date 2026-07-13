import { describe, expect, it, vi } from "vitest"
import { createWorkerHandler, handleApiRequest, routeRequest } from "../src/worker"

const secret = "test-secret"

function apiRequest(query: string, method = "GET") {
  return new Request(`https://example.com/api/real-estate?${query}`, { method })
}

describe("handleApiRequest", () => {
  it("routes an apartment request to the fixed MOLIT endpoint with the secret", async () => {
    const fetchUpstream = vi.fn(async (
      _input: Parameters<typeof fetch>[0],
      _init?: Parameters<typeof fetch>[1],
    ) =>
      Response.json({ response: { header: { resultCode: "000" } } }),
    )

    const response = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
    )

    expect(response.status).toBe(200)
    expect(fetchUpstream).toHaveBeenCalledOnce()
    const upstreamUrl = new URL(String(fetchUpstream.mock.calls[0]?.[0]))
    expect(upstreamUrl.hostname).toBe("apis.data.go.kr")
    expect(upstreamUrl.pathname).toBe(
      "/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
    )
    expect(upstreamUrl.searchParams.get("serviceKey")).toBe(secret)
    expect(upstreamUrl.searchParams.get("LAWD_CD")).toBe("11680")
    expect(upstreamUrl.searchParams.get("DEAL_YMD")).toBe("202606")
    expect(upstreamUrl.searchParams.get("_type")).toBe("json")
    expect(upstreamUrl.searchParams.get("numOfRows")).toBe("100")
  })

  it("caches successful responses with a key that excludes the service key", async () => {
    const entries = new Map<string, Response>()
    const cache = {
      match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
      put: vi.fn(async (request: Request, response: Response) => {
        entries.set(request.url, response.clone())
      }),
    }
    const fetchUpstream = vi.fn(async () =>
      new Response(JSON.stringify({ response: { header: { resultCode: "000" } } }), {
        headers: { "Content-Type": "application/json", "Set-Cookie": "session=test" },
      }),
    )

    const firstResponse = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
      undefined,
      cache,
    )

    expect(firstResponse.status).toBe(200)
    expect(cache.put).toHaveBeenCalledOnce()
    const cacheKey = cache.put.mock.calls[0]?.[0]?.url ?? ""
    expect(cacheKey).toContain("type=apt")
    expect(cacheKey).not.toContain("serviceKey")
    expect(cacheKey).not.toContain(secret)
    expect(cache.put.mock.calls[0]?.[1]?.headers.get("Cache-Control")).toBe("s-maxage=300")
    expect(cache.put.mock.calls[0]?.[1]?.headers.get("Set-Cookie")).toBeNull()

    const secondFetch = vi.fn(async () => {
      throw new Error("cache miss")
    })
    const secondResponse = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      secondFetch,
      undefined,
      cache,
    )

    expect(secondResponse.status).toBe(200)
    expect(secondFetch).not.toHaveBeenCalled()
  })

  it("caches a successful response returned by fetch without mutating immutable headers", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async (_request: Request, _response: Response) => undefined),
    }
    const fetchUpstream = vi.fn(async () =>
      fetch("data:application/json,%7B%22response%22%3A%7B%22header%22%3A%7B%22resultCode%22%3A%22000%22%7D%7D%7D"),
    )

    const response = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
      undefined,
      cache,
    )

    expect(response.status).toBe(200)
    expect(cache.put).toHaveBeenCalledOnce()
    expect(cache.put.mock.calls[0]?.[1]?.headers.get("Cache-Control")).toBe("s-maxage=300")
  })

  it("does not cache an application-level MOLIT error in an HTTP 200 response", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
    }
    const fetchUpstream = vi.fn(async () =>
      Response.json({ response: { header: { resultCode: "29000" } } }),
    )

    const response = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
      undefined,
      cache,
    )

    expect(response.status).toBe(200)
    expect(cache.put).not.toHaveBeenCalled()
  })

  it("returns 429 without calling upstream when the client exceeds the rate limit", async () => {
    const fetchUpstream = vi.fn()
    const rateLimiter = {
      limit: vi.fn(async () => ({ success: false })),
    }

    const response = await handleApiRequest(
      new Request("https://example.com/api/real-estate?type=apt&lawdCd=11680&dealYmd=202606", {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      }),
      secret,
      fetchUpstream,
      rateLimiter,
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
    await expect(response.json()).resolves.toEqual({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    })
    expect(rateLimiter.limit).toHaveBeenCalledWith({ key: "real-estate:203.0.113.10" })
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it("returns 503 without calling upstream when the rate limiter fails", async () => {
    const fetchUpstream = vi.fn()
    const rateLimiter = {
      limit: vi.fn(async () => {
        throw new Error("rate limiter unavailable")
      }),
    }

    const response = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
      rateLimiter,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "요청 제한 서비스를 사용할 수 없습니다.",
    })
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it("sanitizes non-OK upstream responses while preserving their status", async () => {
    const fetchUpstream = vi.fn(async () =>
      new Response(`serviceKey=${secret}&error=upstream details`, { status: 503 }),
    )

    const response = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
    )

    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    const body = await response.text()
    expect(body).toBe(JSON.stringify({ error: "국토부 API 요청이 실패했습니다." }))
    expect(body).not.toContain(secret)
  })

  it.each([
    "type=unknown&lawdCd=11680&dealYmd=202606",
    "type=apt&lawdCd=1168&dealYmd=202606",
    "type=apt&lawdCd=11680&dealYmd=202613",
    "type=apt&lawdCd=11680&dealYmd=not-a-month",
  ])("rejects invalid query parameters: %s", async (query) => {
    const fetchUpstream = vi.fn()

    const response = await handleApiRequest(apiRequest(query), secret, fetchUpstream)

    expect(response.status).toBe(400)
    expect(fetchUpstream).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "요청 값을 확인해 주세요." })
  })

  it("rejects methods other than GET", async () => {
    const fetchUpstream = vi.fn()

    const response = await handleApiRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606", "POST"),
      secret,
      fetchUpstream,
    )

    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toBe("GET")
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it("returns a sanitized 502 response when the upstream transport fails", async () => {
    const fetchUpstream = vi.fn(async () => {
      throw new Error(`network failed with ${secret}`)
    })

    const response = await handleApiRequest(
      apiRequest("type=land&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchUpstream,
    )

    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain(secret)
    expect(fetchUpstream).toHaveBeenCalledOnce()
  })
})

describe("routeRequest", () => {
  it("creates a handler with an injected upstream fetcher", async () => {
    const fetchAsset = vi.fn(async () => new Response("asset"))
    const fetchUpstream = vi.fn(async () => Response.json({ ok: true }))
    const handler = createWorkerHandler(fetchUpstream)

    const response = await handler(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchAsset,
    )

    expect(response.status).toBe(200)
    expect(fetchUpstream).toHaveBeenCalledOnce()
    expect(fetchAsset).not.toHaveBeenCalled()
  })

  it("applies the injected rate limiter before upstream access", async () => {
    const fetchAsset = vi.fn(async () => new Response("asset"))
    const fetchUpstream = vi.fn(async () => Response.json({ ok: true }))
    const rateLimiter = {
      limit: vi.fn(async () => ({ success: true })),
    }
    const handler = createWorkerHandler(fetchUpstream, rateLimiter)

    const response = await handler(
      new Request("https://example.com/api/real-estate?type=apt&lawdCd=11680&dealYmd=202606", {
        headers: { "CF-Connecting-IP": "203.0.113.10" },
      }),
      secret,
      fetchAsset,
    )

    expect(response.status).toBe(200)
    expect(rateLimiter.limit).toHaveBeenCalledWith({ key: "real-estate:203.0.113.10" })
    expect(fetchUpstream).toHaveBeenCalledOnce()
  })

  it("serves non-API requests from the static assets binding", async () => {
    const fetchAsset = vi.fn(async () => new Response("asset"))
    const fetchUpstream = vi.fn()

    const response = await routeRequest(
      new Request("https://example.com/style.css"),
      secret,
      fetchAsset,
      fetchUpstream,
    )

    expect(await response.text()).toBe("asset")
    expect(fetchAsset).toHaveBeenCalledOnce()
    expect(fetchUpstream).not.toHaveBeenCalled()
  })

  it("routes only the real-estate API path to the upstream handler", async () => {
    const fetchAsset = vi.fn(async () => new Response("asset"))
    const fetchUpstream = vi.fn(async () => Response.json({ ok: true }))

    const response = await routeRequest(
      apiRequest("type=apt&lawdCd=11680&dealYmd=202606"),
      secret,
      fetchAsset,
      fetchUpstream,
    )

    expect(response.status).toBe(200)
    expect(fetchUpstream).toHaveBeenCalledOnce()
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})
