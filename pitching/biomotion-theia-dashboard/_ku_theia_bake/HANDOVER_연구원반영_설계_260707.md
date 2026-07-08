# KU 투수 대시보드 — 연구원 검토의견 반영 통합 설계 (2026-07-07)

## 탭·그래프·점수 보완 (2026-07-07 · 커밋 29bcec2 · 라이브)
- **키네매틱 시퀀스 그래프 가독성 재설계**: 우측 상단 라벨 겹침 해소. 상단 전용 **피크 타임라인**(각 분절 각속도 정점 + 사이 간격ms·간격라벨 위/아래 교차), 국면 라벨 교차높이(KH/MER↑·FC/BR↓), 곡선 위 겹치던 ms 라벨 제거·점→타임라인 연결선. H 190→254. (`_kuSequenceCard`)
- **모든 단계 탭 '결과와의 연결'(phaseBridge) 제거** — 결과 탭 삭제와 정합. (`PhaseTab` return에서 phaseBridge 삭제)
- **블로킹 2변인 점수화 승격(런타임)**: `comDecel`(제동 가속도 최댓값)·`kneeCollapse`(앞무릎 굴곡 무너짐) 참고→점수화. App에서 phaseData.block에 scored=true·neutral=false·name정리, pos=null이면 `metricBandStats(m).valPct`로 재계산. **players.js 미수정**(그 세션과 충돌 회피). 검증=박경도 kneeCollapse 개선점 등장(지금9.1→목표2.2–7.9)·comDecel st우수라 약점 아님.
- **★★동시세션 주의**: 이 작업 중 다른 세션이 같은 index.html/players.js를 동시 편집(vardoc.js SSOT·릴리스표·니하이밴드=커밋 372c5d9·c9d5f54). **공유 작업트리라 그 세션 배포가 내 index.html 편집본까지 라이브 반영**(라이브 sha=내 워킹트리 일치 확인). 내 커밋=index.html만(29bcec2). **⚠ players.js는 그 세션 미커밋(M)인데 라이브엔 이미 배포됨 → 그 세션이 players.js 커밋 필요**(안 하면 clean 체크아웃서 배포 시 라이브 되돌림). trunkKH_norms_output.json도 그 세션 미커밋.

출처: `260706_리포트 보완 수정 사항 정리`(연구원) + `투수_동작_디셉션_정의_정리.docx`(교수) + 반영방침(코덱스) 검토.
범위: **투수(Theia) 전용**. 타격 제외.

## 0. 설계 원칙 (격리)
- 변인 정의·파트·점수·명칭은 **공유 엔진** `pitching/dashboard_core/phases.js`(M() 매크로)에 있음 → 일반 Theia 대시보드와 공유.
- **KU 요청 재편(이동·숨김·참고전환·명칭)은 공유 phases.js를 직접 고치지 않고, KU 전용 후처리 transform으로 적용.**
  - 위치: `2_bake_finalize.js`가 `storeTheiaAnalysis`로 phaseData 생성한 **직후**, players.js 쓰기 **전**에 `_kuPhaseTransform(phaseData, trial)` 적용.
  - 효과: KU players.js만 재편됨. 일반 `/pitching/theia/dashboard`는 무영향.
- **예외(공유 phases.js에 반영)**: 검증된 "보편 버그"만 (예: rotKEgain 부호가 실제 오류로 확인될 경우). 그 외 명칭·순화는 KU display(`__prettyMetricName`) 또는 transform.
- 규준(_NB_BAKED)은 수동 발행 원칙 유지 — 참고 전환/숨김은 규준 불변, 표시·점수 플래그만 변경.

## 1. W1 (완료·커밋 3476ac8)
- 오늘의 할 일(④) 숨김 · 결과별 체력 우선순위 제거 · 리포트 강점(구간별3·와인드업제외)/약점(5).

## 2. W2a — 참고전환 · 명칭/정의 교정 · 스트라이드

