// feedback_summary.js — Feedback View v2 요약 (표현 layer only)
// 계산 SSOT: phases · mech6 · pitch_norms(PITCH_STATS) · etdiag — 재계산·재점수화 금지
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.feedbackSummary = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STAGES = [
    { key: 'windup', mech: 'windup', label: '와인드업', researchTab: 'ed-windup' },
    { key: 'drive', mech: 'stride', label: '드라이브', researchTab: 'ed-stride' },
    { key: 'block', mech: 'block', label: '블로킹', researchTab: 'ed-blocking', subLabel: '앞다리 버팀' },
    { key: 'leadKneeTransfer', mech: 'knee', label: '앞무릎 전달', researchTab: 'ed-blocking', auxiliary: true, redirectTo: 'block' },
    { key: 'trunk', mech: 'trunk', label: '몸통', researchTab: 'ed-trunk' },
    { key: 'arm', mech: 'arm', label: '팔 전달·방출', researchTab: 'ed-armball' }
  ];
  /** 코치 에너지 지도·단계 카드 — 앞무릎 전달 독립 단계 제외(블로킹 카드1 흡수) */
  var COACH_FLOW_STAGES = STAGES.filter(function (s) { return !s.auxiliary; });

  var ET_MAP = {
    windup: 'windup', stride: 'drive', blocking: 'block', knee: 'leadKneeTransfer',
    knee5: 'leadKneeTransfer', pelvistrunk: 'trunk', trunk: 'trunk', trunk7: 'trunk',
    trunkarm: 'trunk', trunkarm8: 'trunk', armball: 'arm', armball9: 'arm'
  };

  var PHASE_DICT = {
    windup: {
      label: '와인드업', energyRole: '저장',
      good: '축발 체중·코일 준비 양호', issue: '몸·팔이 일찍 열리는 경향',
      goodPattern: '축발에 체중을 싣고, 몸을 너무 빨리 열지 않으며, 팔이 먼저 준비되지 않는 패턴',
      issuePattern: '다리를 드는 동안 몸이 일찍 열리거나 손·팔이 먼저 빠질 수 있음',
      why: '이후 드라이브·몸통 회전 타이밍에 영향', correction: '축발 위 안정 · 손·팔 조기 분리 억제'
    },
    drive: {
      label: '드라이브', energyRole: '생성·운반',
      good: '축발 추진·자세 유지 양호', issue: '추진 부족 또는 자세 높아짐',
      goodPattern: '축발로 충분히 밀고, 낮은 자세를 유지하며 착지까지 에너지를 운반',
      issuePattern: '추진이 부족하거나 자세가 높아져 착지 시 블로킹에 쓸 에너지가 줄어들 수 있음',
      why: '착지 순간 블로킹·제동에 쓸 에너지 감소', correction: '축발 지면 밀기 · 상체 선행 억제'
    },
    block: {
      label: '블로킹', energyRole: '제동·전환',
      good: '착지 후 전진 제동·지지 양호', issue: '착지 후 몸이 계속 앞으로 밀림',
      goodPattern: '착지 후 전진 속도를 줄이고 앞다리가 지지대 역할을 함',
      issuePattern: '몸이 계속 앞으로 밀리거나 앞무릎이 무너지면 에너지가 새어 나갈 수 있음',
      why: '전진 에너지가 몸통 회전으로 전환되기 전에 누수', correction: '앞발 위 받침 · 전진 줄이며 몸통 회전'
    },
    leadKneeTransfer: {
      label: '앞무릎 전달', energyRole: '연결',
      good: '앞다리 지지→몸통 연결 양호', issue: '앞무릎·몸통 타이밍 불일치',
      goodPattern: '앞다리 지지·제동이 골반·몸통 회전으로 자연스럽게 이어짐',
      issuePattern: '앞무릎·몸통 회전 타이밍 불일치 또는 무릎에만 의존할 수 있음',
      why: '연결 구간 에너지 손실·팔 부담으로 이어질 수 있음', correction: '무릎만 펴기보다 골반·몸통 순서'
    },
    trunk: {
      label: '몸통 전달', energyRole: '증폭·전달',
      good: '몸통 회전·증폭 양호', issue: '몸통 회전 부족 또는 조기 열림',
      goodPattern: '골반 회전이 몸통으로 증폭 · 팔로 전달 준비',
      issuePattern: '몸통이 일찍 열리거나 회전이 부족하면 팔로 가는 에너지가 줄어들 수 있음',
      why: '팔 전달 에너지 감소', correction: '블로킹 후 몸통 순서 회전'
    },
    arm: {
      label: '팔 전달·방출', energyRole: '방출·부하',
      good: '몸통→팔→공 연결·방출 양호', issue: '팔이 몸통 대신 일하거나 부담 신호',
      goodPattern: '몸통에서 전달된 에너지가 팔을 거쳐 공으로 방출됨',
      issuePattern: '몸통 전달이 약하면 팔·어깨·팔꿈치가 대신 일하거나 부담이 커질 수 있음',
      why: '구속 효율·어깨·팔꿈치 부담에 영향 가능', correction: '몸통 회전 뒤 팔이 따라오며 공으로 방출'
    }
  };

  var CAUSE_EFFECT = {
    windup: {
      cause: '와인드업에서 몸·팔이 일찍 열리는 경향',
      consequence: '드라이브·몸통 회전 타이밍이 빨라질 수 있음',
      compensation: '팔이 먼저 준비되며 이후 단계 부담이 커질 수 있음',
      correction: '축발 위 안정 · 손·팔 조기 분리 억제'
    },
    drive: {
      cause: '추진 부족 또는 스트라이드 중 자세 상승',
      consequence: '착지 시 블로킹에 쓸 선형 에너지 감소',
      compensation: '착지 후 몸통·팔이 보완 동작을 할 수 있음',
      correction: '축발 지면 밀기 · 상체 선행 억제'
    },
    block: {
      cause: '착지 후 전진 속도 제동 부족',
      consequence: '몸통 회전으로 전환되는 에너지 감소',
      compensation: '팔이 더 많은 일을 하거나 릴리스 타이밍이 불안정해질 수 있음',
      correction: '앞발 위에서 멈추고 몸통 회전으로 연결되는 느낌'
    },
    leadKneeTransfer: {
      cause: '앞무릎 지지·몸통 회전 타이밍 불일치',
      consequence: '골반·몸통 증폭으로 넘어가는 에너지 감소',
      compensation: '무릎·하체에 부담이 몰릴 수 있음',
      correction: '무릎만 펴기보다 지지 후 골반·몸통 순서'
    },
    trunk: {
      cause: '몸통 회전 부족 또는 조기 열림',
      consequence: '팔로 전달되는 에너지 감소',
      compensation: '어깨·팔꿈치 부담이 커질 수 있음',
      correction: '블로킹 후 몸통이 팔보다 먼저 회전'
    },
    arm: {
      cause: '몸통 전달 대비 팔 사용 비중 큼',
      consequence: '구속 대비 효율·부담에 영향 가능',
      compensation: '몸통 단계 에너지가 상대적으로 약해 보일 수 있음',
      correction: '몸통 회전 뒤 팔 따라오기'
    }
  };

  var GOAL_METRICS = {
    windup: ['hipHinge', 'wuPelCoil', 'wuHSS'],
    drive: ['propImpPct', 'postureMaint', 'strideLen'],
    block: ['comVelReductionFCBR', 'apBrakeImpulse', 'vgrfRetain'],
    leadKneeTransfer: ['kneeTransfer', 'kneeCollapse', 'kneeTrunkLag'],
    trunk: ['torsoRotV', 'trunkME', 'armTransferRatio'],
    arm: ['armRotV', 'humME', 'armTransferRatio']
  };

  var METRIC_PHRASE = {
    apBrakeImpulse: '앞발 제동 임펄스',
    comVelReductionFCBR: '착지 후 전진속도 감소',
    vgrfRetain: '앞다리 지지 유지',
    kneeCollapse: '착지 후 앞무릎 안정',
    kneeTransfer: '앞다리→몸통 연결',
    kneeTrunkLag: '앞무릎·몸통 타이밍',
    propImpPct: '축발 추진',
    postureMaint: '낮은 자세 유지',
    strideLen: '보폭·전진 거리',
    armRotV: '팔 회전 가속',
    humME: '상완 에너지·방출',
    armTransferRatio: '몸통→팔 전달',
    ppTrunkHum: '몸통·상완 타이밍',
    shGen: '어깨 에너지 비중',
    elbAbs: '팔꿈치 흡수',
    merPk: '어깨 MER',
    scapLoad: '견갑 로딩',
    whipRatio: '채찍 비율',
    hipHinge: '축발 체중 실기',
    wuPelCoil: '골반 코일',
    wuHSS: '하체·상체 분리',
    torsoRotV: '몸통 회전',
    trunkME: '몸통 에너지',
    comKEdrop: '착지 후 에너지 감소'
  };

  var DRILL = {
    windup: '무릎 들 때 축발 위 안정 · 손·팔 조기 분리 억제',
    drive: '축발 지면 밀기 · 상체 먼저 들림 억제',
    block: '착지 후 앞발 위에서 몸 멈추는 느낌',
    leadKneeTransfer: '앞다리 지지 후 골반·몸통 순서 연결',
    trunk: '몸통이 팔보다 먼저 회전하도록',
    arm: '몸통 회전 뒤 팔이 따라오며 공으로 방출'
  };

  var ARM_CTX_NOTE = {
    armRotV: '팔 회전 속도는 충분하지만, 몸통에서 에너지를 잘 받아 나온 결과인지 확인이 필요합니다. 몸통 전달이 약하면 팔이 대신 일하는 패턴일 수 있습니다.',
    humME: '상완 에너지는 몸통에서 전달된 힘이 팔을 통해 공으로 방출되는 정도를 보여줍니다. 낮으면 몸통→팔 전달·방출이 부족했을 수 있습니다.',
    armTransferRatio: '몸통에서 팔로 에너지가 넘어가는 비율입니다. 낮으면 팔이 몸통에서 충분히 받지 못하고 따로 일할 수 있습니다.',
    ppTrunkHum: '몸통 파워와 상완 파워의 타이밍 차이입니다. 순서·타이밍 설명용(단독 우열 아님).',
    shGen: '어깨에서 만들어지는 에너지 비중이 큰 편입니다. 몸통 전달이 부족하면 어깨가 대신 일할 수 있습니다.',
    elbAbs: '팔꿈치에서 흡수되는 에너지가 큰 편입니다. 전달·방출이 원활하지 않으면 팔꿈치 부담으로 이어질 수 있어 확인이 필요합니다.',
    merPk: 'MER·몸통 전달과 함께 봅니다. 엘리트 범위 안 / 낮음 / 과도 가능.',
    scapLoad: '팔을 던지기 전 어깨·견갑 준비 맥락입니다. MER·몸통 전달과 함께 해석.',
    earlyArm: '팔이 몸통보다 일찍 준비되는 경향입니다. 몸통 회전 에너지를 받기보다 팔이 먼저 일할 수 있습니다.'
  };

  var HIGHLIGHT = {
    windup: { startEv: 'i_pi', startOff: -0.05, endEv: 'i_kl_peak', endOff: 0.05, label: 'PI → KH' },
    drive: { startEv: 'i_kl_peak', startOff: -0.1, endEv: 'i_fc', endOff: 0.05, label: 'KH → FC' },
    block: { startEv: 'i_fc', startOff: 0, endEv: 'i_br', endOff: 0.02, label: 'FC → BR' },
    leadKneeTransfer: { startEv: 'i_fc', startOff: 0, endEv: 'i_br', endOff: 0.02, label: 'FC → BR' },
    trunk: { startEv: 'i_fc', startOff: 0, endEv: 'i_br', endOff: 0.02, label: 'FC → BR' },
    arm: { startEv: 'i_mer', startOff: -0.05, endEv: 'i_br', endOff: 0.02, label: 'MER → BR' }
  };

  var COACH_METRICS = {
    apBrakeImpulse: 1, comVelReductionFCBR: 1, vgrfRetain: 1, kneeCollapse: 1, propImpPct: 1,
    postureMaint: 1, armTransferRatio: 1, armRotV: 1, humME: 1, ppTrunkHum: 1, hipHinge: 1, comKEdrop: 1,
    kneeTransfer: 1, torsoRotV: 1, trunkME: 1
  };

  /** 코칭 처방 트리거 — ME magnitude는 2번 슬롯에서 후순위 */
  var RX_ME_MAG_KEYS = { trunkME: 1, humME: 1 };
  var RX_CONSISTENCY_KEYS = { relTimingCvPct: 1, releaseSdMm: 1, armSlotSdDeg: 1, strideLenCV: 1 };
  var RX_COACH_CORE_KEYS = {
    earlyArmRisk: 1, apBrakeImpulse: 1, comVelReductionFCBR: 1, vgrfRetain: 1, kneeCollapse: 1,
    kneeTrunkLag: 1, torsoRotV: 1, armTransferRatio: 1, armRotV: 1, ppTrunkHum: 1
  };

  var CONDITION_DELTA_KEYS = [
    { key: 'apBrakeImpulse', labelKo: '앞발 제동', unit: '%BW·s', phase: 'block', higherBetter: true, signal: 'waveform' },
    { key: 'comVelReductionFCBR', labelKo: '전진속도 감소', unit: '', phase: 'block', higherBetter: true, signal: 'waveform' },
    { key: 'propImpPct', labelKo: '추진 임펄스', unit: '%BW·s', phase: 'drive', higherBetter: true, signal: 'waveform' },
    { key: 'openAng', labelKo: '몸통 열림', unit: '°', phase: 'trunk', higherBetter: false, signal: 'posture' },
    { key: 'armTransferRatio', labelKo: '몸통→팔 전달', unit: '%', phase: 'trunk', higherBetter: true, signal: 'transfer' },
    { key: 'ppTrunkHum', labelKo: '몸통·상완 타이밍', unit: 'ms', phase: 'trunk', higherBetter: null, signal: 'timing' },
    { key: 'armRotV', labelKo: '팔 회전 속도', unit: '°/s', phase: 'arm', higherBetter: true, signal: 'release' },
    { key: 'torsoRotV', labelKo: '몸통 회전 속도', unit: '°/s', phase: 'trunk', higherBetter: true, signal: 'generation' }
  ];

  var MECHANIC_EVAL_LABELS = {
    beneficial_change: '메카닉 개선',
    negative_change: '에너지 흐름 악화',
    compensation_pattern: '보상 패턴',
    load_shift: '부하 이동',
    neutral_variation: '의미 제한적 변화',
    uncertain: '해석 보류'
  };

  var MECHANIC_EVAL_REGISTRY = {
    apBrakeImpulse: {
      role: 'braking', affectedStage: 'block',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 블로킹 이후 앞발 제동이 약해지며, 전진 에너지를 회전으로 바꾸는 제동 단계가 제한될 수 있습니다.',
        energyExplanation: '착지 후 전진속도 감소가 줄어, 드라이브에서 만든 전진 에너지가 몸통 회전으로 전환되는 효율이 낮아질 가능성이 있습니다.',
        coachImplication: '구속 회복 시 팔 스피드보다 착지 후 제동·몸통 회전 전환 타이밍을 먼저 확인해야 합니다.',
        downstreamEffect: ['trunk_rotation_delay', 'arm_load_increase']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 앞발 제동이 더 살아나며, 블로킹 후 전진 에너지를 회전으로 넘기는 패턴이 좋아집니다.',
        energyExplanation: '제동→전환 구간에서 에너지 누수가 줄고 몸통 회전으로 이어질 여지가 큽니다.',
        coachImplication: '좋은 구의 제동 패턴을 반복 재현하는 훈련이 우선입니다.',
        downstreamEffect: ['trunk_rotation_gain']
      }
    },
    comVelReductionFCBR: {
      role: 'braking_to_conversion', affectedStage: 'block',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 블로킹 이후 전진속도 감소가 늦어지며, 몸통 회전으로 전환되는 타이밍이 지연될 수 있습니다.',
        energyExplanation: '드라이브에서 만든 전진 에너지가 몸통과 팔로 전달되는 효율이 낮아졌을 가능성이 있습니다.',
        coachImplication: '착지 후 COM 감속과 몸통 회전 peak timing이 함께 회복되는지 다음 측정에서 확인해야 합니다.',
        downstreamEffect: ['trunk_rotation_delay', 'release_variability']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 착지 후 전진속도 감소가 더 분명해, 회전 전환 타이밍이 앞당겨집니다.',
        energyExplanation: '제동→전환 구간 효율이 좋아 몸통·팔 전달에 유리한 패턴입니다.',
        coachImplication: '좋은 구의 감속·회전 연결을 반복 재현하는 것이 목표입니다.',
        downstreamEffect: ['trunk_rotation_gain']
      }
    },
    propImpPct: {
      role: 'generation', affectedStage: 'drive',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 축발 추진이 줄어, 착지 시 블로킹에 쓸 선형 에너지가 부족해질 수 있습니다.',
        energyExplanation: '생성 단계 에너지 부족이 이후 제동·전환·전달 전 구간에 영향을 줄 수 있습니다.',
        coachImplication: '구속만 보지 말고 드라이브 추진과 착지 후 제동이 함께 살아나는지 확인해야 합니다.',
        downstreamEffect: ['blocking_weak', 'velocity_loss']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 축발 추진이 더 크며, 이후 블로킹·전환에 쓸 에너지가 확보됩니다.',
        energyExplanation: '생성→운반 구간 에너지 공급이 양호한 패턴입니다.',
        coachImplication: '좋은 구의 추진 감각을 유지·반복하는 것이 우선입니다.',
        downstreamEffect: []
      }
    },
    torsoRotV: {
      role: 'conversion', affectedStage: 'trunk',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 몸통 회전 peak가 작거나 늦어지며, 팔로 넘어가는 에너지가 줄어들 수 있습니다.',
        energyExplanation: '전환·증폭 단계에서 몸통이 충분히 일하지 못해 팔 부담으로 이어질 가능성이 있습니다.',
        coachImplication: '팔 스피드보다 블로킹 후 몸통 회전 타이밍·크기를 먼저 확인해야 합니다.',
        downstreamEffect: ['arm_load_increase', 'release_variability']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 몸통 회전이 더 빠르고 크게 나타나, 팔 전달 준비가 좋아집니다.',
        energyExplanation: '전환·증폭 구간 효율이 좋은 패턴입니다.',
        coachImplication: '좋은 구의 몸통 회전 순서를 반복 재현하는 것이 목표입니다.',
        downstreamEffect: ['arm_transfer_gain']
      }
    },
    armTransferRatio: {
      role: 'transfer', affectedStage: 'trunk',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 몸통에서 팔로 넘어가는 전달 비율이 낮아집니다.',
        energyExplanation: '몸통 전달이 줄어든 상태에서 팔이 보상적으로 더 일했을 가능성이 있습니다.',
        coachImplication: '구속 유지만으로 좋은 상태로 판단하지 말고, 몸통→팔 전달과 팔 부하를 함께 봐야 합니다.',
        downstreamEffect: ['arm_load_increase', 'shoulder_load']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 몸통→팔 전달이 더 좋아, 팔이 몸통 에너지를 받아 일하는 패턴입니다.',
        energyExplanation: '전달 구간 효율이 좋아 부하 분산이 유리합니다.',
        coachImplication: '좋은 구의 몸통 후 팔 따라오기 감각을 반복해야 합니다.',
        downstreamEffect: []
      }
    },
    armRotV: {
      role: 'release', affectedStage: 'arm',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 팔 회전 가속이 줄어, 방출 단계 에너지가 약해질 수 있습니다.',
        energyExplanation: '전달·방출 구간에서 구속 효율이 떨어질 가능성이 있습니다.',
        coachImplication: '팔만 빠르게 돌리기보다 앞 단계 전달이 살아났는지 함께 확인해야 합니다.',
        downstreamEffect: ['velocity_loss']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 팔 회전 가속이 더 크며, 몸통 전달 후 방출이 좋아집니다.',
        energyExplanation: '방출 구간 에너지 활용이 양호한 패턴입니다.',
        coachImplication: '몸통 회전 뒤 팔이 따라오는 순서를 유지해야 합니다.',
        downstreamEffect: []
      }
    },
    openAng: {
      role: 'posture', affectedStage: 'trunk',
      worseOnSlow: {
        classification: 'negative_change',
        mechanicLine: '느린 구에서 착지까지 몸통이 더 일찍 열리며, 회전 증폭이 제한될 수 있습니다.',
        energyExplanation: '자세·타이밍 변화로 전환·전달 효율이 떨어질 가능성이 있습니다.',
        coachImplication: '착지까지 몸통 닫힘 유지와 회전 순서를 함께 확인해야 합니다.',
        downstreamEffect: ['trunk_rotation_delay']
      },
      betterOnFast: {
        classification: 'beneficial_change',
        mechanicLine: '빠른 구에서 몸통 닫힘이 더 유지되어, 회전 증폭에 유리합니다.',
        energyExplanation: '자세 유지가 전환 효율에 도움이 되는 패턴입니다.',
        coachImplication: '좋은 구의 닫힘·회전 순서를 반복해야 합니다.',
        downstreamEffect: []
      }
    },
    ppTrunkHum: {
      role: 'timing', affectedStage: 'trunk',
      worseOnSlow: {
        classification: 'neutral_variation',
        mechanicLine: '느린 구에서 몸통·상완 타이밍 차이가 변했으나, 단독으로 우열을 단정하기 어렵습니다.',
        energyExplanation: '타이밍 변화가 전달·방출 순서에 영향을 줄 수 있어 맥락과 함께 봐야 합니다.',
        coachImplication: '몸통 회전 peak와 팔 준비 순서를 함께 관찰해야 합니다.',
        downstreamEffect: ['timing_shift']
      },
      betterOnFast: {
        classification: 'neutral_variation',
        mechanicLine: '빠른 구에서 몸통·상완 타이밍이 다르게 나타났으나, 단독 우열 판단은 제한적입니다.',
        energyExplanation: '타이밍 변화는 전달 순서 맥락에서 해석해야 합니다.',
        coachImplication: '순서·리듬이 일관되는지 다음 측정에서 확인해야 합니다.',
        downstreamEffect: []
      }
    }
  };

  var OBSERVE_CUES = {
    apBrakeImpulse: ['앞발 지지 시간', '몸통 회전 시작 타이밍'],
    comVelReductionFCBR: ['착지 후 전진이 줄어드는 느낌'],
    propImpPct: ['축발 지면 밀기 감각'],
    openAng: ['착지까지 몸통 닫힘 유지'],
    armTransferRatio: ['몸통 후 팔 따라오기'],
    relTimingCvPct: ['동일 릴리스 리듬'],
    armSlotSdDeg: ['암슬롯 감각 일정함']
  };

  var PLAYER_TIER_KEY = 'biomotion_player_tier';

  /** 규준 코호트 엘리트 20명 — Normative_data SSOT와 동일 명단 */
  var ELITE_COHORT_NAMES = {
    '김강연': 1, '문서준': 1, '문준혁': 1, '박로건': 1, '박신지': 1, '박준용': 1, '박찬우': 1,
    '송재영': 1, '안태건': 1, '엄상현': 1, '이강민': 1, '이시율': 1, '이영하': 1, '이준혁': 1,
    '이지호': 1, '정주영': 1, '조원우': 1, '차보성': 1, '차현빈': 1, '홍주환': 1
  };

  function isNormCohortMember(DATA) {
    var n = DATA && DATA.player && DATA.player.name;
    if (!n) return false;
    return !!ELITE_COHORT_NAMES[n] || !!(DATA.player && DATA.player.normCohort);
  }

  function resolveEliteProfileMode(playerTier, DATA) {
    return playerTier === 'elite' || isNormCohortMember(DATA);
  }

  function eliteBandLabel(bandCode, fallback) {
    if (bandCode === 'weak') return '코호트 내 낮은 편';
    if (bandCode === 'caution') return '조건별 확인 필요';
    if (bandCode === 'risk') return '부하 신호';
    return fallback || bandDisplay(bandCode);
  }

  function eliteMetricBandWord(b) {
    if (b === '미흡') return '코호트 내 낮은 범위';
    if (b === '우수') return '코호트 내 높은 편';
    if (b === '정상') return '코호트 정상 범위';
    return null;
  }

  function _G() {
    return (typeof self !== 'undefined') ? self : (typeof globalThis !== 'undefined' ? globalThis : {});
  }

  function mapEtKey(k) {
    if (!k) return null;
    return ET_MAP[k] || ET_MAP[String(k).replace(/\d+$/, '')] || null;
  }

  function bandDisplay(code, eliteProfile) {
    if (eliteProfile) return eliteBandLabel(code, null) || '측정 없음';
    if (code === 'strong') return '우수';
    if (code === 'ok') return '양호';
    if (code === 'weak') return '결함';
    if (code === 'caution') return '주의';
    if (code === 'risk') return '부하 위험';
    return '측정 없음';
  }

  function bandColor(code) {
    if (code === 'strong') return 'var(--green)';
    if (code === 'ok') return 'var(--cyan)';
    if (code === 'weak' || code === 'caution') return 'var(--amber)';
    if (code === 'risk') return 'var(--red)';
    return 'var(--fg2)';
  }

  function countsToBand(bc, eliteProfile) {
    if (!bc) return { bandCode: 'na', band: '측정 없음', leak: false, loadRisk: false };
    var n = (bc['우수'] || 0) + (bc['정상'] || 0) + (bc['미흡'] || 0);
    if (!n) return { bandCode: 'na', band: '측정 없음', leak: false, loadRisk: false };
    var weak = bc['미흡'] || 0;
    var strong = bc['우수'] || 0;
    if (weak >= Math.ceil(n * 0.5)) {
      return {
        bandCode: 'weak',
        band: eliteProfile ? '코호트 내 낮은 편' : '결함',
        leak: !eliteProfile,
        profileLow: !!eliteProfile,
        loadRisk: false
      };
    }
    if (weak > 0) {
      return {
        bandCode: 'caution',
        band: eliteProfile ? '조건별 확인 필요' : '주의',
        leak: !eliteProfile,
        profileLow: !!eliteProfile,
        loadRisk: false
      };
    }
    if (strong > 0 && weak === 0) return { bandCode: 'strong', band: '우수', leak: false, loadRisk: false };
    return { bandCode: 'ok', band: '양호', leak: false, loadRisk: false };
  }

  function metricBand(M6, NB, m) {
    if (!m || m.neutral || m.value == null || !isFinite(m.value)) return null;
    if (!M6 || !NB) return null;
    var nm = NB[m.key];
    if (!nm) return null;
    return M6.band(m.value, nm, m.dir);
  }

  function gaugePosFromBand(b) {
    if (b === '미흡') return 0.18;
    if (b === '정상') return 0.52;
    if (b === '우수') return 0.82;
    return 0.5;
  }

  function metricLabelKo(key, m) {
    return METRIC_PHRASE[key] || (m && m.label) || key;
  }

  function mapMetricsKo(keys, det6, phase, M6, NB) {
    var out = [], seen = {};
    (keys || []).forEach(function (k) {
      if (!k || seen[k] || typeof k !== 'string') return;
      if (!COACH_METRICS[k] && k.length > 20) return;
      seen[k] = 1;
      out.push(metricLabelKo(k));
    });
    var st = STAGES.filter(function (s) { return s.key === phase; })[0];
    if (out.length < 2 && st) {
      var wm = weakMetric(det6, st.mech, M6, NB);
      if (wm && wm.key && COACH_METRICS[wm.key] && !seen[wm.key]) {
        out.push(metricLabelKo(wm.key, wm));
      }
    }
    return out.slice(0, 3);
  }

  function kneeBand(DATA, ETDIAG, det6, M6, NB) {
    var worst = 0;
    var arr = (det6 && det6.knee) || [];
    arr.forEach(function (m) {
      if (!m || m.neutral) return;
      var b = metricBand(M6, NB, m);
      if (b === '미흡') worst = Math.max(worst, 2);
      else if (m.key === 'kneeCollapse' && b === '미흡') worst = Math.max(worst, 3);
      else if (b === '정상') worst = Math.max(worst, 1);
    });
    var K = ETDIAG && ETDIAG.knee5;
    if (K) {
      if (K.coupling && K.coupling !== 'good' && K.coupling !== '양호') worst = Math.max(worst, 2);
      if (K.type === 'collapse') worst = Math.max(worst, 3);
      if (K.angle && K.angle.lateCollapse != null && K.angle.lateCollapse > 15) worst = Math.max(worst, 2);
    }
    if (worst >= 3) return { bandCode: 'weak', band: '결함', leak: true, loadRisk: false, profileLow: false };
    if (worst >= 2) return { bandCode: 'caution', band: '주의', leak: true, loadRisk: false, profileLow: false };
    if (worst >= 1) return { bandCode: 'ok', band: '양호', leak: false, loadRisk: false };
    return { bandCode: 'na', band: '측정 없음', leak: false, loadRisk: false };
  }

  function armBand(det6, M6, NB, ETDIAG, DATA) {
    var arr = (det6 && det6.arm) || [];
    var bc = { '우수': 0, '정상': 0, '미흡': 0 };
    var bandKeys = { armRotV: 1, humME: 1 };
    arr.forEach(function (m) {
      if (!m || m.neutral || !bandKeys[m.key]) return;
      var b = metricBand(M6, NB, m);
      if (b === '미흡') bc['미흡']++;
      else if (b === '우수') bc['우수']++;
      else if (b === '정상') bc['정상']++;
    });
    var base = countsToBand(bc);
    var loadRisk = false;
    arr.forEach(function (m) {
      if (!m || !m.neutral) return;
      if (m.key === 'armTransferRatio' && m.bandLabel === '미흡') loadRisk = true;
      if (m.key === 'shGen' && m.bandLabel === '우수') loadRisk = true;
      if (m.key === 'elbAbs' && (m.bandLabel === '미흡' || m.bandWord === '높음')) loadRisk = true;
    });
    var P = DATA && DATA.phases;
    if (P && P.earlyArm && P.earlyArm.label && P.earlyArm.label !== 'normal') loadRisk = true;
    var rep = ETDIAG && ETDIAG.rep;
    if (rep && rep.armSelfReliance != null && parseFloat(rep.armSelfReliance) > 0.45) loadRisk = true;
    if (loadRisk) {
      return Object.assign({}, base, { loadRisk: true });
    }
    return base;
  }

  var RELEASE_CONSISTENCY_KEYS = [
    { key: 'relTimingCvPct', label: '릴리스 타이밍 반복성', unit: '%' },
    { key: 'armSlotSdDeg', label: '암슬롯 반복성', unit: '°' },
    { key: 'releaseSdMm', label: '릴리스 위치 반복성', unit: 'mm' },
    { key: 'strideLenCV', label: '보폭 반복성', unit: '%' }
  ];

  function repeatBandLabel(M6, NB, value, key) {
    if (value == null || !isFinite(value) || !M6 || !NB) return null;
    var nm = NB[key];
    if (!nm) return null;
    var b = M6.band(value, nm, -1);
    if (b === '우수') return '반복성 우수';
    if (b === '미흡') return '반복성 낮음';
    if (b === '정상') return '양호';
    return null;
  }

  function commandRelatedRisk(DATA, ETDIAG, phaseBands, det6, M6, NB) {
    var mc = DATA && DATA.command && DATA.command.mechanicsConsistency;
    if (!mc) return false;
    var weak = false;
    RELEASE_CONSISTENCY_KEYS.forEach(function (k) {
      var bl = repeatBandLabel(M6, NB, mc[k.key], k.key);
      if (bl === '반복성 낮음') weak = true;
    });
    if (weak) return true;
    var ml = phaseBands && (phaseBands.trunk || phaseBands.arm || phaseBands.block);
    if (ml && (ml.leak || ml.bandCode === 'weak' || ml.bandCode === 'caution')) return true;
    var P = DATA && DATA.phases;
    if (P && P.earlyArm && P.earlyArm.label && P.earlyArm.label !== 'normal') return true;
    var rep = ETDIAG && ETDIAG.rep;
    if (rep && rep.flyingOpen) return true;
    if (P && P.scalars && P.scalars.openAng != null) {
      var oa = P.scalars.openAng;
      var nm = NB && NB.openAng;
      if (nm && M6 && M6.band(oa, nm, 1) === '미흡') return true;
    }
    return false;
  }

  function consistencyMetricValue(C, mc, key) {
    var v = C && C.variables && C.variables[key];
    if (v && v.cv != null && isFinite(v.cv)) return v.cv;
    if (v && v.sd != null && isFinite(v.sd) && (key.indexOf('Sd') >= 0 || key === 'releaseSdMm')) return v.sd;
    if (mc && mc[key] != null && isFinite(mc[key])) return mc[key];
    return null;
  }

  function findWorstDispersion(C) {
    if (!C) return null;
    if (C.summary && C.summary.worst_cv && C.summary.worst_cv.cv != null) {
      return {
        key: C.summary.worst_cv.key,
        label: C.summary.worst_cv.label,
        cv: C.summary.worst_cv.cv
      };
    }
    var worst = null;
    var doms = C.domains || {};
    Object.keys(doms).forEach(function (did) {
      var dom = doms[did];
      (dom.metrics || []).forEach(function (m) {
        if (m.cv == null || !isFinite(m.cv)) return;
        if (!worst || m.cv > worst.cv) {
          worst = { key: m.key, label: m.label, cv: m.cv, domainId: did, domainLabel: dom.label };
        }
      });
    });
    return worst;
  }

  /** C3 — ph-consistency·Feedback 공통 코치 카드 (4축 · 반복성 밴드만 · 점수·합산 없음) */
  function buildConsistencyCoachCard(DATA, M6, NB) {
    var mc = DATA && DATA.command && DATA.command.mechanicsConsistency;
    var C = DATA && DATA.consistency;
    if (!mc) return { show: false };
    var rows = [];
    var weakN = 0;
    RELEASE_CONSISTENCY_KEYS.forEach(function (k) {
      var v = consistencyMetricValue(C, mc, k.key);
      if (v == null && mc[k.key] != null && isFinite(mc[k.key])) v = mc[k.key];
      if (v == null) return;
      var bl = repeatBandLabel(M6, NB, v, k.key);
      if (bl === '반복성 낮음') weakN++;
      rows.push({ key: k.key, label: k.label, value: Math.round(v * 10) / 10, unit: k.unit, band: bl });
    });
    if (!rows.length) return { show: false };
    var overallRepeat = weakN >= 2 ? '반복성 낮음' : (weakN ? '양호' : '반복성 우수');
    if (rows.every(function (r) { return r.band === '반복성 우수'; })) overallRepeat = '반복성 우수';
    var rel = C && C.reliability ? C.reliability : { tier: '—', label: '—', message: null };
    var pop = C && C.population ? C.population : {};
    var nTrials = (DATA.trials || []).length;
    var cmd = DATA.command;
    var hasLoc = !!(cmd && cmd.commandOutcome && cmd.commandOutcome.has_location);
    return {
      show: true,
      version: 'C3',
      title: '제구 안정성 · 동작 반복성',
      overallRepeat: overallRepeat,
      metrics: rows,
      reliability: rel,
      populationNote: (C && C.summary && C.summary.population_note)
        || ((pop.n_used || nTrials) + '/' + (pop.n_trials || nTrials) + '구'),
      noBallNote: hasLoc
        ? '공 위치 데이터 있음 — 존 일관성은 연구자 제구 탭에서 확인'
        : '공 위치 데이터 없음 — 릴리스 타이밍·암슬롯·보폭 반복성 중심',
      footnote: '점수·mech6 합산 없음 · 반복성 우수/양호/낮음만 표시',
      researchTab: 'ph-consistency'
    };
  }

  /** C2/C3 — 세션 내 분산 맥락 1줄 (점수·mech6 합산 없음) */
  function buildConsistencyContext(DATA, ETDIAG, mainLeak, M6, NB) {
    var C = DATA && DATA.consistency;
    if (!C || C.version !== 'C1') return { show: false };
    var rel = C.reliability || {};
    var pop = C.population || {};
    var sum = C.summary || {};
    var mc = DATA.command && DATA.command.mechanicsConsistency;

    if (rel.tier === 'D') {
      return {
        show: true,
        warning: true,
        tier: 'D',
        line: (pop.n_used || 0) + '/' + (pop.n_trials || 0) + '구 · trial 수 부족 — 일관성 수치 참고만'
      };
    }

    var parts = [];
    parts.push((sum.population_note || ((pop.n_used || 0) + '/' + (pop.n_trials || 0) + '구')) + ' · 신뢰도 ' + (rel.label || rel.tier) + '(' + rel.tier + ')');
    if (rel.tier === 'C' || rel.tier === 'B') parts.push(rel.message || '추가 측정 권장');

    RELEASE_CONSISTENCY_KEYS.forEach(function (k) {
      var v = consistencyMetricValue(C, mc, k.key);
      if (v == null) return;
      var bl = repeatBandLabel(M6, NB, v, k.key);
      var short = k.label.replace(' 반복성', '');
      parts.push(short + ' ' + v + (k.unit || '') + (bl ? ' · ' + bl : ''));
    });

    var worst = findWorstDispersion(C);
    if (worst) {
      var wp = '분산 최대 · ' + (worst.label || worst.key) + ' 반복성 ' + worst.cv + '%';
      var hints = buildCommandCauseHints(mainLeak, DATA, ETDIAG);
      if (hints.length) wp += ' — ' + hints[0];
      parts.push(wp);
    }

    return {
      show: true,
      warning: rel.tier === 'C',
      tier: rel.tier,
      line: parts.join(' · '),
      worst: worst
    };
  }

  function buildCommandCauseHints(mainLeak, DATA, ETDIAG) {
    var hints = [];
    if (mainLeak === 'windup') hints.push('와인드업에서 팔·몸이 일찍 준비되면 릴리스 타이밍이 빨라질 수 있음');
    if (mainLeak === 'drive') hints.push('전진 방향·자세 유지가 불안정하면 착지·회전 타이밍이 흔들릴 수 있음');
    if (mainLeak === 'block') hints.push('착지 후 몸이 계속 앞으로 밀리면 릴리스 위치가 앞뒤로 변동할 수 있음');
    if (mainLeak === 'leadKneeTransfer') hints.push('앞다리-몸통 연결 타이밍이 불안정하면 릴리스 타이밍 변동 가능');
    if (mainLeak === 'trunk') hints.push('몸통이 일찍 열리면 공이 빠지거나 당겨질 방향성·타이밍 변동 가능');
    if (mainLeak === 'arm') hints.push('팔 의존이 크면 암슬롯·릴리스 타이밍 불안정 가능');
    var P = DATA && DATA.phases;
    if (P && P.earlyArm && P.earlyArm.label !== 'normal') hints.push('팔 조기 준비 → 릴리스 타이밍·암슬롯 변동');
    if (ETDIAG && ETDIAG.rep && ETDIAG.rep.flyingOpen) hints.push('조기 열림 → 방향성·릴리스 일관성에 영향 가능');
    return hints.slice(0, 3);
  }

  function buildCommandStabilityCard(DATA, ETDIAG, phaseBands, mainLeak, det6, M6, NB) {
    var base = buildConsistencyCoachCard(DATA, M6, NB);
    if (!base.show) return null;
    if (!commandRelatedRisk(DATA, ETDIAG, phaseBands, det6, M6, NB)) return null;
    var cmd = DATA && DATA.command;
    var hasLoc = !!(cmd && cmd.commandOutcome && cmd.commandOutcome.has_location);
    var rows = base.metrics;
    var overallRepeat = base.overallRepeat;
    var weakN = rows.filter(function (r) { return r.band === '반복성 낮음'; }).length;
    var noBallNote = hasLoc
      ? '공 위치 데이터 있음 — 존 일관성은 연구자 제구 탭에서 확인'
      : '공 위치 데이터가 없어 실제 제구 결과는 평가하지 않습니다. 릴리스 타이밍·암슬롯·보폭 반복성으로 제구 안정성 가능성을 확인합니다.';
    var summary = weakN
      ? '릴리스 반복성이 흔들리는 경향이 있습니다. 팔만의 문제가 아니라 착지 후 제동·몸통 회전·팔 전달 순서와 연결될 수 있습니다.'
      : '릴리스 위치와 타이밍이 비교적 일정해, 비슷한 방향으로 보낼 수 있는 상태에 가깝습니다.';
    var dirNote = '';
    var P = DATA.phases;
    if (P && P.scalars && P.scalars.openAng != null) {
      dirNote = '착지 방향·몸통 회전 방향이 흔들리면 릴리스가 일정해도 목표 방향에서 벗어날 수 있습니다.';
    }
    return {
      title: '제구 안정성',
      show: true,
      hasBallLocation: hasLoc,
      noBallNote: noBallNote,
      overallRepeat: overallRepeat,
      metrics: rows,
      summary: summary,
      directionNote: dirNote,
      causeHints: buildCommandCauseHints(mainLeak, DATA, ETDIAG),
      correction: '공을 놓는 위치를 억지로 맞추기보다, 착지 후 몸이 안정적으로 멈추고 몸통 회전 뒤에 팔이 따라오는 순서를 먼저 확인합니다.',
      nextMeasure: '릴리스 타이밍·암슬롯·보폭 반복성 + 방향성(openAng) 재측정',
      researchTab: 'command'
    };
  }

  function buildArmCoachBlocks(det6, DATA) {
    var arr = (det6 && det6.arm) || [];
    function row(keys) {
      return keys.map(function (k) {
        var m = arr.filter(function (x) { return x && x.key === k; })[0];
        if (!m) return null;
        var note = ARM_CTX_NOTE[k] || '';
        var bl = m.bandLabel || (m.neutral ? '맥락' : null);
        return { key: k, label: metricLabelKo(k, m), band: bl, bandWord: m.bandWord, note: note };
      }).filter(function (x) { return x; });
    }
    var blocks = [
      { title: '1. 팔 가속', rows: row(['armRotV', 'humME']) },
      { title: '2. 몸통→팔 전달', rows: row(['armTransferRatio', 'ppTrunkHum']) },
      { title: '3. 팔 부담·위험 신호', rows: row(['shGen', 'elbAbs', 'merPk', 'scapLoad']) }
    ];
    var P = DATA && DATA.phases;
    if (P && P.earlyArm && P.earlyArm.label && P.earlyArm.label !== 'normal') {
      blocks[2].rows.push({
        key: 'earlyArm',
        label: P.earlyArm.label === 'risk' ? '조기 장전 위험' : '조기 장전 주의',
        band: '주의',
        note: ARM_CTX_NOTE.earlyArm
      });
    }
    return blocks;
  }

  function computePhaseBands(DATA, ETDIAG, eliteProfile) {
    var M6 = _G().mech6;
    var NB = _G().BIOMOTION_NORMS;
    var det6 = M6 && M6.detail6 ? M6.detail6(DATA) : null;
    var out = {};
    STAGES.forEach(function (st) {
      var b;
      if (st.key === 'leadKneeTransfer') b = kneeBand(DATA, ETDIAG, det6, M6, NB);
      else if (st.key === 'arm') b = armBand(det6, M6, NB, ETDIAG, DATA);
      else {
        var arr = det6 && det6[st.mech] ? det6[st.mech] : [];
        b = countsToBand(M6 && M6.bandCounts ? M6.bandCounts(arr, NB) : null, eliteProfile);
      }
      if (eliteProfile && b) {
        if (b.bandCode === 'weak' || b.bandCode === 'caution') {
          b.band = eliteBandLabel(b.bandCode, b.band);
          b.leak = false;
          b.profileLow = true;
        }
      }
      if (ETDIAG && ETDIAG.stages) {
        var node = ETDIAG.stages.filter(function (s) { return mapEtKey(s.key) === st.key; })[0];
        if (node && node.status === 'bottleneck' && b.bandCode !== 'risk') {
          if (!eliteProfile) {
            b.leak = true;
            if (b.bandCode === 'ok' || b.bandCode === 'strong') { b.bandCode = 'caution'; b.band = '주의'; }
          } else {
            b.profileLow = true;
            if (b.bandCode === 'ok' || b.bandCode === 'strong') {
              b.bandCode = 'caution';
              b.band = '조건별 확인 필요';
            }
          }
        }
      }
      out[st.key] = b;
    });
    return out;
  }

  function buildEliteSessionContext(DATA) {
    var hasBaseline = !!(DATA && (DATA.baseline || DATA.storedBaseline
      || (DATA.player && DATA.player.baselineEstablished)));
    var nSessions = (DATA && DATA.sessions && DATA.sessions.length)
      || (DATA && DATA.session_meta && DATA.session_meta.count) || 1;
    var singleSession = nSessions <= 1 && !hasBaseline;
    return {
      singleSession: singleSession,
      hasOwnBaseline: hasBaseline,
      longitudinalAvailable: !singleSession && hasBaseline,
      fatigueAnalysisAvailable: false,
      baselineNote: hasBaseline ? null : '장기 baseline 없음',
      longitudinalNote: singleSession
        ? '단일 세션 — baseline 변화·피로 누적 단정 불가'
        : '다중 세션 — baseline·피로 축은 별도 메타·저장 데이터 필요',
      earlyLateNote: '초반·후반 비교는 세션 내 투구 순서 기준이며 피로를 의미하지 않음',
      allowedComparisons: ['fast_vs_slow', 'trial_consistency', 'best_vs_current', 'early_vs_late'],
      disabledComparisons: singleSession ? ['fatigue_vs_fresh', 'baseline_vs_current'] : ['command_good_vs_poor']
    };
  }

  function buildEliteProfileSummary(det6, M6, NB, phaseBands, conditionDelta, sessionCtx) {
    var highs = [], lows = [], seenH = {}, seenL = {};
    STAGES.forEach(function (st) {
      var arr = (det6 && det6[st.mech]) || [];
      arr.forEach(function (m) {
        if (!m || !COACH_METRICS[m.key] || m.neutral) return;
        var b = metricBand(M6, NB, m);
        var item = { phase: st.key, stage: st.label, label: metricLabelKo(m.key, m), key: m.key };
        if (b === '우수' && !seenH[m.key]) { seenH[m.key] = 1; highs.push(item); }
        if (b === '미흡' && !seenL[m.key]) { seenL[m.key] = 1; lows.push(item); }
      });
      var pb = phaseBands[st.key];
      if (pb && pb.profileLow && !seenL[st.key]) {
        seenL[st.key] = 1;
        lows.push({ phase: st.key, stage: st.label, label: st.label, key: st.key, fromPhase: true });
      }
    });
    var lines = [];
    if (highs.length) {
      var h0 = highs[0];
      lines.push('엘리트 집단 안에서 ' + h0.stage + '·' + h0.label + '은(는) 높은 편입니다.');
    }
    if (conditionDelta && conditionDelta.available && conditionDelta.topShifts && conditionDelta.topShifts[0]) {
      var t0 = conditionDelta.topShifts[0];
      lines.push('다만 ' + t0.labelKo + '은(는) trial 간 차이가 있어 조건별 확인이 필요합니다.');
    } else if (lows.length) {
      var l0 = lows[0];
      lines.push('다만 ' + l0.stage + (l0.fromPhase ? '' : ('·' + l0.label)) + '은(는) 코호트 내 상대적으로 낮은 편입니다.');
    }
    if (sessionCtx && sessionCtx.singleSession && sessionCtx.longitudinalNote) {
      lines.push(sessionCtx.longitudinalNote);
    }
    return {
      headline: lines[0] || '엘리트 코호트 프로필 요약',
      lines: lines,
      strengths: highs.slice(0, 3),
      relativeLows: lows.slice(0, 3)
    };
  }

  function pickMainLeak(phaseBands, ETDIAG, det6, M6, NB, eliteProfile) {
    if (ETDIAG && ETDIAG.bottlenecks && ETDIAG.bottlenecks[0]) {
      var ph = mapEtKey(ETDIAG.bottlenecks[0].key);
      if (ph && phaseBands[ph]) return ph;
    }
    var best = null, bestSc = -1;
    STAGES.forEach(function (st) {
      var pb = phaseBands[st.key];
      if (!pb) return;
      var flagged = eliteProfile ? (pb.profileLow || pb.bandCode === 'weak' || pb.bandCode === 'caution') : pb.leak;
      if (!flagged) return;
      var sc = pb.bandCode === 'weak' ? 100 : (pb.bandCode === 'caution' ? 60 : 30);
      if (st.key === 'block' || st.key === 'trunk') sc += 25;
      if (sc > bestSc) { bestSc = sc; best = st.key; }
    });
    if (best) return best;
    return null;
  }

  function weakMetric(det6, mechKey, M6, NB, coachOnly) {
    var arr = (det6 && det6[mechKey]) || [];
    var worst = null, wr = 99;
    arr.forEach(function (m) {
      if (!m || m.neutral) return;
      if (coachOnly && !COACH_METRICS[m.key]) return;
      var b = metricBand(M6, NB, m);
      var r = b === '미흡' ? 0 : (b === '정상' ? 1 : 2);
      if (r < wr) { wr = r; worst = m; }
    });
    return worst;
  }

  function buildOverall(mainLeak, ETDIAG, phaseBands, eliteProfile, eliteProfileSummary) {
    var stLeak = STAGES.filter(function (s) { return s.key === mainLeak; })[0];
    var tpl = (mainLeak && CAUSE_EFFECT[mainLeak]) || CAUSE_EFFECT.block;
    var pbLeak = mainLeak ? phaseBands[mainLeak] : null;
    var overall = {
      mainLeakPhase: mainLeak,
      mainLeakLabel: stLeak ? stLeak.label : null,
      headline: mainLeak
        ? ('가장 큰 에너지 누수 후보: ' + stLeak.label)
        : '뚜렷한 누수 단계 없음 — 유지·반복성 점검',
      mainCause: tpl.cause,
      mainConsequence: tpl.consequence,
      mainCorrection: mainLeak ? (DRILL[mainLeak] || PHASE_DICT[mainLeak].correction) : '반복 투구에서 동작 일관성 유지'
    };
    if (eliteProfile) {
      overall.mainLeakLabel = stLeak ? stLeak.label : null;
      overall.mainLeakDisplay = pbLeak && pbLeak.profileLow
        ? ('상대적으로 낮은 축 · ' + stLeak.label)
        : (stLeak ? stLeak.label : null);
      overall.headline = (eliteProfileSummary && eliteProfileSummary.headline)
        || (mainLeak && stLeak
          ? ('엘리트 코호트 내 ' + stLeak.label + ' 구간 — ' + (pbLeak ? pbLeak.band : '프로필 확인'))
          : '엘리트 코호트 프로필 — 세션 내 trial 비교 중심');
      overall.mainCorrection = mainLeak
        ? ('조건별 재현·trial 일관성 확인 · ' + (DRILL[mainLeak] || PHASE_DICT[mainLeak].correction))
        : '세션 내 fast/slow·반복성 위주 확인';
    } else if (ETDIAG && ETDIAG.headline && mainLeak) {
      overall.headline = ETDIAG.headline;
    }
    return overall;
  }

  function pickKeyIssues(DATA, ETDIAG, phaseBands, eliteProfile) {
    var M6 = _G().mech6;
    var NB = _G().BIOMOTION_NORMS;
    var det6 = M6 && M6.detail6 ? M6.detail6(DATA) : null;
    var cands = [];
    (ETDIAG && ETDIAG.bottlenecks || []).forEach(function (b, i) {
      var ph = mapEtKey(b.key);
      if (!ph) return;
      cands.push({ phase: ph, score: 50 - i * 15, raw: b, source: 'etdiag' });
    });
    STAGES.forEach(function (st) {
      var pb = phaseBands[st.key];
      var bandFlag = pb && (pb.leak || (eliteProfile && pb.profileLow)) && !pb.loadRisk;
      if (bandFlag) {
        var wm = weakMetric(det6, st.mech, M6, NB, true);
        if (!(wm && wm.dir === 'range')) {
          cands.push({ phase: st.key, score: 40 + (pb.bandCode === 'weak' ? 20 : 0), source: 'band' });
        }
      }
      if (pb && pb.loadRisk) {
        cands.push({ phase: st.key, score: 38, source: 'load' });
      }
    });
    var P = DATA.phases || {};
    (P.strideRisk || []).forEach(function () { cands.push({ phase: 'drive', score: 30, source: 'risk' }); });
    (P.windupRisk || []).forEach(function () { cands.push({ phase: 'windup', score: 28, source: 'risk' }); });
    if (P.earlyArm && P.earlyArm.label === 'risk') {
      cands.push({ phase: 'windup', score: 32, source: 'risk' });
      cands.push({ phase: 'arm', score: 35, source: 'risk' });
    } else if (P.earlyArm && P.earlyArm.label === 'warn') {
      cands.push({ phase: 'arm', score: 28, source: 'risk' });
    }

    cands.sort(function (a, b) { return b.score - a.score; });
    var picked = [], seen = {};
    for (var i = 0; i < cands.length && picked.length < 2; i++) {
      var c = cands[i];
      if (seen[c.phase]) continue;
      seen[c.phase] = true;
      var st = STAGES.filter(function (s) { return s.key === c.phase; })[0];
      var dict = PHASE_DICT[c.phase] || {};
      var title = dict.issue;
      var why = dict.why;
      var correction = dict.correction;
      var relatedKeys = [];
      if (c.source === 'load' || (c.phase === 'arm' && c.source === 'risk')) {
        title = (c.phase === 'arm' && c.source === 'risk') ? '팔 조기 장전·몸통 전달 불일치' : '팔이 몸통 대신 일을 하는 경향';
        why = '어깨·팔꿈치 부담이 커질 수 있음';
        if (c.phase === 'arm' && P.earlyArm && P.earlyArm.label !== 'normal') correction = ARM_CTX_NOTE.earlyArm;
      }
      if (c.raw && c.raw.story) {
        if (c.raw.story.meaning) why = c.raw.story.meaning;
        if (c.raw.story.improve) correction = c.raw.story.improve;
      }
      if (ETDIAG && ETDIAG.bottlenecks) {
        var bn = ETDIAG.bottlenecks.filter(function (b) { return mapEtKey(b.key) === c.phase; })[0];
        if (bn) {
          if (bn.label) title = bn.label.replace(/ \(.*\)/, '');
        }
      }
      var wm = st ? weakMetric(det6, st.mech, M6, NB, true) : null;
      if (wm && wm.key) relatedKeys.push(wm.key);
      if (eliteProfile) {
        var wmKo = wm ? metricLabelKo(wm.key, wm) : dict.label;
        title = '상대적으로 낮은 편 · ' + (wmKo || dict.label);
        why = '엘리트 코호트 내 낮은 범위 — 결함 단정보다 조건별·trial 간 확인 우선';
      }
      var hi = HIGHLIGHT[c.phase] || HIGHLIGHT.block;
      var ce = CAUSE_EFFECT[c.phase] || {};
      picked.push({
        phase: c.phase,
        phaseLabel: dict.label || st.label,
        title: title,
        problem: title,
        why: why,
        downstreamImpact: ce.consequence || dict.why,
        correction: correction,
        relatedMetrics: relatedKeys,
        relatedMetricsKo: mapMetricsKo(relatedKeys, det6, c.phase, M6, NB),
        eventWindow: { label: hi.label, startEv: hi.startEv, endEv: hi.endEv },
        researchTab: st ? st.researchTab : 'etdiag'
      });
    }
    if (!picked.length && ETDIAG && ETDIAG.headline) {
      var ph0 = pickMainLeak(phaseBands, ETDIAG, det6, M6, NB) || 'block';
      picked.push({
        phase: ph0,
        phaseLabel: (PHASE_DICT[ph0] || {}).label,
        title: ETDIAG.headline,
        problem: ETDIAG.headline,
        why: '종합 진단 요약',
        downstreamImpact: (CAUSE_EFFECT[ph0] || {}).consequence || '',
        correction: '유지·반복성 점검 후 다음 측정에서 동일 구간 재확인',
        relatedMetrics: [],
        relatedMetricsKo: [],
        eventWindow: (HIGHLIGHT[ph0] || HIGHLIGHT.block),
        researchTab: 'etdiag'
      });
    }
    return picked;
  }

  function resolvePlayerTier(DATA) {
    var t = DATA && DATA.playerTier;
    if (t === 'pro' || t === 'elite' || t === 'amateur') return t;
    try {
      var ls = (typeof localStorage !== 'undefined') ? localStorage.getItem(PLAYER_TIER_KEY) : null;
      if (ls === 'pro' || ls === 'elite' || ls === 'amateur') return ls;
    } catch (e) { }
    if (isNormCohortMember(DATA)) return 'elite';
    return 'amateur';
  }

  var CONDITION_AXIS_ORDER = [
    'fast_vs_slow', 'command_good_vs_poor', 'early_vs_late', 'fatigue_vs_fresh',
    'baseline_vs_current', 'best_vs_current'
  ];

  var CONDITION_AXIS_META = {
    fast_vs_slow: { labelKo: '빠른 vs 느린', baseLabel: '빠른 구', compareLabel: '느린 구' },
    command_good_vs_poor: { labelKo: '존 적중 vs miss', baseLabel: '존 적중', compareLabel: 'miss' },
    early_vs_late: { labelKo: '초반 vs 후반 (세션 순서)', baseLabel: '초반 구', compareLabel: '후반 구' },
    fatigue_vs_fresh: { labelKo: '피로 vs fresh (메타 필요)', baseLabel: '피로 구간', compareLabel: 'fresh 구간' },
    baseline_vs_current: { labelKo: 'baseline vs 오늘', baseLabel: 'baseline', compareLabel: '오늘' },
    best_vs_current: { labelKo: '최고 vs 대표', baseLabel: '최고 구', compareLabel: '대표 구' }
  };

  function trialsWithVelocity(DATA) {
    return ((DATA && DATA.trials) || []).filter(function (t) {
      return t.rapsodo && t.rapsodo.velocity_kmh != null && isFinite(t.rapsodo.velocity_kmh);
    });
  }

  function pickFastSlowTrials(DATA) {
    var withV = trialsWithVelocity(DATA);
    if (withV.length < 2) return null;
    var fast = withV[0], slow = withV[0];
    withV.forEach(function (t) {
      if (t.rapsodo.velocity_kmh > fast.rapsodo.velocity_kmh) fast = t;
      if (t.rapsodo.velocity_kmh < slow.rapsodo.velocity_kmh) slow = t;
    });
    if (fast === slow) return null;
    return {
      axis: 'fast_vs_slow', base: fast, compare: slow,
      baseKmh: fast.rapsodo.velocity_kmh, compareKmh: slow.rapsodo.velocity_kmh
    };
  }

  function pickTrialByVel(pool, mode) {
    if (!pool || !pool.length) return null;
    var pick = pool[0];
    pool.forEach(function (t) {
      var v = t.rapsodo.velocity_kmh;
      if (mode === 'max' && v > pick.rapsodo.velocity_kmh) pick = t;
      if (mode === 'min' && v < pick.rapsodo.velocity_kmh) pick = t;
    });
    return pick;
  }

  // early_vs_late: DATA.trials[] 순서(조립 시 trial 파일 정렬) · 피로 단정 금지 — docs/condition_axis_data_contract.md
  function pickEarlyLateTrials(DATA) {
    var withV = trialsWithVelocity(DATA);
    if (withV.length < 6) return null;
    var third = Math.max(2, Math.ceil(withV.length / 3));
    var earlyPool = withV.slice(0, third);
    var latePool = withV.slice(withV.length - third);
    var early = pickTrialByVel(earlyPool, 'max');
    var late = pickTrialByVel(latePool, 'min');
    if (!early || !late || early === late) return null;
    return {
      axis: 'early_vs_late', base: early, compare: late,
      baseKmh: early.rapsodo.velocity_kmh, compareKmh: late.rapsodo.velocity_kmh
    };
  }

  function pickCommandGoodPoorTrials(DATA) {
    if (!DATA || !DATA.command || !DATA.command.has_rapsodo_location) return null;
    var withV = trialsWithVelocity(DATA);
    if (withV.length < 2) return null;
    var good = [], poor = [];
    withV.forEach(function (t) {
      var r = t.rapsodo;
      if (!r || !r.command_outcome) return;
      if (r.command_outcome === 'good') good.push(t);
      if (r.command_outcome === 'poor') poor.push(t);
    });
    if (!good.length || !poor.length) return null;
    var goodPick = pickTrialByVel(good, 'max');
    var poorPick = pickTrialByVel(poor, 'max');
    if (!goodPick || !poorPick || goodPick === poorPick) return null;
    return {
      axis: 'command_good_vs_poor', base: goodPick, compare: poorPick,
      baseKmh: goodPick.rapsodo.velocity_kmh, compareKmh: poorPick.rapsodo.velocity_kmh
    };
  }

  /** bl1 스냅샷 → flat metrics (계산 변경 없음) */
  function metricsFromBaseline(DATA) {
    var bl = DATA && (DATA.baseline || DATA.storedBaseline);
    if (!bl || !bl.stages) return null;
    var out = {};
    Object.keys(bl.stages).forEach(function (stg) {
      var mx = bl.stages[stg] && bl.stages[stg].metrics;
      if (!mx) return;
      Object.keys(mx).forEach(function (k) {
        if (mx[k] != null && isFinite(mx[k])) out[k] = mx[k];
      });
    });
    return Object.keys(out).length ? out : null;
  }

  function resolveFatigueTrialIndices(window, DATA) {
    if (!window) return [];
    if (window.trial_indices && window.trial_indices.length) return window.trial_indices.slice();
    var trials = (DATA && DATA.trials) || [];
    if (window.pitch_nos && window.pitch_nos.length) {
      var nos = window.pitch_nos;
      var idx = [];
      trials.forEach(function (t, i) {
        var pn = t.pitch_no != null ? t.pitch_no : (t.rapsodo && t.rapsodo.pitch_no);
        if (pn != null && nos.indexOf(pn) >= 0) idx.push(i);
      });
      return idx;
    }
    return [];
  }

  function pickTrialFromIndexPool(indices, DATA, mode) {
    var trials = (DATA && DATA.trials) || [];
    var pool = indices.map(function (i) { return trials[i]; }).filter(function (t) {
      return t && t.rapsodo && isFinite(t.rapsodo.velocity_kmh);
    });
    if (!pool.length) return null;
    return pickTrialByVel(pool, mode || 'max');
  }

  /** PoC — docs/baseline_vs_current_data_contract.md · bl1 있을 때만 */
  function pickBaselineCurrentTrials(DATA) {
    if (!DATA) return null;
    var baseM = metricsFromBaseline(DATA);
    if (!baseM) return null;
    var withV = trialsWithVelocity(DATA);
    if (!withV.length) return null;
    var bi = (DATA.best_trial_index || 1) - 1;
    var allTrials = DATA.trials || [];
    var cur = (bi >= 0 && bi < allTrials.length && allTrials[bi].rapsodo
      && isFinite(allTrials[bi].rapsodo.velocity_kmh)) ? allTrials[bi] : null;
    if (!cur) cur = pickTrialByVel(withV, 'max');
    if (!cur) return null;
    var bl = DATA.baseline || DATA.storedBaseline;
    var baseKmh = bl && bl.measured_kmh != null && isFinite(bl.measured_kmh)
      ? bl.measured_kmh : null;
    var compareKmh = cur.rapsodo.velocity_kmh;
    return {
      axis: 'baseline_vs_current',
      isBaseline: true,
      baselineMetrics: baseM,
      compare: cur,
      base: cur,
      baseKmh: baseKmh != null ? baseKmh : compareKmh,
      compareKmh: compareKmh
    };
  }

  /** PoC — docs/fatigue_vs_fresh_metadata_policy.md · fm1 + trial window */
  function pickFatigueFreshTrials(DATA) {
    if (!hasFatigueMeta(DATA)) return null;
    var f = DATA.session_meta.fatigue;
    var freshIdx = resolveFatigueTrialIndices(f.fresh_window, DATA);
    var fatiguedIdx = resolveFatigueTrialIndices(f.fatigued_window, DATA);
    if (!freshIdx.length || !fatiguedIdx.length) return null;
    var fresh = pickTrialFromIndexPool(freshIdx, DATA, 'max');
    var fatigued = pickTrialFromIndexPool(fatiguedIdx, DATA, 'min');
    if (!fresh || !fatigued || fresh === fatigued) return null;
    return {
      axis: 'fatigue_vs_fresh',
      base: fatigued,
      compare: fresh,
      baseKmh: fatigued.rapsodo.velocity_kmh,
      compareKmh: fresh.rapsodo.velocity_kmh
    };
  }

  function pickBestCurrentTrials(DATA) {
    var withV = trialsWithVelocity(DATA);
    if (withV.length < 2) return null;
    var best = pickTrialByVel(withV, 'max');
    var bi = (DATA.best_trial_index || 1) - 1;
    var allTrials = (DATA && DATA.trials) || [];
    var curTrial = (bi >= 0 && bi < allTrials.length) ? allTrials[bi] : null;
    var cur = null;
    if (curTrial && curTrial.rapsodo && isFinite(curTrial.rapsodo.velocity_kmh)) cur = curTrial;
    if (!cur) cur = withV[Math.floor(withV.length / 2)];
    if (!best || !cur || best === cur) return null;
    return {
      axis: 'best_vs_current', base: best, compare: cur,
      baseKmh: best.rapsodo.velocity_kmh, compareKmh: cur.rapsodo.velocity_kmh
    };
  }

  function trialsWithVelocityCount(DATA) {
    return trialsWithVelocity(DATA).length;
  }

  function hasFatigueMeta(DATA) {
    var sm = DATA && DATA.session_meta;
    if (!sm || !sm.fatigue) return false;
    var f = sm.fatigue;
    var hasWin = function (w) {
      return w && ((w.trial_indices && w.trial_indices.length)
        || (w.pitch_nos && w.pitch_nos.length));
    };
    return !!(f.rpe != null || f.inning != null || f.pitch_count != null
      || f.session_block || hasWin(f.fresh_window) || hasWin(f.fatigued_window)
      || (f.trial_tags && f.trial_tags.length));
  }

  function earlyLateUnavailableReason(DATA) {
    var nV = trialsWithVelocityCount(DATA);
    if (nV < 6) return '구속 trial 6구 미만 — 초반·후반 비교 불가';
    if (!pickEarlyLateTrials(DATA)) return '초반·후반 대표 trial 분리 불가(동일 구·풀 부족)';
    return null;
  }

  function baselineUnavailableReason(DATA, sessionCtx) {
    var hasFlag = !!(sessionCtx && sessionCtx.hasOwnBaseline)
      || !!(DATA && (DATA.player && DATA.player.baselineEstablished));
    var hasBl = !!(DATA && metricsFromBaseline(DATA));
    if (!hasBl && !hasFlag) {
      return '저장된 baseline 세션 없음 — 과거 측정 메카닉 스냅샷(bl1) 필요';
    }
    if (!hasBl) return 'baseline 플래그만 있음 — bl1 스냅샷(stages.metrics) 필요';
    if (!trialsWithVelocity(DATA).length) return '현재 세션 구속 trial 없음';
    if (!pickBaselineCurrentTrials(DATA)) return 'baseline vs 오늘 대표 trial 매칭 불가';
    return null;
  }

  function fatigueUnavailableReason(DATA) {
    if (!hasFatigueMeta(DATA)) {
      return '피로 메타 없음 — 세션 순서 비교는 「초반 vs 후반」 축 사용(피로 단정 아님)';
    }
    if (!trialsWithVelocity(DATA).length) return '구속 trial 없음 — fatigue 비교 불가';
    if (!pickFatigueFreshTrials(DATA)) {
      return '피로·fresh 구간 trial 매칭 불가 — fresh_window/fatigued_window 검증';
    }
    return null;
  }

  function listConditionAxes(DATA, sessionCtx) {
    var cmdOk = DATA && DATA.command && DATA.command.has_rapsodo_location;
    var cmdPair = pickCommandGoodPoorTrials(DATA);
    var earlyPair = pickEarlyLateTrials(DATA);
    var fatiguePair = pickFatigueFreshTrials(DATA);
    var baselinePair = pickBaselineCurrentTrials(DATA);
    var spec = {
      fast_vs_slow: {
        available: !!pickFastSlowTrials(DATA),
        reason: '구속 차이 있는 유효 trial 2구 이상 필요'
      },
      early_vs_late: {
        available: !!earlyPair,
        reason: earlyLateUnavailableReason(DATA)
      },
      best_vs_current: {
        available: !!pickBestCurrentTrials(DATA),
        reason: '구속 있는 trial 2구 이상·대표 trial 필요'
      },
      command_good_vs_poor: {
        available: !!cmdPair,
        reason: cmdPair ? null : (cmdOk ? 'strike·miss 양쪽 trial 매칭 부족' : '랩소도 로케이션 부족')
      },
      fatigue_vs_fresh: {
        available: !!fatiguePair,
        reason: fatiguePair ? null : fatigueUnavailableReason(DATA)
      },
      baseline_vs_current: {
        available: !!baselinePair,
        reason: baselinePair ? null : baselineUnavailableReason(DATA, sessionCtx)
      }
    };
    return CONDITION_AXIS_ORDER.map(function (id) {
      var m = CONDITION_AXIS_META[id] || { labelKo: id };
      var s = spec[id] || { available: false, reason: '준비 중' };
      return {
        id: id,
        labelKo: m.labelKo,
        available: !!s.available,
        reason: s.available ? null : (s.reason || '준비 중')
      };
    });
  }

  function resolveConditionAxisTrials(DATA, axisId) {
    var pickers = {
      fast_vs_slow: pickFastSlowTrials,
      early_vs_late: pickEarlyLateTrials,
      best_vs_current: pickBestCurrentTrials,
      command_good_vs_poor: pickCommandGoodPoorTrials,
      fatigue_vs_fresh: pickFatigueFreshTrials,
      baseline_vs_current: pickBaselineCurrentTrials
    };
    var fn = pickers[axisId];
    return fn ? fn(DATA) : null;
  }

  function resolveConditionDeltaSlice(conditionDelta, axisId) {
    if (!conditionDelta || !axisId) return null;
    if (conditionDelta.axisSlices && conditionDelta.axisSlices[axisId]) {
      return conditionDelta.axisSlices[axisId];
    }
    if (conditionDelta.axis === axisId && conditionDelta.available) return conditionDelta;
    var alt = (conditionDelta.alternateAxes || []).filter(function (a) {
      return a.axis === axisId && a.available;
    })[0];
    return alt || null;
  }

  function trialMetricsFromPhases(trial, DATA) {
    var G = _G();
    if (!G.phases || !G.phases.compute || !trial) return null;
    try {
      var P = G.phases.compute(trial, DATA.player, DATA.energy_transfer, [trial], DATA.command);
      var out = {};
      if (P && P.stages) {
        P.stages.forEach(function (st) {
          (st.metrics || []).forEach(function (m) {
            if (m.key && m.value != null && isFinite(m.value)) out[m.key] = m.value;
          });
        });
      }
      return out;
    } catch (e) { return null; }
  }

  function metricDirForKey(det6, key) {
    var dir = 1;
    STAGES.forEach(function (st) {
      var arr = (det6 && det6[st.mech]) ? det6[st.mech] : [];
      arr.forEach(function (m) {
        if (m && m.key === key && m.dir != null) dir = m.dir;
      });
    });
    return dir;
  }

  function scalarBand(M6, NB, det6, key, val) {
    if (val == null || !isFinite(val) || !M6 || !NB || !NB[key]) return null;
    return M6.band(val, NB[key], metricDirForKey(det6, key));
  }

  function shiftEvalSide(shift) {
    if (shift.worseOnSlow) return 'worseOnSlow';
    if (shift.higherBetter === null) return 'worseOnSlow';
    return 'betterOnFast';
  }

  function detectCompensationPattern(shifts) {
    var transfer = null, armRot = null;
    (shifts || []).forEach(function (s) {
      if (s.key === 'armTransferRatio') transfer = s;
      if (s.key === 'armRotV') armRot = s;
    });
    if (!transfer || !transfer.worseOnSlow) return null;
    if (armRot && !armRot.worseOnSlow) {
      return {
        classification: 'compensation_pattern',
        mechanicLine: '구속은 유지되고 있지만, 몸통에서 팔로 넘어가는 전달이 낮아지고 팔 부하 지표가 증가했습니다.',
        energyExplanation: '성능을 유지하기 위해 팔이 보상적으로 더 일하는 패턴일 수 있으므로, 단순히 구속 유지만으로 좋은 상태로 판단하면 안 됩니다.',
        coachImplication: '몸통 전달 회복과 팔 부하 감소를 함께 다음 측정에서 확인해야 합니다.',
        downstreamEffect: ['arm_load_increase', 'shoulder_load'],
        role: 'load', affectedStage: 'arm', direction: 'compensated'
      };
    }
    return null;
  }

  function buildEnergyFlowImpact(shift, evalPack, compensation) {
    if (compensation && (shift.key === 'armTransferRatio' || shift.key === 'armRotV')) {
      return {
        affectedStage: compensation.affectedStage,
        role: compensation.role,
        direction: compensation.direction,
        explanationKo: compensation.energyExplanation,
        downstreamEffect: compensation.downstreamEffect || []
      };
    }
    if (!evalPack) {
      return {
        affectedStage: shift.phase,
        role: shift.signal || 'uncertain',
        direction: 'uncertain',
        explanationKo: '조건별 변화가 에너지 흐름에 미친 영향은 추가 맥락 확인이 필요합니다.',
        downstreamEffect: []
      };
    }
    var dir = 'uncertain';
    if (evalPack.classification === 'beneficial_change') dir = 'better';
    else if (evalPack.classification === 'negative_change') dir = 'worse';
    else if (evalPack.classification === 'compensation_pattern' || evalPack.classification === 'load_shift') dir = 'compensated';
    else if (evalPack.classification === 'neutral_variation') dir = 'uncertain';
    return {
      affectedStage: evalPack.affectedStage || shift.phase,
      role: evalPack.role || shift.signal,
      direction: dir,
      explanationKo: evalPack.energyExplanation,
      downstreamEffect: evalPack.downstreamEffect || []
    };
  }

  function enrichShiftWithEvaluation(shift, allShifts) {
    var reg = MECHANIC_EVAL_REGISTRY[shift.key];
    var side = shiftEvalSide(shift);
    var tpl = reg ? reg[side] : null;
    var compensation = detectCompensationPattern(allShifts);
    if (compensation && (shift.key === 'armTransferRatio' || (shift.key === 'armRotV' && !shift.worseOnSlow))) {
      tpl = compensation;
    }
    if (!tpl) {
      var dict = PHASE_DICT[shift.phase] || {};
      var ce = CAUSE_EFFECT[shift.phase] || {};
      var cls = shift.worseOnSlow ? 'negative_change' : (shift.higherBetter === null ? 'neutral_variation' : 'beneficial_change');
      tpl = {
        classification: cls,
        mechanicLine: (shift.worseOnSlow ? '느린 구에서 ' : '빠른 구에서 ') + (shift.labelKo || shift.key) + ' ' + shift.deltaSummary
          + (shift.worseOnSlow ? ' · ' + (ce.consequence || dict.why || '') : ''),
        energyExplanation: ce.consequence || dict.why || '에너지 흐름 영향은 해당 단계 맥락에서 확인이 필요합니다.',
        coachImplication: ce.correction || dict.correction || '다음 측정에서 동일 구간 재확인',
        downstreamEffect: [],
        affectedStage: shift.phase,
        role: shift.signal
      };
    }
    var energyFlowImpact = buildEnergyFlowImpact(shift, Object.assign({ affectedStage: reg && reg.affectedStage, role: reg && reg.role }, tpl), compensation);
    return Object.assign({}, shift, {
      mechanicEvaluation: tpl.classification,
      mechanicEvaluationLabel: MECHANIC_EVAL_LABELS[tpl.classification] || tpl.classification,
      mechanicLine: tpl.mechanicLine,
      energyFlowImpact: energyFlowImpact,
      coachImplication: tpl.coachImplication
    });
  }

  function buildPhaseSummary(shifts) {
    var byPhase = {}, topPhase = null, topCount = 0;
    (shifts || []).forEach(function (s) {
      if (!s.phase) return;
      byPhase[s.phase] = (byPhase[s.phase] || 0) + 1;
      if (byPhase[s.phase] > topCount) { topCount = byPhase[s.phase]; topPhase = s.phase; }
    });
    var dict = topPhase ? (PHASE_DICT[topPhase] || {}) : {};
    var st = STAGES.filter(function (x) { return x.key === topPhase; })[0];
    return {
      primaryPhase: topPhase,
      primaryPhaseLabel: dict.label || (st && st.label) || '',
      shiftCount: shifts.length,
      byPhase: byPhase
    };
  }

  function buildAggregateMechanicEval(shifts, phaseSummary) {
    var top = shifts[0];
    if (!top) return null;
    var neg = shifts.filter(function (s) { return s.mechanicEvaluation === 'negative_change'; });
    var comp = shifts.filter(function (s) { return s.mechanicEvaluation === 'compensation_pattern' || s.mechanicEvaluation === 'load_shift'; });
    var summaryLine = top.mechanicLine;
    if (neg.length >= 2 && phaseSummary.primaryPhase === 'block') {
      summaryLine = '블로킹 이후 전진 에너지가 몸통 회전으로 전환되는 과정이 약해진 패턴입니다.';
    } else if (comp.length) {
      summaryLine = comp[0].mechanicLine;
    }
    return {
      primaryShiftKey: top.key,
      classification: top.mechanicEvaluation,
      summaryLine: summaryLine,
      energySummary: top.energyFlowImpact && top.energyFlowImpact.explanationKo,
      coachImplication: top.coachImplication
    };
  }

  function buildShiftsFromMetrics(baseM, compareM, M6, NB, det6) {
    var shifts = [];
    CONDITION_DELTA_KEYS.forEach(function (spec) {
      var fv = baseM[spec.key], sv = compareM[spec.key];
      if (fv == null || sv == null || !isFinite(fv) || !isFinite(sv)) return;
      var delta = Math.round((sv - fv) * 100) / 100;
      var pct = (fv !== 0) ? Math.round((delta / Math.abs(fv)) * 100) : null;
      if (pct != null && Math.abs(pct) < 3 && Math.abs(delta) < 0.05) return;
      var worseOnSlow = false;
      if (spec.higherBetter === true) worseOnSlow = sv < fv;
      else if (spec.higherBetter === false) worseOnSlow = sv > fv;
      var dirWord = delta > 0 ? '증가' : (delta < 0 ? '감소' : '유사');
      shifts.push({
        key: spec.key,
        labelKo: spec.labelKo,
        unit: spec.unit || '',
        phase: spec.phase,
        signal: spec.signal,
        base: fv,
        compare: sv,
        delta: delta,
        deltaPct: pct,
        direction: dirWord,
        worseOnSlow: worseOnSlow,
        fastBand: scalarBand(M6, NB, det6, spec.key, fv),
        slowBand: scalarBand(M6, NB, det6, spec.key, sv),
        deltaSummary: (pct != null ? ((pct > 0 ? '+' : '') + pct + '%') : (dirWord + ' ' + Math.abs(delta)))
      });
    });
    shifts.sort(function (a, b) {
      var sa = Math.abs(a.deltaPct != null ? a.deltaPct : a.delta);
      var sb = Math.abs(b.deltaPct != null ? b.deltaPct : b.delta);
      return sb - sa;
    });
    return shifts.map(function (s) { return enrichShiftWithEvaluation(s, shifts); });
  }

  function buildConditionDeltaForPair(pair, DATA, M6, NB, det6) {
    if (!pair) return { available: false, topShifts: [], phaseSummary: {} };
    var baseM = pair.isBaseline && pair.baselineMetrics
      ? pair.baselineMetrics
      : trialMetricsFromPhases(pair.base, DATA);
    var compareM = trialMetricsFromPhases(pair.compare, DATA);
    if (!baseM || !compareM) return { available: false, topShifts: [], phaseSummary: {} };
    var topShifts = buildShiftsFromMetrics(baseM, compareM, M6, NB, det6).slice(0, 5);
    var phaseSummary = buildPhaseSummary(topShifts);
    var meta = CONDITION_AXIS_META[pair.axis] || { labelKo: pair.axis, baseLabel: 'A', compareLabel: 'B' };
    var trials = (DATA && DATA.trials) || [];
    var bi = pair.isBaseline ? null : trials.indexOf(pair.base);
    var ci = trials.indexOf(pair.compare);
    return {
      available: topShifts.length > 0,
      axis: pair.axis,
      axisLabelKo: meta.labelKo,
      version: 'cd3',
      base: { velocity_kmh: Math.round(pair.baseKmh * 10) / 10, label: meta.baseLabel },
      compare: { velocity_kmh: Math.round(pair.compareKmh * 10) / 10, label: meta.compareLabel },
      baseTrialIndex: bi >= 0 ? bi : null,
      compareTrialIndex: ci >= 0 ? ci : null,
      topShifts: topShifts,
      phaseSummary: phaseSummary,
      mechanicEvaluation: buildAggregateMechanicEval(topShifts, phaseSummary)
    };
  }

  function buildConditionDelta(DATA, M6, NB, det6, sessionCtx) {
    var axes = listConditionAxes(DATA, sessionCtx);
    var pairs = {
      fast_vs_slow: pickFastSlowTrials(DATA),
      early_vs_late: pickEarlyLateTrials(DATA),
      best_vs_current: pickBestCurrentTrials(DATA),
      command_good_vs_poor: pickCommandGoodPoorTrials(DATA),
      fatigue_vs_fresh: pickFatigueFreshTrials(DATA),
      baseline_vs_current: pickBaselineCurrentTrials(DATA)
    };
    var slices = {};
    ['fast_vs_slow', 'early_vs_late', 'best_vs_current', 'command_good_vs_poor',
      'fatigue_vs_fresh', 'baseline_vs_current'].forEach(function (ax) {
      if (!pairs[ax]) return;
      var s = buildConditionDeltaForPair(pairs[ax], DATA, M6, NB, det6);
      if (s.available) slices[ax] = s;
    });
    var primaryAxis = slices.fast_vs_slow ? 'fast_vs_slow'
      : (slices.best_vs_current ? 'best_vs_current'
        : (slices.early_vs_late ? 'early_vs_late' : 'fast_vs_slow'));
    var primary = slices[primaryAxis] || {
      available: false, axis: 'fast_vs_slow', axisLabelKo: '빠른 vs 느린',
      topShifts: [], phaseSummary: {}, mechanicEvaluation: null
    };
    primary.availableAxes = axes;
    primary.axisSlices = slices;
    primary.alternateAxes = Object.keys(slices).filter(function (ax) {
      return ax !== primaryAxis;
    }).map(function (ax) { return slices[ax]; });
    return primary;
  }

  function l1BandForMetric(det6, M6, NB, key) {
    var found = null;
    STAGES.forEach(function (st) {
      var arr = (det6 && det6[st.mech]) ? det6[st.mech] : [];
      arr.forEach(function (m) {
        if (m && m.key === key) found = { phase: st.key, band: metricBand(M6, NB, m), bandLabel: m.bandLabel };
      });
    });
    return found;
  }

  function buildNarrativeReconciliation(phaseBands, conditionDelta, playerTier, mainLeak, keyIssues, det6, M6, NB, eliteProfile) {
    var cases = [], headline = null, footnoteL1 = '', mechanicHeadline = null, energyHeadline = null;
    var stLeak = mainLeak ? STAGES.filter(function (s) { return s.key === mainLeak; })[0] : null;
    var pbLeak = mainLeak ? (phaseBands[mainLeak] || {}) : {};
    if (mainLeak && stLeak) {
      footnoteL1 = eliteProfile
        ? ('엘리트 코호트 내 상대 위치 · ' + stLeak.label + ' · ' + (pbLeak.band || '—'))
        : ('현재 세션 기준 약한 축: ' + stLeak.label + ' · ' + (pbLeak.band || '—'));
    }
    var displayPolicy = {
      headlineSource: (playerTier === 'pro' || playerTier === 'elite') ? 'l3' : 'l1',
      footnoteSource: 'l1',
      hideL3: playerTier === 'amateur',
      eliteProfileMode: !!eliteProfile
    };
    if (!conditionDelta || !conditionDelta.available || displayPolicy.hideL3) {
      return {
        version: 'nr2', playerTier: playerTier, cases: cases, headline: headline,
        mechanicHeadline: mechanicHeadline, energyHeadline: energyHeadline,
        footnoteL1: footnoteL1, displayPolicy: displayPolicy
      };
    }
    var top = conditionDelta.topShifts[0];
    var mech = conditionDelta.mechanicEvaluation;
    if (top) {
      mechanicHeadline = top.mechanicLine || (mech && mech.summaryLine);
      energyHeadline = (top.energyFlowImpact && top.energyFlowImpact.explanationKo) || (mech && mech.energySummary);
      var l1 = l1BandForMetric(det6, M6, NB, top.key);
      var l1Weak = l1 && (l1.band === '미흡' || (l1.phase && phaseBands[l1.phase] && phaseBands[l1.phase].bandCode === 'weak'));
      var l1Ok = l1 && (l1.band === '정상' || l1.band === '우수');
      var phaseOk = l1 && l1.phase && phaseBands[l1.phase] && (phaseBands[l1.phase].bandCode === 'ok' || phaseBands[l1.phase].bandCode === 'strong');
      var compShift = conditionDelta.topShifts.filter(function (s) {
        return s.mechanicEvaluation === 'compensation_pattern' || s.mechanicEvaluation === 'load_shift';
      })[0];
      if (compShift) {
        headline = compShift.mechanicLine;
        mechanicHeadline = compShift.mechanicLine;
        energyHeadline = compShift.energyFlowImpact && compShift.energyFlowImpact.explanationKo;
        cases.push({
          type: 'T3',
          headline: headline,
          mechanicHeadline: mechanicHeadline,
          energyHeadline: energyHeadline,
          footnoteL1: footnoteL1,
          coachingPriority: 'l3-first',
          l3: { axis: conditionDelta.axis, metricKey: compShift.key, mechanicEvaluation: compShift.mechanicEvaluation }
        });
      } else if (l1Weak && top.worseOnSlow) {
        headline = '평균적으로는 ' + (l1.phase ? (PHASE_DICT[l1.phase] || {}).label : top.labelKo) + '이(가) 약한 편이지만, '
          + '구속이 좋은 구에서는 ' + top.labelKo + '이(가) 더 살아납니다. '
          + '기능이 없는 것이 아니라 좋은 투구에서만 재현되는 패턴으로 보입니다.';
        if (top.mechanicLine) mechanicHeadline = top.mechanicLine;
        cases.push({
          type: 'T1',
          headline: headline,
          mechanicHeadline: mechanicHeadline,
          energyHeadline: energyHeadline,
          footnoteL1: footnoteL1 || ('엘리트 대비 ' + top.labelKo + ' 약함 — 좋은 구 패턴 반복 재현이 목표'),
          coachingPriority: 'l3-first',
          l3: { axis: conditionDelta.axis, metricKey: top.key, deltaSummary: top.deltaSummary, mechanicEvaluation: top.mechanicEvaluation }
        });
      } else if ((l1Ok || phaseOk) && top.worseOnSlow) {
        headline = '평균적으로는 ' + (l1 && l1.phase ? (PHASE_DICT[l1.phase] || {}).label : '해당 단계') + '이(가) 양호하지만, '
          + '느린 구에서는 ' + top.labelKo + '이(가) 약해지는 경향이 있습니다.';
        if (energyHeadline) headline += ' ' + energyHeadline;
        cases.push({
          type: 'T2',
          headline: headline,
          mechanicHeadline: mechanicHeadline,
          energyHeadline: energyHeadline,
          footnoteL1: footnoteL1,
          coachingPriority: 'l3-first',
          l3: { axis: conditionDelta.axis, metricKey: top.key, deltaSummary: top.deltaSummary, observeCondition: '구속 낮은 구', mechanicEvaluation: top.mechanicEvaluation }
        });
      } else if (top.worseOnSlow) {
        headline = mechanicHeadline || ('느린 구 vs 빠른 구 · ' + top.labelKo + ' ' + top.deltaSummary);
        cases.push({
          type: 'T5', headline: headline, mechanicHeadline: mechanicHeadline, energyHeadline: energyHeadline,
          footnoteL1: footnoteL1, coachingPriority: 'balanced',
          l3: { axis: conditionDelta.axis, metricKey: top.key, mechanicEvaluation: top.mechanicEvaluation }
        });
      }
    }
    if (!headline && conditionDelta.topShifts.length) {
      var t0 = conditionDelta.topShifts[0];
      headline = mechanicHeadline || ('빠른 구 ' + conditionDelta.base.velocity_kmh + ' km/h vs 느린 구 ' + conditionDelta.compare.velocity_kmh + ' km/h · ' + t0.labelKo + ' ' + t0.deltaSummary);
      mechanicHeadline = mechanicHeadline || t0.mechanicLine;
      energyHeadline = energyHeadline || (t0.energyFlowImpact && t0.energyFlowImpact.explanationKo);
    }
    return {
      version: 'nr2', playerTier: playerTier, cases: cases, headline: headline,
      mechanicHeadline: mechanicHeadline, energyHeadline: energyHeadline,
      footnoteL1: footnoteL1, displayPolicy: displayPolicy
    };
  }

  function buildCauseEffectChain(mainLeak, keyIssues) {
    var chain = [];
    var phases = [];
    if (mainLeak) phases.push(mainLeak);
    (keyIssues || []).forEach(function (k) {
      if (k.phase && phases.indexOf(k.phase) < 0) phases.push(k.phase);
    });
    phases.slice(0, 2).forEach(function (ph) {
      var st = STAGES.filter(function (s) { return s.key === ph; })[0];
      var tpl = CAUSE_EFFECT[ph] || {};
      var dict = PHASE_DICT[ph] || {};
      chain.push({
        phase: ph,
        phaseLabel: dict.label || (st && st.label),
        cause: tpl.cause,
        consequence: tpl.consequence,
        compensation: tpl.compensation,
        correction: tpl.correction,
        researchTab: st ? st.researchTab : 'etdiag'
      });
    });
    return chain;
  }

  function buildNextMeasurementGoals(mainLeak, keyIssues, phaseBands, det6, M6, NB, conditionDelta, playerTier, eliteProfile) {
    var goals = [], used = {};
    function l3ShiftForPhase(ph) {
      if (!conditionDelta || !conditionDelta.available) return null;
      var shifts = conditionDelta.topShifts || [];
      for (var i = 0; i < shifts.length; i++) {
        if (shifts[i].phase === ph) return shifts[i];
      }
      return shifts[0] || null;
    }
    function addPhase(ph, forceL3) {
      if (!ph || used[ph]) return;
      used[ph] = true;
      var st = STAGES.filter(function (s) { return s.key === ph; })[0];
      var dict = PHASE_DICT[ph] || {};
      var pb = phaseBands[ph] || {};
      var keys = (GOAL_METRICS[ph] || []).slice();
      var wm = st ? weakMetric(det6, st.mech, M6, NB, true) : null;
      if (wm && wm.key && keys.indexOf(wm.key) < 0) keys.unshift(wm.key);
      var l3s = l3ShiftForPhase(ph);
      if (forceL3 && l3s && keys.indexOf(l3s.key) < 0) keys.unshift(l3s.key);
      keys = keys.filter(function (k) { return COACH_METRICS[k]; }).slice(0, 2);
      var metricsKo = keys.map(function (k) { return metricLabelKo(k); });
      var primaryKey = keys[0] || (l3s && l3s.key);
      var goal, source = 'l1';
      var observeCondition = '';
      if (pb.loadRisk && ph === 'arm') {
        goal = '몸통 대신 팔이 과도하게 일하는 패턴이 줄었는지 확인';
      } else if (l3s && (playerTier === 'pro' || playerTier === 'elite') && (forceL3 || pb.bandCode === 'ok' || pb.bandCode === 'strong')) {
        source = (pb.bandCode === 'weak' || pb.bandCode === 'caution') ? 'l1+l3' : 'l3';
        observeCondition = '구속 낮은 구';
        if (l3s.coachImplication) {
          goal = l3s.coachImplication;
        } else if (l3s.mechanicEvaluation === 'compensation_pattern' || l3s.mechanicEvaluation === 'load_shift') {
          goal = '단순 구속 회복만 보지 않고, ' + (metricsKo[0] || l3s.labelKo) + '과 몸통→팔 전달이 함께 회복되는지 확인';
        } else if (l3s.phase === 'block') {
          goal = '블로킹 이후 COM 감속과 몸통 회전 peak timing이 함께 회복되는지 확인';
        } else {
          goal = observeCondition + '에서 ' + (metricsKo[0] || l3s.labelKo) + ' 안정 관찰';
        }
        if (source === 'l1+l3' && !l3s.coachImplication) goal += ' · 평소 대비 ' + l3s.deltaSummary;
      } else if (pb.bandCode === 'weak' || pb.bandCode === 'caution') {
        if (eliteProfile) {
          goal = (metricsKo[0] || dict.label) + ' 코호트 내 위치·trial 간 일관성 확인';
        } else if (playerTier === 'pro' || playerTier === 'elite') {
          goal = (metricsKo[0] || dict.label) + ' baseline 유지·정상 밴드 접근 확인';
        } else {
          goal = (metricsKo[0] || dict.label) + '이(가) 엘리트 정상 범위에 가까워지는지 확인';
        }
      } else {
        goal = dict.label + ' 연결·타이밍이 유지되는지 확인';
      }
      if (l3s && source.indexOf('l3') >= 0 && l3s.worseOnSlow && observeCondition) {
        goal += ' (느린 구 ' + l3s.deltaSummary + ')';
      }
      var cues = OBSERVE_CUES[primaryKey] || ['현장 동작 감각 확인'];
      var successHint = cues[0] ? (cues[0] + ' 확인') : '';
      if (l3s && (playerTier === 'pro' || playerTier === 'elite') && l3s.mechanicLine && source.indexOf('l3') >= 0) {
        successHint = (l3s.energyFlowImpact && l3s.energyFlowImpact.explanationKo)
          ? l3s.energyFlowImpact.explanationKo.slice(0, 72) + (l3s.energyFlowImpact.explanationKo.length > 72 ? '…' : '')
          : successHint;
      }
      goals.push({
        phase: ph,
        phaseLabel: dict.label || (st && st.label),
        metricKeys: keys,
        metricsKo: metricsKo,
        goal: goal,
        researchTab: st ? st.researchTab : 'etdiag',
        source: source,
        successHint: successHint,
        observeCues: cues.slice(0, 2),
        observeCondition: observeCondition || null,
        l3: l3s ? {
          axis: conditionDelta.axis, metricKey: l3s.key, deltaSummary: l3s.deltaSummary,
          observeCondition: observeCondition, mechanicEvaluation: l3s.mechanicEvaluation,
          mechanicLine: l3s.mechanicLine, energyFlowImpact: l3s.energyFlowImpact
        } : null,
        playerTierApplied: playerTier
      });
    }
    if (mainLeak) addPhase(mainLeak, false);
    if ((playerTier === 'pro' || playerTier === 'elite') && conditionDelta && conditionDelta.available && conditionDelta.topShifts[0]) {
      var topPh = conditionDelta.topShifts[0].phase;
      if (topPh && !used[topPh]) addPhase(topPh, true);
    }
    (keyIssues || []).forEach(function (k) { addPhase(k.phase, false); });
    STAGES.forEach(function (st) {
      var pb = phaseBands[st.key];
      if (goals.length >= 4) return;
      if (pb && (pb.leak || pb.loadRisk)) addPhase(st.key, false);
    });
    return goals.slice(0, 4);
  }

  function buildWindupV1SubCards(det6, M6, NB, DATA) {
    var W = (typeof WINDUP_V1 !== 'undefined') ? WINDUP_V1 : null;
    if (!W || !W.buildCoachCards) return null;
    try {
      return W.buildCoachCards(det6, M6, NB, DATA);
    } catch (e) {
      return null;
    }
  }

  function buildDriveV1SubCards(det6, M6, NB, DATA) {
    var D = (typeof DRIVE_V1 !== 'undefined') ? DRIVE_V1 : null;
    if (!D || !D.buildCoachCards) return null;
    try {
      return D.buildCoachCards(det6, M6, NB, DATA);
    } catch (e) {
      return null;
    }
  }

  function buildBlockingV1SubCards(det6, M6, NB, DATA) {
    var B = (typeof BLOCKING_V1 !== 'undefined') ? BLOCKING_V1 : null;
    if (!B || !B.buildCoachCards) return null;
    try {
      return B.buildCoachCards(det6, M6, NB, DATA);
    } catch (e) {
      return null;
    }
  }

  function buildTrunkV1SubCards(det6, M6, NB, DATA) {
    var T = (typeof TRUNK_V1 !== 'undefined') ? TRUNK_V1 : null;
    if (!T || !T.buildCoachCards) return null;
    try {
      return T.buildCoachCards(det6, M6, NB, DATA);
    } catch (e) {
      return null;
    }
  }

  function buildArmReleaseV1SubCards(det6, M6, NB, DATA) {
    var A = (typeof ARM_RELEASE_V1 !== 'undefined') ? ARM_RELEASE_V1 : null;
    if (!A || !A.buildCoachCards) return null;
    try {
      return A.buildCoachCards(det6, M6, NB, DATA);
    } catch (e) {
      return null;
    }
  }

  function buildPhaseCards(phaseBands, mainLeak, armCoachBlocks, windupSubCards, driveSubCards, blockingSubCards, trunkSubCards, armReleaseSubCards) {
    var displayLeak = mainLeak === 'leadKneeTransfer' ? 'block' : mainLeak;
    return COACH_FLOW_STAGES.map(function (st) {
      var pb = phaseBands[st.key] || { bandCode: 'na', band: '측정 없음', leak: false };
      var d = PHASE_DICT[st.key] || {};
      var expanded = (st.key === displayLeak) || !!pb.leak || !!pb.loadRisk;
      var card = {
        key: st.key,
        title: st.label,
        role: d.energyRole,
        band: pb.band,
        bandCode: pb.bandCode,
        oneLiner: (pb.leak || pb.loadRisk) ? d.issue : d.good,
        goodPattern: d.goodPattern,
        issuePattern: d.issuePattern,
        whyImportant: d.why,
        correction: d.correction,
        researchTab: st.researchTab,
        loadRisk: !!pb.loadRisk,
        expanded: expanded
      };
      if (st.key === 'arm') {
        card.stageIntro = 'MER 저장·방출 준비(독립) · 몸통→팔 타이밍·출력=보조/결과 · 팔 주도 보상=판정 보류.';
        if (armReleaseSubCards && armReleaseSubCards.length) {
          card.armReleaseV1Cards = armReleaseSubCards;
          var mer0 = armReleaseSubCards[0];
          if (mer0) {
            card.oneLiner = mer0.diagnosis || card.oneLiner;
            card.goodPattern = '';
            card.issuePattern = '';
            card.correction = mer0.cue || card.correction;
            card.whyImportant = '몸통→팔 전달·출력·부하는 보조/결과 레이어 · MER만 독립 판정.';
          }
          if (!expanded && armReleaseSubCards.some(function (c) { return c.v1Status === '결함'; })) {
            card.expanded = true;
          }
        } else {
          card.coachBlocks = armCoachBlocks || [];
        }
      }
      if (st.key === 'windup' && windupSubCards && windupSubCards.length) {
        card.windupV1Cards = windupSubCards;
        card.stageIntro = '회전 저장(조기풀림·반대회전·뒷고관절 코일)과 위치에너지 전환 준비를 분리해 확인합니다. x_factor는 와인드업 평가에 포함하지 않습니다.';
        if (!expanded && windupSubCards.some(function (c) { return c.v1Status === '결함'; })) {
          card.expanded = true;
        }
      }
      if (st.key === 'drive' && driveSubCards && driveSubCards.length) {
        card.driveV1Cards = driveSubCards;
        card.stageIntro = 'KH→FC 전방-하강·몸통 조기개방·x-factor 형성·방향 이탈 — x_factor는 드라이브에서 형성(와인드업 산물 아님).';
        if (!expanded && driveSubCards.some(function (c) { return c.v1Status === '결함'; })) {
          card.expanded = true;
        }
      }
      if (st.key === 'block' && blockingSubCards && blockingSubCards.length) {
        card.blockingV1Cards = blockingSubCards;
        card.subLabel = '앞다리 버팀';
        card.stageIntro = 'FC→BR 앞다리 버팀·방향 누수·COM 감속(보조) — 구 앞무릎 전달(신전·유형)은 카드1 하위 · 몸통 각속도 cross-link만.';
        if (!expanded && blockingSubCards.some(function (c) { return c.v1Status === '결함'; })) {
          card.expanded = true;
        }
      }
      if (st.key === 'trunk' && trunkSubCards && trunkSubCards.length) {
        card.trunkV1Cards = trunkSubCards;
        card.stageIntro = 'FC→BR 몸통 각속도 peak(독립) · x-factor 풀림=메커니즘 · 기울기=부하 경고 · 팔 전달=cross-link.';
        if (!expanded && trunkSubCards.some(function (c) { return c.v1Status === '결함'; })) {
          card.expanded = true;
        }
      }
      return card;
    });
  }

  function buildBandGauges(mainLeak, keyIssues, det6, M6, NB, eliteProfile) {
    var gauges = [], seen = {};
    function addMetric(m) {
      if (!m || !m.key || seen[m.key] || gauges.length >= 2) return;
      if (!COACH_METRICS[m.key]) return;
      if (!NB || !NB[m.key]) return;
      seen[m.key] = 1;
      var b = metricBand(M6, NB, m);
      var bw = (M6 && M6.bandWord) ? M6.bandWord(m.value, NB[m.key], m.dir) : null;
      gauges.push({
        key: m.key,
        labelKo: metricLabelKo(m.key, m),
        band: b,
        bandWord: eliteProfile
          ? (eliteMetricBandWord(b) || bw || '코호트 정상 범위')
          : (bw || (b === '미흡' ? '엘리트 대비 부족' : (b === '우수' ? '엘리트 대비 우수' : '정상 범위'))),
        pos: gaugePosFromBand(b),
        showValue: false
      });
    }
    if (mainLeak) {
      var st0 = STAGES.filter(function (s) { return s.key === mainLeak; })[0];
      if (st0) addMetric(weakMetric(det6, st0.mech, M6, NB, true));
    }
    (keyIssues || []).forEach(function (k) {
      (k.relatedMetrics || []).forEach(function (rk) {
        if (typeof rk !== 'string' || !COACH_METRICS[rk]) return;
        var st = STAGES.filter(function (s) { return s.key === k.phase; })[0];
        if (!st || !det6 || !det6[st.mech]) return;
        var m = det6[st.mech].filter(function (x) { return x && x.key === rk; })[0];
        if (m) addMetric(m);
      });
    });
    return gauges;
  }

  function buildDrills(keyIssues, overall, phaseBands, causeEffectChain) {
    var out = [], seen = {};
    (causeEffectChain || []).forEach(function (c) {
      if (c.correction && !seen[c.correction]) { seen[c.correction] = 1; out.push(c.correction); }
    });
    keyIssues.forEach(function (k) {
      if (k.correction && !seen[k.correction]) { seen[k.correction] = 1; out.push(k.correction); }
    });
    if (overall.mainCorrection && !seen[overall.mainCorrection]) { seen[overall.mainCorrection] = 1; out.push(overall.mainCorrection); }
    STAGES.forEach(function (st) {
      var pb = phaseBands[st.key];
      if (pb && (pb.leak || pb.loadRisk) && DRILL[st.key] && !seen[DRILL[st.key]]) {
        seen[DRILL[st.key]] = 1; out.push(DRILL[st.key]);
      }
    });
    if (out.length < 3) out.push('다음 측정에서 블로킹·몸통 연결 구간 재확인');
    return out.slice(0, 5).map(function (s) { return s.length > 80 ? s.slice(0, 77) + '…' : s; });
  }

  function buildExplanationScript(overall, keyIssues, causeEffectChain, energyFlowMap, drillsOrCues, nextMeasurementGoals) {
    var leakParts = [];
    (energyFlowMap || []).forEach(function (n) {
      if (n.leak || n.loadRisk || n.isMainLeak) leakParts.push(n.label + ' ' + n.band);
    });
    return {
      opening: leakParts.length ? ('오늘 에너지 흐름 — ' + leakParts.join(' · ')) : '오늘 에너지 흐름 — 전반 양호',
      leakFocus: overall.headline || '—',
      actionWindow: (overall.mainLeakLabel || '') + ' 구간 중심 확인',
      chain: overall.mainCause && overall.mainConsequence
        ? (overall.mainCause + ' → ' + overall.mainConsequence) : '',
      drills: (drillsOrCues || []).slice(0, 3).join(' · '),
      remeasure: (nextMeasurementGoals || []).map(function (g) { return g.phaseLabel; }).join(', ')
    };
  }

  function resolveWindow(trial, hi) {
    if (!trial || !hi) return null;
    var ev = trial.events || {}, dt = (trial.meta && trial.meta.dt) || 0.004;
    var nF = (trial.meta && trial.meta.n_frames) || (trial.frames && trial.frames.length) || 1;
    function idx(key, off) {
      var k = key;
      if (k && k.indexOf('i_') !== 0) k = 'i_' + k;
      var i = ev[k];
      if (i == null) return null;
      return Math.max(0, Math.min(nF - 1, Math.round(i + (off || 0) / dt)));
    }
    var i0 = idx(hi.startEv, hi.startOff), i1 = idx(hi.endEv, hi.endOff);
    if (i0 == null || i1 == null) return null;
    if (i1 < i0) { var t = i0; i0 = i1; i1 = t; }
    return { i0: i0, i1: i1 };
  }

  function buildHighlight(mainPhase, keyIssues) {
    var ph = mainPhase || (keyIssues[0] && keyIssues[0].phase) || 'block';
    var h = HIGHLIGHT[ph] || HIGHLIGHT.block;
    var dict = PHASE_DICT[ph] || {};
    var cap = (ph === 'block')
      ? '이 구간에서 전진 속도가 충분히 줄지 않았을 수 있음'
      : (dict.issuePattern || dict.issue || '');
    return {
      phase: ph, label: h.label, caption: cap,
      coachingCue: dict.correction,
      startEv: h.startEv, startOff: h.startOff, endEv: h.endEv, endOff: h.endOff
    };
  }

  function bestVeloTrialIndex(DATA) {
    var best = null, bv = -1;
    (DATA.trials || []).forEach(function (t, i) {
      var v = t.rapsodo && t.rapsodo.velocity_kmh;
      if (v != null && isFinite(v) && v > bv) { bv = v; best = i; }
    });
    if (best != null) return best;
    var bi = (DATA.best_trial_index || 1) - 1;
    return bi >= 0 && bi < (DATA.trials || []).length ? bi : 0;
  }

  function trialContext(DATA) {
    var pol = DATA.phases && DATA.phases.score_trial_policy;
    var nScore = pol && pol.n_for_score != null ? pol.n_for_score : null;
    var nAll = pol && pol.n_trials != null ? pol.n_trials : (DATA.trials || []).length;
    var bandNote = pol
      ? ('단계 밴드·핵심 문제 = valid_for_score ' + nScore + '/' + nAll + '구 평균'
        + (pol.fallback_all_trials ? ' (점수용 trial 없음 → 전구 폴백)' : ''))
      : '단계 밴드 = 대표 trial 변인 기준';
    var bvi = bestVeloTrialIndex(DATA);
    var bt = DATA.trials && DATA.trials[bvi];
    var bestLbl = (bt && bt.meta && bt.meta.trial_label) ? bt.meta.trial_label : ('Trial ' + (bvi + 1));
    return {
      bandBasis: pol ? 'valid_for_score_avg' : 'representative',
      bandNote: bandNote,
      bestVeloIndex: bvi,
      bestVeloLabel: bestLbl,
      bestVeloNote: '최고 구속 trial = 구속·잠재력 참고용 (평균 투구 패턴 아님)',
      stickNote: '스틱·구간 강조 = 상단 trial 선택 (시각화 전용)',
      index: bvi,
      label: bestLbl,
      basis: 'best_velo_ref'
    };
  }

  function coachRxWeakPts(key) {
    if (RX_ME_MAG_KEYS[key]) return 18;
    if (RX_COACH_CORE_KEYS[key]) return 36;
    return 32;
  }

  function coachRxConsistencyReliability(DATA) {
    var C = DATA && DATA.consistency;
    var rel = C && C.reliability;
    var pop = (C && C.population) || {};
    var nUsed = pop.n_used != null ? pop.n_used : (DATA.trials || []).length;
    var pol = DATA.phases && DATA.phases.score_trial_policy;
    var nScore = pol && pol.n_for_score != null ? pol.n_for_score : nUsed;
    var tier = rel && rel.tier;
    var low = tier === 'D' || nScore < 3 || nUsed < 3;
    return { low: low, nUsed: nUsed, nScore: nScore, tier: tier || null };
  }

  function collectCoachRxTriggers(DATA, ETDIAG, mainLeak, keyIssues, det6, M6, NB) {
    var CP = (typeof coachingPrescription !== 'undefined') ? coachingPrescription : null;
    if (!CP || !CP.isPriorityKey) return { keys: [], bands: {}, scored: {} };
    var scored = {}, bands = {};
    var mainLeakWeakKey = null;

    function bump(key, pts, band) {
      if (!CP.isPriorityKey(key)) return;
      scored[key] = (scored[key] || 0) + pts;
      if (band) bands[key] = band;
    }

    var stLeak = STAGES.filter(function (s) { return s.key === mainLeak; })[0];
    if (stLeak) {
      var wm0 = weakMetric(det6, stLeak.mech, M6, NB);
      if (wm0 && wm0.key) {
        var b0 = metricBand(M6, NB, wm0);
        if (b0 === '미흡') { mainLeakWeakKey = wm0.key; bump(wm0.key, 55, b0); }
      }
    }

    STAGES.forEach(function (st) {
      ((det6 && det6[st.mech]) || []).forEach(function (m) {
        if (!m || m.neutral) return;
        var b = metricBand(M6, NB, m);
        if (b === '미흡') bump(m.key, coachRxWeakPts(m.key), b);
      });
    });

    var ea = DATA && DATA.phases && DATA.phases.earlyArm;
    if (ea && ea.label && ea.label !== 'normal' && ea.label !== '양호') {
      bump('earlyArmRisk', 42, ea.label);
    }

    var mc = DATA && DATA.command && DATA.command.mechanicsConsistency;
    var consRel = coachRxConsistencyReliability(DATA);
    RELEASE_CONSISTENCY_KEYS.forEach(function (k) {
      var v = consistencyMetricValue(DATA && DATA.consistency, mc, k.key);
      if (v == null && mc && mc[k.key] != null && isFinite(mc[k.key])) v = mc[k.key];
      if (v == null) return;
      var bl = repeatBandLabel(M6, NB, v, k.key);
      if (bl === '반복성 낮음') {
        if (consRel.low) bump(k.key, 14, '확인 필요');
        else bump(k.key, 40, bl);
      }
    });

    (keyIssues || []).forEach(function (ki, ix) {
      (ki.relatedMetrics || []).forEach(function (rk) {
        bump(rk, 22 - ix * 6);
      });
    });

    var keys = Object.keys(scored).sort(function (a, b) {
      return scored[b] - scored[a]
        || CP.PRIORITY_KEYS.indexOf(a) - CP.PRIORITY_KEYS.indexOf(b);
    });
    return {
      keys: keys, bands: bands, scored: scored,
      mainLeakWeakKey: mainLeakWeakKey,
      consistencyReliability: consRel
    };
  }

  function buildCoachingPrescription(DATA, ETDIAG, mainLeak, keyIssues, det6, M6, NB) {
    var CP = (typeof coachingPrescription !== 'undefined') ? coachingPrescription : null;
    if (!CP || !CP.buildToday) {
      return { show: false, version: 'mvp1', items: [], note: 'coachingPrescription 미로드' };
    }
    var trig = collectCoachRxTriggers(DATA, ETDIAG, mainLeak, keyIssues, det6, M6, NB);
    var card = CP.buildToday({
      triggerKeys: trig.keys, bands: trig.bands, scored: trig.scored,
      mainLeak: mainLeak, mainLeakWeakKey: trig.mainLeakWeakKey
    });
    if (card && trig.consistencyReliability && trig.consistencyReliability.low) {
      card.note = (card.note || '') + ' · trial 수 부족 — 반복성 처방은 확인 필요로 완화';
    }
    return card;
  }

  function build(DATA, ETDIAG) {
    if (!DATA) return null;
    var playerTier = resolvePlayerTier(DATA);
    var eliteProfileMode = resolveEliteProfileMode(playerTier, DATA);
    var eliteSessionContext = buildEliteSessionContext(DATA);
    var phaseBands = computePhaseBands(DATA, ETDIAG, eliteProfileMode);
    var M6 = _G().mech6;
    var det6 = M6 && M6.detail6 ? M6.detail6(DATA) : null;
    var NB = _G().BIOMOTION_NORMS;
    var conditionDelta = buildConditionDelta(DATA, M6, NB, det6, eliteSessionContext);
    var eliteProfileSummary = eliteProfileMode
      ? buildEliteProfileSummary(det6, M6, NB, phaseBands, conditionDelta, eliteSessionContext)
      : null;
    var mainLeak = pickMainLeak(phaseBands, ETDIAG, det6, M6, NB, eliteProfileMode);
    var keyIssues = pickKeyIssues(DATA, ETDIAG, phaseBands, eliteProfileMode);
    var overall = buildOverall(mainLeak, ETDIAG, phaseBands, eliteProfileMode, eliteProfileSummary);
    var narrativeReconciliation = buildNarrativeReconciliation(phaseBands, conditionDelta, playerTier, mainLeak, keyIssues, det6, M6, NB, eliteProfileMode);
    if (narrativeReconciliation.headline && (playerTier === 'pro' || playerTier === 'elite') && !eliteProfileMode) {
      overall.headlineL1 = overall.headline;
      overall.headline = narrativeReconciliation.headline;
    } else if (eliteProfileMode && narrativeReconciliation.headline) {
      overall.headlineL1 = overall.headline;
      overall.headline = narrativeReconciliation.headline;
    }
    var causeEffectChain = buildCauseEffectChain(mainLeak, keyIssues);
    var armCoachBlocks = buildArmCoachBlocks(det6, DATA);
    var consistencyCoachCard = buildConsistencyCoachCard(DATA, M6, NB);
    var commandStability = buildCommandStabilityCard(DATA, ETDIAG, phaseBands, mainLeak, det6, M6, NB);
    var consistencyContext = buildConsistencyContext(DATA, ETDIAG, mainLeak, M6, NB);
    var windupV1Cards = buildWindupV1SubCards(det6, M6, NB, DATA);
    var driveV1Cards = buildDriveV1SubCards(det6, M6, NB, DATA);
    var blockingV1Cards = buildBlockingV1SubCards(det6, M6, NB, DATA);
    var trunkV1Cards = buildTrunkV1SubCards(det6, M6, NB, DATA);
    var armReleaseV1Cards = buildArmReleaseV1SubCards(det6, M6, NB, DATA);
    var phaseCards = buildPhaseCards(phaseBands, mainLeak, armCoachBlocks, windupV1Cards, driveV1Cards, blockingV1Cards, trunkV1Cards, armReleaseV1Cards);
    var energyFlowMap = COACH_FLOW_STAGES.map(function (st) {
      var pb = phaseBands[st.key] || { band: '측정 없음', bandCode: 'na', leak: false };
      if (st.key === 'block' && phaseBands.leadKneeTransfer && phaseBands.leadKneeTransfer.leak && !pb.leak) {
        pb = Object.assign({}, pb, { leak: true });
      }
      var d = PHASE_DICT[st.key] || {};
      var leakKey = mainLeak === 'leadKneeTransfer' ? 'block' : mainLeak;
      return {
        key: st.key,
        label: st.label,
        subLabel: st.subLabel || null,
        role: d.energyRole,
        band: pb.band,
        bandCode: pb.bandCode,
        leak: !!pb.leak,
        profileLow: !!pb.profileLow,
        loadRisk: !!pb.loadRisk,
        isMainLeak: st.key === leakKey,
        researchTab: st.researchTab
      };
    });
    var drillsOrCues = buildDrills(keyIssues, overall, phaseBands, causeEffectChain);
    var nextMeasurementGoals = buildNextMeasurementGoals(mainLeak, keyIssues, phaseBands, det6, M6, NB, conditionDelta, playerTier, eliteProfileMode);
    var highlight = buildHighlight(mainLeak, keyIssues);
    var bandGauges = buildBandGauges(mainLeak, keyIssues, det6, M6, NB, eliteProfileMode);
    var expandPhases = phaseCards.filter(function (c) { return c.expanded; }).map(function (c) { return c.key; });
    var explanationScript = buildExplanationScript(overall, keyIssues, causeEffectChain, energyFlowMap, drillsOrCues, nextMeasurementGoals);
    var coachingPrescriptionCard = buildCoachingPrescription(DATA, ETDIAG, mainLeak, keyIssues, det6, M6, NB);

    return {
      version: 'fv2-dual2',
      playerTier: playerTier,
      eliteProfileMode: eliteProfileMode,
      isNormCohortMember: isNormCohortMember(DATA),
      eliteProfileSummary: eliteProfileSummary,
      eliteSessionContext: eliteSessionContext,
      conditionDelta: conditionDelta,
      narrativeReconciliation: narrativeReconciliation,
      player: {
        name: (DATA.player && DATA.player.name) || '선수',
        measured_kmh: DATA.measured_kmh,
        nTrials: (DATA.trials || []).length
      },
      trialContext: trialContext(DATA),
      overall: overall,
      phaseBands: phaseBands,
      energyFlowMap: energyFlowMap,
      keyIssues: keyIssues,
      phaseCards: phaseCards,
      windupV1Cards: windupV1Cards,
      driveV1Cards: driveV1Cards,
      blockingV1Cards: blockingV1Cards,
      trunkV1Cards: trunkV1Cards,
      armReleaseV1Cards: armReleaseV1Cards,
      causeEffectChain: causeEffectChain,
      drillsOrCues: drillsOrCues,
      nextMeasurementGoals: nextMeasurementGoals,
      highlight: highlight,
      bandGauges: bandGauges,
      visualBlocks: {
        showBandGauge: bandGauges.length > 0,
        bandGauges: bandGauges,
        expandPhases: expandPhases,
        defaultHighlightOnEnter: true
      },
      explanationScript: explanationScript,
      consistencyCoachCard: consistencyCoachCard,
      commandStability: commandStability,
      consistencyContext: consistencyContext,
      coachingPrescription: coachingPrescriptionCard,
      meta: {
        hasGRF: !!(DATA.trials && DATA.trials[0] && DATA.trials[0].grf),
        hasPhases: !!(DATA.phases && DATA.phases.stages),
        confidence: ETDIAG && ETDIAG.confidence ? ETDIAG.confidence : null,
        generatedAt: new Date().toISOString()
      }
    };
  }

  return {
    build: build,
    resolveWindow: resolveWindow,
    resolvePlayerTier: resolvePlayerTier,
    resolveEliteProfileMode: resolveEliteProfileMode,
    isNormCohortMember: isNormCohortMember,
    buildConditionDelta: buildConditionDelta,
    listConditionAxes: listConditionAxes,
    resolveConditionDeltaSlice: resolveConditionDeltaSlice,
    resolveConditionAxisTrials: resolveConditionAxisTrials,
    CONDITION_AXIS_ORDER: CONDITION_AXIS_ORDER,
    CONDITION_AXIS_META: CONDITION_AXIS_META,
    pickFastSlowTrials: pickFastSlowTrials,
    pickEarlyLateTrials: pickEarlyLateTrials,
    pickBestCurrentTrials: pickBestCurrentTrials,
    pickCommandGoodPoorTrials: pickCommandGoodPoorTrials,
    pickBaselineCurrentTrials: pickBaselineCurrentTrials,
    pickFatigueFreshTrials: pickFatigueFreshTrials,
    metricsFromBaseline: metricsFromBaseline,
    buildConsistencyCoachCard: buildConsistencyCoachCard,
    repeatBandLabel: repeatBandLabel,
    RELEASE_CONSISTENCY_KEYS: RELEASE_CONSISTENCY_KEYS,
    trialsWithVelocityCount: trialsWithVelocityCount,
    hasFatigueMeta: hasFatigueMeta,
    earlyLateUnavailableReason: earlyLateUnavailableReason,
    baselineUnavailableReason: baselineUnavailableReason,
    fatigueUnavailableReason: fatigueUnavailableReason,
    buildNarrativeReconciliation: buildNarrativeReconciliation,
    PLAYER_TIER_KEY: PLAYER_TIER_KEY,
    ELITE_COHORT_NAMES: ELITE_COHORT_NAMES,
    HIGHLIGHT: HIGHLIGHT,
    bandDisplay: bandDisplay,
    bandColor: bandColor,
    mapEtKey: mapEtKey,
    STAGES: STAGES,
    PHASE_DICT: PHASE_DICT
  };
});
