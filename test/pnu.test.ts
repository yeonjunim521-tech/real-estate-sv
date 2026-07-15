import { describe, expect, it } from "vitest"
import { buildPnu } from "../src/pnu"
import { createPropertyIdentity, findPropertyIdentityIssues } from "../src/property-identity"

describe("PNU", () => {
  it("builds a 19-digit PNU from legal-dong and lot components", () => {
    expect(
      buildPnu({
        legalDongCode: "1111010100",
        mountain: false,
        mainNumber: "12",
        subNumber: "3",
      }),
    ).toEqual({
      kind: "valid",
      value: {
        pnu: "1111010100100120003",
        provinceCode: "11",
        districtCode: "11110",
        legalDongCode: "1111010100",
        mountain: false,
        mainNumber: 12,
        subNumber: 3,
        lotNumber: "12-3",
      },
    })
  })

  it("uses the mountain marker and zero-fills a missing sub-number", () => {
    expect(
      buildPnu({
        legalDongCode: "4215012300",
        mountain: true,
        mainNumber: 7,
      }),
    ).toMatchObject({
      kind: "valid",
      value: {
        pnu: "4215012300200070000",
        mountain: true,
        lotNumber: "산 7",
      },
    })
  })

  it.each([
    [{ legalDongCode: "111101010", mountain: false, mainNumber: 1 }, "invalid-legal-dong-code"],
    [{ legalDongCode: "1111010100", mountain: false, mainNumber: 0 }, "invalid-main-number"],
    [
      { legalDongCode: "1111010100", mountain: false, mainNumber: 1, subNumber: "10000" },
      "invalid-sub-number",
    ],
  ] as const)("rejects an invalid PNU component", (input, reason) => {
    expect(buildPnu(input)).toEqual({ kind: "invalid", reason })
  })
})

describe("property identity", () => {
  it("keeps land and building identities separate and does not merge equal names at different lots", () => {
    const first = createPropertyIdentity({
      propertyType: "apt",
      buildingName: "한빛 아파트",
      legalDongCode: "1111010100",
      mountain: false,
      mainNumber: 12,
      subNumber: 3,
    })
    const second = createPropertyIdentity({
      propertyType: "apt",
      buildingName: "한빛 아파트",
      legalDongCode: "1111010100",
      mountain: false,
      mainNumber: 13,
      subNumber: 3,
    })

    expect(first).toMatchObject({
      kind: "valid",
      land: { kind: "land", key: "1111010100100120003" },
      building: { kind: "building", landKey: "1111010100100120003", name: "한빛 아파트" },
    })
    expect(second).toMatchObject({ kind: "valid" })
    expect(first).not.toEqual(second)
    expect(findPropertyIdentityIssues([first, second])).toEqual([
      {
        kind: "duplicate-building-name",
        buildingName: "한빛 아파트",
        landKeys: ["1111010100100120003", "1111010100100130003"],
      },
    ])
  })

  it("classifies one registry identifier linked to changed addresses", () => {
    const first = createPropertyIdentity({
      propertyType: "office",
      buildingName: "중앙타워",
      buildingRegistryId: "REG-100",
      legalDongCode: "1111010100",
      mountain: false,
      mainNumber: 20,
    })
    const moved = createPropertyIdentity({
      propertyType: "office",
      buildingName: "중앙타워",
      buildingRegistryId: "REG-100",
      legalDongCode: "1114010100",
      mountain: false,
      mainNumber: 20,
    })

    expect(findPropertyIdentityIssues([first, moved])).toContainEqual({
      kind: "address-change",
      buildingRegistryId: "REG-100",
      landKeys: ["1111010100100200000", "1114010100100200000"],
    })
  })
})