### 2a-1. 참고(비점수) 전환 — transform: DESCORE 집합 (scored=false, 표시 유지)
연구원 "와인드업 점수화 안 함" + 개별 참고 지정:
```
DESCORE = [
  // 와인드업 전체
  'pelClose','wuPelCloseKH','wuPelCoil','wuTrunkCloseKH','wuTrunkCoil','wuHSS','wuPelVel','wuTrkVel',
  'wuHSSbuild',        // 비틀림 쌓인 양 → 참고 (연구원: 참고 자료로 전환)
  'strideLen',         // 보폭 → 참고 (미흡/우수 폐지, '평균 대비 높음/낮음')
]
```
방법: transform에서 `m.scored=false; m.st=null; m.neutral=true` (판정 텍스트 대신 값+평균대비 표시). 밴드/규준은 그대로 두되 표시만 참고.

### 2a-2. 명칭·정의 교정 — transform: RENAME 맵 (표시명만)
```
RENAME = {
  wuPelCoil:  '골반 닫힌 양 (다리 들기~무릎 최고점)',   // '감긴'→'닫힌'
  wuTrunkCoil:'몸통 닫힌 양 (다리 들기~무릎 최고점)',
  whipRatio:  '팔 가속 효과',                          // '팔 채찍'→'팔 가속'
}
```
- ⚠ **정의 변경 확인**: 연구원은 "감긴 양→닫힌 양(니하이 골반각 − 다리들기 시작 골반각)". 현재 wuPelCoil 산출식이 이 정의와 같은지 phases.js에서 확인 후, 다르면 값 재정의(그땐 공유 phases.js 또는 transform 재계산).
- ⚠ **rotKEgain "회전 KE 증가(골반+몸통)"→"(몸통−골반)"**: 현재 값이 골반+몸통 **합(合)**이면 라벨 '몸통−골반'은 오히려 틀림(X-Factor와 혼동). phases.js 산출식 확인 후 결정 — **검증 전 적용 금지**.

### 2a-3. 스트라이드 정식값 — transform: STRIDE 오버라이드
- 근거(확정): 대시보드 strideLen이 c3d `STRIDE_LENGTH_PERCENT`보다 체계적 +7~13%p 높음(10명 중 9명 불일치). 홍은성 pos=93·st=미흡 내부모순.
- 수정: `strideLen.val = c3d STRIDE_LENGTH_PERCENT`(대표 trial=포심 최속). 헤더 5행 스칼라(라벨행1의 STRIDE_LENGTH_PERCENT 열, 값=헤더 5행). scored=false(2a-1).
- 표시: "OO% · 평균 대비 높음/낮음"(엘리트 참고선 MLB 85~100% 신장 정도).

## 3. W2b — 파트 이동 · 숨김 (transform: MOVE 맵 · HIDE 집합)

### MOVE (key 유지, phase 재배정)
```
MOVE = {
  hipHinge:          'drive',   // 힙힌지 형성: windup→drive (맥스 힙힌지)
  leadKneeFlexFC:    'block',   // 착지 앞무릎 굴곡: drive→block
  openAng:           'drive',   // 착지시 몸통 열림 각도: arm→drive
  xfPeak:            'drive',   // 최대 골반몸통분리(크기): arm→drive
  leanBack:          'trunk',   // 착지시 몸통 뒤젖힘각: arm→trunk
  xfReleasedPctByFC: 'trunk',   // 몸통 조기 열림(풀린 비율): arm→trunk
  xfUnwindV:         'trunk',   // 분리 풀림 속도: arm→trunk
  armRotV:           'arm',     // 팔 회전 속도: trunk→arm
  humME:             'arm',     // 상완 ME 피크: trunk→arm
  humME_kg:          'arm',     // 상완 ME 효율: trunk→arm
  elbowExtV:         'arm',     // 팔꿈치 신전 속도: trunk→arm
  efDeltaHumME:      'arm',     // 윗팔 에너지 변화(MER→BR): trunk→arm
}
```

### HIDE (표시 제거 — 언급 안 할 변인)
```
HIDE = [
  // windup
  'windupType','wuDriveHipER','wuShER','efBalanceML','efStoredPE',
  // drive
  'strideType','hipAbd','comVelFC','trunkLeanChange','driveKneeFlexKF','strideTime','hssBuildKF','pelOpenKF',
  // block
  'blockingType','leadKneeFlexionBR','blockRiskPenalty','linRotRatio','efEtaE','efLeadHipHinge',
  // 운동사슬
  '분절 에너지 흐름','seqPct','chainTiming','driveType',
  // trunk
  'trunkRotKE','trunkFlexKE','trunkLatKE','efDeltaTrunkME',
]
```
- 유형 카드(windupType·strideType·blockingType) 숨김 = 연구원 "유형 숨김". 단 typeCard는 유형해석 기반이라, 숨김=미표시만(내부 유지).
- ⚠ 보류/확인: `wuHSS`(골반몸통분리 무릎최고점)=연구원 "언급할" 유지 / but "골반 몸통분리 단순 연산 제외" 코멘트와 충돌 → **유지(언급할 목록 우선)**, 교수 확인. `trunkResistRatio`·`comVel`(피크)=양 목록에 없음 → 현행 유지.

