# Demo Scene Ontology Tagging

대상 기준:
- 소스: `src/lib/demoScene.ts`
- 샘플 출력: `samples/demo-scene.glb`

이 문서는 현재 demo scene이 어떤 도메인 의도를 갖고 구성되어 있는지 정리한다.

## Scene 개요
현재 demo scene bundle은 다음으로 구성된다.

- Lift 2개
- Port 4개
  - Lift dock port 3개
  - Stocker access port 1개
- Read-only object 4개
  - Bridge 1개
  - Rail 1개
  - Stocker 1개
  - Transport 1개
- Cleanroom visual shell 1식
  - floor / ceiling grid / column / rear wall

이 장면은 FAB 전체 재현이 아니라,
**층간 Lift와 상부/하부 Port 편집, domain parent 복원, semantic role 표현을 검증하기 위한 축약 샘플**이다.

## 캐리어 흐름 관점의 해석
현재 demo scene은 아래 구조를 단순화한 장면으로 본다.

`Upper Port Handoff → Inter-floor Lift Vertical Transfer → Lower Port Handoff`

보조 문맥으로는 아래 흐름을 덧붙여 읽을 수 있다.

`Transport(OHT) → Rail/Bridge guideway → Stocker top handoff contact → Stocker access point`

즉,
- `Lift`는 편집 핵심인 **층간 수직 이송 모듈**
- `Port`는 **상부/하부 handoff를 나타내는 핵심 인터페이스**
- `Transport`는 ceiling guideway 위를 흐르는 OHT 보조 문맥
- `Rail`, `Bridge`는 guideway 배경 구조
- `Stocker`는 저장 장치 본체이며, 내부 carriage / slot rhythm / top handoff hint를 read-only geometry로 읽을 수 있음
- `Transport`/`OHT`는 현재 scene의 중심 오브젝트가 아니라 ceiling logistics를 암시하는 read-only reference
- cleanroom shell은 도메인 엔티티라기보다 lightweight visual context
- 시각 표현은 현실 복제보다 **upper/lower 구분과 vertical transfer 가독성**을 우선할 수 있음

## 노드/엔티티 tagging 표
| Entity | editorId | ontology class | editor entity | domain parent | 핵심 메타 | note |
|---|---|---|---|---|---|---|
| Lift A | `lift_a` | `VerticalTransfer.Lift` | Lift | - | `rotation=0`, `slotsPerFace=6` | editable lift |
| Lift B | `lift_b` | `VerticalTransfer.Lift` | Lift | - | `rotation=90`, `slotsPerFace=6` | editable lift, dock reference |
| Port A-01 | `port_a_01` | `Interface.DockingPoint` | Port | `Lift(lift_a)` | `semanticRole=LIFT_DOCK`, `zOffset=20`, `face=FRONT`, `slot=2`, `portType=IN` | lift 전면 도킹 포인트(상단 쪽 배치) |
| Port A-02 | `port_a_02` | `Interface.DockingPoint` | Port | `Lift(lift_a)` | `semanticRole=LIFT_DOCK`, `zOffset=0`, `face=FRONT`, `slot=4`, `portType=OUT` | lift 전면 도킹 포인트(기준 높이 배치) |
| Port B-01 | `port_b_01` | `Interface.DockingPoint` | Port | `Lift(lift_b)` | `semanticRole=LIFT_DOCK`, `zOffset=0`, `face=LEFT`, `slot=3`, `portType=INOUT` | 보조 lift의 좌측 도킹 포인트 |
| Stocker Access 01 | `stocker_access_01` | `Interface.AccessPoint` | Port | `Stocker(stocker_01)` | `semanticRole=STOCKER_ACCESS`, `zOffset=null`, `face=FRONT`, `slot=1`, `portType=INOUT` | stocker 접근/인계 지점 |
| Bridge 01 | `bridge_01` | `Guideway.Bridge` | Bridge | - | read-only | 배경 연결 구조 |
| Rail 01 | `rail_01` | `Guideway.Rail` | Rail | - | read-only | transport path reference |
| Stocker 01 | `stocker_01` | `Storage.Stocker` | Stocker | - | read-only | 저장 장치 본체 |
| Transport 01 | `transport_01` | `Transport.OHTCarrier` | Transport | `Rail(rail_01)` | read-only | 상부 guideway를 따라 이동하는 OHT carrier 문맥 |
| CleanroomShell | - | `Context.CleanroomShell` | visual context only | - | non-editable / non-domain | 천장 grid, floor, column, rear wall로 구성된 lightweight 시각 배경 |

