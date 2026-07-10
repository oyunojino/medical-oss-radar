# MEDREG Radar — 웹사이트 설명

의료·의료기기 오픈소스 프로젝트를 분야별로 추적하는 Next.js 대시보드. `https://medreg-radar.vercel.app`에 배포되어 있으며, 3개 페이지(대시보드 / SBOM / 취약점 스캔)로 구성됩니다. MEDREG 프로젝트의 "발견(discovery)" 기능과는 별개로, "이미 알고 있는 후보 프로젝트들이 지금도 살아있고 안전한지"를 계속 확인하는 용도.

## 1. 대시보드 (`/`)

**목적**: 203개 프로젝트가 여전히 활발한지 한눈에 보여줌.

- **상단 요약 카드**: 전체 프로젝트 수, 카테고리 수, ACTIVE/AGING/DORMANT 개수, 총 스타 수
- **활동 상태 분류** (`lib/time.ts`):
  - `active` — 최근 30일 이내 커밋
  - `aging` — 30일~365일
  - `dormant` — 365일 초과, 또는 `archived` 처리된 저장소
- **11개 카테고리**: EHR·01(병원정보시스템) / IMG·02(의료영상) / RTX·03(방사선치료) / DEV·04(의료기기 연동) / INT·05 / LAB·06(랩·병리) / DPG·07(Digital Public Goods 검증됨) / DCM·08(DICOM) / NLP·09(임상 NLP) / GEN·10(유전체) / DISC·11(자동 발견·미검증)
- **프로젝트 카드**: 이름, 설명, 언어/태그, 스타 수, 마지막 커밋 시점, 활동 상태를 나타내는 심전도 모양 SVG 파형(`Pulse.tsx`) — 초록 뾰족 파형(active) / 주황 둥근 파형(aging) / 빨강 평탄선(dormant)
- **검색**: 이름·설명·태그 기준 클라이언트 사이드 필터링
- **데이터 소스**: `lib/projects.ts`(수동 큐레이션) + `lib/discovered.json`(`npm run discover`가 자동 수집한 미검증 후보)
- **GitHub 데이터**: `lib/github.ts`가 서버 사이드에서 GitHub REST/GraphQL API를 호출 (`GITHUB_TOKEN` 있으면 GraphQL 배치, 없으면 동시성 제한 REST). `revalidate = 3600`으로 1시간마다 갱신. 관련 이슈와 수정 내역은 [github-data-integrity.md](./github-data-integrity.md) 참고.

## 2. SBOM (`/sbom`)

**목적**: 각 프로젝트의 소프트웨어 구성요소 명세(SBOM)를 CycloneDX/SPDX 형식으로 열람·다운로드.

