# Cloudflare Unified Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Netlify 프론트엔드와 Render 프록시를 보안이 강화된 Cloudflare Worker 한 개로 통합하고 OG 썸네일을 제공한다.

**Architecture:** Workers Static Assets가 기존 정적 UI를 제공하고 Worker의 `/api/real-estate` 라우트가 고정된 국토부 API allowlist로만 요청한다. API 키는 `DATA_GO_KR_SERVICE_KEY` Secret으로 주입하며 프론트엔드는 조회 파라미터만 전달한다.

**Tech Stack:** Cloudflare Workers, TypeScript, Wrangler 4, Vitest, HTML/CSS/JavaScript

## Global Constraints

- 기존 Netlify와 Render 서비스는 새 Cloudflare 배포 검증 전까지 변경하거나 삭제하지 않는다.
- 국토부 API 키를 소스, 설정, 로그, 테스트 fixture에 기록하지 않는다.
- 프론트엔드 화면과 8종 조회 기능을 유지한다.
- 새 API는 `GET /api/real-estate`만 허용한다.
- OG 이미지는 1200×630 PNG로 제공한다.

---

### Task 1: Worker API 계약과 보안 경계

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `test/worker.test.ts`
- Create: `src/worker.ts`

**Interfaces:**
- Consumes: `GET /api/real-estate?type=<type>&lawdCd=<5 digits>&dealYmd=<YYYYMM>`
- Produces: `createWorkerHandler(fetchUpstream)` 및 기본 Worker export

- [ ] **Step 1:** Vitest·TypeScript·Wrangler 개발 의존성과 테스트 명령을 선언한다.
- [ ] **Step 2:** 정상 요청, 잘못된 유형·지역·연월, 비허용 메서드, 상류 실패 테스트를 먼저 작성한다.
- [ ] **Step 3:** 테스트를 실행하여 구현 모듈 부재로 실패하는 것을 확인한다.
- [ ] **Step 4:** 고정 API allowlist, 입력 검증, Secret 주입, 정적 자산 fallback을 구현한다.
- [ ] **Step 5:** 전체 테스트와 타입 검사를 실행하여 통과를 확인한다.

### Task 2: 프론트엔드 안전 이전

**Files:**
- Move: `index.html` → `public/index.html`
- Move: `main.js` → `public/main.js`
- Move: `style.css` → `public/style.css`
- Create: `test/frontend.test.ts`

**Interfaces:**
- Consumes: Worker의 상대경로 `/api/real-estate`
- Produces: API 키와 외부 프록시 주소가 없는 정적 배포본

- [ ] **Step 1:** 프론트엔드에서 API 키·Render·cors-anywhere가 제거되고 상대 API를 사용하는지 검사하는 실패 테스트를 작성한다.
- [ ] **Step 2:** 테스트가 현재 배포본의 공개 키와 Render 주소 때문에 실패하는 것을 확인한다.
- [ ] **Step 3:** 정적 파일을 `public/`로 이동하고 `fetchSingleType`을 상대 API 계약에 맞게 수정한다.
- [ ] **Step 4:** 테스트와 브라우저용 JavaScript 구문 검사를 통과시킨다.

### Task 3: Wrangler 구성과 OG 메타데이터

**Files:**
- Create: `wrangler.jsonc`
- Modify: `public/index.html`
- Create: `public/real-estate-pro-og.png`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Consumes: `src/worker.ts`, `public/`
- Produces: 배포 가능한 Worker Static Assets 번들

- [ ] **Step 1:** 오늘 날짜 compatibility date, assets binding, observability 설정을 추가한다.
- [ ] **Step 2:** description, Open Graph, Twitter Card 메타데이터를 추가한다.
- [ ] **Step 3:** 1200×630 OG 이미지를 생성해 프로젝트에 저장한다.
- [ ] **Step 4:** 설정 파일에서 TypeScript binding 타입을 생성하고 dry-run을 통과시킨다.

### Task 4: GitHub 반영과 Cloudflare 배포

**Files:**
- GitHub repository: `yeonjunim521-tech/real-estate-sv`

**Interfaces:**
- Consumes: 검증 완료된 전체 프로젝트와 기존 공개 배포본에서 안전하게 추출한 API 키
- Produces: GitHub commit 및 Cloudflare production URL

- [ ] **Step 1:** 테스트, 타입 검사, 구문 검사, 비밀값 검사를 다시 실행한다.
- [ ] **Step 2:** GitHub `main`의 최신 SHA를 확인하고 새 파일을 단일 검증 커밋으로 반영한다.
- [ ] **Step 3:** 기존 공개 배포본에서 추출한 키를 출력하지 않고 Cloudflare Secret으로 설정한다.
- [ ] **Step 4:** Worker를 배포하고 production URL을 기록한다.
- [ ] **Step 5:** production HTML, OG 이미지, 정상·오류 API 요청을 확인한다.
- [ ] **Step 6:** Netlify·Render가 변경되지 않았는지 확인하고 결과를 보고한다.

