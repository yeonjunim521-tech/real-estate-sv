import type { MolitPageSnapshot } from "./molit-pagination"
import {
  recordIngestionRun,
  saveTransactionPage,
  type SnapshotDatabase,
  type TransactionPageKey,
} from "./transaction-store"

export async function persistTransactionCollection(
  database: SnapshotDatabase,
  key: TransactionPageKey,
  pages: readonly MolitPageSnapshot[],
  startedAt: string,
  completedAt: string,
): Promise<void> {
  const itemCount = pages.reduce((total, page) => total + page.itemCount, 0)

  await Promise.all(
    pages.map((page) =>
      saveTransactionPage(database, {
        ...key,
        ...page,
        fetchedAt: completedAt,
      }),
    ),
  )
  await recordIngestionRun(database, {
    ...key,
    status: "complete",
    startedAt,
    completedAt,
    pageCount: pages.length,
    itemCount,
    errorCode: null,
  })
}
