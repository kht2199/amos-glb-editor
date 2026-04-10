# glb-editor 구현 변경 체크리스트 v1

## 목적
문서를 기준으로 현재 코드를 전체 검토한 뒤, **문서-코드 불일치를 줄이면서 구현을 안전하게 정리하는 우선순위 계획**을 정의한다.

이 문서는 바로 대규모 리라이트를 지시하는 문서가 아니라,
1. 먼저 무엇을 확정해야 하는지
2. 어떤 순서로 바꿔야 리스크가 낮은지
3. 각 단계에서 어느 파일을 중심으로 손대야 하는지
를 체크리스트 형태로 정리한 실행 기준이다.

---

## 현재 진단 요약

### 확정된 핵심 갭
1. **생성 UX 불일치**
   - 문서: `Duplicate-first`
   - 코드: `Add Port` 전용 흐름 중심
   - 관련 파일:
     - `src/components/Toolbar.tsx`
     - `src/components/InspectorPanel.tsx`
     - `src/App.tsx`
     - `src/store/editor-store.ts`

2. **높이 모델 불일치**
   - 문서: `zOffset` 보존 + `Z` 직접 수정 중심
   - 코드: 과거 `PortLevel`, `VisibilityMode`, level inference 흔적이 남아 있었음
   - 관련 파일:
     - `src/types.ts`
     - `src/lib/utils.ts`
     - `src/lib/visibilityMode.ts`
     - `src/components/Toolbar.tsx`
     - `src/components/InspectorPanel.tsx`
     - `src/store/editor-store.ts`
     - `src/lib/glb.ts`

3. **Port 관계 편집 불일치**
   - 문서: Port를 다른 parent로 재연결 가능한 일반 오브젝트처럼 설명
   - 코드: Inspector에서 parent 직접 수정 불가, 캔버스 이동 시 nearest lift 재부착 경향
   - 관련 파일:
     - `src/components/InspectorPanel.tsx`
     - `src/store/editor-store.ts`
     - `src/lib/utils.ts`

4. **통합 object editor 방향과 상태 구조 간 간극**
   - 문서: 장기적으로 통합 object 흐름 지향
   - 코드: `draftLifts / draftPorts / draftReadonlyObjects` 분리 유지
   - 관련 파일:
     - `src/types.ts`
     - `src/store/editor-store.ts`
     - `src/components/StructurePanel.tsx`
     - `src/components/TopViewCanvas.tsx`
     - `src/components/InspectorPanel.tsx`

5. **검증 체계 공백**
   - `pnpm build`: 통과
   - `pnpm test`: 통과
   - `pnpm lint`: 실패
   - `pnpm dlx tsx scripts/verify-import-export.ts`: 출력 없이 종료
   - 관련 파일:
     - `src/components/PreviewSceneCanvas.tsx`
     - `src/components/StructurePanel.tsx`
     - `src/lib/glb.ts`
     - `scripts/verify-import-export.ts`
     - `eslint.config.js`

---

## 우선순위 원칙
- **P0:** 잘못된 초록불(false green) 제거
- **P1:** 사용자에게 바로 보이는 핵심 UX 개념 정렬
- **P2:** 상태 모델/타입 모델 정리
- **P3:** 문서와 코드의 용어/제약 일치
- **P4:** 회귀 방지용 테스트와 검증 경로 보강

---

## Phase 0 — 검증 체계 정상화

### 목표
이후 구현 변경 전에 “무엇이 진짜 깨졌는지” 알 수 있는 상태를 만든다.

### 체크리스트
- [ ] `pnpm lint` 실패 항목을 먼저 목록화하고, 파일별/규칙별 원인을 분류한다.
- [ ] `pnpm lint`를 green으로 만든다.
- [ ] `scripts/verify-import-export.ts`가 왜 출력 없이 끝나는지 먼저 진단한다.
- [ ] `scripts/verify-import-export.ts`가 실제 검증 결과를 출력하도록 고친다.
- [ ] `scripts/regenerate-demo-scene.ts`도 완료 로그/실패 로그가 드러나게 정리한다.
- [ ] `coverage/`, `test-results/` 같은 산출물을 lint 대상에서 제외할지 결정한다.
- [ ] `README.md`의 검증 명령이 실제 동작과 일치하는지 다시 맞춘다.