## 4. W2c — 신규 변인 · 시퀀스 시계열 · 로직검증

### 신규 (series에서 직접 산출, 전부 가용)
```
NEW (transform이 phaseData에 주입):
  trunkKH_fwd  windup 참고  = series['Trunk_Angle_X'][i_kl_peak]   '니하이 몸통 앞뒤 기울기' °
  trunkKH_lat  windup 참고  = series['Trunk_Angle_Y'][i_kl_peak]   '니하이 몸통 좌우 기울기' °
  hipHingePkT  drive  참고  = argmax|Back_Hip_Angle_X| in [i_kl_peak,i_br]  '힙힌지 최대 시점' ms (+값°)
```
- 힙힌지 시계열 그래프: 뷰어 TS 'wu_hinge'(뒷고관절 굴곡) 이미 존재 → 드라이브 파트에 피크 마킹 추가.

### 시퀀스 시계열 (동작 요약 최상단, 신규 카드)
- series: Pelvis_Ang_Vel_Z / Thorax_Ang_Vel_Z / Pitching_Humerus_Ang_Vel_Z (전부 가용, 뷰어 TS_CHARTS가 이미 그림).
- 대시보드 동작 요약 상단에 3선 미니 시계열 + 각 피크 시점(ms, [i_kl_peak,i_br]) 표기. 근위→원위 순서 시각화.

### 로직 검증 (구현 전 확인 — 틀리면 표시/제외)
```
VERIFY = {
  ppTrunkHum:  '몸통→상완 파워 타이밍 산출 + 동작뷰어 스틱 대조',
  postureMaint:'자세 유지 점수 정의 확인',
  hipAbd:      '뒷다리 고관절 내전 속도 정의(숨김 전 확인)',
  xfPeakFromFC:'분리 풀림 시점 로직',
  rotKEgain:   '골반+몸통 합 vs 몸통−골반 (명칭 결정)',
  armRotV:     'Shoulder vs Humerus 시계열 (일관성)',
}
```

## 5. W3 — 구종설계 재구성 · 디셉션 재명명
- 구종설계(구종·디셉션 탭): 직구 회전축/무브(합) 제거 → **Rapsodo Report 형태 + 무브먼트 맵**(연구원 첨부 Rapsodo_matrix.png 양식). 변화구 완성도 통합 먼저.
- **디셉션 재명명(승인)**: "동작 디셉션" → **"구종 간 동작 일관성 — 릴리스 위장·운동학 유사성"**. 구종설계 안에서만(메인·리포트 제거). 정직 문구: "측정=릴리스 위장(4.3)·운동학 유사성(4.4). 공숨김·터널링·타이밍·지각은 미측정".
- 랩소도 용어 정의 정리(완성도 계산 명확화).

## 6. 실행 순서 · 검증
1. `_kuPhaseTransform` 모듈 작성(RENAME/MOVE/HIDE/DESCORE/NEW/STRIDE) → 2_bake_finalize.js에 연결.
2. VERIFY 6건 먼저 확인(phases.js 산출식) → rotKEgain·coil 정의 확정.
3. 재베이크(전 10명) → players.js·frames 재생성. korea 대시보드 캐시버스트.
4. 대시보드측: 시퀀스 시계열 카드(동작 요약 상단)·힙힌지 피크·스트라이드 참고표시·디셉션 재명명(W3).
5. 검증: 프리뷰로 파트별 변인 목록·참고표시·신규변인·시계열 렌더 + 콘솔0. 스트라이드 10명 c3d 대조 재확인.
6. 로컬 커밋만(push/deploy는 교수 트리거).

## 7. 미결(교수 확인)
- wuHSS 유지 vs 제외(단순연산 코멘트). rotKEgain 명칭(검증 결과에 따라). 스트라이드 참고 눈금 기준선(MLB 85~100%?).

