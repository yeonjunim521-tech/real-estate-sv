import { describe, expect, it } from "vitest"
import { isAnalysisReady } from "../site/query-readiness.js"

describe("analysis query readiness", () => {
  it("requires an 읍면동 selection before analysis can start", () => {
    const query = {
      sidoCd: "11",
      lawdCd: "11230",
      dealYmd: "202606",
      selectedTypes: ["apt"],
    }

    expect(isAnalysisReady({ ...query, dong: "" })).toBe(false)
    expect(isAnalysisReady({ ...query, dong: "장안동" })).toBe(true)
  })
})
