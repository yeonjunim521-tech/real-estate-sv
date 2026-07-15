import { mergeMolitPagePayloads } from "./molit-pagination"
import {
  listTransactionPages,
  type SnapshotDatabase,
  type TransactionPageKey,
} from "./transaction-store"

const PAGE_SIZE = 100

export async function readStoredTransactionResponse(
  database: SnapshotDatabase,
  key: TransactionPageKey,
): Promise<Response | undefined> {
  const pages = await listTransactionPages(database, key)
  const firstPage = pages[0]
  if (!firstPage) return undefined

  const expectedPageCount = Math.max(1, Math.ceil(firstPage.totalCount / PAGE_SIZE))
  const storedItemCount = pages.reduce((total, page) => total + page.itemCount, 0)
  const isComplete =
    pages.length === expectedPageCount &&
    storedItemCount === firstPage.totalCount &&
    pages.every(
      (page, index) => page.pageNo === index + 1 && page.totalCount === firstPage.totalCount,
    )
  if (!isComplete) return undefined

  const payloadJson = mergeMolitPagePayloads(pages.map((page) => page.payloadJson))
  const latestPage = pages[pages.length - 1]
  if (!payloadJson || !latestPage) return undefined

  return new Response(payloadJson, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Data-Source": "d1-fallback",
      "X-Data-Status": "complete",
      "X-Data-Fetched-At": latestPage.fetchedAt,
    },
  })
}

export async function readStoredTransactionFallback(
  database: SnapshotDatabase,
  key: TransactionPageKey,
): Promise<Response | undefined> {
  try {
    return await readStoredTransactionResponse(database, key)
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("D1 transaction fallback failed", error)
      return undefined
    }
    throw error
  }
}
