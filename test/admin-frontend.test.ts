import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("관리자 데이터 상태 화면", () => {
  it("인증 입력과 데이터 품질 상태 영역을 제공한다", async () => {
    const [html, script, style] = await Promise.all([
      readFile(resolve("site/admin/index.html"), "utf8"),
      readFile(resolve("site/admin.js"), "utf8"),
      readFile(resolve("site/admin.css"), "utf8"),
    ])

    for (const id of [
      "admin-form",
      "admin-token",
      "property-type",
      "lawd-code",
      "deal-month",
      "admin-status",
      "summary-grid",
      "missing-months",
      "quality-issues",
      "recent-runs",
    ]) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain('autocomplete="off"')
    expect(html).toContain("좌우로 밀어 전체 항목 보기")
    expect(html).toContain('tabindex="0"')
    expect(script).toContain("/api/admin/data-status")
    expect(script).toContain("new URLSearchParams({ type: typeInput.value, lawdCd: lawdInput.value, dealYmd })")
    expect(script).not.toContain("new URLSearchParams({ propertyType:")
    expect(script).toContain('Authorization: `Bearer ${token}`')
    expect(script).not.toContain("localStorage")
    expect(script).not.toContain("sessionStorage")
    expect(script).toContain("textContent")
    expect(script).toContain("resetResults")
    expect(style).toMatch(/@media \(max-width: 720px\)/)
  })
})
