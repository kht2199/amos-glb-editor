# Demo Scene Rebuild Prompt

이 문서는 `glb-editor`의 demo scene을 다시 만들거나 다른 에이전트/모델에게 재구현을 요청할 때 사용할 수 있는 요구사항 명세다.

---

## 목적

`glb-editor`의 demo scene을 다시 만든다.
이 demo scene의 목적은 반도체 FAB 전체를 사실적으로 재현하는 것이 아니라,
**Lift/Port 중심의 제약형 편집기에서 배치 편집, domain parent 복원, semantic role 표현을 검증**하는 것이다.

즉, 이 scene은 다음을 검증해야 한다.

1. Lift 이동/회전과 애니메이션 메타데이터
2. Port의 face/slot/level 기반 배치
3. Lift 소속 Port와 Lift 외부 Port(예: Stocker access)의 구분
4. `domainParentId` / `domainParentType` / `semanticRole` 유지
5. read-only 구조물은 문맥만 제공하고 편집 핵심보다 앞에 서지 않도록 시각적 우선순위를 낮추기

---

## 핵심 해석 원칙

- 이 editor는 **상단뷰 기반 배치 편집기**다.
- 자유형 3D 모델러를 만드는 것이 아니다.
- 편집 핵심은 `Lift`와 `Port`다.
- `Bridge`, `Rail`, `Stocker`, `Transport`, cleanroom shell은 **문맥 제공용 구조물**이다.
- 편집 로직은 geometry보다 metadata 중심이어야 한다.
- scene graph parent보다 **domain parent**가 더 중요하다.
- 원본 GLB의 메쉬 형태가 달라도 편집 규칙은 동일해야 한다.

---

## 반드시 포함할 scene 구성

### 1) Lift
- Lift 2개
- 둘 다 편집 가능
- 각각 `rotation`, `slotsPerFace`, `animation`을 가져야 함
- 최소 한 개는 rotation 0도, 다른 한 개는 90도로 차이를 보여줄 것
- lift의 외형은 low-poly이되, 내부 구조가 약간 보이는 형태면 좋음

예시 구성:
- Lift A
  - `editorId = lift_a`
  - `rotation = 0`
  - `slotsPerFace = 6`
- Lift B
  - `editorId = lift_b`
  - `rotation = 90`
  - `slotsPerFace = 6`

### 2) Port
- Port 총 4개
- Lift dock port 3개
- Stocker access port 1개
- Port는 단순 박스가 아니라 의미가 조금 드러나는 low-poly 형태로 표현
- 단, 편집 기준은 메쉬가 아니라 metadata여야 함

예시 구성:
- `port_a_01`
  - parent: `lift_a`
  - `semanticRole = LIFT_DOCK`
  - `level = TOP`
  - `face = FRONT`
  - `slot = 2`
  - `portType = IN`
- `port_a_02`
  - parent: `lift_a`
  - `semanticRole = LIFT_DOCK`
  - `level = TOP`
  - `face = FRONT`
  - `slot = 4`
  - `portType = OUT`
- `port_b_01`
  - parent: `lift_b`
  - `semanticRole = LIFT_DOCK`
  - `level = BOTTOM`
  - `face = LEFT`
  - `slot = 3`
  - `portType = INOUT`
- `stocker_access_01`
  - parent: `stocker_01`
  - `semanticRole = STOCKER_ACCESS`
  - `domainParentType = Stocker`
  - `level = BOTTOM`
  - `face = FRONT`
  - `slot = 1`
  - `portType = INOUT`

### 3) Read-only object
- 최소 4개 포함
  - Bridge 1개
  - Rail 1개
  - Stocker 1개
  - Transport 1개
- 이 오브젝트들은 편집 대상이 아니라 **배경 문맥**이다.
- 존재감은 있되, Lift/Port보다 강하게 보이면 안 된다.

예시 의미:
- `Bridge`: 연결 구조물
- `Rail`: guideway / path reference
- `Stocker`: storage body + internal handoff/storage hint
- `Transport`: compact OHT carrier reference

### 4) Cleanroom shell
- floor
- ceiling 또는 ceiling grid
- column
- rear wall 또는 유사한 배경 구조물

하지만 이 구조는 **도메인 핵심 엔티티가 아니라 lightweight visual context**로 취급해야 한다.

---

## 실제 stocker/lift 동작 참고 해석

실제/제품 소개 영상 기준으로 scene은 아래 특징을 따르면 결과가 안정적이다.

