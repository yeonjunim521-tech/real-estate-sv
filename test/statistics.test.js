import { describe, expect, it } from "vitest"
import { calculateMedian } from "../site/statistics.js"

describe("transaction statistics", () => {
  it("averages the two middle prices when the count is even", () => {
    expect(calculateMedian([100, 200])).toBe(150)
    expect(calculateMedian([100, 200, 300, 400])).toBe(250)
  })

  it("returns the middle price when the count is odd", () => {
    expect(calculateMedian([300, 100, 200])).toBe(200)
  })
})
