# KU 투수 체력 탭 — VALD 8종 전량 반영 (2026-07-07)

교수 지시: "모든 체력을 반영해 체력 탭 구현" (입력 `고려대 202606 체력.zip`).

## 데이터 (SSOT)
- 원본 8종 CSV를 repo 커밋: `_ku_theia_bake/fitness_202606_csv/{IMTP,SJ,CMJ,PPU,Grip,ROM,30m,Agility}.csv` (ephemeral 입력 의존 금지 원칙).
- 측정 2026-06-28 · VALD ForceDecks·DynaMo·타이밍게이트. 팀 측정 코호트 n≈22~28(전체 ~27명, KU Theia 10명 전원 포함).
- 이름 공백 불규칙(제거 정규화). 30m/Agility=GivenName+FamilyName. ROM 고관절=좌우, 어깨=투구팔 단측.
- 결측: 정원진·유재동 IMTP無, 박경도 PPU無 → not_measured 처리.

## 베이크 `6_bake_fitness.py` → `korea/데이터/fitness.js`
- 대표 rep: 점프=최고높이, IMTP=최대 PeakForce/BM, sprint/agility=최소 Total.
- **팀 상대 백분위**(측정 코호트 기준) — 기존 hp_assessment cohort_pct 관례 계승·확장. 방향: 시간(sprint/agility)·수축시간·비대칭=낮을수록 좋음(LOWER_BETTER).
- 8축(scored): imtp(최대근력) · cmj_h(폭발력) · cmj_pp(하체파워) · rsi(반응강도) · ppu(상체파워) · grip(악력) · sprint(스피드30m) · agility(민첩성5-10-5). 각 축 detail=보조지표(SJ·RFD·반동활용·L/R 등).
- ROM: 고관절 ER/IR(좌우+비대칭+큰쪽), 어깨 ER/IR(투구팔). 코호트 p25~p75 참고밴드.
- 좌우 비대칭 플래그(≥10%): 악력·IMTP·CMJ·고관절 ER/IR (방향 포함).
- 종합=축 백분위 가중평균. caveat="단일 세션·팀 상대 백분위(절대 규준 아님)".

## 렌더 (`korea/index.html`)
- 6축→8축 확장(스피드·민첩성 신규). 레이더 order/labels 8축. **미측정 축=링에 '미측정' 표시·폴리곤서 제외**(중심 0 스파이크 방지).
- 팀백분위 프레이밍(카드 "N 백분위"·"팀 백분위 n=N"·헤드라인 "100=팀 최상위·절대 규준 아님"). "엘리트 목표/velo군" 문구 전량 제거.
- 백분위 등급 = `__teamPctBand`(67/34 3분위 → 우수/양호/보강). ★기존 `__evalScoreBand`(80/62 점수용)를 백분위에 쓰면 중앙값(50)이 '보강'으로 오표기 → 교체.
- ROM 서브탭: 플레이스홀더("실측 미연동") 제거하고 실측 연동(`__romHTML`). "관절 가동범위" 탭 버튼 추가. 등급 대신 **중립 밴드위치**(`__romPosBand`: 팀 하위/중간대/상위) — ROM은 양방향(저가동=제한·과가동=불안정)이라 우수/보강 판정 지양.
- 흐름 탭 엔진 카드(fitGrid)·__fitCards note도 동일 팀백분위·__teamPctBand로 일관화(두 탭 색 불일치 버그 수정).
- 캐시버전 `fitness.js?v=kuFIT0707`.

## 검증
- 8종 집계 병렬 적대검증 **PASS**(원본 CSV 대비 바이트 일치·방향·이름매칭·대표rep).
- 종단(CSV→fitness.js) 재계산 검증 PASS. 10명 전원 데이터 완전(측정축 7~8/8·ROM4·백분위 [1,100]).
- 코드/정직성 리뷰 4건 수정: fitGrid 등급 불일치·"엘리트 목표" 잔존·__fitCards note·레이더 미측정. 전부 프리뷰 재검증·콘솔0.
- 엣지: 좌투(홍주환) 어깨 좌측·박경도 PPU無 축생략·유재동 IMTP無.

## 남은 검토(교수)
- 코호트 정의: 현재 '측정된 전체 선수' 기준 백분위. 투수만/전체 선수 혼합 여부에 따라 해석 차이 — 교수 확인 시 조정 가능.
- ROM 참고밴드=팀 분포(p25~p75). 임상/문헌 기준(GIRD 등) 도입 여부는 교수 결정(현재 팀상대만·정직).
- 로컬 커밋만. push/deploy는 교수 트리거.
