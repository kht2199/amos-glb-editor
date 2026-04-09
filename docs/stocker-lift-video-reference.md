# Stocker / Lift 동작 참고 메모

이 문서는 실제/제품 소개 동영상과 벤더 자료를 바탕으로, `glb-editor`의 demo scene 또는 후속 scene prompt를 만들 때
**스토커·리프트·OHT의 모양과 움직임이 어색하지 않게 보이도록** 핵심 형상을 텍스트로 정리한 메모다.

목적은 완전한 실사 재현이 아니라,
**영상에서 반복적으로 보이는 장비의 형상·축 방향·handoff 순서**를 scene 생성 프롬프트에 반영하는 것이다.

추가 기준:
- 현재 demo scene의 주연은 **층간 리프트와 상부/하부 포트 관계**다.
- 따라서 fab-wide OHT overview 장면은 보조 참고로만 쓰고,
- **upper port / lower port / vertical transfer**를 읽을 수 있는 장면을 우선 참고한다.

---

## 참고한 자료

### 1) TSMC’s Automatic Material Handling System (AMHS)
- URL: https://www.youtube.com/watch?v=K_B05zAMeAc
- 관찰 포인트
  - 천장 쪽에 **병렬 overhead rail**이 촘촘히 깔려 있음
  - rail은 직선 구간만 있는 것이 아니라 **곡선 junction / 90도 turn**이 있음
  - carrier/OHT body는 납작한 드론보다 **작은 박스형 또는 수직으로 약간 늘어진 하우징**으로 보임
  - 다른 프레임에서는 **알루미늄 프레임 기반의 stocker/lift demo cell**처럼 보이는 구조가 등장함
  - 중앙에는 **세로 lift bay**, 뒤에는 **반복적인 storage level**, 좌우에는 **handoff 또는 side module**처럼 보이는 구성이 나타남

### 2) Automated Material Handling Systems Solution (Semiconductor)
- URL: https://www.youtube.com/watch?v=1_Bv9BJE2lI
- 관찰 포인트
  - `N2 Purge Stocker`라는 라벨로 **stocker cutaway render**가 직접 등장함
  - stocker는 **길고 높은 직육면체 cabinet/tower** 형상
  - 내부에는 **white vertical lift carriage**가 있고
  - 측면에는 **여러 층의 storage slot / bay**가 반복됨
  - 상부에는 **top rail lattice / handoff zone**처럼 읽히는 구조가 있음
  - 이 장면은 `OHT top interface -> vertical lift -> side storage slot` 흐름을 텍스트로 정리하기에 적합함

### 3) AMHS for Semiconductor Fabrication Plant (Daifuku)
- URL: https://www.youtube.com/watch?v=XKXZT-BBUEE
- 용도 주의
  - 이 영상은 **층간 리프트 자체**보다 fab-wide OHT/guideway 문맥 참고용에 가깝다.
  - 따라서 upper/lower port 비교의 주 기준으로 삼기보다, rail/transport를 얼마나 보조적으로 둘지 판단할 때 사용한다.
- 관찰 포인트
  - 대규모 fab를 내려다보는 장면에서 **rows of white process tools** 위로 **overhead transport line**이 지나감
  - mainline OHT는 바닥 장비 사이를 다니는 AGV가 아니라 **상부 guideway를 따라 이동하는 ceiling logistics**로 표현됨
  - 즉, 장면을 만들 때 OHT/rail은 바닥 오브젝트보다 **위 레이어 문맥**으로 두는 것이 자연스러움

### 4) Muratec Carrier Stocker
- URL: https://www.muratec.net/cfa/products/stocker.html
- 텍스트 핵심
  - stocker는 clean room 안에서 **temporary storage shelves** 역할을 하며
  - 공정 완료 시점과 다음 공정 시작 시점 사이의 timing deviation을 흡수하는 buffer 역할을 함

### 5) MoveLink Intelligent Stocker
- URL: https://www.movelink.com/136.html
- 텍스트 핵심
  - stocker는 **multi-tier racks + stacker crane + intelligent control** 조합으로 설명됨
  - 핵심 키워드는
    - **high-density storage**
    - **precise positioning**
    - **rapid scheduling**
    - **24/7 stable operation**
  - 즉, 장면에서도 stocker는 단순 큰 박스보다 **고밀도 slot + 정밀한 수직 이동**이 느껴져야 함

---

## 비교 참고용 구간 인덱스

