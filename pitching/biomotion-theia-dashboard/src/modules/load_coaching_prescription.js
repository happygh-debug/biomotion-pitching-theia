// load_coaching_prescription.js — Coaching Prescription MVP (표현 layer only)
// SSOT: outputs/coaching_cause_map.csv · outputs/drill_library.csv
// 계산·PITCH_NORMS·mech6 변경 금지
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.coachingPrescription = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRIORITY_KEYS = ["earlyArmRisk","apBrakeImpulse","comVelReductionFCBR","vgrfRetain","kneeCollapse","kneeTrunkLag","torsoRotV","trunkME","armTransferRatio","ppTrunkHum","armRotV","humME","relTimingCvPct","releaseSdMm","armSlotSdDeg","strideLenCV"];

  var FALLBACK = {
    labelKo: '코칭 처방 준비 중',
    observedIssue: '해당 변인은 코칭 처방 라이브러리 MVP 범위(16개 핵심 변인) 밖입니다.',
    upstreamCauses: [],
    energyImpact: 'Feedback View 핵심 문제·단계별 피드백을 우선 참고해 주세요.',
    coachMessage: '수치 맥락과 함께 단계별 피드백을 먼저 확인하는 것이 좋습니다.',
    playerCue: null,
    drills: [],
    nextGoals: [],
    caution: '처방·단정 아님 · 코치 현장 관찰과 함께 해석'
  };

