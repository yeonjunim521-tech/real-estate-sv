import { listRecentMonths } from "./history-query"
import { parseTransactionQuery } from "./transaction-query"
import { listCompleteTransactionMonths } from "./transaction-store"
import type { TransactionQuery } from "./transaction-query"

export type AdminRun = {
  readonly status: "running" | "complete" | "partial" | "failed"
  readonly startedAt: string
  readonly completedAt: string | null
  readonly pageCount: number
  readonly itemCount: number
  readonly errorCode: string | null
}

export type AdminIssueSummary = {
  readonly issueType: string
  readonly count: number
  readonly oldestDetectedAt: string
  readonly latestDetectedAt: string
}

type AdminDataStatusInput = {
  readonly query: TransactionQuery
  readonly runs: readonly AdminRun[]
  readonly availableMonths: readonly string[]
  readonly issues: readonly AdminIssueSummary[]
  readonly queryTimeMs: number
}

export type AdminDataStatus = {
  readonly query: TransactionQuery & { readonly fromDealYmd: string }
  readonly runTotals: Record<AdminRun["status"], number>
  readonly lastUpdatedAt: string | null
  readonly collectedItemCount: number
  readonly availableMonths: readonly string[]
  readonly missingMonths: readonly string[]
  readonly openIssueCount: number
  readonly issues: readonly AdminIssueSummary[]
  readonly recentRuns: readonly AdminRun[]
  readonly queryTimeMs: number
}

type AdminRunRow = {
  readonly status: AdminRun["status"]
  readonly started_at: string
  readonly completed_at: string | null
  readonly page_count: number
  readonly item_count: number
  readonly error_code: string | null
}

type AdminIssueRow = {
  readonly issue_type: string
  readonly issue_count: number
  readonly oldest_detected_at: string
  readonly latest_detected_at: string
}

export type AdminStatusLoader = (query: TransactionQuery) => Promise<AdminDataStatus>

function assertNever(value: never): never {
  throw new TypeError(`Unexpected ingestion status: ${String(value)}`)
}

export function createAdminDataStatus(input: AdminDataStatusInput): AdminDataStatus {
  const runTotals: Record<AdminRun["status"], number> = {
    complete: 0,
    partial: 0,
    failed: 0,
    running: 0,
  }
  for (const run of input.runs) {
    switch (run.status) {
      case "complete":
      case "partial":
      case "failed":
      case "running":
        runTotals[run.status] += 1
        break
      default:
        assertNever(run.status)
    }
  }
  const months = listRecentMonths(input.query.dealYmd)
  const availableMonthSet = new Set(input.availableMonths)
  const updateTimes = input.runs.map((run) => run.completedAt ?? run.startedAt).sort()

  return {
    query: { ...input.query, fromDealYmd: months[months.length - 1] ?? input.query.dealYmd },
    runTotals,
    lastUpdatedAt: updateTimes.at(-1) ?? null,
    collectedItemCount: input.runs.reduce((total, run) => total + run.itemCount, 0),
    availableMonths: months.filter((month) => availableMonthSet.has(month)),
    missingMonths: months.filter((month) => !availableMonthSet.has(month)),
    openIssueCount: input.issues.reduce((total, issue) => total + issue.count, 0),
    issues: input.issues,
    recentRuns: [...input.runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt)).slice(0, 20),
    queryTimeMs: Math.round(input.queryTimeMs * 100) / 100,
  }
}

export async function loadAdminDataStatus(
  database: D1Database,
  query: TransactionQuery,
  clock: () => number = () => performance.now(),
): Promise<AdminDataStatus> {
  const startedAt = clock()
  const months = listRecentMonths(query.dealYmd)
  const fromDealYmd = months[months.length - 1] ?? query.dealYmd
  const [runResult, issueResult, availableMonths] = await Promise.all([
    database
      .prepare(`
        SELECT status, started_at, completed_at, page_count, item_count, error_code
        FROM ingestion_runs
        WHERE property_type = ? AND lawd_cd = ? AND deal_ymd BETWEEN ? AND ?
        ORDER BY started_at DESC
      `)
      .bind(query.propertyType, query.lawdCd, fromDealYmd, query.dealYmd)
      .all<AdminRunRow>(),
    database
      .prepare(`
        SELECT issue_type, COUNT(*) AS issue_count,
          MIN(detected_at) AS oldest_detected_at, MAX(detected_at) AS latest_detected_at
        FROM data_quality_issues
        WHERE resolved_at IS NULL
        GROUP BY issue_type
        ORDER BY issue_count DESC, issue_type ASC
      `)
      .all<AdminIssueRow>(),
    listCompleteTransactionMonths(database, {
      propertyType: query.propertyType,
      lawdCd: query.lawdCd,
      fromDealYmd,
      toDealYmd: query.dealYmd,
    }),
  ])

  return createAdminDataStatus({
    query,
    runs: runResult.results.map((row) => ({
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      pageCount: row.page_count,
      itemCount: row.item_count,
      errorCode: row.error_code,
    })),
    availableMonths,
    issues: issueResult.results.map((row) => ({
      issueType: row.issue_type,
      count: row.issue_count,
      oldestDetectedAt: row.oldest_detected_at,
      latestDetectedAt: row.latest_detected_at,
    })),
    queryTimeMs: clock() - startedAt,
  })
}

type AdminHandlerDependencies = {
  readonly expectedToken?: string
  readonly loadStatus?: AdminStatusLoader
}

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

export async function handleAdminDataStatus(
  request: Request,
  dependencies: AdminHandlerDependencies,
): Promise<Response> {
  if (!dependencies.expectedToken) return jsonError("관리자 인증이 설정되지 않았습니다.", 503)
  if (request.method !== "GET") return jsonError("허용되지 않은 요청 방식입니다.", 405, { Allow: "GET" })
  if (request.headers.get("Authorization") !== `Bearer ${dependencies.expectedToken}`) {
    return jsonError("관리자 권한이 필요합니다.", 401, { "WWW-Authenticate": "Bearer" })
  }
  const query = parseTransactionQuery(new URL(request.url))
  if (!query) return jsonError("요청 값을 확인해 주세요.", 400)
  if (!dependencies.loadStatus) return jsonError("관리자 데이터 저장소를 사용할 수 없습니다.", 503)

  const report = await dependencies.loadStatus(query)
  return Response.json(report, { headers: { "Cache-Control": "no-store" } })
}
