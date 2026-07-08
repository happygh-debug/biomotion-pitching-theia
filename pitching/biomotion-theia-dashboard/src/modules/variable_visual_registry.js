/* variable_visual_registry.js — 변인 시각화·설명 metadata (계산 로직 변경 없음)
 * 생성: node _handover/gen_variable_visual_registry.js · VZ6
 * 전역: VAR_VIS.get(key) · VAR_VIS.buildMatrixHTML() · VAR_VIS.openPanel()
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VAR_VIS = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var ROLE_KO = {
  "storage": "저장",
  "generation": "생성",
  "transport": "운반",
  "braking": "제동",
  "conversion": "전환",
  "transfer": "전달",
  "release": "방출",
  "load": "부하",
  "risk": "위험",
  "consistency": "반복성",
  "context": "맥락"
};

  var MATRIX_ROWS = [
    { id: 'windup', label: '와인드업' },
    { id: 'stride', label: '드라이브' },
    { id: 'block', label: '블로킹' },
    { id: 'knee', label: '앞무릎 전달' },
    { id: 'trunk', label: '몸통 전달' },
    { id: 'arm', label: '팔 전달·방출' },
    { id: 'consistency', label: '제구·반복성' }
  ];

  var MATRIX_COLS = [
    { id: 'storage', label: '저장', roles: ['storage'] },
    { id: 'generation', label: '생성', roles: ['generation', 'transport'] },
    { id: 'brake_conv', label: '제동/전환', roles: ['braking', 'conversion'] },
    { id: 'transfer', label: '전달', roles: ['transfer'] },
    { id: 'release_load', label: '방출/부하', roles: ['release', 'load'] },
    { id: 'risk', label: '위험', roles: ['risk'] },
    { id: 'consistency', label: '반복성', roles: ['consistency'] }
  ];

  var REGISTRY = {
  'abdSym': { key: 'abdSym', labelKo: '어깨 외전 대칭 (FC)', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 양팔 외전 대칭 — T자에 가까울수록 상체 안정. LHP norm dry-run 검토 중.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'apBrake': { key: 'apBrake', labelKo: '앞발 AP 제동력 peak (deprecated)', phase: 'block',
    energyRole: ["braking","conversion"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '%BW',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '코치·score 제외(deprecated). 산출·규준 스케일 불일치 — 제동 평가는 apBrakeImpulse·comVelReductionFCBR.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'apBrakeImpulse': { key: 'apBrakeImpulse', labelKo: '앞발 제동 임펄스', phase: 'block',
    energyRole: ["braking","conversion"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'impulseArea', unit: '%BW·s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 후 앞발이 전진 에너지를 멈추는 정도(∫ 제동력).',
    coachWarning: '낮으면 몸이 계속 앞으로 밀려 회전 전환 에너지가 줄 수 있음.',
    correctionCue: '착지 후 앞발 위에서 몸 받치며 전진 속도 줄이기',
    relatedMetrics: ["comVelReductionFCBR","vgrfRetain"],
    researchTab: 'ph-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'armRotV': { key: 'armRotV', labelKo: '팔 회전 속도', phase: 'arm',
    energyRole: ["release"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_mer","end":"i_br"},
    coachMeaning: '팔 회전 가속·방출.',
    relatedMetrics: ["humME","armTransferRatio"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'armSlot': { key: 'armSlot', labelKo: 'FC 암슬롯 높이', phase: 'arm',
    energyRole: ["transfer","release","context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 투구팔이 나오는 높이(자세 참고). 일관성은 armSlotSdDeg와 별도.',
    coachWarning: '사이드암·언더핸드는 오버핸드 규준 band 제외(normNA).',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'armSlotSdDeg': { key: 'armSlotSdDeg', labelKo: '암슬롯 일관성', phase: 'consistency',
    energyRole: ["consistency"], displayPolicy: 'band_and_context', bandType: 'lower_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'consistencyCard', unit: '° SD',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '구마다 팔이 나오는 높이가 얼마나 흔들리는지(반복성·제구 안정성). 평균 높이(armSlot)와 혼동 금지.',
    relatedMetrics: ["releaseSdMm"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'armTransferRatio': { key: 'armTransferRatio', labelKo: '몸통→팔 전달비율', phase: 'trunk',
    energyRole: ["transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGaugeEnergyFlow', unit: '%',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 에너지가 팔로 넘어간 비율.',
    coachWarning: '낮으면 팔이 몸통 대신 일할 수 있음.',
    correctionCue: '몸통 회전 후 팔이 따라오게',
    relatedMetrics: ["ppTrunkHum","humME"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'armball': { key: 'armball', labelKo: '팔→공 (6단계 요약)', phase: 'arm',
    energyRole: ["transfer","release","load"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔 에너지→공 전달 유형 요약 — armRotV·릴리스 맥락.',
    researchTab: 'ed-armball',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'backHipMoment': { key: 'backHipMoment', labelKo: '뒷고관절 모멘트 (KH→FC)', phase: 'stride',
    energyRole: ["load","risk"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브 구간 뒷고관절 모멘트 peak — 하체 부하 맥락 · 단정 금지.',
    researchTab: 'ph-stride',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'backHipWork': { key: 'backHipWork', labelKo: '뒷고관절 일 (KH→FC)', phase: 'stride',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브 구간 뒷고관절 일 — 하체 저장 맥락.',
    researchTab: 'ph-stride',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'backKneeFlex': { key: 'backKneeFlex', labelKo: '뒷무릎 굴곡 (KH)', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '무릎 최고점 뒷무릎 각도 — 드라이브·하체 전략 맥락.',
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'blockConvEff': { key: 'blockConvEff', labelKo: '블로킹→회전 전환 연결', phase: 'block',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '제동 후 회전 전환 효율 맥락 — 블로킹 유형과 함께 해석.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'blockRiskPenalty': { key: 'blockRiskPenalty', labelKo: '블로킹 위험 penalty', phase: 'block',
    energyRole: ["risk","context"], displayPolicy: 'risk_flag', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '점',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '무릎 붕괴·제동 부족이 함께일 때 조건부 감점(10~15점).',
    coachWarning: '일반 MAP 평균이 아니라 Collapse/Leakage risk 조합 시만 반영.',
    relatedMetrics: ["kneeCollapse","apBrakeImpulse","comVelReductionFCBR"],
    researchTab: 'ed-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'blocking': { key: 'blocking', labelKo: '블로킹 유형 맥락', phase: 'block',
    energyRole: ["context"], displayPolicy: 'type_context', bandType: 'none',
    visualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '블로킹 전략 유형(강/약·전환) 맥락 — blockingType·blockConvEff와 함께 해석.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'blockingType': { key: 'blockingType', labelKo: '블로킹 유형', phase: 'block',
    energyRole: ["context"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '제동·지지·무릎 전략 분류(Extension/Bracing/Collapse 등). 좋음/나쁨이 아니라 패턴 차이.',
    correctionCue: '유형에 맞는 하체 지지·제동 감각 유지',
    researchTab: 'ed-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'chainTiming': { key: 'chainTiming', labelKo: '운동사슬 타이밍', phase: 'arm',
    energyRole: ["transfer","context"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'bandGauge',
    stickVisualType: 'simpleSequenceDiagram', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '분절 간 타이밍 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'comDecel': { key: 'comDecel', labelKo: '제동 가속도 peak', phase: 'block',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'm/s²',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: 'COM 제동 가속도 peak — 블로킹·안정화 보조.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'comKEdrop': { key: 'comKEdrop', labelKo: 'COM 운동에너지 감소', phase: 'block',
    energyRole: ["braking","conversion"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 후 전진 운동에너지가 줄어든 양.',
    relatedMetrics: ["comVelReductionFCBR"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'comVDrop': { key: 'comVDrop', labelKo: 'COM 수직 낙하 (KH→FC)', phase: 'stride',
    energyRole: ["generation","context"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: 'cm',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '마운드 내리막을 이용한 COM 하강·낮은 자세 유지(자세 유지 점수 주성분).',
    coachWarning: '과도한 낙하는 착지·릴리즈 높이 손실·앞다리 무너짐 위험.',
    correctionCue: '적절히 낮추되 주저앉지 않게 축발→착지까지 유지',
    relatedMetrics: ["postureMaint","comVelFC"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'comVel': { key: 'comVel', labelKo: 'COM 전진 속도', phase: 'stride',
    energyRole: ["transport"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'bandGauge', unit: 'm/s',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '전진 속도 곡선 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'comVelFC': { key: 'comVelFC', labelKo: 'COM 전진속도 @FC', phase: 'stride',
    energyRole: ["transport","generation"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: 'm/s',
    eventWindow: {"start":"i_kl_peak","end":"i_fc","endOff":0.05},
    coachMeaning: '착지 시점 전진속도·드라이브가 만든 전진 운동량의 결과 지표.',
    coachWarning: '낮으면 블로킹으로 넘길 선형 에너지가 부족할 수 있음.',
    relatedMetrics: ["propImpPct","comVel"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'comVelReductionFCBR': { key: 'comVelReductionFCBR', labelKo: '전진속도 감소 (FC→BR)', phase: 'block',
    energyRole: ["braking","conversion"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: 'm/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 후 무게중심 전진 속도가 줄어든 정도.',
    coachWarning: '낮으면 앞다리에서 전진 에너지가 충분히 멈추지 못함.',
    relatedMetrics: ["apBrakeImpulse","vgrfRetain"],
    researchTab: 'ph-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'counterAP': { key: 'counterAP', labelKo: '카운터 압력 (축발)', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '축발 시 지면 반력 맥락 — 체중 실림·코일 준비 참고.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'driveKneeFlexKF': { key: 'driveKneeFlexKF', labelKo: '뒷무릎 굴곡 변화 (KH→FC)', phase: 'stride',
    energyRole: ["generation","context"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'eventSnapshot', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '낮은 자세가 고관절 힌지인지 주저앉음인지 구분(+ 더 굽음).',
    relatedMetrics: ["postureMaint","comVDrop"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'driveType': { key: 'driveType', labelKo: '앞무릎 활용 유형', phase: 'knee',
    energyRole: ["context"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞무릎 전략 유형(연결·신전 등).',
    correctionCue: '유형에 맞는 앞다리 지지·연결',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'driveWork': { key: 'driveWork', labelKo: '뒷다리 신전 일 (드라이브)', phase: 'stride',
    energyRole: ["generation","context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '뒷고관절+무릎 양의 일·추진 임펄스와 중복되는 참고 에너지 지표.',
    relatedMetrics: ["propImpPct","rearProp"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'elbAbs': { key: 'elbAbs', labelKo: '팔꿈치 에너지 흡수', phase: 'arm',
    energyRole: ["load"], displayPolicy: 'load_context', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔꿈치에서 흡수되는 에너지·부하.',
    coachWarning: '높으면 전달·방출 부족·부상 부담 가능.',
    relatedMetrics: ["humME","armTransferRatio"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'elbowExtV': { key: 'elbowExtV', labelKo: '팔꿈치 신전 속도', phase: 'arm',
    energyRole: ["release"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '방출 구간 팔꿈치 신전 속도.',
    relatedMetrics: ["armRotV"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'elbowFlexAsym': { key: 'elbowFlexAsym', labelKo: '팔꿈치 굴곡 비대칭 (FC)', phase: 'arm',
    energyRole: ["transfer","release","load"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '양팔꿈치 굴곡 차이 — 상체 한쪽 쏠림·밸런스 참고.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'elbowForce': { key: 'elbowForce', labelKo: '팔꿈치 관절력', phase: 'injuryload',
    energyRole: ["transfer","release","load","risk"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔꿈치 관절 부하 맥락 — 회전 가속·감속 시 부담 참고(위험 단정 금지).',
    researchTab: 'ph-injuryload',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'elbowMoment': { key: 'elbowMoment', labelKo: '팔꿈치 관절 모멘트 (결과)', phase: 'injuryload',
    energyRole: ["transfer","release","load","risk"], displayPolicy: 'load_context', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔꿈치 관절 모멘트 peak — 회전 가속·감속 시 관절 부하 맥락. 위험 단정 금지.',
    coachWarning: '엘리트 대비 높으면 감속 부담 참고.',
    researchTab: 'ph-injuryload',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'elbowP': { key: 'elbowP', labelKo: '팔꿈치 파워', phase: 'arm',
    energyRole: ["transfer","release","load"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔꿈치 관절 파워 피크 — 감속·흡수 부하 맥락.',
    researchTab: 'ed-armball',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'elbowPostKH': { key: 'elbowPostKH', labelKo: 'KH 팔꿈치 뒤쪽 위치', phase: 'arm',
    energyRole: ["transfer","release","load"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: '%키',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '무릎 최고점에서 팔꿈치가 어깨 뒤쪽에 있는 정도 — 팔 조기 준비·early arm risk 맥락.',
    relatedMetrics: ["handPostKH","earlyArmRisk"],
    researchTab: 'ed-armball',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'freeMo': { key: 'freeMo', labelKo: '뒷발 지면반력 꼬임 토크', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '축발 지면에서 뒷발이 받는 꼬임 토크 — 하체 저장·코일 맥락.',
    correctionCue: '축발 위 안정 후 하체 코일',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'gAbd': { key: 'gAbd', labelKo: '어깨 외전 (양팔, FC)', phase: 'balance',
    energyRole: ["band_and_context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 양팔 외전 대칭 — T자에 가까울수록 상체 안정·제구 유리.',
    coachWarning: '글러브팔·투구팔 높이 차 크면 어깨 정렬 붕괴 신호.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'B',
    placeholder: false
  },
  'gElbFlex': { key: 'gElbFlex', labelKo: '팔꿈치 굴곡 (양팔, FC)', phase: 'balance',
    energyRole: ["band_and_context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '양팔꿈치 굽힘 대칭 — 한쪽 쏠림은 상체 균형 흔들림 신호.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'B',
    placeholder: false
  },
  'gHandH': { key: 'gHandH', labelKo: '손 높이 (FC, 양팔)', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 양손 높이 맥락 — 릴리스 준비·상체 정렬 참고.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'gloveHumME': { key: 'gloveHumME', labelKo: '글러브팔 상완 에너지', phase: 'arm',
    energyRole: ["transfer","release","load"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '글러브팔 상완 운동에너지 맥락 — 양팔 부하 균형 참고.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'glovePullV': { key: 'glovePullV', labelKo: '글러브 당김 속도', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '글러브팔 당김·제동 속도 — 상체·팔 타이밍 맥락.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'gloveShPow': { key: 'gloveShPow', labelKo: '글러브 어깨 파워', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '글러브팔 어깨 관절 파워 peak — 양팔 부하 균형·상체 제동 맥락.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'grfDelay': { key: 'grfDelay', labelKo: '체중이동 시간 일관성', phase: 'consistency',
    energyRole: ["consistency"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'ms CV',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '뒷발→앞발 체중이동 시간 투구 간 변동. 낮을수록 리듬·반복성 유리.',
    relatedMetrics: ["strideLenCV","relTimingCvPct"],


    visualQualityGrade: 'B',
    placeholder: false
  },
  'handPostKH': { key: 'handPostKH', labelKo: 'KH 던지는 손 뒤쪽 위치', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: '%키',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '무릎 최고점에서 손이 어깨 뒤쪽에 있는 정도 — 몸통 전달 전 팔 분리 신호.',
    relatedMetrics: ["elbowPostKH","earlyArmRisk"],
    researchTab: 'ed-armball',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'hipAbd': { key: 'hipAbd', labelKo: '뒷고관절 내전 속도', phase: 'stride',
    energyRole: ["generation"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'bandGauge', unit: '°/s',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '뒷다리 고관절 내전 peak 각속도·추진 보조(IMU).',
    relatedMetrics: ["rearProp","propImpPct"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'hipHinge': { key: 'hipHinge', labelKo: '축발 힙 힌지', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°',
    eventWindow: {"start":"i_pi","startOff":-0.1,"end":"i_kl_peak","endOff":0.05},
    coachMeaning: '축발에 체중을 실으며 하체에 에너지를 저장하는 정도.',
    coachWarning: '부족하면 하체 적재·코일 준비가 약해질 수 있음.',
    correctionCue: '축발 위에 체중을 실고 엉덩이를 뒤로 빼는 느낌',
    relatedMetrics: ["wuPelCoil","wuCoilTq"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'horizAbdKH': { key: 'horizAbdKH', labelKo: 'KH 수평 외전', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '무릎 최고점 수평 외전 — 팔 조기 준비·early arm risk 보조.',
    relatedMetrics: ["earlyArmRisk","handPostKH"],
    researchTab: 'ed-armball',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'hssBuildKF': { key: 'hssBuildKF', labelKo: '분리 빌드업 (KH→FC)', phase: 'stride',
    energyRole: ["storage","generation"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브 후반에 골반-어깨 분리가 얼마나 쌓였는지.',
    correctionCue: '전진하면서 분리를 유지·빌드업',
    relatedMetrics: ["hssFC","pelOpenKF"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'hssFC': { key: 'hssFC', labelKo: '골반-어깨 분리 @FC', phase: 'stride',
    energyRole: ["storage","generation"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc","endOff":0.02},
    coachMeaning: '착지 시점 분리각·블로킹 직전 회전 preload 결과.',
    relatedMetrics: ["hssBuildKF","pelOpenKF"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'humME': { key: 'humME', labelKo: '상완 에너지 피크', phase: 'arm',
    energyRole: ["release"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '상완을 통한 에너지 방출.',
    correctionCue: '몸통 전달 뒤 팔로 공 방출',
    relatedMetrics: ["armRotV"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'humMEt': { key: 'humMEt', labelKo: '투구팔 상완 에너지 (전 구간)', phase: 'arm',
    energyRole: ["transfer","release","load"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '투구팔 상완 에너지 흐름 — 몸통 전달 대비 팔 부하 맥락.',
    relatedMetrics: ["armTransferRatio","humME"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'knee': { key: 'knee', labelKo: '앞무릎 전달 (6단계 요약)', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞무릎 전략·전달 유형 요약 — driveType·kneeExtROM 맥락.',
    researchTab: 'ph-knee',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'kneeAbs': { key: 'kneeAbs', labelKo: '앞무릎 흡수 모멘트 (context)', phase: 'block',
    energyRole: ["transfer"], displayPolicy: 'load_context', bandType: 'higher_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지·블로킹 구간 앞무릎 흡수 부하 맥락 — 단정 금지.',
    researchTab: 'ph-block',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'kneeAbsE': { key: 'kneeAbsE', labelKo: '앞무릎 흡수 에너지 (context)', phase: 'block',
    energyRole: ["transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞무릎 흡수 에너지 — 착지·블로킹 흡수 부하 맥락.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'kneeCollapse': { key: 'kneeCollapse', labelKo: '앞무릎 붕괴 위험', phase: 'block',
    energyRole: ["risk","load"], displayPolicy: 'risk_flag', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'kneeCollapseGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 후 앞무릎이 안쪽으로 무너지는 경향.',
    coachWarning: '크면 지지·전달·부상 위험에 연결될 수 있음.',
    correctionCue: '앞무릎을 바깥으로 지지하며 몸통 회전 준비',
    relatedMetrics: ["vgrfRetain","kneeTransfer"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'kneeContribPct': { key: 'kneeContribPct', labelKo: '무릎 신전 기여 비율', phase: 'transfer',
    energyRole: ["transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '%',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '하체→상체 전달에서 무릎 신전 기여 비율 맥락.',
    researchTab: 'ph-knee',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'kneeExtE': { key: 'kneeExtE', labelKo: '무릎 신전 에너지', phase: 'transfer',
    energyRole: ["transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞무릎 신전 에너지 — 전달·버팀 맥락.',
    researchTab: 'ph-knee',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'kneeExtROM': { key: 'kneeExtROM', labelKo: '앞무릎 신전 ROM (유형)', phase: 'block',
    energyRole: ["transfer","context"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: 'FC→BR 앞무릎 각 변화·Extension/Bracing/Collapse 유형 분류용.',
    relatedMetrics: ["kneeCollapse","blockingType"],
    researchTab: 'ph-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'kneeFlexSym': { key: 'kneeFlexSym', labelKo: '양무릎 굴곡 대칭 (FC)', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 앞·뒷무릎 굴곡 대칭 — 하체 균형·체중 실림 맥락.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'kneeTransfer': { key: 'kneeTransfer', labelKo: '앞다리→몸통 연결', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞다리 지지에서 몸통으로 에너지가 넘어가는 연결.',
    relatedMetrics: ["kneeTrunkLag","ppKneeTrunk"],


    visualQualityGrade: 'B',
    placeholder: false
  },
  'kneeTrunkLag': { key: 'kneeTrunkLag', labelKo: '앞무릎·몸통 타이밍', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'band_and_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'timingLollipop', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞무릎과 몸통 피크 타이밍 차이.',
    correctionCue: '앞다리 지지 후 몸통이 이어지는 순서',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'leadFootAngleFC': { key: 'leadFootAngleFC', labelKo: 'FC 앞발 방향', phase: 'stride',
    energyRole: ["braking","transfer"], displayPolicy: 'type_context', bandType: 'range',
    visualType: 'typeCard',
    stickVisualType: 'footDirectionDiagram', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc","endOff":0.02},
    coachMeaning: '착지 앞발 방향(코치=방향 라벨+벗어난 각도 · analyst=signed+라벨). signed norm band 보류.',
    coachWarning: '과도 개폐 시 전진→제동 전환 방향이 흔들릴 수 있음.',
    relatedMetrics: ["leadKneeFlexFC","strideLen"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'leadGrf': { key: 'leadGrf', labelKo: '앞발 수직 GRF peak', phase: 'block',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'N',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞발 수직 지면반력 peak — 제동·지지 맥락.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'leadHipMoment': { key: 'leadHipMoment', labelKo: '앞고관절 모멘트 (research)', phase: 'block',
    energyRole: ["load","risk"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '블로킹 구간 앞고관절 모멘트 peak — 하체 부하 맥락 · 단정 금지.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'leadHipWork': { key: 'leadHipWork', labelKo: '앞고관절 일 (FC→BR)', phase: 'block',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '블로킹·회전 구간 앞고관절 일 맥락.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'leadKneeFlex': { key: 'leadKneeFlex', labelKo: '앞무릎 굴곡 (FC)', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 앞무릎 각도 — 블로킹·신전 준비 맥락.',
    relatedMetrics: ["leadKneeFlexFC","kneeExtROM"],
    researchTab: 'ph-knee',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'leadKneeFlexFC': { key: 'leadKneeFlexFC', labelKo: 'FC 리드무릎 굴곡', phase: 'stride',
    energyRole: ["braking","transfer"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'eventSnapshot', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc","endOff":0.02},
    coachMeaning: 'FC 시점 앞무릎 굴곡각. 착지 순간 앞다리가 블로킹을 받을 준비가 되어 있는지 확인하는 지표입니다.',
    coachWarning: '너무 펴면 흡수 부족·너무 굽으면 붕괴 위험 — 적정 범위 해석.',
    correctionCue: '착지 순간 무릎이 살짝 굽은 채 지지',
    relatedMetrics: ["strideLen","leadFootAngleFC"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'leadKneeFlexionBR': { key: 'leadKneeFlexionBR', labelKo: 'BR 리드무릎 굴곡각', phase: 'block',
    energyRole: ["transfer","context"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventSnapshot', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '릴리스 시점 앞무릎 굽힘·FC 굴곡·신전 ROM과 함께 전략 해석.',
    relatedMetrics: ["leadKneeFlexFC","kneeExtROM"],
    researchTab: 'ph-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'leadKneeForce': { key: 'leadKneeForce', labelKo: '앞무릎 관절력 (부하)', phase: 'block',
    energyRole: ["transfer","load","risk"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'N',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '블로킹·신전 구간 앞무릎 관절력 — 부하 참고 · 단정 금지.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'leadKneeMoment': { key: 'leadKneeMoment', labelKo: '앞무릎 모멘트 (부하)', phase: 'block',
    energyRole: ["transfer","load","risk"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞무릎 모멘트 peak — 흡수·버팀 부하 맥락.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'leadVGRFImpulse': { key: 'leadVGRFImpulse', labelKo: '앞발 수직 임펄스', phase: 'block',
    energyRole: ["braking"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'impulseArea', unit: '%BW·s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞발이 몸을 지탱하는 수직 힘의 누적(vgrfRetain fallback).',
    relatedMetrics: ["vgrfRetain"],
    researchTab: 'ph-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'leanBack': { key: 'leanBack', labelKo: '몸통 뒤젖힘 @FC', phase: 'trunk',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 몸통이 뒤로 젖혀진 정도.',
    correctionCue: '과도한 뒤젖힘 없이 중립에 가깝게 착지',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'linRotRatio': { key: 'linRotRatio', labelKo: '선형→회전 전달비', phase: 'block',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '전진 에너지가 회전으로 전환되는 비율 맥락 — 연구·블로킹 참고.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'merPk': { key: 'merPk', labelKo: '어깨 MER', phase: 'arm',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '외회전 준비 범위. 유형별 적정 범위 참고.',
    relatedMetrics: ["scapLoad"],


    visualQualityGrade: 'B',
    placeholder: false
  },
  'openAng': { key: 'openAng', labelKo: '몸통 열림 @FC', phase: 'trunk',
    energyRole: ["storage","risk"], displayPolicy: 'risk_flag', bandType: 'range',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 몸통이 너무 일찍 열리는지.',
    relatedMetrics: ["xfReleasedPctByFC"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'pelClose': { key: 'pelClose', labelKo: '골반 닫힘 (드라이브)', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '드라이브 구간 골반 닫힘 맥락 — 전진·회전 준비 참고.',
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'pelObliq': { key: 'pelObliq', labelKo: '골반 기울기 (FC)', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 골반 좌우 기울기 — 하체·상체 정렬 맥락. signed 해석 · LHP dry-run.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'pelOpenKF': { key: 'pelOpenKF', labelKo: '골반 열림 (KH→FC)', phase: 'stride',
    energyRole: ["generation","storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브 중 골반 횡단 회전 시작·회전 전달 준비(전환 지표).',
    coachWarning: '블로킹 단계 해석과 함께 봄 — 단독 감점 아님.',
    relatedMetrics: ["hssBuildKF","hssFC"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'B',
    placeholder: false
  },
  'pelvisRotV': { key: 'pelvisRotV', labelKo: '골반 회전 속도', phase: 'knee',
    energyRole: ["transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'bandGauge', unit: '°/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '골반 회전 가속 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'pelvistrunk': { key: 'pelvistrunk', labelKo: '골반→몸통 회전 증폭', phase: 'trunk',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '골반 회전이 몸통으로 증폭되는 gain·동기화 — 운동사슬 맥락.',
    researchTab: 'ed-pelvistrunk',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'postureMaint': { key: 'postureMaint', labelKo: '낮은 자세 유지', phase: 'stride',
    energyRole: ["generation"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'eventSnapshot', unit: '점',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브 동안 COM 낙하·몸통 전경 변화를 합친 자세 유지(적정 범위).',
    coachWarning: '범위 이탈 시 착지 전 몸이 올라가거나 과도 낙하 → 블로킹 입력 약화.',
    correctionCue: '축발로 밀면서 상체가 먼저 들리지 않게 유지',
    relatedMetrics: ["comVDrop","trunkLeanChange"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'ppKneeTrunk': { key: 'ppKneeTrunk', labelKo: '무릎·몸통 피크 타이밍', phase: 'knee',
    energyRole: ["transfer","context"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'bandGauge',
    stickVisualType: 'simpleSequenceDiagram', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '타이밍 순서 설명용(단독 우열 아님).',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'ppShoElb': { key: 'ppShoElb', labelKo: '어깨·팔꿈치 타이밍', phase: 'arm',
    energyRole: ["transfer","context"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '상완·팔꿈치 순서 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'ppTrunkHum': { key: 'ppTrunkHum', labelKo: '몸통·상완 타이밍', phase: 'trunk',
    energyRole: ["transfer","context"], displayPolicy: 'band_and_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'timingLollipop', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통과 상완 피크 순서·간격.',
    correctionCue: '몸통 먼저, 팔은 뒤',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'propImpPct': { key: 'propImpPct', labelKo: '축발 추진 임펄스', phase: 'stride',
    energyRole: ["generation","transport"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'impulseArea', unit: '%BW·s',
    eventWindow: {"start":"i_kl_peak","startOff":-0.1,"end":"i_fc","endOff":0.05},
    coachMeaning: '드라이브에서 축발이 전진 운동량을 만드는 정도.',
    coachWarning: '낮으면 전진 에너지 생성이 부족할 수 있음.',
    correctionCue: '축발 지면을 밀며 몸을 앞으로 보내기',
    relatedMetrics: ["rearProp","strideLen"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'propPeakTiming': { key: 'propPeakTiming', labelKo: '추진 peak 타이밍', phase: 'stride',
    energyRole: ["generation","transport"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'timingLollipop', unit: '%',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: 'KH→FC 구간에서 추진 최대힘이 나온 시점(%)·너무 이르면 소실·늦으면 FC 준비 부족.',
    relatedMetrics: ["propImpPct","rearProp"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'rearProp': { key: 'rearProp', labelKo: '뒷발 추진', phase: 'stride',
    energyRole: ["generation"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'impulseArea', unit: '%BW',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '뒷발이 지면을 밀어 전진하는 힘 peak.',
    relatedMetrics: ["propImpPct"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'relTimingCvPct': { key: 'relTimingCvPct', labelKo: '릴리스 타이밍 일관성', phase: 'consistency',
    energyRole: ["consistency"], displayPolicy: 'band_and_context', bandType: 'lower_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'consistencyCard', unit: '%',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '구간 간 릴리스 타이밍 반복성.',
    correctionCue: '동일한 리듬·릴리스 감각 반복',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'relTimingMs': { key: 'relTimingMs', labelKo: '릴리스 타이밍 (절대 ms)', phase: 'consistency',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: 'FC 기준 릴리스까지 절대 시간 — 투구 간 타이밍 변동은 relTimingCvPct 참고.',
    relatedMetrics: ["relTimingCvPct"],
    researchTab: 'ph-consistency',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'releaseSdMm': { key: 'releaseSdMm', labelKo: '릴리스 위치 일관성', phase: 'consistency',
    energyRole: ["consistency"], displayPolicy: 'band_and_context', bandType: 'lower_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'consistencyCard', unit: 'mm SD',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '릴리스 포인트 반복성.',
    relatedMetrics: ["armSlotSdDeg"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'rotKEgain': { key: 'rotKEgain', labelKo: '회전 운동에너지 증가', phase: 'block',
    energyRole: ["context"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: 'FC→BR 골반+몸통 회전 KE 증가 — 에너지 전달 맥락.',
    researchTab: 'ph-block',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'scapLoad': { key: 'scapLoad', labelKo: '견갑 로딩', phase: 'arm',
    energyRole: ["storage","context"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔을 던지기 전 어깨·견갑 준비.',
    relatedMetrics: ["merPk"],


    visualQualityGrade: 'B',
    placeholder: false
  },
  'seqPct': { key: 'seqPct', labelKo: '시퀀스 정확도', phase: 'arm',
    energyRole: ["consistency","transfer"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'bandGauge',
    stickVisualType: 'simpleSequenceDiagram', unit: '%',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '운동사슬 순서 반복성 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'seqSpan': { key: 'seqSpan', labelKo: '키네매틱 시퀀스 총 지연', phase: 'consistency',
    energyRole: ["consistency"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'timingLollipop', unit: 'ms',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '골반→몸통→팔 peak 지연 합 — 시퀀스 전개 속도 맥락. 일관성 SD는 별도 변인.',
    relatedMetrics: ["relTimingCvPct","chainTiming"],
    researchTab: 'ph-consistency',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'shAbdAsym': { key: 'shAbdAsym', labelKo: '어깨 외전 비대칭 (FC)', phase: 'context',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '양 어깨 외전 차이 — 한쪽 쏠림·상체 기울기 참고.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'shGen': { key: 'shGen', labelKo: '어깨 에너지 생성', phase: 'arm',
    energyRole: ["generation","context"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '어깨에서 만들어지는 에너지 비중 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'shTilt': { key: 'shTilt', labelKo: '어깨 라인 기울기 (FC)', phase: 'balance',
    energyRole: ["context"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '양 어깨 연결선 좌우 기울기. 0에 가까울수록 수평·시선 안정.',
    coachWarning: '글러브 어깨 과도 상승 시 릴리스·균형 붕괴 가능.',
    researchTab: 'ph-balance',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'shoulderForce': { key: 'shoulderForce', labelKo: '어깨 분리력 (distraction)', phase: 'injuryload',
    energyRole: ["load","risk"], displayPolicy: 'load_context', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '어깨 분리력(distraction) peak — 견인 부하 맥뽽. 마커리스 추정·단정 금지.',
    coachWarning: '엘리트 대비 높으면 견인 부하 참고.',
    researchTab: 'ph-injuryload',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'shoulderMoment': { key: 'shoulderMoment', labelKo: '어깨 관절 모멘트 (결과)', phase: 'injuryload',
    energyRole: ["load","risk"], displayPolicy: 'load_context', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '어깨 관절 모멘트 peak — 회전·감속 시 어깨 부하 맥락.',
    coachWarning: '엘리트 대비 높으면 감속 부담 참고.',
    researchTab: 'ph-injuryload',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'stride': { key: 'stride', labelKo: '드라이브 (6단계 요약)', phase: 'stride',
    energyRole: ["generation","transport"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브·전진 전략 유형 요약 — strideLen·driveWork 맥락.',
    researchTab: 'ed-stride',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'strideLen': { key: 'strideLen', labelKo: '보폭·전진 거리', phase: 'stride',
    energyRole: ["generation","transport"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '%',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '전진 거리·보폭 전략. 유형마다 적정 범위가 다름.',
    correctionCue: '전략에 맞는 보폭·리듬 유지',
    researchTab: 'ed-stride',


    visualQualityGrade: 'B',
    placeholder: false
  },
  'strideLenCV': { key: 'strideLenCV', labelKo: '보폭 일관성', phase: 'consistency',
    energyRole: ["consistency"], displayPolicy: 'band_and_context', bandType: 'lower_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'consistencyCard', unit: '% CV',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '보폭 변동·제구 맥락.',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'strideTime': { key: 'strideTime', labelKo: '드라이브 시간 (KH→FC)', phase: 'stride',
    energyRole: ["generation","transport"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'timingLollipop', unit: 's',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: 'KH→FC 소요시간·빠른 템포형은 짧아도 전략상 정상일 수 있음.',
    relatedMetrics: ["strideType","propImpPct"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'torsoRotV': { key: 'torsoRotV', labelKo: '몸통 회전 속도', phase: 'trunk',
    energyRole: ["generation"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 회전 가속이 충분한지.',
    relatedMetrics: ["trunkME"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'trkOpenKF': { key: 'trkOpenKF', labelKo: '몸통 열림 (KH→FC)', phase: 'stride',
    energyRole: ["risk","context"], displayPolicy: 'risk_flag', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '드라이브 중 몸통 조기 열림·전진 중 꼬임·닫힘이 풀리는 위험 신호.',
    coachWarning: '클수록 착지 전 저장 에너지 누수·몸통-팔 전달 상한 저하 가능.',
    correctionCue: '전진 중 상체 열림 억제·착지까지 분리 유지',
    relatedMetrics: ["trunkResistRatio","hssBuildKF"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'trunk': { key: 'trunk', labelKo: '몸통 에너지 (6단계 요약)', phase: 'trunk',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 에너지 생성·전달 유형 — trunkME·회전 맥락.',
    researchTab: 'ph-trunk',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'trunkFlexKE': { key: 'trunkFlexKE', labelKo: '몸통 굴곡 운동에너지', phase: 'arm',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 전경 flexion KE — 덮기·전달 맥락.',
    researchTab: 'ph-trunk',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'trunkFlexV': { key: 'trunkFlexV', labelKo: '몸통 굴곡 속도', phase: 'arm',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 전경(flexion) 속도 — 에너지 전달·팔 타이밍 맥락.',
    researchTab: 'ph-trunk',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'trunkLat': { key: 'trunkLat', labelKo: 'FC 몸통 좌우 기울기 (signed)', phase: 'trunk',
    energyRole: ["storage","generation","context"], displayPolicy: 'research_only', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '연구·analyst 전용 signed lateral tilt. 측굴 속도·점수는 trunkLatV. 코치 기본 화면 미노출.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'trunkLatKE': { key: 'trunkLatKE', labelKo: '몸통 측굴 운동에너지', phase: 'arm',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 lateral KE — trunkLatV와 함께 해석.',
    relatedMetrics: ["trunkLatV"],
    researchTab: 'ph-trunk',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'trunkLatV': { key: 'trunkLatV', labelKo: '몸통 측굴 속도', phase: 'arm',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '°/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 좌우 기울기 속도 — trunkLat(signed) 대비 코치용 속도 지표.',
    relatedMetrics: ["trunkLat"],
    researchTab: 'ph-trunk',


    visualQualityGrade: 'B',
    placeholder: false
  },
  'trunkLeanChange': { key: 'trunkLeanChange', labelKo: '몸통 전경 변화 (KH→FC)', phase: 'stride',
    energyRole: ["generation","context"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '상체 전경(앞뒤) 변화·자세 유지 점수 0.3 성분(음수=전경 유지).',
    relatedMetrics: ["postureMaint","comVDrop"],
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'trunkME': { key: 'trunkME', labelKo: '몸통 에너지 피크', phase: 'trunk',
    energyRole: ["generation"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통에서 회전 에너지가 만들어진 정도.',
    correctionCue: '하체 지지 위에서 몸통 회전 먼저',
    relatedMetrics: ["torsoRotV","armTransferRatio"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'trunkResistRatio': { key: 'trunkResistRatio', labelKo: '몸통 버팀비 (골반÷몸통 열림)', phase: 'stride',
    energyRole: ["generation","storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '비',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '골반은 열리고 몸통은 버티는지(>1=골반 선행·근위 선행 양호).',
    relatedMetrics: ["pelOpenKF","trkOpenKF"],
    researchTab: 'ph-drive',


    visualQualityGrade: 'B',
    placeholder: false
  },
  'trunkRotKE': { key: 'trunkRotKE', labelKo: '몸통 돌리기 운동에너지', phase: 'arm',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: 'J',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통 회전 KE — 에너지 전달·저장 맥락(연구 보조).',
    researchTab: 'ph-trunk',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'trunkarm': { key: 'trunkarm', labelKo: '몸통→팔 (6단계 요약)', phase: 'trunk',
    energyRole: ["storage","generation","transfer","release","load"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '몸통에서 팔로 에너지 전달 유형 — armTransferRatio 맥락.',
    researchTab: 'ed-armball',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'vgrfPattern': { key: 'vgrfPattern', labelKo: '앞발 VGRF 유지 패턴', phase: 'block',
    energyRole: ["braking","conversion"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지~릴리스 앞발 수직력 패턴(증가·유지·감소) — 제동·지지 맥락.',
    researchTab: 'ph-block',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'vgrfRetain': { key: 'vgrfRetain', labelKo: '앞다리 지지 유지', phase: 'block',
    energyRole: ["braking"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'bandGaugeVgrfPattern', unit: '%',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '앞발 수직 지지가 브레이킹 구간 동안 유지되는 정도.',
    relatedMetrics: ["kneeCollapse","leadVGRFImpulse"],
    researchTab: 'ph-blocking',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'whipRatio': { key: 'whipRatio', labelKo: '채찍 비율', phase: 'arm',
    energyRole: ["transfer","context"], displayPolicy: 'research_only', bandType: 'none',
    visualType: 'bandGauge',
    stickVisualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '팔/몸통 에너지 비율 맥락.',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'windup': { key: 'windup', labelKo: '와인드업 (6단계 요약)', phase: 'windup',
    energyRole: ["context"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard', unit: '',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '와인드업·저장 전략 유형 요약 — windupType·코일 변인 맥락.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuCoilTq': { key: 'wuCoilTq', labelKo: '와인드업 꼬임 준비', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'dynamicTorqueCircle', unit: 'N·m/kg',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '와인드업에서 몸을 감아두는 힘 — 뒷발 지면 꼬임으로 저장 준비.',
    correctionCue: '뒷발 외곽으로 지면을 눌러 꼬임 유지',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuDriveHipER': { key: 'wuDriveHipER', labelKo: '축발 고관절 회전 준비', phase: 'windup',
    energyRole: ["storage","generation","transport"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '무릎 최고점 뒷다리 고관절 바깥 돌림 — 드라이브·하체 저장 맥락.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuDur': { key: 'wuDur', labelKo: '와인드업 구간 시간', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: 'ms',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: 'PI→KH 와인드업 소요 시간 — 리듬·템포 맥락.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuHSS': { key: 'wuHSS', labelKo: '하체·상체 분리', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '와인드업에서 하체와 상체 분리(코일)가 얼마나 형성됐는지.',
    relatedMetrics: ["hssBuildKF","hssFC"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuHSSbuild': { key: 'wuHSSbuild', labelKo: '골반-몸통 분리 쌓임', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '와인드업에서 골반-몸통 분리가 쌓였는지 — 부족하면 저장 준비가 약해질 수 있음.',
    correctionCue: '리듬 유지하며 하체·상체 분리 쌓기',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuHcm': { key: 'wuHcm', labelKo: '무릎 최대 높이', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge', unit: 'cm',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '무릎 최고점 수직 위치 — 키 대비 wuHpct와 함께 해석.',
    relatedMetrics: ["wuHpct"],
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuHpct': { key: 'wuHpct', labelKo: '무릎 최대 높이 (키 대비)', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge', unit: '%',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '무릎 들기 높이 — 드라이브·리듬 맥락. 과도·부족 모두 전략 신호.',
    relatedMetrics: ["wuHcm"],
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuKneeAP': { key: 'wuKneeAP', labelKo: '무릎 최고점 앞뒤 위치', phase: 'windup',
    energyRole: ["storage","transfer"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge', unit: 'cm',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: 'KH 시 무릎 전후(CoM 기준) — 체중 실림·축발 방향 맥락.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuKneeML': { key: 'wuKneeML', labelKo: '무릎 최고점 좌우 위치', phase: 'windup',
    energyRole: ["storage","transfer"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge', unit: 'cm',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: 'KH 시 무릎 좌우 — 균형·하체 정렬. signed 해석·방향 라벨.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuPct': { key: 'wuPct', labelKo: '와인드업 비중', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge', unit: '%',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: 'PI→FC 구간 중 KH까지 비율 — 템포·리듬(빠른/느린 와인드업).',
    relatedMetrics: ["wuDur"],
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuPelCloseKH': { key: 'wuPelCloseKH', labelKo: '골반 닫힘각 (무릎 최고점)', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '무릎 최고점 골반 닫힘. 감긴 양(coil)과 구분 — 닫힘 각도 맥락.',
    correctionCue: '무릎 올릴 때 골반이 닫힌 느낌 유지',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuPelCoil': { key: 'wuPelCoil', labelKo: '골반 코일', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '다리 들기~무릎 최고점 골반이 반대로 감기며 회전을 저장하는 정도.',
    correctionCue: '리듬을 유지하며 골반·몸통 닫힘 준비',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuPelVel': { key: 'wuPelVel', labelKo: '골반 회전 속도 (와인드업)', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '와인드업 구간 골반 회전 속도 peak — 코일·리듬 맥락. range 밴드.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuShER': { key: 'wuShER', labelKo: 'KH 어깨 Z각 (보조)', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'research_only', bandType: 'higher_is_better',
    visualType: 'bandGauge', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '무릎 최고점 어깨 Z각 — early arm·wuShER 보조(연구).',
    researchTab: 'ed-windup',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'wuTrkVel': { key: 'wuTrkVel', labelKo: '몸통 회전 속도 (와인드업)', phase: 'windup',
    energyRole: ["storage"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '와인드업 몸통 회전 속도 — 골반 대비 몸통 감김·코일 맥락.',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuTrunkCloseKH': { key: 'wuTrunkCloseKH', labelKo: '몸통 닫힘각 (무릎 최고점)', phase: 'windup',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: 'KH 몸통 닫힘 — 코일·저장 준비. wuTrunkCoil과 함께 해석.',
    relatedMetrics: ["wuTrunkCoil","wuPelCloseKH"],
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'wuTrunkCoil': { key: 'wuTrunkCoil', labelKo: '몸통 코일', phase: 'windup',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '같은 구간 몸통이 반대로 감기는 정도 — 골반 코일과 함께 해석.',
    correctionCue: '골반 닫힘과 함께 몸통 감김 유지',
    researchTab: 'ed-windup',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'xfAtFC': { key: 'xfAtFC', labelKo: 'FC 시 X-Factor', phase: 'trunk',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'range_context', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '착지 시 골반-몸통 분리 유지량 — xfPeak 대비 보존 정도.',
    relatedMetrics: ["xfPeak","xfReleasedPctByFC"],
    researchTab: 'ph-trunk',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'xfPeak': { key: 'xfPeak', labelKo: '피크 X-Factor', phase: 'trunk',
    energyRole: ["storage"], displayPolicy: 'research_only', bandType: 'range',
    visualType: 'bandGauge',
    stickVisualType: 'topViewSeparationGauge', unit: '°',
    eventWindow: {"start":"i_kl_peak","end":"i_br"},
    coachMeaning: '골반과 몸통이 얼마나 분리되어 회전 준비가 되었는지를 봅니다. 분리가 크다고 항상 좋은 것은 아니며, 언제 만들어지고 언제 풀리는지가 중요합니다.',
    analystDefinition: '현재 X-factor는 Theia/Visual3D Trunk_wrt_Pelvis_Angle_Z 기반의 골반 기준 몸통 분절 Z축 상대회전각입니다.',
    analystCalculation: 'trial.x_factor · orient 적용 · KH→BR peak · 코치=|magnitude| · 분석원=signed+abs',
    analystInterpretation: '글로벌 수평면 shoulder yaw − pelvis yaw 방식은 스리쿼터·사이드암·언더암 투수에서 투영 오류가 커질 수 있으므로 기본 SSOT로 사용하지 않습니다.',
    displayAbsCoach: true,


    visualQualityGrade: 'D',
    placeholder: false
  },
  'xfPeakFromFC': { key: 'xfPeakFromFC', labelKo: 'X-Factor 풀림 시점 (FC 기준)', phase: 'storage',
    energyRole: ["band_and_context"], displayPolicy: 'type_context', bandType: 'none',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: 'FC 이후 분리 풀림 시작 타이밍 — flying open·저장 누수 맥락.',
    relatedMetrics: ["xfReleasedPctByFC","xfUnwindV"],
    researchTab: 'ph-trunk',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'xfReleasedPctByFC': { key: 'xfReleasedPctByFC', labelKo: 'FC까지 분리 풀림', phase: 'trunk',
    energyRole: ["storage","risk"], displayPolicy: 'risk_flag', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '%',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '골반·몸통 분리가 착지 전에 너무 일찍 풀리는지 봅니다(flying open).',
    displayAbsCoach: true,
    coachWarning: '높으면 저장 에너지 누수·타이밍 문제 가능.',
    correctionCue: 'FC 직전까지 분리 유지 후 풀기',
    relatedMetrics: ["leanBack","openAng"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'xfUnwindV': { key: 'xfUnwindV', labelKo: 'X-Factor 풀림 속도', phase: 'trunk',
    energyRole: ["generation","transfer"], displayPolicy: 'band_and_context', bandType: 'higher_is_better',
    visualType: 'timeSeriesWithEvents',
    stickVisualType: 'eventTimeSeries', unit: '°/s',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: '분리가 풀리며 몸통 회전으로 이어지는 속도(저장→전환).',
    displayAbsCoach: true,
    relatedMetrics: ["trunkME"],


    visualQualityGrade: 'A',
    placeholder: false
  },
  'xftiming': { key: 'xftiming', labelKo: '몸통 꼬임·풀림 타이밍', phase: 'trunk',
    energyRole: ["storage","generation","transfer"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'bandGauge', unit: '',
    eventWindow: {"start":"i_fc","end":"i_br"},
    coachMeaning: 'X-factor 보존·풀림 타이밍 유형 — FC까지 유지 후 전환.',
    researchTab: 'ed-xftiming',


    visualQualityGrade: 'D',
    placeholder: false
  },
  'windupType': { key: 'windupType', labelKo: '와인드업 유형', phase: 'windup',
    energyRole: ["context"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '저장 전략 유형(리듬·코일·축발 등).',
    correctionCue: '유형에 맞는 리듬·코일 감각',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'strideType': { key: 'strideType', labelKo: '드라이브 유형', phase: 'stride',
    energyRole: ["context"], displayPolicy: 'type_context', bandType: 'type',
    visualType: 'typeCard',
    stickVisualType: 'typeDiagram', unit: '',
    eventWindow: {"start":"i_kl_peak","end":"i_fc"},
    coachMeaning: '이 선수의 드라이브 패턴(긴 보폭·빠른 템포·깊은 낙하 등) 분류. 좋음/나쁨이 아니라 추진·자세 유지·착지 입력을 설명하는 전략입니다.',
    correctionCue: '유형에 맞는 보폭·추진·리듬 유지',
    researchTab: 'ed-stride',


    visualQualityGrade: 'A',
    placeholder: false
  },
  'earlyArmRisk': { key: 'earlyArmRisk', labelKo: '팔 조기 준비 위험', phase: 'windup',
    energyRole: ["risk"], displayPolicy: 'risk_flag', bandType: 'lower_is_better',
    visualType: 'riskPanel',
    stickVisualType: 'riskMatrix', unit: '',
    eventWindow: {"start":"i_pi","end":"i_kl_peak"},
    coachMeaning: '팔이 몸통보다 일찍 준비되는 경향.',
    coachWarning: '몸통 전달 전 팔 부담 가능.',
    correctionCue: '몸통 회전 전 팔 분리 억제',
    relatedMetrics: ["handPostKH","elbowPostKH"],


    visualQualityGrade: 'D',
    placeholder: false
  },

  };

  function get(key) {
    if (!key) return null;
    var base = REGISTRY[key] || {
      key: key, labelKo: key, phase: 'context', energyRole: ['context'],
      displayPolicy: 'band_and_context', bandType: 'higher_is_better', visualType: 'bandGauge',
      eventWindow: { start: 'i_fc', end: 'i_br' },
      coachMeaning: '— 등록되지 않은 변인(런타임 placeholder).',
      placeholder: true
    };
    if (typeof VAR_COPY !== 'undefined' && VAR_COPY.resolve) {
      return Object.assign({}, base, VAR_COPY.resolve(key, base, null));
    }
    return base;
  }

  function allKeys() { return Object.keys(REGISTRY); }

  function roleChips(roles) {
    return (roles || []).map(function (r) {
      return '<span class="varvis-chip" data-role="' + r + '">' + (ROLE_KO[r] || r) + '</span>';
    }).join(' ');
  }

  function metricBand(m, M6, NB) {
    if (!m || m.value == null || !isFinite(m.value) || m.neutral) return { code: 'na', label: '—', leak: false };
    if (!M6 || !NB) return { code: 'na', label: '측정 없음', leak: false };
    var nm = NB[m.key];
    if (!nm) return { code: 'na', label: '규준 없음', leak: false };
    var b = M6.band(m.value, nm, m.dir);
    if (!b) return { code: 'na', label: '—', leak: false };
    if (b === '미흡') return { code: 'weak', label: '결함', leak: true };
    if (b === '우수') return { code: 'strong', label: '우수', leak: false };
    return { code: 'ok', label: '양호', leak: false };
  }

  function aggregateBand(bands) {
    if (!bands.length) return { code: 'na', label: '—' };
    if (bands.some(function (b) { return b.code === 'weak'; })) return { code: 'weak', label: '결함' };
    if (bands.some(function (b) { return b.code === 'caution' || b.label === '주의'; })) return { code: 'caution', label: '주의' };
    if (bands.some(function (b) { return b.label === '부하 위험'; })) return { code: 'risk', label: '부하 위험' };
    if (bands.every(function (b) { return b.code === 'strong'; })) return { code: 'strong', label: '우수' };
    if (bands.some(function (b) { return b.code === 'strong'; })) return { code: 'ok', label: '양호' };
    if (bands.some(function (b) { return b.code === 'ok'; })) return { code: 'ok', label: '양호' };
    return { code: 'na', label: '—' };
  }

  function cellMetrics(DATA, rowId, col, M6, NB) {
    var out = [];
    if (!DATA || !DATA.phases || !DATA.phases.stages) return out;
    var colRoles = col.roles || [];
    DATA.phases.stages.forEach(function (st) {
      (st.metrics || []).forEach(function (m) {
        if (!m.key) return;
        var spec = get(m.key);
        var ph = spec.phase === 'stride' ? (st.key === 'stride' ? 'stride' : spec.phase) : spec.phase;
        if (ph !== rowId && !(rowId === 'stride' && st.key === 'stride')) return;
        if (rowId === 'consistency' && st.key !== 'consistency') return;
        if (rowId !== 'consistency' && ph === 'consistency') return;
        var hit = (spec.energyRole || []).some(function (r) { return colRoles.indexOf(r) >= 0; });
        if (!hit) return;
        if (spec.displayPolicy === 'research_only' && spec.placeholder) return;
        out.push({ m: m, spec: spec, band: metricBand(m, M6, NB), st: st });
      });
    });
    return out;
  }

  function buildMatrixHTML(DATA, M6, NB, opts) {
    opts = opts || {};
    var filter = opts.roleFilter || null;
    var html = '<div class="varvis-matrix-wrap"><div class="sub2" style="margin-bottom:8px"><b>단계 × 에너지 역할</b> · 칸 클릭 → 해당 변인 · 결함 우선 집계</div>';
    html += '<div class="varvis-filters" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
    [{ id: '', label: '전체' }].concat(MATRIX_COLS.map(function (c) { return { id: c.roles[0], label: ROLE_KO[c.roles[0]] || c.label }; }))
      .concat([{ id: 'risk', label: '위험' }, { id: 'consistency', label: '반복성' }])
      .forEach(function (f) {
        var on = (filter === f.id) || (!filter && !f.id);
        html += '<button type="button" class="varvis-filter-btn' + (on ? ' on' : '') + '" data-vf="' + f.id + '" onclick="VAR_VIS.setRoleFilter(this.getAttribute(\'data-vf\'))">' + f.label + '</button>';
      });
    html += '</div><table class="varvis-matrix"><thead><tr><th></th>';
    MATRIX_COLS.forEach(function (c) {
      html += '<th>' + c.label + '</th>';
    });
    html += '</tr></thead><tbody>';
    MATRIX_ROWS.forEach(function (row) {
      html += '<tr><th>' + row.label + '</th>';
      MATRIX_COLS.forEach(function (col) {
        var items = cellMetrics(DATA, row.id, col, M6, NB);
        var bands = items.map(function (x) { return x.band; });
        var agg = aggregateBand(bands);
        var cls = 'varvis-cell varvis-' + agg.code;
        html += '<td class="' + cls + '" data-row="' + row.id + '" data-col="' + col.id + '" onclick="VAR_VIS.onMatrixCell(\'' + row.id + '\',\'' + col.id + '\')" title="클릭: 변인 목록">' + agg.label + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table><div id="varvis-matrix-detail" class="note" style="margin-top:10px">칸을 클릭하면 아래에 변인 카드가 표시됩니다.</div></div>';
    return html;
  }

  var _matrixState = { row: null, col: null, roleFilter: '' };

  function setRoleFilter(id) {
    _matrixState.roleFilter = id || '';
    if (typeof window !== 'undefined' && window.VAR_VIS_refreshMatrix) window.VAR_VIS_refreshMatrix();
  }

  function onMatrixCell(rowId, colId) {
    _matrixState.row = rowId;
    _matrixState.col = colId;
    var host = typeof document !== 'undefined' ? document.getElementById('varvis-matrix-detail') : null;
    if (!host || typeof DATA === 'undefined') return;
    var M6 = (typeof mech6 !== 'undefined') ? mech6 : null;
    var NB = (typeof BIOMOTION_NORMS !== 'undefined') ? BIOMOTION_NORMS : null;
    var col = MATRIX_COLS.filter(function (c) { return c.id === colId; })[0];
    if (!col) return;
    var items = cellMetrics(DATA, rowId, col, M6, NB);
    if (!items.length) { host.innerHTML = '해당 칸에 표시할 변인 없음'; return; }
    host.innerHTML = '<b>' + (MATRIX_ROWS.filter(function (r) { return r.id === rowId; })[0] || {}).label + ' · ' + col.label + '</b>'
      + items.map(function (x) {
        var b = x.band;
        return '<div class="varvis-card" onclick="VAR_VIS.openPanel(\'' + x.m.key + '\')" style="cursor:pointer;margin-top:8px;padding:8px 10px;background:var(--bg2);border-radius:8px;border-left:3px solid var(--cyan)">'
          + '<span style="font-weight:700">' + (x.spec.labelKo || x.m.key) + '</span> '
          + '<span style="font-size:12px;color:var(--amber)">' + b.label + '</span>'
          + '<div class="sub2" style="margin-top:4px">' + (x.spec.coachMeaning || '').slice(0, 80) + (x.spec.coachMeaning && x.spec.coachMeaning.length > 80 ? '…' : '') + '</div></div>';
      }).join('');
  }

  function bandStatusLabel(m, M6, NB) {
    var b = metricBand(m, M6, NB);
    return b.label;
  }

  function statusColor(code) {
    if (code === 'weak') return 'var(--amber)';
    if (code === 'strong') return 'var(--green)';
    if (code === 'risk' || code === 'caution') return 'var(--red)';
    return 'var(--cyan)';
  }

  function isCoachSurface() {
    try {
      var rm = (typeof _reportMode !== 'undefined') ? _reportMode : '';
      return rm === 'coach' || rm === 'player';
    } catch (e) { return false; }
  }

  function renderBandGauge(host, m, spec, M6, NB) {
    if (!host || !m) return;
    var nm = NB && NB[m.key];
    var val = m.value;
    var coachSurf = isCoachSurface();
    var html = '<div class="varvis-bandgauge">';
    if (nm && val != null && isFinite(val) && m.dir && m.dir !== 'range') {
      var lo = nm.p25, hi = nm.p75, med = nm.med;
      var span = hi - lo || 1;
      var pos = Math.max(0, Math.min(100, ((val - lo) / span) * 100));
      html += '<div style="font-size:22px;font-weight:800">' + val + (m.unit || spec.unit || '') + '</div>';
      html += '<div style="height:10px;background:var(--bg2);border-radius:5px;margin:8px 0;position:relative">'
        + '<div style="position:absolute;left:0;width:100%;height:100%;background:linear-gradient(90deg,rgba(232,149,78,.35),rgba(91,182,230,.35),rgba(70,201,140,.35));border-radius:5px"></div>'
        + '<div style="position:absolute;left:' + pos + '%;top:-3px;width:4px;height:16px;background:#fff;border-radius:2px;transform:translateX(-50%)"></div></div>';
      if (!coachSurf) html += '<div class="sub2">엘리트 p25–p75: ' + lo + ' – ' + hi + ' (med ' + med + ')</div>';
    } else if (m.dir === 'range' && nm) {
      html += '<div style="font-size:22px;font-weight:800">' + (val != null ? val : '—') + (m.unit || '') + '</div>';
      if (!coachSurf) html += '<div class="sub2">적정 범위 p25–p75: ' + nm.p25 + ' – ' + nm.p75 + '</div>';
    } else {
      html += '<div style="font-size:22px;font-weight:800">' + (val != null ? val : '—') + (m.unit || spec.unit || '') + '</div>';
      if (!coachSurf) html += '<div class="sub2">규준 없음 · 값만 표시</div>';
    }
    html += '<div style="margin-top:6px;font-weight:700;color:' + statusColor(metricBand(m, M6, NB).code) + '">상태: ' + bandStatusLabel(m, M6, NB) + '</div></div>';
    host.innerHTML = html;
  }

  function renderRiskPanel(host, m, spec) {
    host.innerHTML = '<div class="varvis-risk" style="padding:12px;background:rgba(255,77,77,.08);border:1px solid var(--red);border-radius:8px">'
      + '<div style="font-size:15px;font-weight:800;color:var(--red)">주의 · 위험 신호</div>'
      + '<div style="margin-top:8px;font-size:18px;font-weight:800">' + (m.value != null ? m.value : '—') + (m.unit || spec.unit || '') + '</div>'
      + (spec.coachWarning ? '<div class="note" style="margin-top:8px">' + spec.coachWarning + '</div>' : '')
      + (m.warn ? '<div class="note" style="margin-top:4px;color:var(--amber)">' + m.warn + '</div>' : '') + '</div>';
  }

  function renderTypeCard(host, m, spec) {
    var txt = (m.value != null ? String(m.value) : '—');
    if (m.key === 'windupType' && typeof phases !== 'undefined' && phases.windupType && DATA && DATA.phases) {
      try { var wt = phases.windupType(DATA.phases); if (wt && wt.easy) txt = wt.easy + ' (' + (wt.name || '') + ')'; } catch (e) {}
    }
    if (m.key === 'strideType' && typeof phases !== 'undefined' && phases.strideType && DATA && DATA.phases) {
      try { var st = phases.strideType(DATA.phases); if (st && st.easy) txt = st.easy + ' (' + (st.name || '') + ')'; } catch (e) {}
    }
    if (m.key === 'blockingType' && m.value) txt = String(m.value);
    if (m.key === 'driveType' && m.value) txt = String(m.value);
    if (m.key === 'driveType' && DATA && DATA.phases && DATA.phases.stages) {
      try {
        var tr = DATA.phases.stages.filter(function (s) { return s.key === 'transfer'; })[0];
        var dm = tr && (tr.metrics || []).filter(function (x) { return x.key === 'driveType'; })[0];
        if (dm && dm.value) txt = String(dm.value);
      } catch (e) {}
    }
    host.innerHTML = '<div class="varvis-type" style="padding:14px;background:var(--bg2);border-radius:8px;border:1px solid var(--line)">'
      + '<div style="font-size:12px;color:var(--fg2)">유형 (점수 아님 · 전략 차이)</div>'
      + '<div style="font-size:20px;font-weight:800;margin-top:6px">' + txt + '</div></div>';
  }

  function renderTimeSeries(host, key) {
    if (!host) return;
    host.innerHTML = '<canvas id="varvis-canvas" width="640" height="220" style="width:100%;max-width:100%;background:var(--bg2);border-radius:8px"></canvas>'
      + '<div class="sub2" style="margin-top:6px">FC=0 정렬 · 상단 trial 선택 연동</div>';
    if (typeof plotWin !== 'function' || typeof _FC_SER === 'undefined' || !_FC_SER[key]) {
      host.innerHTML += '<div class="note">시계열 시각화 준비 중(_FC_SER 없음) — bandGauge만 표시</div>';
      return;
    }
    var cfg = _FC_SER[key];
    var ft = (typeof _fastTrial === 'function') ? _fastTrial() : null;
    if (!ft) return;
    setTimeout(function () {
      try {
        var ew = get(key).eventWindow || { start: 'i_fc', end: 'i_br' };
        plotWin('varvis-canvas', {
          fast: ft, startEv: ew.start || 'i_fc', startOff: ew.startOff || 0, endEv: ew.end || 'i_br', endOff: ew.endOff || 0.05,
          left: { label: '', lines: [{ compute: cfg.fn, color: cfg.c || '#5bb6e6', label: get(key).labelKo, width: 2.4 }] },
          noGauge: true
        });
      } catch (e) { console.warn('varvis plot', e); }
    }, 50);
  }

  function openPanel(key) {
    if (typeof document === 'undefined') return;
    if (isCoachSurface()) {
      try {
        if (typeof window !== 'undefined' && typeof window.selectVariableForCoach === 'function') {
          window.selectVariableForCoach(key);
          return;
        }
        if (typeof window !== 'undefined' && typeof window._selectVarCoachView === 'function') {
          window._selectVarCoachView(key);
          return;
        }
        if (typeof window !== 'undefined' && typeof window._selectVarStickViz === 'function') window._selectVarStickViz(key);
        if (typeof window !== 'undefined' && typeof window._scrollToVarDetail === 'function') window._scrollToVarDetail(key);
        return;
      } catch (e) { }
    }
    var spec = get(key);
    var hit = (typeof _bmFindMetric === 'function') ? _bmFindMetric(key) : null;
    var m = hit ? hit.m : null;
    var M6 = (typeof mech6 !== 'undefined') ? mech6 : null;
    var NB = (typeof BIOMOTION_NORMS !== 'undefined') ? BIOMOTION_NORMS : null;
    var ov = document.getElementById('varvis-overlay');
    if (!ov) return;
    ov.classList.remove('varvis-hidden');
    var body = document.getElementById('varvis-body');
    if (!body) return;
    var vt = spec.visualType;
    if (key === 'leadKneeFlexFC' || spec.visualSubType === 'eventSnapshotLink') vt = 'bandGauge';
    else if (vt === 'timeSeriesWithImpulse' || vt === 'timingLollipop' || vt === 'rangeBand') vt = _FC_SER && _FC_SER[key] ? 'timeSeriesWithEvents' : 'bandGauge';
    var status = m ? metricBand(m, M6, NB) : { label: '—', code: 'na' };
    if (spec.displayPolicy === 'type_context') status = { label: '전략 유형 · 점수/결함 판정 없음', code: 'na' };
    else if (m && m.dir === 'range' && m.value != null && M6 && NB && NB[key]) {
      var rw = M6.bandWord(m.value, NB[key], 'range');
      if (rw === '부족' || rw === '높음') status = { label: rw + ' (적정 범위)', code: rw === '높음' ? 'caution' : 'weak' };
    }
    var fbNote = spec.placeholder ? '<div class="note" style="margin-top:8px;color:var(--fg2)">시각화 메타 준비 중 — 값·규준·코치 설명만 표시(fallback panel).</div>' : '';
    var cp = (typeof VAR_COPY !== 'undefined' && VAR_COPY.resolve) ? VAR_COPY.resolve(key, spec, m) : null;
    var coachSurf = isCoachSurface();
    var copyHtml = '';
    var auditMode = false;
    try { auditMode = (typeof _isDebugAuditMode === 'function') && _isDebugAuditMode(); } catch (e) { }
    if (cp) {
      if (coachSurf) {
        copyHtml = (cp.playerSentence ? '<div class="note" style="margin-top:12px;line-height:1.6">' + cp.playerSentence + '</div>' : '')
          + (cp.coachCue ? '<div class="note" style="margin-top:6px"><b>교정</b> · ' + cp.coachCue + '</div>' : '')
          + (cp.coachObservation ? '<div class="note" style="margin-top:4px;color:var(--fg2)"><b>관찰</b> · ' + cp.coachObservation + '</div>' : '');
      } else {
        copyHtml = '<div class="note" style="margin-top:12px;line-height:1.6"><b>정의</b> · ' + (cp.analystDefinition || '—') + '</div>'
          + '<div class="note" style="margin-top:4px"><b>산출</b> · ' + (cp.analystCalculation || '—') + '</div>'
          + '<div class="note" style="margin-top:4px"><b>해석</b> · ' + (cp.analystInterpretation || '—') + '</div>'
          + '<div class="note" style="margin-top:4px"><b>선수 문장</b> · ' + (cp.playerSentence || '—') + '</div>'
          + (cp.coachCue ? '<div class="note" style="margin-top:6px"><b>교정 cue</b> · ' + cp.coachCue + '</div>' : '');
        if (auditMode && cp.researchNote) {
          copyHtml += '<div class="note" style="margin-top:6px;color:var(--fg2)"><b>research</b> · ' + cp.researchNote + '</div>';
        }
      }
    } else {
      copyHtml = '<div class="note" style="margin-top:12px;line-height:1.6"><b>왜 중요한가</b> · ' + (spec.coachMeaning || '—') + '</div>'
        + (spec.coachWarning ? '<div class="note" style="margin-top:6px"><b>주의</b> · ' + spec.coachWarning + '</div>' : '')
        + (spec.correctionCue ? '<div class="note" style="margin-top:6px"><b>교정 cue</b> · ' + spec.correctionCue + '</div>' : '');
    }
    body.innerHTML = '<button type="button" class="varvis-close" onclick="VAR_VIS.closePanel()">×</button>'
      + '<h3 style="margin:0 0 8px">' + spec.labelKo + (spec.placeholder ? ' <span class="sub2">· 준비 중</span>' : '') + '</h3>'
      + '<div style="margin-bottom:10px">' + roleChips(spec.energyRole) + '</div>'
      + '<div style="font-size:14px;font-weight:800;margin-bottom:12px;color:' + statusColor(status.code) + '">상태: ' + status.label + '</div>'
      + '<div id="varvis-viz"></div>' + fbNote + copyHtml
      + (spec.relatedMetrics && spec.relatedMetrics.length ? '<div style="margin-top:10px">' + spec.relatedMetrics.map(function (rk) {
        return '<button type="button" class="varvis-rel-btn" onclick="VAR_VIS.openPanel(\'' + rk + '\')">' + (get(rk).labelKo || rk) + '</button>';
      }).join(' ') + '</div>' : '')
      + '<div style="margin-top:14px"><button type="button" class="bm-focus-btn" onclick="VAR_VIS.openResearch(\'' + key + '\')">Research 상세 →</button></div>';
    var viz = document.getElementById('varvis-viz');
    if (vt === 'riskPanel') renderRiskPanel(viz, m, spec);
    else if (vt === 'typeCard') renderTypeCard(viz, m, spec);
    else if (vt === 'timeSeriesWithEvents') { renderBandGauge(viz, m, spec, M6, NB); viz.innerHTML += '<div id="varvis-ts" style="margin-top:12px"></div>'; renderTimeSeries(document.getElementById('varvis-ts'), key); }
    else renderBandGauge(viz, m, spec, M6, NB);
    if (spec.visualSubType === 'eventSnapshotLink' || key === 'leadKneeFlexFC') {
      viz.innerHTML += '<div class="note" style="margin-top:10px;line-height:1.5"><b>FC 시점</b> · 착지 순간 스냅샷 값 중심(v1). 전 구간 시계열은 Research 상세에서 보조 확인.</div>';
    }
  }

  function closePanel() {
    var ov = document.getElementById('varvis-overlay');
    if (ov) ov.classList.add('varvis-hidden');
  }

  var BLOCKING_RESEARCH_NAV = {
    apBrakeImpulse: ['ph-blocking', ''], comVelReductionFCBR: ['ph-blocking', ''], vgrfRetain: ['ph-blocking', ''],
    leadVGRFImpulse: ['ph-blocking', ''], kneeCollapse: ['ph-blocking', ''], blockRiskPenalty: ['ed-blocking', ''],
    blockingType: ['ed-blocking', ''], kneeExtROM: ['ph-blocking', ''], leadKneeFlexionBR: ['ph-blocking', ''],
    leadKneeFlexFC: ['ph-drive', ''], apBrake: ['ph-blocking', ''], comDecel: ['ph-blocking', ''],
    comKEdrop: ['ph-blocking', ''], blockConvEff: ['ph-blocking', ''], vgrfPattern: ['ph-blocking', '']
  };

  var WINDUP_RESEARCH_NAV = {
    hipHinge: ['ed-windup', ''], wuPelCloseKH: ['ed-windup', ''], wuTrunkCloseKH: ['ed-windup', ''],
    wuPelCoil: ['ed-windup', ''], wuTrunkCoil: ['ed-windup', ''], wuHSS: ['ed-windup', ''], wuHSSbuild: ['ed-windup', ''],
    wuDriveHipER: ['ed-windup', ''], wuCoilTq: ['ed-windup', ''], wuPelVel: ['ed-windup', ''], wuTrkVel: ['ed-windup', ''],
    windupType: ['ed-windup', ''], earlyArmRisk: ['ed-windup', '']
  };

  var TRUNK_RESEARCH_NAV = {
    xfPeak: ['ed-trunk', ''], xfReleasedPctByFC: ['ed-trunk', ''], leanBack: ['ed-trunk', ''], openAng: ['ed-trunk', ''],
    trunkME: ['ed-trunk', ''], trunkRotKE: ['ed-trunk', ''], trunkFlexKE: ['ed-trunk', ''], trunkLatKE: ['ed-trunk', ''],
    torsoRotV: ['ed-trunk', ''], trunkFlexV: ['ed-trunk', ''], trunkLatV: ['ed-trunk', ''], xfUnwindV: ['ed-trunk', ''],
    armTransferRatio: ['ed-trunk', ''], ppTrunkHum: ['ed-trunkarm', '']
  };

  var ARM_RESEARCH_NAV = {
    armRotV: ['ed-armball', ''], humME: ['ed-armball', ''], armTransferRatio: ['ed-trunk', ''],
    ppTrunkHum: ['ed-trunkarm', ''], ppShoElb: ['ed-armball', ''], chainTiming: ['ed-armball', ''],
    seqPct: ['ed-armball', ''], whipRatio: ['ed-armball', ''], scapLoad: ['ed-armball', ''],
    merPk: ['ed-armball', ''], elbowExtV: ['ed-armball', ''], shGen: ['ed-armball', ''], elbAbs: ['ed-armball', '']
  };

  var DRIVE_RESEARCH_NAV = {
    propImpPct: ['ed-stride', ''], rearProp: ['ed-stride', ''], propPeakTiming: ['ph-drive', ''],
    postureMaint: ['ed-stride', ''], comVDrop: ['ed-stride', ''], comVelFC: ['ph-drive', ''], comVel: ['ph-drive', ''],
    hipAbd: ['ph-drive', ''], driveWork: ['ed-stride', ''], driveKneeFlexKF: ['ed-stride', ''],
    trunkLeanChange: ['ed-stride', ''], strideTime: ['ed-stride', ''], strideLen: ['ed-stride', ''],
    hssBuildKF: ['ph-drive', ''], pelOpenKF: ['ph-drive', ''], trkOpenKF: ['ph-drive', ''], trunkResistRatio: ['ph-drive', ''],
    leadKneeFlexFC: ['ph-drive', ''], leadFootAngleFC: ['ph-drive', ''], hssFC: ['ph-drive', ''],
    strideType: ['ed-stride', '']
  };

  var KNEE_RESEARCH_NAV = {
    kneeTransfer: ['ph-transfer', ''], kneeTrunkLag: ['ph-transfer', ''], ppKneeTrunk: ['ph-transfer', ''],
    kneeExtE: ['ph-transfer', ''], kneeAbs: ['ph-transfer', ''], kneeAbsE: ['ph-transfer', ''],
    kneeContribPct: ['ph-transfer', ''], driveType: ['ph-transfer', ''], linRotRatio: ['ph-transfer', ''],
    rotKEgain: ['ph-transfer', ''], kneeCollapse: ['ph-blocking', ''], kneeExtROM: ['ph-blocking', ''],
    leadKneeFlexFC: ['ph-drive', ''], leadKneeFlexionBR: ['ph-blocking', ''], blockingType: ['ph-blocking', ''],
    leadKneeMoment: ['ph-blocking', ''], leadKneeForce: ['ph-blocking', '']
  };

  function openResearch(key) {
    closePanel();
    if (typeof _bmFocus === 'function') {
      var hit = (typeof _bmFindMetric === 'function') ? _bmFindMetric(key) : null;
      var hasFc = (typeof _FC_SER !== 'undefined' && _FC_SER && _FC_SER[key]);
      if (hit && hasFc) { _bmFocus(key); return; }
    }
    var spec = get(key);
    var nav = BLOCKING_RESEARCH_NAV[key] || DRIVE_RESEARCH_NAV[key] || KNEE_RESEARCH_NAV[key]
      || WINDUP_RESEARCH_NAV[key] || TRUNK_RESEARCH_NAV[key] || ARM_RESEARCH_NAV[key];
    if (!nav && spec && spec.researchTab) nav = [spec.researchTab, ''];
    if (nav && typeof window._goCp === 'function') { window._goCp(nav[0], nav[1]); return; }
    if (nav && typeof setPage === 'function') { setPage(nav[0]); return; }
    if (typeof window._goBlockingResearch === 'function') { window._goBlockingResearch(key); return; }
    if (typeof window._goDriveResearch === 'function') { window._goDriveResearch(key); return; }
    if (typeof window._goLkResearch === 'function') { window._goLkResearch(key); return; }
    if (typeof window._goWindupResearch === 'function') { window._goWindupResearch(key); return; }
    if (typeof window._goTrunkResearch === 'function') { window._goTrunkResearch(key); return; }
    if (typeof window._goArmResearch === 'function') { window._goArmResearch(key); return; }
    if (typeof setPage === 'function') setPage('biomotion');
  }

  function mountOverlay() {
    if (typeof document === 'undefined' || document.getElementById('varvis-overlay')) return;
    var d = document.createElement('div');
    d.id = 'varvis-overlay';
    d.className = 'varvis-hidden';
    d.innerHTML = '<div id="varvis-modal" role="dialog"><div id="varvis-body"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d) closePanel(); });
  }

  return {
    get: get, allKeys: allKeys, REGISTRY: REGISTRY,
    buildMatrixHTML: buildMatrixHTML, setRoleFilter: setRoleFilter, onMatrixCell: onMatrixCell,
    openPanel: openPanel, closePanel: closePanel, openResearch: openResearch, mountOverlay: mountOverlay,
    MATRIX_ROWS: MATRIX_ROWS, MATRIX_COLS: MATRIX_COLS, ROLE_KO: ROLE_KO
  };
});
