# GLB Import → Edit → Apply → Preview → Export 권장 흐름

이 문서는 `glb-editor`의 **권장 상태 분리 구조와 편집 흐름**을 정의한다.

핵심 원칙은 단순하다.

- **원본 GLB**는 보존한다.
- **중앙 편집 상태**는 draft로 관리한다.
- **우측 preview와 export 기준**은 applied로 관리한다.
- **Apply 버튼**이 draft와 applied 사이의 경계가 된다.
- 새 오브젝트 생성의 기본은 **타입 전용 추가가 아니라 선택된 오브젝트 복사(`Duplicate`)**다.
- 높이 편집의 1차 입력은 **실제 Z 위치 수정**으로 다룬다.
- Lift 소속 Port 높이는 `face + slot + zOffset`으로 복원하고, Inspector에서는 `Z`를 직접 수정한다.
- `Bridge / Rail / Stocker / Transport`도 같은 scene object 흐름 안에서 다루며, 현재 내부 구현명만 `backgroundObjects`로 남아 있다.

즉 이 문서의 목적은 현재 구현 설명을 나열하는 것이 아니라,
**앞으로 맞춰갈 기준 흐름**을 분명히 정하는 것이다.

---

## 1. 권장 상태 모델

먼저 구분할 점이 있다.

- **현재 구현**은 `draftLifts / draftPorts / draftBackgroundObjects`처럼 타입별 배열을 유지한다.
- **이 문서의 목표 방향**은 여러 `objectType`을 하나의 공통 오브젝트 편집 흐름으로 다루는 것이다.
- 따라서 아래 타입별 계층 설명은 현재 구현과의 연결을 위한 과도기 표기이며, 장기적으로는 `draftObjects / appliedObjects` 같은 통합 모델로 수렴할 수 있다.
- 여기서 `draftBackgroundObjects`라는 이름은 내부 타입명일 뿐, 사용자-facing 개념은 **배경/문맥 오브젝트를 포함한 scene object**다.

### 1.1 원본 계층
- `fileName`
- `pristineScene`
- `animations`

역할:
- import 직후의 GLB 원본 기준을 보존한다.
- preview 재생성과 export의 출발점이 된다.

### 1.2 draft 계층
> 현재 구현(과도기) 기준
> - `draftLifts`
> - `draftPorts`
> - `draftBackgroundObjects`

역할:
- 중앙 편집 캔버스가 직접 사용하는 작업 상태
- 사용자의 편집 중간 결과
- 아직 preview/export에 적용되지 않은 상태

메모:
- 현재 구현은 타입별 배열로 분리되어 있지만, 문서 기준의 방향은 **scene object 전반을 같은 편집 모델로 다루는 것**이다.
- 따라서 `draftLifts / draftPorts / draftBackgroundObjects`는 과도기 구조로 볼 수 있으며, 장기적으로는 통합된 object 계층으로 수렴할 수 있다.

### 1.3 applied 계층
> 현재 구현(과도기) 기준
> - `appliedLifts`
> - `appliedPorts`
> - `appliedBackgroundObjects`

역할:
- Apply 버튼을 통해 반영된 안정 상태
- preview와 export가 공통으로 참조하는 상태

메모:
- applied 계층 역시 현재 구현에서는 타입별 배열로 분리되어 있으나, 편집 원칙 자체는 **objectType이 다른 여러 오브젝트를 동일한 흐름으로 다루는 것**이다.

### 1.4 파생 상태
- `validationIssues`
- `collisionIssues`
- `history / future`
- `hasPendingChanges`

역할:
- draft와 applied 차이 여부를 추적한다.
- Apply 가능 여부와 export 가능 여부를 판단한다.

---

## 2. 전체 흐름

### 2.1 Import 및 전처리

사용자가 GLB를 열면 다음 순서로 처리한다.

#### 개요
1. GLB를 로드한다.
2. scene을 파싱한다.
3. 편집 가능한 entity로 정규화한다.
4. 원본 계층, draft 계층, applied 계층을 초기화한다.

#### 상세 단계
> 현재 구현(과도기) 기준으로는 타입별 감지/정규화 경로를 사용한다.

