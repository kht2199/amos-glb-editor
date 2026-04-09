# Daifuku 반도체 관련 조사 메모

이 문서는 **반도체와 직접 관련된 Daifuku 정보만** 추려 정리한 메모다.

## 확인한 공식 웹 자료
1. `Cleanroom | Solutions - DAIFUKU`
   - https://www.daifuku.com/solution/cleanroom/
2. `Cleanroom | DAIFUKU`
   - https://www.daifuku.com/pro/cr/
3. `Improving Reliability and Productivity with Daifuku’s Semiconductor Production Line Systems`
   - https://www.daifuku.com/daifuku-square/article/000999/
4. `Products | Solutions | DAIFUKU`
   - https://www.daifuku.com/solution/products/
5. `Daifuku Report 2023`
   - https://www.daifuku.com/ir/assets/23_full_e.pdf

## Daifuku를 반도체 문맥에서 어떻게 읽어야 하나
Daifuku는 반도체 공장용 장비를 개별 장치보다 **cleanroom AMHS(Automated Material Handling System)** 관점에서 설명한다.

즉 핵심은 다음 축이다.
- cleanroom transport
- cleanroom storage
- material control / scheduling / monitoring
- front-end fab + back-end 공정 자동화

## 공식 자료에서 반복되는 키워드
- high efficiency
- cleanliness
- low vibration
- 24/7/365 operation
- semiconductor production line systems
- cleanroom AMHS
- nitrogen purge
- back-end automation
- AI-based routing

## 반도체 관련 핵심 제품/용어

### 1. Cleanway
- Daifuku의 대표적인 **overhead monorail cleanroom transport system**
- ceiling-mounted rail 기반으로 읽는 것이 안전하다.
- FOUP 등 carrier를 공정 장비 사이에서 자동 반송하는 문맥으로 이해하면 된다.
- floor가 아니라 ceiling rail을 쓰므로 cleanroom 공간 활용에 유리하다고 설명한다.
- 기사에서는 fab 규모가 커질수록 rail total length가 200km 이상, vehicle이 10,000대 이상이 될 수 있다고 설명한다.

### 2. Reticle Cleanway
- wafer FOUP transport와 구분되는 **reticle 전용 overhead transport 계열**로 읽는 것이 안전하다.
- ontology 상에서는 wafer line과 같은 레이어로 뭉개지지 않게 메모해야 한다.

### 3. Clean Stocker
- cleanroom용 **AS/RS stocker** 문맥
- 단순 저장 캐비닛이 아니라 자동 저장/반출 시스템으로 이해하는 것이 맞다.
- ontology 상 `Storage.Stocker`에 넣되 `domainLabel: Clean Stocker`를 메모하는 방식이 적절하다.

### 4. Nitrogen purge stocker / nitrogen purge system
- 저장 중 wafer/FOUP 환경 제어를 위한 stocker 변형
- 반도체 미세화 대응 문맥에서 자주 언급된다.
- 외형만 보고 일반 stocker와 구분하기 어려울 수 있으므로, 이미지 단독 판독보다 라벨/문서 근거가 필요하다.

### 5. STB (Side Track Buffer)
- rail 사이의 임시 수령/버퍼 platform 문맥으로 등장
- port로 바로 해석하지 말고 **buffer / handoff platform** 여부를 먼저 확인해야 한다.
- 기사에서는 최신 CPU 제조의 약 180일 리드타임을 약 5일 줄일 수 있는 사례를 언급한다.

### 6. xMCS / MCP7 / SSS / FabScope / RemoScope
이들은 물리 구조물보다 **control/software layer**에 가깝다.

- `xMCS`: Material Control System
- `MCP7`: Main Control Processor
- `SSS`: Stocker Scheduling System
- `FabScope`: fab visibility/monitoring 계열
- `RemoScope`: remote monitoring/support 계열로 해석 가능

즉 scene ontology에서는 mesh object보다 시스템 메타데이터로 분리하는 것이 맞다.

## Daifuku 자료에서 읽히는 반도체 ontology

### 시스템 레벨
- AMHS = 반도체 fab 내 전체 반송 시스템

### Transport / Guideway
- Cleanway = OHT/overhead monorail 계열 transport system
- Rail / overhead monorail = guideway
- STB = guideway 주변 buffer/handoff structure

### Storage
- Clean Stocker = cleanroom AS/RS stocker
- Nitrogen purge stocker = 환경 제어형 stocker

### Interface / Tool Front
- load port는 일반 ontology 그대로 유지
- Daifuku 자료에서는 주로 transport/storage 쪽을 더 강조하고, EFEM 상세보다는 fab logistics 쪽에 무게가 있다.

### Control / Scheduling / Monitoring
- xMCS
- MCP7
- SSS
- FabScope
- RemoScope

이 층은 3D 구조 ontology와 별개로 **software/control layer ontology**로 분리하는 것이 좋다.

## 이미지/GLB 판독에 주는 시사점
- 천장 rail과 vehicle이 보이면 Daifuku식 `Cleanway` 계열 문맥을 먼저 떠올릴 수 있다.
- 큰 cleanroom 캐비닛이 보이면 `Clean Stocker` 후보로 볼 수 있지만, purge 여부는 별도 증거가 필요하다.
- rail 사이의 작은 대기/버퍼 구조는 `port`보다 `STB/buffer platform` 가능성을 먼저 체크해야 한다.
- Daifuku 자료는 저진동/청정성/고가동률 언어를 강하게 쓰므로, 구조 판독에서도 cleanroom 적합성 맥락을 같이 붙여두는 것이 유리하다.

## GitHub 조사 결과
- Daifuku의 반도체 cleanroom AMHS와 직접 연결되는 **공식 GitHub 저장소는 찾지 못했다.**
- 검색 결과 대부분은 Daifuku와 무관한 동명이인/별명 저장소이거나, 일반 semiconductor/amhs 시뮬레이션 저장소였다.
- 따라서 이번 정리는 **GitHub 코드 근거보다 Daifuku 공식 웹/리포트 자료를 우선 근거**로 삼는 것이 맞다.

## 이 프로젝트에 바로 적용할 해석
- `Cleanway` → editor에서 `Rail + overhead transport system` 계열 참조 개념
- `Clean Stocker` → `Stocker`
- `Nitrogen purge stocker` → `Stocker` + 환경 메타
- `STB` → `Port`로 단정 금지, `buffer/handoff platform` 후보
- `xMCS/MCP7/SSS/FabScope/RemoScope` → scene mesh가 아닌 control metadata 계층

## 현재 결론
Daifuku의 반도체 자료를 기준으로 보면,
당신의 editor ontology는 단순히 `Lift / Port / Stocker / Rail`만 보는 것보다 아래 2층 구조로 생각하는 것이 더 정확하다.

1. **물리 구조층**
   - Rail
   - Bridge
   - Stocker
   - Port
   - Lift
   - Vehicle/OHT(향후)

2. **제어/운영층**
   - MCS
   - controller
   - scheduler
   - monitoring/visibility

현재 editor는 1층만 다루고 있고, Daifuku 자료는 2층까지 강하게 강조한다.
