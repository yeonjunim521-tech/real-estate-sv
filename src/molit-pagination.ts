const PAGE_SIZE = 100

type MolitPage = {
  readonly payload: Record<string, unknown>
  readonly response: Record<string, unknown>
  readonly body: Record<string, unknown>
  readonly items: readonly Record<string, unknown>[]
  readonly totalCount: number
}

export type MolitPageSnapshot = {
  readonly pageNo: number
  readonly payloadJson: string
  readonly itemCount: number
  readonly totalCount: number
}

type PageObserver = (page: MolitPageSnapshot) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseCount(value: unknown): number | undefined {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isInteger(count) && count >= 0 ? count : undefined
}

function parsePage(payload: unknown): MolitPage | undefined {
  if (!isRecord(payload) || !isRecord(payload.response) || !isRecord(payload.response.body)) {
    return undefined
  }

  const body = payload.response.body
  const totalCount = parseCount(body.totalCount)
  if (totalCount === undefined) return undefined

  const item = isRecord(body.items) ? body.items.item : undefined
  const items = Array.isArray(item) ? item.filter(isRecord) : isRecord(item) ? [item] : []
  return { payload, response: payload.response, body, items, totalCount }
}

function deduplicateItems(items: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = JSON.stringify(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergePages(pages: readonly MolitPage[]): Record<string, unknown> {
  const firstPage = pages[0]
  if (!firstPage) return {}
  const items = deduplicateItems(pages.flatMap((page) => page.items))
  return {
    ...firstPage.payload,
    response: {
      ...firstPage.response,
      body: {
        ...firstPage.body,
        items: { item: items },
        numOfRows: items.length,
        pageNo: 1,
        totalCount: firstPage.totalCount,
      },
    },
  }
}

export function mergeMolitPagePayloads(payloadJsons: readonly string[]): string | undefined {
  const pages: MolitPage[] = []
  for (const payloadJson of payloadJsons) {
    try {
      const page = parsePage(JSON.parse(payloadJson))
      if (!page) return undefined
      pages.push(page)
    } catch (error: unknown) {
      if (error instanceof SyntaxError) return undefined
      throw error
    }
  }
  return pages.length > 0 ? JSON.stringify(mergePages(pages)) : undefined
}

async function readPage(response: Response): Promise<MolitPage | undefined> {
  try {
    const payload: unknown = await response.clone().json()
    return parsePage(payload)
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

async function fetchPage(
  url: URL,
  pageNo: number,
  fetchUpstream: typeof fetch,
): Promise<Response> {
  const pageUrl = new URL(url)
  pageUrl.searchParams.set("numOfRows", String(PAGE_SIZE))
  pageUrl.searchParams.set("pageNo", String(pageNo))
  const request = () => fetchUpstream(pageUrl.toString(), { headers: { Accept: "application/json" } })
  const response = await request()
  if (response.status < 500) return response

  await new Promise((resolve) => setTimeout(resolve, 200))
  return request()
}

export async function fetchAllMolitPages(
  url: URL,
  fetchUpstream: typeof fetch,
  observePage?: PageObserver,
): Promise<Response> {
  const firstResponse = await fetchPage(url, 1, fetchUpstream)
  if (!firstResponse.ok) return firstResponse

  const firstPage = await readPage(firstResponse)
  if (!firstPage) return firstResponse

  observePage?.({
    pageNo: 1,
    payloadJson: JSON.stringify(firstPage.payload),
    itemCount: firstPage.items.length,
    totalCount: firstPage.totalCount,
  })

  const pageCount = Math.ceil(firstPage.totalCount / PAGE_SIZE)
  if (pageCount <= 1) return firstResponse

  const pages = [firstPage]
  for (let pageNo = 2; pageNo <= pageCount; pageNo += 1) {
    const pageResponse = await fetchPage(url, pageNo, fetchUpstream)
    if (!pageResponse.ok) return pageResponse

    const page = await readPage(pageResponse)
    if (!page) return new Response(null, { status: 502 })
    pages.push(page)
    observePage?.({
      pageNo,
      payloadJson: JSON.stringify(page.payload),
      itemCount: page.items.length,
      totalCount: page.totalCount,
    })
  }

  const headers = new Headers(firstResponse.headers)
  headers.delete("Content-Length")
  return new Response(JSON.stringify(mergePages(pages)), {
    status: firstResponse.status,
    statusText: firstResponse.statusText,
    headers,
  })
}
