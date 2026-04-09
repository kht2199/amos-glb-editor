# GLB 로드 · 에디터 · 프리뷰 · 익스포트 흐름 정리

이 문서는 현재 `glb-editor`에서 GLB가 로드된 뒤
- 어떤 데이터가 store에 들어가고
- 에디터와 프리뷰가 무엇을 기준으로 렌더링하며
- 수정이 어디에 반영되고
- export 시 어떤 장면을 기준으로 GLB를 다시 만드는지
를 코드 기준으로 정리한다.

---

## 1. 핵심 결론

### 프리뷰 캔버스에 들어가는 GLB가 맞나?
**현재/기존 구조 기준으로는 “원본 GLB scene에서 나온 `workingScene`을 프리뷰에 넘기고 있었다.”**

- `loadGlbFile()`는 GLB를 파싱한 뒤
  - `workingScene = gltf.scene`
  - `pristineScene = gltf.scene.clone(true)`
  로 분리한다.
- `PreviewPanel.tsx`, `PreviewOverlay.tsx`는 기존에 `runtime.workingScene`을 `PreviewSceneCanvas`에 넘겼다.
- `PreviewSceneCanvas.tsx`는 다시 `scene.clone(true)`를 만들어 프리뷰용으로 material/outline을 덧입혀 렌더했다.

즉 **기존 preview는 “GLB 기반 scene clone 렌더”였다.**

### 에디터에서 수정하면 preview와 공유하나?
**완전히 공유하지 않는다.**

- 에디터에서 실제 수정 기준은 store의 `lifts / ports / readonlyObjects`다.
- `applyMutation()`은 이 store state만 갱신하고 validation/collision을 다시 계산한다.
- 그런데 `runtime.workingScene`은 edit 시 다시 생성/동기화하지 않는다.

즉 구조적으로는:
- **에디터 = store state 기반**
- **기존 프리뷰 = runtime.workingScene 기반**

이라서, 둘은 초기 로드 시점에는 같은 GLB에서 출발하지만 **편집 이후에는 분기될 수 있다.**

### export는 무엇을 기준으로 하나?
**export는 `workingScene`이 아니라 `pristineScene.clone(true)`에 store 상태를 다시 덮어써서 만든다.**

즉 export 기준은:
1. 처음 로드/생성 당시의 깨끗한 기준 장면(`pristineScene`)
2. 현재 store의 `lifts / ports / readonlyObjects`
3. 이를 다시 scene clone에 반영
4. `GLTFExporter`로 binary GLB 생성

따라서 **preview와 export는 같은 장면 객체를 그대로 공유하지 않는다.**

---

## 2. 로드 단계

### 2.1 파일 로드 진입
진입점:
- `src/store/editor-store.ts`
- `loadFile(file)`

흐름:
1. `loadFile(file)` 호출
2. `loadGlbFile(file)` 실행
3. 반환값으로
   - `workingScene`
   - `pristineScene`
   - `animations`
   - `bundle(lifts, ports, readonlyObjects...)`
   를 받음
4. `initializeScene(...)`로 store 초기화

### 2.2 GLB 파싱
구현:
- `src/lib/glb.ts`
- `loadGlbFile(file)`

핵심 코드 역할:
- `GLTFLoader.parseAsync(buffer, '')`
- `const pristineScene = gltf.scene.clone(true)`
- `const scene = gltf.scene`

여기서 scene은 두 갈래로 쓰인다.

#### A. runtime 용
- `workingScene = scene`
- 기존 preview가 사용하던 원본 런타임 장면

#### B. export 기준 보존용
- `pristineScene = scene.clone(true)`
- 이후 export 시 원본 기준 장면으로 사용

### 2.3 Scene → Editor Entity 추출
`loadGlbFile()`는 scene을 두 번 순회한다.

#### 1차 순회
- Lift
- Bridge / Rail / Stocker / Transport
를 추출해서
- `lifts`
- `readonlyObjects`
배열 생성

#### 2차 순회
- Port 추출
- 가까운 Lift / Stocker / Transport와 관계를 해석
- `ports` 배열 생성

결과:
- scene 자체와 별개로 편집용 구조화 데이터가 생김

---

## 3. store 초기화와 분기

### 3.1 initializeScene
구현:
- `src/store/editor-store.ts`
- `initializeScene(...)`

여기서 store에 들어가는 것:
- `fileName`
- `lifts`
- `ports`
- `readonlyObjects`
- `runtime = { workingScene, pristineScene, animations }`
- validation/collision 결과

즉 한 번 로드되면 store 내부에는 동시에 두 계층이 있다.

#### 계층 1: 편집용 정규화 데이터
- `lifts`
- `ports`
- `readonlyObjects`

#### 계층 2: 런타임 3D 장면 참조
- `runtime.workingScene`
- `runtime.pristineScene`
- `runtime.animations`

### 3.2 이 시점에는 같은 출발점
초기 로드 직후에는
- 편집용 entity 데이터와
- runtime scene
이 같은 GLB에서 출발했으므로 대체로 일치한다.

하지만 이후 수정부터 분기 가능성이 생긴다.

---

## 4. 에디터 수정 단계

### 4.1 실제 수정 대상
에디터의 주요 조작:
- `moveLift`
- `rotateLift`
- `updateLift`
- `updatePort`
- `movePortByWorld`
- `deletePort`
- `confirmAddPort`
- `setObjectType`

