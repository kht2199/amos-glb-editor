# threejs-object-editor

반도체 FAB 물류/장비 구조 GLB를 웹에서 읽고, `Lift`와 `Port`를 중심으로 다시 배치·검증·재export하기 위한 제약형 에디터입니다.

이 프로젝트의 목적은 **디자이너가 만든 GLB를 Blender 없이도 일반 개발자가 안전하게 수정**할 수 있게 하는 것입니다. 자유형 3D 모델러를 다시 만드는 것이 아니라, **상단뷰 기반의 배치 편집기**로 범위를 제한해 수정 비용과 실수를 줄이는 데 초점을 둡니다.

## 목적

- 압축된 `.glb` 파일을 불러와 다시 `.glb`로 export
- `Lift`와 `Port`의 위치/회전/속성 수정
- 상단/하단 포트 전환과 제약된 슬롯 기반 배치
- 충돌, 중복 ID, 잘못된 포트 관계를 사전에 검증
- 원본 GLB의 나머지 구조를 최대한 유지한 채 re-export

## 왜 이 에디터를 만드는가

현업에서는 장비 구조물이 포함된 3D 데이터가 이미 존재하는 경우가 많습니다. 하지만 단순한 위치 수정이나 포트 재배치에도 Blender 같은 DCC 툴이 필요하면 작업 병목이 생깁니다.

이 에디터는 다음 상황을 줄이기 위해 설계했습니다.

- 개발자가 단순 레이아웃 수정조차 디자이너에게 다시 요청해야 하는 상황
- 포트 위치나 Lift 배치를 바꾸기 위해 복잡한 3D 툴을 익혀야 하는 상황
- 실제 수정 대상은 제한적인데, 전체 GLB를 자유 편집하다가 오류가 커지는 상황

## 편집 대상과 비대상

### 편집 가능
- `Lift`
  - 평면 이동
  - 90도 회전
  - 애니메이션 파라미터 편집
- `Port`
  - Lift 상단/하단 전환
  - Lift face/slot 기반 재배치
  - 새 포트 추가
  - 다른 Lift 또는 외부 도메인 parent에 맞춘 재연결
  - 타입/semantic role 수정

### 읽기 전용
- `Bridge`
- `Rail`
- `Stocker`
- `Transport`

읽기 전용 구조물은 **배치 기준과 문맥을 제공하는 배경 구조**로 유지합니다.

## OHT / Transport를 타입에는 남기고, 에디터 중심에서는 빼는 이유

이 프로젝트는 OHT 시뮬레이터나 전체 AMHS 설계 툴이 아닙니다.

- `Transport` / OHT 개념은 **온톨로지와 향후 시뮬레이션 연결**을 위해 타입에 유지합니다.
- 하지만 현재 에디터의 핵심 작업은 **Lift와 Port 배치 수정**입니다.
- 따라서 demo scene과 UI의 시각적 중심도 `Lift`, `Port`, `Stocker`, `cleanroom structure`에 둡니다.

즉, **도메인 모델은 넓게 유지하되 편집 UX는 좁게 유지**하는 방향입니다.

## 핵심 편집 원칙

### 1. Top view 중심
- 기본 편집 평면은 XY
- 상단에서 내려다보는 시각으로 배치
- 상/하단 포트는 `TOP_ONLY` / `BOTTOM_ONLY` 단계 전환으로 다룸

### 2. Geometry-agnostic editing
이 에디터는 mesh 모양이 아니라 다음 정보를 기준으로 편집합니다.

- `editorMeta`
- transform
- `domainParentId`
- `domainParentType`
- `semanticRole`
- `slot`, `face`, `level`

즉, 원본 GLB의 포트나 리프트가 박스형이든 상세 모델이든 **편집 규칙은 동일**해야 합니다.

### 3. Pristine clone + diff apply
re-export는 원본을 전부 재구성하지 않고, import 시점의 pristine scene을 복제한 뒤 변경분만 적용하는 방향입니다.

- import 시 원본 scene 보존
- 편집은 domain model 중심으로 수행
- export 시 pristine clone에 변경분 적용
- GLB의 기존 구조와 메타를 최대한 유지

## 현재 구현 범위

