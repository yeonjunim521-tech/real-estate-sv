# 부동산 분석 PRO Cloudflare 통합 이전 설계

## 목표

Netlify 정적 프론트엔드와 Render Python 프록시를 Cloudflare Worker 한 개로 통합한다. 기존 화면과 국토부 실거래가 8종 조회 기능을 유지하면서 공개된 API 키와 임의 URL 프록시를 제거하고, 연준랩 대시보드가 읽을 수 있는 OG 썸네일 정보를 제공한다.

## 아키텍처

- Cloudflare Workers Static Assets가 `public/`의 HTML, CSS, JavaScript, OG 이미지를 제공한다.
- 같은 Worker가 `GET /api/real-estate`만 처리한다.
- 프론트엔드는 `type`, `lawdCd`, `dealYmd`만 전달한다.
- Worker는 내부 allowlist에서 국토부 API 주소를 선택하고 `DATA_GO_KR_SERVICE_KEY` Secret을 추가한다.
- Worker가 아닌 경로는 정적 자산 binding으로 전달한다.

## API 계약

요청:

```text
GET /api/real-estate?type=apt&lawdCd=11680&dealYmd=202606
```

- `type`: `apt`, `rhous`, `shous`, `office`, `comm`, `fact`, `land`, `right` 중 하나
- `lawdCd`: 숫자 5자리
- `dealYmd`: 유효한 연월 `YYYYMM`

응답:

- 성공: 국토부 API의 JSON 본문과 성공 상태를 전달한다.
- 잘못된 입력: HTTP 400 JSON 오류
- 허용하지 않은 메서드: HTTP 405 JSON 오류
- 국토부 API 실패: 상태 코드를 유지하되 민감정보가 포함되지 않은 JSON 오류

## 보안

- API 키를 프론트엔드와 Git 저장소에서 제거한다.
- API 키는 Cloudflare Secret `DATA_GO_KR_SERVICE_KEY`로만 제공한다.
- 사용자 입력 URL을 받지 않고 고정된 국토부 API 8종만 호출한다.
- 응답 로그와 오류에 API 키 및 완성된 상류 URL을 출력하지 않는다.
- 기존에 공개된 키는 이전 완료 후 공공데이터포털에서 재발급을 권장한다.

## 프론트엔드와 메타데이터

- 기존 UI·지역 데이터·테이블·히스토리 기능을 유지한다.
- Render 및 cors-anywhere 분기 코드를 제거한다.
- 상대경로 `/api/real-estate`만 호출한다.
- `index.html`에 description, Open Graph, Twitter Card 메타데이터를 추가한다.
- `public/real-estate-pro-og.png`를 1200×630 대표 이미지로 사용한다.

## 배포와 전환

- GitHub `yeonjunim521-tech/real-estate-sv`에 통합 소스를 반영한다.
- Cloudflare Worker를 새 서비스로 배포하고 정적 페이지와 API를 검증한다.
- Netlify와 Render는 새 서비스 검증 전까지 유지한다.
- 삭제는 이번 작업 범위에 포함하지 않는다.

## 검증

- Worker 입력 검증, allowlist 라우팅, Secret 주입, 상류 실패를 자동 테스트한다.
- 프론트엔드에 API 키와 Render 주소가 남지 않았는지 정적 검사한다.
- TypeScript 타입 검사, 테스트, Wrangler dry-run을 통과시킨다.
- 배포 후 HTML 메타데이터, OG 이미지, API 응답을 실제 URL에서 확인한다.