### 우선 수정 파일
- `src/components/PreviewSceneCanvas.tsx`
- `src/components/StructurePanel.tsx`
- `src/lib/glb.ts`
- `scripts/verify-import-export.ts`
- `scripts/regenerate-demo-scene.ts`
- `eslint.config.js`
- `README.md`

### 완료 기준
- `pnpm lint` 성공
- `pnpm build` 성공
- `pnpm test` 성공
- `pnpm dlx tsx scripts/verify-import-export.ts` 실행 시 JSON 또는 명시적 success 로그 출력

---

## Phase 1 — 생성 UX를 Duplicate 중심으로 전환

> 이 단계는 `addPort`를 과도기 기능으로 남기지 않고, **한 번에 제거하는 기준**으로 진행한다. 문제는 제거 후 검증 과정에서 보완한다.

### 목표
문서의 핵심 방향인 `Duplicate-first editing`을 실제 UI/상태 흐름으로 반영하고, 기존 `Add Port` 생성 모델을 한 번에 걷어낸다.

### 체크리스트
- [x] `EditorMode`에서 `addPort`를 제거한다.
- [x] add-port draft 상태와 관련 액션을 store에서 제거한다.
- [x] store에 `duplicateSelectedObject()` 또는 동등한 공통 복제 액션을 추가한다.
- [x] Toolbar의 `Add Port` 중심 액션을 `Duplicate` 중심으로 바꾼다.
- [x] `App.tsx` 단축키를 `A=Add Port`에서 새 복제 흐름 기준으로 재배치한다.
- [x] Inspector의 `Add Port Mode` 패널과 관련 입력 UI를 제거한다.
- [x] 복제 직후 기본 위치 오프셋 규칙을 구현한다.
- [x] 복제 후 ID 재생성 규칙을 구현한다.
- [ ] `setObjectType()`로 `Port` 전환 시 필요한 metadata 기본값을 즉시 채우도록 정리한다.
- [x] Port가 필요하면 “복제 후 objectType/metadata 수정” 흐름으로 유도한다.
- [x] 구현 전/후 `pnpm test`를 실행해 기존 편집 흐름 회귀가 없는지 확인한다.

### 우선 수정 파일
- `src/types.ts`
- `src/store/editor-store.ts`
- `src/components/Toolbar.tsx`
- `src/components/InspectorPanel.tsx`
- `src/App.tsx`
- `src/store/editor-store.test.ts`
- `src/App.test.tsx`

### 완료 기준
- [x] 새 객체 생성의 기본 UX가 `Duplicate`로 동작
- [x] `Add Port` 없이도 Port 생성/변환 시나리오가 성립
- [x] `addPort` 관련 상태/모드/UI가 코드에서 제거됨
- [x] 문서와 실제 툴바/단축키 용어가 일치

### 현재 확인 메모
- `pnpm lint` 통과
- `pnpm build` 통과
- `pnpm test` 통과
- `pnpm dlx tsx scripts/verify-import-export.ts` 통과
- 남은 후속 과제: `setObjectType()`로 `Port` 전환 시 metadata 기본값 정리 여부는 별도 검토

---

## Phase 2 — Port 높이 모델을 Z 중심으로 정리

### 목표
`PortLevel(TOP/BOTTOM)`을 제거하고, Lift 소속 Port의 높이를 `zOffset`과 실제 `Z` 값 기준으로만 관리한다.

### 체크리스트
- [x] `VisibilityMode = TOP_ONLY | BOTTOM_ONLY`를 제거하고 관련 store/UI/helper를 정리한다.
- [x] Inspector에서 Port 높이 편집 기준을 `level`이 아니라 `Z`로 고정한다.
- [x] `PortLevel` 타입과 `PortEntity.level` 필드를 제거한다.
- [x] `computePortPosition()`을 `face + slot + zOffset` 기준으로 단순화한다.
- [x] validation/collision 규칙에서 `level` 축을 제거하고 `same domain parent + same face + same slot` 충돌 기준으로 맞춘다.
- [x] import/export 시 `level inference`를 제거하고 `zOffset` round-trip 기준으로 정리한다.
- [x] 문서와 테스트에서 `TOP/BOTTOM` 포트 개념 대신 `Z/zOffset` 모델을 사용하도록 갱신한다.

