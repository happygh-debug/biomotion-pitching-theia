// @SYSTEM=THEIA · dashboard_core SSOT — uplift/core 와 독립. 무단 cp 금지(check_system_isolation.py 배포가드). 시스템별 의도적 변경만.
// pitch_norms.js — 규준·백분위 단일 출처(SSOT). [2026-05-26 통합]
// 대시보드 스코프와 리포트 창 양쪽에 로드되어, 카드·선수용·분석·팀 리포트가 모두 이 한 모듈을 참조한다.
// → 규준 값/백분위 산식이 여러 곳에 중복되어 따로 드리프트하던 문제(카드 vs 리포트 불일치)를 근본 차단.
(function (root) {
  // ★[2026-10-11 발행] 힘판 스왑 이력 2명 grf_ok 복구(교수 10-11 · 연구원 답 #30 · 확정판 TXT 순서 정상 확인) → GRF 파생 22개 키 n 30→32(elite140_norm_candidate.json 재산출 · publish_elite140_norm.py --apply · patch_live_inline_norms.py --apply).
  //   전수 before/after: 비GRF 키 이동 0 · 점수화 45변인 × 106명 중 밴드(하/중/상) 바뀐 칸 33(0.7%) · 민감도(한 명 제외 시 med 차) 최대 −8.6%(leadHipTransfer). 수동 발행 전용 원칙 그대로.
  // ★[2026-09-16 발행] 발행일 2026-09-16 · 코호트 = elite_cohort.json v1.0(A안·교수 확정 2026-09-04)
  //   표본 n=32(GRF 파생 키는 힘판 스왑 2명 제외 n=30) · 대상 키 94개(점수화 45) · 미매칭 0.
  //   산출 gen_elite140_norm_candidate.py → 발행 publish_elite140_norm.py --apply(전수 before/after 의무).
  //   전수 before/after 결과: 94키 전부 이동 · 중앙 이동 최대 +50%(wuHSSbuild 0.6→0.9) ·
  //   밴드(하/중/상)가 바뀐 칸 220 / (106명 × 45변인) = 4.6%. 라이브 랜딩 배포는 2026-09-16(e14149db).
  //   ★수동 발행 전용 — 런타임 자동 갱신은 켜지 않는다(점수 폭등 회귀 이력).
  //   [이력 2026-08-27] 직전 발행은 n=28(프로 11 + 140↑ 19 − 힘판 스왑 2). 측정 구속<실전 감안해 컷 145→140(교수).
  // ★[2026-09-23 교수 승인 · 오류 수정] grfDelay 는 「체중이동 시간 일관성」 = 양발 수직 GRF peak 간격의 투구 간 표준편차(phases.js · 대시보드 설명)인데
  //   밴드만 평균 간격(253~326 ms · n=40 출처 확인 불가)이라 업로드 세션 판정이 전부 한쪽으로 쏠렸다 → 엔진 정의(표준편차)에 맞춰
  //   대시보드 NORM_BANDS 와 같은 표준편차 밴드(n=20)로 교체. 인라인 사본(랜딩·업로드 등 5파일)도 같게.
  // ★구세대 유지 38키 — 갱신 대상이 아니다(2026-09-16 전수 확인·사유별):
  //   · 33키: players.js에 키 자체가 없다(업로드 랜딩 엔진 전용 변인 — 글러브팔·와인드업·비대칭·KH 자세 계열).
  //   ·  4키: phaseData에 키는 있으나 엘리트 32명 전원 val=null(베이크 엔진 미산출) — backHipMoment·kneeAbs·leadHipMoment·leadKneeMoment.
  //   ·  1키: apBrake — 산출은 되나 deprecated(Blocking 점수 제외·산출값↔규준 스케일 불일치). 쓰지 않는 값에 최신 라벨을 붙이지 않는다.
  //   ⇒ 세대 혼재 해소는 원자료 재구동이 필요하다: 33키=엘리트 원자료를 랜딩 엔진에 재투입 · 4키=베이크 엔진 수정 후 재베이크.
  //     ★둘 다 250Hz 재측정과 세트다(혼재 해소는 재측정 전에는 불가).
  // ── 엘리트 규준(우수투수 n=20 풀드, 2026-05-26). [2026-05-30] 규준=엘리트20 단독(모든 변인). Driveline OBP는 엘리트 코호트 검증용으로만 사용(규준에 미포함). 보존키: apBrake(부호규약)·에너지전달gated(n=19). ──
  var N = {abdSym:{p25:-3.5,med:4.8,p75:14.5,n:20}, apBrake:{p25:-1.1,med:0.8,p75:5.05,n:28}, armRotV:{p25:3898.85,med:4128.15,p75:4292.225,n:32}, armSlot:{p25:74.1,med:81.6,p75:89.7,n:20}, backHipMoment:{p25:176.4,med:284.5,p75:332.6,n:20}, backHipWork:{p25:43.775,med:84.55,p75:107.425,n:32}, backKneeFlex:{p25:47.8,med:51,p75:56.5,n:20}, chainTiming:{p25:41.1,med:60.7,p75:79.475,n:32}, comDecel:{p25:15.42,med:17.39,p75:19.88,n:32}, comKEdrop:{p25:204.225,med:236.9,p75:282.4,n:32}, comVel:{p25:2.5575,med:2.71,p75:2.785,n:32}, comVDrop:{p25:35.975,med:37.7,p75:40.6,n:32}, rotKEgain:{p25:17.45,med:40.75,p75:50.65,n:32}, linRotRatio:{p25:8.45,med:16.9,p75:24.25,n:32}, trunkLatV:{p25:296.7,med:316.85,p75:358.6,n:32}, counterAP:{p25:276.5,med:288.3,p75:301.9,n:20}, driveWork:{p25:63.575,med:113.7,p75:151.025,n:32}, elbAbs:{p25:30.75,med:40.65,p75:57.025,n:32}, elbowExtV:{p25:1862.375,med:1977.55,p75:2144.25,n:32}, elbowFlexAsym:{p25:9.7,med:17.4,p75:26.2,n:20}, elbowForce:{p25:1025.65,med:1076,p75:1188.85,n:32}, elbowMoment:{p25:122.125,med:135.65,p75:155.025,n:32}, elbowP:{p25:1097.8,med:1598.4,p75:2633.5,n:20}, freeMo:{p25:5.6,med:9.45,p75:16.2,n:32}, gAbd:{p25:72.4,med:77.7,p75:87.5,n:20}, gElbFlex:{p25:63.9,med:73.6,p75:81.2,n:20}, gHandH:{p25:-248.6,med:-198.4,p75:-168.9,n:20}, gloveHumME:{p25:61.3,med:65,p75:69.8,n:20}, glovePullV:{p25:1807.1,med:2362.3,p75:2981.1,n:20}, gloveShPow:{p25:481.3,med:525.2,p75:642.2,n:20}, grfDelay:{p25:13.8,med:22.75,p75:42.23,n:20}, hipAbd:{p25:197.775,med:242.65,p75:308.175,n:32}, hipHinge:{p25:64.65,med:69.75,p75:74.475,n:32}, humME:{p25:150.275,med:160.55,p75:176.2,n:32}, humMEt:{p25:147.9,med:155.7,p75:172.4,n:19}, kneeAbs:{p25:158.8,med:174.3,p75:223,n:20}, kneeAbsE:{p25:17.075,med:29.2,p75:36.225,n:32}, kneeCollapse:{p25:2.025,med:4.5,p75:7.675,n:32}, kneeContribPct:{p25:27.75,med:34.65,p75:45.15,n:32}, kneeExtE:{p25:10.4,med:16.3,p75:20.625,n:32}, kneeExtROM:{p25:4.875,med:12.2,p75:21.925,n:32}, kneeFlexSym:{p25:1.5,med:9.9,p75:11.6,n:20}, kneeTrunkLag:{p25:53.8,med:69.65,p75:90.875,n:32}, kneeTransfer:{p25:52.4,med:62,p75:71.475,n:32}, leadGrf:{p25:186.75,med:206.85,p75:221.5,n:32}, leadHipMoment:{p25:290.2,med:320.9,p75:393.4,n:20}, leadHipWork:{p25:10.25,med:19.1,p75:29.2,n:32}, leadKneeFlex:{p25:54.7,med:59.4,p75:63.3,n:20}, leadKneeForce:{p25:1627.75,med:1879.65,p75:2013.4,n:32}, leadKneeMoment:{p25:175.7,med:194.1,p75:249.9,n:20}, leanBack:{p25:1.025,med:5.65,p75:8.7,n:32}, merPk:{p25:176.15,med:183,p75:187,n:32}, openAng:{p25:5.35,med:9.05,p75:14.825,n:32}, pelClose:{p25:28.5,med:35.95,p75:47.775,n:32}, pelObliq:{p25:-0.3,med:2.5,p75:3.5,n:20}, pelvisRotV:{p25:579.725,med:630.65,p75:672.85,n:32}, propImpPct:{p25:22.9525,med:24.655,p75:25.8225,n:32}, rearProp:{p25:67.75,med:81.5,p75:89.925,n:32}, relTimingMs:{p25:133.2,med:157.3,p75:174,n:20}, scapLoad:{p25:55.325,med:62.7,p75:69.475,n:32}, seqPct:{p25:70,med:100,p75:100,n:32}, seqSpan:{p25:80,med:144.1,p75:170.2,n:20}, shAbdAsym:{p25:-2,med:3.5,p75:8.5,n:20}, shGen:{p25:6.175,med:11.65,p75:22.375,n:32}, shTilt:{p25:0.2,med:4,p75:5.9,n:20}, shoulderForce:{p25:1128.65,med:1194.7,p75:1299.125,n:32}, shoulderMoment:{p25:178.825,med:198.4,p75:223.4,n:32}, strideLen:{p25:88.925,med:90.45,p75:92.75,n:32}, torsoRotV:{p25:804.775,med:872.7,p75:938.025,n:32}, trunkFlexV:{p25:289.25,med:349.25,p75:390,n:32}, trunkLat:{p25:-7,med:-4.7,p75:-0.3,n:20}, trunkME:{p25:464.15,med:497,p75:538.55,n:32}, trunkRotKE:{p25:50.875,med:58.8,p75:69.8,n:32}, trunkFlexKE:{p25:22.825,med:28.7,p75:36.8,n:32}, trunkLatKE:{p25:24.725,med:29.25,p75:35,n:32}, vgrfRetain:{p25:59,med:80.05,p75:93.675,n:32}, ppKneeTrunk:{p25:-53.625,med:-46.9,p75:-34.95,n:32}, ppTrunkHum:{p25:56.625,med:66.55,p75:79,n:32}, ppShoElb:{p25:-33.675,med:-18,p75:24.5,n:32}, armTransferRatio:{p25:95.95,med:99.15,p75:99.925,n:32}, blockConvEff:{p25:29,med:47,p75:73,n:32}, whipRatio:{p25:3.065,med:3.65,p75:3.855,n:32}, xfPeak:{p25:21,med:25.2,p75:31.6,n:32}, xfReleasedPctByFC:{p25:0,med:1.1325,p75:4.3468,n:32}, xfUnwindV:{p25:286.0952,med:311.2375,p75:373.6875,n:32}, wuDur:{p25:0.4,med:0.45,p75:0.51,n:20}, wuPct:{p25:35.29,med:37.69,p75:42.3,n:20}, wuHcm:{p25:118.4,med:123.86,p75:127.2,n:20}, wuHpct:{p25:65.35,med:68.57,p75:70.38,n:20}, wuKneeAP:{p25:-4.12,med:-1.13,p75:3.95,n:20}, wuKneeML:{p25:35.59,med:41.31,p75:43.73,n:20}, wuPelCloseKH:{p25:121.375,med:126.1,p75:130.875,n:32}, wuPelCoil:{p25:15.15,med:20.65,p75:28.8,n:32}, wuTrunkCloseKH:{p25:117.9,med:123.95,p75:130.075,n:32}, wuTrunkCoil:{p25:14.625,med:18.65,p75:27.55,n:32}, wuHSS:{p25:1.5,med:2.75,p75:4.525,n:32}, wuHSSbuild:{p25:-0.625,med:0.9,p75:2.55,n:32}, wuDriveHipER:{p25:6.5,med:7.8,p75:10.025,n:32}, wuCoilTq:{p25:0.0295,med:0.0715,p75:0.115,n:32}, wuPelVel:{p25:87.7,med:102.45,p75:145.6,n:32}, wuTrkVel:{p25:65.8,med:86.7,p75:119,n:32}, wuShER:{p25:30.325,med:38.7,p75:43.825,n:32}, trunkLeanChange:{p25:-5.85,med:-2.25,p75:2.625,n:32}, postureMaint:{p25:32.175,med:46,p75:68.625,n:32}, strideTime:{p25:0.66,med:0.735,p75:0.8,n:32}, propPeakTiming:{p25:79.675,med:80.9,p75:87,n:32}, comVelFC:{p25:2.48,med:2.65,p75:2.77,n:32}, driveKneeFlexKF:{p25:16.125,med:23.3,p75:33.725,n:32}, pelOpenKF:{p25:49.75,med:60.65,p75:71.6,n:32}, trkOpenKF:{p25:24.025,med:31.25,p75:47.775,n:32}, hssFC:{p25:18,med:23.4,p75:27.25,n:32}, hssBuildKF:{p25:13.525,med:20,p75:23.95,n:32}, trunkResistRatio:{p25:1.55,med:1.77,p75:2.2425,n:32}, leadKneeFlexFC:{p25:47.8,med:52.65,p75:55.175,n:32}, leadFootAngleFC:{p25:-8,med:-4.6,p75:-1.25,n:32}, handPostKH:{p25:-0.35,med:1.5,p75:2.58,n:20}, elbowPostKH:{p25:7.22,med:9.57,p75:11.19,n:20}, horizAbdKH:{p25:63.36,med:72.68,p75:79.56,n:20}, trunkKH_fwd:{p25:-10.6,med:-8.12,p75:-4.07,n:20}, trunkKH_lat:{p25:-6.3,med:-2.25,p75:-0.01,n:20}};   // [2026-07-07] 니하이 몸통 앞뒤(Trunk_Angle_X[KH])·좌우(Trunk_Angle_Y[KH]) 기울기 — 엘리트 n=20 산출(gen_trunkKH_bands.js). 자세·범위형. 좌우는 손잡이 정합 좌표라 원시 풀링(부호정규화 불필요·L/R 부호 겹침 검증완).   // [2026-06-03 KH 팔 조기장전] 던지는 손·팔꿈치 뒤쪽 위치(%키)·어깨 수평외전@KH — 엘리트 n=20   // [2026-06-03 스트라이드 재구성] strideLen 엘리트 n=20 통일(89.74/90.9/93.61, 구 n=166·82.8/86 폐기) + FC 전환·회전준비 신규 변인 n=20   // [v2] wuPelCloseKH=횡단면 절대각·wuPelCoil=PI→KH변화·wuCoilTq=N·m/kg 방향정규화 · postureMaint=엘리트 n=20 실측 재산출(36.3/46.9/64.0)   // [2026-06-03] 와인드업 선운동+회전 저장 신규 변인 + 스트라이드 자세유지(Posture Maintenance) — 엘리트 n=20 산출
  // [2026-06-03 Blocking B5] apBrake peak는 현 산식과 기존 규준 스케일 불일치로 score 제외(deprecated).
  // 신규 score 규준은 B2 재산출 Elite20 선수별 valid_for_score 평균 기반.
  N.apBrake.deprecated = true;
  N.apBrake.deprecated_reason = 'Blocking score 제외: 현재 apBrake 산출값과 기존 규준 스케일 불일치';
  N.apBrakeImpulse = {p25:11.1475,med:12.325,p75:13.5,n:32};
  N.comVelReductionFCBR = {p25:1.2175,med:1.325,p75:1.5325,n:32};
  N.leadVGRFImpulse = {p25:19.3975,med:20.545,p75:22.545,n:32};
  // [C5 2026-06-03] 제구 Release Consistency — Elite20 mech-only, 낮을수록 좋음(dir=-1)
  N.relTimingCvPct = { p25: 3.68, med: 4.2, p75: 7.78, n: 20 };
  N.armSlotSdDeg = { p25: 1.27, med: 1.8, p75: 2.6, n: 20 };
  N.releaseSdMm = { p25: 60, med: 64.2, p75: 79.2, n: 20 };
  N.strideLenCV = { p25: 0.98, med: 1.4, p75: 2.1, n: 20 };
  // [2026-06-10] 앞무릎 신전속도 peak — Elite20 Theia(Normative_data, phases 동일 엔진·best-trial) 산출. neutral(위치·우열 아님) 밴드용.
  N.leadKneeVelPk = {p25:323.2887,med:373.935,p75:562.035,n:32};
  N.trunkME_kg = {p25:5.52,med:5.87,p75:6.0825,n:32};  // [2026-06-21] 체중정규화 에너지효율 (J/kg) — 엘리트28
  N.humME_kg = {p25:1.7375,med:1.91,p75:2.0375,n:32};
  // [2026-07-02] 직접전달(force power F·v ∫dt) 6종 — 적정범위 점수화(교수 coach-blind 승인). 엘리트28(elite_pool_v90 max≥140).
  //   출처: transfer6_elite28_2026-06-23(method=linear-interp, matches published elite28). 검증: 대시보드 elite subset med 0~5.2% 근접.
  N.shForceTransfer = {p25:231.95,med:245.1,p75:276.225,n:32};
  N.elForceTransfer = {p25:390.125,med:413.5,p75:472.475,n:32};
  N.backHipTransfer = {p25:78.075,med:139.2,p75:152,n:32};
  N.backKneeTransfer = {p25:14.875,med:39.7,p75:59.575,n:32};
  N.leadHipTransfer = {p25:9.025,med:17.5,p75:29.95,n:32};
  N.leadKneeTransfer = {p25:25.05,med:34.15,p75:40.925,n:32};
  // [2026-08-12 수동 발행] 앞고관절 흡수(leadHipAbsorb = −∫min(0,Lead_Hip_Force_Power_X)·FC−120ms→BR) — neutral 밴드 전용(채점 아님).
  //   산출: 참조규준 5코호트 원신호 velo 상위 28명(137.6~146.8km/h) 서브셋·trial median (leadhip_variants_pilot.js·기존 직접전달 elite28 철학 정합).
  //   근거: 마커리스 89명 구속 r=+.43(leadhip_흡수재정의_파일럿결과.md). 파이프라인 교차검증: 동일 서브셋 v1(양수전달) 8.8/14.4/27.8 ≈ 기존 발행 10.45/20.05/30.55.
  N.leadHipAbsorb = { p25: 98.7, med: 114.5, p75: 134.4, n: 28 };
  // dir: +1 클수록 / -1 작을수록 / 'abs' 절대값. 좋은쪽/나쁜쪽 끝점.
  function ends(dir, p25, p75) { if (dir === -1) return { good: p25, bad: p75 }; if (dir === 'abs') return Math.abs(p75) >= Math.abs(p25) ? { good: p75, bad: p25 } : { good: p25, bad: p75 }; return { good: p75, bad: p25 }; }
  // 표준정규 CDF (Abramowitz-Stegun). z=0 → 0.5, 단조·연속 (검증완료).
  function cdf(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  // 밴드 통계 {e,g,status,z} — 리포트 게이지/밴드 SVG와 동일.
  function stat(v, nm, dir) { var e = ends(dir, nm.p25, nm.p75); var g = (v - e.bad) / ((e.good - e.bad) || 1); var st = g >= 1 ? 'strong' : (g <= 0 ? 'flag' : 'normal'); var sig = Math.abs(nm.p75 - nm.p25) / 1.349 || 1; var rz = (v - nm.med) / sig; var gh = e.good > e.bad; return { e: e, g: g, status: st, z: rz * (gh ? 1 : -1) }; }
  // 공통 적격성: normNA·결측·키/방향/규준 없음 제외. (neutral 제외 정책은 호출부가 각자 적용)
  function _nm(m) { return (m && !m.normNA && m.value != null && m.key && m.dir && N[m.key]) ? N[m.key] : null; }
  function pctl(m) { var nm = _nm(m); if (!nm) return null; return Math.round(Math.max(1, Math.min(99, cdf(stat(m.value, nm, m.dir).z) * 100))); }
  function statusM(m) { var nm = _nm(m); if (!nm) return null; return stat(m.value, nm, m.dir).status; }
  function zM(m) { var nm = _nm(m); if (!nm) return null; return stat(m.value, nm, m.dir).z; }
  var API = { NORMS: N, ends: ends, cdf: cdf, stat: stat, pctl: pctl, status: statusM, z: zM };
  root.PITCH_NORMS = N;
  root.PITCH_STATS = API;
  if (typeof module === 'object' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
