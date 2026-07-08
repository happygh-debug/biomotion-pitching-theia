/* variable_copy_registry.js — audience copy SSOT (계산 로직 변경 없음)
 * Audiences: player · coach · analyst · research(audit)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VAR_COPY = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var FIELDS = [
    'playerSentence', 'coachSummary', 'coachCue', 'coachObservation',
    'analystDefinition', 'analystCalculation', 'analystInterpretation',
    'evaluationPolicy', 'caution', 'researchNote'
  ];

  /** 코치·피드백 surface에 노출되는 핵심 변인 */
  var COACH_FACING_KEYS = [
    'apBrakeImpulse', 'comVelReductionFCBR', 'vgrfRetain', 'kneeCollapse',
    'propImpPct', 'postureMaint', 'strideLen', 'rearProp', 'hssBuildKF',
    'hipHinge', 'wuHSSbuild', 'wuPelCoil', 'wuTrunkCoil', 'wuDriveHipER', 'wuCoilTq', 'wuPelCloseKH',
    'trunkME', 'xfReleasedPctByFC', 'leanBack', 'openAng', 'armTransferRatio',
    'armRotV', 'humME', 'seqPct', 'ppTrunkHum', 'ppShoElb',
    'releaseSdMm', 'relTimingCvPct', 'armSlotSdDeg', 'strideLenCV',
    'kneeTransfer', 'kneeTrunkLag', 'kneeExtROM', 'leadKneeFlexFC',
    'earlyArmRisk', 'driveKneeFlexKF', 'leadFootAngleFC', 'strideTime',
    'trunkLeanChange', 'trunkResistRatio', 'blockRiskPenalty', 'shGen', 'elbAbs', 'merPk'
  ];

  var LOAD_INJURY_KEYS = [
    'shGen', 'elbAbs', 'scapLoad', 'merPk', 'earlyArmRisk', 'backHipMoment',
    'leadKneeMoment', 'elbowMoment', 'shoulderMoment', 'blockRiskPenalty', 'kneeCollapse'
  ];

  var OVERRIDES = {
    apBrakeImpulse: {
      playerSentence: '착지 후 몸이 앞으로 계속 밀리는 경향이 있어요.',
      coachSummary: '착지 후 전진이 충분히 멈추지 않을 수 있음 — 회전 준비 시간 부족 맥락',
      coachObservation: '앞발 제동이 약하면 몸통 회전으로 넘어가기 전에 계속 앞으로 나갈 수 있음',
      coachCue: '착지 후 앞발 위에서 몸을 받치고 회전할 시간을 만든다는 느낌 확인',
      analystDefinition: 'FC→BR 구간에서 앞발이 전진 방향 운동량을 제동하는 정도를 나타내는 지표입니다.',
      analystCalculation: 'FC~BR 구간 FP2_Y(전방 제동력) 적분 ÷ 체중 → %BW·s',
      analystInterpretation: '값이 낮으면 전진 속도가 충분히 줄지 않아, 선형 에너지가 회전 에너지로 전환되는 과정이 제한될 수 있습니다.',
      evaluationPolicy: '엘리트 코호트 대비 높을수록 제동·전환 양호(3밴드)',
      caution: '단일 구·착지 조건에 따라 달라질 수 있음 — 여러 구 반복 확인 권장',
      researchNote: 'signal=FP2_Y · window=FC→BR · scalar=impulse/%BW·s · phases blocking MAP'
    },
    comVelReductionFCBR: {
      playerSentence: '착지 후에도 몸이 앞으로 나가는 느낌이 남을 수 있어요.',
      coachSummary: '착지 후 전진 속도 감소가 작을 수 있음',
      coachObservation: '선형 에너지가 회전으로 바뀔 시간이 줄어들 수 있음',
      coachCue: '착지 후 몸이 더 멈추는 느낌·앞발 지지 확인',
      analystDefinition: 'FC→BR 구간 COM 전진 속도 감소량(또는 감소 비율).',
      analystCalculation: 'COM_Velocity_Y 피크 대비 BR 시점 감소 · phases blocking',
      analystInterpretation: '감소가 작으면 블로킹·전환에서 회전 에너지 전환이 제한될 수 있음.',
      evaluationPolicy: '엘리트 대비 감소량·비율 3밴드(높을수록 우수)',
      caution: '보폭·구속에 따라 기대값이 달라질 수 있음',
      researchNote: 'COM_Velocity_Y · FC~BR delta'
    },
    vgrfRetain: {
      playerSentence: '착지 후 앞발이 땅을 잘 받쳐주는지 확인이 필요해요.',
      coachSummary: '착지 후 앞발 지지력 유지 패턴 점검',
      coachObservation: '지지가 빨리 줄면 몸통 회전 타이밍이 흔들릴 수 있음',
      coachCue: '착지 후 앞발이 바닥에서 미끄러지지 않게 지지 유지',
      analystDefinition: 'FC 이후 앞발 수직 GRF 유지·피크 패턴.',
      analystCalculation: 'FP2_Z FC~BR retain 비율 · phases',
      analystInterpretation: '조기 이탈·불안정은 전환·릴리스 타이밍 변동과 연결될 수 있음.',
      evaluationPolicy: '패턴·피크 유지 3밴드',
      caution: 'GRF 신뢰도·캘리브레이션 확인',
      researchNote: 'FP2_Z retain pattern'
    },
    xfPeak: {
      playerSentence: '골반과 몸통이 얼마나 분리되어 회전 준비가 되었는지를 봅니다. 분리가 크다고 항상 좋은 것은 아니며, 언제 만들어지고 언제 풀리는지가 중요합니다.',
      coachSummary: '골반-몸통 분절 간 수직축 상대회전 — 참고 지표',
      coachObservation: '골반과 몸통이 얼마나 분리되어 회전 준비가 되었는지를 봅니다. 분리가 크다고 항상 좋은 것은 아니며, 언제 만들어지고 언제 풀리는지가 중요합니다.',
      coachCue: '분리를 만들되 착지 전에 너무 일찍 풀리지 않게',
      analystDefinition: '현재 X-factor는 Theia/Visual3D Trunk_wrt_Pelvis_Angle_Z 기반의 골반 기준 몸통 분절 Z축 상대회전각입니다.',
      analystCalculation: 'trial.x_factor 시계열 KH→BR max|·| (orient 적용) · phases xfPeak · 코치=|magnitude| · 분석원=signed+abs',
      analystInterpretation: '글로벌 수평면 shoulder yaw − pelvis yaw 방식은 스리쿼터·사이드암·언더암 투수에서 투영 오류가 커질 수 있으므로 기본 SSOT로 사용하지 않습니다.',
      evaluationPolicy: '엘리트 3밴드(참고) · flying open·풀림 속도가 주 평가',
      caution: '문헌 50±12°(글로벌 투영)과 직접 비교 금지',
      researchNote: 'SSOT=trial.x_factor · xfactor_research.js 병렬 globalYaw 감사용'
    },
    xfReleasedPctByFC: {
      playerSentence: '착지할 때 골반·몸통 분리가 너무 일찍 풀리지 않았는지 봐요.',
      coachSummary: '착지(FC)까지 분리가 얼마나 풀렸는지(%)',
      coachObservation: '높으면 flying open(조기 풀림) — 저장 에너지 누수 가능',
      coachCue: '최대 분리를 착지까지 유지하는 타이밍 확인',
      analystDefinition: 'peak X-factor 대비 FC 시점에 이미 풀린 분리 비율(%)',
      analystCalculation: 'trial.x_factor 기반 · peak이 FC 이전일 때만 (peakMag−|xf@FC|)/peakMag',
      analystInterpretation: 'magnitude 기반. signed 혼용 없음.',
      evaluationPolicy: '엘리트 대비 낮을수록 우수(≤10% 정상)',
      caution: 'FC 검출·peak 구간(KH~BR)에 민감',
      researchNote: 'flying open 주지표'
    },
    xfUnwindV: {
      playerSentence: '저장된 분리가 풀리며 몸통이 회전으로 이어지는 속도를 봐요.',
      coachSummary: '분리 풀림(uncoil) 최대 각속도',
      coachObservation: '적절한 풀림 속도 = 저장 에너지의 상체 전달',
      coachCue: '분리 유지 후 자연스럽게 풀리며 회전',
      analystDefinition: 'peak 이후 BR까지 |X-factor| 감소 최대 각속도(°/s)',
      analystCalculation: 'trial.x_factor · peak+1→BR max d|xf|/dt',
      analystInterpretation: 'magnitude 기반. signed 미사용.',
      evaluationPolicy: '엘리트 3밴드(높을수록 우수)',
      caution: 'peak 프레임·노이즈에 민감',
      researchNote: 'uncoil velocity proxy'
    },
    xfPeakFromFC: {
      playerSentence: '최대 분리가 착지 전·후 언제인지 타이밍 참고.',
      coachSummary: '최대 분리 시점 − FC (ms, 보조)',
      coachObservation: '음수=착지 전 peak · 양수=착지 후 유지',
      coachCue: '착지 직후까지 분리 유지 감각',
      analystDefinition: 'X-factor peak 프레임 − FC 프레임 (ms)',
      analystCalculation: 'trial.x_factor peak index · phases xfPeakFromFC',
      analystInterpretation: '타이밍 지표. xfReleasedPctByFC가 주지표.',
      evaluationPolicy: '보조 맥락만',
      caution: 'FC 검출 정확도 의존',
      researchNote: 'timing aux'
    },
    xfAtFC: {
      playerSentence: '착지 순간 골반·몸통이 얼마나 분리되어 있는지 봐요.',
      coachSummary: 'FC 시점 분리 크기(|X-factor|)',
      coachObservation: 'peak 대비 유지 정도와 함께 해석',
      coachCue: '착지할 때 분리 유지',
      analystDefinition: 'FC 시점 |trial.x_factor|',
      analystCalculation: 'phases xfAtFC = |x_factor[i_fc]|',
      analystInterpretation: 'magnitude only.',
      evaluationPolicy: 'xfReleasedPctByFC와 함께',
      caution: '—',
      researchNote: 'HSS@FC'
    },
    armTransferRatio: {
      playerSentence: '몸통에서 팔로 힘이 잘 이어지지 않을 수 있어요.',
      coachSummary: '몸통→팔 전달 비율이 낮을 수 있음',
      coachObservation: '팔이 몸통 대신 일하는 보상 패턴 가능',
      coachCue: '몸통 회전 후 팔이 따라오게',
      analystDefinition: '몸통 에너지 대비 팔(상완) 전달 비율.',
      analystCalculation: 'Humerus ME / Trunk ME @ 전달 구간',
      analystInterpretation: '비율이 낮으면 팔 부하·타이밍 변동 가능.',
      evaluationPolicy: '엘리트 대비 높을수록 전달 양호',
      caution: 'delivery 유형·구속에 따라 기대 범위 다름',
      researchNote: 'ME ratio trunk→arm'
    },
    ppTrunkHum: {
      playerSentence: '몸통과 팔 타이밍이 구마다 달라질 수 있어요.',
      coachSummary: '몸통→팔 peak 간격 변동 가능',
      coachObservation: '조기 팔 개입 또는 늦은 전달 모두 연결 품질에 영향 가능',
      coachCue: '몸통이 먼저·팔은 한 박 늦게',
      analystDefinition: '몸통 ME 피크와 상완 ME 피크 간 시간차.',
      analystCalculation: 'peak timing diff trunk→humerus · FC~BR',
      analystInterpretation: 'lag이 짧으면 조기 팔·길면 에너지 손실 가능.',
      evaluationPolicy: '엘리트 lag 3밴드',
      caution: '1구 시퀀스 오류만으로 단정 금지',
      researchNote: 'timingLollipop · ppTrunkHum'
    },
    earlyArmRisk: {
      playerSentence: '와인드업에서 팔이 몸보다 먼저 움직일 수 있어요.',
      coachSummary: 'KH 전후 팔 조기 준비 신호',
      coachObservation: '몸통 회전과 팔 준비 순서 불일치 가능',
      coachCue: '몸통·하체 먼저·팔은 늦게',
      analystDefinition: 'KH 전후 팔·몸통 준비 순서 위험 점수.',
      analystCalculation: 'phases.earlyArm risk/warn/normal',
      analystInterpretation: '조기 장전은 릴리스 타이밍·암슬롯 변동과 연결될 수 있음.',
      evaluationPolicy: 'risk/warn/normal · 점수 아님',
      caution: '유형·의도적 패턴과 구분',
      researchNote: 'earlyArmRisk panel · windup'
    },
    relTimingCvPct: {
      playerSentence: '공을 놓는 리듬이 구마다 달라질 수 있어요.',
      coachSummary: '릴리스 타이밍 반복성 변동',
      coachObservation: '리듬 변동은 방향·암슬롯 변동과 함께 볼 수 있음',
      coachCue: '동일한 리듬·릴리스 감각 반복',
      analystDefinition: 'FC→BR 릴리스 구간 시간 변동(CV%).',
      analystCalculation: 'trial relTimingMs → session CV%',
      analystInterpretation: 'CV 높으면 제구·암슬롯 변동 가능성.',
      evaluationPolicy: '낮을수록 반복성 우수',
      caution: 'trial 수 적으면 CV 참고만',
      researchNote: 'consistency.js merge key'
    },
    strideLenCV: {
      playerSentence: '보폭이 구마다 달라질 수 있어요.',
      coachSummary: '보폭 반복성 변동',
      coachObservation: '보폭 변동은 착지·타이밍 변동과 연결될 수 있음',
      coachCue: '전략에 맞는 보폭·리듬 유지',
      analystDefinition: '세션 내 보폭 변동 CV%.',
      analystCalculation: 'trial strideLen → CV%',
      analystInterpretation: 'CV 높으면 착지·리듬 불안정 맥락.',
      evaluationPolicy: '낮을수록 반복성 우수',
      caution: '의도적 변화와 구분',
      researchNote: 'strideLen trial CV'
    },
    trunkLeanChange: {
      playerSentence: '밀어내는 동안 상체 자세가 흔들릴 수 있어요.',
      coachSummary: '드라이브 중 몸통 전경 변화',
      coachObservation: '뒤로 젖히면 자세 유지·힘 전달이 약해질 수 있음',
      coachCue: '드라이브 중 상체 전경 유지·주저앉지 않기',
      analystDefinition: 'KH→FC 몸통 전경각(Trunk_X) 변화.',
      analystCalculation: 'Trunk_X[KH] − Trunk_X[FC]',
      analystInterpretation: '양수 크면 뒤로 젖힘·postureMaint 약화 가능.',
      evaluationPolicy: '적정 범위·참고 변인',
      caution: 'strideType·전략에 따라 기대값 다름',
      researchNote: 'Trunk_Angle_X KH→FC'
    },
    trunkResistRatio: {
      playerSentence: '하체가 먼저 열리고 상체가 버티는지 확인이 필요해요.',
      coachSummary: '골반 대비 몸통 열림 비율',
      coachObservation: '몸통이 먼저 열리면 조기 열림 맥락 가능',
      coachCue: '하체 먼저·상체는 버티기',
      analystDefinition: 'FC 시점 골반 열림 ÷ 몸통 열림.',
      analystCalculation: 'pelOpenKF / trkOpenKF @ FC',
      analystInterpretation: '<1이면 flying open·조기 열림 맥락.',
      evaluationPolicy: '>1 경향 양호 · 엘리트 중앙값 참고',
      caution: '이벤트 검출 노이즈 영향',
      researchNote: 'pelOpenKF trkOpenKF ratio'
    },
    driveKneeFlexKF: {
      playerSentence: '밀어낼 때 뒷무릎이 어떻게 움직이는지 같이 봐요.',
      coachSummary: 'KH→FC 뒷무릎 굴곡 변화',
      coachObservation: '힙힌지 vs 주저앉음 구분 필요',
      coachCue: '엉덩이 뒤로·무릎은 힙힌지 느낌',
      analystDefinition: 'KH→FC 뒷무릎 굴곡 변화량.',
      analystCalculation: 'Back_Knee_Angle_X[FC] − [KH]',
      analystInterpretation: '+ 크면 더 굽음 · hip hinge vs collapse.',
      evaluationPolicy: '적정 범위(optimal) · 참고',
      caution: 'strideType·신장에 따라 다름',
      researchNote: 'Back_Knee_Angle_X delta'
    },
    shGen: {
      playerSentence: '팔이 몸통보다 많이 일할 수 있어요.',
      coachSummary: '어깨 생성 파워가 높을 수 있음 — 부하 맥락',
      coachObservation: '몸통 전달 대비 팔 생성이 크면 부담 신호 가능',
      coachCue: '몸통 회전 후 팔이 따라오게 · 어깨만 쓰지 않기',
      analystDefinition: '어깨 관절 파워 생성(상완 가속 구간).',
      analystCalculation: 'Pitching_Shoulder_Power_X peak/integral',
      analystInterpretation: '높은 생성+낮은 전달비는 팔 의존 패턴 가능.',
      evaluationPolicy: '엘리트 3밴드 · 부하 맥락 병행',
      caution: '부상 단정 금지 — 패턴·추세로 해석',
      researchNote: 'load flag with armTransferRatio'
    },
    elbAbs: {
      playerSentence: '팔꿈치에 부담이 클 수 있어요 — 무리한 신전 주의.',
      coachSummary: '팔꿈치 흡수 파워·부하 신호',
      coachObservation: '높은 흡수는 타이밍·암슬롯과 함께 볼 것',
      coachCue: '몸통에서 힘 받은 뒤 팔꿈치로 전달',
      analystDefinition: '팔꿈치 흡수(제동) 파워 피크.',
      analystCalculation: 'Pitching_Elbow_Power_X absorb phase',
      analystInterpretation: '과도한 흡수는 팔 의존·타이밍 문제 맥뽁 가능.',
      evaluationPolicy: '적정 범위·높음 주의(부하)',
      caution: 'UCL·부상 단정 금지 — 코치·의료 판단 병행',
      researchNote: 'injury load context'
    },
    rearProp: {
      playerSentence: '밀어낼 때 뒷발이 지면을 잘 밀어주는지 같이 봐요.',
      coachSummary: '뒷발 추진 peak — 전진 에너지 생성',
      coachObservation: '낮으면 드라이브 추진이 약해질 수 있음',
      coachCue: '축발 지면을 세게 밀며 몸을 앞으로 보내기',
      analystDefinition: 'KH→FC 구간 뒷발(FP1) 전방 추진력 peak.',
      analystCalculation: 'FP1_Y peak ÷ 체중 → %BW',
      analystInterpretation: '추진 peak·임펄스(propImpPct)와 함께 드라이브 생성 평가.',
      evaluationPolicy: '엘리트 대비 높을수록 추진 양호(3밴드)',
      caution: '보폭·템포 전략과 함께 해석',
      researchNote: 'FP1_Y peak · ed-stride'
    },
    wuPelCoil: {
      playerSentence: '다리 들 때 골반이 반대로 감기는지 같이 봐요.',
      coachSummary: '골반 코일 — PI→KH 감김 변화',
      coachObservation: '부족하면 와인드업 저장·회전 준비가 약해질 수 있음',
      coachCue: '리듬을 유지하며 골반·몸통 닫힘 준비',
      analystDefinition: '다리 들기~무릎 최고점 골반 반대 감김 변화량.',
      analystCalculation: '|Pelvis_Angle_Z[KL] − Pelvis_Angle_Z[PI]|',
      analystInterpretation: '적정 coil은 windup preload·xfPeak와 연결.',
      evaluationPolicy: '엘리트 3밴드 · higher_is_better',
      caution: 'wuPelCloseKH(각도)와 혼동 금지',
      researchNote: 'wuPelCoil · ed-windup'
    },
    wuHSSbuild: {
      playerSentence: '와인드업에서 하체·상체가 더 갈라지는지 같이 봐요.',
      coachSummary: '골반-몸통 분리 쌓임 — PI→KH',
      coachObservation: '부족하면 회전 preload·코일 준비가 약해질 수 있음',
      coachCue: '리듬 유지하며 하체·상체 분리 쌓기',
      analystDefinition: 'PI→KH 구간 골반-어깨 분리(HSS) 증가량.',
      analystCalculation: 'HSS[KL_peak] − HSS[PI]',
      analystInterpretation: '적정 범위 내 증가는 코일·저장 준비 맥락.',
      evaluationPolicy: '적정 범위(optimal) · 엘리트 분포 참고',
      caution: '유형·신장에 따라 기대값 다름',
      researchNote: 'wuHSSbuild · windup coil'
    },
    wuTrunkCoil: {
      playerSentence: '와인드업에서 몸통이 반대로 감기는지 같이 봐요.',
      coachSummary: '몸통 코일 — PI→KH 감김 변화',
      coachObservation: '코일 부족 시 회전 에너지 저장이 줄 수 있음',
      coachCue: '골반 닫힘과 함께 몸통 감김 유지',
      analystDefinition: '다리 들기~무릎 최고점 몸통 반대 감김 변화.',
      analystCalculation: 'Trunk coil delta PI→KL_peak',
      analystInterpretation: '적정 coil은 windup preload·xfPeak와 연결.',
      evaluationPolicy: '적정 범위 · 엘리트 참고',
      caution: '골반 코일(wuPelCoil)과 함께 봄',
      researchNote: 'wuTrunkCoil · ed-windup'
    },
    wuDriveHipER: {
      playerSentence: '무릎 최고점에서 뒷다리가 바깥으로 도는지 같이 봐요.',
      coachSummary: '축발 고관절 회전 준비 — KH',
      coachObservation: '과도·부족 모두 드라이브·저장 맥락에서 전략 신호',
      coachCue: '전략에 맞는 적정 범위·감각 확인',
      analystDefinition: '무릎 최고점 축발(뒷) 고관절 바깥 돌림.',
      analystCalculation: '|Back_Hip_Angle_Z[KL_peak]|',
      analystInterpretation: '적정 ER은 하체 저장·드라이브 준비 맥락.',
      evaluationPolicy: '적정 범위(range) · 엘리트 참고',
      caution: '신장·유형에 따라 기대값 다름',
      researchNote: 'wuDriveHipER · ed-windup'
    },
    wuCoilTq: {
      playerSentence: '와인드업에서 몸을 감아두는 힘이 있는지 같이 봐요.',
      coachSummary: '와인드업 꼬임 준비 — 뒷발 지면',
      coachObservation: '부족하면 저장 에너지 준비가 약해질 수 있음',
      coachCue: '뒷발 외곽으로 지면을 눌러 꼬임 유지',
      analystDefinition: 'PI→KH 축발 지면 꼬임 토크 peak(체중 대비).',
      analystCalculation: 'FP1_Z peak PI→KH ÷ weight_kg',
      analystInterpretation: '적정 꼬임은 와인드업 저장·코일 맥락.',
      evaluationPolicy: '엘리트 3밴드 · higher_is_better',
      caution: '선수·코치 문구에 단위 강조 금지',
      researchNote: 'wuCoilTq · ed-windup'
    },
    wuPelCloseKH: {
      playerSentence: '무릎 최고점에서 골반이 적절히 닫혀 있는지 같이 봐요.',
      coachSummary: 'KH 시점 골반 닫힘각(위에서 본 방향)',
      coachObservation: '감긴 양(coil)과 구분 — 닫힘 각도 맥락',
      coachCue: '무릎 올릴 때 골반이 닫힌 느낌 유지',
      analystDefinition: '무릎 최고점(KH) 골반 방향 각.',
      analystCalculation: 'Pelvis orientation @ KL_peak',
      analystInterpretation: '엘리트 범위 대비 닫힘 정도·코일 전략 참고.',
      evaluationPolicy: '적정 범위 · 유형별 참고',
      caution: 'wuPelCoil(변화량)과 혼동 금지',
      researchNote: 'wuPelCloseKH · windup'
    },
    openAng: {
      playerSentence: '착지할 때 몸통이 너무 일찍 열릴 수 있어요.',
      coachSummary: 'FC 시점 몸통 열림 각 — 조기 오픈 맥락',
      coachObservation: '20° 이상이면 flying open·저장 누수 가능',
      coachCue: '착지까지 몸통 닫힘 유지·하체 먼저 열기',
      analystDefinition: 'FC 시점 몸통 횡단 회전(열림) 각.',
      analystCalculation: 'Trunk open angle @ FC · phases',
      analystInterpretation: '과도 열림은 xfReleasedPctByFC·저장 손실과 연결.',
      evaluationPolicy: '적정 범위·경고 임계(20°) · risk_flag',
      caution: '유형·의도적 패턴과 구분',
      researchNote: 'openAng · trunk risk'
    },
    armRotV: {
      playerSentence: '팔이 충분히 빠르게 돌아가는지 같이 봐요.',
      coachSummary: '어깨 내회전 각속도 peak',
      coachObservation: '몸통 전달 대비 팔 회전이 약하면 구속·제구에 영향 가능',
      coachCue: '몸통에서 받은 힘으로 팔 회전 방출',
      analystDefinition: 'MER~BR 구간 어깨 내회전 각속도 peak.',
      analystCalculation: 'Shoulder internal rotation ω peak',
      analystInterpretation: 'humME·armTransferRatio와 함께 방출 품질 평가.',
      evaluationPolicy: '엘리트 대비 높을수록 방출 양호',
      caution: '구속만으로 단정 금지',
      researchNote: 'armRotV · ed-armball'
    },
    seqPct: {
      playerSentence: '하체→몸통→팔 순서가 구마다 달라질 수 있어요.',
      coachSummary: '키네매틱 시퀀스 순서 반복성',
      coachObservation: '순서 변동은 타이밍·제구 변동과 연결될 수 있음',
      coachCue: '하체→몸통→팔 리듬을 매 구 같게',
      analystDefinition: '분절 peak 순서 정확도(%).',
      analystCalculation: 'chain timing order score · phases',
      analystInterpretation: '연구·맥락 변인 — MAP score 미반영.',
      evaluationPolicy: '코호트 위치 참고 · 우열 단정 없음',
      caution: 'delivery 유형에 따라 기대 순서 다름',
      researchNote: 'seqPct · research_only'
    },
    ppShoElb: {
      playerSentence: '어깨와 팔꿈치 힘이 이어지는 순서를 같이 봐요.',
      coachSummary: '어깨→팔꿈치 파워 peak 시간차',
      coachObservation: '코호트에선 팔꿈치가 먼저인 경우도 흔함 — 우열 아님',
      coachCue: '어깨 힘 뒤 팔꿈치가 자연스럽게 이어지게',
      analystDefinition: '어깨 관절파워 peak → 팔꿈치 peak 간격(ms).',
      analystCalculation: 't_peak(shoulder) − t_peak(elbow)',
      analystInterpretation: '팔 내부 전달 순서 맥락 — 단독 감점 없음.',
      evaluationPolicy: '코호트 분포 참고 · neutral',
      caution: '1구만으로 단정 금지',
      researchNote: 'ppShoElb · arm chain'
    },
    releaseSdMm: {
      playerSentence: '공을 놓는 위치가 구마다 달라질 수 있어요.',
      coachSummary: '릴리스 3D 위치 표준편차',
      coachObservation: '변동 크면 제구·방향 변동 가능',
      coachCue: '매 구 같은 릴리스 위치·감각 유지',
      analystDefinition: '세션 내 릴리스 포인트 3D SD(mm).',
      analystCalculation: 'trial release xyz → session SD',
      analystInterpretation: 'armSlotSdDeg·relTimingCvPct와 consistency 묶음.',
      evaluationPolicy: '낮을수록 반복성 우수',
      caution: 'trial 수 적으면 SD 참고만',
      researchNote: 'releaseSdMm · consistency'
    },
    trunkLat: {
      playerSentence: '착지할 때 상체가 옆으로 기울었는지는 연구·분석용으로만 봐요.',
      coachSummary: '코치 기본 화면 미노출 — 측굴 속도(trunkLatV)가 점수 변인',
      coachObservation: 'signed 기울기는 glove/arm side 해석 복잡 · LHP mirror 보류',
      coachCue: '— (research/analyst)',
      analystDefinition: 'FC neck−pelvis lateral tilt signed (global ML-AP).',
      analystCalculation: 'atan2(neck−pelvis ML, AP) @ FC',
      analystInterpretation: 'trunkLatV(측굴 속도 magnitude)와 역할 분리.',
      evaluationPolicy: 'research_only · coach=side label만(필요 시)',
      caution: 'signed norm 적용 전 문서화 필요',
      researchNote: 'trunkLat · research_only+magnitude+side_label'
    },
    armSlotSdDeg: {
      playerSentence: '팔이 나오는 높이가 구마다 얼마나 흔들리는지 같이 봐요.',
      coachSummary: '암슬롯 반복성 — 구마다 팔 높이 흔들림(SD)',
      coachObservation: '평균 슬롯 높이(armSlot)와 별도 · 제구·방향 안정성 맥락',
      coachCue: '팔이 나오는 높이 감각을 일정하게',
      analystDefinition: 'FC 시점 Pitching_Shoulder_Angle_Y의 trial 간 SD(°).',
      analystCalculation: 'trial armSlot @ FC → SD',
      analystInterpretation: '동일 투수 내 반복성 — SH/UH도 SD 지표 유지.',
      evaluationPolicy: '낮을수록 반복성 우수',
      caution: 'armSlot(평균 높이)과 혼동 금지',
      researchNote: 'armSlotSdDeg · consistency · approve_as_is'
    },
    kneeTransfer: {
      playerSentence: '앞다리에서 몸통으로 힘이 잘 이어지는지 같이 봐요.',
      coachSummary: 'VGRF×골반 각가속 overlap(전달 겹침률)',
      coachObservation: '연결 약하면 전환·릴리스 타이밍 변동 가능',
      coachCue: '앞다리 지지 후 몸통이 이어지는 순서',
      analystDefinition: '앞무릎 지지와 골반 각가속 겹침 비율(%).',
      analystCalculation: 'K5-A SSOT overlap · phases',
      analystInterpretation: 'score 미반영 · etdiag·legacy와 정의 상이 주의.',
      evaluationPolicy: '엘리트 대비 높을수록 연결 양호 · 참고',
      caution: 'blockingType·kneeTrunkLag와 함께',
      researchNote: 'kneeTransfer SSOT · ph-transfer'
    },
    leadFootAngleFC: {
      playerSentence: '착지할 때 앞발이 어느 쪽으로 열렸는지 같이 봐요.',
      coachSummary: 'FC 앞발 방향 — 글러브측 열림/투구측 닫힘/정면 + 벗어난 각도',
      coachObservation: 'signed 숫자 대신 방향 설명 · 과도 개폐 시 제동 전환 방향 흔들림 가능',
      coachCue: '착지 발방향이 자신의 전략·리듬에 맞게(정면·글러브측·투구측)',
      analystDefinition: 'FC 시점 stride_angle_deg raw signed + handedness-adjusted 방향 라벨.',
      analystCalculation: 'grf_metrics.stride_angle_deg (CoP rear→lead atan2)',
      analystInterpretation: 'transition 지표 · signed norm band 보류(research) · strideLen·leadKneeFlexFC와 묶음.',
      evaluationPolicy: '코치=방향 라벨+magnitude · analyst=signed+라벨',
      caution: 'R/L signed 분포 상이 — mirror 전 스칼라 변경 금지',
      researchNote: 'leadFootAngleFC · magnitude_only+direction_label · ph-drive'
    },
    armSlot: {
      playerSentence: '착지할 때 팔이 나오는 높이가 자신의 스타일과 맞는지 같이 봐요.',
      coachSummary: 'FC 시점 투구팔 슬롯 높이(자세 참고)',
      coachObservation: '평균 높이와 구간별 흔들림(armSlotSdDeg)은 다른 지표',
      coachCue: '착지 시 팔이 나오는 높이가 자신의 슬롯 느낌과 맞는지',
      analystDefinition: 'Pitching_Shoulder_Angle_Y @ FC (throwing arm elevation).',
      analystCalculation: 'valAt(Pitching_Shoulder_Angle_Y, FC)',
      analystInterpretation: 'OH 코호트 규준 · SH/UH는 normNA.',
      evaluationPolicy: '자세 참고 · 일관성은 armSlotSdDeg',
      caution: 'armSlotSdDeg와 혼동 금지',
      researchNote: 'armSlot · approve_as_is+nonOH_normNA'
    },
    strideTime: {
      playerSentence: '밀어내는 시간이 자신의 리듬과 맞는지 같이 봐요.',
      coachSummary: 'KH→FC 드라이브 소요시간(s)',
      coachObservation: '빠른 템포형은 짧아도 전략상 정상일 수 있음',
      coachCue: '자신의 템포에 맞는 드라이브 리듬 유지',
      analystDefinition: '무릎 최고점→착지 구간 경과 시간.',
      analystCalculation: 't(FC) − t(KL_peak)',
      analystInterpretation: 'strideType·propImpPct와 전략 묶음 평가.',
      evaluationPolicy: '적정 범위(optimal) · 유형별',
      caution: '구속만으로 단정 금지',
      researchNote: 'strideTime · ed-stride'
    },
    blockRiskPenalty: {
      playerSentence: '착지 후 무릎 지지와 제동이 함께 약할 수 있어요.',
      coachSummary: '무릎 붕괴+제동 부족 조합 시 조건부 감점',
      coachObservation: '일반 MAP 평균이 아니라 risk 조합 시만 반영',
      coachCue: '앞무릎 지지·제동이 함께 들어가는지 확인',
      analystDefinition: 'kneeCollapse p75 초과 + (apBrake 또는 comDecel p25 미만) 시 10~15점 penalty.',
      analystCalculation: 'conditional penalty · mech6 blocking',
      analystInterpretation: 'Collapse/Leakage risk 조합 — 단독 변인 아님.',
      evaluationPolicy: 'risk_flag · 조건부 감점',
      caution: '부상·단정 금지 — 패턴 확인용',
      researchNote: 'blockRiskPenalty · ed-blocking'
    },
    merPk: {
      playerSentence: '코킹 때 어깨 외회전 범위가 적절한지 같이 봐요.',
      coachSummary: 'MER(최대 외회전) — 적정 범위형',
      coachObservation: '과도·부족 모두 몸통 전달·부하 맥락과 함께',
      coachCue: '과도한 외회전 없이 적정 코킹 범위',
      analystDefinition: '코킹 구간 어깨 최대 외회전 각(°).',
      analystCalculation: 'Shoulder ER peak MER~BR',
      analystInterpretation: 'arm MAP score 제외 · scapLoad·전달비와 병행.',
      evaluationPolicy: '적정 범위 · 과도·부족 모두 주의',
      caution: '부상 단정 금지 — 유형·유연성 맥락',
      researchNote: 'merPk · load context'
    }
  };

  function stripTech(s) {
    if (!s) return '';
    return String(s)
      .replace(/\b[A-Z][a-zA-Z0-9_]{2,}\b/g, '')
      .replace(/\bp25\b|\bp75\b|p25~p75|impulse|ratio\b|∫|°\/s|%BW|CV\b|SD\b|FP\d|COM_|ME\b|KH→|FC→|BR\b/gi, '')
      .replace(/\s+/g, ' ').trim();
  }

  function hedge(s) {
    if (!s) return '';
    var t = stripTech(s);
    t = t.replace(/낮으면/g, '낮을 때');
    t = t.replace(/높으면/g, '높을 때');
    t = t.replace(/줄 수 있음/g, '줄어들 수 있는 경향');
    t = t.replace(/할 수 있음/g, '할 수 있는 경향');
    t = t.replace(/입니다\.?$/, '일 수 있어요.');
    t = t.replace(/한다\.?$/, '할 수 있어요.');
    if (t.indexOf('경향') < 0 && t.indexOf('가능') < 0 && t.indexOf('확인') < 0 && t.indexOf('수 있') < 0) {
      t += ' — 확인 필요';
    }
    return t;
  }

  function evalPolicy(spec, m) {
    if (spec && spec.evaluationPolicy) return spec.evaluationPolicy;
    if (spec && spec.evaluation) return spec.evaluation;
    if (m && m.dir === 'range') return '적정 범위(부족/정상/높음) · 엘리트 분포 참고';
    if (spec && spec.displayPolicy === 'type_context') return '전략 유형 · 결함/양호 판정 없음';
    if (spec && spec.bandType === 'lower_is_better') return '엘리트 대비 낮을수록 우수(3밴드)';
    if (spec && spec.bandType === 'higher_is_better') return '엘리트 대비 높을수록 우수(3밴드)';
    return '엘리트 코호트 3밴드(미흡/정상/우수) · 방향 자동 반영';
  }

  function legacyMap(ov) {
    if (!ov) return {};
    var m = Object.assign({}, ov);
    if (!m.playerSentence && m.coachShortText) m.playerSentence = m.coachShortText;
    if (!m.coachSummary && m.coachExplanation) m.coachSummary = m.coachExplanation;
    if (!m.coachCue && m.correctionCue) m.coachCue = m.correctionCue;
    if (!m.researchNote && m.technicalNote) m.researchNote = m.technicalNote;
    if (!m.researchNote && m.formulaNote) m.researchNote = m.formulaNote;
    return m;
  }

  function defaultCue(spec, key) {
    var cm = (spec && spec.coachMeaning) || '';
    var label = (spec && spec.labelKo) || key || '';
    if (/일관|반복|SD|CV/.test(label + cm)) return '매 구 같은 리듬·감각 유지';
    if (/타이밍|시퀀스|순서/.test(label + cm)) return '순서·리듬이 자연스럽게 이어지게';
    if (/위험|penalty|risk/i.test(key + cm)) return '패턴 확인·지지·제동 점검';
    if (spec && (spec.bandType === 'range' || spec.displayPolicy === 'range_context' || spec.displayPolicy === 'type_context')) {
      return '전략에 맞는 적정 범위·감각 확인';
    }
    var topic = stripTech(cm || label);
    return topic ? topic + ' 관련 현장 감각 점검' : '현장에서 동작 감각 확인';
  }

  function derive(spec, m, key) {
    if (!spec) spec = {};
    var cm = spec.coachMeaning || '';
    var cw = spec.coachWarning || '';
    var phNote = (m && m.note) ? String(m.note) : '';
    var placeholder = !!spec.placeholder || cm.indexOf('placeholder') >= 0;
    var coachFacing = COACH_FACING_KEYS.indexOf(key) >= 0;
    var cue = spec.coachCue || spec.correctionCue || '';
    if (!cue) cue = defaultCue(spec, key);
    var sentenceSrc = cw || (placeholder && coachFacing ? (spec.labelKo || '') : cm.split(/[.·]/)[0]);
    return {
      playerSentence: (placeholder && !coachFacing) ? '' : hedge(sentenceSrc),
      coachSummary: stripTech(cm) || spec.easyExplanation || (coachFacing ? stripTech(spec.labelKo || '') : ''),
      coachObservation: cw ? hedge(cw) : ((placeholder && !coachFacing) ? '' : hedge(cm)),
      coachCue: cue,
      analystDefinition: spec.analystDefinition || spec.definition || spec.labelKo || key,
      analystCalculation: spec.analystCalculation || spec.calculation || spec.formulaNote || phNote || 'phases.js 단계 metrics 산출',
      analystInterpretation: spec.analystInterpretation || spec.interpretation || cw || stripTech(cm) || '—',
      evaluationPolicy: evalPolicy(spec, m),
      caution: spec.caution || (cw ? hedge(cw) : '단일 구·측정 조건에 따라 해석이 달라질 수 있음'),
      researchNote: spec.researchNote || spec.formulaNote || spec.technicalNote || phNote || ('key=' + key)
    };
  }

  function resolve(key, spec, metric) {
    var ov = legacyMap(OVERRIDES[key] || {});
    var base = derive(spec, metric, key);
    var out = {};
    FIELDS.forEach(function (f) {
      out[f] = (ov[f] != null && ov[f] !== '') ? ov[f] : base[f];
    });
    out.key = key;
    out.audience = { player: !!out.playerSentence, coach: !!(out.coachSummary || out.coachCue), analyst: !!out.analystDefinition };
    return out;
  }

  function resolveForKey(key, metric) {
    var spec = null;
    try {
      if (typeof VAR_VIS !== 'undefined' && VAR_VIS.get) {
        spec = VAR_VIS.REGISTRY && VAR_VIS.REGISTRY[key] ? VAR_VIS.REGISTRY[key] : null;
      }
    } catch (e) { }
    return resolve(key, spec, metric);
  }

  /** Feedback View · 코치 카드 — playerSentence + coachCue */
  function feedbackLine(key, spec, metric, card) {
    var c = resolve(key, spec, metric);
    var parts = [];
    if (c.playerSentence) parts.push(c.playerSentence);
    else if (card && card.warning) parts.push(hedge(card.warning));
    else if (card && card.coachMeaning) parts.push(hedge(card.coachMeaning));
    if (c.coachCue) parts.push('→ ' + c.coachCue);
    return parts.join(' · ');
  }

  /** 단계별 priority — coachSummary + coachCue (값은 별도) */
  function coachPriorityLine(key, spec, metric, card) {
    var c = resolve(key, spec, metric);
    var parts = [];
    if (c.coachSummary) parts.push(c.coachSummary);
    else if (c.playerSentence) parts.push(c.playerSentence);
    if (c.coachCue) parts.push('→ ' + c.coachCue);
    return parts.join(' · ') || feedbackLine(key, spec, metric, card);
  }

  function isCoachFacing(key) {
    return COACH_FACING_KEYS.indexOf(key) >= 0;
  }

  function isLoadInjuryKey(key) {
    return LOAD_INJURY_KEYS.indexOf(key) >= 0;
  }

  return {
    FIELDS: FIELDS,
    OVERRIDES: OVERRIDES,
    COACH_FACING_KEYS: COACH_FACING_KEYS,
    LOAD_INJURY_KEYS: LOAD_INJURY_KEYS,
    resolve: resolve,
    resolveForKey: resolveForKey,
    feedbackLine: feedbackLine,
    coachPriorityLine: coachPriorityLine,
    coachSurfaceLine: feedbackLine,
    isCoachFacing: isCoachFacing,
    isLoadInjuryKey: isLoadInjuryKey,
    hedge: hedge,
    stripTech: stripTech
  };
});
