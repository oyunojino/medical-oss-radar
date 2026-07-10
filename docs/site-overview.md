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
- **카테고리별 그리드 접기/펼치기** (`ExpandableGrid.tsx`): 카테고리당 기본 노출 개수를 넘으면 "더 보기"로 접어 페이지 스크롤 길이를 줄임 — SBOM 목록에도 동일 컴포넌트 재사용
- **데이터 소스**: `lib/projects.ts`(수동 큐레이션) + `lib/discovered.json`(`npm run discover`가 자동 수집한 미검증 후보)
- **GitHub 데이터**: `lib/github.ts`가 서버 사이드에서 GitHub REST/GraphQL API를 호출 (`GITHUB_TOKEN` 있으면 GraphQL 배치, 없으면 동시성 제한 REST). `revalidate = 3600`으로 1시간마다 갱신. 관련 이슈와 수정 내역은 [github-data-integrity.md](./github-data-integrity.md) 참고.

## 2. SBOM (`/sbom`)

**목적**: 각 프로젝트의 소프트웨어 구성요소 명세(SBOM)를 CycloneDX/SPDX 형식으로 열람·다운로드.

- `npm run sbom` (`scripts/sbom.mjs`)이 프로젝트별로 얕은 git clone → [syft](https://github.com/anchore/syft) 스캔 → `sboms/<slug>.cdx.json` / `sboms/<slug>.spdx.json` 생성 → clone 삭제, 를 순차 실행 (repo당 타임아웃 있음)
- `/sbom` — 생성된 SBOM이 있는 프로젝트 목록과 컴포넌트 수 요약 (`ExpandableGrid`로 접기/펼치기)
- `/sbom/[slug]` — 프로젝트별 상세 (구성요소 목록, 라이선스 등). 구성요소 표는 `SbomComponentTable.tsx`로 분리 + `Pagination.tsx`로 페이지네이션해 스크롤 축소
- `/sbom/[slug]/[format]` — `cdx` 또는 `spdx` 원본 JSON을 그대로 서빙 (다운로드/외부 도구 연동용)
- SBOM이 아직 없으면 "npm run sbom을 먼저 실행하세요" 안내 표시

## 3. 취약점 스캔 (`/vulnerabilities`)

**목적**: SBOM에 기록된 구성요소들의 알려진 취약점(CVE/GHSA)을 추적.

- `npm run osv` (`scripts/osv-scan.mjs`)가 `sboms/`의 CycloneDX purl들을 모아 [OSV.dev](https://osv.dev) API에 배치 조회 → 신규/변경된 것만 상세 조회(캐시: `vulns/_db.json`) → `vulns/<slug>.json`에 프로젝트별 영향 컴포넌트 저장
- 심각도 분류(`lib/severity.ts`): CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN — OSV가 정규화된 심각도를 제공하지 않으면 추측하지 않고 UNKNOWN 처리
- **dev-only 의존성 필터링** (`scripts/dev-scope.mjs`): npm/pnpm devDependencies, Pipfile.lock의 develop 그룹처럼 배포 산출물에 포함되지 않는 패키지는 취약점 집계에서 제외 (모든 락파일이 동의할 때만 제외 — 보수적으로 판단)
- **VEX 처리** (`npm run vex`, `scripts/vex-scan.mjs`): "vulnerable_code_not_present" 판정 하나를 자동화하는 파일럿. 취약점 수정 커밋의 diff에서 변경된 함수명을 뽑아, 실제 설치된 버전의 소스 코드에 그 함수가 없으면 `not_affected`로 표시. 조금이라도 애매하면(코드 발견/난독화/조회 실패 등) 절대 `not_affected`로 넘기지 않고 `under_investigation`으로 남김 — 의료 공급망 데이터라 거짓 안전 판정이 미확인 상태보다 훨씬 위험하다는 원칙([[feedback_conservative_safety_bias]] 참고). 아직 시험판 단계로 진행 상황과 남은 설계 과제는 [feedback-followup.md](./feedback-followup.md) 참고.
- **CISA KEV 연동** (`npm run kev`, `scripts/kev-scan.mjs`): OSV 심각도는 CVSS 기준 "이론상 위험도"만 나타내고 실제 악용 여부는 반영하지 않음. CISA의 [Known Exploited Vulnerabilities 카탈로그](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)(공개 JSON, 인증 불필요)를 CVE 별칭으로 대조해 `vulns/_kev.json`에 저장, 실제 악용이 확인된 CVE(예: bahmni의 Log4Shell, Spring4Shell)에 배지를 붙이고 심각도보다 우선 정렬. `.github/workflows/kev-scan.yml`이 매일 03:00 KST에 실행해 카탈로그가 바뀌면 자동으로 main에 커밋 → Vercel이 push 시 재배포 (Vercel Cron은 서버리스라 파일을 커밋할 수 없어 GitHub Actions로 구현)
- `/vulnerabilities` — 전체 취약점 요약, VEX 커버리지(스캔된 슬러그 수), KEV 등재 건수, 최근 스캔 시각. 목록은 `VulnTabs`/`VulnPills`/`VulnCardList`로 탭·필터·카드형 리스트를 구성해 스크롤 길이를 줄임
- `/vulnerabilities/[slug]` — 프로젝트별 취약점 상세, 심각도(및 KEV 우선)별 정렬. 영향 컴포넌트 표는 `VulnAffectedTable.tsx`로 분리

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
  ExpandableGrid.tsx                             카테고리별 그리드 접기/펼치기 (대시보드+SBOM 공용)
  Pagination.tsx                                 표 페이지네이션 (SBOM 상세 등에서 재사용)
  SbomDashboard.tsx / SbomComponentTable.tsx     SBOM 목록 UI / 구성요소 표
  VulnDashboard.tsx                               취약점 목록 UI
  VulnTabs.tsx / VulnPills.tsx / VulnCardList.tsx / VulnAffectedTable.tsx
                                                   취약점 상세 페이지 탭·필터·카드·영향 컴포넌트 표
  TopNav.tsx                                     상단 내비게이션
lib/
  projects.ts     프로젝트 시드 데이터 (수동 큐레이션, 11개 카테고리)
  discovered.ts/json   자동 수집 후보 (미검증)
  github.ts       GitHub API 호출 + 캐싱 + 인증/rate-limit 처리
  sbom.ts         SBOM 파일 읽기/요약
  osv.ts          OSV 취약점 DB 로드/집계 + CISA KEV 대조(`_kev.json` 조인)
  vex.ts          VEX 스캔 결과 로드
  severity.ts     심각도 타입/정규화 + KEV 엔트리 타입 (서버·클라이언트 공용)
  time.ts         "n일 전" 포맷 + 활동 상태 계산
scripts/
  discover.mjs     GitHub Topics/awesome 리스트에서 신규 후보 발굴
  check-repos.mjs  discovered.json의 owner/repo 슬러그 유효성 검증/자동 수정
  sbom.mjs         SBOM 생성 (git clone + syft)
  osv-scan.mjs     OSV.dev 취약점 스캔
  vex-scan.mjs     VEX not_affected 자동 판정 파일럿
  dev-scope.mjs    dev-only 의존성 탐지 (취약점 집계 제외용)
  kev-scan.mjs     CISA KEV 카탈로그 동기화 (npm run kev → vulns/_kev.json)
.github/workflows/
  kev-scan.yml     매일 03:00 KST에 kev-scan 실행, 변경 시 main에 자동 커밋
```

**배포**: Vercel (`vercel --prod`), 프로젝트 `yunjin/medreg-radar`. GitHub API 인증용 `GITHUB_TOKEN`을 로컬 `.env.local`과 Vercel 프로덕션 환경변수 양쪽에 설정해야 함 (자세한 배경은 [github-data-integrity.md](./github-data-integrity.md)).

**데이터 흐름 요약**: `projects.ts`/`discovered.json`(어떤 프로젝트를 추적할지) → `sbom.mjs`(무엇이 들어있는지) → `osv-scan.mjs`(뭐가 취약한지) → `vex-scan.mjs`(실제로 위험한지) + `kev-scan.mjs`(실제로 악용되고 있는지) → 대시보드 3개 페이지가 각각 이 파이프라인의 다른 단계를 보여줌.
