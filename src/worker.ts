const API_ENDPOINTS = {
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  rhous: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  shous: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
  office: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
  comm: "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade",
  fact: "https://apis.data.go.kr/1613000/RTMSDataSvcInduTrade/getRTMSDataSvcInduTrade",
  land: "https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade",
  right: "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade",
} as const

type PropertyType = keyof typeof API_ENDPOINTS
type RateLimiter = Pick<RateLimit, "limit">
type CacheStore = Pick<Cache, "match" | "put">
type WaitUntil = ExecutionContext["waitUntil"]

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function isCacheableMolitResponse(response: Response): Promise<boolean> {
  try {
    const payload: unknown = await response.clone().json()
    if (!isRecord(payload) || !isRecord(payload.response) || !isRecord(payload.response.header)) {
      return false
    }
    const resultCode = payload.response.header.resultCode
    return typeof resultCode === "string" && resultCode.startsWith("00")
  } catch {
    return false
  }
}

function createCacheKey(
  request: Request,
  propertyType: PropertyType,
  lawdCd: string,
  dealYmd: string,
): Request {
  const cacheUrl = new URL(request.url)
  cacheUrl.search = new URLSearchParams({ type: propertyType, lawdCd, dealYmd }).toString()
  return new Request(cacheUrl.toString(), { method: "GET" })
}

async function readCachedResponse(cache: CacheStore, cacheKey: Request): Promise<Response | undefined> {
  try {
    return await cache.match(cacheKey)
  } catch {
    return undefined
  }
}

export async function handleApiRequest(
  request: Request,
  serviceKey: string,
  fetchUpstream: typeof fetch = fetch,
  rateLimiter?: RateLimiter,
  cache?: CacheStore,
  waitUntil?: WaitUntil,
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

  if (rateLimiter) {
    try {
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "anonymous"
      const { success } = await rateLimiter.limit({ key: `real-estate:${clientIp}` })
      if (!success) {
        return jsonError("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429, {
          "Retry-After": "60",
        })
      }
    } catch {
      return jsonError("요청 제한 서비스를 사용할 수 없습니다.", 503)
    }
  }

  const cacheKey = createCacheKey(request, propertyType, lawdCd, dealYmd)
  if (cache) {
    const cachedResponse = await readCachedResponse(cache, cacheKey)
    if (cachedResponse) return cachedResponse
  }

  const upstreamUrl = new URL(API_ENDPOINTS[propertyType])
  upstreamUrl.searchParams.set("serviceKey", serviceKey)
  upstreamUrl.searchParams.set("LAWD_CD", lawdCd)
  upstreamUrl.searchParams.set("DEAL_YMD", dealYmd)
  upstreamUrl.searchParams.set("_type", "json")
  upstreamUrl.searchParams.set("numOfRows", "100")

  try {
    const upstreamResponse = await fetchUpstream(upstreamUrl.toString(), {
      headers: { Accept: "application/json" },
    })
    if (!upstreamResponse.ok) {
      return jsonError("국토부 API 요청이 실패했습니다.", upstreamResponse.status)
    }
    if (
      cache &&
      !upstreamResponse.headers.has("Set-Cookie") &&
      (await isCacheableMolitResponse(upstreamResponse))
    ) {
      const cacheResponse = new Response(upstreamResponse.clone().body, upstreamResponse)
      cacheResponse.headers.set("Cache-Control", "s-maxage=300")
      const cacheWrite = cache.put(cacheKey, cacheResponse).catch(() => undefined)
      if (waitUntil) {
        waitUntil(cacheWrite)
      } else {
        await cacheWrite
      }
    }
    return upstreamResponse
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
  rateLimiter?: RateLimiter,
  cache?: CacheStore,
  waitUntil?: WaitUntil,
): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname === "/api/real-estate") {
    return handleApiRequest(request, serviceKey, fetchUpstream, rateLimiter, cache, waitUntil)
  }
  return fetchAsset(request)
}

export function createWorkerHandler(
  fetchUpstream: typeof fetch = fetch,
  rateLimiter?: RateLimiter,
  cache?: CacheStore,
  waitUntil?: WaitUntil,
) {
  return (
    request: Request,
    serviceKey: string,
    fetchAsset: AssetFetcher,
    requestRateLimiter = rateLimiter,
    requestCache = cache,
    requestWaitUntil = waitUntil,
  ) =>
    routeRequest(
      request,
      serviceKey,
      fetchAsset,
      fetchUpstream,
      requestRateLimiter,
      requestCache,
      requestWaitUntil,
    )
}

const workerHandler = createWorkerHandler(fetch)

export default {
  async fetch(request, env, ctx): Promise<Response> {
    return workerHandler(
      request,
      env.DATA_GO_KR_SERVICE_KEY,
      (assetRequest) => env.ASSETS.fetch(assetRequest),
      env.API_RATE_LIMITER,
      caches.default,
      ctx.waitUntil.bind(ctx),
    )
  },
} satisfies ExportedHandler<Env>
