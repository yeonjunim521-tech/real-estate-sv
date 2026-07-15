import { describe, expect, it } from "vitest"
import { RENT_API_ENDPOINTS, parseRentQuery } from "../src/rent-endpoints"

describe("official rental endpoints", () => {
  it("maps the four supported property types to official MOLIT endpoints", () => {
    expect(RENT_API_ENDPOINTS).toEqual({
      apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
      rhous: "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
      shous: "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent",
      office: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent",
    })
  })

  it("parses a supported rental query", () => {
    const query = parseRentQuery(
      new URL("https://example.com/api/real-estate/rent?type=apt&lawdCd=11230&dealYmd=202606"),
    )

    expect(query).toEqual({ propertyType: "apt", lawdCd: "11230", dealYmd: "202606" })
  })

  it("rejects property types without an official rental endpoint", () => {
    const query = parseRentQuery(
      new URL("https://example.com/api/real-estate/rent?type=comm&lawdCd=11230&dealYmd=202606"),
    )

    expect(query).toBeUndefined()
  })
})
