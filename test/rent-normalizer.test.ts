import { describe, expect, it } from "vitest"
import { normalizeRentResponse, normalizeRentTransaction } from "../src/rent-normalizer"

describe("official rental transaction normalizer", () => {
  it("normalizes an apartment monthly-rent response item", () => {
    const result = normalizeRentTransaction("apt", {
      sggCd: "11230",
      umdNm: "답십리동",
      aptNm: "테스트아파트",
      jibun: "12-3",
      excluUseAr: "84.97",
      dealYear: "2026",
      dealMonth: "6",
      dealDay: "9",
      deposit: " 10,000 ",
      monthlyRent: "85",
      floor: "12",
      buildYear: "2018",
      contractTerm: "202606~202806",
      contractType: "갱신",
      useRRRight: "사용",
      preDeposit: "9,000",
      preMonthlyRent: "80",
    })

    expect(result).toEqual({
      kind: "normalized",
      value: {
        source: "molit",
        transactionType: "rent",
        rentType: "monthly",
        propertyType: "apt",
        regionCode: "11230",
        districtName: "답십리동",
        propertyName: "테스트아파트",
        jibun: "12-3",
        areaSquareMeters: 84.97,
        contractDate: "2026-06-09",
        depositTenThousandWon: 10000,
        monthlyRentTenThousandWon: 85,
        floor: "12",
        buildYear: 2018,
        contractTerm: "202606~202806",
        contractType: "갱신",
        renewalRightUsed: true,
        previousDepositTenThousandWon: 9000,
        previousMonthlyRentTenThousandWon: 80,
      },
    })
  })

  it("normalizes a single-house jeonse item without inventing a property name", () => {
    const result = normalizeRentTransaction("shous", {
      sggCd: "11230",
      umdNm: "전농동",
      totalFloorAr: "55.2",
      dealYear: "2026",
      dealMonth: "06",
      dealDay: "18",
      deposit: "25,000",
      monthlyRent: "0",
      useRRRight: "미사용",
    })

    expect(result).toMatchObject({
      kind: "normalized",
      value: {
        rentType: "jeonse",
        propertyType: "shous",
        propertyName: null,
        areaSquareMeters: 55.2,
        monthlyRentTenThousandWon: 0,
        renewalRightUsed: false,
      },
    })
  })

  it("rejects an item with an invalid required amount", () => {
    const result = normalizeRentTransaction("office", {
      sggCd: "11230",
      umdNm: "답십리동",
      dealYear: "2026",
      dealMonth: "6",
      dealDay: "1",
      deposit: "금액없음",
      monthlyRent: "0",
    })

    expect(result).toEqual({ kind: "rejected", reason: "invalid-amount" })
  })

  it("adds normalized rental items while preserving the official response", async () => {
    const officialItem = {
      sggCd: "11230",
      umdNm: "답십리동",
      aptNm: "테스트아파트",
      dealYear: "2026",
      dealMonth: "6",
      dealDay: "9",
      deposit: "10,000",
      monthlyRent: "0",
    }
    const invalidItem = { ...officialItem, deposit: "오류" }
    const response = await normalizeRentResponse(
      "apt",
      Response.json({
        response: {
          header: { resultCode: "000" },
          body: { items: { item: [officialItem, invalidItem] } },
        },
      }),
    )

    expect(response.headers.get("X-Transaction-Type")).toBe("rent")
    await expect(response.json()).resolves.toMatchObject({
      response: { body: { items: { item: [officialItem, invalidItem] } } },
      normalizedRent: {
        itemCount: 1,
        issueCount: 1,
        items: [{ propertyType: "apt", rentType: "jeonse", depositTenThousandWon: 10000 }],
      },
    })
  })
})