## domain parent 해석
이 demo scene의 핵심은 `scene graph parent`보다 `domain parent`가 더 중요하다는 점이다.

### Lift dock port
- `port_a_01` → `domainParentType=Lift`, `domainParentId=lift_a`
- `port_a_02` → `domainParentType=Lift`, `domainParentId=lift_a`
- `port_b_01` → `domainParentType=Lift`, `domainParentId=lift_b`

### Stocker access port
- `stocker_access_01` → `domainParentType=Stocker`, `domainParentId=stocker_01`

즉, 포트는 모두 같은 종류의 mesh처럼 보여도
**어디에 소속된 포트인가를 domain metadata로 구분**해야 한다.

## semantic role 해석
현재 demo scene은 `Port.semanticRole`을 다음처럼 사용한다.

- `LIFT_DOCK`
  - Lift에 부착된 handoff / docking point
- `STOCKER_ACCESS`
  - Stocker 접근 / 인계 지점

아직 demo에는 포함하지 않았지만 타입 차원에서는 아래도 열어두고 있다.
- `TOOL_LOAD`
- `BUFFER_HANDOFF`

## 구현에 주는 의미
### import
- `editorMeta.objectType`를 1차 분류 기준으로 사용한다.
- node 이름은 fallback 힌트일 뿐이다.
- lift 외부 포트도 `domainParentId/domainParentType`로 복원해야 한다.

### selection / inspector
- Lift 선택 시 domain 관계를 기준으로 하위 포트를 보여줘야 한다.
- Port inspector는 `semanticRole`, `domain parent`, `zOffset`, `face`, `slot`, `portType`를 중심으로 다뤄야 한다.

### validation
- Lift 소속 포트는 `same lift + same face + same slot` 충돌을 본다.
- 현재 구현에서 `zOffset`은 높이 복원용 값이며, 슬롯 유일성 키에는 포함하지 않는다.
- Lift 외부 포트도 동일하게 `same domain parent + same face + same slot` 규칙으로 본다.

### export
- scene graph를 강제로 재계층화하지 않는다.
- pristine clone 위에 domain diff를 적용하는 방식이 더 안전하다.
- export 시 `objectType`, `domainParentId`, `domainParentType`, `semanticRole`, `face`, `zOffset`, `slot`, `portType` 메타데이터를 유지하는 것이 중요하다.

## 결론
현재 demo scene은 반도체 FAB 전체를 정밀 재현한 샘플이 아니라,
**층간 Lift 중심 편집기에서 상부/하부 Port의 의미론적 역할과 부모 복원 규칙을 검증하기 위한 도메인 샘플**이다.

특히 이번 버전의 핵심 차별점은 다음 여섯 가지다.
1. `lift_a`에 상부 포트와 하부 포트를 함께 두어 **inter-floor handoff pair**를 한 눈에 읽히게 했다.
2. 상부/하부 포트는 색과 프레임 실루엣을 분리해, 현실보다 설명적이더라도 즉시 구분되게 했다.
3. 메인 lift는 vertical shaft / landing band / guide column을 강조해 층간 장비로 읽히게 했다.
4. `Stocker access port`를 별도 semantic role과 domain parent로 표현했다.
5. Stocker / Rail / Transport는 ghosted context geometry로 남겨 보조 문맥 역할에 머물게 했다.
6. Preview 조명과 재질 대비를 조정해 dark schematic 느낌을 줄였다.
