import { describe, expect, it } from "vitest"
import { normalizeLandUse } from "../src/land-use"

describe("land-use normalization", () => {
  it("links a zoning and restriction record to its PNU", () => {
    expect(
      normalizeLandUse({
        pnu: "1111010100100120003",
        prposAreaDstrcCode: "UQA123",
        prposAreaDstrcCodeNm: "제2종일반주거지역",
        regstrSeCode: "R100",
        regstrSeCodeNm: "가축사육제한구역",
        lastUpdtDt: "20260324",
      }),
    ).toEqual({
      kind: "normalized",
      value: {
        source: "molit-land-use",
        landKey: "1111010100100120003",
        pnu: "1111010100100120003",
        zone: { code: "UQA123", name: "제2종일반주거지역" },
        restriction: { code: "R100", name: "가축사육제한구역" },
        sourceUpdatedOn: "2026-03-24",
      },
    })
  })

  it("does not invent a missing restriction", () => {
    expect(
      normalizeLandUse({
        pnu: "1111010100100120003",
        prposAreaDstrcCode: "UQA123",
        prposAreaDstrcCodeNm: "제2종일반주거지역",
      }),
    ).toMatchObject({ kind: "normalized", value: { restriction: null } })
  })
})
