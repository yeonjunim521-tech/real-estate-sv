import { describe, expect, it } from "vitest"
import { resolveTransactionLocation } from "../site/transaction-location.js"

describe("transaction location confidence", () => {
  it("keeps a masked lot number unresolved", () => {
    expect(resolveTransactionLocation({ jibun: "123-*", bonbun: "123", bubun: "4" })).toEqual({
      jibun: "123-*",
      confidence: "지번 마스킹 · 확인 필요",
    })
  })

  it("marks a visible lot number as source-confirmed", () => {
    expect(resolveTransactionLocation({ jibun: "123-4" })).toEqual({
      jibun: "123-4",
      confidence: "원천 거래 확인",
    })
  })
})
