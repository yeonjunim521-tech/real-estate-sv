import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Cloudflare frontend", () => {
  it("uses only the same-origin API and contains no public service key or legacy proxy", async () => {
    const script = await readFile(resolve("site/main.js"), "utf8")

    expect(script).toContain("/api/real-estate")
    expect(script).not.toMatch(/const\s+SERVICE_KEY/)
    expect(script).not.toContain("onrender.com")
    expect(script).not.toContain("cors-anywhere")
    expect(script).not.toContain("proxy?url=")
    expect(script).not.toContain("serviceKey=")
  })

  it("publishes dashboard-friendly Open Graph metadata and a 1200x630 thumbnail", async () => {
    const [html, image] = await Promise.all([
      readFile(resolve("site/index.html"), "utf8"),
      readFile(resolve("site/real-estate-pro-og.png")),
    ])

    expect(html).toContain('<meta property="og:title"')
    expect(html).toContain('<meta property="og:image" content="/real-estate-pro-og.png"')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"')
    expect(image.subarray(1, 4).toString("ascii")).toBe("PNG")
    expect(image.readUInt32BE(16)).toBe(1200)
    expect(image.readUInt32BE(20)).toBe(630)
  })

  it("includes the analysis dashboard controls and inline status surfaces", async () => {
    const [html, script] = await Promise.all([
      readFile(resolve("site/index.html"), "utf8"),
      readFile(resolve("site/main.js"), "utf8"),
    ])

    for (const id of ["theme-toggle", "query-status", "stat-total", "stat-median", "stat-average", "stat-valid", "stat-cancelled", "trend-bars", "trend-summary", "sort-select", "export-csv-btn", "columns-toggle", "columns-menu", "detail-panel", "detail-source", "detail-history-list"]) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain('data-theme="light"')
    expect(script).toContain("renderMetrics")
    expect(script).toContain("escapeHtml")
    expect(script).toContain('data-action="detail"')
    expect(script).toContain("sortTransactions")
    expect(script).toContain("exportCsv")
    expect(script).toContain("syncColumnVisibility")
    expect(script).toContain("국토교통부 실거래가 Open API")
    expect(script).toContain("realEstateTheme")
    expect(script).toContain("setQueryStatus")
  })

  it("preserves the detail action when inline price analysis is toggled", async () => {
    const script = await readFile(resolve("site/main.js"), "utf8")
    const analyzeFunction = script.match(/function runInlineAnalysis[\s\S]*?\n}/)?.[0] ?? ""
    const resetFunction = script.match(/function resetRow[\s\S]*?\n}/)?.[0] ?? ""

    expect(analyzeFunction).toContain("const detailAction")
    expect(analyzeFunction).toContain("${detailAction}")
    expect(resetFunction).toContain("const detailAction")
    expect(resetFunction).toContain("${detailAction}")
  })
})