1. `loadFile(file)` 호출
2. `GLTFLoader.parseAsync(buffer, '')`로 scene 복원
3. `pristineScene = gltf.scene.clone(true)`로 원본 기준 보존
4. scene traverse로 object type 감지
   - `Lift`
   - `Port`
   - `Bridge`
   - `Rail`
   - `Stocker`
   - `Transport`
5. 감지 결과를 편집용 entity로 정규화
   - `lifts`
   - `ports`
   - `backgroundObjects`
6. objectType, transform, parent 관계, 기타 metadata 같은 편집 단위 해석
7. `draft*`와 `applied*`를 동일한 초기값으로 세팅
8. `hasPendingChanges = false`

#### 이 단계의 의미
- GLB는 raw mesh 그대로 편집하는 입력이 아니라,
  **편집 가능한 object/entity로 해석되는 입력 원본**이다.
- import 직후에는 draft와 applied가 같으므로 중앙과 preview 결과도 같은 상태에서 출발한다.

---

### 2.2 중앙 Edit 캔버스

중앙 편집 영역은 draft만 본다.

#### source-of-truth
- `draftLifts`
- `draftPorts`
- `draftBackgroundObjects`

#### 역할
- 선택
- 이동
- 회전
- 복사(`Duplicate`)
- 속성 수정
- 관계 수정
- Z 직접 수정 기반 편집

#### 현재 구현 메모
- `Move` 모드는 Lift 전용이 아니라 Lift / Port / 배경 오브젝트 전체의 XY 이동 모드다.
- 배경 오브젝트(`Bridge / Rail / Stocker / Transport`)도 draft/applied entity로 유지되며 Inspector에서 X / Y / Z를 직접 수정할 수 있다.
- 현재 코드에는 Port 관련 전용 로직이 남아 있을 수 있으나, 문서 기준의 목표 방향은 **오브젝트 복사 + objectType/metadata 수정 중심 흐름**이다.
- 높이 차이는 `TOP/BOTTOM` 단계값이 아니라 **Z 좌표 직접 수정**으로 표현한다.

#### 표현 원칙
- XY plane 중심의 편집 친화 표현
- raw GLB fidelity 확인보다 구조/관계 편집 우선
- 특정 타입 전용 추가 모드보다 **공통 오브젝트 편집 UX**를 우선

즉 중앙 캔버스는 **draft entity editor**다.

---

### 2.3 Edit 시 동작

사용자가 중앙에서 작업하면 변화는 draft에만 반영한다.

#### 처리 순서
1. 사용자 입력 발생
2. draft entity 갱신
3. 필요 시 관계/metadata 재계산
4. validation 재계산
5. collision 재계산
6. history stack 기록
7. `hasPendingChanges = true`

#### 중요한 원칙
이 단계에서는 preview/export 기준 상태를 자동으로 바꾸지 않는다.

추가 메모:
- 새 오브젝트 생성의 기본 진입점은 `Add Port` 같은 타입 전용 액션이 아니라 **선택된 오브젝트 복사(`Duplicate`)**다.
- 복사 후에는 위치를 조정하고, 필요하면 Inspector에서 `objectType`과 metadata를 수정한다.
- Port는 여러 objectType 중 하나이며, 특별한 생성 진입점을 제품 중심에 두지 않는다.

즉:
- 중앙 = 지금 편집 중인 상태
- preview = 마지막으로 적용된 상태

로 분리한다.

---

### 2.4 Apply 버튼

Apply는 이 문서에서 가장 중요한 단계다.

#### 역할
- draft를 preview/export 기준 상태로 승격한다.
- 사용자가 “이 편집 결과를 실제 결과로 채택한다”는 의사결정 지점이 된다.

#### 처리 순서
1. Apply 요청
2. 현재 draft 기준 validation 수행
3. 현재 구현은 validation 결과를 표시하지만, apply 자체를 validation으로 차단하지는 않는다.
4. `draft* -> applied*` 복사
5. `hasPendingChanges = false`

#### 보수적 구현 원칙
Apply 시점에 꼭 `appliedScene`을 store에 영구 보관할 필요는 없다.
다음 둘 중 하나를 택하면 된다.