scene을 다시 만들거나 결과를 비교할 때, 전체 영상을 처음부터 끝까지 다 보지 않고도
빠르게 확인할 수 있도록 **필요한 구간과 이유**를 따로 적어둔다.

### 1) TSMC’s Automatic Material Handling System (AMHS)
- URL: https://www.youtube.com/watch?v=K_B05zAMeAc
- 우선 볼 구간
  - **초반부 mainline rail 장면 전후**
    - 왜 필요한가: overhead rail이 단선이 아니라 **병렬 lane / 곡선 turn / junction**으로 읽히는지 확인하기 좋다.
  - **중반부 stocker/lift demo cell처럼 보이는 장면 전후**
    - 왜 필요한가: 단순 OHT 라인만이 아니라, 중앙 vertical bay + 반복 storage level + side module 조합을 읽기 좋다.
- 비교 시 체크 포인트
  - rail이 바닥 lane처럼 보이지 않는가
  - carrier가 작은 suspended unit처럼 보이는가
  - vertical bay와 storage zone이 한 장면 안에서 같이 읽히는가

### 2) Automated Material Handling Systems Solution (Semiconductor)
- URL: https://www.youtube.com/watch?v=1_Bv9BJE2lI
- 우선 볼 구간
  - **약 0:35 전후**
    - 왜 필요한가: tall stocker cabinet와 내부 vertical carriage 인상이 가장 빨리 잡힌다.
  - **약 0:53 전후**
    - 왜 필요한가: `OHT top interface -> vertical lift -> side storage slot` 흐름을 압축해서 읽기 좋다.
- 비교 시 체크 포인트
  - stocker가 창고 rack가 아니라 cleanroom cabinet처럼 보이는가
  - 내부 carriage가 crane이 아니라 straight Z motion 장치처럼 보이는가
  - top handoff와 side slot rhythm이 동시에 읽히는가

### 3) AMHS for Semiconductor Fabrication Plant (Daifuku)
- URL: https://www.youtube.com/watch?v=XKXZT-BBUEE
- 우선 볼 구간
  - **약 1:00 전후의 fab overview 장면**
    - 왜 필요한가: OHT/rail이 장비보다 위 레이어의 ceiling logistics라는 점을 비교하기 가장 좋다.
- 비교 시 체크 포인트
  - OHT가 바닥 AGV처럼 보이지 않는가
  - white process tool rows 위로 guideway가 지나가는가
  - transport/rail이 upper-context infrastructure로 유지되는가

### 4) Muratec Carrier Stocker / MoveLink Intelligent Stocker
- URL
  - https://www.muratec.net/cfa/products/stocker.html
  - https://www.movelink.com/136.html
- 우선 볼 포인트
  - 제품 페이지의 대표 이미지 + 설명 텍스트
    - 왜 필요한가: 영상만으로 놓치기 쉬운 **temporary storage / high-density slot / precise vertical handling** 의미를 보강한다.
- 비교 시 체크 포인트
  - storage density가 느껴지는가
  - 정밀 자동화 cabinet 인상이 유지되는가
  - 단순 건물/벽체가 아니라 cleanroom storage equipment로 읽히는가

## 빠른 비교 순서 추천

새 scene을 만들고 비교할 때는 아래 순서가 가장 효율적이다.

1. **Automated Material Handling Systems Solution 약 0:35 전후**
   - stocker body / 내부 carriage / upper-lower vertical relation 확인
2. **같은 영상 약 0:53 전후**
   - handoff 흐름과 slot rhythm, 상부 인터페이스 확인
3. **TSMC의 stocker/lift demo cell처럼 보이는 장면 전후**
   - 층간 수직 bay와 주변 handoff 면 조합 확인
4. **Daifuku 약 1:00 전후**
   - OHT/rail이 upper context인지 확인하는 보조 비교
5. **Muratec / MoveLink 텍스트**
   - storage semantics와 용어 해석 교차검증

---

## 영상 기준으로 정리한 장비 형상

## 1) Stocker body
스토커는 보통 다음 특징으로 읽힌다.

- **높은 직육면체 타워/캐비닛**
- 가로보다 세로가 더 강조됨
- 내부를 보여줄 때는
  - cutaway
  - 투명 panel
  - front opening
  중 하나를 사용해 내부 lift와 slot이 보이게 함
- 외형은 cleanroom 장비답게
  - white / light gray / silver 계열
  - dark rail or slot frame
  - 과한 배관보다 깔끔한 panel형 표면