### 우선 수정 파일
- `src/types.ts`
- `src/lib/utils.ts`
- `src/lib/collision.ts`
- `src/lib/validation.ts`
- `src/components/InspectorPanel.tsx`
- `src/store/editor-store.ts`
- `src/lib/glb.ts`
- `src/lib/demoScene.ts`
- `src/lib/glb.test.ts`
- `src/lib/validation.test.ts`
- `scripts/verify-import-export.ts`

### 완료 기준
- `PortLevel` / `port.level` 참조가 코드에서 제거됨
- Port 높이 복원이 `face + slot + zOffset` 기반으로 동작함
- Inspector/validation/import/export 문서와 구현이 같은 모델을 설명함

---

## Phase 3 — Port 관계 편집과 objectType 전환 규칙 명확화

### 목표
Port를 “Lift 고정 전용 엔티티”가 아니라 문서 설명과 맞는 일반 오브젝트 편집 흐름에 더 가깝게 만든다.

### 체크리스트
- [ ] 현재 `nearestLift` 재부착 로직에 대한 테스트가 있는지 확인하고, 없으면 현행 동작을 먼저 테스트로 고정한다.
- [x] Port 높이 모델은 `PortLevel`이 아니라 `zOffset + Z` 기준으로 정리한다.
- [ ] Inspector에서 `domainParentType`, `domainParentId`를 어떤 수준까지 직접 수정할지 결정한다.
- [ ] 포트 이동 시 무조건 nearest lift에 재부착하는 정책을 완화하거나 조건부화한다.
- [ ] external port(`Stocker`, `Transport`, `Bridge`, `Rail`)를 유지한 채 위치 수정 가능한지 정리한다.
- [ ] `setObjectType()` 후 geometry/metadata/validation이 어디까지 바뀌는지 규칙을 명시한다.
- [ ] external port 정책 변경이 `validation.ts`에 어떤 영향이 있는지 명시하고 함께 반영한다.
- [ ] objectType 전환 뒤 preview/export에서 시각적/구조적 불일치가 없는지 결정한다.
- [ ] 구현 전/후 `pnpm test`를 실행해 parent/port 회귀가 없는지 확인한다.

### 우선 수정 파일
- `src/store/editor-store.ts`
- `src/components/InspectorPanel.tsx`
- `src/components/TopViewCanvas.tsx`
- `src/lib/utils.ts`
- `src/lib/glb.ts`
- `src/lib/validation.ts`
- `src/store/editor-store.test.ts`
- `src/lib/glb.test.ts`

### 완료 기준
- external port를 lift port로 강제 재해석하지 않음
- Port 관계 편집 규칙이 UI/validation/export에서 일관됨

---

## Phase 4 — 통합 object 편집 모델로 점진 리팩터링

### 목표
현재의 타입별 배열 구조를 유지하더라도, 외부에서 보이는 편집 모델은 통합 object editor처럼 작동하게 만든다.

### 체크리스트
- [ ] 우선 selector/helper 레벨에 `allDraftObjects`, `allAppliedObjects`를 도입한다.
- [ ] 공통 편집 액션(`move/update/delete/duplicate/select`)을 object 관점 API로 감싼다.
- [ ] Inspector를 `공통 필드 + 타입별 확장 필드` 구조로 재편한다.
- [ ] `ReadOnlyEntity` 명칭이 실제 편집 가능 범위와 맞는지 재정의한다. (현재는 구조 객체 타입명은 유지하고, `readOnly: true` 플래그만 제거함)
- [ ] StructurePanel 표기도 `RO` 중심 표현에서 더 일반적인 object 관점으로 바꿀지 결정한다.
- [ ] 이후 필요하면 내부 저장소까지 통합 배열/맵 구조로 옮긴다.

