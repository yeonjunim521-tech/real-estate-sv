import { describe, expect, it } from "vitest"
import {
  mergeDevelopmentLimitHistory,
  normalizeDevelopmentLimit,
} from "../src/ordinance-limit"

const statutoryFixture = {
  sourceTitle: "국토의 계획 및 이용에 관한 법률 시행령",
  article: "제84조·제85조",
  jurisdictionCode: "KR",
  zoneCode: "UQA123",
  buildingCoverageLimitPercent: "70",
  floorAreaRatioLimitPercent: "500",
  effectiveDate: "20260324",
  retrievedAt: "2026-07-15T10:00:00.000Z",
}

describe("development limit normalization", () => {
  it("preserves statutory evidence and its effective date", () => {
    expect(normalizeDevelopmentLimit("statute", statutoryFixture)).toEqual({
      kind: "normalized",
      value: {
        sourceKind: "statute",
        sourceTitle: "국토의 계획 및 이용에 관한 법률 시행령",
        article: "제84조·제85조",
        jurisdictionCode: "KR",
        zoneCode: "UQA123",
        buildingCoverageLimitPercent: 70,
        floorAreaRatioLimitPercent: 500,
        effectiveOn: "2026-03-24",
        retrievedAt: "2026-07-15T10:00:00.000Z",
      },
    })
  })

  it("keeps different effective dates instead of overwriting history", () => {
    const older = normalizeDevelopmentLimit("ordinance", {
      ...statutoryFixture,
      sourceTitle: "서울특별시 도시계획 조례",
      jurisdictionCode: "11",
      buildingCoverageLimitPercent: "60",
      floorAreaRatioLimitPercent: "400",
      effectiveDate: "20240101",
    })
    const newer = normalizeDevelopmentLimit("ordinance", {
      ...statutoryFixture,
      sourceTitle: "서울특별시 도시계획 조례",
      jurisdictionCode: "11",
      buildingCoverageLimitPercent: "55",
      floorAreaRatioLimitPercent: "350",
      effectiveDate: "20260101",
    })

    expect(mergeDevelopmentLimitHistory([older], [newer])).toMatchObject([
      { kind: "normalized", value: { effectiveOn: "2024-01-01" } },
      { kind: "normalized", value: { effectiveOn: "2026-01-01" } },
    ])
  })
})