- **옵션 A:** `applied*`만 저장하고, preview/export 시 필요할 때마다 `pristineScene.clone(true)`에 다시 반영
- **옵션 B:** `applied*`와 함께 preview용 재구성 결과를 캐시

현재 코드베이스에는 export용 재구성 경로가 이미 있으므로,
**우선은 옵션 A가 더 보수적이고 현실적**이다.

---

### 2.5 우측 Preview 캔버스

preview는 applied만 본다.

#### source-of-truth
- `appliedLifts`
- `appliedPorts`
- `appliedBackgroundObjects`
- `pristineScene`

preview는 export와 동일하게,
`pristineScene.clone(true)`에 applied 상태를 반영해 만든
**재구성 scene**을 렌더한다.

#### 역할
- 마지막 적용본의 3D 확인
- export 결과와 동일한 기준 유지
- 중앙 편집 중 흔들리는 임시 상태와 분리

#### 처리 순서
1. preview가 필요해짐
2. `pristineScene.clone(true)` 생성
3. applied 상태 반영
   - 현재 구현(과도기) 기준: `applyLift(...)`, `applyPort(...)`, `applyBackgroundObject(...)`
4. 재구성된 scene을 preview canvas에 마운트

#### 원칙
- preview는 draft를 무조건 실시간 반영하지 않는다.
- preview는 Apply 이후 결과만 보여준다.
- preview와 export는 **같은 applied 기준 + 같은 재구성 경로**를 공유한다.
- 차이는 최종 출력 형태뿐이다.
  - preview: Canvas 렌더
  - export: GLB binary 생성

즉 preview는 **실시간 작업 스케치 뷰**가 아니라
**적용된 결과를 export와 같은 경로로 확인하는 뷰**다.

추가 메모:
- preview는 XYZ gizmo와 Z-up 기준을 유지한다.

---

### 2.6 Export

export는 applied 기준으로만 진행한다.

#### 처리 순서
1. export 요청
2. `hasPendingChanges === true`면 export를 차단하고 안내
   - 예: 미적용 변경이 있으니 Apply 후 export 하라고 안내
3. `pristineScene.clone(true)` 생성
4. applied 상태 반영
   - `applyLift(...)`
   - `applyPort(...)`
   - `applyBackgroundObject(...)`
5. `GLTFExporter.parseAsync(..., { binary: true, animations })`
6. GLB Blob 생성
7. 다운로드 URL 생성

#### 핵심 원칙
- preview와 export는 같은 기준을 본다.
- preview와 export는 같은 재구성 경로를 공유한다.
- export는 draft가 아니라 applied 결과를 내보낸다.

---

## 3. 왜 이 구조가 맞는가

### 3.1 역할 분리가 명확하다
- 원본 GLB: 기준
- draft: 편집 중 상태
- applied: 채택된 결과

이렇게 나누면 어느 화면이 무엇을 보고 있는지 설명이 쉬워진다.

### 3.2 preview와 export가 같은 결과를 보기 쉽다
지금까지 가장 흔한 혼선은
“미리보기와 실제 export 결과가 같은가?”였다.

Apply를 경계로 두면:
- preview = applied
- export = applied

가 되므로 기준이 맞춰진다.

### 3.3 중앙 편집 UX를 유지할 수 있다
이 프로젝트의 중심은 raw mesh 편집이 아니라
`objectType / metadata / transform / 관계` 같은
**domain-aware object 편집**이다.

그래서 중앙은 계속 entity editor로 두는 편이 맞다.

---

## 4. 왜 “중앙에서 raw GLB를 직접 수정”은 비추천인가

겉보기엔 단순해 보이지만, 현재 목적에는 잘 맞지 않는다.

### 이유
1. 이 프로젝트의 핵심은 mesh editor보다 domain-aware object editor에 가깝다.
2. 관계 수정, metadata 유지, validation/collision 계산은 entity 모델이 더 안정적이다.
3. Duplicate 기반 생성도 raw mesh 직접 수정보다 entity 흐름 위에서 다루는 편이 안전하다.
4. XY plane 중심의 작업 UX와도 더 잘 맞는다.

즉 추천은:
- GLB는 입력 원본
- 중앙은 draft entity 편집
- Apply 후 preview/export 반영

이다.

---

## 5. 추천 UI와 상태 표시

