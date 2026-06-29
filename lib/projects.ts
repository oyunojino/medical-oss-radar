import { discoveredProjects } from "./discovered";

export type Project = {
  slug: string;
  name: string;
  description: string;
  /** GitHub "owner/repo" if hosted there — omit (use websiteUrl) if hosted elsewhere */
  owner?: string;
  repo?: string;
  websiteUrl?: string;
  tags: string[];
  /** true if the owner/repo was confirmed against a primary source (e.g. the DPG
   * Registry's own "Source code" link), rather than filled in from general knowledge */
  verified?: boolean;
};

export type Category = {
  code: string; // chart-style classification code, e.g. "EHR · 01"
  slug: string;
  title: string;
  subtitle: string;
  projects: Project[];
};

// NOTE on data quality — two tiers:
// - DPG·07 entries were verified by fetching each project's Digital Public Goods
//   Registry profile page directly (digitalpublicgoods.net), which lists a
//   DPGA-reviewed "Source code" link. These owner/repo values are confirmed.
// - All other categories (EHR/IMG/RTX/DEV/INT/LAB) were filled in from best
//   available knowledge and were NOT individually re-verified against the live
//   GitHub API (it was rate-limited at build time). The dashboard fails
//   gracefully (shows "데이터 없음") for any slug that's wrong or renamed — but
//   double-check before relying on this for MEDREG ingestion.
export const categories: Category[] = [
  {
    code: "EHR · 01",
    slug: "ehr",
    title: "병원정보시스템 · EHR",
    subtitle: "전자의무기록, 병원관리, 외래/입원 워크플로우",
    projects: [
      {
        slug: "openmrs",
        name: "OpenMRS",
        owner: "openmrs",
        repo: "openmrs-core",
        description:
          "저자원 환경에서 가장 널리 쓰이는 모듈형 오픈소스 EMR 플랫폼.",
        tags: ["Java", "EMR"],
      },
      {
        slug: "bahmni",
        name: "Bahmni",
        owner: "Bahmni",
        repo: "bahmni-core",
        description:
          "OpenMRS 기반의 통합 병원정보시스템. 외래·입원·약국 워크플로우 포함.",
        tags: ["Java", "HIS"],
      },
      {
        slug: "openemr",
        name: "OpenEMR",
        owner: "openemr",
        repo: "openemr",
        description:
          "ONC 인증을 받은 미국 내 대표적인 오픈소스 EMR / 진료 관리 솔루션.",
        tags: ["PHP", "EMR"],
      },
      {
        slug: "hospitalrun",
        name: "HospitalRun",
        owner: "HospitalRun",
        repo: "hospitalrun",
        description: "오프라인에서도 동작하는 저자원 환경용 병원관리 시스템.",
        tags: ["JavaScript", "HIS"],
      },
      {
        slug: "gnu-health",
        name: "GNU Health",
        websiteUrl: "https://www.gnuhealth.org",
        description: "GNU 프로젝트 산하의 EHR + 병원관리(HIS) 통합 시스템.",
        tags: ["Python", "HIS"],
      },
      {
        slug: "ehrbase",
        name: "EHRbase",
        owner: "ehrbase",
        repo: "ehrbase",
        description:
          "openEHR 표준 기반의 오픈소스 임상 데이터 리포지토리(CDR) 백엔드 서버.",
        tags: ["Java", "openEHR"],
        verified: true,
      },
      {
        slug: "ehrapy",
        name: "ehrapy",
        owner: "theislab",
        repo: "ehrapy",
        description:
          "전자의무기록(EHR) 데이터를 분석하기 위한 Python 라이브러리.",
        tags: ["Python", "EHR Analytics"],
      },
      {
        slug: "oscar",
        name: "OSCAR EMR",
        owner: "oscaremr",
        repo: "oscar",
        description: "캐나다 기반의 오픈소스 병원/클리닉 EHR 시스템.",
        tags: ["Java", "EMR"],
      },
      {
        slug: "librehealth-ehr",
        name: "LibreHealth EHR",
        owner: "LibreHealthIO",
        repo: "LibreHealthEHR",
        description:
          "오픈소스 의료정보시스템과 EHR 플랫폼을 제공하는 LibreHealth 프로젝트.",
        tags: ["Java", "EHR"],
      },
      {
        slug: "osehra-vista",
        name: "OSEHRA VistA",
        owner: "OSEHRA",
        repo: "VistA",
        description:
          "미국 정부를 위해 개발된 오픈소스 EHR/EMR 플랫폼의 전통적인 구현체.",
        tags: ["MUMPS", "EHR"],
      },
      {
        slug: "openhospital",
        name: "Open Hospital",
        owner: "informatici",
        repo: "openhospital-core",
        description:
          "저자원 환경 병원을 위해 Informatici Senza Frontiere가 개발한 오픈소스 병원관리 시스템.",
        tags: ["Java", "HIS"],
      },
      {
        slug: "tamanu",
        name: "Tamanu",
        owner: "beyondessential",
        repo: "tamanu",
        description:
          "태평양 도서국 등 저자원 환경에 배포되는 오픈소스 EHR/HIS 플랫폼.",
        tags: ["JavaScript", "EHR"],
      },
      {
        slug: "openclinica",
        name: "OpenClinica",
        owner: "OpenClinica",
        repo: "OpenClinica",
        description: "임상시험 데이터 수집(EDC)을 위한 오픈소스 플랫폼.",
        tags: ["Java", "Clinical Trials"],
      },
    ],
  },
  {
    code: "IMG · 02",
    slug: "imaging",
    title: "의료영상 · DICOM · PACS",
    subtitle: "영상 뷰어, 처리/분할 툴킷, DICOM 표준 도구",
    projects: [
      {
        slug: "3d-slicer",
        name: "3D Slicer",
        owner: "Slicer",
        repo: "Slicer",
        description:
          "의료영상 정보학·처리·3D 시각화를 위한 대표적 오픈소스 플랫폼.",
        tags: ["C++", "Imaging"],
      },
      {
        slug: "ohif-viewers",
        name: "OHIF Viewers",
        owner: "OHIF",
        repo: "Viewers",
        description:
          "브라우저에서 바로 띄우는 zero-footprint 웹 기반 DICOM 뷰어.",
        tags: ["TypeScript", "DICOM"],
      },
      {
        slug: "itk",
        name: "ITK",
        owner: "InsightSoftwareConsortium",
        repo: "ITK",
        description:
          "영상 분할·정합(registration) 알고리즘의 기준이 되는 C++ 툴킷.",
        tags: ["C++", "Segmentation"],
      },
      {
        slug: "pydicom",
        name: "pydicom",
        owner: "pydicom",
        repo: "pydicom",
        description:
          "DICOM 파일을 읽고 쓰는 가장 널리 쓰이는 Python 라이브러리.",
        tags: ["Python", "DICOM"],
      },
      {
        slug: "invesalius",
        name: "InVesalius",
        owner: "invesalius",
        repo: "invesalius3",
        description:
          "CT/MRI 영상을 3D로 재구성하는 브라질 기반 오픈소스 소프트웨어.",
        tags: ["Python", "Reconstruction"],
      },
      {
        slug: "dcm2niix",
        name: "dcm2niix",
        owner: "rordenlab",
        repo: "dcm2niix",
        description: "DICOM → NIfTI 변환의 사실상 표준 도구.",
        tags: ["C", "Conversion"],
      },
      {
        slug: "vtk",
        name: "VTK",
        owner: "Kitware",
        repo: "VTK",
        description:
          "3D Slicer, ITK 등 다수의 의료영상 도구가 의존하는 시각화·렌더링 툴킷.",
        tags: ["C++", "Visualization"],
      },
      {
        slug: "simpleitk",
        name: "SimpleITK",
        owner: "SimpleITK",
        repo: "SimpleITK",
        description:
          "ITK를 Python/R/Java/C# 등에서 빠르게 쓸 수 있게 감싼 단순화 인터페이스.",
        tags: ["C++", "Image Analysis"],
        verified: true,
      },
      {
        slug: "ants",
        name: "ANTs",
        owner: "ANTsX",
        repo: "ANTs",
        description:
          "정량적 생체의학 영상을 위한 고급 정합(registration)·정규화 툴킷.",
        tags: ["C++", "Registration"],
        verified: true,
      },
      {
        slug: "cornerstone",
        name: "Cornerstone",
        owner: "cornerstonejs",
        repo: "cornerstone",
        description:
          "웹 브라우저에서 의료영상을 표시하는 경량 JavaScript 라이브러리.",
        tags: ["JavaScript", "Viewer"],
      },
      {
        slug: "torchxrayvision",
        name: "TorchXRayVision",
        owner: "mlmed",
        repo: "torchxrayvision",
        description:
          "흉부 X-ray 데이터셋·사전학습 모델을 통일된 인터페이스로 제공하는 라이브러리.",
        tags: ["Python", "Chest X-ray"],
        verified: true,
      },
      {
        slug: "monai",
        name: "MONAI",
        owner: "Project-MONAI",
        repo: "MONAI",
        description:
          "의료 영상 AI 연구를 위한 PyTorch 기반 오픈소스 프레임워크.",
        tags: ["Python", "AI"],
        verified: true,
      },
      {
        slug: "nibabel",
        name: "NiBabel",
        owner: "nipy",
        repo: "nibabel",
        description:
          "뇌영상(NIfTI, Analyze 등) 파일 형식을 읽고 쓰는 Python 라이브러리.",
        tags: ["Python", "Neuroimaging"],
      },
      {
        slug: "niftynet",
        name: "NiftyNet",
        owner: "NifTK",
        repo: "NiftyNet",
        description: "의료 영상 분석을 위한 딥러닝 프레임워크.",
        tags: ["Python", "AI"],
      },
      {
        slug: "nnunet",
        name: "nnU-Net",
        owner: "MIC-DKFZ",
        repo: "nnUNet",
        description: "의료 영상 분할을 위한 자동화된 딥러닝 파이프라인.",
        tags: ["Python", "Segmentation"],
      },
      {
        slug: "torchio",
        name: "TorchIO",
        owner: "fepegar",
        repo: "torchio",
        description: "의료 영상 변형·증강·전처리를 위한 PyTorch 라이브러리.",
        tags: ["Python", "AI"],
      },
      {
        slug: "simpleelastix",
        name: "SimpleElastix",
        owner: "SuperElastix",
        repo: "SimpleElastix",
        description:
          "ITK 기반의 이미지 정합 기능을 Python/R/C++에서 간단히 사용할 수 있게 해주는 래퍼.",
        tags: ["C++", "Registration"],
      },
      {
        slug: "horos",
        name: "Horos",
        owner: "horosproject",
        repo: "horos",
        description: "macOS용 오픈소스 DICOM 뷰어. OsiriX Lite의 LGPL 포크.",
        tags: ["Objective-C", "Viewer"],
      },
      {
        slug: "imagej",
        name: "ImageJ",
        owner: "imagej",
        repo: "ImageJ",
        description:
          "생의학 이미지 처리·분석의 표준 도구로 널리 쓰이는 Java 기반 플랫폼.",
        tags: ["Java", "Image Processing"],
      },
      {
        slug: "fiji",
        name: "Fiji",
        owner: "fiji",
        repo: "fiji",
        description: "생물의학 이미지 분석에 특화된 ImageJ 배포판.",
        tags: ["Java", "Bioimage Analysis"],
      },
      {
        slug: "mne-python",
        name: "MNE-Python",
        owner: "mne-tools",
        repo: "mne-python",
        description: "MEG/EEG 신경생리 데이터 분석을 위한 Python 라이브러리.",
        tags: ["Python", "MEG/EEG"],
      },
      {
        slug: "gadgetron",
        name: "Gadgetron",
        owner: "gadgetron",
        repo: "gadgetron",
        description: "MRI 영상 재구성을 위한 오픈소스 프레임워크.",
        tags: ["C++", "MRI Reconstruction"],
      },
      {
        slug: "bart",
        name: "BART",
        owner: "mrirecon",
        repo: "bart",
        description:
          "Berkeley Advanced Reconstruction Toolbox — MRI 재구성 도구 모음.",
        tags: ["C", "MRI Reconstruction"],
      },
      {
        slug: "dipy",
        name: "DIPY",
        owner: "dipy",
        repo: "dipy",
        description: "확산 MRI(diffusion MRI) 분석을 위한 Python 라이브러리.",
        tags: ["Python", "Diffusion MRI"],
      },
      {
        slug: "nipype",
        name: "Nipype",
        owner: "nipy",
        repo: "nipype",
        description:
          "여러 신경영상 분석 도구를 통일된 워크플로우로 묶어주는 Python 파이프라인 프레임워크.",
        tags: ["Python", "Neuroimaging Pipeline"],
      },
      {
        slug: "mrtrix3",
        name: "MRtrix3",
        owner: "MRtrix3",
        repo: "mrtrix3",
        description: "확산 MRI 트랙토그래피 및 분석을 위한 오픈소스 툴박스.",
        tags: ["C++", "Tractography"],
      },
      {
        slug: "medpy",
        name: "MedPy",
        owner: "loli",
        repo: "medpy",
        description: "의료 영상 처리를 위한 Python 라이브러리.",
        tags: ["Python", "Image Processing"],
      },
    ],
  },
  {
    code: "RTX · 03",
    slug: "radiotherapy",
    title: "방사선치료 · 의료물리",
    subtitle: "치료계획시스템(TPS), 장비 QA, 영상 분할",
    projects: [
      {
        slug: "matrad",
        name: "matRad",
        owner: "e0404",
        repo: "matRad",
        description: "MATLAB 기반 오픈소스 방사선치료 계획 시스템(TPS).",
        tags: ["MATLAB", "TPS"],
      },
      {
        slug: "qatrack-plus",
        name: "QATrack+",
        owner: "qatrackplus",
        repo: "qatrackplus",
        description:
          "방사선치료·영상장비의 QA 데이터를 관리하는 웹 애플리케이션.",
        tags: ["Python", "QA"],
      },
      {
        slug: "totalsegmentator",
        name: "TotalSegmentator",
        owner: "wasserth",
        repo: "TotalSegmentator",
        description: "CT 영상에서 104개 해부학적 구조를 자동으로 분할.",
        tags: ["Python", "Segmentation"],
      },
      {
        slug: "stir",
        name: "STIR",
        owner: "UCL",
        repo: "STIR",
        description: "PET/SPECT 등 단층영상 재구성을 위한 오픈소스 프레임워크.",
        tags: ["C++", "Reconstruction"],
      },
      {
        slug: "slicerrt",
        name: "SlicerRT",
        owner: "SlicerRt",
        repo: "SlicerRT",
        description: "3D Slicer 기반의 방사선치료 계획·분석 확장 모듈.",
        tags: ["C++", "Radiotherapy"],
      },
      {
        slug: "dicompyler",
        name: "dicompyler",
        owner: "dicompyler",
        repo: "dicompyler",
        description:
          "방사선치료 계획 데이터를 시각화하고 분석하는 오픈소스 도구.",
        tags: ["Python", "Radiotherapy"],
      },
      {
        slug: "plastimatch",
        name: "Plastimatch",
        owner: "plastimatch",
        repo: "plastimatch",
        description: "방사선치료 계획과 영상 정합을 위한 오픈소스 도구 모음.",
        tags: ["C++", "Radiotherapy"],
      },
      {
        slug: "cerr",
        name: "CERR",
        owner: "cerr",
        repo: "CERR",
        description: "방사선치료 연구를 위한 MATLAB 기반 오픈소스 연구 플랫폼.",
        tags: ["MATLAB", "Radiotherapy"],
      },
      {
        slug: "rtk",
        name: "RTK",
        owner: "RTKConsortium",
        repo: "RTK",
        description:
          "콘빔 CT(CBCT) 등 방사선치료용 영상 재구성을 위한 오픈소스 툴킷.",
        tags: ["C++", "CBCT Reconstruction"],
      },
    ],
  },
  {
    code: "DEV · 04",
    slug: "devices",
    title: "의료기기 · 임베디드",
    subtitle: "인슐린 펌프·CGM 연동 등 실제 디바이스에 동작하는 소프트웨어",
    projects: [
      {
        slug: "androidaps",
        name: "AndroidAPS",
        owner: "nightscout",
        repo: "AndroidAPS",
        description:
          "안드로이드 기반 오픈소스 자동 인슐린 투여(클로즈드 루프) 시스템.",
        tags: ["Kotlin", "APS"],
      },
      {
        slug: "openaps-oref0",
        name: "OpenAPS (oref0)",
        owner: "openaps",
        repo: "oref0",
        description:
          "인공췌장 시스템(APS)의 기준이 된 오픈소스 레퍼런스 알고리즘.",
        tags: ["JavaScript", "APS"],
      },
      {
        slug: "loop",
        name: "Loop",
        owner: "LoopKit",
        repo: "Loop",
        description: "iOS 기반 오픈소스 자동 인슐린 투여 시스템.",
        tags: ["Swift", "APS"],
      },
      {
        slug: "iaps",
        name: "iAPS",
        owner: "Artificial-Pancreas",
        repo: "iAPS",
        description:
          "LoopKit 생태계 프레임워크를 활용해 확장된 iOS 인공췌장 시스템.",
        tags: ["Swift", "APS"],
      },
      {
        slug: "nightscout",
        name: "Nightscout",
        owner: "nightscout",
        repo: "cgm-remote-monitor",
        description:
          "CGM 데이터를 클라우드로 실시간 공유하는 'CGM in the Cloud' 프로젝트.",
        tags: ["JavaScript", "CGM"],
      },
      {
        slug: "tapirx",
        name: "Tapirx",
        owner: "virtalabs",
        repo: "tapirx",
        description:
          "네트워크 트래픽(HL7·DICOM)을 분석해 의료기기를 수동적으로 탐지·식별하는 보안 도구.",
        tags: ["Go", "Device Discovery"],
        verified: true,
      },
      {
        slug: "blueflow",
        name: "Blueflow",
        owner: "virtalabs",
        repo: "blueflow",
        description:
          "의료기기 자산을 관리하기 위한 헬스케어 특화 오픈소스 자산관리 도구.",
        tags: ["Python", "Asset Management"],
        verified: true,
      },
      {
        slug: "carekit",
        name: "CareKit",
        owner: "carekit-apple",
        repo: "CareKit",
        description:
          "환자가 자신의 건강을 추적·관리하는 iOS 앱을 만들기 위한 Apple의 오픈소스 프레임워크.",
        tags: ["Swift", "Patient Engagement"],
      },
      {
        slug: "openbci",
        name: "OpenBCI",
        owner: "OpenBCI",
        repo: "OpenBCI",
        description:
          "생체전기 신호를 수집하는 오픈소스 바이오신호 하드웨어·소프트웨어 프로젝트.",
        tags: ["JavaScript", "Biomedical Device"],
      },
      {
        slug: "open-eeg",
        name: "OpenEEG",
        websiteUrl: "http://openeeg.sourceforge.net/",
        description:
          "오픈소스 EEG 하드웨어 및 소프트웨어 설계 프로젝트. GitHub가 아니라 SourceForge에서 배포됨.",
        tags: ["Electronics", "Biomedical Device"],
      },
      {
        slug: "xdrip",
        name: "xDrip",
        owner: "NightscoutFoundation",
        repo: "xDrip",
        description: "안드로이드용 오픈소스 CGM(연속혈당측정) 수집·표시 앱.",
        tags: ["Java", "CGM"],
      },
      {
        slug: "tidepool-uploader",
        name: "Tidepool Uploader",
        owner: "tidepool-org",
        repo: "uploader",
        description:
          "다양한 혈당계·인슐린펌프·CGM 기기의 데이터를 업로드·통합하는 오픈소스 당뇨 데이터 플랫폼.",
        tags: ["JavaScript", "Diabetes Data"],
      },
    ],
  },
  {
    code: "INT · 05",
    slug: "interop",
    title: "상호운용성 · FHIR / HL7",
    subtitle: "임상 데이터 교환 표준의 서버/엔진 구현체",
    projects: [
      {
        slug: "hapi-fhir",
        name: "HAPI FHIR",
        owner: "hapifhir",
        repo: "hapi-fhir",
        description:
          "Java 기반의 가장 널리 쓰이는 오픈소스 FHIR 서버 / 클라이언트 라이브러리.",
        tags: ["Java", "FHIR"],
      },
      {
        slug: "ibm-fhir-server",
        name: "IBM FHIR Server",
        owner: "IBM",
        repo: "FHIR",
        description: "HL7 FHIR R4 스펙을 구현한 모듈형 Java 서버.",
        tags: ["Java", "FHIR"],
      },
      {
        slug: "blaze",
        name: "Blaze",
        owner: "samply",
        repo: "blaze",
        description: "내장 CQL 평가 엔진을 갖춘 고성능 FHIR 스토어.",
        tags: ["Clojure", "FHIR"],
      },
      {
        slug: "mirth-connect",
        name: "Mirth Connect",
        owner: "nextgenhealthcare",
        repo: "connect",
        description:
          "헬스케어 시스템 간 메시지 변환·전송을 위한 오픈소스 인터페이스 엔진.",
        tags: ["Java", "Integration Engine"],
      },
      {
        slug: "firely-net-sdk",
        name: "Firely .NET SDK",
        owner: "FirelyTeam",
        repo: "firely-net-sdk",
        description:
          ".NET 환경에서 FHIR 리소스를 다루기 위한 공식 오픈소스 SDK.",
        tags: ["C#", "FHIR"],
      },
      {
        slug: "nhapi",
        name: "nHapi",
        owner: "Efferent-Health",
        repo: "HL7-V2",
        description: "HL7 메시지 처리 및 FHIR 파싱을 지원하는 .NET 라이브러리.",
        tags: ["C#", "HL7"],
      },
      {
        slug: "fhirjs",
        name: "FHIR.js",
        owner: "FHIR",
        repo: "fhir.js",
        description:
          "브라우저와 Node.js에서 FHIR API를 쉽게 호출하는 JavaScript 클라이언트.",
        tags: ["JavaScript", "FHIR"],
      },
      {
        slug: "openmhealth",
        name: "Open mHealth",
        websiteUrl: "https://www.openmhealth.org/",
        description:
          "디지털 헬스 데이터 구조와 통합을 위한 오픈 표준 및 라이브러리 모음. 단일 저장소가 아니라 openmhealth GitHub organization 산하 여러 레포로 나뉘어 있음.",
        tags: ["JavaScript", "Digital Health"],
      },
      {
        slug: "smart-on-fhir",
        name: "SMART on FHIR",
        owner: "smart-on-fhir",
        repo: "client-js",
        description:
          "FHIR 기반 임상 앱 개발을 위한 오픈소스 런타임과 라이브러리.",
        tags: ["JavaScript", "FHIR"],
      },
      {
        slug: "microsoft-fhir-server",
        name: "Microsoft FHIR Server",
        owner: "microsoft",
        repo: "fhir-server",
        description:
          "Azure 환경을 겨냥한 마이크로소프트의 오픈소스 FHIR 서버 구현체.",
        tags: ["C#", "FHIR"],
      },
      {
        slug: "google-fhir",
        name: "Google FHIR",
        owner: "google",
        repo: "fhir",
        description: "FHIR 리소스용 프로토콜 버퍼·검증 도구를 제공하는 구글의 오픈소스 라이브러리.",
        tags: ["C++", "FHIR"],
      },
      {
        slug: "fhir-works-on-aws",
        name: "FHIR Works on AWS",
        owner: "awslabs",
        repo: "fhir-works-on-aws-deployment",
        description: "AWS 서버리스 인프라 위에서 동작하는 오픈소스 FHIR 서버 배포 프레임워크.",
        tags: ["TypeScript", "FHIR"],
      },
      {
        slug: "openhim-core",
        name: "OpenHIM",
        owner: "jembi",
        repo: "openhim-core-js",
        description:
          "보건정보 시스템 간 메시지를 중개하는 오픈소스 헬스 인터로퍼빌리티 미들웨어.",
        tags: ["JavaScript", "Interoperability"],
      },
      {
        slug: "synthea",
        name: "Synthea",
        owner: "synthetichealth",
        repo: "synthea",
        description:
          "실제 환자와 통계적으로 유사한 합성(synthetic) 환자 데이터를 생성하는 오픈소스 시뮬레이터.",
        tags: ["Java", "Synthetic Data"],
      },
      {
        slug: "cql-engine",
        name: "Clinical Quality Language (CQL) Engine",
        owner: "cqframework",
        repo: "clinical_quality_language",
        description:
          "임상 품질 측정과 임상의사결정지원(CDS)에 쓰이는 CQL 표준의 참조 구현체.",
        tags: ["Java", "Clinical Decision Support"],
      },
    ],
  },
  {
    code: "LAB · 06",
    slug: "lab",
    title: "검사실 정보시스템 · LIMS",
    subtitle: "검체·검사 결과 관리 시스템",
    projects: [
      {
        slug: "senaite",
        name: "SENAITE",
        owner: "senaite",
        repo: "senaite.core",
        description: "Plone 기반의 오픈소스 검사실 정보관리시스템(LIMS).",
        tags: ["Python", "LIMS"],
      },
      {
        slug: "openelis-global",
        name: "OpenELIS Global",
        owner: "I-TECH-UW",
        repo: "OpenELIS-Global-2",
        description: "글로벌 헬스 환경을 위한 오픈소스 검사실 정보시스템.",
        tags: ["Java", "LIMS"],
      },
      {
        slug: "bika",
        name: "Bika LIMS",
        owner: "bikalims",
        repo: "bika.lims",
        description: "Plone 기반의 오픈소스 검사실 정보관리 시스템.",
        tags: ["Python", "LIMS"],
      },
      {
        slug: "labkey-server",
        name: "LabKey Server",
        owner: "LabKey",
        repo: "labkey-server",
        description:
          "생명과학 데이터와 연구 워크플로우를 관리하는 오픈소스 플랫폼.",
        tags: ["Java", "Research"],
      },
      {
        slug: "openspecimen",
        name: "OpenSpecimen",
        owner: "informatics-llc",
        repo: "openspecimen",
        description: "바이오뱅크와 임상 검체 관리를 위한 오픈소스 플랫폼.",
        tags: ["Java", "Biobanking"],
      },
      {
        slug: "openlmis",
        name: "OpenLMIS",
        owner: "openlmis",
        repo: "openlmis",
        description:
          "공중보건 공급망과 의약품 배급을 위한 오픈소스 물류관리 시스템.",
        tags: ["Java", "Logistics"],
      },
      {
        slug: "openboxes",
        name: "OpenBoxes",
        owner: "openboxes",
        repo: "openboxes",
        description:
          "의약품·의료물자 재고와 공급망을 관리하는 오픈소스 창고관리 시스템.",
        tags: ["Java", "Supply Chain"],
      },
    ],
  },
  {
    code: "DPG · 07",
    slug: "dpg",
    title: "글로벌 헬스 · 디지털 공공재",
    subtitle:
      "UN 산하 Digital Public Goods Alliance 레지스트리에 등재된 보건 분야 오픈소스",
    projects: [
      {
        slug: "dhis2",
        name: "DHIS2",
        owner: "dhis2",
        repo: "dhis2-core",
        description:
          "80개국 이상의 보건부가 사용하는 세계 최대 규모의 보건정보관리시스템(HMIS).",
        tags: ["Java", "HMIS"],
        verified: true,
      },
      {
        slug: "opensrp",
        name: "OpenSRP",
        owner: "opensrp",
        repo: "fhircore",
        description:
          "일선 보건인력이 담당 인구의 건강을 등록·추적하는 오픈소스 모바일 헬스 플랫폼.",
        tags: ["Kotlin", "FHIR"],
        verified: true,
      },
      {
        slug: "commcare",
        name: "CommCare",
        owner: "dimagi",
        repo: "commcare-hq",
        description:
          "프론트라인 보건인력의 데이터 수집·사례관리를 위한 가장 널리 배포된 디지털 플랫폼.",
        tags: ["Python", "Field Health"],
        verified: true,
      },
      {
        slug: "community-health-toolkit",
        name: "Community Health Toolkit (CHT)",
        owner: "medic",
        repo: "cht-core",
        description:
          "오프라인 우선 설계의 지역사회 보건 앱을 만들기 위한 오픈소스 프레임워크.",
        tags: ["JavaScript", "Community Health"],
        verified: true,
      },
      {
        slug: "simple",
        name: "Simple",
        owner: "simpledotorg",
        repo: "simple-server",
        description:
          "저·중소득 국가의 고혈압·당뇨 관리를 지원하는 임상의용 무료 오픈소스 앱.",
        tags: ["Ruby", "NCD"],
        verified: true,
      },
      {
        slug: "medic-mobile",
        name: "Medic Mobile",
        owner: "medic",
        repo: "medic",
        description: "일선 보건인력을 위한 오프라인 우선 모바일 헬스 플랫폼.",
        tags: ["JavaScript", "Field Health"],
        verified: true,
      },
      {
        slug: "ihris",
        name: "iHRIS",
        owner: "iHRIS",
        repo: "iHRIS",
        description:
          "보건인력 데이터를 관리하는 IntraHealth의 오픈소스 인적자원정보시스템(HRIS).",
        tags: ["PHP", "Health Workforce"],
      },
      {
        slug: "openimis",
        name: "openIMIS",
        owner: "openimis",
        repo: "openimis-be_py",
        description: "저·중소득 국가의 건강보험 관리를 위한 오픈소스 정보시스템.",
        tags: ["Python", "Health Insurance"],
      },
      {
        slug: "rapidpro",
        name: "RapidPro",
        owner: "rapidpro",
        repo: "rapidpro",
        description:
          "SMS/USSD 기반 보건 메시징·워크플로우를 구축하는 오픈소스 플랫폼. 다수 국가 보건 프로그램에서 사용.",
        tags: ["Python", "mHealth Messaging"],
      },
    ],
  },
  {
    code: "DCM · 08",
    slug: "dicom-core",
    title: "DICOM 핵심 라이브러리 · 툴킷",
    subtitle:
      "awesome-dicom 리스트에서 발굴한 DICOM 표준 구현체 — IMG·02의 뷰어/응용 계층보다 한 단계 아래",
    projects: [
      {
        slug: "dcmtk",
        name: "DCMTK",
        owner: "DCMTK",
        repo: "dcmtk",
        description:
          "DICOM 표준의 상당 부분을 구현한 C++ 라이브러리·애플리케이션 모음. 의료영상 생태계의 사실상 기준 툴킷.",
        tags: ["C++", "DICOM Toolkit"],
        verified: true,
      },
      {
        slug: "gdcm",
        name: "GDCM",
        owner: "malaterre",
        repo: "GDCM",
        description:
          "연구자가 임상 영상 데이터에 직접 접근할 수 있도록 설계된 오픈소스 DICOM 구현체.",
        tags: ["C++", "DICOM"],
        verified: true,
      },
      {
        slug: "mitk",
        name: "MITK",
        owner: "MITK",
        repo: "MITK",
        description:
          "ITK와 VTK를 애플리케이션 프레임워크로 결합한 대화형 의료영상 처리 툴킷.",
        tags: ["C++", "Image Processing"],
        verified: true,
      },
      {
        slug: "dcmqi",
        name: "dcmqi",
        owner: "QIICR",
        repo: "dcmqi",
        description:
          "정량 영상 분석 결과를 표준 DICOM 표현으로 변환하는 라이브러리·CLI 모음.",
        tags: ["C++", "Quantitative Imaging"],
        verified: true,
      },
      {
        slug: "dcmjs",
        name: "dcmjs",
        owner: "dcmjs-org",
        repo: "dcmjs",
        description:
          "브라우저와 Node.js에서 동작하는 순수 JavaScript DICOM 조작 구현체.",
        tags: ["JavaScript", "DICOM"],
        verified: true,
      },
      {
        slug: "weasis",
        name: "Weasis",
        owner: "nroduit",
        repo: "Weasis",
        description:
          "PACS·DICOMweb 연동에 특화된 범용 DICOM 뷰어. 데스크톱과 웹 모두 지원.",
        tags: ["Java", "Viewer"],
        verified: true,
      },
      {
        slug: "dicoogle",
        name: "Dicoogle",
        owner: "bioinformatics-ua",
        repo: "dicoogle",
        description:
          "중앙집중형 DB 대신 유연한 색인 방식을 쓰는 확장 가능한 오픈소스 PACS 아카이브.",
        tags: ["Java", "PACS"],
        verified: true,
      },
      {
        slug: "pynetdicom",
        name: "pynetdicom",
        owner: "pydicom",
        repo: "pynetdicom",
        description:
          "DICOM 네트워킹 프로토콜(C-STORE, C-FIND 등)을 구현한 순수 Python 패키지.",
        tags: ["Python", "DICOM Networking"],
        verified: true,
      },
      {
        slug: "fo-dicom",
        name: "fo-dicom (Fellow Oak DICOM)",
        owner: "fo-dicom",
        repo: "fo-dicom",
        description: ".NET, Xamarin, Unity 등을 지원하는 DICOM 라이브러리.",
        tags: ["C#", ".NET"],
        verified: true,
      },
      {
        slug: "orthanc",
        name: "Orthanc",
        owner: "jodogne",
        repo: "Orthanc",
        description: "경량 오픈소스 DICOM 서버로 의료영상 워크플로우를 자동화.",
        tags: ["C++", "PACS"],
        verified: true,
      },
      {
        slug: "dcm4chee-arc",
        name: "dcm4chee-arc",
        owner: "dcm4che",
        repo: "dcm4chee-arc-light",
        description:
          "확장 가능한 DICOM/PACS 서버 아키텍처를 구현한 오픈소스 스택.",
        tags: ["Java", "PACS"],
        verified: true,
      },
      {
        slug: "dicomweb-client",
        name: "dicomweb-client",
        owner: "dcmjs-org",
        repo: "dicomweb-client",
        description:
          "DICOMweb 표준을 사용하는 브라우저/Node.js 클라이언트 라이브러리.",
        tags: ["JavaScript", "DICOMweb"],
        verified: true,
      },
      {
        slug: "dicomparser",
        name: "dicomParser",
        owner: "cornerstonejs",
        repo: "dicomParser",
        description:
          "브라우저와 Node.js에서 DICOM 데이터를 파싱하는 JavaScript 라이브러리.",
        tags: ["JavaScript", "DICOM"],
        verified: true,
      },
      {
        slug: "highdicom",
        name: "highdicom",
        owner: "ImagingDataCommons",
        repo: "highdicom",
        description:
          "pydicom 위에서 동작하는 고수준 DICOM 객체 생성·파싱용 Python 라이브러리.",
        tags: ["Python", "DICOM"],
      },
      {
        slug: "pixelmed",
        name: "PixelMed",
        websiteUrl: "https://www.dclunie.com/pixelmed/software/javadicom/",
        description:
          "DICOM 표준을 폭넓게 구현한 Java 기반 툴킷. 소스가 GitHub가 아니라 저자 사이트에서 배포됨.",
        tags: ["Java", "DICOM Toolkit"],
      },
    ],
  },
  {
    code: "NLP · 09",
    slug: "clinical-nlp",
    title: "임상 텍스트 · 생물의학 NLP",
    subtitle: "진료기록·문헌에서 임상 개념을 추출하는 자연어처리 도구",
    projects: [
      {
        slug: "ctakes",
        name: "Apache cTAKES",
        owner: "apache",
        repo: "ctakes",
        description:
          "임상 텍스트에서 증상·진단·약물 등을 추출하는 Apache 산하 오픈소스 임상 NLP 엔진.",
        tags: ["Java", "Clinical NLP"],
      },
      {
        slug: "medcat",
        name: "MedCAT",
        owner: "CogStack",
        repo: "MedCAT",
        description:
          "전자의무기록 텍스트에서 임상 개념을 인식·연결하는 오픈소스 NLP 라이브러리.",
        tags: ["Python", "Clinical NLP"],
      },
      {
        slug: "scispacy",
        name: "scispaCy",
        owner: "allenai",
        repo: "scispacy",
        description: "생물의학·임상 문헌 처리에 특화된 spaCy 기반 NLP 파이프라인.",
        tags: ["Python", "Biomedical NLP"],
      },
    ],
  },
  {
    code: "GEN · 10",
    slug: "genomics",
    title: "유전체 · 임상 생물정보학",
    subtitle: "암 유전체 분석, 변이 호출(variant calling) 등 정밀의료 인프라",
    projects: [
      {
        slug: "cbioportal",
        name: "cBioPortal",
        owner: "cBioPortal",
        repo: "cbioportal",
        description:
          "대규모 암 유전체 데이터를 탐색·시각화하는 오픈소스 정밀의료 플랫폼.",
        tags: ["Java", "Cancer Genomics"],
      },
      {
        slug: "gatk",
        name: "GATK",
        owner: "broadinstitute",
        repo: "gatk",
        description:
          "Broad Institute가 개발한 차세대 시퀀싱 변이 분석(variant calling) 표준 툴킷.",
        tags: ["Java", "Variant Calling"],
      },
      {
        slug: "samtools",
        name: "SAMtools",
        owner: "samtools",
        repo: "samtools",
        description:
          "시퀀싱 정렬 데이터(SAM/BAM/CRAM)를 다루는 사실상 표준 오픈소스 도구 모음.",
        tags: ["C", "Sequencing"],
      },
    ],
  },
  {
    code: "DISC · 11",
    slug: "discovered",
    title: "발견됨 · 자동 수집 (미검증)",
    subtitle:
      "`npm run discover`가 GitHub Topics 검색 / awesome 리스트 재스캔으로 찾아낸 신규 후보입니다. 검증 후 알맞은 카테고리로 옮기고 lib/discovered.json에서 제거하세요.",
    projects: discoveredProjects,
  },
];

export type ProjectWithCategory = Project & {
  categorySlug: string;
  categoryTitle: string;
  categoryCode: string;
};

export const allProjects: ProjectWithCategory[] = categories.flatMap((c) =>
  c.projects.map((p) => ({
    ...p,
    categorySlug: c.slug,
    categoryTitle: c.title,
    categoryCode: c.code,
  })),
);
