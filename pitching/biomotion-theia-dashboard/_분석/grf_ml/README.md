# GRF-ML R&D — 키네마틱으로 힘판 변인 추정 (착수, 2026-07-09)

힘판 미측정 세션(고려대 2026-06)의 지면반력(GRF) 기반 분석 변인을 **Theia 키네마틱으로 추정**하는 모델. 순수 물리식 `F=m·a_com`이 실패한 변인을 ML로 되살릴 수 있는지 검증한 R&D. **아직 프로덕션 미연동** — 점수/표시 연동은 교수 결정 대기.

## 결과 (선수별 LOSO 교차검증, 우리 힘판 선수 94명)

| 측정 GRF 변인 | 순수 F=m·a | **ML(Ridge) LOSO r** | 중앙 상대오차 | 판정 |
|---|---|---|---|---|
| 앞발 수직 임펄스 `leadVGRFImpulse` | 0.48 | **0.85** | 8% | **A(신뢰)** |
| 앞발 제동 임펄스 `apBrakeImpulse` | ~0.4 | **0.80** | 7% | **A(신뢰)** |
| 추진 임펄스비 `propImpPct` | ~ | 0.73 | 5% | B(순위) |
| 뒷발 추진 `rearProp` | 0.11 | 0.62 | 11% | B(순위) |
| 앞발 수직 peak `leadGrf` | 0.13 | 0.29 | — | D(불가) |
| 앞발 제동 peak `apBrake` | <0.4 | 0.28 | — | D(불가) |

## 왜 임펄스는 되고 peak는 안 되나 (물리)
- **임펄스 = 운동량 변화**(impulse-momentum 정리). 앞발 제동 임펄스 ≈ `m × (COM 전진속도 감소)` — 우리 키네마틱 피처와 거의 항등. 수직 임펄스 ≈ 단일지지 `체중 × 지지시간`(대부분 타이밍). → 키네마틱으로 A등급 예측 가능.
- **peak = 고주파 충격**. 착지 제동 peak는 필터·저샘플링(250Hz≪1000Hz)에 40~50% 과소(문헌 확증). 키네마틱으로 복원 불가(D).

## OBP 활용 (Driveline OpenBiomechanics Project)
- 검증·POC: OBP(투수100·411투구·**힘판 실측**)에 키네마틱→GRF ML 돌려 순수 F=m·a(D)→B/C 상승 확인. **뒷발 추진**은 OBP→우리 전이 r=0.61로 전이됨.
- 정합 피처(OBP↔Theia): armRotV·torsoRotV·xfPeak·merPk·pelvisRotV·comVel·leadKneeVelPk·strideLen·hssFC·elbowExtV·kneeExtROM 등.
- **최종 배포 모델은 우리 힘판 데이터로만 학습**(OBP 데이터 미포함 → CC BY-NC-SA share-alike 무관). OBP는 외부 검증·전이 근거로만 사용.
- **출처표기(Attribution)**: Driveline OpenBiomechanics Project, CC BY-NC-SA 4.0. 학술·비상업 용도.

## 파일
- `train_grf_impulse.py` — 재현 스크립트(우리 dashboard players.js로 학습 → korea 적용 → 계수 저장). numpy만.
- `grf_impulse_model.json` — 선형 모델 계수(44 키네마틱 피처 × 4 임펄스/추진 타깃) + z-score·결측대치 파라미터. **선형이라 JS 이식 자명**(`(x−mu)/sd·w+b`).

## 방법
- 피처: 추론 시점(고려대=키네마틱만)에 계산 가능한 44개(GRF/모멘트/일/힘전달/에너지 유래 제외).
- 모델: Ridge(α=12), 피처 z-score. 선수별 leave-one-out(누수 없음).
- 검증: LOSO r + 중앙 상대오차. korea 적용 시 추정치가 규준 정상범위 내(예: 앞발수직임펄스 korea 18~22 vs 규준 중앙 20.3).

## 배포 계획 (교수 결정 대기)
1. **표시**: korea 리포트에 A/B등급 임펄스 변인을 "추정" 라벨로 표시(순위/백분위). peak·발별 순시력은 제외.
2. **점수 연동(선택)**: 되살린 임펄스 변인을 korea 블로킹/드라이브 채점에 재투입할지 — 거버넌스(근거·before/after·표시-점수 정합) 필요. 현재 korea는 `grf_absent`로 키네마틱만 채점 중이라, 임펄스 재투입은 "메커니즘 교정" 관점 검토 후.
3. **고도화**: OBP pretrain→우리 fine-tune(전이학습), 더 많은 세션 축적, RF/GBM 시도. 단 peak·정밀 타이밍은 원리적 한계(불가).