- `npm run sbom` (`scripts/sbom.mjs`)이 프로젝트별로 얕은 git clone → [syft](https://github.com/anchore/syft) 스캔 → `sboms/<slug>.cdx.json` / `sboms/<slug>.spdx.json` 생성 → clone 삭제, 를 순차 실행 (repo당 타임아웃 있음)
- `/sbom` — 생성된 SBOM이 있는 프로젝트 목록과 컴포넌트 수 요약
- `/sbom/[slug]` — 프로젝트별 상세 (구성요소 목록, 라이선스 등)
- `/sbom/[slug]/[format]` — `cdx` 또는 `spdx` 원본 JSON을 그대로 서빙 (다운로드/외부 도구 연동용)
- SBOM이 아직 없으면 "npm run sbom을 먼저 실행하세요" 안내 표시

## 3. 취약점 스캔 (`/vulnerabilities`)

**목적**: SBOM에 기록된 구성요소들의 알려진 취약점(CVE/GHSA)을 추적.

- `npm run osv` (`scripts/osv-scan.mjs`)가 `sboms/`의 CycloneDX purl들을 모아 [OSV.dev](https://osv.dev) API에 배치 조회 → 신규/변경된 것만 상세 조회(캐시: `vulns/_db.json`) → `vulns/<slug>.json`에 프로젝트별 영향 컴포넌트 저장
- 심각도 분류(`lib/severity.ts`): CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN — OSV가 정규화된 심각도를 제공하지 않으면 추측하지 않고 UNKNOWN 처리
- **dev-only 의존성 필터링** (`scripts/dev-scope.mjs`): npm/pnpm devDependencies, Pipfile.lock의 develop 그룹처럼 배포 산출물에 포함되지 않는 패키지는 취약점 집계에서 제외 (모든 락파일이 동의할 때만 제외 — 보수적으로 판단)
- **VEX 처리** (`npm run vex`, `scripts/vex-scan.mjs`): "vulnerable_code_not_present" 판정 하나를 자동화하는 파일럿. 취약점 수정 커밋의 diff에서 변경된 함수명을 뽑아, 실제 설치된 버전의 소스 코드에 그 함수가 없으면 `not_affected`로 표시. 조금이라도 애매하면(코드 발견/난독화/조회 실패 등) 절대 `not_affected`로 넘기지 않고 `under_investigation`으로 남김 — 의료 공급망 데이터라 거짓 안전 판정이 미확인 상태보다 훨씬 위험하다는 원칙([[feedback_conservative_safety_bias]] 참고)
- `/vulnerabilities` — 전체 취약점 요약, VEX 커버리지(스캔된 슬러그 수), 최근 스캔 시각
- `/vulnerabilities/[slug]` — 프로젝트별 취약점 상세, 심각도별 정렬

## 기술 스택 / 구조

```
app/
  layout.tsx                       전역 폰트(IBM Plex Mono/Sans) + TopNav
  page.tsx                         대시보드 (서버 컴포넌트, GitHub 통계 fetch)
  sbom/page.tsx                    SBOM 목록
  sbom/[slug]/page.tsx             SBOM 상세
  sbom/[slug]/[format]/route.ts    SBOM 원본 JSON 다운로드
  vulnerabilities/page.tsx         취약점 목록
  vulnerabilities/[slug]/page.tsx  취약점 상세
components/
  Dashboard.tsx / ProjectCard.tsx / Pulse.tsx   대시보드 UI
  SbomDashboard.tsx                              SBOM UI
  VulnDashboard.tsx                              취약점 UI
  TopNav.tsx                                     상단 내비게이션
lib/
  projects.ts     프로젝트 시드 데이터 (수동 큐레이션, 11개 카테고리)
  discovered.ts/json   자동 수집 후보 (미검증)
  github.ts       GitHub API 호출 + 캐싱 + 인증/rate-limit 처리
  sbom.ts         SBOM 파일 읽기/요약
  osv.ts          OSV 취약점 DB 로드/집계
  vex.ts          VEX 스캔 결과 로드
  severity.ts     심각도 타입/정규화 (서버·클라이언트 공용)
  time.ts         "n일 전" 포맷 + 활동 상태 계산
scripts/
  discover.mjs     GitHub Topics/awesome 리스트에서 신규 후보 발굴
  check-repos.mjs  discovered.json의 owner/repo 슬러그 유효성 검증/자동 수정
  sbom.mjs         SBOM 생성 (git clone + syft)
  osv-scan.mjs     OSV.dev 취약점 스캔
  vex-scan.mjs     VEX not_affected 자동 판정 파일럿
  dev-scope.mjs    dev-only 의존성 탐지 (취약점 집계 제외용)
```

**배포**: Vercel (`vercel --prod`), 프로젝트 `yunjin/medreg-radar`. GitHub API 인증용 `GITHUB_TOKEN`을 로컬 `.env.local`과 Vercel 프로덕션 환경변수 양쪽에 설정해야 함 (자세한 배경은 [github-data-integrity.md](./github-data-integrity.md)).

**데이터 흐름 요약**: `projects.ts`/`discovered.json`(어떤 프로젝트를 추적할지) → `sbom.mjs`(무엇이 들어있는지) → `osv-scan.mjs`(뭐가 취약한지) → `vex-scan.mjs`(실제로 위험한지) → 대시보드 3개 페이지가 각각 이 파이프라인의 다른 단계를 보여줌.
