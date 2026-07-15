export type PnuInput = {
  readonly legalDongCode: string
  readonly mountain: boolean
  readonly mainNumber: string | number
  readonly subNumber?: string | number
}

export type PnuValue = {
  readonly pnu: string
  readonly provinceCode: string
  readonly districtCode: string
  readonly legalDongCode: string
  readonly mountain: boolean
  readonly mainNumber: number
  readonly subNumber: number
  readonly lotNumber: string
}

export type PnuResult =
  | { readonly kind: "valid"; readonly value: PnuValue }
  | {
      readonly kind: "invalid"
      readonly reason: "invalid-legal-dong-code" | "invalid-main-number" | "invalid-sub-number"
    }

function parseLotNumber(value: string | number, minimum: number): number | undefined {
  const text = String(value).trim()
  if (!/^\d{1,4}$/.test(text)) return undefined
  const number = Number(text)
  return Number.isInteger(number) && number >= minimum && number <= 9999 ? number : undefined
}

export function buildPnu(input: PnuInput): PnuResult {
  if (!/^\d{10}$/.test(input.legalDongCode)) {
    return { kind: "invalid", reason: "invalid-legal-dong-code" }
  }
  const mainNumber = parseLotNumber(input.mainNumber, 1)
  if (mainNumber === undefined) return { kind: "invalid", reason: "invalid-main-number" }
  const subNumber = parseLotNumber(input.subNumber ?? 0, 0)
  if (subNumber === undefined) return { kind: "invalid", reason: "invalid-sub-number" }

  const mountainMarker = input.mountain ? "2" : "1"
  const lotNumber = `${input.mountain ? "산 " : ""}${mainNumber}${subNumber > 0 ? `-${subNumber}` : ""}`
  return {
    kind: "valid",
    value: {
      pnu: `${input.legalDongCode}${mountainMarker}${String(mainNumber).padStart(4, "0")}${String(subNumber).padStart(4, "0")}`,
      provinceCode: input.legalDongCode.slice(0, 2),
      districtCode: input.legalDongCode.slice(0, 5),
      legalDongCode: input.legalDongCode,
      mountain: input.mountain,
      mainNumber,
      subNumber,
      lotNumber,
    },
  }
}
