import { describe, expect, it } from "vitest"
import { compareTargets } from "../src/comparison"

const target = (id: string, period = "2026-06") => ({
  id,
  label: `대상 ${id}`,
  period,
  transactions: [
    { priceTenThousandWon: 60_000, areaSquareMeters: 84, cancelled: false },
    { priceTenThousandWon: 30_000, areaSquareMeters: 59, cancelled: false },
    { priceTenThousandWon: 99_000, areaSquareMeters: 84, cancelled: true },
  ],
  rentTransactions: [
    { depositTenThousandWon: 40_000, monthlyRentTenThousandWon: 0 },
    { depositTenThousandWon: 10_000, monthlyRentTenThousandWon: 120 },
  ],
  regulation: { buildingCoverageLimitPercent: 60, floorAreaRatioLimitPercent: 250 },
})

describe("three-target comparison", () => {
  it.each([1, 2, 3])("compares %i target(s) on the same period", count => {
    const result = compareTargets(Array.from({ length: count }, (_, index) => target(String(index))))

    expect(result.kind).toBe("compared")
    if (result.kind === "compared") expect(result.targets).toHaveLength(count)
  })

  it("rejects more than three targets", () => {
    expect(compareTargets([target("1"), target("2"), target("3"), target("4")])).toEqual({
      kind: "rejected",
      reason: "too-many-targets",
    })
  })

  it("rejects duplicate targets", () => {
    expect(compareTargets([target("same"), target("same")])).toEqual({
      kind: "rejected",
      reason: "duplicate-target",
    })
  })

  it("rejects targets with different periods", () => {
    expect(compareTargets([target("1"), target("2", "2026-05")])).toEqual({
      kind: "rejected",
      reason: "period-mismatch",
    })
  })

  it("calculates trade, rent, and regulation metrics without cancelled trades", () => {
    const result = compareTargets([target("1")])

    expect(result).toMatchObject({
      kind: "compared",
      targets: [
        {
          transactionCount: 2,
          medianPriceTenThousandWon: 45_000,
          rent: {
            jeonseCount: 1,
            monthlyCount: 1,
            medianDepositTenThousandWon: 25_000,
            medianMonthlyRentTenThousandWon: 60,
          },
          regulation: { buildingCoverageLimitPercent: 60, floorAreaRatioLimitPercent: 250 },
        },
      ],
    })
    if (result.kind === "compared") {
      expect(result.targets[0]?.medianPricePerPyeongTenThousandWon).toBeCloseTo(2_021.09, 2)
    }
  })

  it("marks unavailable optional data instead of inventing values", () => {
    const result = compareTargets([{ ...target("1"), rentTransactions: [], regulation: null }])

    expect(result).toMatchObject({
      kind: "compared",
      targets: [{ rent: null, regulation: null }],
    })
  })
})