var CAUSE = {
  'earlyArmRisk': {
    phase: 'windup',
    labelKo: '팔 조기 준비 위험',
    observedIssue: 'KH 전후 팔이 몸통·하체보다 먼저 준비되는 경향',
    energyRole: 'risk',
    possibleUpstreamCauses: 'hipHinge;wuPelCoil;wuTrunkCoil;strideTime',
    downstreamEffect: 'ppTrunkHum;armTransferRatio;relTimingCvPct;armSlotSdDeg',
    coachMessage: '와인드업에서 팔이 먼저 빠지면 이후 몸통 전달·릴리스 반복성이 흔들릴 수 있음',
    playerCue: '팔을 먼저 쓰기보다 몸통이 먼저 돌고 팔이 따라나오게 해보세요',
    recommendedDrills: 'DR-WU-01;DR-WU-02',
    drillProgression: '축발 안정·손 고정 → 코일 유지 → 팔 분리 억제 플레이',
    nextMeasurementGoals: 'earlyArmRisk;ppTrunkHum;armTransferRatio',
    visualEvidence: 'riskPanel · PI→KH',
    caution: '의도적 패턴·유형과 구분 · 점수 아님',
  },
  'apBrakeImpulse': {
    phase: 'block',
    labelKo: '앞발 제동 임펄스',
    observedIssue: '착지 후 앞발 제동 임펄스가 엘리트 대비 낮은 경향',
    energyRole: 'braking;conversion',
    possibleUpstreamCauses: 'propImpPct;strideLen;leadKneeFlexFC;postureMaint',
    downstreamEffect: 'comVelReductionFCBR;torsoRotV;trunkME;armTransferRatio',
    coachMessage: '착지 후 전진이 충분히 멈추지 않으면 회전 전환 시간이 줄어들 수 있음',
    playerCue: '착지 후 앞발 위에서 몸을 받치고 회전하는 느낌을 가져가세요',
    recommendedDrills: 'DR-BLK-01;DR-BLK-02',
    drillProgression: '제동 감각 인지 → 단발 제동 → 투구 연결',
    nextMeasurementGoals: 'apBrakeImpulse;comVelReductionFCBR;vgrfRetain',
    visualEvidence: 'timeSeriesWithEvents · FC→BR',
    caution: '단일 구·착지 조건 변동 · GRF 캘리브레이션 확인',
  },
  'comVelReductionFCBR': {
    phase: 'block',
    labelKo: '전진속도 감소 (FC→BR)',
    observedIssue: 'FC→BR 구간 COM 전진속도 감소가 작은 경향',
    energyRole: 'braking;conversion',
    possibleUpstreamCauses: 'apBrakeImpulse;vgrfRetain;kneeCollapse;strideLen',
    downstreamEffect: 'rotKEgain;torsoRotV;trunkME;ppTrunkHum',
    coachMessage: '선형 에너지가 회전으로 바뀌기 전에 앞으로 밀리는 패턴 가능',
    playerCue: '착지 후 몸이 더 멈추는 느낌·앞발 지지 확인',
    recommendedDrills: 'DR-BLK-01;DR-BLK-03',
    drillProgression: '멈춤 타이밍 인지 → 제동 후 회전 연결 → 연속 투구',
    nextMeasurementGoals: 'comVelReductionFCBR;apBrakeImpulse;torsoRotV',
    visualEvidence: 'timeSeriesWithEvents · FC→BR',
    caution: '보폭·구속에 따라 기대값 상이',
  },
  'vgrfRetain': {
    phase: 'block',
    labelKo: '앞다리 지지 유지',
    observedIssue: '착지 후 앞발 수직 지지가 빨리 줄거나 불안정한 경향',
    energyRole: 'braking',
    possibleUpstreamCauses: 'kneeCollapse;leadKneeFlexFC;strideLen;apBrakeImpulse',
    downstreamEffect: 'kneeTrunkLag;torsoRotV;relTimingCvPct',
    coachMessage: '지지가 약하면 몸통 회전 타이밍·릴리스 리듬이 흔들릴 수 있음',
    playerCue: '착지 후 앞발이 바닥에서 미끄러지지 않게 지지 유지',
    recommendedDrills: 'DR-BLK-02;DR-KNEE-01',
    drillProgression: '지지 홀드 → 제동+지지 동시 → 투구 연결',
    nextMeasurementGoals: 'vgrfRetain;kneeCollapse;kneeTrunkLag',
    visualEvidence: 'timeSeriesWithEvents · FC→BR',
    caution: 'GRF 신뢰도·캘리브레이션 확인',
  },
  'kneeCollapse': {
    phase: 'block',
    labelKo: '앞무릎 붕괴 위험',
    observedIssue: '착지 후 앞무릎이 안쪽으로 무너지는 경향',
    energyRole: 'risk;load',
    possibleUpstreamCauses: 'vgrfRetain;leadKneeFlexFC;blockingType',
    downstreamEffect: 'apBrakeImpulse;comVelReductionFCBR;kneeTrunkLag;blockRiskPenalty',
    coachMessage: '무릎 붕괴는 지지·제동·전달 모두에 부담을 줄 수 있음',
    playerCue: '앞무릎 바깥으로 지지하며 몸통 회전 준비',
    recommendedDrills: 'DR-KNEE-01;DR-BLK-02',
    drillProgression: '지지 각도 인지 → 밴드 지지 → 제동 연결',
    nextMeasurementGoals: 'kneeCollapse;vgrfRetain;apBrakeImpulse',
    visualEvidence: 'riskPanel · FC→BR',
    caution: '부상·단정 금지 · blockRiskPenalty와 함께 해석',
  },
  'kneeTrunkLag': {
    phase: 'knee',
    labelKo: '앞무릎·몸통 타이밍',
    observedIssue: '앞무릎 피크와 몸통 피크 간격이 엘리트 범위를 벗어난 경향',
    energyRole: 'transfer',
    possibleUpstreamCauses: 'kneeCollapse;vgrfRetain;apBrakeImpulse;blockingType',
    downstreamEffect: 'trunkME;armTransferRatio;ppTrunkHum;armRotV',
    coachMessage: '앞다리 지지 후 몸통이 늦거나 일찍 열리면 전달 효율이 떨어질 수 있음',
    playerCue: '앞다리 지지 후 몸통이 이어지는 순서',
    recommendedDrills: 'DR-KNEE-02;DR-TRK-01',
    drillProgression: '무릎 지지 타이밍 → 골반·몸통 순서 → 연속 투구',
    nextMeasurementGoals: 'kneeTrunkLag;kneeTransfer;ppTrunkHum',
    visualEvidence: 'bandGauge · FC→BR',
    caution: 'range 변인 · 1구만으로 단정 금지',
  },
  'torsoRotV': {
    phase: 'trunk',
    labelKo: '몸통 회전 속도',
    observedIssue: 'FC→BR 몸통 회전 각속도 peak가 엘리트 대비 낮은 경향',
    energyRole: 'generation',
    possibleUpstreamCauses: 'comVelReductionFCBR;apBrakeImpulse;kneeTrunkLag;vgrfRetain',
    downstreamEffect: 'trunkME;armTransferRatio;armRotV;humME',
    coachMessage: '블로킹·연결 후 몸통 회전 가속이 부족하면 팔 부담으로 이어질 수 있음',
    playerCue: '하체 지지 위에서 몸통 회전 먼저',
    recommendedDrills: 'DR-TRK-01;DR-BLK-03',
    drillProgression: '회전 준비 자세 → 분리 회전 → 투구 연결',
    nextMeasurementGoals: 'torsoRotV;trunkME;armTransferRatio',
    visualEvidence: 'timeSeriesWithEvents · FC→BR',
    caution: '구속만으로 단정 금지',
  },
  'trunkME': {
    phase: 'trunk',
    labelKo: '몸통 에너지 피크',
    observedIssue: '몸통 운동에너지 peak가 엘리트 대비 낮은 경향',
    energyRole: 'generation',
    possibleUpstreamCauses: 'torsoRotV;kneeTrunkLag;comVelReductionFCBR;earlyArmRisk',
    downstreamEffect: 'armTransferRatio;humME;armRotV;ppTrunkHum',
    coachMessage: '몸통에서 만든 에너지가 적으면 팔이 대신 일할 수 있음',
    playerCue: '블로킹 후 몸통이 팔보다 먼저 회전',
    recommendedDrills: 'DR-TRK-01;DR-TRK-02',
    drillProgression: '회전 타이밍 → 에너지 전달 감각 → 연속 투구',
    nextMeasurementGoals: 'trunkME;torsoRotV;armTransferRatio',
    visualEvidence: 'timeSeriesWithEvents · FC→BR',
    caution: 'delivery 유형별 기대 범위 상이',
  },
  'armTransferRatio': {
    phase: 'trunk',
    labelKo: '몸통→팔 전달비율',
    observedIssue: '몸통 대비 팔(상완) 전달 비율이 낮은 경향',
    energyRole: 'transfer',
    possibleUpstreamCauses: 'trunkME;ppTrunkHum;earlyArmRisk;kneeTrunkLag',
    downstreamEffect: 'humME;armRotV;elbAbs;shGen',
    coachMessage: '몸통 전달이 약하면 팔·어깨가 보상 동작을 할 수 있음',
    playerCue: '몸통 회전 후 팔이 따라오게',
    recommendedDrills: 'DR-ARM-01;DR-TRK-02',
    drillProgression: '몸통 회전 → 팔 분리 지연 → 방출 연결',
    nextMeasurementGoals: 'armTransferRatio;ppTrunkHum;humME',
    visualEvidence: 'bandGauge · FC→BR',
    caution: '구속·유형에 따라 기대 비율 다름',
  },
  'ppTrunkHum': {
    phase: 'trunk',
    labelKo: '몸통·상완 타이밍',
    observedIssue: '몸통 ME peak와 상완 ME peak 간격이 엘리트 범위를 벗어난 경향',
    energyRole: 'transfer;context',
    possibleUpstreamCauses: 'earlyArmRisk;trunkME;torsoRotV;kneeTrunkLag',
    downstreamEffect: 'armTransferRatio;armRotV;relTimingCvPct',
    coachMessage: '간격이 짧으면 조기 팔·길면 에너지 손실 패턴 가능',
    playerCue: '몸통이 먼저·팔은 한 박 늦게',
    recommendedDrills: 'DR-ARM-01;DR-TRK-02',
    drillProgression: '타이밍 메트로놈 → 순서 고정 → 투구 연결',
    nextMeasurementGoals: 'ppTrunkHum;armTransferRatio;armRotV',
    visualEvidence: 'bandGauge · FC→BR',
    caution: '단독 우열 판정 없음 · range 변인',
  },
  'armRotV': {
    phase: 'arm',
    labelKo: '팔 회전 속도',
    observedIssue: 'MER→BR 어깨 내회전 각속도 peak가 엘리트 대비 낮은 경향',
    energyRole: 'release',
    possibleUpstreamCauses: 'armTransferRatio;trunkME;humME;ppTrunkHum',
    downstreamEffect: 'releaseSdMm;relTimingCvPct;elbAbs',
    coachMessage: '팔 회전이 약해도 몸통 전달이 함께 봐야 함',
    playerCue: '몸통에서 받은 힘으로 팔 회전 방출',
    recommendedDrills: 'DR-ARM-02;DR-ARM-01',
    drillProgression: '전달 확인 → 회전 방출 → 반복 투구',
    nextMeasurementGoals: 'armRotV;humME;armTransferRatio',
    visualEvidence: 'timeSeriesWithEvents · MER→BR',
    caution: '구속만으로 단정 금지',
  },
  'humME': {
    phase: 'arm',
    labelKo: '상완 에너지 피크',
    observedIssue: '상완 운동에너지 peak가 엘리트 대비 낮은 경향',
    energyRole: 'release',
    possibleUpstreamCauses: 'armTransferRatio;trunkME;ppTrunkHum;torsoRotV',
    downstreamEffect: 'armRotV;releaseSdMm;elbAbs',
    coachMessage: '방출 에너지가 적으면 몸통→팔 전달·타이밍 점검 필요',
    playerCue: '몸통 전달 뒤 팔로 공 방출',
    recommendedDrills: 'DR-ARM-02;DR-ARM-01',
    drillProgression: '전달 후 방출 → 릴리스 감각 → 연속 투구',
    nextMeasurementGoals: 'humME;armTransferRatio;armRotV',
    visualEvidence: 'timeSeriesWithEvents · FC→BR',
    caution: '부하·부상 단정 금지',
  },
  'relTimingCvPct': {
    phase: 'consistency',
    labelKo: '릴리스 타이밍 일관성',
    observedIssue: '세션 내 FC→BR 릴리스 타이밍 CV%가 높은 경향',
    energyRole: 'consistency',
    possibleUpstreamCauses: 'strideLenCV;ppTrunkHum;earlyArmRisk;apBrakeImpulse',
    downstreamEffect: 'releaseSdMm;armSlotSdDeg;armRotV',
    coachMessage: '리듬 변동은 방향·암슬롯 변동과 함께 볼 수 있음',
    playerCue: '릴리스 위치를 만들려고 하기보다 같은 리듬으로 던지는 느낌을 유지하세요',
    recommendedDrills: 'DR-REL-01;DR-DRV-01',
    drillProgression: '리듬 고정 → 보폭·타이밍 동기 → 게임형 반복',
    nextMeasurementGoals: 'relTimingCvPct;strideLenCV;releaseSdMm',
    visualEvidence: 'bandGauge · FC→BR',
    caution: 'trial 수 적으면 CV 참고만',
  },
  'releaseSdMm': {
    phase: 'consistency',
    labelKo: '릴리스 위치 일관성',
    observedIssue: '릴리스 3D 위치 SD가 큰 경향',
    energyRole: 'consistency',
    possibleUpstreamCauses: 'relTimingCvPct;armSlotSdDeg;ppTrunkHum;armTransferRatio',
    downstreamEffect: 'armRotV;strideLenCV',
    coachMessage: '릴리스 위치 변동은 제구·방향 안정성 맥락',
    playerCue: '매 구 같은 릴리스 위치·감각 유지',
    recommendedDrills: 'DR-REL-01;DR-SLOT-01',
    drillProgression: '릴리스 포인트 마킹 → 동일 감각 반복 → 부분 투구',
    nextMeasurementGoals: 'releaseSdMm;relTimingCvPct;armSlotSdDeg',
    visualEvidence: 'bandGauge · FC→BR',
    caution: 'trial 수 적으면 SD 참고만',
  },
  'armSlotSdDeg': {
    phase: 'consistency',
    labelKo: '암슬롯 일관성',
    observedIssue: 'FC 시점 암슬롯 SD가 큰 경향',
    energyRole: 'consistency',
    possibleUpstreamCauses: 'earlyArmRisk;ppTrunkHum;relTimingCvPct',
    downstreamEffect: 'releaseSdMm;armRotV',
    coachMessage: '평균 슬롯 높이(armSlot)와 혼동 금지 · 반복성 지표',
    playerCue: '팔이 나오는 높이 감각을 일정하게',
    recommendedDrills: 'DR-SLOT-01;DR-WU-02',
    drillProgression: '슬롯 감각 고정 → 착지 연결 → 반복 투구',
    nextMeasurementGoals: 'armSlotSdDeg;releaseSdMm;relTimingCvPct',
    visualEvidence: 'bandGauge · FC→BR',
    caution: 'armSlot(평균)과 별도 지표',
  },
  'strideLenCV': {
    phase: 'consistency',
    labelKo: '보폭 일관성',
    observedIssue: '세션 내 보폭 CV%가 높은 경향',
    energyRole: 'consistency',
    possibleUpstreamCauses: 'strideTime;propImpPct;postureMaint',
    downstreamEffect: 'relTimingCvPct;apBrakeImpulse;vgrfRetain',
    coachMessage: '보폭 변동은 착지·제동·리듬 변동과 연결될 수 있음',
    playerCue: '전략에 맞는 보폭·리듬 유지',
    recommendedDrills: 'DR-DRV-01;DR-REL-01',
    drillProgression: '보폭 마커 → 리듬 동기 → 연속 투구',
    nextMeasurementGoals: 'strideLenCV;strideLen;relTimingCvPct',
    visualEvidence: 'bandGauge · FC→BR',
    caution: '의도적 보폭 변화와 구분',
  },
};

