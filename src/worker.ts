const API_ENDPOINTS = {
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  rhous: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  shous: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
  office: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
  comm: "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade",
  fact: "https://apis.data.go.kr/1613000/RTMSDataSvcIndusTrade/getRTMSDataSvcIndusTrade",
  land: "https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade",
  right: "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade",
} as const

type PropertyType = keyof typeof API_ENDPOINTS

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  )
}

function isPropertyType(value: string | null): value is PropertyType {
  return value !== null && Object.hasOwn(API_ENDPOINTS, value)
}

function isValidMonth(value: string | null): value is string {
  if (value === null || !/^\d{6}$/.test(value)) return false
  const month = Number(value.slice(4, 6))
  return month >= 1 && month <= 12
}

function isFiveDigitCode(value: string | null): value is string {
  return value !== null && /^\d{5}$/.test(value)
}

export async function handleApiRequest(
  request: Request,
  serviceKey: string,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("허용되지 않은 요청 방식입니다.", 405, { Allow: "GET" })
  }

  const requestUrl = new URL(request.url)
  const propertyType = requestUrl.searchParams.get("type")
  const lawdCd = requestUrl.searchParams.get("lawdCd")
  const dealYmd = requestUrl.searchParams.get("dealYmd")

  if (!isPropertyType(propertyType) || !isFiveDigitCode(lawdCd) || !isValidMonth(dealYmd)) {
    return jsonError("요청 값을 확인해 주세요.", 400)
  }

  const upstreamUrl = new URL(API_ENDPOINTS[propertyType])
  upstreamUrl.searchParams.set("serviceKey", serviceKey)
  upstreamUrl.searchParams.set("LAWD_CD", lawdCd)
  upstreamUrl.searchParams.set("DEAL_YMD", dealYmd)
  upstreamUrl.searchParams.set("_type", "json")
  upstreamUrl.searchParams.set("numOfRows", "100")

  try {
    return await fetchUpstream(upstreamUrl.toString(), {
      headers: { Accept: "application/json" },
    })
  } catch {
    return jsonError("국토부 API에 연결하지 못했습니다.", 502)
  }
}

type AssetFetcher = (request: Request) => Promise<Response>

export async function routeRequest(
  request: Request,
  serviceKey: string,
  fetchAsset: AssetFetcher,
  fetchUpstream: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === "/api/real-estate") {
    return handleApiRequest(request, serviceKey, fetchUpstream)
  }
  return fetchAsset(request)
}

export default {
  async fetch(request, env): Promise<Response> {
    return routeRequest(
      request,
      env.DATA_GO_KR_SERVICE_KEY,
      (assetRequest) => env.ASSETS.fetch(assetRequest),
      fetch,
    )
  },
} satisfies ExportedHandler<Env>