- 창고 건물처럼 보이는 것보다 **정밀 자동화 cabinet**처럼 보이는 것이 더 맞음

scene prompt에는 이렇게 반영하는 것이 안전하다.

- “tall rectangular cleanroom stocker cabinet”
- “multi-level storage bays visible behind transparent or open front structure”
- “precise industrial enclosure, not warehouse shelving for humans”

## 2) Internal lift / elevator carriage
리프트는 영상에서 다음 특징으로 읽힌다.

- stocker 내부의 **central or near-central vertical carriage**
- **guide column / mast / rail**을 따라 Z축 이동
- 완전 노출된 와이어 호이스트보다는
  - frame-guided carriage
  - elevator-like platform
  - shuttle carriage
  에 가까운 인상
- slot 깊숙이 길게 팔을 뻗는 로봇보다는
  - **짧은 handoff shelf / fork / platform**
  - 또는 carriage 앞면에 붙은 transfer stage
  로 보이는 경우가 많음

scene prompt에는 이렇게 쓰는 편이 좋다.

- “white vertical lift carriage guided by twin rails”
- “short horizontal transfer shelf attached to the lift carriage”
- “precise elevator-like motion, not swinging crane motion”

## 3) Storage slot / bay
slot은 단순 선반보다 아래 특징이 중요하다.

- **높이가 규칙적으로 반복되는 multi-level bay**
- 각 slot은 사람 물건 선반처럼 크고 거친 구조가 아니라
  - compact
  - uniform
  - FOUP 단위가 들어갈 정도의 반복 슬롯
- stocker의 밀도를 보여주는 핵심 요소는
  - 큰 장식이 아니라 **반복되는 level rhythm**이다

scene prompt에는 이렇게 반영 가능하다.

- “dense repeating storage slots stacked vertically”
- “uniform FOUP-sized bays with clean spacing”

## 4) OHT / rail / guideway
영상에서 overhead transport는 아래처럼 반복된다.

- 천장 또는 상부 layer를 따라 이동하는 **overhead rail network**
- rail은 한 줄보다
  - parallel lane
  - dual line
  - beam + support 구조
  로 보일 때가 많음
- 중요한 특징은
  - **직선 구간**
  - **곡선 junction**
  - **분기 또는 turn**
- carrier는 rail 아래에 붙은 **작은 boxy suspended unit**로 읽힘

scene prompt에는 이렇게 쓰면 좋다.

- “ceiling-mounted overhead rail with a gentle 90-degree turn”
- “compact suspended OHT carriers gliding above the equipment”
- “guideway as upper-context infrastructure, not a ground vehicle lane”

---

## 영상 기준으로 정리한 동작 순서

실제 장면을 압축해서 표현할 때 가장 자연스러운 순서는 아래다.

### A. Mainline transit
1. OHT carrier가 ceiling rail을 따라 수평 이동
2. stocker 또는 lift access zone 근처에서 감속/정지
3. mainline 자체는 계속 상부 문맥으로 유지

### B. Top handoff
1. carrier가 stocker 상부 interface 또는 접근 rail에 도달
2. handoff는 rail 위를 달리면서 바로 slot에 꽂는 느낌보다
3. **상부 접근점에서 정렬 -> lift가 받음** 흐름이 자연스러움

### C. Vertical transfer
1. internal lift carriage가 target level로 **Z축 이동**
2. 이동은 흔들리는 crane보다 **elevator-like straight motion**
3. carriage는 특정 level에서 정밀 정지

### D. Short horizontal insert/retrieve
1. carriage 또는 짧은 transfer stage가 slot 방향으로 짧게 이동
2. 저장/인출 후 다시 carriage 중심 위치로 복귀
3. 필요 시 다시 상부 handoff 지점으로 올라감

즉, scene을 만들 때는 **긴 대각선 팔 동작**보다
**수직 정렬 + 짧은 수평 handoff**가 더 자연스럽다.

---

## scene 생성에 바로 쓸 수 있는 형상/동작 규칙

