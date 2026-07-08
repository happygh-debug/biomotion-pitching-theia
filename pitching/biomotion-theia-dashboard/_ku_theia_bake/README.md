# 고려대 전용 Theia 투구 대시보드 — 베이크 파이프라인

지면반력 제외 Theia 마커리스 기반. 측정일: 2026년 6월 28일. 데이터: `korea_20260628_theia.zip`(10명·c3d 각도 txt·지면반력 없음).

## 흐름
1. `1_ku_setup.js` — KU Uplift 코호트(ku_cohort.js) 2026년 6월 28일 세션에서 이름/손/키/체중/velo_summary/hp_assessment 추출 → `reuse.json`. + 데이터 zip을 `data/{folder}/theia/*.txt`로 전개, meta.json 작성.
2. `2_bake_finalize.js` — Theia 실엔진(parseC3DTxt→extractTrial→reportData.assemble→phases.compute→BM_INTEG01.storeTheiaAnalysis)로 10명 베이크 → phaseData. **지면반력 없음 처리**: val==null & !scored 항목 제거(오해석 방지). 블로킹은 코드 내장 키네마틱 대체(comVelReductionFCBR·leadKneeVelPk 등)로 채점. 출력: `netlify_통합배포/pitching/theia/korea/데이터/{players,normative_velo,fitness}.js`.

## 페이지
`korea/index.html` = 일반 Theia dashboard/index.html 복사 + 스크립트 재배선(공유 엔진=../dashboard/, KU 데이터=데이터/) + 상단 배너 + FlowTab의 지면반력/소표본 배지. 랩소도·체력=KU Uplift 2026년 6월 28일 동일 세션(velo_summary=max구속만, hp_assessment 6축).

### 결과 렌즈 로직(result-lens-v1)
`korea/index.html`의 `PitchDesignTab` 안에서 실제 계산한다. 단순 문구가 아니라 데이터 기반 산출 모델이며, 재생성 시 보존 필요.

- `pdResultModel(name, d, R)`가 단일 진입점이다.
- 포심 구속: `pdFastballLens`가 Rapsodo Fastball 최고/평균/SD/스트라이크%만 사용한다. 변화구 구속은 포심 구속 점수에 섞지 않는다.
- 제구/존: `pdCommandLens`가 스트라이크%, 전체 산포, 구종별 산포를 조합한다. 목표 코스 데이터가 없으므로 true command가 아니라 zone/repeatability lens다.
- 변화구: `pdOffspeedLens`가 무브먼트, 포심 대비 속도차, 회전효율/자이로, 존%, 디셉션 결함을 조합한다.
- 에너지 흐름: `pdEnergyFlowModel`이 phaseData 단계 충족률을 windup 0.10 / drive 0.25 / block 0.30 / trunk 0.25 / arm 0.10으로 가중한다. 이 값은 포심 구속 원인 점수가 아니라 출력 전달 결함 후보 점수다.
- UI 해석: `pdLensScore`는 80점 이상=우수, 62~79점=양호, 62점 미만=점검으로 표시한다. 점수 문구만 바꾸는 것이 아니라 포심/제구/변화구 카드와 `pdActionPlanHTML`의 주간 실행 계획에 실제 계산값을 연결한다.
- 포심 섹션: 변화구 구속은 제외하고 포심 최고/평균/SD/스트라이크%/회전효율/수평·수직 무브만 사용한다.
- 제구 섹션: 목표 코스가 없으므로 command 확정이 아니라 zone/repeatability로 표시한다. 스트라이크%, 전체 산포, 구종별 산포/미스 방향을 분리한다.
- 변화구 섹션: 구종별 완성도 점수와 체크리스트(무브, 속도차, 회전/축, 존, 디셉션)를 같은 카드 안에 표시한다.
- 화면 연결: `window.__kuGoTab`을 통해 결과 카드에서 관련 동작 단계 탭/체력 탭으로 이동한다.
- 메카닉 보강: `TypeSummary` 상단에 결과별 관련 메카닉 후보(포심 구속/제구/변화구)를 추가하고, 각 단계 탭 상단에는 해당 단계가 어떤 결과와 연결되는지 표시한다. 공식 메카닉 점수와 MAP은 변경하지 않는다.
- 체력 보강: `__fitnessHTML` 상단에 결과별 체력 우선순위(포심/제구/변화구)를 추가한다. 미측정 축은 경고로 표시하고, ROM은 선수별 실측 연동 전까지 별도 탭으로 적극 노출하지 않는다.
- 출력 리포트 반영: 선수에게 전달·보관될 `ReportTab`의 `_kuConcise()`에도 결과 렌즈 요약, 결과→동작→체력 실행 계획, 미측정 체력/ROM 안내를 넣는다. `_pdReportSection()`은 구종별 완성도 점수와 체크리스트를 포함해야 한다.
- 기존 메카닉 공식 점수/단계 MAP은 바꾸지 않는다. 결과 렌즈는 별도 산식으로 UI에 표시한다.

## 이름 매핑(folder→한글)
hongeunseong=홍은성 hongjuhwan=홍주환 junghwijin=정휘진 jungwonjin=정원진 kimbumgeun=김범근 kimdonghwan=김동환 kimjunyoung=김준영 ohhuntaek=오훈택 parkgyeongdo=박경도 yoojaedong=유재동

## 소표본
오훈택 1구·김준영 3구 → FlowTab "표본 N구·해석 주의" 배지(n<5).

## 동작뷰어 (4_bake_viewer.py)
★OptiTrack export 헤더 함정: 스칼라/이벤트 컬럼(FRAMES·TIME·Footstrike·Release·Max_Shoulder_Rot·
  MaxKneeHeight·Release100msAfter)의 성분(component row=5행)이 "0"인데 python BPR_Theia 엔진은
  "_X"를 기대(TIME_X·Footstrike_X…) → 전개 시 row5의 "0"을 전부 "X"로 치환해야 python 파싱 성공
  (JS 엔진은 관대해서 그냥 됐음). 치환 후 extract_viewer_data.grab_first_ok로 정규화 프레임+SD밴드 생성.
  → korea/데이터/frames/pNNNN.json + manifest.json + korea/motion_viewer.html(템플릿+manifest 주입).
  motion_viewer.html의 세션프레임 폴백은 ../dashboard/데이터/로 재배선. 250Hz(dt 0.004)·GRF 게이지는 0(무측정).
