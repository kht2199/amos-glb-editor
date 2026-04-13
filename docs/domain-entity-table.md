# glb-editor 도메인 엔티티 표

이 문서는 현재 `glb-editor`가 사용하는 반도체 물류 구조 편집용 공식 엔티티를 정리한다.

## 목적
- 실제 장비 용어와 editor 내부 엔티티를 분리한다.
- import / selection / inspector / export와 validation 참고 정보의 공통 기준을 고정한다.
- `scene graph 관계`와 `domain 관계`를 혼동하지 않도록 한다.

## 핵심 해석 원칙
- 이 editor는 FAB 전체를 재현하는 툴이 아니라, **scene object를 안전하게 수정하는 상단뷰 기반 제약형 editor**다.
- `AMHS`는 시스템 전체 개념이며 현재 직접 편집 엔티티는 아니다.
- `Lift`는 프로젝트의 수직 이송 모듈 추상화다.
- `Port`는 도킹/인계 지점 추상화다. 실제 장비의 load port와 1:1 동치라고 단정하지 않는다.
- `Bridge`, `Rail`, `Stocker`, `Transport`도 현재 scene object 체계 안에 포함된다.
- 다만 각 objectType은 같은 편집 흐름을 공유하더라도, **도메인 메타데이터의 종류와 밀도는 서로 다를 수 있다.**
- `Transport`는 현재도 demo scene에 포함되지만, 주된 역할은 **OHT/ceiling logistics 문맥을 보여주는 보조 구조**다.
- 물리 구조층과 제어/운영층은 분리해서 다룬다. 현재 editor는 물리 구조층 중심이다.

## 공식 엔티티 표
| Editor Entity | 온톨로지 분류 | 프로젝트 의미 | 편집 가능 | 현재 타입/구조 | 핵심 속성 | 비고 |
|---|---|---|---|---|---|---|
| Lift | Vertical Transfer | 상하 레벨을 연결하는 수직 이송 모듈 | Yes | `LiftEntity` | `id`, `position`, `rotation`, `slotsPerFace`, `animation` | 실제 설비 고유명이라기보다 프로젝트 추상화 |
| Port | Interface / Handoff Point | Lift 또는 다른 구조물에 부착되는 도킹/인계 지점 | Yes | `PortEntity` | `id`, `portType`, `semanticRole`, `domainParentId`, `domainParentType`, `parentLiftId`, `zOffset`, `face`, `slot` | scene graph parent와 domain parent가 다를 수 있음 |
| Bridge | Guideway | rail/구조 연결용 고정 구조 | 제한적 Yes | `BackgroundObjectEntity` | `id`, `position`, `width`, `depth`, `height` | 선택/이동/복사/objectType 재분류는 가능하되 세부 도메인 메타는 단순 |
| Rail | Guideway | transport 경로로 해석되는 선형 구조 | 제한적 Yes | `BackgroundObjectEntity` | `id`, `position`, `width`, `depth`, `height` | OHT/OHS guideway 추상화 |
| Stocker | Storage | carrier 임시 저장 장치 본체 | 제한적 Yes | `BackgroundObjectEntity` | `id`, `position`, `width`, `depth`, `height` | demo scene에서는 내부 vertical carriage / storage bay rhythm / top handoff 문맥을 geometry로 함께 표현 가능 |
| Transport | Vehicle / Carrier Transport | overhead vehicle / OHT 계열 이동체 참조 엔티티 | 제한적 Yes | `BackgroundObjectEntity` | `id`, `position`, `width`, `depth`, `height` | 현재 demo scene에서 compact OHT carrier 형태의 시각 문맥으로 사용 |
| FOUP | Carrier | 운반 대상 payload | No | 별도 엔티티 없음 | 추후 runtime payload/meta 가능 | 현재 scene 구조물로 다루지 않음 |
| EFEM | Tool Front Interface | 공정 장비 front-end module | No | 별도 엔티티 없음 | 추후 tool-side model 필요 시 추가 | 현재 editor 범위 밖 |

## Port의 도메인 규칙
`PortEntity`는 현재 다음 필드를 중심으로 해석한다.

- `semanticRole`
  - `LIFT_DOCK`: lift에 부착된 handoff port
  - `STOCKER_ACCESS`: stocker 접근/인계 지점
  - `TOOL_LOAD`: tool/load port 계열 후보
  - `BUFFER_HANDOFF`: buffer/handoff 지점 후보
- `domainParentType`
  - `Lift`
  - `Stocker`
  - `Transport`
  - `Bridge`
  - `Rail`
- `domainParentId`
  - 의미론적 부모 엔티티 식별자
- `parentLiftId`
  - Lift 기반 편집 규칙과 위치 계산 호환용 부모 식별자