var DRILLS = {
  'DR-WU-01': {
    drillId: 'DR-WU-01',
    category: '와인드업 저장',
    nameKo: '축발 체중 홀드',
    objectiveKo: '다리 들 때 축발에 체중을 싣고 상체가 일찍 열리지 않게',
    targetKeys: 'earlyArmRisk;hipHinge;wuPelCoil',
    setupKo: '축발 위 · 무릎 들기 전 2초 홀드',
    progressionKo: '체중 실림 인지 → 3회 홀드 → 무릎 들기 연결',
    coachingCue: '축발이 먼저 받치고 몸이 뜨지 않게',
    equipment: 'none',
    caution: '허리 과굴곡·무릎 통증 시 중단',
  },
  'DR-WU-02': {
    drillId: 'DR-WU-02',
    category: '팔 조기 준비 억제',
    nameKo: '글러브-투구손 고정 분리',
    objectiveKo: '와인드업에서 손·팔이 몸보다 먼저 빠지지 않게',
    targetKeys: 'earlyArmRisk;armSlotSdDeg',
    setupKo: '글러브 가슴 고정 · 투구손 허리 옆',
    progressionKo: '손 고정 → 코일 유지 → 레그킥 연결',
    coachingCue: '팔이 먼저 가지 말고 몸이 먼저',
    equipment: 'none',
    caution: '의도적 하이암 슬롯 유형과 구분',
  },
  'DR-DRV-01': {
    drillId: 'DR-DRV-01',
    category: '드라이브 리듬',
    nameKo: '보폭 마커 리듬 투구',
    objectiveKo: '보폭·드라이브 시간을 매 구 같게',
    targetKeys: 'strideLenCV;strideTime;relTimingCvPct',
    setupKo: '착지 지점 마커 2개 · 메트로놈 80bpm',
    progressionKo: '마커 맞추기 → 메트로놈 동기 → 10구 연속',
    coachingCue: '보폭과 박자가 같게',
    equipment: 'cone;metronome',
    caution: '구속 경쟁보다 리듬 우선',
  },
  'DR-BLK-01': {
    drillId: 'DR-BLK-01',
    category: '앞발 제동',
    nameKo: '착지 후 멈춤 인지',
    objectiveKo: '착지 직후 전진이 줄어드는 감각',
    targetKeys: 'apBrakeImpulse;comVelReductionFCBR',
    setupKo: '평지 마운드 · 천천히 착지',
    progressionKo: '멈춤 카운트 1-2-회전 → 속도 올리기 → 투구 연결',
    coachingCue: '착지 후 1초 멈춘 뒤 회전',
    equipment: 'none',
    caution: '무릎 통증 시 강도 조절',
  },
  'DR-BLK-02': {
    drillId: 'DR-BLK-02',
    category: '앞발 제동',
    nameKo: '앞발 지지+제동 밴드',
    objectiveKo: '착지 후 앞발이 지면을 눌러 지지 유지',
    targetKeys: 'vgrfRetain;kneeCollapse;apBrakeImpulse',
    setupKo: '앞발 위 밴드 텐션 · 제동 자세',
    progressionKo: '지지 홀드 3초 → 제동 후 회전 → 투구',
    coachingCue: '앞발이 바닥에서 뜨지 않게',
    equipment: 'band',
    caution: '무릎 안쪽 통증 시 각도 조절',
  },
  'DR-BLK-03': {
    drillId: 'DR-BLK-03',
    category: '블로킹 후 회전 전환',
    nameKo: '제동 후 골반 회전',
    objectiveKo: '제동이 끝난 뒤 골반이 먼저 도는 순서',
    targetKeys: 'comVelReductionFCBR;torsoRotV;rotKEgain',
    setupKo: '착지 후 골반만 먼저 돌리기(팔 고정)',
    progressionKo: '골반 회전 → 몸통 추가 → 팔 연결',
    coachingCue: '멈춘 다음 골반이 먼저',
    equipment: 'none',
    caution: '팔 먼저 돌리면 실패로 피드백',
  },
  'DR-KNEE-01': {
    drillId: 'DR-KNEE-01',
    category: '앞무릎-몸통 연결',
    nameKo: '앞무릎 지지 홀드',
    objectiveKo: '착지 후 무릎 각도 유지하며 지지',
    targetKeys: 'kneeCollapse;vgrfRetain;kneeTrunkLag',
    setupKo: '착지 자세 홀드 · 거울 측면',
    progressionKo: '3초 홀드 → 홀드+골반 → 투구 연결',
    coachingCue: '무릎이 안으로 무너지지 않게',
    equipment: 'mirror',
    caution: 'range-of-motion 통증 시 중단',
  },
  'DR-KNEE-02': {
    drillId: 'DR-KNEE-02',
    category: '앞무릎-몸통 연결',
    nameKo: '지지 후 몸통 1박 지연',
    objectiveKo: '앞다리 지지 후 몸통이 한 박 늦게',
    targetKeys: 'kneeTrunkLag;kneeTransfer;ppTrunkHum',
    setupKo: '박수 큐 · 착지-박-회전',
    progressionKo: '박수 맞추기 → 투구 연결 → 연속',
    coachingCue: '무릎 지지 끝나고 몸통',
    equipment: 'none',
    caution: '타이밍만 맞추고 제동 생략 금지',
  },
  'DR-TRK-01': {
    drillId: 'DR-TRK-01',
    category: '블로킹 후 회전 전환',
    nameKo: '분리 회전 스텝',
    objectiveKo: '하체 고정·상체 분리 회전',
    targetKeys: 'torsoRotV;trunkME;comVelReductionFCBR',
    setupKo: '하체 폭 스탠스 · 팔 교차',
    progressionKo: '분리 회전 5회 → 착지 연결 → 투구',
    coachingCue: '하체는 받치고 상체만 돈다',
    equipment: 'none',
    caution: '허리 통증 시 범위 축소',
  },
  'DR-TRK-02': {
    drillId: 'DR-TRK-02',
    category: '몸통→팔 전달',
    nameKo: '몸통 먼저 팔 고정',
    objectiveKo: '몸통 회전 후 팔이 따라오게',
    targetKeys: 'armTransferRatio;ppTrunkHum;trunkME',
    setupKo: '투구팔 턱 옆 고정 · 몸통만 회전',
    progressionKo: '몸통 회전 5회 → 팔 분리 1박 → 방출',
    coachingCue: '몸통 끝나고 팔이 나온다',
    equipment: 'none',
    caution: '팔꿈치 통증 시 강도 조절',
  },
  'DR-ARM-01': {
    drillId: 'DR-ARM-01',
    category: '몸통→팔 전달',
    nameKo: '순서 메트로놈 투구',
    objectiveKo: '몸통-팔 순서 고정',
    targetKeys: 'ppTrunkHum;armTransferRatio;earlyArmRisk',
    setupKo: '메트로놈 · 3박(몸통-대기-팔)',
    progressionKo: '3박 리듬 → 2박 축소 → 연속 투구',
    coachingCue: '몸통 박에 팔은 다음 박',
    equipment: 'metronome',
    caution: '구속보다 순서',
  },
  'DR-ARM-02': {
    drillId: 'DR-ARM-02',
    category: '몸통→팔 전달',
    nameKo: '전달 후 방출 토스',
    objectiveKo: '몸통 전달 뒤 팔 방출 감각',
    targetKeys: 'humME;armRotV;armTransferRatio',
    setupKo: '10m 토스 · 몸통 회전 후 손놓기',
    progressionKo: '토스 10회 → 마운드 토스 → 투구',
    coachingCue: '몸통에서 튕겨 나온다',
    equipment: 'ball;net',
    caution: '어깨 피로 시 횟수 제한',
  },
  'DR-REL-01': {
    drillId: 'DR-REL-01',
    category: '릴리스 반복성',
    nameKo: '릴리스 포인트 마킹',
    objectiveKo: '매 구 같은 릴리스 위치·리듬',
    targetKeys: 'relTimingCvPct;releaseSdMm;strideLenCV',
    setupKo: '릴리스 높이 마커 · 동일 보폭',
    progressionKo: '마커 맞추기 10구 → 게임 카운트 → 불펜',
    coachingCue: '손놓는 위치가 같게',
    equipment: 'marker;net',
    caution: 'trial 수 적으면 추세만',
  },
  'DR-SLOT-01': {
    drillId: 'DR-SLOT-01',
    category: '암슬롯 안정성',
    nameKo: '슬롯 높이 거울 체크',
    objectiveKo: 'FC 시 팔 높이 감각 일정',
    targetKeys: 'armSlotSdDeg;releaseSdMm;armSlot',
    setupKo: '측면 거울 · FC 자세 홀드',
    progressionKo: '슬롯 확인 5회 → 투구 10구 → 피드백',
    coachingCue: '팔이 나오는 높이가 같게',
    equipment: 'mirror',
    caution: 'armSlot(평균)과 혼동 금지',
  },
};

  function splitSemi(s) {
    return String(s || '').split(';').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function isPriorityKey(key) {
    return PRIORITY_KEYS.indexOf(key) >= 0;
  }

  function getCause(key) {
    return CAUSE[key] || null;
  }

  function getDrill(id) {
    return DRILLS[id] || null;
  }

  function labelForKey(key) {
    var c = getCause(key);
    if (c && c.labelKo) return c.labelKo;
    try {
      if (typeof VAR_VIS !== 'undefined' && VAR_VIS.get) {
        var s = VAR_VIS.get(key);
        if (s && s.labelKo) return s.labelKo;
      }
    } catch (e) {}
    return key;
  }

  function resolveKeys(keys) {
    return (keys || []).map(function (k) { return labelForKey(k); });
  }

  function formatDownstream(raw) {
    var parts = splitSemi(raw);
    if (!parts.length) return '';
    return parts.map(function (k) { return labelForKey(k); }).join(' · ') + ' 구간에 영향 가능';
  }

  function mapDrills(ids, maxN) {
    return splitSemi(ids).slice(0, maxN || 2).map(function (id) {
      var d = getDrill(id);
      if (!d) return null;
      return {
        drillId: id,
        category: d.category,
        nameKo: d.nameKo,
        objectiveKo: d.objectiveKo,
        coachingCue: d.coachingCue,
        equipment: d.equipment,
        caution: d.caution,
        hint: '우선 확인할 훈련 방향'
      };
    }).filter(Boolean);
  }

  function buildItem(key, opts) {
    opts = opts || {};
    var c = getCause(key);
    if (!c) {
      return {
        key: key,
        fallback: true,
        labelKo: labelForKey(key),
        observedIssue: FALLBACK.observedIssue,
        upstreamCauses: [],
        energyImpact: FALLBACK.energyImpact,
        coachMessage: FALLBACK.coachMessage,
        playerCue: null,
        drills: [],
        nextGoals: [],
        caution: FALLBACK.caution,
        band: opts.band || null
      };
    }
    return {
      key: key,
      fallback: false,
      labelKo: c.labelKo,
      phase: c.phase,
      observedIssue: c.observedIssue,
      upstreamCauses: resolveKeys(splitSemi(c.possibleUpstreamCauses)),
      energyImpact: formatDownstream(c.downstreamEffect) || c.downstreamEffect,
      coachMessage: c.coachMessage,
      playerCue: c.playerCue,
      drills: mapDrills(c.recommendedDrills, 2),
      drillProgression: c.drillProgression,
      nextGoals: resolveKeys(splitSemi(c.nextMeasurementGoals)),
      visualEvidence: c.visualEvidence,
      caution: c.caution,
      band: opts.band || null
    };
  }

  var RX_ME_MAG = { trunkME: 1, humME: 1 };
  var RX_CONS = { relTimingCvPct: 1, releaseSdMm: 1, armSlotSdDeg: 1, strideLenCV: 1 };
  var RX_CORE = {
    earlyArmRisk: 1, apBrakeImpulse: 1, comVelReductionFCBR: 1, vgrfRetain: 1, kneeCollapse: 1,
    kneeTrunkLag: 1, torsoRotV: 1, armTransferRatio: 1, armRotV: 1, ppTrunkHum: 1
  };

  function pickRxSlots(keys, scored, bands, mainLeakWeakKey) {
    if (!keys || !keys.length) return [];
    var slot1 = keys[0];
    if (keys.length < 2) return [slot1];
    var slot2 = null, best = -1e9;
    keys.forEach(function (k, i) {
      if (i === 0) return;
      var s = (scored && scored[k]) || 0;
      var bias = 0;
      if (RX_CONS[k]) bias += 10;
      else if (RX_CORE[k]) bias += 5;
      if (RX_ME_MAG[k] && k !== mainLeakWeakKey) bias -= 14;
      if (bands && bands[k] === '확인 필요') bias -= 4;
      var eff = s + bias;
      if (eff > best) { best = eff; slot2 = k; }
    });
    return slot2 ? [slot1, slot2] : [slot1];
  }

  function buildToday(ctx) {
    ctx = ctx || {};
    var keys = (ctx.triggerKeys || []).filter(isPriorityKey);
    var slots = pickRxSlots(keys, ctx.scored, ctx.bands, ctx.mainLeakWeakKey);
    var items = slots.map(function (k) {
      return buildItem(k, { band: ctx.bands && ctx.bands[k] });
    });
    return {
      show: items.length > 0,
      version: 'mvp1',
      items: items,
      primary: items[0] || null,
      secondary: items[1] || null,
      note: '우선 확인할 훈련 방향 — 처방·단정·부상 진단 아님'
    };
  }

  function drillsForKey(key, maxN) {
    if (!isPriorityKey(key)) return [];
    var c = getCause(key);
    if (!c) return [];
    return mapDrills(c.recommendedDrills, maxN || 2);
  }

  return {
    PRIORITY_KEYS: PRIORITY_KEYS,
    FALLBACK: FALLBACK,
    CAUSE: CAUSE,
    DRILLS: DRILLS,
    isPriorityKey: isPriorityKey,
    getCause: getCause,
    getDrill: getDrill,
    buildItem: buildItem,
    buildToday: buildToday,
    drillsForKey: drillsForKey,
    labelForKey: labelForKey
  };
});