이 함수들은 모두 결국 `applyMutation(...)`을 통해 store를 갱신한다.

### 4.2 applyMutation이 하는 일
구현:
- `src/store/editor-store.ts`
- `applyMutation(...)`

역할:
- `lifts / ports / readonlyObjects / visibilityMode` 갱신
- `deriveScene(...)`로
  - port 위치 재계산
  - validation 재계산
  - collision 재계산
- history stack 기록
- saveState를 `unsaved`로 변경

### 4.3 applyMutation이 하지 않는 일
중요:
**`runtime.workingScene`은 여기서 갱신하지 않는다.**

즉 편집 후에도:
- store entity는 바뀌지만
- runtime scene graph는 그대로 남는다

이 때문에 기존 preview 구조에서는
- TopView/Inspector는 최신 상태
- Preview는 stale scene 기반
이 될 수 있다.

---

## 5. 에디터 렌더링 단계

### 5.1 TopViewCanvas
구현:
- `src/components/TopViewCanvas.tsx`

이 화면은 `useEditorStore(...)`로
- `lifts`
- `ports`
- `readonlyObjects`
를 직접 읽는다.

즉 에디터 메인 뷰는:
- GLB mesh를 직접 그리는 게 아니라
- **store state를 2D 투영해서 렌더링**한다.

따라서 편집 반영은 store만 맞으면 바로 보인다.

---

## 6. 기존 preview 렌더링 단계

### 6.1 PreviewPanel / PreviewOverlay
구현:
- `src/components/PreviewPanel.tsx`
- `src/components/PreviewOverlay.tsx`

기존에는 둘 다 아래 방식이었다.

- `runtime.workingScene` 존재 여부 확인
- `PreviewSceneCanvas scene={runtime.workingScene}` 전달

### 6.2 PreviewSceneCanvas
구현:
- `src/components/PreviewSceneCanvas.tsx`

기존 preview는:
1. 전달받은 `scene`을 `scene.clone(true)`
2. mesh material clone 후 preview용 tune
3. outline 추가
4. fallback geometry 추가
5. orbit/gizmo/grid/light와 함께 렌더

즉 preview는 **원본 GLB runtime scene clone + 보조 geometry** 구조였다.

### 6.3 왜 문제가 생겼나
구조적으로 문제는 두 가지였다.

#### 문제 A. 편집 상태와 preview scene 기준이 다름
- edit 결과는 store에만 반영
- preview는 runtime scene 기반
- 따라서 state와 preview가 어긋날 수 있음

#### 문제 B. preview가 너무 복잡했음
- raw scene clone
- material 강제 조정
- outline helper
- fallback geometry
- 조명 보정
- preserveDrawingBuffer

이게 blank/불안정 문제가 생겼을 때 원인 분리를 어렵게 만들었다.

---

## 7. export 단계

### 7.1 진입점
구현:
- `src/store/editor-store.ts`
- `exportCurrentGlb()`

순서:
1. `runValidation()`
2. error severity가 있으면 export 차단
3. `runtime.pristineScene` 존재 확인
4. `exportGlb(...)` 호출

### 7.2 exportGlb
구현:
- `src/lib/glb.ts`
- `exportGlb(payload)`

핵심 순서:
1. `const scene = payload.pristineScene.clone(true)`
2. 모든 `lift`를 `applyLift(scene, lift)`로 반영
3. 모든 `port`를 `applyPort(scene, port)`로 반영
4. 모든 `readonlyObject`를 `applyReadOnly(scene, entity)`로 반영
5. `GLTFExporter.parseAsync(scene, { binary: true, animations })`
6. `Blob(model/gltf-binary)` 반환

### 7.3 export의 의미
즉 export는:
- preview가 보고 있는 장면을 그대로 저장하는 게 아니라
- **깨끗한 원본 scene clone에 현재 store 상태를 다시 주입해서 저장**한다.

따라서 export 측은 상대적으로 더 안정적이다.

---

## 8. 현재 정리

### 8.1 기존 구조 요약
- **GLB 로드 후 두 갈래**
  - runtime scene (`workingScene`, `pristineScene`)
  - 편집 entity (`lifts`, `ports`, `readonlyObjects`)
- **에디터는 entity 기반**
- **기존 preview는 workingScene 기반**
- **export는 pristineScene clone + entity 반영 기반**

### 8.2 공유 여부 요약
- 초기 로드 직후에는 같은 GLB 출발점이라 사실상 연관됨
- 하지만 편집 이후에는 완전 공유라고 보기 어려움
- 특히 기존 preview와 editor는 같은 source-of-truth를 보지 않았다

### 8.3 이번 단순화 방향
preview는 우선 다음 원칙으로 단순화한다.

1. **preview의 source-of-truth를 store entity로 통일**
2. raw GLB clone 렌더를 preview 기본 경로에서 제거
3. lift/port/readonlyObject를 단순한 proxy geometry로 렌더
4. preview가 항상 보이는 것을 우선
5. 이후 필요하면 “원본 GLB fidelity preview”는 별도 모드로 재도입

이 방향이면:
- editor와 preview가 같은 상태를 보게 되고
- blank 원인 분석이 쉬워지며
- 시각적 구분도 더 안정적으로 제어할 수 있다.
