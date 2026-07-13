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
})