- `.glb` import / export
- demo scene 제공
- Lift 이동 / 회전
- Port 추가 / 이동 / 재배치
- 상/하단 visibility step 전환
- Inspector 기반 속성 수정
- Validation drawer
- Preview overlay
- Undo / Redo
- 세션 저장 상태 추적
- 충돌 표시

## UI 구성

- **Toolbar**: import, demo 열기, 저장/검증/preview 등 주요 액션
- **Structure Panel**: Lift / Port / External Ports / Read-only 구조 탐색
- **Top View Editor**: 실제 배치 작업 공간
- **Inspector Panel**: 선택한 Lift/Port 속성 편집
- **Validation Drawer**: 오류와 경고 확인
- **Preview Overlay**: 결과를 자유롭게 보는 3D 미리보기
- **Status Bar**: 파일 이름, 저장 상태 등 표시

## 도메인 모델 요약

### Lift
수직 이송 모듈 추상화입니다.

주요 속성:
- `position`
- `rotation` (`0 | 90 | 180 | 270`)
- `slotsPerFace`
- `animation`

### Port
도킹/인계 지점 추상화입니다.

주요 속성:
- `portType`: `IN | OUT | INOUT`
- `semanticRole`: `LIFT_DOCK | STOCKER_ACCESS | TOOL_LOAD | BUFFER_HANDOFF`
- `face`: `FRONT | BACK | LEFT | RIGHT`
- `level`: `TOP | BOTTOM`
- `slot`
- `domainParentId`
- `domainParentType`

### Read-only structure
- `Bridge`, `Rail`, `Stocker`, `Transport`
- 배치 문맥 제공용 구조
- 현재 에디터에서는 직접 수정하지 않음

## 프로젝트 구조

```text
src/
├─ components/        # Toolbar, TopViewCanvas, Inspector, Preview 등 UI
├─ lib/
│  ├─ demoScene.ts    # 샘플 장면 생성
│  ├─ glb.ts          # import / export / round-trip 핵심 로직
│  ├─ portVisual.ts   # Port 공통 visual builder
│  ├─ validation.ts   # ID / 충돌 / 관계 검증
│  └─ utils.ts        # 좌표/배치 계산 유틸
├─ store/
│  └─ editor-store.ts # Zustand 기반 편집 상태
└─ types.ts           # 도메인 타입 정의
```

## 시작하기

```bash
pnpm install
pnpm dev
```

브라우저에서 표시된 로컬 주소로 접속합니다.

## 테스트와 검증

### 단위 테스트
```bash
pnpm test -- --runInBand
```

### 프로덕션 빌드
```bash
pnpm build
```

### demo scene 재생성
```bash
pnpm dlx tsx scripts/regenerate-demo-scene.ts
```

### export → import round-trip 재검증
```bash
pnpm dlx tsx scripts/verify-import-export.ts
```

이 검증은 다음을 확인합니다.
- Lift / Port / Read-only object 개수 유지
- `slotsPerFace` 유지
- `STOCKER_ACCESS` 같은 external port 메타 유지
- template node가 실제 port로 잘못 로드되지 않음

## 샘플 데이터

- `samples/demo-scene.glb`
  - 현재 editor가 직접 export한 샘플 GLB
- `src/lib/demoScene.ts`
  - 샘플 장면의 도메인 정의와 low-poly visual 생성

## 기술 스택

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Zustand
- Zod
- Vitest
- Playwright

## 현재 판단 기준

이 프로젝트는 다음을 우선합니다.

1. **배치 수정이 쉬운가**
2. **잘못된 편집을 제약할 수 있는가**
3. **round-trip에서 메타와 구조를 최대한 유지하는가**
4. **실사진 느낌은 주되, mesh 디테일에 편집 로직이 묶이지 않는가**

따라서 외형 realism은 올리더라도, 에디터 본질은 계속 **제약형 배치 도구**에 둡니다.

## 다음 검토 포인트

- 실제 현업 GLB에 대한 round-trip 안정성
- import 시 더 다양한 `editorMeta` 복원 규칙
- Port/Lift bounds 안정성 강화
- 목적에 맞는 배치 UX 단순화
- Playwright 기반 실제 사용자 시나리오 검증
