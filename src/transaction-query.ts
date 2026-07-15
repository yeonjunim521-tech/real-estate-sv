export const API_ENDPOINTS = {
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  rhous: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  shous: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
  office: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
  comm: "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade",
  fact: "https://apis.data.go.kr/1613000/RTMSDataSvcInduTrade/getRTMSDataSvcInduTrade",
  land: "https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade",
  right: "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade",
} as const

export type PropertyType = keyof typeof API_ENDPOINTS

export type TransactionQuery = {
  readonly propertyType: PropertyType
  readonly lawdCd: string
  readonly dealYmd: string
}

function isPropertyType(value: string | null): value is PropertyType {
  return value !== null && Object.hasOwn(API_ENDPOINTS, value)
}

function isValidMonth(value: string | null): value is string {
  if (value === null || !/^\d{6}$/.test(value)) return false
  const month = Number(value.slice(4, 6))
  return month >= 1 && month <= 12
}

export function parseTransactionQuery(url: URL): TransactionQuery | undefined {
  const propertyType = url.searchParams.get("type")
  const lawdCd = url.searchParams.get("lawdCd")
  const dealYmd = url.searchParams.get("dealYmd")
  if (!isPropertyType(propertyType) || lawdCd === null || !/^\d{5}$/.test(lawdCd) || !isValidMonth(dealYmd)) {
    return undefined
  }
  return { propertyType, lawdCd, dealYmd }
}