### 5.1 버튼
- `Apply` — 구현됨, draft를 applied 기준으로 승격
- `Revert` — 구현됨, applied 상태로 draft 복원
- `Reset to imported GLB` — 아직 미구현
- `Duplicate` — 목표 UX, 선택된 오브젝트를 복사해 새 작업 시작점 생성
- `Export GLB` — 구현됨, applied 기준 export, pending draft가 있으면 차단

### 5.2 상태 표시
- 상단 pill: `fileName · DRAFT PENDING|DRAFT SYNCED`
- 하단 status: `Draft: Pending|Synced`, export/validation 상태 메시지
- top view header: `Origin(x, y) · X+ right|left · Y+ up|down`
- preview label: `applied preview · draft pending|draft synced`
- `Validation issues available` — validation은 참고 정보/검토 보조로 표시
- `Export ready / blocked / success` — export feedback modal과 연결

---

## 6. 추천 구현 순서

### 6.1 상태 분리
우선 store를 아래 기준으로 분리한다.
- `draft*`
- `applied*`
- `hasPendingChanges`

### 6.2 Apply action 추가
- draft 검증
- applied 반영
- pending 상태 해제
- validation은 참고 정보로만 유지하고 apply 차단 정책은 두지 않음

### 6.3 Preview를 applied 기준으로 정리
- draft 실시간 반영 제거
- Apply 이후만 갱신
- preview는 `pristineScene.clone(true)` 기반 재구성 scene 사용
- export와 preview가 동일한 scene 재구성 함수를 공유하도록 정리

### 6.4 Export를 applied 기준으로 정리
- pending draft가 있으면 경고
- applied만 export

### 6.5 Top view 기준 좌표와 축 방향
- top view는 scene 좌표 자체를 바꾸지 않고 **2D 작업 기준 프레임**만 조정한다.
- 사용자는 `Reference X / Reference Y`로 기준 원점을 바꿀 수 있다.
- 사용자는 `X Axis Positive`, `Y Axis Positive`로 양의 축이 화면의 어느 방향인지 바꿀 수 있다.
- drag/unproject는 이 프레임을 따라 동작하므로, 화면상 이동 방향과 좌표 읽기가 선택한 기준과 일치한다.
- 이 설정은 현재 작업 세션의 view state이며, draft/applied/export 데이터와 undo/redo 이력에는 포함하지 않는다.

---

## 7. 최종 요약

이 문서의 권장 구조는 한 줄로 요약하면 다음과 같다.

> **GLB는 import 시 entity로 해석하고, 중앙은 draft를 편집하며, 새 오브젝트 생성은 Duplicate를 기본으로 하고, Apply 버튼으로 applied를 만들고, preview와 export는 applied 기준으로 통일하며, top view는 별도 기준 좌표/축 방향 프레임으로 읽는다.**

이 구조를 따르면:
- 원본 / 편집 중 / 적용 결과의 역할이 분리되고
- preview가 export와 같은 결과를 확인하는 의미로 명확해지며
- 일반 오브젝트 편집 흐름이 일관되고
- export 기준이 안정되고
- 현재의 preview 혼선을 구조적으로 줄일 수 있다.

---

## 부록. 현재 코드와 직접 연결되는 구현 포인트

권장안은 아래 기존 구현 자산을 활용해 점진적으로 옮길 수 있다.

- `loadGlbFile(file)`
- `pristineScene`
- entity 정규화 (`lifts / ports / backgroundObjects`) — 현재 구현(과도기) 기준
- `deriveScene(...)`
- `applyLift(...)` — 현재 구현(과도기) 기준
- `applyPort(...)` — 현재 구현(과도기) 기준
- `applyBackgroundObject(...)` — 현재 구현(과도기) 기준
- `exportGlb(...)`

메모:
- `applyLift / applyPort / applyBackgroundObject` 같은 분리 함수는 현재 구현과 연결되는 과도기 구조다.
- 장기적으로는 공통 object 계층에 맞춰 `applyObject(...)` 같은 통합 경로로 수렴할 수 있다.

즉 전면 재작성보다,
**상태 분리와 Apply 경계 유지 + 생성 UX와 Z 편집 개념 정리**가 우선이다.
