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