## 꼭 살릴 것
- stocker는 **높은 vertical cabinet/tower**로 보이게 할 것
- 내부에는 **multi-level slot rhythm**이 보이게 할 것
- lift는 **중앙 또는 준중앙 vertical carriage**로 보이게 할 것
- handoff는 **짧은 수평 transfer stage** 느낌으로 표현할 것
- overhead rail은 **상부 문맥 레이어**로 둘 것
- 가능하면 **직선 rail + 하나의 곡선/turn**을 같이 넣을 것
- 장면 한눈에 봤을 때
  - “위에서는 운반”
  - “안에서는 수직 정렬”
  - “슬롯에는 짧게 넣고 뺌”
  이 읽혀야 함

## 피할 것
- stocker를 일반 물류창고 rack처럼 너무 거칠고 크게 만들기
- lift를 엘리베이터 문 달린 건물용 승강기처럼 만들기
- handoff를 길고 복잡한 다관절 로봇 팔 중심으로 만들기
- OHT를 바닥 AGV처럼 표현하기
- 배경 구조물이 핵심 lift/stocker 관계를 가리게 만들기
- scene의 주제가 cleanroom shell이나 건물 벽처럼 보이게 만들기

---

## glb-editor demo scene에 맞춘 압축 해석

`glb-editor`는 full fab simulator가 아니므로 아래 수준으로 압축하는 것이 적당하다.

- **Stocker 1개**
  - tall rectangular body
  - front/open or semi-transparent cutaway
  - side/front에서 몇 개의 slot rhythm만 보여도 충분
- **Lift 1개 또는 stocker 내부 lift 표정**
  - vertical motion 메타데이터가 드러나면 좋음
- **Port 1개는 stocker access 의미를 강하게 드러내기**
  - stocker 바로 앞 또는 side access 위치
- **Rail/Transport는 상부 guideway 문맥만 제공**
  - 과도한 rail network 재현은 불필요
- **Bridge/Rail은 read-only context**
  - 핵심은 stocker-lift-port 관계를 설명하는 보조물

---

## 장면 생성용 권장 서술

아래 문장은 scene 결과를 만들 때 그대로 가져다 쓰기 쉬운 형태로 정리했다.

### 짧은 버전
- tall rectangular cleanroom stocker cabinet
- internal white vertical lift carriage guided by rails
- dense repeating FOUP-sized storage bays
- short horizontal transfer shelf at the lift carriage
- ceiling-mounted overhead rail with one straight segment and one gentle turn
- compact suspended OHT carrier approaching the stocker handoff zone
- precise elevator-like Z motion, not swinging crane motion
- stocker/lift/port relation visually clearer than background shell

### 상세 버전
A compact domain-aware demo scene for a Lift/Port editing tool, using a tall cleanroom stocker cabinet as the primary storage context. The goal is not to reproduce a full AMHS, but to make the stocker-lift-port relationship immediately readable in a low-poly sample. The stocker should read as a precise automated enclosure rather than a warehouse shelf, with a vertical emphasis, light gray and white industrial panels, and a partially open or semi-transparent face that reveals the inner mechanism. Inside the stocker, show a white elevator-like lift carriage guided by twin rails or guide columns, moving straight along the Z axis. Along the storage side, show dense repeating FOUP-sized bays stacked at regular intervals so the vertical storage rhythm is obvious. The handoff should look like a short horizontal transfer shelf or platform attached to the lift carriage, not a long articulated robot arm. Above the stocker, include a ceiling-mounted overhead rail as upper-context infrastructure, with one short straight segment and one gentle turn, kept minimal since rail is upper-context only. A compact boxy OHT carrier may be shown near the top interface, implying the sequence: overhead arrival, top handoff, vertical alignment, short horizontal insert into a slot. Keep the stocker, lift, and access port visually dominant, while rail, bridge, and cleanroom shell remain secondary context. This is a low-poly editing sample, not an AMHS marketing render — keep geometry simple and let metadata carry the domain meaning.

---

## demo-scene/prompt 반영 포인트

기존 demo scene prompt에 아래 해석을 추가하면 결과가 더 안정적이다.

1. Stocker는 단순 박스가 아니라 **vertical storage body**로 읽혀야 한다.
2. Lift는 외부 standalone 장비뿐 아니라 **stocker 내부 transfer logic**과도 연결되는 인상이어야 한다.
3. Port는 단순 node보다 **handoff point**처럼 보여야 한다.
4. OHT/rail은 바닥 교통수단이 아니라 **ceiling logistics context**로 보여야 한다.
5. 장면이 과도하게 복잡해지면 전체 rail network보다
   - stocker body
   - lift carriage
   - top handoff hint
   - access port
   이 4가지를 우선 보이게 한다.
