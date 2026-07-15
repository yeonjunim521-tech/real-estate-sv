export type D1Value = string | number | null | ArrayBuffer;

export type TransactionPageKey = {
  readonly propertyType: string;
  readonly lawdCd: string;
  readonly dealYmd: string;
};

export type TransactionPage = TransactionPageKey & {
  readonly pageNo: number;
  readonly payloadJson: string;
  readonly itemCount: number;
  readonly totalCount: number;
  readonly fetchedAt: string;
};

export type TransactionPageRow = {
  readonly property_type: string;
  readonly lawd_cd: string;
  readonly deal_ymd: string;
  readonly page_no: number;
  readonly payload_json: string;
  readonly item_count: number;
  readonly total_count: number;
  readonly fetched_at: string;
};

export type IngestionRun = TransactionPageKey & {
  readonly status: "running" | "complete" | "partial" | "failed";
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly pageCount: number;
  readonly itemCount: number;
  readonly errorCode: string | null;
};

export type TransactionHistoryRange = {
  readonly propertyType: string;
  readonly lawdCd: string;
  readonly fromDealYmd: string;
  readonly toDealYmd: string;
};

export interface SnapshotStatement {
  bind(...values: D1Value[]): SnapshotStatement;
  run(): Promise<unknown>;
  all(): Promise<{ readonly results: readonly TransactionPageRow[] }>;
}

export interface SnapshotDatabase {
  prepare(query: string): SnapshotStatement;
}

type AssertCompatible<T extends true> = T;
type D1DatabaseCompatibility = AssertCompatible<D1Database extends SnapshotDatabase ? true : false>;

export async function recordIngestionRun(
  database: SnapshotDatabase,
  run: IngestionRun,
): Promise<void> {
  await database
    .prepare(`
      INSERT INTO ingestion_runs (
        property_type, lawd_cd, deal_ymd, status, started_at,
        completed_at, page_count, item_count, error_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      run.propertyType,
      run.lawdCd,
      run.dealYmd,
      run.status,
      run.startedAt,
      run.completedAt,
      run.pageCount,
      run.itemCount,
      run.errorCode,
    )
    .run();
}

export async function saveTransactionPage(
  database: SnapshotDatabase,
  page: TransactionPage,
): Promise<void> {
  await database
    .prepare(`
      INSERT INTO transaction_pages (
        property_type, lawd_cd, deal_ymd, page_no,
        payload_json, item_count, total_count, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (property_type, lawd_cd, deal_ymd, page_no) DO UPDATE SET
        payload_json = excluded.payload_json,
        item_count = excluded.item_count,
        total_count = excluded.total_count,
        fetched_at = excluded.fetched_at
    `)
    .bind(
      page.propertyType,
      page.lawdCd,
      page.dealYmd,
      page.pageNo,
      page.payloadJson,
      page.itemCount,
      page.totalCount,
      page.fetchedAt,
    )
    .run();
}

export async function listTransactionPages(
  database: SnapshotDatabase,
  key: TransactionPageKey,
): Promise<readonly TransactionPage[]> {
  const result = await database
    .prepare(`
      SELECT
        property_type, lawd_cd, deal_ymd, page_no,
        payload_json, item_count, total_count, fetched_at
      FROM transaction_pages
      WHERE property_type = ? AND lawd_cd = ? AND deal_ymd = ?
      ORDER BY page_no ASC
    `)
    .bind(key.propertyType, key.lawdCd, key.dealYmd)
    .all();

  return result.results.map((row) => ({
    propertyType: row.property_type,
    lawdCd: row.lawd_cd,
    dealYmd: row.deal_ymd,
    pageNo: row.page_no,
    payloadJson: row.payload_json,
    itemCount: row.item_count,
    totalCount: row.total_count,
    fetchedAt: row.fetched_at,
  }));
}

export async function listCompleteTransactionMonths(
  database: SnapshotDatabase,
  range: TransactionHistoryRange,
): Promise<readonly string[]> {
  const result = await database
    .prepare(`
      SELECT
        property_type, lawd_cd, deal_ymd,
        MIN(page_no) AS page_no, '{}' AS payload_json,
        SUM(item_count) AS item_count, MAX(total_count) AS total_count,
        MAX(fetched_at) AS fetched_at
      FROM transaction_pages
      WHERE property_type = ? AND lawd_cd = ? AND deal_ymd BETWEEN ? AND ?
      GROUP BY property_type, lawd_cd, deal_ymd
      HAVING COUNT(*) = MAX(1, CAST((MAX(total_count) + 99) / 100 AS INTEGER))
        AND MIN(page_no) = 1
        AND MAX(page_no) = MAX(1, CAST((MAX(total_count) + 99) / 100 AS INTEGER))
        AND MIN(total_count) = MAX(total_count)
        AND SUM(item_count) = MAX(total_count)
      ORDER BY deal_ymd DESC
    `)
    .bind(range.propertyType, range.lawdCd, range.fromDealYmd, range.toDealYmd)
    .all();

  return result.results.map((row) => row.deal_ymd);
}
