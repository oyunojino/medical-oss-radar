# MEDREG Radar

분야별로 정리한 의료 · 의료기기 오픈소스 프로젝트의 활동(스타 수, 마지막 커밋, 보관 여부)을
계속 확인할 수 있는 Next.js 대시보드입니다. MEDREG 프로젝트의 발견(discovery) 기능과
별개로, "이미 알고 있는 후보 프로젝트들이 지금도 살아있는지"를 빠르게 스캔하는 용도로
만들었습니다.

대시보드 외에 SBOM 생성(`npm run sbom`), OSV 취약점 스캔(`npm run osv`), CISA KEV 실제
악용 여부 대조(`npm run kev`), VEX `not_affected` 자동 판정 파일럿(`npm run vex`) 기능도
포함되어 있습니다. 페이지 구성과 데이터 흐름 전체 설명은
[docs/site-overview.md](./docs/site-overview.md)를 참고하세요.

현재 11개 카테고리, 203개 프로젝트가 들어 있습니다(자동 발견·미검증 후보 포함). 사용한 발굴 루트:

1. **awesome-healthcare / awesome-medphys / awesome-medical-imaging** 큐레이션 리스트 — EHR·01, IMG·02, RTX·03 기본 골격
2. **직접 키워드 검색** (OpenAPS, AndroidAPS 등 인공췌장 생태계) — DEV·04
3. **Digital Public Goods Registry** (UN 산하 DPGA, API 제공) — DPG·07. 각 항목의 "Source code" 링크를 직접 확인
4. **open-dicom/awesome-dicom** (DICOM 전용 큐레이션 리스트) — DCM·08. GitHub Topics로 교차 검증
5. **GitHub Topics 직접 탐색** (`medical-device`, `dicom`, `medical-informatics`, `telehealth`, `digital-health`, `biomedical`, `clinical-decision-support` 등) — 위 리스트에 없던 VTK, SimpleITK, ANTs, pynetdicom, fo-dicom 등을 추가로 발굴
6. **Virta Labs(virtalabs.com)** — Tapirx·Blueflow. 의료기기 네트워크 탐지·자산관리 보안 도구로, "검사 대상 오픈소스"를 넘어 MediBOM과 직접 같은 문제 공간(의료기기 보안 인벤토리)을 다루는 사례
7. **추가 키워드 확장 라운드** — 신경영상(MNE-Python, Nipype, DIPY, MRtrix3 등), MRI 재구성(Gadgetron, BART), FHIR 생태계(Microsoft/Google/AWS 서버, Synthea, CQL Engine), 임상 NLP(cTAKES, MedCAT, scispaCy), 암 유전체·시퀀싱(cBioPortal, GATK, SAMtools) 분야를 보강하며 NLP·09, GEN·10 카테고리를 신설

F-Droid의 Health 카테고리도 검토했지만, 실제로는 운동/웰니스 앱이 대부분이라 이
대시보드의 "의료기기" 초점에는 맞지 않아 제외했습니다.

### 검증 상태 요약

`✓ VERIFIED` 배지가 붙은 26개 항목은 DPGA 프로필 또는 GitHub 저장소를 직접 열어
확인했습니다. 나머지 88개(이번에 추가한 35개 포함)는 작성 시점 지식 기반이며, 위 README
상단의 안내대로 한 번씩 확인을 권장합니다.

## 시작하기

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

## GitHub API 호출 한도

