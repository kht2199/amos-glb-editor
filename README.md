# glb-editor

GLB scene을 웹에서 읽고, **일반 오브젝트를 선택·복사·이동·수정한 뒤 다시 export**하기 위한 제약형 에디터입니다.

이 프로젝트의 목적은 **디자이너가 만든 GLB를 Blender 없이도 일반 개발자가 안전하게 수정**할 수 있게 하는 것입니다. 자유형 3D 모델러를 다시 만드는 것이 아니라, **상단뷰 기반의 배치 편집기**로 범위를 제한해 수정 비용과 실수를 줄이는 데 초점을 둡니다.

## 목적

- 압축된 `.glb` 파일을 불러와 다시 `.glb`로 export
- scene object의 위치/회전/속성 수정
- 오브젝트 복사(`Duplicate`) 기반 생성
- 충돌, 중복 ID, 잘못된 관계를 참고 정보로 확인
- 원본 GLB의 나머지 구조를 최대한 유지한 채 re-export

## 왜 이 에디터를 만드는가

현업에서는 장비 구조물이 포함된 3D 데이터가 이미 존재하는 경우가 많습니다. 하지만 단순한 위치 수정이나 객체 복제에도 Blender 같은 DCC 툴이 필요하면 작업 병목이 생깁니다.

이 에디터는 다음 상황을 줄이기 위해 설계했습니다.

- 개발자가 단순 레이아웃 수정조차 디자이너에게 다시 요청해야 하는 상황
- 제한된 배치 수정이나 속성 수정에도 복잡한 3D 툴을 익혀야 하는 상황
- 실제 수정 대상은 제한적인데, 전체 GLB를 자유 편집하다가 오류가 커지는 상황

## 프로그램 성격

이 프로젝트는 포트 전용 편집기나 자유형 mesh 모델러가 아닙니다.

- **중심 개념은 scene object**다.
- `Port`, `Lift`, `Bridge`, `Rail`, `Stocker`, `Transport`는 여러 `objectType` 중 일부다.
- 새 오브젝트 생성의 기본 방식은 **시스템이 새 primitive를 만드는 것**이 아니라 **선택된 오브젝트를 복사하는 것**이다.
- 높이 차이는 `relative Z` 같은 enum이 아니라 **실제 Z 좌표**로 표현한다.

즉 이 에디터는 **objectType + metadata + transform**을 다루는 일반 오브젝트 에디터다.

## 오브젝트 유형별 편집 범위

### 편집 가능
- 모든 scene object
  - XY 평면 이동
  - Inspector에서 X / Y / Z 좌표 수정
  - 필요 시 회전 수정
  - 필요 시 `objectType` 재분류
  - metadata 수정
- objectType별 추가 메타 예시
  - `Lift`: 90도 회전, 애니메이션 파라미터 편집
  - `Port`: 다른 Lift 또는 외부 도메인 parent에 맞춘 재연결, 타입 / semantic role / face / slot 같은 metadata 수정

이 예시는 **특정 타입을 핵심 편집 대상으로 승격**하려는 뜻이 아니라,
현재 타입별로 자주 쓰이는 metadata 종류가 다르다는 점을 보여주기 위한 것이다.

### 배경 구조물
- `Bridge`
- `Rail`
- `Stocker`
- `Transport`

배경 구조물은 **배치 기준과 문맥을 제공하는 구조**로 유지합니다.

현재 방향에서는 이 구조물도 일반 오브젝트와 같은 기준으로 다룹니다.
- 선택 가능
- 이동 가능
- 복사 가능
- Inspector에서 X / Y / Z 수정 가능
- 필요 시 object type 재분류 가능

즉, 특정 타입만 특별한 생성 흐름을 갖기보다 **scene object 전반을 같은 편집 모델 위에서 다루는 것**이 기본 원칙입니다.

## 핵심 편집 원칙

### 1. Top view 중심
- 기본 편집 평면은 XY
- 상단에서 내려다보는 시각으로 배치
- preview는 XYZ axis와 Z-up 기준을 유지한다
- 높이 차이는 별도 단계 전환이 아니라 Z 좌표로 직접 다룸

### 2. Metadata-first editing + actual mesh-projected 2D view
이 에디터의 편집 규칙은 raw mesh 자체가 아니라 다음 정보를 기준으로 동작합니다.

- `editorMeta`
- transform
- `objectType`
- `domainParentId`
- `domainParentType`
- `semanticRole`
- 기타 object metadata

