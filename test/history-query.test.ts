import { describe, expect, it } from "vitest"
import { createHistoryProgress, listRecentMonths } from "../src/history-query"

describe("five-year history query", () => {
  it("lists 60 months from the 기준 month across year boundaries", () => {
    const months = listRecentMonths("202603")

    expect(months).toHaveLength(60)
    expect(months.slice(0, 4)).toEqual(["202603", "202602", "202601", "202512"])
    expect(months.at(-1)).toBe("202104")
  })

  it("keeps February in sequence without depending on its day count", () => {
    expect(listRecentMonths("202402", 3)).toEqual(["202402", "202401", "202312"])
  })

  it("returns only the newest missing months in the next collection batch", () => {
    const months = ["202603", "202602", "202601", "202512", "202511"]

    const progress = createHistoryProgress(months, ["202602", "202512"], 3)

    expect(progress).toEqual({
      status: "collecting",
      completedCount: 2,
      totalCount: 5,
      availableMonths: ["202602", "202512"],
      missingMonths: ["202603", "202601", "202511"],
      nextCollectionMonths: ["202603", "202601", "202511"],
    })
  })

  it("marks the history complete when every month is available", () => {
    const months = ["202603", "202602"]

    expect(createHistoryProgress(months, months, 3).status).toBe("complete")
  })
})
