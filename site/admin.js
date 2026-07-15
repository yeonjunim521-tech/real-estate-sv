const form = document.querySelector("#admin-form")
const tokenInput = document.querySelector("#admin-token")
const typeInput = document.querySelector("#property-type")
const lawdInput = document.querySelector("#lawd-code")
const monthInput = document.querySelector("#deal-month")
const statusText = document.querySelector("#admin-status")
const summaryGrid = document.querySelector("#summary-grid")
const missingMonths = document.querySelector("#missing-months")
const qualityIssues = document.querySelector("#quality-issues")
const recentRuns = document.querySelector("#recent-runs")

const today = new Date()
monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

function appendText(parent, tagName, text, className) {
  const element = document.createElement(tagName)
  element.textContent = text
  if (className) element.className = className
  parent.append(element)
  return element
}

function formatDate(value) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function formatMonth(value) {
  return `${value.slice(0, 4)}.${value.slice(4)}`
}

function renderSummary(data) {
  const cards = [
    ["완료", `${data.runTotals.complete}회`, "complete"],
    ["일부 완료", `${data.runTotals.partial}회`, "partial"],
    ["실패", `${data.runTotals.failed}회`, "failed"],
    ["진행 중", `${data.runTotals.running}회`, "running"],
    ["수집 거래", `${data.collectedItemCount.toLocaleString("ko-KR")}건`, "items"],
    ["조회 시간", `${data.queryTimeMs.toLocaleString("ko-KR")}ms`, "speed"],
  ]
  summaryGrid.replaceChildren()
  for (const [label, value, tone] of cards) {
    const card = document.createElement("article")
    card.dataset.tone = tone
    appendText(card, "span", label)
    appendText(card, "strong", value)
    summaryGrid.append(card)
  }
  summaryGrid.hidden = false
}

function renderCoverage(data) {
  document.querySelector("#coverage-label").textContent = `${data.availableMonths.length}/60개월 확보`
  missingMonths.replaceChildren()
  if (!data.missingMonths.length) {
    appendText(missingMonths, "p", "최근 5년 데이터가 모두 확보됐습니다.", "success-message")
    return
  }
  for (const month of data.missingMonths) appendText(missingMonths, "span", formatMonth(month))
}

function renderIssues(data) {
  document.querySelector("#issue-count").textContent = `${data.openIssueCount}건 미해결`
  qualityIssues.replaceChildren()
  if (!data.issues.length) {
    appendText(qualityIssues, "p", "현재 미해결 품질 이슈가 없습니다.", "success-message")
    return
  }
  for (const issue of data.issues) {
    const row = document.createElement("article")
    const copy = document.createElement("div")
    appendText(copy, "strong", issue.issueType)
    appendText(copy, "span", `${formatDate(issue.oldestDetectedAt)}부터 감지`)
    row.append(copy)
    appendText(row, "b", `${issue.count}건`)
    qualityIssues.append(row)
  }
}

function renderRuns(data) {
  recentRuns.replaceChildren()
  if (!data.recentRuns.length) {
    const row = document.createElement("tr")
    const cell = appendText(row, "td", "선택 조건의 수집 실행 기록이 없습니다.", "empty")
    cell.colSpan = 6
    recentRuns.append(row)
    return
  }
  for (const run of data.recentRuns) {
    const row = document.createElement("tr")
    appendText(row, "td", run.status, `run-status ${run.status}`)
    appendText(row, "td", formatDate(run.startedAt))
    appendText(row, "td", formatDate(run.completedAt))
    appendText(row, "td", String(run.pageCount))
    appendText(row, "td", run.itemCount.toLocaleString("ko-KR"))
    appendText(row, "td", run.errorCode ?? "—")
    recentRuns.append(row)
  }
}

function resetResults() {
  summaryGrid.hidden = true
  missingMonths.replaceChildren(appendText(document.createDocumentFragment(), "p", "새 조회 결과를 기다리고 있습니다.", "empty"))
  qualityIssues.replaceChildren(appendText(document.createDocumentFragment(), "p", "새 조회 결과를 기다리고 있습니다.", "empty"))
  document.querySelector("#coverage-label").textContent = "—"
  document.querySelector("#issue-count").textContent = "—"
  const row = document.createElement("tr")
  const cell = appendText(row, "td", "새 조회 결과를 기다리고 있습니다.", "empty")
  cell.colSpan = 6
  recentRuns.replaceChildren(row)
}

async function loadStatus(event) {
  event.preventDefault()
  const token = tokenInput.value.trim()
  const dealYmd = monthInput.value.replace("-", "")
  resetResults()
  statusText.className = "status loading"
  statusText.textContent = "데이터 상태를 조회하고 있습니다."

  try {
    const params = new URLSearchParams({ type: typeInput.value, lawdCd: lawdInput.value, dealYmd })
    const response = await fetch(`/api/admin/data-status?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "데이터 상태를 불러오지 못했습니다.")
    renderSummary(data)
    renderCoverage(data)
    renderIssues(data)
    renderRuns(data)
    statusText.className = "status success"
    statusText.textContent = `마지막 수집 ${formatDate(data.lastUpdatedAt)} · 최근 5년 조회 완료`
  } catch (error) {
    statusText.className = "status error"
    statusText.textContent = error instanceof Error ? error.message : "데이터 상태를 불러오지 못했습니다."
  }
}

form.addEventListener("submit", loadStatus)
