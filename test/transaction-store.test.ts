import { describe, expect, it, vi } from "vitest";
import {
  listCompleteTransactionMonths,
  listTransactionPages,
  recordIngestionRun,
  saveTransactionPage,
  type D1Value,
  type SnapshotDatabase,
  type SnapshotStatement,
  type TransactionPageRow,
} from "../src/transaction-store";

function recordingDatabase(rows: readonly TransactionPageRow[] = []) {
  const queries: string[] = [];
  const bindings: D1Value[][] = [];
  const run = vi.fn(async () => ({ success: true }));

  const database: SnapshotDatabase = {
    prepare(query) {
      queries.push(query);
      const statement: SnapshotStatement = {
        bind(...values) {
          bindings.push(values);
          return statement;
        },
        run,
        async all() {
          return { results: rows };
        },
      };
      return statement;
    },
  };

  return { database, queries, bindings, run };
}

describe("transaction snapshot store", () => {
  it("records a completed ingestion run with its page and item totals", async () => {
    const recorder = recordingDatabase();

    await recordIngestionRun(recorder.database, {
      propertyType: "apt",
      lawdCd: "11230",
      dealYmd: "202606",
      status: "complete",
      startedAt: "2026-07-15T07:29:58.000Z",
      completedAt: "2026-07-15T07:30:00.000Z",
      pageCount: 2,
      itemCount: 150,
      errorCode: null,
    });

    expect(recorder.queries[0]).toContain("INSERT INTO ingestion_runs");
    expect(recorder.bindings[0]).toEqual([
      "apt",
      "11230",
      "202606",
      "complete",
      "2026-07-15T07:29:58.000Z",
      "2026-07-15T07:30:00.000Z",
      2,
      150,
      null,
    ]);
    expect(recorder.run).toHaveBeenCalledOnce();
  });

  it("upserts one monthly API page when a page is saved", async () => {
    const recorder = recordingDatabase();

    await saveTransactionPage(recorder.database, {
      propertyType: "apt",
      lawdCd: "11230",
      dealYmd: "202606",
      pageNo: 1,
      payloadJson: '{"items":[]}',
      itemCount: 0,
      totalCount: 0,
      fetchedAt: "2026-07-15T07:30:00.000Z",
    });

    expect(recorder.queries[0]).toContain("INSERT INTO transaction_pages");
    expect(recorder.bindings[0]).toEqual([
      "apt",
      "11230",
      "202606",
      1,
      '{"items":[]}',
      0,
      0,
      "2026-07-15T07:30:00.000Z",
    ]);
    expect(recorder.run).toHaveBeenCalledOnce();
  });

  it("returns stored pages in database order when a month is loaded", async () => {
    const recorder = recordingDatabase([
      {
        property_type: "apt",
        lawd_cd: "11230",
        deal_ymd: "202606",
        page_no: 1,
        payload_json: '{"page":1}',
        item_count: 100,
        total_count: 150,
        fetched_at: "2026-07-15T07:30:00.000Z",
      },
      {
        property_type: "apt",
        lawd_cd: "11230",
        deal_ymd: "202606",
        page_no: 2,
        payload_json: '{"page":2}',
        item_count: 50,
        total_count: 150,
        fetched_at: "2026-07-15T07:30:01.000Z",
      },
    ]);

    const pages = await listTransactionPages(recorder.database, {
      propertyType: "apt",
      lawdCd: "11230",
      dealYmd: "202606",
    });

    expect(recorder.queries[0]).toContain("ORDER BY page_no ASC");
    expect(recorder.bindings[0]).toEqual(["apt", "11230", "202606"]);
    expect(pages.map((page) => page.pageNo)).toEqual([1, 2]);
    expect(pages[1]?.itemCount).toBe(50);
  });

  it("returns only complete stored months inside a five-year range", async () => {
    const recorder = recordingDatabase([
      {
        property_type: "apt",
        lawd_cd: "11230",
        deal_ymd: "202606",
        page_no: 1,
        payload_json: "",
        item_count: 150,
        total_count: 150,
        fetched_at: "2026-07-15T08:00:00.000Z",
      },
      {
        property_type: "apt",
        lawd_cd: "11230",
        deal_ymd: "202604",
        page_no: 1,
        payload_json: "",
        item_count: 10,
        total_count: 10,
        fetched_at: "2026-07-15T08:00:00.000Z",
      },
    ]);

    const months = await listCompleteTransactionMonths(recorder.database, {
      propertyType: "apt",
      lawdCd: "11230",
      fromDealYmd: "202107",
      toDealYmd: "202606",
    });

    expect(recorder.queries[0]).toContain("GROUP BY property_type, lawd_cd, deal_ymd");
    expect(recorder.queries[0]).toContain("HAVING COUNT(*)");
    expect(recorder.bindings[0]).toEqual(["apt", "11230", "202107", "202606"]);
    expect(months).toEqual(["202606", "202604"]);
  });
});
