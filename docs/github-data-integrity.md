# GitHub 데이터 정합성 — 조사 및 수정 기록 (2026-07-09 ~ 2026-07-10)

대시보드의 ACTIVE/AGING/DORMANT 통계가 실제 최신 상태를 반영하는지 점검하다가 발견한 문제와 그 수정 내역.

## 1. 문제: GITHUB_TOKEN 미설정으로 인한 대량 데이터 누락

`medreg-radar.vercel.app` 스크린샷 기준, 203개 추적 프로젝트 중 56건(ACTIVE 39 / AGING 7 / DORMANT 10)만 실제 GitHub 데이터를 받았고 147건이 "GitHub 통계 없음"으로 표시됨.

**원인**: `vercel env ls production` 확인 결과 프로덕션에 환경변수가 전혀 설정되어 있지 않았음. `lib/github.ts`는 `GITHUB_TOKEN`이 없으면 GraphQL 배치 대신 REST를 동시성 5로 호출하는데, 이 경로는 GitHub 미인증 한도(60건/시간)에 금방 걸림. 실패한 요청은 `components/Dashboard.tsx`의 `byStatus` 집계에서 조용히 제외됨 (dormant로 잘못 분류되는 게 아니라 통계에서 완전히 빠짐).

부가 발견: "LAST SYNCED" 타임스탬프(`app/page.tsx:39`)는 실제 GitHub fetch 시각이 아니라 페이지 렌더링 시각(`new Date()`)이라 동기화 시각으로 오해될 소지가 있음.

## 2. 수정: GITHUB_TOKEN 발급 및 등록

1. github.com/settings/tokens에서 scope 없는 classic PAT 발급 (공개 repo 메타데이터만 읽으므로 권한 불필요)
2. `.env.local`에 `GITHUB_TOKEN=ghp_...` 추가 (로컬 개발용)
3. `vercel env add GITHUB_TOKEN production` 으로 프로덕션에도 등록
4. `vercel --prod` 로 재배포

**결과 (배포 전 → 후)**:

| | 이전 | 이후 |
|---|---|---|
| ACTIVE | 39 | 106 |
| AGING | 7 | 38 |
| DORMANT | 10 | 55 |
| 통계 없음 | 147 | 4 |

인증된 GraphQL 배치 경로로 전환되어 시간당 한도가 5,000건으로 상승, 203개 프로젝트 전체를 몇 번의 요청으로 커버.

## 3. 남은 7건(→4건) 분석

토큰 적용 후에도 남아있던 "통계 없음" 7건을 개별 조사:

### 실제 404 — 3건 (owner/repo 슬러그 오류, `lib/projects.ts`에서 수정)

| slug | 기존 (404) | 수정 |
|---|---|---|
| `labkey-server` | `LabKey/labkey-server` | `LabKey/server` |
| `openspecimen` | `informatics-llc/openspecimen` | `krishagni/openspecimen` |
| `openlmis` | `openlmis/openlmis` | `OpenLMIS/openlmis-ref-distro` |

각 저장소는 GitHub 검색 API와 조직(org) 목록 조회로 실제 후속 저장소를 찾아 star 수·설명·최근 커밋 여부로 검증 후 반영. 커밋 `2f16e5c`, `origin/main`에 푸시 완료.

### 설계상 정상 — 4건 (GitHub 미호스팅, 수정 불필요)

`owner`/`repo` 없이 `websiteUrl`만 있는 프로젝트라 애초에 GitHub 통계 대상이 아님: GNU Health, OpenEEG, Open mHealth, PixelMed.

**최종**: 106 + 38 + 55 + 4 = 203 (전체 커버).

## 4. `lib/discovered.json` 전수 조사

90개 항목 전부 GitHub API로 개별 조회 — 404/오류 0건. `npm run discover` 스크립트가 애초에 GitHub API로 검증하며 항목을 추가하는 구조라 데이터 품질이 깨끗함.

## 5. 신규 스크립트: `scripts/check-repos.mjs`

`discovered.json`의 owner/repo 슬러그가 향후 깨질 경우를 대비한 자동 점검/수정 도구.

```
npm run check-repos          # 리포트만 (기본)
npm run check-repos -- --fix # 자동 수정 가능한 항목만 discovered.json에 반영
```

**설계 원칙** (안전 우선, 모호한 판단은 자동 처리하지 않음):

- **이름/소유자 변경** — GitHub API가 자동으로 새 위치로 리다이렉트하는 경우, 응답의 `full_name`이 원본과 다르면 감지. GitHub 자신이 동일 저장소임을 확인해주는 케이스라 **자동 수정 가능**.
- **진짜 404** — 저장소가 삭제되었거나 리다이렉트 없이 완전히 이동한 경우. 대체 저장소를 고르는 건 "같은 프로젝트가 맞는지" 검증이 필요한 판단이므로 (§3의 3건이 그랬듯) **자동 수정하지 않고 목록만 보고** — 리스트를 보고 사람이 직접 §3과 같은 방식으로 확인해서 `lib/projects.ts` 또는 `lib/discovered.json`을 수정해야 함.

`lib/projects.ts`도 같은 방식으로 점검하려면 이 스크립트를 확장해야 함 (현재는 `discovered.json`만 대상).

## 후속 참고사항

- Classic PAT는 만료 설정에 따라 재발급이 필요할 수 있음 — GitHub 데이터 공백이 재발하면 토큰 만료부터 확인.
- `npm run check-repos`를 주기적으로 (또는 CI에) 실행하면 슬러그 부패를 조기에 발견 가능.
