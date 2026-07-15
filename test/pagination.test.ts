import { describe, expect, it, vi } from "vitest"
import { handleApiRequest } from "../src/worker"

const secret = "test-secret"

function apiRequest() {
  return new Request(
    "https://example.com/api/real-estate?type=apt&lawdCd=11350&dealYmd=202606",
  )
}

describe("MOLIT pagination", () => {
  it("returns every transaction when totalCount spans multiple pages", async () => {
    const expectedItems = Array.from({ length: 205 }, (_, index) => ({ id: index + 1 }))
    const fetchUpstream = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const pageNo = Number(new URL(String(input)).searchParams.get("pageNo") ?? "1")
      const start = (pageNo - 1) * 100
      const items = expectedItems.slice(start, start + 100)

      return Response.json({
        response: {
          header: { resultCode: "000" },
          body: {
            items: { item: items },
            numOfRows: 100,
            pageNo,
            totalCount: expectedItems.length,
          },
        },
      })
    })

    const response = await handleApiRequest(apiRequest(), secret, fetchUpstream)

    expect(response.status).toBe(200)
    expect(fetchUpstream).toHaveBeenCalledTimes(3)
    expect(await response.json()).toEqual({
      response: {
        header: { resultCode: "000" },
        body: {
          items: { item: expectedItems },
          numOfRows: expectedItems.length,
          pageNo: 1,
          totalCount: expectedItems.length,
        },
      },
    })
  })

  it("returns a sanitized error when a later page request fails", async () => {
    const firstPageItems = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
    const fetchUpstream = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const pageNo = Number(new URL(String(input)).searchParams.get("pageNo") ?? "1")
      if (pageNo === 2) {
        return new Response(`serviceKey=${secret}&error=upstream details`, { status: 503 })
      }

      return Response.json({
        response: {
          header: { resultCode: "000" },
          body: {
            items: { item: firstPageItems },
            numOfRows: 100,
            pageNo: 1,
            totalCount: 101,
          },
        },
      })
    })

    const response = await handleApiRequest(apiRequest(), secret, fetchUpstream)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "국토부 API 요청이 실패했습니다." })
    expect(fetchUpstream).toHaveBeenCalledTimes(2)
  })

  it("removes an identical transaction repeated across page boundaries", async () => {
    const firstPageItems = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
    const fetchUpstream = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const pageNo = Number(new URL(String(input)).searchParams.get("pageNo") ?? "1")
      const items = pageNo === 1 ? firstPageItems : [{ id: 100 }, { id: 101 }]

      return Response.json({
        response: {
          header: { resultCode: "000" },
          body: {
            items: { item: items },
            numOfRows: 100,
            pageNo,
            totalCount: 101,
          },
        },
      })
    })

    const response = await handleApiRequest(apiRequest(), secret, fetchUpstream)

    expect(await response.json()).toEqual({
      response: {
        header: { resultCode: "000" },
        body: {
          items: { item: [...firstPageItems, { id: 101 }] },
          numOfRows: 101,
          pageNo: 1,
          totalCount: 101,
        },
      },
    })
  })
})
