import { describe, expect, it, vi } from "vitest"
import { createAdminDataStatus, handleAdminDataStatus } from "../src/admin-data-status"

const query = { propertyType: "apt", lawdCd: "11680", dealYmd: "202606" } as const
const runs = [
  {
    status: "complete" as const,
    startedAt: "2026-07-15T01:00:00.000Z",
    completedAt: "2026-07-15T01:00:02.000Z",
    pageCount: 3,
    itemCount: 205,
    errorCode: null,
  },
  {
    status: "partial" as const,
    startedAt: "2026-07-14T01:00:00.000Z",
    completedAt: "2026-07-14T01:00:01.000Z",
    pageCount: 1,
    itemCount: 100,
    errorCode: "PAGE_TIMEOUT",
  },
  {
    status: "failed" as const,
    startedAt: "2026-07-13T01:00:00.000Z",
    completedAt: "2026-07-13T01:00:01.000Z",
    pageCount: 0,
    itemCount: 0,
    errorCode: "UPSTREAM_503",
  },
]

describe("admin data status", () => {
  it("summarizes collection states, latest update, volume, and missing months", () => {
    const result = createAdminDataStatus({
      query,
      runs,
      availableMonths: ["202606", "202605"],
      issues: [
        {
          issueType: "normalization-failure",
          count: 4,
          oldestDetectedAt: "2026-07-10T00:00:00.000Z",
          latestDetectedAt: "2026-07-15T00:00:00.000Z",
        },
      ],
      queryTimeMs: 12.345,
    })

    expect(result.runTotals).toEqual({ complete: 1, partial: 1, failed: 1, running: 0 })
    expect(result.lastUpdatedAt).toBe("2026-07-15T01:00:02.000Z")
    expect(result.collectedItemCount).toBe(305)
    expect(result.missingMonths).toHaveLength(58)
    expect(result.missingMonths).not.toContain("202606")
    expect(result.queryTimeMs).toBe(12.35)
    expect(result.openIssueCount).toBe(4)
  })

  it("summarizes a representative five-year dataset within 100ms", () => {
    const availableMonths = Array.from({ length: 60 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 5 - index, 1))
      return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    })
    const startedAt = performance.now()

    const result = createAdminDataStatus({
      query,
      runs: Array.from({ length: 240 }, () => runs[0]),
      availableMonths,
      issues: [],
      queryTimeMs: 0,
    })

    expect(result.missingMonths).toEqual([])
    expect(performance.now() - startedAt).toBeLessThan(100)
  })
})

describe("admin data status authorization", () => {
  const request = (authorization?: string) =>
    new Request("https://example.com/api/admin/data-status?type=apt&lawdCd=11680&dealYmd=202606", {
      headers: authorization ? { Authorization: authorization } : undefined,
    })

  it("fails closed when the administrator token is not configured", async () => {
    const loadStatus = vi.fn()

    const response = await handleAdminDataStatus(request(), { expectedToken: undefined, loadStatus })

    expect(response.status).toBe(503)
    expect(loadStatus).not.toHaveBeenCalled()
  })

  it("rejects an unauthorized request before loading D1 status", async () => {
    const loadStatus = vi.fn()

    const response = await handleAdminDataStatus(request("Bearer wrong"), {
      expectedToken: "admin-secret",
      loadStatus,
    })

    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer")
    expect(loadStatus).not.toHaveBeenCalled()
  })

  it("returns status to an authorized administrator", async () => {
    const report = createAdminDataStatus({
      query,
      runs,
      availableMonths: ["202606"],
      issues: [],
      queryTimeMs: 4,
    })
    const loadStatus = vi.fn(async () => report)

    const response = await handleAdminDataStatus(request("Bearer admin-secret"), {
      expectedToken: "admin-secret",
      loadStatus,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(report)
    expect(loadStatus).toHaveBeenCalledWith(query)
  })
})
