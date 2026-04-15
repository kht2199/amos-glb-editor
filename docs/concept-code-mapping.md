# GLB Editor Concept ↔ Code Mapping

## 목적
이 문서는 `glb-editor` 저장소에서 AMOS domain 및 scene editing 개념이 현재 어떤 React/Zustand/Three.js 구조로 매핑되는지 정리하는 로컬 구현 매핑 문서다.

- 권장 진입 순서: `../../domain/docs/programs/implementation-repo-reference-guide.md` → `../../domain/docs/ontology/minimal-runtime-model.md` → 이 문서
- domain 기준 문서: `../../domain/docs/ontology/phase1.md`, `../../domain/docs/ontology/minimal-runtime-model.md`, `../../domain/docs/engine/practical-principles.md`, `../../domain/docs/ontology/source-of-truth.md`
- 이 문서의 역할: glb-editor 저장소의 로컬 구현 매핑 관리
- 비목표: domain canonical 정의를 이 문서가 대체하지 않는다

## 상태값 기준
- `aligned`: domain 개념과 현재 코드 구조가 대체로 일치
- `partial`: 일부 구현은 있으나 범위/의미/연결이 제한적
- `missing`: 대응 구조가 아직 없음

## minimal-runtime-model 정렬 규칙
`glb-editor`는 AMOS의 runtime orchestration 저장소가 아니라 scene/domain entity editor다. 따라서 `minimal-runtime-model`과의 관계는 “직접 구현”보다 “어디까지 연결되는가”를 밝히는 방식이 맞다.

| canonical concept | glb-editor에서의 현재 대응 | 상태 | 메모 |
|---|---|---|---|
| `Request` | 파일 열기/적용/내보내기 같은 편집 세션 액션 | partial | 제품 내부 request는 있으나 AMOS runtime `Request` 모델과 동일하지는 않음 |
| `Task` | import / apply / export 같은 내부 편집 작업 | partial | 작업 흐름은 있으나 canonical `Task` 타입으로 구조화되어 있지 않음 |
| `ToolCall` | 직접 대응 구조 없음 | missing | 외부 tool orchestration 저장소가 아님 |
| `Policy` | 충돌 규칙, export 전 pending draft 차단 같은 편집 규칙 | partial | 승인/권한보다는 편집기 로컬 제약에 가깝다 |
| `ClarifyRequest` | 직접 대응 구조 없음 | missing | 사용자 추가 질문보다 직접 편집 UI에 의존 |
| `ExecutionTrace` | undo/redo history, status message 일부 | partial | 변경 이력은 있지만 canonical trace/audit 구조는 아님 |

메모:
- 이 저장소는 `minimal-runtime-model`의 직접 owner가 아니다.
- 다만 장기적으로는 scene 편집 작업을 AMOS runtime과 연결할 때 `Request/Task/Policy/ExecutionTrace`와 어떤 경계에서 만나는지 명확히 해야 한다.