### 우선 수정 파일
- `src/types.ts`
- `src/store/editor-store.ts`
- `src/components/InspectorPanel.tsx`
- `src/components/StructurePanel.tsx`
- `src/components/TopViewCanvas.tsx`
- `src/components/PreviewSceneCanvas.tsx`
- `src/store/editor-store.test.ts`
- `src/components/InspectorPanel.test.tsx`

### 완료 기준
- `allDraftObjects` 또는 동등 selector가 실제로 도입되어 공통 목록/선택/액션 경로에서 사용됨
- Inspector에서 Lift/Port/배경 구조물 공통 필드(`id`, `objectType`, `X/Y/Z`)가 같은 구조로 먼저 노출됨
- 내부 구현 분기는 남더라도 공통 액션/공통 UI가 먼저 보임

---

## Phase 5 — 문서 정합성 재정리

### 목표
README, flow 문서, domain 문서가 서로 다른 “현재상”을 설명하지 않도록 정리한다.

### 체크리스트
- [ ] `README.md`에서 현재 구현/목표 방향을 구분해 쓴다.
- [ ] `docs/glb-import-edit-apply-preview-export-flow.md`의 과도기 설명을 최신 상태에 맞춘다.
- [ ] `docs/domain-entity-table.md`의 read-only 설명을 실제 구현과 맞춘다.
- [ ] “제약형 Lift/Port editor”와 “일반 object editor 방향”의 관계를 한 문단으로 명확히 정리한다.
- [ ] 검증 명령, 지원 기능, 현재 한계를 문서별로 같은 표현으로 맞춘다.

### 우선 수정 파일
- `README.md`
- `docs/glb-import-edit-apply-preview-export-flow.md`
- `docs/domain-entity-table.md`

### 완료 기준
- 문서끼리 상충하는 현재 상태 설명이 줄어듦
- 구현자가 문서만 읽고도 우선순위를 오해하지 않음

---

## 권장 실행 순서
1. **Phase 0** — 검증 체계 정상화
2. **Phase 1** — Duplicate 중심 UX 전환 (`addPort` 일괄 제거)
3. **Phase 3** — Port 관계 편집 규칙 정리
4. **Phase 2** — 높이/가시성 모델 정리
5. **Phase 4** — 통합 object 편집 리팩터링
6. **Phase 5** — 문서 최종 정리

> 이유: 현재 가장 위험한 것은 구조 변경 자체보다, 변경 후에도 검증이 제대로 안 되는 상태다. 그래서 먼저 false green을 제거하고, 그 다음 `addPort`를 한 번에 걷어내며 사용자에게 드러나는 편집 개념을 바로 정렬하는 순서로 간다.

---

## 즉시 착수 추천 범위
대규모 리라이트 대신 아래 묶음으로 1차 작업을 권장한다.

### 1차 묶음
- lint 복구
- round-trip 스크립트 실효성 복구
- Toolbar/App에서 `Add Port` 중심 표현 축소
- store에 공통 duplicate 액션 추가

### 2차 묶음
- Inspector에서 Port 관계 편집 규칙 정리
- nearest lift 강제 재부착 완화
- nearest lift 현행 동작 테스트 선작성/보강
- 관련 테스트 보강

### 3차 묶음
- `relative Z` / `TOP_ONLY/BOTTOM_ONLY` 정리
- 통합 object 편집 모델 정리
- 문서 동기화

---

## 검토 시 확인해야 할 질문
Claude 리뷰에서는 특히 아래를 확인한다.
- 현재 실행 순서가 리스크 기준으로 타당한가?
- `Duplicate-first` 전환을 상태 통합보다 먼저 하는 판단이 맞는가?
- `zOffset` 기반 높이 모델 이후 nearest-lift 재부착 규칙을 어디까지 단순화할 것인가?
- `setObjectType()`와 preview/export 간 불일치를 어떤 단계에서 먼저 다뤄야 하는가?
- 문서 정리를 구현 전/후 어느 시점에 어느 정도까지 병행해야 하는가?