즉, 원본 GLB의 오브젝트가 단순 박스형이든 상세 모델이든 **편집 규칙은 동일**해야 합니다.
다만 top view 2D 표현은 generic box/circle이나 고정 타입 템플릿으로 단순화하지 않고, **현재 draft가 반영된 실제 mesh를 편집 평면(XY/XZ/YZ)으로 투영한 outline/footprint**로 보여주는 것을 기본 원칙으로 합니다.

### 3. Duplicate-first editing
새 오브젝트 생성의 기본은 `Add Port` 같은 타입 전용 생성이 아니라 **선택된 오브젝트 복사(`Duplicate`)**입니다.

권장 흐름:
1. 오브젝트 선택
2. `Duplicate`
3. 위치 조정
4. 필요 시 `objectType` / metadata 수정
5. Apply
6. Export

### 4. Pristine clone + diff apply
re-export는 원본을 전부 재구성하지 않고, import 시점의 pristine scene을 복제한 뒤 변경분만 적용하는 방향입니다.

- import 시 원본 scene 보존
- 편집은 domain model 중심으로 수행
- export 시 pristine clone에 변경분 적용
- GLB의 기존 구조와 메타를 최대한 유지

## 현재 구현 범위

- `.glb` import / export
- demo scene 제공
- 모든 장면 객체의 XY 이동 (`Move` 모드)
- 모든 장면 객체의 공통 grid snap (`Grid Snap` 토글)
- 선택 객체 복사(`Duplicate`) 기반 생성 시작점 제공
- Lift 회전
- Inspector 기반 속성 수정
- Inspector에서 선택 객체의 X / Y / Z 직접 수정
- Preview overlay
- Undo / Redo
- draft / applied pending 상태 추적
- 2D 기준 좌표(origin)와 축 방향 수정
- 충돌/상태 표시를 참고 정보로 제공

## 목표 구현 방향

아래 항목이 현재 문서 기준의 목표 방향입니다.

- `Add Port` 같은 타입 전용 생성 흐름 제거
- `Duplicate` 중심 생성 UX 통일
- `VisibilityMode(TOP_ONLY/BOTTOM_ONLY)` 제거
- `PortLevel` 없이 `zOffset`과 실제 Z 기준으로 Port 높이 복원
- 높이 편집은 Z 직접 수정 중심으로 정리
- `Port`를 여러 objectType 중 하나로 재위치
- draft / applied / apply / revert 구조 유지
- 모바일에서 `Structure Panel`은 현재보다 작업 가능한 높이를 우선 확보하고, 목록 자체만으로도 선택 → 복사 → 좌표 수정 흐름에 진입할 수 있게 한다.

## UI 구성

- **Toolbar**: import, demo 열기, apply/revert/export, Move/Duplicate/Grid Snap 등 주요 액션
- **Structure Panel**: scene object 구조 탐색
- **Top View Editor**: object 배치 작업 공간
- **Inspector Panel**: 선택한 객체의 속성 및 좌표 편집
- **Preview Overlay**: 결과를 자유롭게 보는 3D 미리보기
- **Status Bar**: 파일 이름, 저장 상태 등 표시

### Structure Panel 방향
- 모바일에서는 `Structure Panel`이 너무 얕아 한두 개 그룹만 보이는 상태를 피해야 한다.
- 현재 구현은 대략 `max-h-[48svh]`, `min-h-[260px]` 기준의 리스트 viewport를 사용한다.
- 이후 방향은 모바일에서도 더 많은 행이 보이도록 viewport 높이를 우선 재검토하는 것이다.
- 현재 Structure list는 단순 탐색용이 아니라, **리스트 항목만으로도 선택 → Duplicate(복사) → 좌표 입력**이 가능한 편집 진입점을 제공한다.
- 즉 사용자는 Top View Canvas를 먼저 건드리지 않아도, Structure list에서 선택한 뒤 복사하고 X / Y / Z 좌표를 설정할 수 있다.

## 도메인 모델 요약

### 공통 object 모델
모든 scene object는 아래 정보를 중심으로 다룹니다.

- `objectType`
- `position`
- `rotation`
- `editorMeta`
- domain metadata

즉, `Lift`, `Port`, `Bridge`, `Rail`, `Stocker`, `Transport`는 모두 이 공통 모델 위의 objectType 예시다.