## 현재 1차 매핑
| domain / product concept | canonical 기준 해석 | 현재 코드 위치 | 현재 로컬 이름 | 상태 | 메모 |
|---|---|---|---|---|---|
| Scene object editor | 장면 객체를 선택/수정/재배치하는 편집기 | `src/App.tsx`, `src/store/editor-store.ts`, `src/types.ts` | editor app / `useEditorStore` / entity types | aligned | 앱 전체가 objectType + transform + metadata 편집에 맞춰 구성됨 |
| Top view editing | 상단뷰 기반 XY 편집 | `src/components/TopViewCanvas.tsx`, `src/App.tsx`, `src/lib/topViewProjection.ts` | `TopViewCanvas` | aligned | README 원칙과 UI 구조가 일치하며, 2D에서 draft가 반영된 실제 mesh를 현재 편집 평면으로 투영한 outline으로 표현함 |
| Structure browsing | scene object 구조 탐색 | `src/components/StructurePanel.tsx` | `StructurePanel` | aligned | 모바일 viewport 확대와 함께, 리스트 기준 선택/중첩 탐색/quick Duplicate/quick XYZ 편집까지 한 패널 안에서 이어진다 |
| Inspector editing | 선택 객체 속성 수정 | `src/components/InspectorPanel.tsx` | `InspectorPanel` | aligned | X/Y/Z, metadata, objectType 수정 흐름 포함 |
| Preview / free-view | 상단뷰 외 3D 확인 | `src/components/PreviewPanel.tsx`, `src/components/PreviewOverlay.tsx`, `src/components/PreviewSceneCanvas.tsx` | preview panel / overlay | aligned | main 편집은 top-view, preview는 보조 확인 용도 |
| Toolbar actions | import / demo / apply / export / mode 전환 | `src/components/Toolbar.tsx` | `Toolbar` | aligned | 편집 세션의 주요 액션 집합 |
| Collision guidance | 동일 슬롯/부모 충돌 확인 | `src/lib/collision.ts`, `src/store/editor-store.ts`, `src/components/StatusBar.tsx` | collision issues | aligned | 충돌 정보는 상태/패널 보조 정보로 유지됨 |
| Status / save state | 현재 파일/변경 상태 표시 | `src/components/StatusBar.tsx`, `src/store/editor-store.ts` | `statusMessage`, `hasPendingChanges` | aligned | draft/apply/revert 상태를 보여줌 |
| Scene import | GLB를 domain entity로 읽기 | `src/lib/glb.ts`, `src/store/editor-store.ts` | `loadGlbFile`, `loadFile` | aligned | `editorMeta` + name heuristic로 Lift/Port/배경 구조 인식 |
| Scene export | 변경분을 GLB로 다시 내보내기 | `src/lib/glb.ts`, `src/store/editor-store.ts`, `src/components/ExportFeedbackModal.tsx` | `exportGlb`, `exportCurrentGlb` | aligned | pristine clone + diff apply 방향과 연결됨 |
| Draft / applied split | 편집 중 상태와 반영된 상태 분리 | `src/store/editor-store.ts` | `draftLifts`, `appliedLifts`, `draftPorts`, `appliedPorts`, `draftBackgroundObjects`, `appliedBackgroundObjects` | aligned | apply / revert 모델의 핵심 |
| Undo / redo | 편집 이력 복구 | `src/store/editor-store.ts`, `src/App.tsx` | `history`, `future`, `undo`, `redo` | aligned | 키보드 단축키까지 연결됨 |
| Duplicate-first editing | 선택 객체 복제 기반 생성 | `src/store/editor-store.ts` | `duplicateSelectedObject` | aligned | Lift / Port / 배경 구조물 모두 공통 복제 흐름 사용 |
| Lift entity | 수직 이송 객체 | `src/types.ts`, `src/lib/glb.ts`, `src/store/editor-store.ts` | `LiftEntity` | aligned | rotation / slotsPerFace / animation 포함 |
| Port entity | 도킹/인계 포인트 | `src/types.ts`, `src/lib/glb.ts`, `src/store/editor-store.ts` | `PortEntity` | aligned | `semanticRole`, `face`, `slot`, `domainParentId` 포함 |
| Background structures | Bridge / Rail / Stocker / Transport 배경 구조 | `src/types.ts`, `src/lib/glb.ts`, `src/store/editor-store.ts` | `BackgroundObjectEntity` | aligned | 일반 오브젝트 편집 모델에 편입됨 |
| Object reclassification | 객체를 Lift/Port/배경 구조로 재분류 | `src/store/editor-store.ts`, `src/components/InspectorPanel.tsx` | `setObjectType` | partial | 구현은 있으나 도메인 제약/자동 보정 규칙은 더 정교화 가능 |
| Port auto-parent inference | Port의 parent lift/stocker/transport 추정 | `src/lib/glb.ts`, `src/lib/utils.ts`, `src/store/editor-store.ts` | nearest/inferred parent resolution | partial | heuristic 의존이 있고 naming convention 변화에 취약할 수 있음 |
| Domain metadata editing | domainParentId / semanticRole / slot 등 수정 | `src/components/InspectorPanel.tsx`, `src/types.ts` | form-based metadata editing | partial | 현재 편집 가능하지만 전체 metadata 범위/표준화는 더 필요 |
| Request-like editor action | 파일 열기/적용/내보내기 같은 편집 단위 | `src/store/editor-store.ts`, `src/components/Toolbar.tsx` | `loadFile`, `applyChanges`, `exportCurrentGlb` | partial | canonical `Request`와 같지는 않지만 편집 세션의 요청 단위로 볼 수 있음 |
| Task-like editor flow | import / apply / export 흐름 | `src/store/editor-store.ts`, `src/lib/glb.ts` | load / apply / export | partial | canonical `Task`의 직접 타입은 없고 로컬 편집 절차로만 존재 |
| ExecutionTrace-like history | 편집 이력/상태 메시지 | `src/store/editor-store.ts`, `src/components/StatusBar.tsx` | `history`, `future`, `statusMessage` | partial | 변경 기록은 있으나 canonical `ExecutionTrace` / audit trail 구조는 없음 |
| Policy / permission decision | 위험한 변경의 승인 정책 | 전용 구조 없음 | 없음 | missing | export 전 검증은 있으나 승인/권한 모델은 없음 |
| Scenario / ontology-linked constraints | domain ontology와 직접 연결된 제약 엔진 | `src/lib/collision.ts`, `src/lib/utils.ts` 일부 | collision / placement rules | partial | 현재는 편집기 로컬 규칙 중심, domain canonical과의 직접 맵은 약함 |

