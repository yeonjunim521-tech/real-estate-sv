import type { RentPropertyType } from "./rent-endpoints"

export type NormalizedRentTransaction = {
  readonly source: "molit"
  readonly transactionType: "rent"
  readonly rentType: "jeonse" | "monthly"
  readonly propertyType: RentPropertyType
  readonly regionCode: string
  readonly districtName: string
  readonly propertyName: string | null
  readonly jibun: string | null
  readonly areaSquareMeters: number | null
  readonly contractDate: string
  readonly depositTenThousandWon: number
  readonly monthlyRentTenThousandWon: number
  readonly floor: string | null
  readonly buildYear: number | null
  readonly contractTerm: string | null
  readonly contractType: string | null
  readonly renewalRightUsed: boolean | null
  readonly previousDepositTenThousandWon: number | null
  readonly previousMonthlyRentTenThousandWon: number | null
}

export type RentNormalizationResult =
  | { readonly kind: "normalized"; readonly value: NormalizedRentTransaction }
  | { readonly kind: "rejected"; readonly reason: "missing-required-field" | "invalid-date" | "invalid-amount" | "invalid-number" }

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function numberValue(value: unknown): number | null | undefined {
  const normalized = text(value)
  if (normalized === null) return null
  const parsed = Number(normalized.replaceAll(",", ""))
  return Number.isFinite(parsed) ? parsed : undefined
}

function renewalRight(value: unknown): boolean | null {
  const normalized = text(value)
  if (normalized === "사용") return true
  if (normalized === "미사용") return false
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function officialItems(payload: unknown): readonly unknown[] {
  if (!isRecord(payload) || !isRecord(payload.response) || !isRecord(payload.response.body)) {
    return []
  }
  const items = payload.response.body.items
  if (!isRecord(items)) return []
  if (Array.isArray(items.item)) return items.item
  return items.item === undefined ? [] : [items.item]
}

function assertNever(value: never): never {
  throw new TypeError(`Unexpected rental normalization result: ${String(value)}`)
}

export function normalizeRentTransaction(
  propertyType: RentPropertyType,
  item: Readonly<Record<string, unknown>>,
): RentNormalizationResult {
  const regionCode = text(item.sggCd)
  const districtName = text(item.umdNm)
  const year = text(item.dealYear)
  const month = text(item.dealMonth)
  const day = text(item.dealDay)
  if (!regionCode || !districtName || !year || !month || !day) {
    return { kind: "rejected", reason: "missing-required-field" }
  }
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return { kind: "rejected", reason: "invalid-date" }
  }
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return { kind: "rejected", reason: "invalid-date" }
  }

  const deposit = numberValue(item.deposit)
  const monthlyRent = numberValue(item.monthlyRent)
  const previousDeposit = numberValue(item.preDeposit)
  const previousMonthlyRent = numberValue(item.preMonthlyRent)
  if (deposit === null || monthlyRent === null) {
    return { kind: "rejected", reason: "missing-required-field" }
  }
  if (
    deposit === undefined ||
    monthlyRent === undefined ||
    previousDeposit === undefined ||
    previousMonthlyRent === undefined
  ) {
    return { kind: "rejected", reason: "invalid-amount" }
  }

  const area = numberValue(item.excluUseAr ?? item.totalFloorAr)
  const buildYear = numberValue(item.buildYear)
  if (area === undefined || buildYear === undefined) {
    return { kind: "rejected", reason: "invalid-number" }
  }

  return {
    kind: "normalized",
    value: {
      source: "molit",
      transactionType: "rent",
      rentType: monthlyRent === 0 ? "jeonse" : "monthly",
      propertyType,
      regionCode,
      districtName,
      propertyName: text(item.aptNm) ?? text(item.mhouseNm) ?? text(item.offiNm),
      jibun: text(item.jibun),
      areaSquareMeters: area,
      contractDate: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      depositTenThousandWon: deposit,
      monthlyRentTenThousandWon: monthlyRent,
      floor: text(item.floor),
      buildYear,
      contractTerm: text(item.contractTerm),
      contractType: text(item.contractType),
      renewalRightUsed: renewalRight(item.useRRRight),
      previousDepositTenThousandWon: previousDeposit,
      previousMonthlyRentTenThousandWon: previousMonthlyRent,
    },
  }
}

export async function normalizeRentResponse(
  propertyType: RentPropertyType,
  response: Response,
): Promise<Response> {
  const payload: unknown = await response.json()
  const items: NormalizedRentTransaction[] = []
  let issueCount = 0

  for (const item of officialItems(payload)) {
    if (!isRecord(item)) {
      issueCount += 1
      continue
    }
    const result = normalizeRentTransaction(propertyType, item)
    switch (result.kind) {
      case "normalized":
        items.push(result.value)
        break
      case "rejected":
        issueCount += 1
        break
      default:
        assertNever(result)
    }
  }

  const headers = new Headers(response.headers)
  headers.set("X-Transaction-Type", "rent")
  return Response.json(
    {
      ...(isRecord(payload) ? payload : { response: payload }),
      normalizedRent: { itemCount: items.length, issueCount, items },
    },
    { status: response.status, statusText: response.statusText, headers },
  )
}