### 공통 grid snap
- `Snap` 토글은 Lift 전용 보정이 아니라 **scene object 공통 grid snap**이다.
- `Move` 모드에서 Lift / Port / 배경 구조물 모두 같은 기준으로 XY 위치가 격자에 맞춰진다.
- 자유 이동이나 포인터 offset 검증처럼 정밀 좌표가 필요한 테스트/작업에서는 `Snap OFF`로 분리해 본다.

### 주요 objectType 예시

#### Lift
수직 이송 모듈 예시.

주요 속성:
- `position`
- `rotation` (`0 | 90 | 180 | 270`)
- `slotsPerFace`
- `animation`

#### Port
도킹/인계 지점 예시.

주요 속성:
- `portType`: `IN | OUT | INOUT`
- `semanticRole`: `LIFT_DOCK | STOCKER_ACCESS | TOOL_LOAD | BUFFER_HANDOFF`
- `face`: `FRONT | BACK | LEFT | RIGHT`
- `slot`
- `domainParentId`
- `domainParentType`
- `position.z`

#### Background structure
- `Bridge`, `Rail`, `Stocker`, `Transport`
- 배치 문맥 제공용 구조
- 일반 오브젝트와 같은 선택/이동/복사 흐름을 공유
- Lift/Port 같은 도메인 제약은 필요한 범위에만 적용

## 프로젝트 구조

```text
src/
├─ components/        # Toolbar, TopViewCanvas, Inspector, Preview 등 UI
├─ lib/
│  ├─ demoScene.ts    # 샘플 장면 생성
│  ├─ glb.ts          # import / export / round-trip 핵심 로직
│  ├─ portVisual.ts   # 현재 포트 관련 visual 유틸 (정리 대상 포함)
│  ├─ collision.ts    # 동일 슬롯/부모 충돌 탐지
│  ├─ topViewProjection.ts # 편집 평면 투영/outline 계산
│  └─ utils.ts        # 좌표/배치 계산 유틸
├─ store/
│  └─ editor-store.ts # Zustand 기반 편집 상태
└─ types.ts           # 도메인 타입 정의
```

## 관련 문서
- [AGENTS.md](AGENTS.md)
- [docs/concept-code-mapping.md](docs/concept-code-mapping.md)
- [docs/glb-import-edit-apply-preview-export-flow.md](docs/glb-import-edit-apply-preview-export-flow.md)
- [docs/domain-entity-table.md](docs/domain-entity-table.md)
- [../domain/docs/programs/implementation-repo-reference-guide.md](../domain/docs/programs/implementation-repo-reference-guide.md)

## Domain reference guide

구현 정렬이 필요하면 아래 순서로 본다.

1. [../domain/docs/programs/implementation-repo-reference-guide.md](../domain/docs/programs/implementation-repo-reference-guide.md)
2. [../domain/docs/ontology/minimal-runtime-model.md](../domain/docs/ontology/minimal-runtime-model.md)
3. [../domain/docs/ontology/common-semiconductor-amhs.md](../domain/docs/ontology/common-semiconductor-amhs.md)
4. [docs/concept-code-mapping.md](docs/concept-code-mapping.md)

원칙:
- domain은 object/entity 의미와 경계를 제공한다.
- `glb-editor`는 실제 objectType, metadata, import/export, collision/interaction 구현을 소유한다.
- 구현 변경 시 domain 문서를 복제하지 말고, glb-editor 문서에 대응 관계와 gap을 남긴다.

## 시작하기

```bash
pnpm install
pnpm dev
```

고정 dev 포트 `5175`로 실행되며, 브라우저는 `http://127.0.0.1:5175`로 접속합니다. 포트가 이미 점유 중이면 자동 증분 없이 실행이 실패합니다.

```bash
pnpm preview
```

preview는 고정 포트 `4175`를 사용합니다.

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

### export → import round-trip 확인
```bash
pnpm dlx tsx scripts/verify-import-export.ts
```

이 확인 절차는 다음을 봅니다.
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

## 현재 판단 기준

- 원본 GLB를 최대한 보존하는가?
- 일반 오브젝트 편집 흐름이 일관적인가?
- 특정 타입만 별도 생성 UX를 강요하지 않는가?
- draft와 applied의 경계가 명확한가?
- preview와 export가 같은 기준을 보는가?
- 좌표와 관계를 사용자가 예측 가능하게 수정할 수 있는가?