## 현재 코드 기준 핵심 연결
### 1. 앱 조립 레이어
- `src/App.tsx`
- `Toolbar`, `StructurePanel`, `TopViewCanvas`, `InspectorPanel`, `PreviewPanel`, `StatusBar`를 묶는다.
- glb-editor의 실제 화면 구성과 사용자 편집 흐름이 여기서 드러난다.
- 현재 레이아웃에서 `StructurePanel`은 모바일 시 `order-2`와 별도 scroll viewport를 가지며, 리스트 편집 기능 확장은 여기와 `StructurePanel.tsx`를 함께 봐야 한다.

### 2. 상태/편집 레이어
- `src/store/editor-store.ts`
- draft/applied split, selection, mode, duplicate, apply/revert, undo/redo, collision, export orchestration이 모여 있다.
- concept-to-code 관점에서 가장 중요한 구현 허브다.
- Structure list에서 직접 Duplicate/좌표 편집 진입을 열려면, 이 레이어의 selection/duplicate/updatePosition 경로를 패널 액션과 연결해야 한다.

### 2.1 Structure Panel 모바일/리스트 편집 상태
- 현재 `StructurePanel.tsx`는 모바일에서 `max-h-[48svh]`, `min-h-[260px]` viewport를 사용한다.
- 리스트 항목 선택, quick Duplicate, quick X / Y / Z 좌표 편집이 같은 패널 안에서 이어진다.
- 현재 남은 문서 기준 gap은 모바일에서 더 많은 구조 행을 안정적으로 보여주는 viewport 최적화다.

### 3. domain entity/type 레이어
- `src/types.ts`
- `LiftEntity`, `PortEntity`, `BackgroundObjectEntity`, `EditorSnapshot`, `SceneBundle`이 편집기의 공통 모델 역할을 한다.
- README의 objectType 중심 편집 원칙이 실제 타입 구조로 내려온 지점이다.

### 4. import/export 레이어
- `src/lib/glb.ts`
- GLB object를 읽어 entity로 만들고, `editorMeta`와 이름 기반 heuristic을 통해 objectType/port metadata를 복원한다.
- export 시에는 원본 scene 구조를 최대한 유지하면서 편집 결과를 다시 씌우는 핵심 축이다.

### 5. 검증/보조 로직 레이어
- `src/lib/collision.ts`, `src/lib/utils.ts`, `src/lib/topViewProjection.ts`
- 충돌 탐지, port 위치 계산, 공통 grid snap, 편집 평면 투영 규칙이 분산되어 있다.

### 5.1 공통 snap 정리
- `snapEnabled`는 `src/store/editor-store.ts`의 전역 편집 상태다.
- Toolbar와 StatusBar는 이를 scene object 공통 토글/표시로 노출한다.
- 현재 기준에서 `snapEnabled`의 의미는 **Lift 특수 연결 보정**이 아니라 **Lift / Port / 배경 오브젝트 공통 grid snap**이다.
- 따라서 drag/Inspector 기반 이동은 object type과 무관하게 같은 snap 정책을 공유하고, Port의 parent 추론/관계 메타는 별도 로직으로 본다.

## minimal-runtime-model 관점 요약
- 이 저장소는 canonical runtime model의 직접 구현 저장소가 아니다.
- 대신 scene/domain entity 편집 결과가 나중에 runtime `Request` / `Task` / `Policy`와 만날 수 있도록 메타데이터와 제약을 정리하는 전처리 도구에 가깝다.
- 따라서 향후 확장은 “trace/approval 엔진 추가”보다 “ontology-linked constraint를 얼마나 명확히 연결하느냐”가 우선이다.

## 현재 gap
1. `objectType` 재분류와 자동 보정 규칙은 존재하지만, domain ontology 기준 제약 표는 아직 충분히 명시적이지 않다.
2. `Port`의 parent 추정은 heuristic 비중이 있어 실제 GLB naming 편차에 취약할 수 있다.
3. 충돌/배치 규칙은 있지만 canonical `Policy` / `ExecutionTrace` 수준의 구조적 판단 계층은 없다.
4. 편집 가능한 metadata 범위와 canonical domain metadata의 일대일 대응 표가 아직 부족하다.
5. GLB import/export의 round-trip 보존 범위를 문서와 테스트에서 더 명시적으로 연결할 수 있다.

## 다음 정리 후보
1. `InspectorPanel` 기준 editable field ↔ domain metadata 표 상세화
2. `editor-store.ts`의 `setObjectType`, duplicate, apply/revert 규칙을 문서 표로 분리
3. `glb.ts`의 object type detection / parent inference 규칙을 naming heuristic 표로 정리
4. collision / placement rule ↔ domain constraint 매핑 문서 추가
5. round-trip 보존 대상(`editorMeta`, animation, external port metadata 등) 목록을 테스트 기준과 함께 명시