- Stocker는 **높은 직육면체 cleanroom cabinet/tower**처럼 보여야 함
- Stocker 내부에는 **반복적인 multi-level storage slot rhythm**이 보여야 함
- 내부 transfer는 흔들리는 crane보다 **vertical lift carriage의 직선 Z 이동**으로 느껴져야 함
- slot 입출고는 긴 다관절 팔보다 **짧은 horizontal handoff shelf / platform**이 더 자연스러움
- overhead rail/OHT는 바닥 장비가 아니라 **상부 guideway 문맥**으로 보여야 함
- stocker 상부에는 OHT에서 내부 lift로 이어지는 **top handoff 접점**이 보여야 하며, 전체 흐름은 한눈에 아래 순서로 읽혀야 함
  - overhead arrival (ceiling rail context)
  - top handoff (stocker 상부 접점)
  - vertical alignment (internal lift Z 이동)
  - short horizontal insert (slot 입출고)

즉, 장면은 “위에서는 운반, 안에서는 수직 정렬, 슬롯에는 짧게 넣고 뺀다”가 읽히는 방향이 좋다.

---

## 시각/UX 요구사항

### 1) 핵심 오브젝트 우선순위
가장 눈에 띄어야 하는 순서는 대략 다음과 같다.

1. Lift
2. Port
3. Stocker
4. Bridge / Rail
5. Cleanroom shell / building-like background

즉, building처럼 보이는 구조물이 scene의 주인공처럼 보이면 안 된다.

### 2) 중요하지 않은 구조물의 투명도
- cleanroom shell 계열 구조물은 **조금 더 보이게 반투명** 처리
- 완전 투명 아님
- 너무 진해서 Lift/Port를 가리면 안 됨
- floor / ceiling / rear wall / support 계열은 시선 방해를 줄이는 방향
- 목표는 “배경 문맥은 남기되, 편집 핵심은 가리지 않기”

권장 해석:
- cleanroom panel / rear wall / ceiling grid / support는 불투명보다 낮은 opacity 사용
- stocker, bridge, rail도 필요하면 핵심 엔티티보다 약하게 보이도록 채도나 명도를 조정 가능

### 3) Preview 카메라
- preview 초기 카메라는 **정면 기준 45도 ISO 뷰**여야 함
- 기본 target은 scene center여야 하며, 초기 position은 X축 비틀림 없이 floor/ceiling 높이 차를 바로 읽을 수 있어야 함
- 사용자가 열었을 때 바닥은 아래, 천장은 위라는 관계가 즉시 이해되어야 함
- Lift/Port가 cleanroom shell, wall, ceiling grid 같은 배경 구조물에 가려진 상태로 시작하면 안 됨
- orbit은 가능하되, initial pose는 top view 기반 편집기의 확장 preview처럼 보여야 함

### 4) 탑뷰 편집 중심성 유지
- 제품의 본질은 top view 기반 배치 편집
- preview가 화려한 3D showcase처럼 느껴지면 안 됨
- scene 구성과 카메라는 **배치 편집을 더 잘 이해시키는 보조 수단**이어야 함

---

## 도메인/메타데이터 요구사항

다음 metadata가 중요하다.

### Lift
- `objectType = Lift`
- `id`
- `editorId`
- `position`
- `rotation` (`0 | 90 | 180 | 270`)
- `slotsPerFace`
- `animation`

### Port
- `objectType = Port`
- `id`
- `editorId`
- `semanticRole`
  - `LIFT_DOCK`
  - `STOCKER_ACCESS`
- `domainParentId`
- `domainParentType`
- `parentLiftId` (Lift 소속 포트인 경우)
- `face`
- `level`
- `slot`
- `portType`

### Read-only structure
- `objectType`
  - `Bridge`
  - `Rail`
  - `Stocker`
  - `Transport`는 타입 체계상 유지 가능
- read-only로 유지
- 직접 편집 대상 아님

### 핵심 규칙
- Lift 소속 포트는 `face + slot + level`로 배치 가능해야 함
- Lift 외부 포트는 `domainParentId/domainParentType`로 의미를 복원해야 함
- 포트는 scene graph child 여부보다 domain metadata가 더 중요함
- export/import round-trip에서 메타데이터 유지가 중요함

---

## 이 demo scene이 전달해야 하는 메시지

이 demo scene을 보는 사람은 다음을 바로 이해할 수 있어야 한다.