즉, 포트는 단순한 world 좌표 오브젝트가 아니라 **domain parent + role + face/slot/Z 조합**으로 다루는 엔티티다.

## Lift 규칙
- 탑뷰 기준 XY 평면에서 이동한다.
- 회전은 `0 / 90 / 180 / 270`만 허용한다.
- `slotsPerFace`는 포트 배치 규칙의 핵심 값이다.
- 애니메이션은 수직 왕복 preview 메타데이터로 유지한다.
- GLB round-trip 시 geometry를 재구성하기보다 metadata와 transform 갱신이 우선이다.
- 외형이 box, frame, 상세 모델 중 무엇이든 편집 규칙은 동일해야 하며, 편집 로직은 mesh 형상에 종속되면 안 된다.

## Port 규칙
- Lift 소속 포트는 `face + slot + Z`로 위치를 복원한다.
- Lift 외부 포트는 `domainParentId/domainParentType`가 1차 기준이다.
- scene graph 상에서 Lift child가 아니어도 domain 관계는 유지해야 한다.
- validation 참고 정보는 geometry보다 `same domain parent + same face + same slot` 충돌 규칙을 우선적으로 보여준다.

## 배경/문맥 오브젝트 규칙
### Bridge
- 이동 경로를 잇는 연결 구조물로 본다.
- scene object로 선택·이동·복사할 수 있지만, 역할상 topology 참조 성격이 강하다.

### Rail
- guideway / track 구조물이다.
- 현재 path/route graph까지는 분리하지 않는다.

### Stocker
- 저장 장치 본체로 해석한다.
- demo scene에서는 `StockerAccessPort`, 반복 slot/shelf rhythm, 내부 vertical carriage, top handoff contact를 읽을 수 있는 방향이 바람직하다.
- 다만 이 내부 표현은 편집 엔티티 분해가 아니라 **하나의 object 안에 담긴 ontology hint**다.

### Transport
- OHT/overhead vehicle 계열의 참조 엔티티다.
- 현재는 타입/온톨로지/향후 시뮬레이션 연결을 위한 개념 레벨이 강하다.
- 시각적으로는 바닥 AGV가 아니라 **ceiling guideway에 매달린 compact carrier**처럼 읽히는 것이 적절하다.

## 현재 타입 시스템 매핑
### `src/types.ts`
- `ObjectKind = 'Lift' | 'Port' | 'Bridge' | 'Rail' | 'Stocker' | 'Transport'`
- `DomainParentType = 'Lift' | 'Stocker' | 'Transport' | 'Bridge' | 'Rail'`
- `PortSemanticRole = 'LIFT_DOCK' | 'STOCKER_ACCESS' | 'TOOL_LOAD' | 'BUFFER_HANDOFF'`
- `LiftEntity`
  - `rotation`
  - `slotsPerFace`
  - `animation`
- `PortEntity`
  - `portType`
  - `semanticRole`
  - `zOffset`
  - `face`
  - `slot`
  - `parentLiftId?`
  - `domainParentId`
  - `domainParentType`
  - `attachedToPortId?`
- `BackgroundObjectEntity`
  - `Bridge | Rail | Stocker | Transport`

## 현재 모델의 장점
- scene object 전반을 같은 선택/이동/복사 흐름으로 다룰 수 있다.
- Lift/Port를 포함한 여러 타입의 메타데이터를 유지하면서도, 배경 오브젝트를 같은 편집 맥락 안에 둘 수 있다.
- GLB export에서 변경 범위를 transform + metadata 중심으로 제한하기 쉽다.
- top-view 기반 2D 편집 규칙과 잘 맞는다.
- lift 외부 포트도 `domainParent` 메타데이터로 확장 가능하다.

## 현재 모델의 한계
1. `TOOL_LOAD`, `BUFFER_HANDOFF`는 현업 용어와 완전히 일치하는지 SME 확인이 필요하다.
2. `Stocker` 내부 ontology는 object 내부의 hint 수준까지만 반영되어 있고, slot/hoist/handoff가 독립 엔티티로 분리된 것은 아니다.
3. `Transport`는 문맥용 대표 엔티티 수준이며 실제 시뮬레이션 vehicle 모델은 아니다.
4. `EFEM`, `Tool`, 제어/운영 소프트웨어 계층은 아직 모델 밖이다.

## 결론
현재 `glb-editor`는 반도체 물류 구조를 축약한 scene 위에서
**여러 scene object를 같은 편집 흐름으로 다루면서, objectType별 metadata와 transform을 유지한 채 GLB로 다시 내보내는 상단뷰 기반 object editor**로 보는 것이 가장 정확하다.