기본적으로 인증 없이 GitHub API를 호출하므로 시간당 60회 제한이 있습니다.
프로젝트 수가 늘어나면 금방 한도에 걸릴 수 있으니, `.env.example`을 `.env.local`로
복사하고 [Personal Access Token](https://github.com/settings/tokens)을 발급해
`GITHUB_TOKEN`에 넣어주세요 (시간당 5,000회로 늘어납니다). 토큰에는 별도 스코프가
필요 없습니다 — public 저장소 메타데이터만 읽습니다.

데이터는 `next: { revalidate }` 캐시로 1시간마다 자동 갱신됩니다 (`lib/github.ts`의
`REVALIDATE_SECONDS`에서 조정 가능).

## 신규 후보 자동 발굴 (`npm run discover`)

```bash
npm run discover
```

GitHub Topics 검색(`medical-device`, `dicom`, `fhir` 등)과 awesome 리스트
(`awesome-healthcare`, `awesome-medphys`, `awesome-dicom`) 재스캔으로 아직
`lib/projects.ts`에 없는 저장소를 찾아 `lib/discovered.json`에 추가합니다.
대시보드의 **발견됨 · 자동 수집 (미검증)** 섹션(DISC·11)에 바로 나타납니다.

- GitHub API 한도 때문에 `.env.local`의 `GITHUB_TOKEN`을 강하게 권장합니다 —
  없으면 검색 10회/분, 일반 호출 60회/시간 한도에 금방 걸려 일부 소스가
  중간에 건너뛰어집니다.
- 별 30개 미만인 저장소는 토픽 검색 노이즈(과제용 레포 등)가 많아 자동으로
  제외합니다. (`scripts/discover.mjs`의 `MIN_TOPIC_STARS`)
- Digital Public Goods Registry는 이 환경에서 접근 가능한 공식 JSON API를
  찾지 못해 소스에서 제외했습니다 — 필요하면 등록처 프로필을 직접 확인하세요.
- 발견된 항목은 전부 **미검증**입니다. 검토 후 적절한 카테고리(`categories`)로
  옮기고, `lib/discovered.json`에서는 제거하세요. 같은 저장소를 다시 스캔해도
  중복으로 추가되지 않습니다.

## 프로젝트 추가/수정하기

`lib/projects.ts` 하나만 수정하면 됩니다. 카테고리(`categories` 배열) 안에 항목을
추가하거나, 기존 항목의 `owner`/`repo`를 고치면 됩니다. GitHub에 없는 프로젝트는
`owner`/`repo` 대신 `websiteUrl`만 채우면 통계 없이 링크 카드로 표시됩니다.

```ts
{
  slug: "예시-프로젝트",
  name: "예시 프로젝트",
  owner: "owner-name",
  repo: "repo-name",
  description: "한 줄 설명",
  tags: ["Python", "DICOM"],
}
```

> **⚠️ 슬러그 검증 안내 — 데이터에는 두 단계의 신뢰도가 있습니다**
>
> - **`DPG · 07`** 카테고리는 각 프로젝트의 [Digital Public Goods Registry](https://www.digitalpublicgoods.net/registry) 프로필 페이지를 직접 열어서 DPGA가 검토한 "Source code" 링크를 확인한 값입니다. 카드에 `✓ VERIFIED` 배지가 표시됩니다.
> - 나머지 카테고리(EHR/IMG/RTX/DEV/INT/LAB)의 `owner/repo`는 작성 시점의 지식으로 채운 것이고, GitHub API rate limit 때문에 빌드 시점에 전부 실시간으로 재검증하지는 못했습니다. 잘못된 슬러그는 카드에 "데이터를 찾을 수 없음"으로 조용히 표시될 뿐 빌드가 깨지지는 않지만, MEDREG로 데이터를 옮기기 전에 한 번씩 직접 클릭해서 확인하는 걸 추천합니다.

## 화면 구성

- **카드 펄스 라인** — 각 프로젝트 카드 우측 하단의 심전도 모양 선이 활동 상태를
  나타냅니다. 뾰족한 파형(초록) = 최근 30일 이내 커밋, 둥근 단봉(주황) = 1년 이내,
  평탄선(빨강) = 1년 이상 또는 보관(archived) 상태.
- **검색창** — 이름/설명/태그 기준 클라이언트 필터링.
- **카테고리 코드** — `EHR · 01`처럼 표시되는 분류 코드는 `lib/projects.ts`의
  `code` 필드에서 관리합니다.

## 구조

```
app/
  layout.tsx       전역 폰트(IBM Plex Mono/Sans) + 메타데이터
  page.tsx         서버 컴포넌트 — GitHub 통계를 가져와 Dashboard에 전달
  globals.css
components/
  Dashboard.tsx    검색/필터 + 카테고리 섹션 렌더링 (client component)
  ProjectCard.tsx  개별 프로젝트 카드
  Pulse.tsx        활동 상태를 나타내는 SVG 파형
lib/
  projects.ts      프로젝트 시드 데이터 (수동 큐레이션 카테고리들)
  discovered.ts    discovered.json을 Project[]로 노출하는 얇은 래퍼
  discovered.json  npm run discover가 쓰는 자동 수집 후보 (미검증)
  github.ts        GitHub API 호출 + 캐싱 + 에러 처리
  time.ts          "n일 전" 포맷 + 활동 상태 계산
scripts/
  discover.mjs     GitHub Topics / awesome 리스트에서 신규 후보를 찾아오는 스크립트
```

이 트리는 대시보드(`/`) 부분만 보여줍니다. SBOM/취약점/VEX/KEV 관련 파일 전체 구조는
[docs/site-overview.md](./docs/site-overview.md)의 "기술 스택 / 구조" 절을 참고하세요.