1. 이 editor의 핵심은 Lift와 Port 편집이다.
2. Stocker access 같은 lift 외부 포트도 다룰 수 있다.
3. read-only 구조물은 배치 문맥용이다.
4. cleanroom/building-like 구조물은 배경일 뿐이며 편집 주제가 아니다.
5. 이 scene은 정교한 fab replica가 아니라, domain-aware editing 규칙 검증용 샘플이다.

---

## 하지 말아야 할 것

- FAB 전체를 과도하게 사실적으로 재현하려고 하지 말 것
- 건물/벽/천장 구조가 Lift/Port보다 더 눈에 띄게 만들지 말 것
- preview를 완전 side view 또는 완전 top-down으로 시작하지 말 것
- 배경 구조물(cleanroom shell, wall, ceiling)이 Lift/Port 앞에 서는 각도로 시작하지 말 것
- geometry 디테일에 편집 규칙이 종속되게 만들지 말 것
- scene graph 구조만으로 parent를 해석하지 말 것

---

## 구현 산출물 요구

다시 만들 때 최소 산출물은 다음과 같다.

1. `src/lib/demoScene.ts`
   - demo scene 구성
   - Lift / Port / Read-only object / cleanroom shell 생성
2. `docs/demo-scene-ontology-tagging.md`
   - 엔티티 구성과 domain 의미 정리
3. 필요 시 preview 관련 기본값
   - 카메라 초기 시점
   - 배경 구조 transparency
4. sample GLB가 필요하면 재생성 가능하도록 유지

---

## 다른 모델/에이전트에 바로 전달할 최종 프롬프트

아래 프롬프트를 그대로 사용해도 된다.

```md
`glb-editor`의 demo scene을 다시 설계/구현하라.

목표는 반도체 FAB 전체를 사실적으로 재현하는 것이 아니라, Lift/Port 중심의 제약형 편집기에서 배치 편집, domain parent 복원, semantic role 표현을 검증하는 축약 샘플을 만드는 것이다.

필수 요구사항:
- Lift 2개, Port 4개, Read-only object 4개(Bridge/Rail/Stocker/Transport), cleanroom shell 포함
- Port는 Lift dock 3개 + Stocker access 1개
- scene graph parent보다 domain parent가 중요하도록 metadata 중심 구조 유지
- Lift/Port가 시각적 중심이어야 함
- Stocker는 단순 박스보다 **높은 vertical storage body**로 읽혀야 함
- Stocker read-only geometry에는 **white vertical lift carriage가 Z축으로 직선 이동**하는 듯한 시각적 인상이 포함되면 좋다. 이는 별도 Lift 엔티티를 추가하라는 뜻이 아니라, stocker access의 맥락을 설명하는 내부 표현이다. carriage 앞에는 **짧은 horizontal transfer shelf** 표현이 붙어 있는 것이 자연스러움
- overhead rail/OHT는 바닥 교통수단이 아니라 **ceiling guideway context**로 보여야 함
- cleanroom/building-like 배경 구조는 조금 더 보이게 반투명 처리
- preview 초기 카메라는 정면 기준 45도 ISO 뷰이며, 좌표계상 Z 높이 차와 주요 Lift/Port가 즉시 읽혀야 함
- top-view 기반 편집기의 목적이 드러나야 함
- geometry-agnostic editing 원칙 유지
- export/import round-trip에서 metadata 유지가 중요하도록 설계

포함해야 할 metadata:
- Lift: id, editorId, position, rotation, slotsPerFace, animation
- Port: id, editorId, semanticRole, domainParentId, domainParentType, parentLiftId, face, level, slot, portType
- Read-only: Bridge/Rail/Stocker/Transport 타입 체계 유지 가능

예시 포트 구성:
- port_a_01: lift_a, LIFT_DOCK, TOP, FRONT, slot 2, IN
- port_a_02: lift_a, LIFT_DOCK, TOP, FRONT, slot 4, OUT
- port_b_01: lift_b, LIFT_DOCK, BOTTOM, LEFT, slot 3, INOUT
- stocker_access_01: stocker_01, STOCKER_ACCESS, BOTTOM, FRONT, slot 1, INOUT

주의사항:
- 건물/벽/천장 구조가 주인공처럼 보이면 안 됨
- stocker 내부 동작을 swinging crane이나 긴 다관절 팔 중심으로 표현하지 말 것
- OHT를 바닥 AGV처럼 표현하지 말 것
- 이 scene은 full fab replica가 아니라 domain-aware editing sample이어야 함

산출물:
- demo scene 코드
- ontology tagging 문서
- preview 기본 시점/투명도 반영
- 필요 시 sample GLB 재생성 가능 상태
```