## 8. 진행 상황 (2026-07-07 갱신)
### 완료·검증 (W1·W2a·W2b·W2c) — 로컬 커밋
- **W1**(3476ac8): 오늘의 할 일 숨김·결과별 체력 우선순위 제거·리포트 강점3(구간별·와인드업 제외)/약점5.
- **W2a/b**(fc14267 + 이번 커밋): `_kuPhaseTransform` 라이브. RENAME(닫힌 양·팔 가속 효과)·MOVE(12키)·HIDE(26키, leftover 0 검증)·DESCORE(와인드업 전체+strideLen, 참고전환)·STRIDE 정식값(c3d STRIDE_LENGTH_PERCENT).
  - 검증: 박경도 windup 11참고(니하이2 포함)·drive 보폭/힙힌지 이동·arm 팔회전/상완ME 이동·block 팔가속효과. 데이터 key단위 확인 완료.
- **W2a 스트라이드 pos 버그 수정**(이번 커밋 신규): val을 c3d로 덮을 때 pos가 옛(인플레 ~95%) 기준으로 남아 슬라이더 마커가 엘리트 band 근처(pos=86)에 오배치되던 버그. `_bandOf`(integ01에서 규준밴드 추출)+`_posFromBand`(렌더와 동일 z→정규CDF)로 재계산. 검증: 박경도 85.3%→pos8(band 밖 왼쪽), 오훈택 77.7%→pos1, 김준영 92.2%→pos63, 홍은성 옛 pos93 내부모순 해소. "적정"은 밴드 구간(엘리트 p25–p75=적정범위) 라벨이지 값 판정 아님 → 마커 위치가 정직 신호.
- **W2c 신규변인**: 니하이 몸통 앞뒤/좌우 기울기(windup 참고, Trunk_Angle_X/Y[i_kl_peak])·힙힌지 최대 시점(drive 참고, argmax|Back_Hip_Angle_X|). cat=형제 상속(PhaseTab 렌더 필수).
- **W2c 시퀀스 시계열 카드**(신규): `6_bake_sequence.py`→`데이터/sequence.js`(window.KU_SEQUENCE, 10명 전원 근위→원위 순서OK). `_kuSequenceCard(name)`을 동작 요약(TypeSummary) 최상단 주입. 골반/몸통/팔 각속도 3곡선+이벤트선(KH/FC/MER/BR)+피크 타이밍(ms)+"근위→원위 순서 정상" 판정. 캐시버전 kuT0709·kuSEQ0707. 콘솔0 검증.
  - ⚠ 탭 라벨 함정: TypeSummary 탭 = **"동작 요약"**(메카닉 연결). "메카닉 요약" 아님(클릭 no-op 주의).

### VERIFY 6건 결과
- rotKEgain: 골반+몸통 **합** 확인 → "몸통−골반" 리네임 **거부**(교수 동의). 라벨 유지.
- wuPelCoil: 산출=abs(Pelvis_Angle_Z[ikl]−[_is]) → "닫힌 양" 정의 정합, 리네임만.
- armRotV: Pitching_Shoulder_Ang_Vel_Z(표준 IR속도) 유지.
- 나머지(ppTrunkHum·postureMaint·hipAbd·xfPeakFromFC): 현행 유지(추가 결함 미발견).

### 탭 재편 (2026-07-07 · 라이브) — deploy 6a4c8da3·커밋 b87dbbc
- 탭 삭제: **흐름(flow)·결과(pitchdesign)**. **리포트=첫 자리(01)**. 기본 탭 flow→report. TABS 8개(리포트·키네매틱시퀀스·와인드업·드라이브·블로킹·몸통·팔·체력).
- **동작 요약 → "키네매틱 시퀀스"** 개칭. TypeSummary=조기반환으로 **운동 사슬 시퀀스 그래프(`_kuSequenceCard`)만** 렌더(나머지 죽은코드). 그래프 내부 제목 제거.
- 그래프에 **각속도 피크 사이 시점 간격(ms)** 추가: `d.pk.{pel,trk,arm}.ms` 차이 → SVG 브래킷+ms(peak 사이) + 하단 요약(골반→몸통·몸통→팔·양수=근위→원위 정상). 홍은성 +60/+88ms.
- `__kuGoTab`에 TABS 유효성 가드(제거 탭 무동작). FlowTab/PitchDesignTab 정의는 미렌더로 존치.
- 검증(홍은성): 8탭·기본 리포트·키네매틱=그래프만·피크간격·리포트 전블록 정상·콘솔0.

