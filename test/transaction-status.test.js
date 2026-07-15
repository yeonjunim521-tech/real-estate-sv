import { describe, expect, it } from "vitest"
import { resolveTransactionStatus } from "../site/transaction-status.js"

describe("transaction cancellation status", () => {
  it("does not mark normal MOLIT trades with whitespace fields as cancelled", () => {
    expect(resolveTransactionStatus({ cdealType: " ", cdealDay: " " })).toEqual({
      cancelled: false,
      cancelDate: "",
    })
  })

  it("marks a released MOLIT trade as cancelled and keeps its date", () => {
    expect(resolveTransactionStatus({ cdealType: "O", cdealDay: " 26.07.08 " })).toEqual({
      cancelled: true,
      cancelDate: "26.07.08",
    })
  })

  it("uses a non-blank fallback field after a whitespace primary field", () => {
    expect(resolveTransactionStatus({ cdealType: " ", cancelDealType: "O", cdealDay: " ", cancelDate: "2026-07-08" })).toEqual({
      cancelled: true,
      cancelDate: "2026-07-08",
    })
  })
})
