export const RENT_API_ENDPOINTS = {
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
  rhous: "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
  shous: "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent",
  office: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent",
} as const

export type RentPropertyType = keyof typeof RENT_API_ENDPOINTS

export type RentQuery = {
  readonly propertyType: RentPropertyType
  readonly lawdCd: string
  readonly dealYmd: string
}

export type TransactionMode = "trade" | "rent"

export type ResolvedTransactionRequest =
  | {
      readonly mode: "trade"
      readonly propertyType: PropertyType
      readonly lawdCd: string
      readonly dealYmd: string
      readonly endpoint: string
      readonly snapshotPropertyType: string
    }
  | {
      readonly mode: "rent"
      readonly propertyType: RentPropertyType
      readonly lawdCd: string
      readonly dealYmd: string
      readonly endpoint: string
      readonly snapshotPropertyType: string
    }

function isRentPropertyType(value: string | null): value is RentPropertyType {
  return value !== null && Object.hasOwn(RENT_API_ENDPOINTS, value)
}

function isValidMonth(value: string | null): value is string {
  if (value === null || !/^\d{6}$/.test(value)) return false
  const month = Number(value.slice(4, 6))
  return month >= 1 && month <= 12
}

export function parseRentQuery(url: URL): RentQuery | undefined {
  const propertyType = url.searchParams.get("type")
  const lawdCd = url.searchParams.get("lawdCd")
  const dealYmd = url.searchParams.get("dealYmd")
  if (!isRentPropertyType(propertyType) || lawdCd === null || !/^\d{5}$/.test(lawdCd) || !isValidMonth(dealYmd)) {
    return undefined
  }
  return { propertyType, lawdCd, dealYmd }
}

const REQUEST_RESOLVERS = {
  trade(url: URL): ResolvedTransactionRequest | undefined {
    const query = parseTransactionQuery(url)
    if (!query) return undefined
    return {
      mode: "trade",
      ...query,
      endpoint: API_ENDPOINTS[query.propertyType],
      snapshotPropertyType: query.propertyType,
    }
  },
  rent(url: URL): ResolvedTransactionRequest | undefined {
    const query = parseRentQuery(url)
    if (!query) return undefined
    return {
      mode: "rent",
      ...query,
      endpoint: RENT_API_ENDPOINTS[query.propertyType],
      snapshotPropertyType: `rent-${query.propertyType}`,
    }
  },
} satisfies Record<
  TransactionMode,
  (url: URL) => ResolvedTransactionRequest | undefined
>

export function resolveTransactionRequest(
  mode: TransactionMode,
  url: URL,
): ResolvedTransactionRequest | undefined {
  return REQUEST_RESOLVERS[mode](url)
}
import { API_ENDPOINTS, parseTransactionQuery } from "./transaction-query"
import type { PropertyType } from "./transaction-query"