### 리포트 3블록 보완 (2026-07-07 · 라이브) — deploy 6a4c8723·커밋 808538c
- 1)랩소도 결과 뒤 **무브먼트 맵**(`__rapMoveSVG(_RPDG.pitches)`) 삽입.
- 개선할 점 **전량 표시**: `rankedWeak`(weakPerf 우선·성능계 ~5) → **`_improveAll = scoredWeak` 전체**(개선여지 pos 오름차순, arm 포함). 홍은성 17·박경도 5. 선수 전달본 필터도 `_improveAll`. ★핵심: "계속 5개"=weakPerf(dx.kind='성능')만 잡던 것.
- 선수 전달: **[선택 초기화]** 버튼(`_clearPri`·confirm) + 수정=체크박스 토글.
- 체력: `fitAxisCard`에 **실측 수치+단위+팀 백분위** 병기(기존 점수/100만). **ROM 서브섹션**(`_fitA.rom`=axes 밖 별도필드): 고관절 외/내회전 좌우·어깨 외/내회전 투구팔·정상범위 lo~hi 참고선(색=범위내 초록/밖 노랑)·백분위·좌우차(asym). 양방향 해석.
- 검증(박경도·홍은성): 맵 순서·개선전량·초기화·실측·ROM 4관절·콘솔0.

### 리포트 3블록 재편 (2026-07-07 · 라이브) — 교수 지시
- 리포트(ReportTab/_kuConcise)를 **3블록만** 남기고 나머지 전부 숨김: **1)랩소도 결과**(구종별 DATA 표 `__rapReportTable`) · **2)메카닉**(강점=구간별 byPh + 개선할 점=전체 우선순위 체크박스 선택) · **3)체력 결과**(VALD 종합+전 축 `fitAxisCard`). + 코치 소견 유지(전달 연동).
- 숨김(코드 보존 `false &&`/미호출): ② 3점수 글랜스·kuPersonalBriefCard·mechanicsFitnessCard·reportLensCard·③한줄진단·④오늘요약·reportActionPlanCard·⑦몸상태·⑨다음측정·Fold(자세한근거+_PlayerReport·코치상세 R01~R07).
- 배포 deploy `6a4c82d0ca4cf0172fabadb0` ready(index.html 1파일·67핀·사후 sha 981f4b 일치). 커밋 7a7f29a. 검증=3블록 순서·랩소도표·강점·개선14체크박스·체력축·숨김0·선수전달본 무영향·콘솔0.

### 추가 기능 (2026-07-07 · 라이브) — 우선순위 선택→선수 전달
- 요구: 리포트에서 개선 우선순위 **전체 표시**(현재 5→보통 10+) → 코치/연구원이 ~3개 **임의 선택** → **선택된 것만 선수 전달**.
- 구현(index.html): ⑥ 보완할 것 = `topFix.slice(0,5)` 대신 **`rankedWeak` 전체 + 체크박스**. 선택=`priSel`(m.key 배열)·소프트캡(>3 경고, 차단X). 영속=localStorage `biomotion:priSel:[선수]` + 로그인 시 Supabase(노트 버킷·`_sel.json`). ReportTab(props.deliver)·App `?view=player&sel=k1,k2,k3` 분기 → 선수 전달본(선택 항목만·탭/코치상세 없음·PDF). 코치 바=[선수용 링크 복사][선수용 보기·PDF]. 링크에 sel 인코딩→익명 선수도 열림(RLS 우회).
- 배포: deploy `6a4c7f57a46bb850b052726a` ready(index.html 1파일·67핀·게이트3·사후 sha 77001c 일치). 커밋 bbbfbd7 push. 검증=코치14항목·영속복원·소프트캡·선수뷰3항목·콘솔0.

