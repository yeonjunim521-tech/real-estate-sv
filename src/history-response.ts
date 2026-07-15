import { createHistoryProgress, listRecentMonths } from "./history-query"
import { parseTransactionQuery } from "./transaction-query"
import { listCompleteTransactionMonths } from "./transaction-store"
import type { SnapshotDatabase } from "./transaction-store"

const HISTORY_MONTH_COUNT = 60
const COLLECTION_BATCH_LIMIT = 3

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  )
}

export async function handleHistoryRequest(
  request: Request,
  database: SnapshotDatabase | undefined,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("허용되지 않은 요청 방식입니다.", 405, { Allow: "GET" })
  }

  const query = parseTransactionQuery(new URL(request.url))
  if (!query) return jsonError("요청 값을 확인해 주세요.", 400)
  if (!database) return jsonError("거래 이력 저장소를 사용할 수 없습니다.", 503)

  const months = listRecentMonths(query.dealYmd, HISTORY_MONTH_COUNT)
  const fromDealYmd = months[HISTORY_MONTH_COUNT - 1]
  const availableMonths = await listCompleteTransactionMonths(database, {
    propertyType: query.propertyType,
    lawdCd: query.lawdCd,
    fromDealYmd,
    toDealYmd: query.dealYmd,
  })

  return Response.json(
    {
      query: {
        propertyType: query.propertyType,
        lawdCd: query.lawdCd,
        fromDealYmd,
        toDealYmd: query.dealYmd,
      },
      progress: createHistoryProgress(months, availableMonths, COLLECTION_BATCH_LIMIT),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
