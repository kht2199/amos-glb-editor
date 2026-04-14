# 모바일 대응안 (PC 영향 최소화)

## 목표
- 현재 PC 3열 편집 화면은 유지한다.
- 모바일/좁은 폭에서만 사용성을 개선한다.
- 데이터 흐름, 편집 로직, preview/export 동작은 건드리지 않는다.

## 적용 원칙
1. `lg` 이상에서는 기존 레이아웃을 그대로 유지한다.
2. `lg` 미만에서만 레이아웃을 바꾼다.
3. 중앙 편집 캔버스는 항상 우선 노출한다.
4. Structure / Inspector / Preview는 모바일에서 하단 탭 전환 영역으로 내린다.
5. Toolbar/StatusBar는 모바일에서 줄바꿈/가로 스크롤/정보 축약만 적용한다.

## Claude 검토 반영
- 1차 적용은 **깨짐 방지 + 세로 스택 + 내부 폼 반응형**까지만 한다.
- 모바일 패널 탭 전환은 `StructurePanel` 로컬 state 초기화 위험이 있어 이번 범위에서 제외한다.

## 제안 구현
### 1. App 레이아웃
- `lg` 이상:
  - 기존 `300px / 1fr / 360px` 3열 유지
- `lg` 미만:
  - 세로 스택
  - `Structure → TopViewCanvas → Inspector → Preview` 순서로 노출
  - `TopViewCanvas`는 모바일 전용 최소 높이 확보

### 2. Toolbar
- PC는 기존 형태 유지
- 모바일에서는:
  - 상단 상태 pill을 줄바꿈 허용
  - 툴 그룹은 wrap 우선, 필요한 곳만 가로 스크롤 허용
  - 버튼 텍스트/배치는 유지해 기능 탐색 비용 최소화

### 3. StatusBar
- 모바일에서는 세부 정보 2줄 이상 wrap 허용
- 좌표/상태/이슈 텍스트가 잘리지 않도록 `break`/`wrap` 중심으로만 조정

### 4. Inspector / Panel 내부 최소 보완
- `InspectorPanel`의 2열 입력 영역은 모바일에서 1열, `sm` 이상에서만 2열
- `StructurePanel`, `InspectorPanel`, `PreviewPanel`은 모바일에서 자연스럽게 세로 길이를 가지도록 조정

## 변경 회피 항목
- store 구조
- draft/applied flow
- preview reconstruction path
- export behavior
- PC용 panel content 구조 자체

## 기대 효과
- PC 레이아웃은 그대로 유지
- 모바일에서 화면이 좌우로 깨지지 않음
- 캔버스 중심 편집 흐름은 유지
- 구조/인스펙터/프리뷰 접근성 개선