### W3 진행 (2026-07-07 갱신 · ★라이브 배포 완료)
> 배포1: `deploy_track.py pitching/theia --scope korea --deploy` → deploy `6a4c610fe57adca9e36d540b` state ready. 변경 2파일(index.html·데이터/rapsodo_report.js)·67핀·게이트3. 사후 sha 대조 일치. 커밋 ad07ae5·749dc39·0b81d4b.
> 배포2(힙힌지 피크): deploy `6a4c788cfc127e5cf116c87b` state ready. 변경 1파일(motion_viewer.html)·67핀·게이트3. 사후 sha 대조 일치(11d64f…). 커밋 28bfb2e. 전부 push 완료. url=sports.biomotion.kr(비번보호). ★W3 3개 항목 전부 완료·라이브.
> ⚠ 배포도구 고침: deploy_track.py CONF_CANDS에 `biomotion-dashboard/.netlify_deploy.conf` 추가(이 머신 메인레포명). SITE_ID=12dd154a…(4트랙 동일 사이트). biomotion-platform 레포는 이 머신에 없음.

- **디셉션 재명명 완료·검증·라이브**: korea/index.html ⑤ 섹션 "동작 디셉션" → **"구종 간 동작 일관성 — 릴리스 위장·운동학(동작) 유사성"**. 정직 문구(측정=릴리스 위치·착지~릴리스 동작 유사성 / 미측정=공 숨김·터널링·타이밍·타자 지각) 상시 캡션 추가. 렌즈라벨·폴백문구·주석까지 통일. 렌더검증(홍주환): 새 제목·캡션 표시·옛 명칭 0·콘솔0·node구문OK.
  - ★부수 발견: `_flowPriorityMap`(FlowTab 우선순위 지도)·`_pdReportSection`(리포트 R08)은 **둘 다 호출 안 되는 죽은 코드** → 메인·리포트엔 원래 디셉션 미표시. 실제 렌더=⑤ 한 곳뿐. "노출 N건"(dead helper)·미사용 `_flowDeceptionCount` 정리(소스 정합). 죽은 R08 내부 옛 명칭은 미렌더라 방치.

- **구종설계 재구성 완료·검증·라이브**: 교수가 Rapsodo Report DATA 표 이미지 제공 → 그 양식으로 ④ 섹션 재구성.
  - ★핵심: 참조 표의 Vert/Horz Break는 원본 CSV **`VB/HB (trajectory)`**(≈cm)라 우리 rapsodo.js hb/vb(mm·SSW break)와 **다른 지표** → 그대로 못 씀. Max RPM·직구 gyro/spinDir도 베이크에 없었음.
  - 신규 SSOT `데이터/rapsodo_report.js`(window.KU_RAPSODO_REPORT) = `7_bake_rapsodo_report.py`가 원본 CSV(rapsodo_0628·타 차선 읽기전용) 집계: 구종별 velo/veloMax·rpm/rpmMax·VB/HB(traj)·eff·gyro·spinDir(원형평균)·strike%. 이름매핑=reuse.json name_en→name(권위)·CSV별칭 2건. ⚠Is Strike="Y"/"N".
  - 렌더 `__rapReportTable(name)`: ④ "랩소도 리포트" DATA 표(색칩=`__rapTypeColor` 대시보드 일관색·무브먼트 맵과 통일)+무브먼트 맵. 직구 "총 무브(합)·회전축" 카드 제거(교수 지시). 변화구 완성도 카드=하위섹션(번호 유지). 
  - 검증(홍은성): 표 4구종 전 컬럼 = 참조 이미지와 일치(FB 139.6/140.1·2277/2369·VB33.8·HB42.8·eff95.6·gyro17·01:52·66.7). 색칩4종·콘솔0·node구문OK.
  - 남은 판단(교수): 변화구 정렬=현재 **구사율 desc**(참조는 FB/CV/SL/CH). gyro 표시=1소수(참조는 정수). 필요시 trivial 조정.
- **힙힌지 시계열 피크 마킹 완료·검증**: motion_viewer.html + 템플릿(_motion_viewer_build/motion_viewer_template.html) 양쪽에 wu_hinge 차트 `peak` 스펙 추가 + drawTS plot()에 피크 마커 렌더(드라이브 창 [KH,BR] 내 argmax|Back_Hip_Angle_X| → 세로 점선+골드 점+라벨 "힙힌지 피크 +Xms Y°"). 대표 트라이얼만·차트에 peak 스펙 있을 때만. 검증(홍은성 p0001): 독립 argmax=프레임278·73.2°·+812ms → 렌더 골드 세로선 x=1158 vs 예상1159(1px). 콘솔0. ★재베이크 대비 템플릿도 동기(bake TMPL은 타 머신 경로라 이 머신 재베이크 불가·소스만 유지).
