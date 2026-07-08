/* [2026-07-07] KU Theia 메카닉 변인 정의·산출방법 SSOT.
   근거: phases.js M(...) 계산식 + 노트(=players.js flagDetail). 각 변인의 ①정의·②산출방법을
   실제 계산(채널·구간·연산)에 정확히 매칭. renderCEFolders(index.html)가 VAR_DOC[key].def/.calc 사용.
   ★hipHinge = Back_Hip_Angle_X의 시작~KH 최대값(최대 굴곡) — 이전 제네릭 폴백을 정정. */
window.CONTENT = window.CONTENT || {};
window.CONTENT.varDoc = {
  /* ── 와인드업(KH 이전 적재·코일) ── */
  "pelClose": { def: "셋업 대비 골반이 던지는 반대쪽으로 최대로 꼬여(닫혀) 들어간 각 = 골반 코일·적재의 크기.", calc: "위에서 본 골반 방향각(Pelvis_Angle_Z) 시계열에서 무릎 최고점(KH) 이전, 셋업 대비 최대 꼬임(excursion). 클수록 깊은 코일." },
  "wuPelCloseKH": { def: "무릎 최고점(KH) 순간 위에서 본 골반의 절대 방향 위치각. '감긴 양(변화량)'과는 구분되는 방향값.", calc: "KH 시점 골반 방향각(Pelvis_Angle_Z) 값(좌표 기준)." },
  "wuPelCoil": { def: "와인드업 동안 골반이 실제로 반대로 감긴 양(변화량).", calc: "골반 방향각(Pelvis_Angle_Z)의 KH 값 − 다리 들기 값 차이." },
  "wuTrunkCloseKH": { def: "무릎 최고점 순간 위에서 본 몸통(흉곽)의 절대 방향 위치각.", calc: "KH 시점 몸통 횡단면 방향각 값." },
  "wuTrunkCoil": { def: "와인드업 동안 몸통이 반대로 감긴 양(변화량).", calc: "몸통 방향각의 KH 값 − 다리 들기 값 차이." },
  "wuHSS": { def: "무릎 최고점 시점의 골반–몸통 분리(X-Factor) 크기. 착지 무렵 peak와는 시점이 다름.", calc: "KH 시점 |X-Factor|(골반–몸통 상대회전 절대값)." },
  "wuHSSbuild": { def: "와인드업 동안 골반–몸통 비틀림(분리)이 늘어난 양.", calc: "X-Factor의 KH 값 − 다리 들기 값 증가분." },
  "wuPelVel": { def: "와인드업(다리 들기~KH) 구간 골반이 도는 최대 각속도. 지나치면 급한 흔들림.", calc: "골반 회전 각속도(Pelvis_Ang_Vel_Z) KH 이전 구간 peak." },
  "wuTrkVel": { def: "와인드업 구간 몸통이 도는 최대 각속도. 지나치면 상체 조기 회전.", calc: "몸통(흉곽) 회전 각속도 KH 이전 구간 peak." },
  "trunkKH_fwd": { def: "무릎 최고점(니하이) 순간 몸통의 앞뒤(시상면) 기울기. +앞으로 / −뒤로.", calc: "KH 시점 Trunk_Angle_X 값." },
  "trunkKH_lat": { def: "무릎 최고점 순간 몸통의 좌우(관상면) 기울기.", calc: "KH 시점 Trunk_Angle_Y 값." },
  /* ── 드라이브(KH→FC) ── */
  "comVel": { def: "다리 들기~릴리스 중 무게중심(COM)이 홈쪽으로 나아간 최대 전진속도 = 앞으로 미는 힘의 결과(드라이브 생성 평가). 클수록 우수.", calc: "COM 전진속도 시계열 peak. 엘리트 밴드 p25 2.575·중앙 2.71·p75 2.802 m/s." },
  "postureMaint": { def: "드라이브 중 낮은 자세와 몸통 전경을 유지하는 정도를 0~100으로 종합한 점수(클수록 잘 유지).", calc: "0.7×백분위(COM 수직 낙하) + 0.3×백분위(몸통 전경 변화)의 가중합(0~100, 단조)." },
  "comVDrop": { def: "무릎 최고점부터 착지까지 무게중심이 내려간 높이 = 낮은 자세 유지량. 적정 범위(과도 시 무너짐).", calc: "COM 수직 위치 KH 값 − FC 값(cm)." },
  "trkOpenKF": { def: "드라이브 중 몸통이 홈쪽으로 회전(열림)한 양. ★클수록 위험 — 조기 열림(flying open)은 몸통→팔 전달 상한을 낮춤.", calc: "몸통 횡단면 회전량 FC 값 − KH 값(조기 열림 감점, dir=−1)." },
  "trunkResistRatio": { def: "골반은 열리고 몸통은 버티는지 보는 비율. >1이면 골반이 먼저 열림(근위 선행·양호).", calc: "KH→FC 골반 열림량 ÷ 몸통 열림량." },
  "strideLen": { def: "앞발 착지 거리를 신장으로 나눈 보폭. 적정 범위 — 짧으면 전진 부족, 길면 착지에서 무너짐.", calc: "앞발 착지 거리 ÷ 신장 × 100(%)." },
  "hssFC": { def: "착지(FC) 시점의 골반–몸통 분리 = 블로킹 직전 회전 preload.", calc: "FC 시점 |X-Factor| 값." },
  "hipHinge": { def: "축발(드라이브 레그) 고관절 시상면 최대 굴곡각 — 동작뷰어 '힙힌지·뒷발 적재' 시계열의 피크. 니하이(KH)~릴리스(BR) 드라이브 구간에서 뒷고관절에 가장 깊게 앉은 지점(적재 정점). 적정 범위형, 좌우 무관(스탠스다리 기준).", calc: "축발 고관절 시상면 각(Back_Hip_Angle_X)의 니하이(무릎 최고점 KH)~릴리스(BR) 구간 최대 굴곡각(동작뷰어 힙힌지 피크와 동일). 엘리트 드라이브구간 밴드 p25 67.0·중앙 69.5·p75 74.2°." },
  "xfPeak": { def: "골반–몸통 최대 상대회전(분리) 크기 = 회전 준비 정도. 크다고 항상 좋은 것이 아니라 언제 만들고 언제 푸는지가 중요.", calc: "골반–몸통 수직축 상대회전(Trunk_wrt_Pelvis_Angle_Z)의 KH→BR 구간 |peak|." },
  "openAng": { def: "착지 시 몸통이 홈쪽으로 열린 각(정면=0). 작을수록 닫힘 유지 — 조기 오픈 시 저장 누수(20°↑ 경고).", calc: "FC 시점 몸통 횡단면 열림각(홈 방향 기준)." },
  "hipHingePkT": { def: "축발 고관절 굴곡이 최대에 이르는 시점을 무릎 최고점(니하이) 기준 상대시간으로 본 값.", calc: "KH~릴리스(BR) 구간 |Back_Hip_Angle_X| 최대 프레임 시각 − KH 시각(ms)." },
  /* ── 블로킹(FC→BR) ── */
  "comVelReductionFCBR": { def: "착지 후 릴리스까지 COM 전진속도가 줄어든 양. 낮으면 앞다리 제동이 부족해 몸이 계속 밀림.", calc: "COM 전진속도 FC 값 − BR 값(m/s)." },
  "comDecel": { def: "COM 전진속도의 순간 감속 최대치(미분·이벤트 민감 → 보조 참고).", calc: "COM 전진속도의 시간미분(감속) peak." },
  "kneeExtROM": { def: "착지~릴리스 앞무릎 각도 변화(+신전 / −굴곡). 블로킹 유형 분류용(점수 직접 반영 아님).", calc: "앞무릎 각도 BR 값 − FC 값." },
  "kneeCollapse": { def: "착지 후 앞무릎이 FC 대비 추가로 굽은 최대량. 제동·감속 부족과 함께면 Collapse/누수 위험.", calc: "FC 대비 앞무릎 굴곡 추가 최대량(FC→BR)." },
  "comKEdrop": { def: "블록이 제거한 COM 선형 운동에너지 = 제동된 전진 에너지('회전 전환'은 별도 변인으로 확인).", calc: "½·m·(v_peak² − v_min²)." },
  "rotKEgain": { def: "착지~피크 사이 골반+몸통 회전 운동에너지의 증가분 = 제동된 선형 에너지가 회전으로 나타난 양(노이즈 커 참고).", calc: "½Iω²(de Leva 관성) 골반+몸통 합의 FC→피크 증가분." },
  "leadKneeVelPk": { def: "착지~릴리스 앞무릎이 펴지는 최대 각속도 = 블로킹→몸통 회전 전달 효율 지표(검증 r≈.55).", calc: "앞무릎 각속도(Lead_Knee_Ang_Vel_X) 신전방향 FC→BR peak." },
  "whipRatio": { def: "몸통 대비 팔의 각속도 증폭(채찍 효과) 배율.", calc: "팔 각속도 peak ÷ 몸통 각속도 peak." },
  "kneeTrunkLag": { def: "앞무릎 신전 정점과 몸통 회전 정점의 시간차. 적정 범위형 — 너무 이르거나 늦으면 이탈.", calc: "앞무릎 신전속도 peak 시각 − 몸통 회전속도 peak 시각(ms)." },
  "ppTrunkHum": { def: "몸통 분절파워 정점에서 상완 분절파워 정점까지의 시간차 = 몸통→팔 전달 타이밍(적정 윈도우 59~86ms).", calc: "상완 분절파워 peak 시각 − 몸통 분절파워 peak 시각(ms)." },
  "leadKneeFlexFC": { def: "착지 시 앞무릎 굽힘각 = 블로킹 준비자세. 적정 범위 — 너무 펴지면 흡수 부족, 너무 굽으면 무너짐.", calc: "FC 시점 앞무릎 굴곡각." },
  /* ── 몸통 회전(FC→BR) ── */
  "pelvisRotV": { def: "착지~릴리스 골반 회전 최대 각속도 = 근위(중심부) 회전 동력.", calc: "골반 회전 각속도(Pelvis_Ang_Vel_Z) FC→BR peak." },
  "torsoRotV": { def: "흉곽(가슴) 회전 최대 각속도.", calc: "흉곽 회전 각속도(Thorax_Ang_Vel_Z) FC→BR peak." },
  "trunkFlexV": { def: "상체가 앞으로 숙여지는(전방 굴곡) 최대 각속도.", calc: "몸통 전방 굴곡 각속도 peak." },
  "trunkME": { def: "몸통 분절의 역학에너지(mechanical energy) 최댓값(클수록 좋음).", calc: "몸통 분절 역학에너지(운동+회전) 시계열 peak." },
  "trunkME_kg": { def: "몸통 역학에너지를 체중으로 나눈 체격보정 효율(절대 J는 체격과 r≈0.86이라 병기).", calc: "몸통 ME peak ÷ 체중(kg)." },
  "trunkLatV": { def: "몸통 측굴(옆으로 기울임) 최대 각속도 — 팔 높이·릴리스에 기여(구속 r≈.51, 클수록 좋음).", calc: "몸통 측굴 각속도 peak." },
  "leanBack": { def: "착지 시 몸통 후방 기울임(직립=0, 뒤로 +). +가 정상, 음수면 FC에서 앞으로 굽음 경고.", calc: "FC 시점 몸통 시상면 후방 기울기각." },
  "xfReleasedPctByFC": { def: "최대 분리 대비 착지(FC) 시점에 이미 풀린 분리의 비율 = flying open 정량 지표(최대 분리가 FC 이전일 때만 산정, 이후면 0=분리 유지).", calc: "(X-Factor_peak − X-Factor@FC) ÷ X-Factor_peak × 100(최대 분리가 FC 이전인 경우)." },
  "xfUnwindV": { def: "peak 분리 이후 릴리스까지 분리가 줄어드는 최대 각속도 = 상체가 골반을 따라잡는(풀림) 속도. 적절히 빨라야 탄성 전달.", calc: "peak 분리~BR 구간 X-Factor 감소 각속도 peak." },
  /* ── 팔(코킹·가속) ── */
  "merPk": { def: "코킹기 어깨 최대 외회전각. 적정 범위형 — 과도·부족 모두 몸통 전달과 함께 해석.", calc: "투구 어깨 외회전각 시계열의 코킹기 peak." },
  "scapLoad": { def: "견갑골 로딩 프록시 = 착지 시 어깨 수평외전 크기(range·context, 단독 우열 아님).", calc: "FC 시점 어깨 수평외전 |각|." },
  "xfPeakFromFC": { def: "최대 분리 시점을 착지(FC) 기준으로 본 상대시간. 양수=FC 직후 유지, 음수=착지 전 풀림.", calc: "X-Factor 최대 시각 − FC 시각(ms)." },
  "armRotV": { def: "투구 어깨의 내회전 최대 각속도 = 팔 채찍의 대표 'arm speed'. ★상완 분절(Humerus) 각속도와는 다른, 어깨 관절 기준 채널.", calc: "어깨 관절 각속도(Pitching_Shoulder_Ang_Vel_Z)의 착지(FC)~릴리스(BR) 구간 |peak|." },
  "elbowExtV": { def: "전완(팔꿈치 신전) 최대 각속도. 높다고 무조건 우수가 아님 — 몸통 전달 부족 시 팔꿈치 의존 가능.", calc: "전완 각속도(Pitching_Forearm_Ang_Vel) peak." },
  "humME": { def: "투구 상완 분절의 역학에너지 최댓값(클수록 좋음).", calc: "상완 분절 역학에너지 시계열 peak." },
  "humME_kg": { def: "상완 역학에너지를 체중으로 나눈 체격보정 효율(상완은 체중과 r≈0.48, 절반은 속도신호).", calc: "상완 ME peak ÷ 체중(kg)." },
  "efDeltaHumME": { def: "최대 외회전(MER)부터 릴리스(BR)까지 윗팔(상완) 역학에너지 변화량 = 코킹 최대점 이후 팔로 실리는 에너지 전달. 클수록 좋음(단조). 점수 반영(low-confidence — 마커리스 에너지 신호라 보조 가중).", calc: "Humerus_ME[MER] − Humerus_ME[BR](엘리트 n=28 밴드 대비 백분위·방향성)." }
};
