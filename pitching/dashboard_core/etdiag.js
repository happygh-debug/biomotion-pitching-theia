// @SYSTEM=THEIA · dashboard_core SSOT — uplift/core 와 독립. 무단 cp 금지(check_system_isolation.py 배포가드). 시스템별 의도적 변경만.
// etdiag.js — 에너지 전달 진단 엔진 (개발요청서 v5)
// 입력: reportData.assemble 가 만든 DATA (trials/series/events/phases/player).
// 출력: 9단계 에너지 흐름 진단(타이밍 gap·handoff overlap·무릎유형·Arm Self-Reliance/Overload·단계점수·Top3 병목).
// 각 지표에 flow 태그(store=저장 / gen=생성 / transfer=전달 / load=부하) 부여.
// 데이터 제약: 골반 분절에너지·전완/손 에너지·손목파워 없음 → completeness/confidence 로 명시.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.etDiag = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TAG = { store: '저장', gen: '생성', transfer: '전달', load: '부하', ctx: '맥락' };
  // 리드 무릎 유형 한글 (각도규약: Lead_Knee_Angle_X 클수록 굴곡 → 각 감소=신전/각 증가=굴곡무너짐)
  var KNEE_KO = { collapse: '무너짐형', bracing: '버팀형', extension: '강한 신전형', hybrid: '버팀→신전 하이브리드형', ext_collapse: '초기 신전 후 후기 무너짐형' };

  // ── 시계열 헬퍼 ──
  function peak(arr, lo, hi, mode) { // mode: 'abs'|'max'|'min'
    if (!arr || !arr.length) return { v: null, i: null };
    lo = Math.max(0, lo | 0); hi = Math.min(arr.length - 1, hi == null ? arr.length - 1 : hi | 0);
    var bi = null, bv = (mode === 'min') ? Infinity : -Infinity;
    for (var i = lo; i <= hi; i++) {
      var x = arr[i]; if (x == null || !isFinite(x)) continue;
      var c = (mode === 'abs') ? Math.abs(x) : x;
      if (mode === 'min') { if (c < bv) { bv = c; bi = i; } }
      else { if (c > bv) { bv = c; bi = i; } }
    }
    return { v: bi == null ? null : (mode === 'abs' ? Math.abs(arr[bi]) : arr[bi]), i: bi };
  }
  function deriv(arr, dt) { if (!arr) return null; var o = new Array(arr.length); for (var i = 0; i < arr.length; i++) { o[i] = (i === 0 || !isFinite(arr[i]) || !isFinite(arr[i - 1])) ? NaN : (arr[i] - arr[i - 1]) / dt; } return o; }
  function integ(arr, lo, hi, dt, sign) { // sign: +1 양의 부분 / -1 음의 부분 / 0 전부
    if (!arr) return null; lo = Math.max(0, lo | 0); hi = Math.min(arr.length - 1, hi | 0); var s = 0, n = 0;
    for (var i = lo; i <= hi; i++) { var x = arr[i]; if (x == null || !isFinite(x)) continue; if (sign > 0 && x < 0) x = 0; if (sign < 0 && x > 0) x = 0; s += x * dt; n++; }
    return n ? s : null;
  }
  function r1(x) { return (x == null || !isFinite(x)) ? null : Math.round(x * 10) / 10; }
  function r2(x) { return (x == null || !isFinite(x)) ? null : Math.round(x * 100) / 100; }
  function sd(a) { a = (a || []).filter(function (x) { return x != null && isFinite(x); }); if (a.length < 2) return null; var m = a.reduce(function (p, c) { return p + c; }, 0) / a.length; return Math.sqrt(a.reduce(function (p, c) { return p + (c - m) * (c - m); }, 0) / a.length); }
  function mean(a) { a = (a || []).filter(function (x) { return x != null && isFinite(x); }); return a.length ? a.reduce(function (p, c) { return p + c; }, 0) / a.length : null; }
  function movavg(a, w) { if (!a) return a; var o = new Array(a.length); for (var i = 0; i < a.length; i++) { var s = 0, c = 0; for (var k = -w; k <= w; k++) { var j = i + k; if (j >= 0 && j < a.length && isFinite(a[j])) { s += a[j]; c++; } } o[i] = c ? s / c : NaN; } return o; }

  // ── 한 trial 에서 원시 지표 산출 ──
  function rawTrial(t, mass) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br, iMER = e.i_mer;
    if (iFC == null || iBR == null) return null;
    var g = 9.81, BW = mass * g;
    function relMs(i) { return (i == null) ? null : Math.round((i - iFC) * dt * 1000); }
    var R = { dt: dt, iKH: iKH, iFC: iFC, iBR: iBR, iMER: iMER };

    // X-factor 타이밍 (모듈 7)
    var xf = (t.x_factor || []).map(function (v) { return v == null ? NaN : Math.abs(v); });
    var xpk = peak(xf, iKH, iBR, 'max'); R.xfPeak = r1(xpk.v); R.tXfPeak = relMs(xpk.i);
    R.xfAtFC = (xf[iFC] != null && isFinite(xf[iFC])) ? r1(xf[iFC]) : null;
    R.xfReleasedByFC = (xpk.v && xpk.i != null && xpk.i <= iFC) ? Math.max(0, r1((xpk.v - (xf[iFC] || 0)) / xpk.v * 100)) : 0;
    var dxf = deriv(xf, dt); // °/s
    // release start: peak 이후 |dX/dt|>50 이 ~20ms 지속되는 첫 시점
    var relStart = null, need = Math.max(1, Math.round(0.02 / dt));
    if (xpk.i != null) { for (var i = xpk.i; i <= iBR - need; i++) { var ok = true; for (var k = 0; k < need; k++) { if (!(Math.abs(dxf[i + k]) > 50)) { ok = false; break; } } if (ok) { relStart = i; break; } } }
    R.tXfReleaseStart = relMs(relStart);
    var uv = peak(dxf.map(function (v) { return Math.abs(v); }), (xpk.i == null ? iFC : xpk.i), iBR, 'max');
    R.xfReleasePeakVel = r1(uv.v); R.tXfReleasePeakVel = relMs(uv.i);
    // 몸통 열림/회전속도 at FC (flying open 보조)
    R.thoraxVelAtFC = (S.Thorax_Ang_Vel_Z && isFinite(S.Thorax_Ang_Vel_Z[iFC])) ? r1(Math.abs(S.Thorax_Ang_Vel_Z[iFC])) : null;

    // 스트라이드 전진 운동량 (모듈 9)
    var cv = S.COM_Velocity_Y || null;
    if (cv) {
      var cpk = peak(cv, iKH, iBR, 'abs'); R.comVelPeak = r2(cpk.v); R.tComVelPeak = relMs(cpk.i);
      R.comVelAtFC = isFinite(cv[iFC]) ? r2(Math.abs(cv[iFC])) : null;
      R.comKEpeak = (cpk.v != null) ? Math.round(0.5 * mass * cpk.v * cpk.v) : null;
      R.comKEatFC = (R.comVelAtFC != null) ? Math.round(0.5 * mass * R.comVelAtFC * R.comVelAtFC) : null;
    }

    // 블로킹 (모듈 10) — AP 제동(FP2_Y), COM 감속. VGRF 는 무릎전달에서.
    var ap = S.FP2_Y || null;
    if (ap) { var apk = peak(ap, iFC, iBR, 'abs'); R.apBrakePeak = r1(apk.v / BW * 100); R.tApBrakePeak = relMs(apk.i); R.brakeImpulsePct = r2((integ(ap.map(function (v) { return Math.abs(v); }), iFC, apk.i, dt, 0) || 0) / BW * 100); }
    if (cv) { var dcom = deriv(cv.map(function (v) { return Math.abs(v); }), dt); var dpk = peak(dcom.map(function (v) { return -v; }), iFC, iBR, 'max'); R.comDecelPeak = r1(dpk.v); R.tComDecelPeak = relMs(dpk.i); }

    // 리드 무릎 (모듈 11) — VGRF(FP2_Z)·무릎 각도/파워·VGRF→골반 타이밍
    var vg = S.FP2_Z || null, ka = S.Lead_Knee_Angle_X || null, kp = S.Lead_Knee_Power_X || null;
    if (vg) {
      var vpk = peak(vg, iFC, iBR, 'abs'); R.vgrfPeak = r1(vpk.v / BW * 100); R.tVgrfPeak = relMs(vpk.i); R.iVgrfPeak = vpk.i;
      // plateau: >=80% peak 지속(ms), CV
      var thr = vpk.v * 0.8, dur = 0, vals = [];
      for (var j = iFC; j <= iBR && j < vg.length; j++) { if (Math.abs(vg[j]) >= thr) { dur++; vals.push(Math.abs(vg[j])); } }
      R.vgrfPlateauMs = Math.round(dur * dt * 1000);
      R.vgrfPlateauCV = (vals.length > 1) ? r1(sd(vals) / mean(vals) * 100) : null;
      // ── 수직 GRF 패턴(유지·증가·감소) — 무릎 각도유형과 별개 차원 [그룹 34명 검증] ──
      var vPk = vpk.v;
      if (vPk > 0 && vpk.i != null) {
        R.vgrfTtpFrac = (iBR > iFC) ? Math.round(100 * (vpk.i - iFC) / (iBR - iFC)) : null;   // 정점 도달 시점(FC→BR %)
        var vAtBR = (isFinite(vg[iBR])) ? Math.abs(vg[iBR]) : null;
        R.vgrfRetainBR = (vAtBR != null) ? Math.round(100 * vAtBR / vPk) : null;              // 릴리스 시 유지율
        var vMin = vPk; for (var jv = vpk.i; jv <= iBR && jv < vg.length; jv++) { if (isFinite(vg[jv]) && Math.abs(vg[jv]) < vMin) vMin = Math.abs(vg[jv]); }
        R.vgrfLateDrop = Math.round(100 * (vPk - vMin) / vPk);                                 // 정점 후 BR까지 최대 감소율
        // 패턴: 증가형(정점 늦고 유지) · 감소형(정점 이르고 급감) · 유지형(plateau)
        R.vgrfPattern = (R.vgrfTtpFrac >= 65 && R.vgrfLateDrop <= 25) ? '증가형'
          : (R.vgrfTtpFrac <= 40 && R.vgrfLateDrop >= 45) ? '감소형' : '유지형';
      }
    }
    if (ka && isFinite(ka[iFC]) && isFinite(ka[iBR])) {
      // ★ 각도규약: Lead_Knee_Angle_X 는 "클수록 굴곡(굽힘)"(phases·리포트 그래프 일치). 각 감소=신전(폄)/각 증가=굴곡무너짐.
      // 단일 Δ가 아니라 FC·PeakVGRF·MER·BR 다지점 + 신전속도 + 정/부 일 + 후기 재굴곡으로 분류(요청서).
      var kFCa = ka[iFC], kBRa = ka[iBR];
      R.kneeAngFC = r1(kFCa); R.kneeAngBR = r1(kBRa);
      R.kneeAngPeakVGRF = (R.iVgrfPeak != null && isFinite(ka[R.iVgrfPeak])) ? r1(ka[R.iVgrfPeak]) : null;
      R.kneeAngMER = (iMER != null && isFinite(ka[iMER])) ? r1(ka[iMER]) : null;
      var mn = peak(ka, iFC, iBR, 'min'); var minA = mn.v, iMin = mn.i;          // 최소각 = 최대 신전 시점
      var mx = peak(ka, iFC, iBR, 'max'); var maxA = mx.v;                        // 최대각 = 최대 굴곡
      var netExt = kFCa - kBRa;                 // + = FC→BR 순 신전(폄)
      var earlyExt = (minA != null) ? (kFCa - minA) : null;   // FC→최대신전 까지 편 양
      var lateReflex = (minA != null) ? (kBRa - minA) : null; // 최대신전→BR 재굴곡(후기 무너짐)
      var collapseAmt = (maxA != null) ? (maxA - kFCa) : null; // FC 대비 추가 굴곡
      R.kneeNetExt = r1(netExt); R.kneeEarlyExt = r1(earlyExt); R.kneeLateReflex = r1(lateReflex); R.kneeCollapseAmt = r1(collapseAmt);
      // 신전 각속도 peak = (-d각도/dt) 의 양의 peak
      var extVelArr = (deriv(ka, dt) || []).map(function (x) { return -x; });
      var evp = peak(extVelArr, iFC, iBR, 'max'); R.kneeExtVelPeak = r1(evp.v); R.tKneeExtVelPeak = relMs(evp.i);
      // 버팀 지속(FC 대비 ±5° 유지 연속 프레임)
      var braceN = 0; for (var b = iFC; b <= iBR && b < ka.length; b++) { if (Math.abs(ka[b] - kFCa) <= 5) braceN++; else break; }
      var braceMs = Math.round(braceN * dt * 1000); R.kneeBraceMs = braceMs;
      var type;
      // (주의) collapseAmt(일시 굽힘)만으로 무너짐 판정 금지 — BR에서 회복하면 버팀형. 무너짐=BR이 FC보다 더 굽은(순굴곡) 경우.
      if (earlyExt != null && lateReflex != null && earlyExt >= 8 && lateReflex >= 5) type = 'ext_collapse'; // 초기 신전 후 후기 무너짐(재굴곡)
      else if (netExt >= 13) type = (braceMs >= 40 ? 'hybrid' : 'extension');                                  // 강한 신전 (버팀 후면 하이브리드)
      else if (netExt <= -5) type = 'collapse';                                                                // BR이 FC보다 더 굽음 = 순 무너짐
      else if (braceMs >= 40 && earlyExt != null && earlyExt >= 8) type = 'hybrid';                             // 버티다 신전
      else type = 'bracing';                                                                                    // 작은 변화·유지(일시 굽힘 후 회복 포함)
      R.kneeType = type;
    }
    if (kp) { R.kneePosWork = r1(integ(kp, iFC, iBR, dt, 1)); R.kneeNegWork = r1(Math.abs(integ(kp, iFC, iBR, dt, -1) || 0)); }
    // VGRF peak → 골반 각가속 peak gap
    var pv = S.Pelvis_Ang_Vel_Z || null;
    if (vg && pv) { var pAcc = deriv(pv.map(function (v) { return Math.abs(v); }), dt); var pAccPk = peak(pAcc, iFC, iBR, 'max'); R.tPelvisAccPeak = relMs(pAccPk.i); if (R.tVgrfPeak != null && R.tPelvisAccPeak != null) R.gapVgrfToPelvisAcc = R.tPelvisAccPeak - R.tVgrfPeak; }

    // 골반→몸통 (모듈 12) — 속도/가속 타이밍 gap + gain (골반 분절에너지 없음 → overlap 생략)
    var tv = S.Thorax_Ang_Vel_Z || null;
    if (pv && tv) {
      var pvPk = peak(pv, iFC, iBR, 'abs'), tvPk = peak(tv, iFC, iBR, 'abs');
      R.pelvisVelPeak = r1(pvPk.v); R.tPelvisVelPeak = relMs(pvPk.i);
      R.trunkVelPeak = r1(tvPk.v); R.tTrunkVelPeak = relMs(tvPk.i);
      R.gapPelvisToTrunkVel = (R.tPelvisVelPeak != null && R.tTrunkVelPeak != null) ? R.tTrunkVelPeak - R.tPelvisVelPeak : null;
      R.trunkOverPelvisGain = (pvPk.v) ? r2(tvPk.v / pvPk.v) : null;
      var tAcc = deriv(tv.map(function (v) { return Math.abs(v); }), dt); var tAccPk = peak(tAcc, iFC, iBR, 'max'); R.tTrunkAccPeak = relMs(tAccPk.i);
      if (R.tPelvisAccPeak != null && R.tTrunkAccPeak != null) R.gapPelvisToTrunkAcc = R.tTrunkAccPeak - R.tPelvisAccPeak;
    }

    // 몸통 에너지 (모듈 13) — Trunk_ME_X = 총 역학에너지(회전+굴곡 미분리)
    var tE = S.Trunk_ME_X || null;
    if (tE) { var tEpk = peak(tE, iFC, iBR, 'max'); R.trunkEpeak = r1(tEpk.v); R.tTrunkEpeak = relMs(tEpk.i); R.iTrunkEpeak = tEpk.i; }

    // 몸통→팔 (모듈 14)
    var ir = S.Pitching_Shoulder_Ang_Vel_Z || null, ee = S.Pitching_Elbow_Ang_Vel_X || null, aE = S.Pitching_Humerus_ME_X || null;
    // [2026-05-28 #4] 손 속도 = 선형 손끝 속도(m/s) — armball 모듈과 단위 통일(기존 손 각속도 °/s 대신)
    var _rhpHS = (((t.meta && t.meta.handedness) || 'R').toUpperCase() !== 'L');
    var hs = null; try { if (typeof handSpeedSeries === 'function') hs = handSpeedSeries(t, _rhpHS); } catch (e) { hs = null; }
    var irPk = ir ? peak(ir.map(function (v) { return Math.abs(v); }), iFC, iBR, 'max') : { i: null, v: null };
    var eePk = ee ? peak(ee.map(function (v) { return Math.abs(v); }), iFC, iBR, 'max') : { i: null, v: null };
    var hsPk = hs ? peak(hs, iFC, iBR, 'max') : { i: null, v: null };
    R.shoulderIRvelPeak = r1(irPk.v); R.tShoulderIRvelPeak = relMs(irPk.i);
    R.elbowExtVelPeak = r1(eePk.v); R.tElbowExtVelPeak = relMs(eePk.i);
    R.handSpeedPeak = r1(hsPk.v); R.tHandSpeedPeak = relMs(hsPk.i); // 선형 m/s
    // [2026-05-28 #2] 몸통→어깨IR 타이밍 기준 = 몸통 회전속도 peak(분절 에너지 조기정점 보정)
    R.gapTrunkEtoShoulderIR = (R.tTrunkVelPeak != null && R.tShoulderIRvelPeak != null) ? R.tShoulderIRvelPeak - R.tTrunkVelPeak : null;
    R.gapIRtoElbow = (R.tShoulderIRvelPeak != null && R.tElbowExtVelPeak != null) ? R.tElbowExtVelPeak - R.tShoulderIRvelPeak : null;
    R.gapElbowToHand = (R.tElbowExtVelPeak != null && R.tHandSpeedPeak != null) ? R.tHandSpeedPeak - R.tElbowExtVelPeak : null;
    R.gapHandToBR = (R.tHandSpeedPeak != null) ? 0 - R.tHandSpeedPeak + relMs(iBR) : null; // BR-handPeak (relMs(iBR)=BR-FC)
    // [2026-05-28 #1] 키네틱 시퀀스 순서: 문헌(Fleisig/ASMI) = 골반→몸통→팔꿈치신전→어깨내회전→손. 어깨IR이 가장 늦게(릴리스 직전) 정점.
    // 키네틱 체인(근위→원위 분절 peak): 골반→몸통→팔꿈치신전→어깨내회전. 손/공 속도는 체인의 '결과'(릴리스 근처, 어깨IR과 거의 동시·노이즈)라 순서 판정에서 제외.
    R.seqOrderOK = ([R.tPelvisVelPeak, R.tTrunkVelPeak, R.tElbowExtVelPeak, R.tShoulderIRvelPeak].every(function (x) { return x != null; }))
      && (R.tPelvisVelPeak <= R.tTrunkVelPeak && R.tTrunkVelPeak <= R.tElbowExtVelPeak && R.tElbowExtVelPeak <= R.tShoulderIRvelPeak);

    // TrunkArm handoff overlap (모듈 14.6) — 상완 기준(completeness=humerus only)
    if (tE && aE && R.iTrunkEpeak != null) {
      var dT = deriv(tE, dt), dA = deriv(aE, dt), lo = R.iTrunkEpeak, hi = iBR, ov = 0, ag = 0;
      for (var m2 = lo; m2 <= hi && m2 < tE.length; m2++) {
        var rel = Math.max(0, -(dT[m2] || 0)), gain = Math.max(0, (dA[m2] || 0));
        ov += Math.min(rel, gain) * dt; ag += gain * dt;
      }
      R.trunkArmOverlap = ag > 0 ? r2(ov / ag) : null; R.handoffEstWork = r1(ov);
    }
    // Arm local positive work (어깨+팔꿈치 파워, 손목 없음) FC→BR & trunkPeak→BR
    var sp = S.Pitching_Shoulder_Power_X || null, ep = S.Pitching_Elbow_Power_X || null;
    var lo2 = (R.iTrunkEpeak != null ? R.iTrunkEpeak : iFC);
    var alw = 0, any = false;
    if (sp) { alw += (integ(sp, lo2, iBR, dt, 1) || 0); any = true; }
    if (ep) { alw += (integ(ep, lo2, iBR, dt, 1) || 0); any = true; }
    R.armLocalPosWork = any ? r1(alw) : null;
    if (R.armLocalPosWork != null && R.handoffEstWork != null) {
      var eps = 1; R.armSelfReliance = r2(R.armLocalPosWork / (R.armLocalPosWork + R.handoffEstWork + eps));
    }
    return R;
  }

  // ── 피크 파워 시퀀스 (근위→원위 에너지 전달 타이밍) — 개발요청서 v5 / 대화정리 §7 ──
  //  하이브리드 사슬: 리드무릎(관절파워) → 골반·몸통·상완(분절파워=dME/dt) → 어깨·팔꿈치(관절파워).
  //  전완·손 분절에너지는 Theia export 에 없어 'na'(데이터 없음)로 명시. 임계값 잠정(UNVERIFIED).
  //  '피크 파워 시퀀스'는 키네마틱(속도) 시퀀스보다 에너지 전달을 더 직접적으로 반영(대화정리 §1·§6).
  var PS_CHAIN = [
    { key: 'knee', label: '리드 무릎', src: 'joint', col: 'Lead_Knee_Power_X' },
    { key: 'pelvis', label: '골반', src: 'seg', col: 'Pelvis_ME_X' },
    { key: 'trunk', label: '몸통', src: 'seg', col: 'Trunk_ME_X' },
    { key: 'humerus', label: '상완', src: 'seg', col: 'Pitching_Humerus_ME_X' },
    { key: 'shoulder', label: '어깨', src: 'joint', col: 'Pitching_Shoulder_Power_X' },
    { key: 'elbow', label: '팔꿈치', src: 'joint', col: 'Pitching_Elbow_Power_X' }
  ];
  // 잠정 그룹 norm — 노드별 FC 기준 파워 정점 시점(ms) q1/med/q3.
  //  [상동고 5명·56구 기준 / 엘리트 포함 풀그룹 theia 확정 시 갱신할 것]
  //  실측 결과 파워 피크 순서(몸통≈골반 → 무릎 → 상완 → 팔꿈치 → 어깨)는 키네마틱(속도) 순서와 다름(대화정리 §5).
  //  따라서 교과서 고정순서 대신 '그룹 대비 각 노드 타이밍이 정상 범위인가'로 판정(리포트 타 단계와 동일한 백분위 철학).
  //  [그룹 norm: 엘리트20 + 상동고14 = 34명 전수 · 2026-06-01 검증] 노드별 FC 기준 파워 정점 시점(ms) q1/med/q3.
  var PS_NORM = {
    knee: { q1: 40, med: 49, q3: 60 }, pelvis: { q1: 61, med: 130, q3: 152 }, trunk: { q1: 0, med: 7, q3: 17 },
    humerus: { q1: 70, med: 85, q3: 95 }, shoulder: { q1: 113, med: 138, q3: 152 }, elbow: { q1: 100, med: 119, q3: 135 }
  };
  //  골반 파워 정점은 분산이 매우 커(IQR 61~152ms) 타이밍 신뢰도 낮음 — 밴드가 넓어 거의 항상 정상 처리(의도된 보수성).
  //  [블로킹·몸통회전·전달 그룹 norm + 검증된 관계 (34명, r·p)]
  var PS_BLOCK_NORM = { apBrakeImpulse: { q1: 11.7, med: 13.0, q3: 13.7 }, trunkVel: { q1: 796, med: 866, q3: 933 } };  // %BW·s, °/s (apBrake peak deprecated)
  var PS_TRANSFER_NORM = { trunkContrib: { q1: 0.68, med: 0.72, q3: 0.78 } };                                  // 1-ASR
  var PS_VALID = {
    blockToTrunk: 0.60, trunkToVelo: 0.49, transferToVelo: 0.29,           // Pearson r (34명)
    note: '검증(34명): 블로킹(AP제동)→몸통회전 r=.60(p<.001) · 몸통회전→구속 r=.49(p=.003) · 몸통기여율→구속 r=.29(p=.09, 경향)'
  };
  // 노드 타이밍을 그룹 밴드에 대조: 정상(IQR 내)·이름/늦음(≤1.5IQR)·이상(>1.5IQR)
  function psBand(t, nm) {
    if (t == null || !nm) return { s: 'na', dev: null, label: '–' };
    var iqr = Math.max(8, nm.q3 - nm.q1);
    if (t >= nm.q1 && t <= nm.q3) return { s: 'good', dev: 0, label: '정상' };
    if (t < nm.q1) { var d = Math.round(nm.q1 - t); return { s: d <= 1.5 * iqr ? 'caution' : 'leak', dev: -d, label: '이름' }; }
    var d2 = Math.round(t - nm.q3); return { s: d2 <= 1.5 * iqr ? 'caution' : 'leak', dev: d2, label: '늦음' };
  }
  function psPctBand(v, nm, hiGood) {  // 그룹 IQR 대비 백분위 위치(블로킹·회전: 클수록 좋음)
    if (v == null || !nm) return { s: 'na', label: '–' };
    if (v >= nm.q3) return { s: 'good', label: '상위' };
    if (v >= nm.q1) return { s: 'good', label: '중앙' };
    var iqr = Math.max(1, nm.q3 - nm.q1);
    return { s: (nm.q1 - v) <= iqr ? 'caution' : 'leak', label: '하위' };
  }

  // ── 몸통 회전·굴곡·측굴 에너지 자체 산출 (관성반영 회전운동에너지 ½Iω²) ──
  //  ω: Thorax_Ang_Vel(X=굴곡/ML축·Y=측굴/AP축·Z=축회전). I_axis = m·(k_axis·L)². de Leva(1996) 흉부:
  //  질량분율 0.1596 · 회전반경(분절장%) 시상 .716·횡 .659·종 .349 · 분절장 L≈0.30·키(추정).
  //  핵심: 분배비(%)는 m·L 약분돼 k²ω²만으로 견고. 절대 J는 m·L 추정 의존(anthropometric estimate).
  var TRUNK_KIN = { massFrac: 0.1596, lenRatio: 0.30, kX: 0.716, kY: 0.659, kZ: 0.349 };
  function trunkEnergySplit(t, mass, heightM) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || 0.00333;
    var iFC = e.i_fc, iBR = e.i_br; if (iFC == null || iBR == null) return null;
    var wx = S.Thorax_Ang_Vel_X, wy = S.Thorax_Ang_Vel_Y, wz = S.Thorax_Ang_Vel_Z;
    if (!wx || !wy || !wz) return null;
    var ht = heightM || 1.8, mTr = mass * TRUNK_KIN.massFrac, L = TRUNK_KIN.lenRatio * ht;
    var Ix = mTr * Math.pow(TRUNK_KIN.kX * L, 2), Iy = mTr * Math.pow(TRUNK_KIN.kY * L, 2), Iz = mTr * Math.pow(TRUNK_KIN.kZ * L, 2);
    var D = Math.PI / 180;
    function relMs(i) { return (i == null) ? null : Math.round((i - iFC) * dt * 1000); }
    var prk = { rot: 0, flx: 0, lat: 0 }, prkI = { rot: null, flx: null, lat: null };
    var sumRot = 0, sumFlx = 0, sumLat = 0, pkTotI = null, pkTot = -1, pkShare = null;
    for (var i = iFC; i <= iBR && i < wz.length; i++) {
      var ox = (wx[i] || 0) * D, oy = (wy[i] || 0) * D, oz = (wz[i] || 0) * D;
      var eRot = 0.5 * Iz * oz * oz, eFlx = 0.5 * Ix * ox * ox, eLat = 0.5 * Iy * oy * oy, tot = eRot + eFlx + eLat;
      if (eRot > prk.rot) { prk.rot = eRot; prkI.rot = i; }
      if (eFlx > prk.flx) { prk.flx = eFlx; prkI.flx = i; }
      if (eLat > prk.lat) { prk.lat = eLat; prkI.lat = i; }
      sumRot += eRot; sumFlx += eFlx; sumLat += eLat;
      if (tot > pkTot) { pkTot = tot; pkTotI = i; pkShare = { rot: Math.round(100 * eRot / tot), flx: Math.round(100 * eFlx / tot), lat: Math.round(100 * eLat / tot) }; }
    }
    var sumAll = sumRot + sumFlx + sumLat || 1;
    return {
      rotKE: r1(prk.rot), flexKE: r1(prk.flx), latKE: r1(prk.lat),
      tRotKE: relMs(prkI.rot), tFlexKE: relMs(prkI.flx),
      rotShare: Math.round(100 * sumRot / sumAll), flexShare: Math.round(100 * sumFlx / sumAll), latShare: Math.round(100 * sumLat / sumAll),
      peakShare: pkShare, tPeak: relMs(pkTotI),
      method: 'de Leva 흉부 관성반영 ½Iω²(질량분율 ' + TRUNK_KIN.massFrac + '·L=' + TRUNK_KIN.lenRatio + '·키). 분배%는 견고, 절대J는 추정.'
    };
  }

  function powerSeqTrial(t) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iFC = e.i_fc, iBR = e.i_br;
    if (iFC == null || iBR == null) return null;
    function relMs(i) { return (i == null) ? null : Math.round((i - iFC) * dt * 1000); }
    return PS_CHAIN.map(function (c) {
      var arr = S[c.col] || null;
      if (!arr || !arr.length) return { key: c.key, label: c.label, src: c.src, present: false, tPeak: null, iPeak: null, power: null };
      var pw = (c.src === 'seg') ? deriv(arr, dt) : arr;     // 분절파워 = dME/dt, 관절파워는 그대로
      var pk = peak(pw, iFC, iBR, 'max');                    // 양의 최대(에너지 생성·전달 정점)
      return { key: c.key, label: c.label, src: c.src, present: pk.i != null, tPeak: relMs(pk.i), iPeak: pk.i, power: r1(pk.v) };
    });
  }

  // DATA(전 trial) + 대표 trial(+rawTrial R) → 시퀀스/시간차/전달비율/블로킹 (그룹 34명 상대 판정)
  function powerSequence(DATA, rep, repR) {
    if (!rep) return null;
    var repNodes = powerSeqTrial(rep);
    if (!repNodes) return null;
    var allNodes = (DATA.trials || []).map(function (t) { try { return powerSeqTrial(t); } catch (e) { return null; } }).filter(Boolean);
    // 노드별 반복성(SD) + 그룹 밴드 판정
    var IMPW = { knee: 0.8, pelvis: 0.6, trunk: 1.0, humerus: 1.0, shoulder: 1.0, elbow: 1.0 };
    repNodes.forEach(function (nd, idx) {
      var col = allNodes.map(function (ns) { return ns[idx] && ns[idx].present ? ns[idx].tPeak : null; });
      nd.tPeakSD = r1(sd(col));
      nd.nValid = col.filter(function (x) { return x != null && isFinite(x); }).length;
      nd.band = psBand(nd.tPeak, PS_NORM[nd.key]);
      nd.normMed = PS_NORM[nd.key] ? PS_NORM[nd.key].med : null;
    });
    // 관찰 시퀀스(측정된 노드를 정점 시각 순으로) + 인접 구간 시간차(Time Lag)
    var pres = repNodes.filter(function (n) { return n.present && n.tPeak != null; }).slice().sort(function (a, b) { return a.tPeak - b.tPeak; });
    var lags = [];
    for (var i = 1; i < pres.length; i++) {
      var a = pres[i - 1], b = pres[i], lag = b.tPeak - a.tPeak;
      lags.push({ from: a.key, fromLabel: a.label, to: b.key, toLabel: b.label, lag: lag });
    }
    var observedOrder = pres.map(function (n) { return n.label; }).join(' → ');
    // 전달 효율 점수 = 노드 타이밍 그룹 밴드 적합도(중요도 가중)
    var sw = 0, ww = 0;
    repNodes.forEach(function (nd) { if (nd.band && nd.band.s !== 'na') { var sc = nd.band.s === 'good' ? 100 : (nd.band.s === 'caution' ? 62 : 30); var w = IMPW[nd.key] || 0.8; sw += sc * w; ww += w; } });
    var efficiency = ww > 0 ? Math.round(sw / ww) : null;
    // 타이밍 이상 노드(피드백) — 그룹 IQR 밖. 골반은 정점 분산이 커 신뢰 낮아 피드백에서 제외.
    var leaks = repNodes.filter(function (n) { return n.key !== 'pelvis' && n.band && (n.band.s === 'leak' || n.band.s === 'caution'); })
      .map(function (n) { return { node: n.label, label: n.band.label, dev: n.band.dev, status: n.band.s, note: n.label + ' 파워 정점이 그룹 대비 ' + Math.abs(n.band.dev) + 'ms ' + n.band.label + '(중앙 FC+' + n.normMed + 'ms)' }; });
    var missing = repNodes.filter(function (n) { return !n.present; }).map(function (n) { return n.label; });

    // 분절 전달비율(팔 구간): 몸통 기여율 = 1 - ASR (검증: 구속과 약한 양의 경향 r=.29)
    var asr = repR ? repR.armSelfReliance : null;
    var trunkContrib = (asr != null && isFinite(asr)) ? r2(1 - asr) : null;
    var tcBand = psPctBand(trunkContrib, PS_TRANSFER_NORM.trunkContrib, true);

    // 블로킹 → 몸통 회전 전달(검증 r=.60→.49): 제동력·몸통 회전속도 그룹 대비
    var apBrakeImpulse = repR ? repR.brakeImpulsePct : null, trunkVel = repR ? repR.trunkVelPeak : null;
    var blocking = {
      apBrakeImpulse: apBrakeImpulse, apBand: psPctBand(apBrakeImpulse, PS_BLOCK_NORM.apBrakeImpulse, true),
      trunkVel: trunkVel, tvBand: psPctBand(trunkVel, PS_BLOCK_NORM.trunkVel, true),
      r_blockToTrunk: PS_VALID.blockToTrunk, r_trunkToVelo: PS_VALID.trunkToVelo,
      kneeType: repR ? repR.kneeType : null, vgrfPattern: repR ? repR.vgrfPattern : null,
      vgrfTtpFrac: repR ? repR.vgrfTtpFrac : null, vgrfLateDrop: repR ? repR.vgrfLateDrop : null, vgrfPeak: repR ? repR.vgrfPeak : null
    };

    return {
      version: 'powerseq-v2-cohort34',
      nodes: repNodes, lags: lags, observedOrder: observedOrder,
      efficiency: efficiency, leaks: leaks, missing: missing,
      transfer: { trunkContrib: trunkContrib, asr: (asr != null ? r2(asr) : null), band: tcBand, r_toVelo: PS_VALID.transferToVelo, norm: PS_TRANSFER_NORM.trunkContrib },
      blocking: blocking,
      kneeTrunkFlex: { available: false, note: '무릎신전→몸통 굴곡 전달은 Trunk_ME가 회전·굴곡 합산이라 검증 보류 — 굴곡/회전 분리 export 필요' },
      valid_note: PS_VALID.note,
      note: '하이브리드 사슬(분절파워 dME/dt + 관절파워) · 그룹 34명(엘리트20+상동고14) 밴드 상대 판정. ' + (missing.length ? '미측정: ' + missing.join('·') + ' (전완·손 분절E 없음). ' : '') + '골반 타이밍은 분산 커 신뢰도 낮음.',
      chain_def: PS_CHAIN.map(function (c) { return c.label + (c.src === 'seg' ? '(분절)' : '(관절)'); }).join(' → ')
    };
  }

  // ── 메인: DATA → 진단 ──
  function compute(DATA) {
    if (!DATA || !DATA.trials || !DATA.trials.length) return null;
    var mass = (DATA.player && DATA.player.weight_kg) || 86;
    // 대표 trial = COM 전진속도 peak 최대(엔진 _fastTrial 와 동일 폴백) 없으면 best_trial_index
    function comPk(t) { var a = t.series && t.series.COM_Velocity_Y; if (!a) return null; var e = t.events || {}; return peak(a.map(function (v) { return Math.abs(v); }), e.i_kl_peak || 0, e.i_br, 'max').v; }
    var rep = null, bv = -Infinity;
    DATA.trials.forEach(function (t) { var v = comPk(t); if (v != null && v > bv) { bv = v; rep = t; } });
    if (!rep) rep = DATA.trials[(DATA.best_trial_index || 1) - 1] || DATA.trials[0];
    var R = rawTrial(rep, mass);
    if (!R) return null;

    // 전 trial 원시 + 타이밍 SD(반복성)
    var allR = DATA.trials.map(function (t) { try { return rawTrial(t, mass); } catch (e) { return null; } }).filter(Boolean);
    function col(k) { return allR.map(function (x) { return x[k]; }); }
    var consistency = {
      nTrials: DATA.trials.length,
      confidence: DATA.trials.length >= 10 ? '충분' : '낮음(10구 미만)',
      xfReleaseStartSD: r1(sd(col('tXfReleaseStart'))),
      vgrfPeakTimeSD: r1(sd(col('tVgrfPeak'))),
      vgrfToPelvisGapSD: r1(sd(col('gapVgrfToPelvisAcc'))),
      pelvisToTrunkGapSD: r1(sd(col('gapPelvisToTrunkVel'))),
      trunkToIRGapSD: r1(sd(col('gapTrunkEtoShoulderIR'))),
      armSelfRelianceSD: r2(sd(col('armSelfReliance')))
    };

    // 부상/부하: phases injuryload 에서 토크 읽기
    var elbowTq = null, shTq = null;
    try {
      var ij = (DATA.phases && DATA.phases.stages || []).filter(function (s) { return s.key === 'injuryload'; })[0];
      if (ij) (ij.metrics || []).forEach(function (m) { if (m.key === 'elbowMoment') elbowTq = m.value; if (m.key === 'shoulderMoment') shTq = m.value; });
    } catch (e) {}
    R.elbowTorque = elbowTq; R.shoulderTorque = shTq;

    // 신뢰도 플래그
    var hasGRF = !!(rep.grf || (rep.series && rep.series.FP2_Z));
    var conf = {
      grf: hasGRF ? '높음(force plate)' : '낮음(GRF 없음)',
      armEnergy: 'humerus only (전완·손 분절에너지 없음)',
      armLocalWork: '어깨+팔꿈치 (손목 파워 없음)',
      consistency: consistency.confidence
    };

    // ── 단계 상태 판정(good/caution/leak/na) + 점수(0~100) ──
    // 새 전달지표는 임계 기반(요청서 v5), 기존 변인은 cohort 점수 활용.
    function band(v, good, cau, hi) { // hi=true: 클수록 좋음
      if (v == null) return { s: 'na', sc: null };
      var ok = hi ? v >= good : v <= good, mid = hi ? v >= cau : v <= cau;
      return { s: ok ? 'good' : (mid ? 'caution' : 'leak'), sc: ok ? 85 : (mid ? 62 : 38) };
    }
    function inRange(v, lo, hi, looseLo, looseHi) {
      if (v == null) return { s: 'na', sc: null };
      if (v >= lo && v <= hi) return { s: 'good', sc: 85 };
      if (v >= looseLo && v <= looseHi) return { s: 'caution', sc: 62 };
      return { s: 'leak', sc: 38 };
    }
    var N = []; // 흐름 노드
    // 1 와인드업(저장): X-factor 형성 + 조기풀림 penalty (형성 맥락 + 풀림비율)
    (function () { var rb = R.xfReleasedByFC; var b = band(rb, 10, 25, false); N.push({ key: 'windup', label: '와인드업 (저장)', tag: 'store', status: b.s, score: b.sc, rep: 'X-factor 형성 ' + (R.xfPeak || '–') + '° · FC까지 풀림 ' + (rb == null ? '–' : rb + '%') }); })();
    // 2 X-factor 타이밍(저장→전달 연결)
    (function () { var rs = R.tXfReleaseStart; var b = (rs == null) ? { s: 'na', sc: null } : (rs >= -5 ? { s: 'good', sc: 85 } : (rs >= -25 ? { s: 'caution', sc: 62 } : { s: 'leak', sc: 38 })); N.push({ key: 'xftiming', label: 'X-factor 타이밍', tag: 'transfer', status: b.s, score: b.sc, rep: '풀림 시작 FC' + (rs == null ? '–' : (rs >= 0 ? '+' : '') + rs + 'ms') + ' · 풀림속도 ' + (R.xfReleasePeakVel || '–') + '°/s' }); })();
    // 3 드라이브(생성): COM 전진 KE/속도 at FC
    (function () { var b = band(R.comVelAtFC, 2.9, 2.6, true); N.push({ key: 'stride', label: '드라이브 (전진 에너지)', tag: 'gen', status: b.s, score: b.sc, rep: 'FC 전진속도 ' + (R.comVelAtFC || '–') + 'm/s · KE ' + (R.comKEatFC || '–') + 'J' }); })();
    // 4 블로킹(생성→전환): AP 제동 + COM 감속
    (function () { var b1 = band(R.brakeImpulsePct, 13.7, 11.7, true); N.push({ key: 'blocking', label: '블로킹 (지면반력)', tag: 'gen', status: b1.s, score: b1.sc, rep: '제동 임펄스 ' + (R.brakeImpulsePct || '–') + '%BW·s · COM감속 ' + (R.comDecelPeak || '–') + 'm/s²' }); })();
    // 5 무릎 전달(전달): 유형(다지점) + 음의일/VGRF 안정. 지면반력을 골반으로 전달했나 vs 흡수/후기무너짐?
    (function () {
      var s, sc; var t = R.kneeType;
      if (t === 'collapse') { s = 'leak'; sc = 40; }
      else if (t === 'ext_collapse') { s = 'leak'; sc = 46; }  // 초기엔 폈으나 후기 지지력 무너짐
      else { // extension / hybrid / bracing = 기본 양호, 흡수·불안정 시 강등
        s = 'good'; sc = 85;
        if (R.kneeNegWork != null && R.kneePosWork != null && R.kneeNegWork > R.kneePosWork * 2.2) { s = 'caution'; sc = 62; }
        else if (R.vgrfPlateauCV != null && R.vgrfPlateauCV > 12) { s = 'caution'; sc = 64; }
      }
      var tyk = KNEE_KO[t] || t || '–';
      N.push({ key: 'knee', label: '앞다리 버팀', tag: 'transfer', status: s, score: null, rep: tyk + ' · 순신전 ' + (R.kneeNetExt == null ? '–' : R.kneeNetExt + '°') + ' · VGRF ' + (R.vgrfPeak || '–') + '%BW [' + (R.vgrfPattern || '–') + ' · plateau ' + (R.vgrfPlateauMs || '–') + 'ms · 정점 ' + (R.vgrfTtpFrac == null ? '–' : R.vgrfTtpFrac + '%') + '·후기감소 ' + (R.vgrfLateDrop == null ? '–' : R.vgrfLateDrop + '%') + '] · 신전속도 ' + (R.kneeExtVelPeak || '–') + '°/s · 흡수일 ' + (R.kneeNegWork || '–') + 'J', kneeType: t, vgrfPattern: R.vgrfPattern || null });
    })();
    // 6 골반→몸통(전달): 타이밍 gap 작을수록 좋음(주축) + gain 안전망  [2026-05-28 재보정: theia_validate.json 기반 — 고속군 gap med 14ms vs 저속군 60ms]
    (function () { var bt = band(R.gapPelvisToTrunkVel, 30, 60, false); var bg = inRange(R.trunkOverPelvisGain, 1.15, 1.7, 1.0, 1.9); var sc = (bg.sc != null && bt.sc != null) ? Math.round((bg.sc + bt.sc) / 2) : (bg.sc || bt.sc); var s = (bg.s === 'leak' || bt.s === 'leak') ? 'leak' : ((bg.s === 'caution' || bt.s === 'caution') ? 'caution' : 'good'); N.push({ key: 'pelvistrunk', label: '골반→몸통 (회전 증폭)', tag: 'transfer', status: s, score: sc, rep: 'gain ' + (R.trunkOverPelvisGain || '–') + ' · 타이밍 gap ' + (R.gapPelvisToTrunkVel == null ? '–' : R.gapPelvisToTrunkVel + 'ms') + ' (짧을수록 시퀀싱 우수)' }); })();
    // 7 몸통 에너지(생성)
    (function () { var b = band(R.trunkEpeak, 588, 500, true); N.push({ key: 'trunk', label: '몸통 에너지 (생성)', tag: 'gen', status: b.s, score: b.sc, rep: '몸통 ME peak ' + (R.trunkEpeak || '–') + 'J @FC+' + (R.tTrunkEpeak == null ? '–' : R.tTrunkEpeak) + 'ms' }); })();
    // 8 몸통→팔(전달): handoff overlap + ASR + 몸통E→IR gap
    (function () {
      var bo = band(R.trunkArmOverlap, 0.65, 0.5, true), ba = band(R.armSelfReliance, 0.4, 0.55, false);
      var sc = (bo.sc != null && ba.sc != null) ? Math.round((bo.sc + ba.sc) / 2) : (bo.sc || ba.sc);
      var s = (bo.s === 'leak' || ba.s === 'leak') ? 'leak' : ((bo.s === 'caution' || ba.s === 'caution') ? 'caution' : 'good');
      N.push({ key: 'trunkarm', label: '몸통→팔 (상지 전달)', tag: 'transfer', status: s, score: sc, rep: 'Handoff overlap ' + (R.trunkArmOverlap == null ? '–' : R.trunkArmOverlap) + ' · Arm Self-Reliance ' + (R.armSelfReliance == null ? '–' : R.armSelfReliance) + ' · 몸통E→어깨IR ' + (R.gapTrunkEtoShoulderIR == null ? '–' : R.gapTrunkEtoShoulderIR + 'ms') });
    })();
    // 9 팔→공(전달/부하): 손속도 peak가 BR 근처 + 팔 부담
    (function () { var hb = R.gapHandToBR; var b = (hb == null) ? { s: 'na', sc: null } : (Math.abs(hb) <= 15 ? { s: 'good', sc: 85 } : (Math.abs(hb) <= 35 ? { s: 'caution', sc: 62 } : { s: 'leak', sc: 40 })); N.push({ key: 'armball', label: '팔→공 (방출·부하)', tag: 'load', status: b.s, score: b.sc, rep: '손속도 peak→BR ' + (hb == null ? '–' : hb + 'ms') + ' · 팔꿈치 토크 ' + (R.elbowTorque || '–') + 'N·m' }); })();

    // ── 상세 모듈 계산(9단계 점수 일원화에 사용) — 각 진단 탭과 동일 점수 ──
    var RHP = (((DATA.player && DATA.player.handedness) || 'R').toUpperCase() !== 'L');
    var windupL = null; try { windupL = windupLoading(rep, mass, RHP, R); } catch (e) { windupL = null; }
    var strideL = null; try { strideL = strideEval(rep, mass, RHP, R, windupL, (DATA.player && DATA.player.height_m) || 1.8); } catch (e) { strideL = null; }
    var xftimingL = null; try { xftimingL = xfactorTiming(rep, mass, RHP, R, windupL); } catch (e) { xftimingL = null; }
    var blockingL = null; try { blockingL = blockingEval(rep, mass, RHP, R, strideL, xftimingL); } catch (e) { blockingL = null; }
    var knee5L = null; try { knee5L = kneeTransfer(rep, mass, RHP, R, blockingL); } catch (e) { knee5L = null; }
    var pelvisTrunkL = null; try { pelvisTrunkL = pelvisTrunkEval(rep, mass, RHP, R, xftimingL); } catch (e) { pelvisTrunkL = null; }
    var trunkEL = null; try { trunkEL = trunkEnergyEval(rep, mass, RHP, R, xftimingL); } catch (e) { trunkEL = null; }
    var trunkArmL = null; try { trunkArmL = trunkArmEval(rep, mass, RHP, R, trunkEL); } catch (e) { trunkArmL = null; }
    var armBallL = null; try { armBallL = armBallEval(rep, mass, RHP, R, trunkArmL, DATA.measured_kmh); } catch (e) { armBallL = null; }
    // ── [점수 일원화] 9단계 레이더·상태·요약·선수리포트가 모두 각 진단 탭과 동일한 그룹 백분위 점수를 쓰도록 통일 ──
    // 양호 ≥75 · 주의 50~74 · 병목 <50 (상동고 20명 그룹 median/IQR 기반 상세 점수에 매핑)
    var _DSC = { windup: windupL && windupL.composite, xftiming: xftimingL && xftimingL.timingScore, stride: strideL && strideL.momentumScore,
      blocking: blockingL && blockingL.capacityScore, knee: null, pelvistrunk: pelvisTrunkL && pelvisTrunkL.ampScore,
      trunk: trunkEL && trunkEL.prodScore, trunkarm: trunkArmL && trunkArmL.taScore, armball: armBallL && armBallL.abScore };
    // ── [검증 반영 점수 보정 · 2026-06-01] 34명 검증된 관계를 단계 점수에 가중(백분위 backbone 유지 + 각 ±10 보정) ──
    //   블로킹: 제동→몸통회전 전달(r=.60)→구속(r=.49) · 무릎: VGRF 패턴(유지형 best) · 전달: 몸통기여율 1-ASR(r=.29, 절반가중)
    function _pctQ(v, nm) { if (v == null || !nm) return 50; if (v <= nm.q1) return Math.max(5, 25 * v / (nm.q1 || 1)); if (v <= nm.med) return 25 + 25 * (v - nm.q1) / ((nm.med - nm.q1) || 1); if (v <= nm.q3) return 50 + 25 * (v - nm.med) / ((nm.q3 - nm.med) || 1); return Math.min(95, 75 + 25 * (v - nm.q3) / ((nm.q3 - nm.q1) || 1)); }
    var _ADJ = 10; function _mod(pct) { return Math.round(Math.max(-_ADJ, Math.min(_ADJ, (pct - 50) / 50 * _ADJ))); }
    var _vadj = {};
    if (_DSC.blocking != null && R.trunkVelPeak != null) { _vadj.blocking = _mod(_pctQ(R.trunkVelPeak, PS_BLOCK_NORM.trunkVel)); _DSC.blocking = Math.max(0, Math.min(100, _DSC.blocking + _vadj.blocking)); }
    if (_DSC.trunkarm != null && R.armSelfReliance != null) { _vadj.trunkarm = Math.round(_mod(_pctQ(1 - R.armSelfReliance, PS_TRANSFER_NORM.trunkContrib)) * 0.5); _DSC.trunkarm = Math.max(0, Math.min(100, _DSC.trunkarm + _vadj.trunkarm)); }

    function _uStat(sc) { return (sc == null) ? 'na' : (sc >= 75 ? 'good' : (sc >= 50 ? 'caution' : 'leak')); }
    N.forEach(function (n) {
      if (n.key === 'knee') return;  // [K5-A] 유형·연결 중심 — legacy kneeTransferScore로 점수 덮어쓰기 금지
      var ds = _DSC[n.key]; if (ds != null && isFinite(ds)) { n.score = Math.round(ds); n.status = _uStat(n.score); }
    });

    // ── Top3 병목: badness × 단계중요도 × 구속관련도 ──
    var IMP = { windup: 0.5, xftiming: 0.9, stride: 0.7, blocking: 0.9, knee: 1.0, pelvistrunk: 1.0, trunk: 0.85, trunkarm: 1.2, armball: 0.7 };
    var bn = N.filter(function (n) { return n.status === 'leak' || n.status === 'caution'; })
      .map(function (n) { var bad = n.score == null ? 0 : (100 - n.score) / 100; return { key: n.key, label: n.label, status: n.status, rep: n.rep, severity: r2(bad * (IMP[n.key] || 0.6)) }; })
      .sort(function (a, b) { return b.severity - a.severity; }).slice(0, 3);

    // ── 한국어 진단 문장(요청서 21: 측정→에너지 의미→구속 영향→개선) ──
    function nar(n) {
      var m = {
        windup: ['와인드업은 다리를 들고 뒷고관절에 앉아(힙힌지) 골반을 감으며(코일) 던질 힘을 저장하는 준비 단계입니다', '깊게 코일할수록 이후 스트라이드·회전에서 풀어 쓸 탄성 에너지가 커집니다', '뒷발로 지면을 비틀어(꼬임 토크) 골반 코일을 더 깊고 안정적으로 만듭니다 (분리·풀림은 스트라이드·몸통 단계에서 평가)'],
        xftiming: ['분리(X-factor)가 FC' + (R.tXfReleaseStart == null ? '' : (R.tXfReleaseStart >= 0 ? '+' : '') + R.tXfReleaseStart + 'ms') + '에 풀리기 시작합니다', '너무 일찍 풀리면 지면에서 더 받을 에너지를 놓치고, 적절한 시점에 빠르게 풀려야 저장 에너지가 상체로 전달됩니다', '풀림 시작을 FC 이후 블로킹과 맞추는 것을 우선합니다'],
        stride: ['스트라이드에서 FC 시점 전진속도 ' + (R.comVelAtFC || '–') + 'm/s(운동에너지 ' + (R.comKEatFC || '–') + 'J)를 만듭니다', '이 전진 운동량이 앞발 블로킹에서 회전 에너지로 전환됩니다', '전진 운동량을 더 키우거나 착지 후 제동으로 잘 전환되게 합니다'],
        blocking: ['앞발 제동 임펄스 ' + (R.brakeImpulsePct || '–') + '%BW·s, COM 감속 ' + (R.comDecelPeak || '–') + 'm/s²로 전진을 멈춥니다', '제동이 약하거나 늦으면 만든 전진 운동량을 회전 에너지로 바꾸지 못하고 몸이 앞으로 밀립니다', '착지 후 앞발 제동 누적·전진속도 감소로 선형→회전 전환을 높입니다'],
        knee: (function () {
          var t = R.kneeType, mean, imp;
          if (t === 'collapse') { mean = 'FC 이후 무릎이 더 굽으며(추가 굴곡 ' + (R.kneeCollapseAmt || '–') + '°·흡수 ' + (R.kneeNegWork || '–') + 'J) 지면 힘이 골반 회전으로 전달되지 못하고 무릎에서 흡수·소실됩니다'; imp = '착지 후 무릎이 더 굽지 않도록 버팀/신전 안정성을 키워 수직 지면반력을 골반 회전으로 보냅니다'; }
          else if (t === 'ext_collapse') { mean = '착지 직후엔 무릎을 ' + (R.kneeEarlyExt || '–') + '° 폈지만 MER~릴리스 구간에서 다시 ' + (R.kneeLateReflex || '–') + '° 굽어 지지력이 늦게 무너집니다'; imp = '릴리스 순간까지 신전 지지를 유지해 후기 무너짐(late collapse)를 줄입니다'; }
          else if (t === 'extension') { mean = '무릎을 강하게 펴며(순신전 ' + (R.kneeNetExt || '–') + '°·신전속도 ' + (R.kneeExtVelPeak || '–') + '°/s) 수직 지면반력과 신전 파워를 골반 회전으로 전달합니다'; imp = '신전 직후 골반 회전 가속이 바로 이어지도록 타이밍을 유지합니다'; }
          else if (t === 'hybrid') { mean = '초반에는 무릎을 단단히 버틴 뒤 신전으로 추가 전달을 만드는 패턴입니다'; imp = '버팀→신전 전환 타이밍과 신전 파워를 유지·강화합니다'; }
          else { mean = '무릎 각도를 크게 바꾸지 않고(순변화 ' + (R.kneeNetExt || '–') + '°) 단단한 지지대로 버티며 지면 힘을 골반 회전으로 전달합니다'; imp = '현재 버팀 패턴을 유지하며 VGRF plateau 안정성을 지킵니다'; }
          return ['리드 무릎은 ' + (KNEE_KO[t] || '–') + '으로, 굴곡각 FC ' + (R.kneeAngFC || '–') + '°→BR ' + (R.kneeAngBR || '–') + '°(클수록 굽힘), VGRF ' + (R.vgrfPeak || '–') + '%BW를 골반으로 전달하는 관문입니다', mean, imp];
        })(),
        pelvistrunk: ['골반 회전이 몸통으로 ' + (R.trunkOverPelvisGain || '–') + '배 증폭되며 타이밍 gap은 ' + (R.gapPelvisToTrunkVel == null ? '–' : R.gapPelvisToTrunkVel + 'ms') + '입니다', '골반 에너지가 몸통으로 잘 넘어가야 가장 큰 에너지를 만드는 몸통이 충분히 가속됩니다', '골반 peak 이후 몸통 회전이 적절한 시간차로 이어지도록 합니다'],
        trunk: ['몸통 역학에너지 peak ' + (R.trunkEpeak || '–') + 'J로 투구에서 가장 큰 에너지를 만드는 분절입니다', '이 에너지가 팔로 잘 넘어가야 빠른 공이 됩니다', '몸통 에너지 생성이 낮으면 회전·굴곡 파워를 키웁니다'],
        trunkarm: ['몸통 에너지 방출과 팔 에너지 상승의 겹침(Handoff overlap)은 ' + (R.trunkArmOverlap == null ? '–' : R.trunkArmOverlap) + ', Arm Self-Reliance는 ' + (R.armSelfReliance == null ? '–' : R.armSelfReliance) + '입니다', 'overlap이 낮거나 몸통E→어깨 내회전 타이밍(' + (R.gapTrunkEtoShoulderIR == null ? '–' : R.gapTrunkEtoShoulderIR + 'ms') + ')이 길면 몸통 에너지가 팔로 못 넘어가 팔이 스스로 힘을 더 씁니다', '몸통 peak 이후 어깨 내회전이 자연스럽게 이어지도록 trunk-arm 시퀀싱을 개선합니다'],
        armball: ['손속도 peak가 릴리스(BR) 대비 ' + (R.gapHandToBR == null ? '–' : R.gapHandToBR + 'ms') + ', 팔꿈치 토크 ' + (R.elbowTorque || '–') + 'N·m입니다', '몸통 전달이 약하면 팔 자체 생성이 늘어 팔꿈치·어깨 부담이 커집니다', '팔 힘을 더 쓰기보다 몸통→팔 전달을 개선해 같은 구속에서 부담을 줄입니다']
      };
      return m[n] || null;
    }
    var stages = N.map(function (n) { var s = nar(n.key); return { key: n.key, label: n.label, tag: n.tag, status: n.status, score: n.score, rep: n.rep, kneeType: n.kneeType || null, vgrfPattern: n.vgrfPattern || null, story: s ? { measure: s[0], meaning: s[1], improve: s[2] } : null }; });

    // 강점/약점 + 핵심 진단 한 문장
    var goods = stages.filter(function (s) { return s.status === 'good'; });
    var genGood = goods.filter(function (s) { return s.tag === 'gen' || s.tag === 'store'; });
    var top = bn[0];
    var headline;
    if (top) {
      var strongTxt = genGood.length ? (genGood.map(function (s) { return s.label.replace(/ \(.*\)/, ''); }).slice(0, 2).join('·') + ' 에너지는 잘 만들지만') : '에너지 생성은 일정 수준이지만';
      headline = '이 투수는 ' + strongTxt + ', ' + top.label.replace(/ \(.*\)/, '') + ' 단계에서 ' + (top.status === 'leak' ? '에너지 전달 누수가' : '비효율이') + ' 나타나 구속 향상이 제한되는 패턴입니다.';
    } else {
      headline = '이 투수는 저장·생성·전달 단계가 전반적으로 양호하여 큰 병목 없이 에너지가 흐르는 패턴입니다.';
    }

    // (상세 모듈 windupL~armBallL 은 위 9단계 점수 일원화 단계에서 이미 계산됨)
    var _ret0 = {
      version: 'etdiag-v1',
      player: DATA.player,
      measured_kmh: DATA.measured_kmh,
      rep: R,
      all: allR,
      stages: stages,
      bottlenecks: bn,
      headline: headline,
      windup: windupL,
      stride: strideL,
      xftiming: xftimingL,
      blocking: blockingL,
      knee5: knee5L,
      pelvistrunk6: pelvisTrunkL,
      trunk7: trunkEL,
      trunkarm8: trunkArmL,
      armball9: armBallL,
      consistency: consistency,
      confidence: conf,
      validAdj: _vadj,
      tags: TAG
    };
    try { _ret0.injuryLoad = injuryFromDiagnosis(_ret0); } catch (e) { _ret0.injuryLoad = null; }
    try { _ret0.powerSeq = powerSequence(DATA, rep, R); } catch (e) { _ret0.powerSeq = null; }
    try { _ret0.trunkSplit = trunkEnergySplit(rep, mass, (DATA.player && DATA.player.height_m) || 1.8); } catch (e) { _ret0.trunkSplit = null; }
    return _ret0;
  }

  // ══ 와인드업 로딩 평가 (개발문서 v1) ══
  var WINDUP_TYPE_KO = { functional: '잘 모은형', under_loaded: '힘 모으기 부족형', loaded_not_converted: '모으고 못 살린형', early_open: '너무 일찍 열림형', forward_only: '앞으로만 간형', preserved_delayed: '지키지만 회전 늦은형' };
  function windupLoading(t, mass, RHP, R) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br, iMER = e.i_mer;
    if (iFC == null || iBR == null) return null;
    var g = 9.81, BW = mass * g;
    function relMs(i) { return (i == null) ? null : Math.round((i - iFC) * dt * 1000); }
    function valAt(a, i) { return (a && isFinite(a[i])) ? a[i] : null; }
    // 골반 닫힘 — 닫힘=양수 신호(우투 pz / 좌투 −pz), 셋업(투구 시작) 기준
    var pz = S.Pelvis_Angle_Z || [];
    // 닫힘 방향 자동 판별 — RHP 부호 가정 제거(좌완 골반 닫힘 null 버그 수정 2026-06-01).
    //  좌/우는 raw 회전 방향이 반대지만 이 export 는 정규화 여부가 파일마다 달라, 부호 가정 대신
    //  두 부호 각각 '닫힘(코일, KH 근처 max) − 열림(FC 후 min)' 범위를 계산해 더 큰(=실제 코일→방출) 쪽을 닫힘 방향으로 택한다.
    //  절대값이 아니라 방향(부호) 선택이며, 좌완은 이 판별로 우완과 반대 부호가 잡힌다.
    var setupRaw = (function () { var s = 0, n = 0, hi = Math.min(15, iKH); for (var i = 0; i <= hi && i < pz.length; i++) { if (isFinite(pz[i])) { s += pz[i]; n++; } } return n ? s / n : (isFinite(pz[iKH]) ? pz[iKH] : 0); })();
    function _clRange(sign) { var cs = pz.map(function (v) { return isFinite(v) ? sign * v : NaN; }); var cv = peak(cs, Math.max(0, iKH - 40), iFC, 'max').v, ov = peak(cs, iFC, iBR, 'min').v; return (cv != null && ov != null) ? (cv - ov) : -Infinity; }
    var _csign = (_clRange(1) >= _clRange(-1)) ? 1 : -1;   // 닫힘→열림 범위가 큰 부호 = 실제 닫힘(코일) 방향
    var clSig = pz.map(function (v) { return isFinite(v) ? (_csign * v) : NaN; });
    var setupV = _csign * setupRaw;
    function closure(i) { var v = (clSig[i]); return isFinite(v) ? (v - setupV) : null; }  // 셋업 대비 닫힘 excursion(+)
    // Hip Hinge: def B(뒷고관절 sit, setup~KH 로딩) + def A(몸통-골반 상대 전굴). KH~FC 급등은 아티팩트라 제외.
    var hh = S.Back_Hip_Angle_X || [];
    var mhhB = peak(hh, 0, iKH, 'max'), sitPeak = mhhB.v, iMHH = mhhB.i, hhFC = valAt(hh, iFC);   // def B
    var hhPeak = sitPeak;                                                                          // 로딩 판정/점수 기준
    var hhRelV = r1(peak((deriv(hh, dt) || []).map(function (x) { return -x; }), (iMHH == null ? 0 : iMHH), iFC, 'max').v);
    var tx = S.Trunk_Angle_X || [], pxx = S.Pelvis_Angle_X || [];                                  // def A: 몸통-골반 상대 전굴
    var relA = tx.map(function (v, i) { return (isFinite(v) && isFinite(pxx[i])) ? (v - pxx[i]) : NaN; });
    var mhhA = peak(relA, 0, iFC, 'max'), aPeak = mhhA.v, aFC = valAt(relA, iFC);
    var aRet = (aPeak && aPeak > 3 && aFC != null) ? Math.max(0, Math.round(aFC / aPeak * 100)) : null;
    // Pelvic Closure — 가장 닫힌 값(setup~FC) 대비 FC까지 열린 비율(상대 범위, X-factor 방식)
    var mpcP = peak(clSig, Math.max(0, iKH - 40), iFC, 'max'), iMPC = mpcP.i, closedVal = mpcP.v;
    var openVal = peak(clSig, iFC, iBR, 'min').v, fcVal = (isFinite(clSig[iFC]) ? clSig[iFC] : null);
    var clPeak = (closedVal != null && setupV != null) ? (closedVal - setupV) : null;            // 셋업→최대닫힘 excursion(°)
    var clOpenedByFC = (closedVal != null && fcVal != null && openVal != null && (closedVal - openVal) > 1) ? Math.max(0, Math.min(100, Math.round((closedVal - fcVal) / (closedVal - openVal) * 100))) : null;
    var clRet = (clOpenedByFC != null) ? (100 - clOpenedByFC) : null;                             // FC까지 닫힘 보존율(%)
    var clFC = (fcVal != null && setupV != null) ? (fcVal - setupV) : null;
    var clVel = deriv(clSig, dt) || [];                                                            // +면 더 닫힘, −면 열림
    var openOnset = null; var need1 = Math.max(1, Math.round(0.03 / dt)); for (var i = (iMPC == null ? iKH : iMPC); i <= iFC - need1; i++) { var ok = true; for (var k = 0; k < need1; k++) { if (!(clVel[i + k] < -30)) { ok = false; break; } } if (ok) { openOnset = i; break; } }
    var openVelPre = r1(peak(clVel.map(function (x) { return -x; }), (iMPC == null ? iKH : iMPC), iFC, 'max').v);
    // X-factor (rawTrial 재사용)
    var xfPeak = R.xfPeak, xfAtFC = R.xfAtFC, xfRelByFC = R.xfReleasedByFC, xfRelStart = R.tXfReleaseStart, xfRelV = R.xfReleasePeakVel;
    // Rear Hip ER (Back_Hip_Angle_Z 회전 프록시) + 양의 일
    var rer = S.Back_Hip_Angle_Z || [];
    var mrher = peak(rer.map(function (x) { return Math.abs(x); }), iKH, iFC, 'max'), rerPeak = r1(mrher.v), iMRHER = mrher.i;
    var rhPos = r1(integ(S.Back_Hip_Power_X, iKH, iFC, dt, 1));
    // Rear Foot Mz (FP1_Z_3): 코일(닫힘)=우투 음수(꼬임=−) → 코일 +. 코일=setup~KH, 열림(드라이브)=KH~FC.
    var mz = S.FP1_Z_3 || [];
    var cloArr = new Array(mz.length); for (var i = 0; i < mz.length; i++) { var v = valAt(mz, i); cloArr[i] = (v == null) ? null : (RHP ? -v : v); }
    var mzCoilImp = r1(integ(cloArr, 0, iKH, dt, 1));                                  // 코일(닫힘) 임펄스 (setup~KH, +)
    var mzCoilPk = r1(peak(cloArr, 0, iKH, 'max').v);                                   // 코일 토크 peak (=freeMo류)
    var _mzOpenDrive = integ(cloArr, iKH, iFC, dt, -1); var mzOpenImpDrive = (_mzOpenDrive == null ? null : r1(Math.abs(_mzOpenDrive)));  // 열림/드라이브 (KH~FC, −부분 크기)
    var mzClosePk = peak(cloArr, 0, iKH, 'max'), mzDC = null; if (mzClosePk.i != null) { for (var i = mzClosePk.i; i <= iFC && i < cloArr.length; i++) { if (cloArr[i] != null && cloArr[i] < 0) { mzDC = i; break; } } }
    // AP 추진(FP1_Y) 임펄스
    var ap = S.FP1_Y || []; var _pi = integ(ap.map(function (x) { return Math.abs(x); }), iKH, iFC, dt, 0); var propImpPct = (_pi == null ? null : r2(_pi / BW * 100));
    // Loading → Stride
    var cv = S.COM_Velocity_Y || [];
    var comVelFC = (isFinite(cv[iFC]) ? Math.abs(cv[iFC]) : null), comVelPk = peak(cv.map(function (x) { return Math.abs(x); }), iKH, iFC, 'max');
    var comKEFC = (comVelFC != null) ? Math.round(0.5 * mass * comVelFC * comVelFC) : null;
    var so = null; var need2 = Math.max(1, Math.round(0.05 / dt)); for (var i = iKH; i <= iFC - need2; i++) { var ok2 = true; for (var k = 0; k < need2; k++) { if (!(Math.abs(cv[i + k]) > 0.15)) { ok2 = false; break; } } if (ok2) { so = i; break; } }
    // Preload → Post-FC Pelvis Rotation
    var pv = S.Pelvis_Ang_Vel_Z || [], pAcc = deriv(pv.map(function (x) { return Math.abs(x); }), dt) || [];
    var iPPA = peak(pAcc, iFC, iBR, 'max').i, iPBG = peak((S.FP2_Y || []).map(function (x) { return Math.abs(x); }), iFC, iBR, 'max').i, iPVGRF = peak((S.FP2_Z || []).map(function (x) { return Math.abs(x); }), iFC, iBR, 'max').i;
    var dtPBGtoPPA = (iPBG != null && iPPA != null) ? Math.round((iPPA - iPBG) * dt * 1000) : null, dtFCtoPPA = relMs(iPPA);
    // 점수(임계 기반)
    function bnd(v, good, cau, hi) { if (v == null) return null; var ok = hi ? v >= good : v <= good, mid = hi ? v >= cau : v <= cau; return ok ? 88 : (mid ? 64 : 40); }
    var sub = { hipHinge: bnd(sitPeak, 27, 18, true), pelvicClosure: bnd(clRet, 60, 40, true), xftiming: bnd(xfRelByFC, 10, 25, false), rearHip: bnd(rhPos, 15, 6, true), rearFoot: bnd(mzCoilPk, 9, 5, true), strideConv: bnd(comVelFC, 2.9, 2.6, true), preload: null };
    sub.preload = (function () { var a = (clRet != null ? (clRet >= 60 ? 1 : clRet >= 40 ? 0.6 : 0.3) : 0.5), b = (xfRelByFC != null ? (xfRelByFC <= 10 ? 1 : xfRelByFC <= 25 ? 0.6 : 0.3) : 0.5), c = (dtFCtoPPA != null && dtFCtoPPA > 0 && dtFCtoPPA <= 80 ? 1 : (dtFCtoPPA != null && dtFCtoPPA <= 0 ? 0.3 : 0.6)); return Math.round((a + b + c) / 3 * 88); })();
    var earlyPen = 0; if (xfRelByFC != null && xfRelByFC > 25) earlyPen += 8; if (clRet != null && clRet < 40) earlyPen += 8; if (pc_openOnsetEarly(openOnset, iKH, iFC)) earlyPen += 6;
    function pc_openOnsetEarly(oo, kh, fc) { return (oo != null && fc != null && kh != null && oo < (kh + (fc - kh) * 0.5)); }  // 골반 열림이 스트라이드 전반부에 시작 = 조기
    var Wt = { hipHinge: 0.15, pelvicClosure: 0.15, xftiming: 0.15, rearHip: 0.15, rearFoot: 0.10, strideConv: 0.15, preload: 0.15 }, comp = 0, wsum = 0;
    for (var k in Wt) { if (sub[k] != null) { comp += sub[k] * Wt[k]; wsum += Wt[k]; } } comp = wsum ? Math.max(0, Math.round(comp / wsum - earlyPen)) : null;
    // 로딩 유형
    var loaded = (hhPeak != null && hhPeak >= 18) && (clPeak != null && clPeak >= 20), type;
    if (clRet != null && clRet < 45 && xfRelByFC != null && xfRelByFC > 25) type = 'early_open';
    else if (comVelFC != null && comVelFC >= 2.9 && clRet != null && clRet < 50) type = 'forward_only';
    else if (loaded && comVelFC != null && comVelFC < 2.6) type = 'loaded_not_converted';
    else if (!loaded) type = 'under_loaded';
    else if (clRet != null && clRet >= 55 && (xfRelByFC == null || xfRelByFC <= 15) && dtPBGtoPPA != null && dtPBGtoPPA > 60) type = 'preserved_delayed';
    else type = 'functional';
    var made = loaded ? '힙힌지와 골반 닫힘으로 회전에 쓸 힘을 충분히 모았고' : '하체·골반에 힘을 충분히 모으지 못했고';
    var issue;
    if (type === 'early_open') issue = '착지 전에 골반 닫힘(' + (clRet == null ? '–' : clRet + '% 유지') + ')과 몸통 꼬임(' + (xfRelByFC == null ? '–' : xfRelByFC + '% 풀림') + ')이 빨리 풀려 착지 후 골반 회전에 쓸 힘이 부족한';
    else if (type === 'forward_only') issue = '앞으로 가는 힘(착지 시 ' + (comVelFC == null ? '–' : r2(comVelFC) + 'm/s') + ')은 만들지만 골반 닫힘 유지(' + (clRet == null ? '–' : clRet + '%') + ')가 낮아 회전에 쓸 힘이 부족한';
    else if (type === 'loaded_not_converted') issue = '힘은 모았지만 앞으로 가는 속도(착지 시 ' + (comVelFC == null ? '–' : r2(comVelFC) + 'm/s') + ')로 잘 이어지지 못하는';
    else if (type === 'under_loaded') issue = '힘 모으기에서 충분한 힘을 만들지 못하는';
    else if (type === 'preserved_delayed') issue = '모은 힘은 착지까지 잘 지키지만 착지 후 골반 회전이 시작되기까지(' + (dtPBGtoPPA == null ? '–' : dtPBGtoPPA + 'ms') + ') 늦는';
    else issue = '힘을 잘 모으고 지켜 앞으로 나가기와 착지 후 골반 회전으로 잘 이어지는';
    var summary = '이 투수는 힘 모으기에서 ' + made + ', ' + issue + ' 패턴입니다.';
    return {
      events: { KH: relMs(iKH), SO: relMs(so), MHH: relMs(iMHH), MPC: relMs(iMPC), MRHER: relMs(iMRHER), MzDC: relMs(mzDC), FC: 0, PBG: relMs(iPBG), PVGRF: relMs(iPVGRF), PPA: relMs(iPPA), BR: relMs(iBR),
        idx: { KH: iKH, SO: so, MHH: iMHH, MPC: iMPC, MRHER: iMRHER, MzDC: mzDC, FC: iFC, PBG: iPBG, PVGRF: iPVGRF, PPA: iPPA, BR: iBR } },
      hipHinge: { rearHipSitPeak: r1(sitPeak), atFC: r1(hhFC), trunkPelvisPeak: r1(aPeak), trunkPelvisAtFC: r1(aFC), trunkPelvisRetainedPct: aRet, releaseVelPeak: hhRelV },
      pelvicClosure: { peak: r1(clPeak), atFC: r1(clFC), retainedPct: clRet, openedByFCpct: clOpenedByFC, openingOnsetMs: relMs(openOnset), openingVelPreFC: openVelPre },
      xfactor: { peak: xfPeak, atFC: xfAtFC, releasedByFC: xfRelByFC, releaseStartMs: xfRelStart, releasePeakVel: xfRelV },
      rearHipER: { peak: rerPeak, posWork: rhPos },
      rearFootMz: { coilImpulse: mzCoilImp, coilPeak: mzCoilPk, openImpulseDrive: mzOpenImpDrive, dirChangeMs: relMs(mzDC) },
      conversion: { comVelAtFC: r2(comVelFC), comVelPeak: r2(comVelPk.v), comKEatFC: comKEFC, propImpulsePct: propImpPct },
      preload: { pelvisAccPeakMs: dtFCtoPPA, dtPBGtoPPA: dtPBGtoPPA, retainedPct: clRet, releasedByFC: xfRelByFC },
      sub: sub, composite: comp, type: type, typeKo: WINDUP_TYPE_KO[type] || type, summary: summary
    };
  }

  // ══ 스트라이드 단계 평가 (개발문서 v1) ══  (AP=프레임 index2, ML=index0, up=index1)
  var STRIDE_TYPE_KO = { functional: '잘 나간형', under_stride: '앞으로 가는 힘 부족형', momentum_only: '앞으로만·일찍 열림형', loaded_not_propelled: '모으고 못 민형', overstride: '너무 멀리·멈춤 지연형', lateral_leak: '옆으로 새는형', unstable_landing: '착지 불안정형' };
  function strideEval(t, mass, RHP, R, W, heightM) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br;
    if (iFC == null || iBR == null) return null;
    var g = 9.81, BW = mass * g, htmm = (heightM || 1.8) * 1000;
    var iSO = (W && W.events && W.events.idx && W.events.idx.SO != null) ? W.events.idx.SO : iKH;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    function va(a, i) { return (a && isFinite(a[i])) ? a[i] : null; }
    var fr = t.frames || [];
    function jt(i, k, ax) { var f = fr[i]; return (f && f[k] && isFinite(f[k][ax])) ? f[k][ax] : null; }
    function sd(a) { a = a.filter(function (x) { return x != null && isFinite(x); }); if (a.length < 2) return null; var m = a.reduce(function (p, c) { return p + c; }, 0) / a.length; return Math.sqrt(a.reduce(function (p, c) { return p + (c - m) * (c - m); }, 0) / a.length); }
    // 1 뒷다리 추진
    var ap = S.FP1_Y || []; var iRPGP = peak(ap.map(function (x) { return Math.abs(x); }), iSO, iFC, 'max').i;
    var _pi = integ(ap.map(function (x) { return Math.abs(x); }), iSO, iFC, dt, 0); var propImpPct = _pi == null ? null : r2(_pi / BW * 100);
    var wh = integ(S.Back_Hip_Power_X, iSO, iFC, dt, 1), wk = integ(S.Back_Knee_Power_X, iSO, iFC, dt, 1);
    var rearWork = (wh == null && wk == null) ? null : r1((wh || 0) + (wk || 0));
    // 2 COM 운동량
    var cv = S.COM_Velocity_Y || []; var velSO = va(cv, iSO), velFC = va(cv, iFC); velSO = velSO == null ? null : Math.abs(velSO); velFC = velFC == null ? null : Math.abs(velFC);
    var cpk = peak(cv.map(function (x) { return Math.abs(x); }), iSO, iFC, 'max'); var iCFVP = cpk.i, velPeak = r2(cpk.v);
    var velGain = (velSO != null && velFC != null) ? r2(velFC - velSO) : null, momFC = velFC != null ? Math.round(mass * velFC) : null;
    // 3 KE
    var keFC = velFC != null ? Math.round(0.5 * mass * velFC * velFC) : null, kePeak = cpk.v != null ? Math.round(0.5 * mass * cpk.v * cpk.v) : null;
    // 4 기하 — [2026-06-01 FIX] 발끝-발끝(toe) 수평거리 우선(관용 정의). 없으면 CoP.
    var stride_m = (t.grf_metrics && (t.grf_metrics.stride_toe_m != null ? t.grf_metrics.stride_toe_m : t.grf_metrics.stride_cop_m)) || null;
    if (stride_m != null && stride_m > 10) stride_m = stride_m / 1000; // [FIX 2026-06-01] 좌표 단위 혼재(mm로 들어오는 데이터) 방어 → m로 정규화
    var strideLenPct = stride_m != null ? r1(stride_m / (heightM || 1.8) * 100) : null;
    var lt0 = jt(iFC, 'l_toe', 0), rt0 = jt(iFC, 'r_toe', 0); var widthPct = (lt0 != null && rt0 != null) ? r1(Math.abs(lt0 - rt0) / htmm * 100) : null;
    var dML = (jt(iFC, 'com', 0) != null && jt(iSO, 'com', 0) != null) ? (jt(iFC, 'com', 0) - jt(iSO, 'com', 0)) : null;
    var dAP = (jt(iFC, 'com', 2) != null && jt(iSO, 'com', 2) != null) ? (jt(iFC, 'com', 2) - jt(iSO, 'com', 2)) : null;
    var dirErr = (dML != null && dAP != null && Math.abs(dAP) > 1) ? r1(Math.atan2(Math.abs(dML), Math.abs(dAP)) * 180 / Math.PI) : null;
    // 5 방향·밸런스
    var mlArr = [], hdArr = [], plen = 0, prevx = null, prevy = null;
    for (var i = iSO; i <= iFC && i < fr.length; i++) { var cm0 = jt(i, 'com', 0), cm2 = jt(i, 'com', 2); if (cm0 != null) mlArr.push(cm0); var hd = jt(i, 'head', 0); if (hd != null) hdArr.push(hd); if (cm0 != null && cm2 != null) { if (prevx != null) plen += Math.sqrt((cm0 - prevx) * (cm0 - prevx) + (cm2 - prevy) * (cm2 - prevy)); prevx = cm0; prevy = cm2; } }
    var comMLsd = r1(sd(mlArr)), headMLsd = r1(sd(hdArr));
    var sdx = (jt(iFC, 'com', 0) != null && jt(iSO, 'com', 0) != null) ? jt(iFC, 'com', 0) - jt(iSO, 'com', 0) : 0, sdy = (jt(iFC, 'com', 2) != null && jt(iSO, 'com', 2) != null) ? jt(iFC, 'com', 2) - jt(iSO, 'com', 2) : 0;
    var straight = Math.sqrt(sdx * sdx + sdy * sdy); var pathCurv = (straight > 1 && plen > 0) ? r2(plen / straight) : null;
    // 6 착지 준비
    var comLeadAP = (jt(iFC, 'l_toe', 2) != null && jt(iFC, 'com', 2) != null) ? Math.round(jt(iFC, 'l_toe', 2) - jt(iFC, 'com', 2)) : null;
    var leadKneeFC = va(S.Lead_Knee_Angle_X, iFC); leadKneeFC = leadKneeFC == null ? null : r1(leadKneeFC);
    var nApp = Math.max(1, Math.round(0.015 / dt)), avv = null; if (fr[iFC] && fr[iFC - nApp]) { var d2 = jt(iFC, 'l_toe', 2) - jt(iFC - nApp, 'l_toe', 2), d1 = (jt(iFC, 'l_toe', 1) || 0) - (jt(iFC - nApp, 'l_toe', 1) || 0); if (isFinite(d2)) avv = Math.round(Math.sqrt(d2 * d2 + d1 * d1) / (nApp * dt) / 1000 * 100) / 100; }
    var iPBG = peak((S.FP2_Y || []).map(function (x) { return Math.abs(x); }), iFC, iBR, 'max').i; var dtFCtoPBG = relMs(iPBG);
    var peakBrake = iPBG != null ? r1(Math.abs((S.FP2_Y || [])[iPBG]) / BW * 100) : null;
    // 7 로딩 보존 브리지 (X-factor·windup)
    var thoraxOpenFC = va(S.Thorax_Ang_Vel_Z, iFC); thoraxOpenFC = thoraxOpenFC == null ? null : r1(Math.abs(thoraxOpenFC));
    var bridge = { pelvicClosureRetained: (W && W.pelvicClosure) ? W.pelvicClosure.retainedPct : null, hipHingeRetained: (W && W.hipHinge) ? W.hipHinge.trunkPelvisRetainedPct : null,
      xfAtFC: R.xfAtFC, xfReleasedByFC: R.xfReleasedByFC, xfReleaseStartMs: R.tXfReleaseStart, thoraxOpenVelFC: thoraxOpenFC };
    // 점수
    function bnd(v, good, cau, hi) { if (v == null) return null; var ok = hi ? v >= good : v <= good, mid = hi ? v >= cau : v <= cau; return ok ? 88 : (mid ? 64 : 40); }
    function rng(v, lo, hi) { if (v == null) return null; if (v >= lo && v <= hi) return 88; var d = v < lo ? lo - v : v - hi; return d <= (hi - lo) * 0.5 ? 64 : 42; }
    // [2026-06-01 FIX] comMom 양호 임계 2.9는 기준 p75(2.8)보다 높아 중앙값 이상도 주의로 떨어졌음 → 기준 중앙 2.7 기준으로 보정.
    var sub = { rearProp: bnd(propImpPct, 27, 22, true), comMom: bnd(velFC, 2.7, 2.6, true), comKE: bnd(keFC, 500, 420, true), geometry: rng(strideLenPct, 80, 95), dirBalance: bnd(dirErr, 8, 15, false), landing: bnd((dtFCtoPBG == null ? null : Math.abs(dtFCtoPBG)), 70, 110, false) };
    // [2026-06-01 FIX] '전진 운동량'은 COM 운동량(=질량×속도) 중심으로 — COM 전진속도(comMom)를 주축(0.70)으로,
    //   노이즈 큰 뒷다리 임펄스(rearProp)·미보정 comKE 는 보조(0.15/0.15). (COM 속도 양호인데 노드 누수 모순 해소)
    var momScore = (function () { var w = { rearProp: 0.15, comMom: 0.70, comKE: 0.15 }, s = 0, ws = 0; for (var k in w) { if (sub[k] != null) { s += sub[k] * w[k]; ws += w[k]; } } return ws ? Math.round(s / ws) : null; })();
    // 유형
    var loadedGood = (W && W.composite != null && W.composite >= 62);
    var earlyOpen = (bridge.xfReleasedByFC != null && bridge.xfReleasedByFC > 25) || (bridge.pelvicClosureRetained != null && bridge.pelvicClosureRetained < 45);
    var type;
    if (dirErr != null && dirErr > 15 || (comMLsd != null && comMLsd > 80)) type = 'lateral_leak';
    else if (strideLenPct != null && strideLenPct > 100 && comLeadAP != null && comLeadAP > 250 && dtFCtoPBG != null && dtFCtoPBG > 70) type = 'overstride';
    else if (keFC != null && keFC >= 480 && earlyOpen) type = 'momentum_only';
    else if (velFC != null && velFC < 2.6 && (keFC == null || keFC < 420)) type = 'under_stride';
    else if (loadedGood && velFC != null && velFC < 2.7 && (propImpPct == null || propImpPct < 24)) type = 'loaded_not_propelled';
    else if ((pathCurv != null && pathCurv > 1.3) || (comMLsd != null && comMLsd > 60)) type = 'unstable_landing';
    else type = 'functional';
    // 요약
    var made = (velFC != null && velFC >= 2.8) ? '충분히 앞으로 가는 힘(착지 시 ' + r2(velFC) + 'm/s)' : '앞으로 가는 힘(착지 시 ' + (velFC == null ? '–' : r2(velFC) + 'm/s') + ')';
    var issue;
    if (type === 'lateral_leak') issue = '앞으로 가는 힘이 홈 방향이 아니라 좌우로 흩어져(방향 오차 ' + (dirErr == null ? '–' : dirErr + '°') + ') 앞발 멈춤·회전 전달 효율이 낮아질 수 있는';
    else if (type === 'overstride') issue = '보폭은 크지만(키 대비 ' + (strideLenPct == null ? '–' : strideLenPct + '%') + ') 몸 중심이 앞발보다 뒤에 남아 앞발 멈춤으로 넘어가기(착지→브레이크 ' + (dtFCtoPBG == null ? '–' : dtFCtoPBG + 'ms') + ')가 늦는';
    else if (type === 'momentum_only') issue = '앞으로 가는 힘은 만들지만 나가는 동안 몸통 꼬임(' + (bridge.xfReleasedByFC == null ? '–' : bridge.xfReleasedByFC + '% 풀림') + ')·골반 닫힘(유지 ' + (bridge.pelvicClosureRetained == null ? '–' : bridge.pelvicClosureRetained + '%') + ')이 먼저 풀려 회전에 쓸 힘을 지키지 못하는';
    else if (type === 'under_stride') issue = '앞으로 가는 힘·보폭이 부족해 앞발 멈춤·회전에 쓸 힘이 부족한';
    else if (type === 'loaded_not_propelled') issue = '힘 모으기는 했지만 뒷다리 밀기·앞으로 가는 속도로 잘 이어지지 못하는';
    else if (type === 'unstable_landing') issue = '착지 순간 몸 중심과 앞발 위치·착지 안정성이 흔들려 앞발 멈춤 자세를 만들기 어려운';
    else issue = '앞으로 가는 힘·방향·힘 보존·착지 준비가 비교적 균형 잡혀 앞발 멈춤으로 잘 이어지는';
    var summary = '이 투수는 앞으로 나가기에서 ' + made + '을 만들며, ' + issue + ' 패턴입니다.';
    return {
      events: { KH: relMs(iKH), SO: relMs(iSO), RPGP: relMs(iRPGP), CFVP: relMs(iCFVP), FC: 0, PBG: relMs(iPBG), BR: relMs(iBR),
        idx: { KH: iKH, SO: iSO, RPGP: iRPGP, CFVP: iCFVP, FC: iFC, PBG: iPBG, BR: iBR } },
      rearProp: { propImpulsePct: propImpPct, peakMs: relMs(iRPGP), positiveWork: rearWork },
      comMom: { velSO: r2(velSO), velFC: r2(velFC), velPeak: velPeak, velGain: velGain, momentumFC: momFC },
      comKE: { keFC: keFC, kePeak: kePeak },
      geometry: { strideLenPct: strideLenPct, widthPct: widthPct, dirErrorDeg: dirErr },
      balance: { comMLsd: comMLsd, headMLsd: headMLsd, pathCurvature: pathCurv },
      landing: { comToLeadFootAP: comLeadAP, leadKneeFlexFC: leadKneeFC, leadApproachVel: avv, dtFCtoPBG: dtFCtoPBG, peakBrakePct: peakBrake },
      bridge: bridge, sub: sub, momentumScore: momScore, type: type, typeKo: STRIDE_TYPE_KO[type] || type, summary: summary,
      pathTopView: (function () { var arr = []; for (var i = iSO; i <= Math.min(iBR, fr.length - 1); i++) { var c0 = jt(i, 'com', 0), c2 = jt(i, 'com', 2), l0 = jt(i, 'l_toe', 0), l2 = jt(i, 'l_toe', 2), r0 = jt(i, 'r_toe', 0), r2 = jt(i, 'r_toe', 2); if (c0 != null && c2 != null) arr.push([Math.round((i - iFC) * dt * 1000), Math.round(c0), Math.round(c2), l0 == null ? null : Math.round(l0), l2 == null ? null : Math.round(l2), r0 == null ? null : Math.round(r0), r2 == null ? null : Math.round(r2)]); } return arr; })()
    };
  }

  // ══ X-factor 타이밍 (개발문서 v1) — signed 기반 uncoiling ══
  var XF_TYPE_KO = { functional: '잘 꼬고 푼형', early_release: '분리 조기 해제형', big_early_loss: '크게 꼬고 일찍 잃은형', small_well_timed: '작지만 타이밍 좋은형', late_release: '늦게 푼형', no_effective_release: '분리 확보 여지형', pelvis_early_open: '골반 먼저 열린형', thorax_flying_open: '상체 조기 개방형' };
  function xfactorTiming(t, mass, RHP, R, W) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br;
    if (iFC == null || iBR == null) return null;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    var xs = t.x_factor || []; if (!xs.length) return null;
    // signed peak (|.| 최대) KH~BR
    var iPk = null, pkS = 0; for (var i = iKH; i <= iBR && i < xs.length; i++) { if (isFinite(xs[i]) && Math.abs(xs[i]) > Math.abs(pkS)) { pkS = xs[i]; iPk = i; } }
    var peakMag = r1(Math.abs(pkS)), sgn = pkS >= 0 ? 1 : -1;
    // [2026-06-05] SSOT = trial.x_factor (Trunk_wrt_Pelvis_Angle_Z 분절 Z축 상대회전)
    var segAxialPeak = peakMag;
    var atFC = (isFinite(xs[iFC])) ? xs[iFC] : null;
    var retained = (atFC != null && peakMag > 8) ? ((Math.sign(atFC) === Math.sign(pkS)) ? Math.max(0, Math.min(100, Math.round(Math.abs(atFC) / Math.abs(pkS) * 100))) : 0) : null;
    var released = retained == null ? null : (100 - retained);
    // uncoiling velocity (signed, peak 방향에서 0/반대로)
    var dxs = deriv(xs, dt) || []; var unc = dxs.map(function (d) { return isFinite(d) ? Math.max(0, -sgn * d) : 0; });
    // release start: peak 이후 unc>50 이 ~20ms 지속
    var need = Math.max(1, Math.round(0.02 / dt)), iXRS = null;
    if (iPk != null) { for (var i = iPk; i <= iBR - need; i++) { var ok = true; for (var k = 0; k < need; k++) { if (!(unc[i + k] > 50)) { ok = false; break; } } if (ok) { iXRS = i; break; } } }
    var xrp = peak(unc, (iXRS == null ? iPk : iXRS), iBR, 'max'); var iXRPV = xrp.i, relPeakVel = r1(xrp.v);
    var relArea = r1(integ(unc, (iXRS == null ? iFC : iXRS), iBR, dt, 1));
    // 블로킹·몸통·팔 이벤트
    var iPBG = peak((S.FP2_Y || []).map(function (x) { return Math.abs(x); }), iFC, iBR, 'max').i;
    var iPVGRF = peak((S.FP2_Z || []).map(function (x) { return Math.abs(x); }), iFC, iBR, 'max').i;
    var iTEP = peak(S.Trunk_ME_X || [], iFC, iBR, 'max').i;
    var iSIRP = peak((S.Pitching_Shoulder_Ang_Vel_Z || []).map(function (x) { return Math.abs(x); }), iFC, iBR, 'max').i;
    var dPBGtoXRS = (iPBG != null && iXRS != null) ? Math.round((iXRS - iPBG) * dt * 1000) : null;
    var dXRPVtoTEP = (iTEP != null && iXRPV != null) ? Math.round((iTEP - iXRPV) * dt * 1000) : null;
    var dXRPVtoSIRP = (iSIRP != null && iXRPV != null) ? Math.round((iSIRP - iXRPV) * dt * 1000) : null;
    var thoraxOpenFC = isFinite((S.Thorax_Ang_Vel_Z || [])[iFC]) ? r1(Math.abs(S.Thorax_Ang_Vel_Z[iFC])) : null;
    var pelvisOpenFC = isFinite((S.Pelvis_Ang_Vel_Z || [])[iFC]) ? r1(Math.abs(S.Pelvis_Ang_Vel_Z[iFC])) : null;
    var clRet = (W && W.pelvicClosure) ? W.pelvicClosure.retainedPct : null;
    var tXRS = relMs(iXRS), tXRPV = relMs(iXRPV);
    // Flying Open risk
    var foPts = 0; if (released != null && released > 25) foPts++; if (tXRS != null && tXRS < -25) foPts++; if (thoraxOpenFC != null && thoraxOpenFC > 600) foPts++; if (clRet != null && clRet < 45) foPts++;
    var foRisk = foPts >= 3 ? 'High' : (foPts >= 1 ? 'Moderate' : 'Low');
    // 점수
    function bnd(v, good, cau, hi) { if (v == null) return null; var ok = hi ? v >= good : v <= good, mid = hi ? v >= cau : v <= cau; return ok ? 88 : (mid ? 64 : 40); }
    var sRetention = bnd(retained, 70, 50, true);
    var sReleaseStart = (tXRS == null) ? null : ((tXRS >= -5 && tXRS <= 30) ? 88 : ((tXRS >= -25 && tXRS <= 50) ? 64 : 40));
    var sReleaseVel = bnd(relPeakVel, 320, 250, true); // [2026-05-28] X-factor=분절 상대각(S) 재정의로 풀림속도 스케일 ~½ → 상동고 분포(med330·q1269·q3412)에 맞춰 700/450→320/250 재보정
    var sBlockSync = (dPBGtoXRS == null) ? null : ((dPBGtoXRS >= -5 && dPBGtoXRS <= 45) ? 88 : ((dPBGtoXRS >= -25 && dPBGtoXRS <= 70) ? 64 : 40));
    var sTrunkBridge = (dXRPVtoTEP == null) ? null : ((Math.abs(dXRPVtoTEP) <= 40) ? 88 : (Math.abs(dXRPVtoTEP) <= 80 ? 64 : 40));
    var foPenalty = foRisk === 'High' ? 14 : (foRisk === 'Moderate' ? 6 : 0);
    var W2 = { sRetention: 0.22, sReleaseStart: 0.28, sReleaseVel: 0.17, sBlockSync: 0.22, sTrunkBridge: 0.11 }, vals = { sRetention: sRetention, sReleaseStart: sReleaseStart, sReleaseVel: sReleaseVel, sBlockSync: sBlockSync, sTrunkBridge: sTrunkBridge }, tsc = 0, wsum = 0;
    for (var k in W2) { if (vals[k] != null) { tsc += vals[k] * W2[k]; wsum += W2[k]; } } var timingScore = wsum ? Math.max(0, Math.round(tsc / wsum - foPenalty)) : null;
    // 유형
    var type;
    if (pelvisOpenFC != null && pelvisOpenFC > 600 && clRet != null && clRet < 45) type = 'pelvis_early_open';
    else if (thoraxOpenFC != null && thoraxOpenFC > 650 && (released != null && released > 20 || (tXRS != null && tXRS < -10))) type = 'thorax_flying_open';
    else if ((released != null && released > 30) || (tXRS != null && tXRS < -30)) type = 'early_release';
    else if (peakMag != null && peakMag >= 38 && retained != null && retained < 60) type = 'big_early_loss'; // [2026-05-28] S 재정의: 55→38
    else if (peakMag != null && peakMag < 18 && relPeakVel != null && relPeakVel < 250) type = 'no_effective_release'; // S: 25/400→18/250
    else if (tXRS != null && tXRS > 45) type = 'late_release';  // 풀림 시작이 늦을 때만(Trunk_ME peak는 일찍 잡혀 신뢰 낮아 미사용)
    else if (peakMag != null && peakMag < 28 && retained != null && retained >= 75 && sReleaseStart === 88) type = 'small_well_timed';  // S: 40→28
    else type = 'functional';
    // 요약
    var pkTxt = (peakMag != null && peakMag >= 33) ? '몸통 꼬임 최대값은 충분(' + peakMag + '°)하지만' : '몸통 꼬임 최대값(' + peakMag + '°)은 크지 않지만';
    var issue;
    if (type === 'early_release' || type === 'thorax_flying_open' || type === 'pelvis_early_open') issue = '착지 전에 ' + (released == null ? '–' : released + '%') + '가 풀려(' + (type === 'pelvis_early_open' ? '골반이 먼저 돎' : type === 'thorax_flying_open' ? '상체가 먼저 열림' : '너무 일찍 열림') + ') 착지 후 땅 받치는 힘을 몸통 힘으로 키우기 어려운';
    else if (type === 'big_early_loss') issue = '크게 만든 꼬임이 착지까지 ' + (retained == null ? '–' : retained + '%') + '만 남아 회전 전달에 쓰지 못하는';
    else if (type === 'late_release') issue = '착지까지 잘 지키지만 푸는 시점(착지 ' + (tXRS == null ? '' : (tXRS >= 0 ? '+' : '') + tXRS + 'ms') + ')·몸통 힘 전환이 늦는';
    else if (type === 'no_effective_release') issue = '꼬임·풀림이 모두 약해 몸통 힘 생성이 제한되는';
    else if (type === 'small_well_timed') issue = '착지까지 ' + (retained == null ? '–' : retained + '%') + ' 지키고 앞발 멈춤 이후 풀려 크기보다 타이밍이 좋은';
    else issue = '착지까지 ' + (retained == null ? '–' : retained + '%') + ' 지키고 푸는 시점이 착지 ' + (tXRS == null ? '' : (tXRS >= 0 ? '+' : '') + tXRS + 'ms') + '로 앞발 멈춤 이후 몸통 힘으로 잘 이어지는';
    var summary = '이 투수는 ' + pkTxt + ', ' + issue + ' 패턴입니다.';
    return {
      events: { KH: relMs(iKH), MXF: relMs(iPk), XRS: tXRS, XRPV: tXRPV, FC: 0, PBG: relMs(iPBG), PVGRF: relMs(iPVGRF), TEP: relMs(iTEP), SIRP: relMs(iSIRP), BR: relMs(iBR),
        idx: { KH: iKH, MXF: iPk, XRS: iXRS, XRPV: iXRPV, FC: iFC, PBG: iPBG, PVGRF: iPVGRF, TEP: iTEP, SIRP: iSIRP, BR: iBR } },
      peakDeg: peakMag, peakSign: sgn, segAxialPeakDeg: segAxialPeak, tPeakMs: relMs(iPk), atFCdeg: atFC == null ? null : r1(atFC), retainedPct: retained, releasedPct: released,
      releaseStartMs: tXRS, releasePeakVel: relPeakVel, releasePeakVelMs: tXRPV, releaseArea: relArea,
      dPBGtoXRS: dPBGtoXRS, dXRPVtoTEP: dXRPVtoTEP, dXRPVtoSIRP: dXRPVtoSIRP,
      thoraxOpenVelFC: thoraxOpenFC, pelvisOpenVelFC: pelvisOpenFC, pelvicClosureRetained: clRet,
      flyingOpenRisk: foRisk, scores: vals, timingScore: timingScore, type: type, typeKo: XF_TYPE_KO[type] || type, summary: summary
    };
  }

  // ══ 블로킹 (개발문서 v1) — 전진 운동량을 앞발 AP 제동으로 멈춰 회전으로 전환 ══
  var BLOCK_TYPE_KO = { functional: '균형 잡힌 멈춤형', weak: '약한 멈춤형', late: '늦은 멈춤형', momentum_leak: '전진 힘 새는형', over_brake: '과하게 멈춰 흡수형', direction_leak: '방향 새는형', early_open_conflict: '너무 일찍 열림형' };
  // 상동고 20명 그룹 기준(median/q1/q3) — /tmp/ef/blknorm2.js, Normative_data 20명 대표 trial 산출(2026-05-27, n=20).
  // tFCtoPBG 만 raw 그룹(이른/늦은 블로커 이봉분포라 raw q3≈108ms) 대신 '이른 제동 목표창'을 사용(늦은 블로킹을 병목으로 잡기 위함).
  var BLK_NORM = {
    peakBrakePctBW: { med: 124, q1: 108, q3: 138 }, comDecel: { med: 18.6, q1: 15.7, q3: 21.2 }, brakeImpPctBWs: { med: 2.0, q1: 1.5, q3: 7.8 },
    keDropPct: { med: 21, q1: 15, q3: 54 }, tFCtoPBG: { med: 39, q1: 25, q3: 60 }, dirQuality: { med: 0.99, q1: 0.98, q3: 0.99 },
    pelvisAccPeak: { med: 5747, q1: 2665, q3: 6631 }, pbgToPelvisGap: { med: -27, q1: -48, q3: 30 }, mlImp: { med: 0.41, q1: 0.28, q3: 0.8 }, keFC: { med: 300, q1: 267, q3: 354 },
    n: 20
  };
  function blockingEval(t, mass, RHP, R, strideL, xfL) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iFC = e.i_fc, iBR = e.i_br;
    if (iFC == null || iBR == null) return null;
    var iSO = (strideL && strideL.events && strideL.events.idx && strideL.events.idx.SO != null) ? strideL.events.idx.SO : (e.i_kl_peak || 0);
    var g = 9.81, BW = mass * g, N = BLK_NORM;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    function va(a, i) { return (a && isFinite(a[i])) ? a[i] : null; }
    // 홈 방향 부호: COM 전진속도(SO~FC 평균)의 부호 → 양수=홈 방향. signed 전진속도 정의.
    var cv = S.COM_Velocity_Y || []; var fwdSign = 1; (function () { var s = 0, c = 0; for (var i = iSO; i <= iFC && i < cv.length; i++) { if (isFinite(cv[i])) { s += cv[i]; c++; } } if (c && s < 0) fwdSign = -1; })();
    var fwd = cv.map(function (x) { return isFinite(x) ? fwdSign * x : NaN; });
    // 앞발 AP 제동력: 홈 방향 투영(FP2_Y=AP, 홈=+) 후 전진 반대 성분만 = max(0, -fwdSign*FP2_Y). raw abs 금지.
    var apRaw = S.FP2_Y || []; var Fbrake = apRaw.map(function (x) { return isFinite(x) ? Math.max(0, -fwdSign * x) : NaN; });
    var Fml = (S.FP2_X || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var n150 = Math.max(1, Math.round(0.15 / dt));
    var pbg = peak(Fbrake, iFC, Math.min(iFC + n150, iBR), 'max'); var iPBG = pbg.i;
    var peakBrakeN = pbg.v == null ? null : r1(pbg.v), peakBrakePct = pbg.v == null ? null : r1(pbg.v / BW * 100), tFCtoPBG = relMs(iPBG);
    var iPVGRF = peak((S.FP2_Z || []).map(function (x) { return Math.abs(x); }), iFC, Math.min(iFC + n150, iBR), 'max').i;
    var peakVGRFpct = iPVGRF != null ? r1(Math.abs((S.FP2_Z || [])[iPVGRF]) / BW * 100) : null;
    function impPct(lo, hi) { if (lo == null || hi == null) return null; var v = integ(Fbrake, lo, hi, dt, 0); return v == null ? null : r2(v / BW * 100); }
    var brakeImpFCtoPBG = impPct(iFC, iPBG), brakeImpFCtoPVGRF = impPct(iFC, iPVGRF), brakeImpFCtoBR = impPct(iFC, iBR);
    var riseRate = (peakBrakePct != null && tFCtoPBG != null && tFCtoPBG > 0) ? r1(peakBrakePct / (tFCtoPBG / 1000)) : null;
    var mlImp = (function () { var v = integ(Fml, iFC, iPBG, dt, 0); return v == null ? null : r2(v / BW * 100); })();
    var dirQ = (function () { var num = 0, den = 0, hi = (iPVGRF != null ? iPVGRF : iPBG); for (var i = iFC; i <= hi && i < Fbrake.length; i++) { var b = Fbrake[i]; if (!isFinite(b)) continue; var m = isFinite(Fml[i]) ? Fml[i] : 0; num += b * dt; den += Math.sqrt(b * b + m * m) * dt; } return den > 0 ? r2(num / den) : null; })();
    // COM 전진속도(signed) 지표
    var velFC = va(fwd, iFC), velPBG = va(fwd, iPBG); var mn = peak(fwd, iFC, iBR, 'min'); var velMin = mn.v;
    var velDropPBG = (velFC != null && velPBG != null) ? r2(velFC - velPBG) : null, velDropBR = (velFC != null && velMin != null) ? r2(velFC - velMin) : null;
    // COM 감속 = signed 전진속도의 음의 기울기(평활 후). abs 미분 금지.
    var acc = deriv(movavg(fwd, 2), dt); var decel = acc.map(function (a) { return isFinite(a) ? Math.max(0, -a) : NaN; });
    var pcd = peak(decel, iFC, Math.min(iFC + n150, iBR), 'max'); var peakDecel = pcd.v == null ? null : r1(pcd.v), tPCD = relMs(pcd.i);
    // COM 전진 KE
    var keFCv = velFC != null ? 0.5 * mass * velFC * velFC : null, kePBGv = velPBG != null ? 0.5 * mass * velPBG * velPBG : null, keMinv = velMin != null ? 0.5 * mass * velMin * velMin : null;
    var keDropPBG = (keFCv != null && kePBGv != null) ? Math.round(keFCv - kePBGv) : null, keDropMin = (keFCv != null && keMinv != null) ? Math.round(keFCv - keMinv) : null;
    var keDropPctV = (keFCv != null && keFCv > 0 && keDropPBG != null) ? r1(keDropPBG / keFCv * 100) : null;
    var keFC = keFCv == null ? null : Math.round(keFCv), kePBG = kePBGv == null ? null : Math.round(kePBGv), keMin = keMinv == null ? null : Math.round(keMinv);
    var brakeEff = (keFCv != null && keFCv > 0 && keDropPBG != null) ? r2(keDropPBG / keFCv) : null;
    // 골반 회전 가속/속도(직접 채널 없어 Pelvis_Ang_Vel_Z 미분)
    var pav = (S.Pelvis_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var ppvP = peak(pav, iFC, iBR, 'max'); var pelvisVelPeak = ppvP.v == null ? null : Math.round(ppvP.v), tPPV = relMs(ppvP.i);
    var ppaP = peak(deriv(movavg(pav, 2), dt), iFC, iBR, 'max'); var pelvisAccPeak = ppaP.v == null ? null : Math.round(ppaP.v), tPPA = relMs(ppaP.i);
    var dtPBGtoPVGRF = (iPBG != null && iPVGRF != null) ? Math.round((iPVGRF - iPBG) * dt * 1000) : null;
    var dtPBGtoPPA = (iPBG != null && ppaP.i != null) ? Math.round((ppaP.i - iPBG) * dt * 1000) : null;
    var kneeNegWork = (function () { var v = integ(S.Lead_Knee_Power_X, iFC, iBR, dt, -1); return v == null ? null : r1(v); })();
    // ImpulseMomentumCheck (부호/축 sanity) — braking impulse 가 m·Δv 와 같은 크기 차수인가
    var imCheck = (brakeImpFCtoPBG != null && velDropPBG != null && Math.abs(velDropPBG) > 0.05) ? r2((brakeImpFCtoPBG / 100 * BW * dt * 0) || 0) : null; // (해석은 아래 warn)
    var brakeImpulseN_s = (function () { var v = integ(Fbrake, iFC, iPBG, dt, 0); return v; })();
    var imRatio = (brakeImpulseN_s != null && velDropPBG != null && Math.abs(velDropPBG) > 0.05) ? r2(brakeImpulseN_s / (mass * Math.abs(velDropPBG))) : null;
    var warn = []; if (peakBrakePct != null && peakBrakePct < 30 && keFC != null && keFC > (N.keFC.q1)) warn.push('AP 제동 축/부호/plate 매핑 확인 필요(제동값이 비정상적으로 작음)');
    if (imRatio != null && (imRatio < 0.3 || imRatio > 4)) warn.push('임펄스-운동량 정합성 경고(부호/축 가능성)');
    // 점수(그룹 기준 기반)
    function nHi(v, n) { if (v == null || !n) return null; if (v >= n.med) return 90; if (v >= n.q1) return 72; var iqr = (n.q3 - n.q1) || 1; return v >= n.q1 - iqr ? 52 : 36; }
    function nLow(v, n) { if (v == null || !n) return null; if (v <= n.med) return 90; if (v <= n.q3) return 72; var iqr = (n.q3 - n.q1) || 1; return v <= n.q3 + iqr ? 52 : 36; }
    function nRange(v, n) { if (v == null || !n) return null; if (v >= n.q1 && v <= n.q3) return 90; var iqr = (n.q3 - n.q1) || 1; var d = v < n.q1 ? n.q1 - v : v - n.q3; return d <= iqr ? 66 : 40; }
    var sc = { peakBrake: nHi(peakBrakePct, N.peakBrakePctBW), brakeImp: nHi(brakeImpFCtoPBG, N.brakeImpPctBWs), comDecel: nHi(peakDecel, N.comDecel), time: nRange(tFCtoPBG, N.tFCtoPBG), keDrop: nHi(keDropPctV, N.keDropPct), dirQ: nHi(dirQ, N.dirQuality) };
    var capacity = (function () { var w = { peakBrake: 0.30, brakeImp: 0.22, time: 0.16, keDrop: 0.20, dirQ: 0.12 } /* [2026-05-30] comDecel(🔴 이상치) 점수 제외 — 정제 */, s = 0, ws = 0; for (var k in w) { if (sc[k] != null) { s += sc[k] * w[k]; ws += w[k]; } } return ws ? Math.round(s / ws) : null; })();
    // bridge 점수
    var readiness = mean([(strideL && strideL.comKE && strideL.comKE.keFC != null) ? nHi(strideL.comKE.keFC, N.keFC) : null, sc.peakBrake]); /* comDecel 점수 제외 */
    readiness = readiness == null ? null : Math.round(readiness);
    var conv = mean([sc.peakBrake, sc.keDrop, nHi(pelvisAccPeak, N.pelvisAccPeak), nRange(dtPBGtoPPA, N.pbgToPelvisGap)]);
    conv = conv == null ? null : Math.round(conv);
    var earlyOpenPenalty = (xfL && xfL.flyingOpenRisk === 'High') ? 100 : ((xfL && xfL.flyingOpenRisk === 'Moderate') ? 50 : 0);
    var functional = (capacity != null) ? Math.max(0, Math.round(0.55 * capacity + 0.20 * (readiness == null ? capacity : readiness) + 0.20 * (conv == null ? capacity : conv) - 0.05 * earlyOpenPenalty)) : null;
    // 유형 분류(그룹 상대)
    var lowBrake = peakBrakePct != null && peakBrakePct < N.peakBrakePctBW.q1, hiBrake = peakBrakePct != null && peakBrakePct >= N.peakBrakePctBW.med;
    var lowDecel = peakDecel != null && peakDecel < N.comDecel.q1, hiDecel = peakDecel != null && peakDecel >= N.comDecel.med;
    var lowKEdrop = keDropPctV != null && keDropPctV < N.keDropPct.q1;
    var hiKEfc = keFC != null && keFC >= N.keFC.med, lateBrake = tFCtoPBG != null && tFCtoPBG > 90; // 이른/늦은 이봉 → 90ms 초과를 '늦은 블로킹'으로
    var lowDirQ = dirQ != null && dirQ < 0.96; // 정규화 방향품질(절대 ML 임펄스 아님)로 측방 누수 판정
    var latePelvis = dtPBGtoPPA != null && dtPBGtoPPA > N.pbgToPelvisGap.q3, hiKneeAbs = kneeNegWork != null && kneeNegWork < -30;
    var earlyOpen = xfL && ((xfL.releasedPct != null && xfL.releasedPct > 25) || (xfL.thoraxOpenVelFC != null && xfL.thoraxOpenVelFC > 600));
    var type;
    if (lowBrake && lowDecel) type = 'weak';
    else if (lowDirQ) type = 'direction_leak';
    else if (hiBrake && hiDecel && (latePelvis || hiKneeAbs)) type = 'over_brake';
    else if (lateBrake) type = 'late';
    else if (hiKEfc && (lowBrake || lowDecel)) type = 'momentum_leak';
    else if (earlyOpen && !lowBrake) type = 'early_open_conflict';
    else type = 'functional';
    // 요약(원인-결과)
    var keTxt = (keFC != null && keFC >= N.keFC.q1) ? '착지 순간 앞으로 가는 힘(전진 에너지)은 충분(' + keFC + 'J)하지만' : '착지 순간 앞으로 가는 힘(' + (keFC == null ? '–' : keFC + 'J') + ')은 크지 않고';
    var issue;
    if (type === 'weak') issue = '앞발 브레이크(' + (peakBrakePct == null ? '–' : peakBrakePct + '% 체중 대비') + ')와 몸 중심 감속이 약해, 앞으로 나가며 만든 힘을 앞발이 충분히 멈추지 못하고 그대로 앞으로 흘려보내는';
    else if (type === 'late') issue = '앞발 브레이크가 착지 후 ' + (tFCtoPBG == null ? '' : tFCtoPBG + 'ms') + '로 늦게 올라와(또래 선수보다 늦음), 착지 직후 회전으로 바꾸는 시점이 늦어지는';
    else if (type === 'momentum_leak') issue = '앞으로 가는 힘은 만들지만 앞발 브레이크·몸 중심 감속이 부족해 그 힘을 회전으로 바꾸지 못하는';
    else if (type === 'over_brake') issue = '세게 멈추기는 하지만(브레이크 ' + (peakBrakePct == null ? '–' : peakBrakePct + '% 체중 대비') + ') 골반 회전이 늦거나 무릎이 힘을 흡수해, 멈춘 힘이 회전으로 가지 못하고 앞다리에서 흡수되는';
    else if (type === 'direction_leak') issue = '브레이크 힘 일부가 홈 방향이 아니라 좌우로 새서(제동 방향 ' + (dirQ == null ? '–' : dirQ) + '), 앞으로 멈추는 효율이 떨어지는';
    else if (type === 'early_open_conflict') issue = '앞발 브레이크는 만들어지지만 몸통·골반이 착지 전에 이미 열려 있어(너무 일찍 열림) 멈춘 힘을 순서대로 넘기기 어려운';
    else issue = '앞발 브레이크(' + (peakBrakePct == null ? '–' : peakBrakePct + '% 체중 대비') + ')·몸 중심 감속·골반 회전 전환이 비교적 균형 잡혀 앞으로 가던 힘을 회전으로 잘 넘기는';
    var summary = '이 투수는 ' + keTxt + ', ' + issue + ' 패턴입니다.';
    return {
      events: { FC: 0, PBG: tFCtoPBG, PCD: tPCD, PVGRF: relMs(iPVGRF), PPA: tPPA, PPV: tPPV, BR: relMs(iBR),
        idx: { SO: iSO, FC: iFC, PBG: iPBG, PCD: pcd.i, PVGRF: iPVGRF, PPA: ppaP.i, PPV: ppvP.i, BR: iBR } },
      apBrake: { peakN: peakBrakeN, peakPctBW: peakBrakePct, tFCtoPBGms: tFCtoPBG, riseRatePctBWs: riseRate },
      impulse: { fcToPBG: brakeImpFCtoPBG, fcToPVGRF: brakeImpFCtoPVGRF, fcToBR: brakeImpFCtoBR, mlImpulse: mlImp },
      comDecel: { peak: peakDecel, tPCDms: tPCD },
      comVel: { fwdSign: fwdSign, velFC: r2(velFC), velPBG: r2(velPBG), velMin: r2(velMin), dropFCtoPBG: velDropPBG, dropFCtoBR: velDropBR },
      comKE: { keFC: keFC, kePBG: kePBG, keMin: keMin, dropFCtoPBG: keDropPBG, dropFCtoMin: keDropMin, dropPct: keDropPctV, brakeEffProxy: brakeEff },
      direction: { dirQuality: dirQ, mlImpulse: mlImp },
      vertical: { peakVGRFpctBW: peakVGRFpct, dtPBGtoPVGRFms: dtPBGtoPVGRF },
      pelvis: { angAccPeak: pelvisAccPeak, tPPAms: tPPA, angVelPeak: pelvisVelPeak, tPPVms: tPPV, dtPBGtoPPAms: dtPBGtoPPA },
      knee: { negWork: kneeNegWork },
      imRatio: imRatio, warnings: warn,
      scores: sc, capacityScore: capacity, readinessScore: readiness, conversionScore: conv, earlyOpenPenalty: earlyOpenPenalty, functionalScore: functional,
      type: type, typeKo: BLOCK_TYPE_KO[type] || type, summary: summary, norm: N,
      copPath: (function () { var arr = [], fr = t.frames || []; function jt(i, k, ax) { var f = fr[i]; return (f && f[k] && isFinite(f[k][ax])) ? f[k][ax] : null; } for (var i = iFC; i <= Math.min(iBR, fr.length - 1); i++) { var c0 = jt(i, 'com', 0), c2 = jt(i, 'com', 2), l0 = jt(i, 'l_toe', 0), l2 = jt(i, 'l_toe', 2); if (c0 != null && c2 != null) arr.push([relMs(i), Math.round(c0), Math.round(c2), l0 == null ? null : Math.round(l0), l2 == null ? null : Math.round(l2), isFinite(Fbrake[i]) ? Math.round(Fbrake[i]) : null, isFinite((S.FP2_X || [])[i]) ? Math.round(S.FP2_X[i] * fwdSign) : null]); } return arr; })()
    };
  }

  // ══ 진단5 무릎전달 (개발문서 v1) — VGRF·리드무릎·골반전달. 각도 클수록 굴곡, Δ<0=신전(무너짐 아님) ══
  var KNEE5_TYPE_KO = { collapse: '무너짐형', bracing: '버팀형', dynamic_extension: '힘차게 펴는형', brace_to_extension: '버틴 뒤 펴는형', ext_late_collapse: '펴다 막판 무너짐형', locked: '너무 굳힌형', indeterminate: '판정 보류(영상 확인)' };
  // 상동고 20명 그룹 기준(median/q1/q3) — /tmp/ef/knnorm.js, Normative_data 20명 대표 trial(2026-05-27, n=20).
  // 중요: dtPVGRFtoPPA 는 그룹 전원 음수(중앙 -63.5ms) — 이 마커리스 그룹에서 골반 회전가속 peak가 수직GRF peak보다 먼저 옴(VGRF가 늦게/지속적으로 peak).
  //       따라서 '짧은 양수 gap=좋음' 절대창 대신 그룹 분포(IQR) 기준으로 점수화하고, 기능적 연결은 coupling overlap 으로 본다.
  var KNEE_NORM = {
    peakVGRFpct: { med: 203, q1: 189, q3: 223 }, vgrfImpFCtoPPA: { med: 5.2, q1: 1.25, q3: 7.5 }, vgrfRiseRate: { med: 1676, q1: 1203, q3: 2539 },
    plateauDur: { med: 79, q1: 70, q3: 108 }, kneePosWork: { med: 18, q1: 11, q3: 26 }, kneeNegWork: { med: 42, q1: 31, q3: 56 },
    absorptionRatio: { med: 0.76, q1: 0.62, q3: 0.78 }, dtPVGRFtoPPA: { med: -63, q1: -95, q3: -32 }, peakKEV: { med: 410, q1: 351, q3: 493 },
    kneeAngleSD: { med: 3.25, q1: 2.25, q3: 5.7 }, lateCollapse: { med: -8.3, q1: -11.3, q3: -3.8 }, kneeFlexFC: { med: 49, q1: 44, q3: 55 }, n: 20
  };
  function kneeTransfer(t, mass, RHP, R, blockingL) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iFC = e.i_fc, iBR = e.i_br, iMER = e.i_mer;
    if (iFC == null || iBR == null) return null;
    var g = 9.81, BW = mass * g, N = KNEE_NORM;
    var iPBG = (blockingL && blockingL.events && blockingL.events.idx && blockingL.events.idx.PBG != null) ? blockingL.events.idx.PBG : null;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    function va(a, i) { return (a && isFinite(a[i])) ? a[i] : null; }
    if (iMER == null) iMER = Math.round((iFC + iBR) / 2);
    // 수직 GRF
    var vg = (S.FP2_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var pv = peak(vg, iFC, iBR, 'max'); var iPVGRF = pv.i, peakVGRFn = pv.v == null ? null : r1(pv.v), peakVGRFpct = pv.v == null ? null : r1(pv.v / BW * 100);
    // 골반 회전 가속/속도
    var pav = (S.Pelvis_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var ppv = peak(pav, iFC, iBR, 'max'); var iPPV = ppv.i, pelvisVelPeak = ppv.v == null ? null : Math.round(ppv.v);
    var paa = deriv(movavg(pav, 2), dt); var ppa = peak(paa, iFC, iBR, 'max'); var iPPA = ppa.i, pelvisAccPeak = ppa.v == null ? null : Math.round(ppa.v);
    function impPct(a, lo, hi) { if (lo == null || hi == null) return null; var v = integ(a, lo, hi, dt, 0); return v == null ? null : r2(v / BW * 100); }
    var vgrfImpFCtoPVGRF = impPct(vg, iFC, iPVGRF), vgrfImpFCtoPPA = impPct(vg, iFC, iPPA), vgrfImpFCtoBR = impPct(vg, iFC, iBR);
    var tPVGRF = relMs(iPVGRF);
    var vgrfRise = (peakVGRFpct != null && tPVGRF != null && tPVGRF > 0) ? r1(peakVGRFpct / (tPVGRF / 1000)) : null;
    // VGRF plateau (>=80% peak)
    var thr80 = (pv.v || 0) * 0.8, plLo = null, plHi = null, plVals = [];
    for (var i = iFC; i <= iBR && i < vg.length; i++) { if (isFinite(vg[i]) && vg[i] >= thr80) { if (plLo == null) plLo = i; plHi = i; plVals.push(vg[i]); } }
    var plateauDur = (plLo != null && plHi != null) ? Math.round((plHi - plLo) * dt * 1000) : null;
    var plateauCV = (plVals.length > 1) ? r2(sd(plVals) / mean(plVals)) : null;
    // 무릎 각도(클수록 굴곡)
    var ka = S.Lead_Knee_Angle_X || [];
    var kFC = va(ka, iFC), kPBG = va(ka, iPBG), kPVGRF = va(ka, iPVGRF), kPPA = va(ka, iPPA), kMER = va(ka, iMER), kBR = va(ka, iBR);
    var dFCtoPVGRF = (kFC != null && kPVGRF != null) ? r1(kPVGRF - kFC) : null;
    var dFCtoMER = (kFC != null && kMER != null) ? r1(kMER - kFC) : null;
    var dFCtoBR = (kFC != null && kBR != null) ? r1(kBR - kFC) : null;
    var minFCtoMER = peak(ka, iFC, iMER, 'min'); var kMin = minFCtoMER.v;
    var lateCollapse = (kBR != null && kMin != null) ? r1(kBR - kMin) : null;
    var sdFCtoPVGRF = (function () { var a = []; for (var i = iFC; i <= (iPVGRF == null ? iFC : iPVGRF) && i < ka.length; i++) if (isFinite(ka[i])) a.push(ka[i]); return r1(sd(a)); })();
    var sdFCtoMER = (function () { var a = []; for (var i = iFC; i <= iMER && i < ka.length; i++) if (isFinite(ka[i])) a.push(ka[i]); return r1(sd(a)); })();
    // 무릎 신전/굴곡 속도(파생)
    var kvel = S.Lead_Knee_Ang_Vel_X || deriv(ka, dt) || [];
    var extVel = kvel.map(function (v) { return isFinite(v) ? Math.max(0, -v) : NaN; });
    var flexVel = kvel.map(function (v) { return isFinite(v) ? Math.max(0, v) : NaN; });
    var pkev = peak(extVel, iFC, iBR, 'max'); var iPKEV = pkev.i, peakKEV = pkev.v == null ? null : Math.round(pkev.v);
    var pkfiv = peak(flexVel, iFC, iBR, 'max'); var peakKFIV = pkfiv.v == null ? null : Math.round(pkfiv.v);
    var keoThr = 80, need = Math.max(1, Math.round(0.02 / dt)), iKEO = null;
    for (var i = iFC; i <= iBR - need; i++) { var ok = true; for (var k = 0; k < need; k++) { if (!(extVel[i + k] > keoThr)) { ok = false; break; } } if (ok) { iKEO = i; break; } }
    // 무릎 파워·일 (Lead_Knee_Power_X: +생성 / -흡수)
    var kp = S.Lead_Knee_Power_X || [];
    function posW(lo, hi) { var v = integ(kp, lo, hi, dt, 1); return v == null ? null : r1(v); }
    function negW(lo, hi) { var v = integ(kp, lo, hi, dt, -1); return v == null ? null : r1(Math.abs(v)); }
    var posWPPA = posW(iFC, iPPA), negWPPA = negW(iFC, iPPA), posWMER = posW(iFC, iMER), negWMER = negW(iFC, iMER), posWBR = posW(iFC, iBR), negWBR = negW(iFC, iBR);
    var absRatio = (posWBR != null && negWBR != null && (posWBR + negWBR) > 0) ? r2(negWBR / (posWBR + negWBR)) : null;
    var iPKPP = peak(kp, iFC, iBR, 'max').i, iPKNP = peak(kp, iFC, iBR, 'min').i;
    // 타이밍 (핵심: PVGRF→PPA)
    var dtPVGRFtoPPA = (iPVGRF != null && iPPA != null) ? Math.round((iPPA - iPVGRF) * dt * 1000) : null;
    var dtPBGtoPVGRF = (iPBG != null && iPVGRF != null) ? Math.round((iPVGRF - iPBG) * dt * 1000) : null;
    var dtPVGRFtoKEV = (iPVGRF != null && iPKEV != null) ? Math.round((iPKEV - iPVGRF) * dt * 1000) : null;
    var dtKEVtoPPA = (iPKEV != null && iPPA != null) ? Math.round((iPPA - iPKEV) * dt * 1000) : null;
    var dtPVGRFtoPPV = (iPVGRF != null && iPPV != null) ? Math.round((iPPV - iPVGRF) * dt * 1000) : null;
    // Knee-Pelvis coupling overlap (PVGRF~PPA 또는 FC~PPA): min(norm VGRF avail, norm pelvis accel gain)
    var coupling = (function () {
      // 그룹 전원 PPA<PVGRF 이므로 PVGRF~PPA 창이 비어 FC~max(PPA,PVGRF) 구간에서 VGRF 가용도와 골반 가속 gain 겹침을 본다.
      var lo = iFC, hi = Math.max(iPPA == null ? iFC : iPPA, iPVGRF == null ? iFC : iPVGRF); if (hi <= lo) hi = Math.min(iBR, lo + 10);
      var peakVG = pv.v || 1, accGain = paa.map(function (a) { return isFinite(a) ? Math.max(0, a) : 0; }), peakAcc = ppa.v || 1;
      var num = 0, den = 0; for (var i = lo; i <= hi && i < vg.length; i++) { var sv = isFinite(vg[i]) ? Math.min(1, vg[i] / peakVG) : 0, ga = accGain[i] / peakAcc; num += Math.min(sv, ga) * dt; den += ga * dt; }
      return den > 0 ? r2(num / den) : null;
    })();
    // 점수(그룹)
    function nHi(v, n) { if (v == null || !n) return null; if (v >= n.med) return 90; if (v >= n.q1) return 72; var iqr = (n.q3 - n.q1) || 1; return v >= n.q1 - iqr ? 52 : 36; }
    function nLow(v, n) { if (v == null || !n) return null; if (v <= n.med) return 90; if (v <= n.q3) return 72; var iqr = (n.q3 - n.q1) || 1; return v <= n.q3 + iqr ? 52 : 36; }
    function nRange(v, n) { if (v == null || !n) return null; if (v >= n.q1 && v <= n.q3) return 90; var iqr = (n.q3 - n.q1) || 1; var d = v < n.q1 ? n.q1 - v : v - n.q3; return d <= iqr ? 66 : 40; }
    var vSupport = (function () { var s = 0.40 * (nHi(peakVGRFpct, N.peakVGRFpct) || 0) + 0.30 * (nHi(vgrfImpFCtoPPA, N.vgrfImpFCtoPPA) || 0) + 0.20 * (nHi(vgrfRise, N.vgrfRiseRate) || 0) + 0.10 * (nHi(plateauDur, N.plateauDur) || 0); return Math.round(s); })();
    // VGRF→Pelvis timing: 그룹 전원 PPA가 PVGRF보다 먼저(음수) → 그룹 IQR 기준 점수(중앙 근처=좋음, 극단=감점).
    var timingScore = nRange(dtPVGRFtoPPA, N.dtPVGRFtoPPA);
    var workBalance = (function () { var p = nHi(posWBR, N.kneePosWork), a = nLow(absRatio, N.absorptionRatio); var arr = [p, a].filter(function (x) { return x != null; }); return arr.length ? Math.round(arr.reduce(function (q, c) { return q + c; }, 0) / arr.length) : null; })();
    var couplingScore = nHi(coupling, { med: 0.6, q1: 0.4, q3: 0.8 });
    // 유형 분류 (단일 delta 금지 — 시계열·속도·일·late collapse 종합)
    var extThr = N.peakKEV.med, posThr = N.kneePosWork.med, negThr = N.kneeNegWork.med, sdThr = N.kneeAngleSD.med;
    var hasExtension = (dFCtoMER != null && dFCtoMER < -5) || (peakKEV != null && peakKEV > extThr) || (posWMER != null && posWMER > posThr);
    var hasBrace = (kPVGRF != null && kFC != null && Math.abs(kPVGRF - kFC) <= 10) && (sdFCtoPVGRF != null && sdFCtoPVGRF < N.kneeAngleSD.q3); // yield 허용폭 완화(±10°, SD<그룹 q3) — 약간의 하중 yield 포함 버팀 인정(교수 확정 2026-05-27)
    var hasCollapse = (dFCtoMER != null && dFCtoMER > 5) && (negWMER != null && negWMER > negThr);
    var lockedStiff = (kFC != null && kFC < N.kneeFlexFC.q1) && (sdFCtoMER != null && sdFCtoMER < N.kneeAngleSD.q1) && (peakVGRFpct != null && peakVGRFpct >= N.peakVGRFpct.med) && (posWBR != null && posWBR < N.kneePosWork.q1);
    var type;
    if (hasExtension && lateCollapse != null && lateCollapse > 5) type = 'ext_late_collapse';
    else if (hasBrace && hasExtension) type = 'brace_to_extension';
    else if (hasExtension) type = 'dynamic_extension';
    else if (lockedStiff) type = 'locked';
    else if (hasBrace) type = 'bracing';
    else if (hasCollapse) type = 'collapse';
    else type = 'indeterminate';
    // 유형별 패턴 점수
    var patternScore = ({ dynamic_extension: 86, bracing: 84, brace_to_extension: 88, ext_late_collapse: 60, locked: 58, collapse: 42, indeterminate: 62 })[type];
    // penalty
    var lateCollapsePenalty = (lateCollapse != null && lateCollapse > 5) ? Math.min(14, Math.round((lateCollapse - 5) * 0.8)) : 0;
    var absPenalty = (absRatio != null && absRatio > N.absorptionRatio.q3) ? Math.min(12, Math.round((absRatio - N.absorptionRatio.q3) * 40)) : 0;
    var kneeScore = (function () {
      var parts = { v: [0.25, vSupport], p: [0.20, patternScore], w: [0.20, workBalance], t: [0.25, timingScore], c: [0.10, couplingScore] }, s = 0, ws = 0;
      for (var k in parts) { if (parts[k][1] != null) { s += parts[k][0] * parts[k][1]; ws += parts[k][0]; } }
      return ws ? Math.max(0, Math.round(s / ws - lateCollapsePenalty - absPenalty)) : null;
    })();
    // angle convention 경고
    var warn = []; if (dFCtoBR != null && dFCtoBR < -5 && type === 'collapse') warn.push('각도 규약 점검: ΔKneeFlexion<0은 신전 근거(무너짐 아님)');
    // 요약(원인-결과)
    var vgTxt = (peakVGRFpct != null && N.peakVGRFpct && peakVGRFpct >= N.peakVGRFpct.q1) ? '앞다리로 땅 받치는 힘은 충분(' + peakVGRFpct + '% 체중 대비)하지만' : '앞다리로 땅 받치는 힘(' + (peakVGRFpct == null ? '–' : peakVGRFpct + '% 체중 대비') + ')은 크지 않고';
    // 타이밍 해석은 그룹 분포 기준(이 그룹는 PPA가 PVGRF보다 먼저 오는 것이 정상). coupling 으로 기능적 연결 보강.
    var connTxt = (dtPVGRFtoPPA == null) ? '골반 회전과의 연결을 확인할 수 없' : ((dtPVGRFtoPPA >= N.dtPVGRFtoPPA.q1 && dtPVGRFtoPPA <= N.dtPVGRFtoPPA.q3) ? '땅 받치는 힘과 골반 회전 시점이 또래 선수 정상 범위(중앙 ' + N.dtPVGRFtoPPA.med + 'ms)에서 맞물려 받친 힘이 골반 회전으로 잘 이어지' : (dtPVGRFtoPPA < N.dtPVGRFtoPPA.q1 ? '골반 회전이 또래보다 이르게(땅을 받치기도 전에) 나타나 힘을 받기 전에 골반이 먼저 돌' : '받치는 힘에 비해 골반 회전이 또래보다 늦게 이어져 전달이 지연될 수 있'));
    var typeTxt = ({ collapse: '앞무릎이 받친 힘을 전달하기보다 굽으며 힘을 흡수해 잃는', bracing: '무릎을 크게 펴지 않고 단단히 버티며 받친 힘을 골반으로 넘기는', dynamic_extension: '무릎을 힘차게 펴며 그 힘을 골반 회전으로 넘기는', brace_to_extension: '처음엔 버틴 뒤 펴며 힘을 더 넘기는', ext_late_collapse: '처음엔 펴서 넘기지만 공 놓기 직전 다시 무너지는', locked: '단단히 고정해 버티지만 넘기기보다 충격을 받는', indeterminate: '영상 확인이 필요한' })[type];
    var summary = '이 투수는 ' + vgTxt + ', 앞무릎이 ' + typeTxt + ' 패턴이며, ' + connTxt + '는 모습입니다.';
    return {
      events: { FC: 0, PBG: relMs(iPBG), PVGRF: tPVGRF, PKEV: relMs(iPKEV), KEO: relMs(iKEO), PKPP: relMs(iPKPP), PKNP: relMs(iPKNP), PPA: relMs(iPPA), PPV: relMs(iPPV), MER: relMs(iMER), BR: relMs(iBR),
        idx: { FC: iFC, PBG: iPBG, PVGRF: iPVGRF, PKEV: iPKEV, KEO: iKEO, PPA: iPPA, PPV: iPPV, MER: iMER, BR: iBR } },
      vgrf: { peakN: peakVGRFn, peakPctBW: peakVGRFpct, tPVGRFms: tPVGRF, riseRatePctBWs: vgrfRise, impFCtoPVGRF: vgrfImpFCtoPVGRF, impFCtoPPA: vgrfImpFCtoPPA, impFCtoBR: vgrfImpFCtoBR, plateauDurMs: plateauDur, plateauCV: plateauCV },
      angle: { atFC: kFC == null ? null : r1(kFC), atPBG: kPBG == null ? null : r1(kPBG), atPVGRF: kPVGRF == null ? null : r1(kPVGRF), atPPA: kPPA == null ? null : r1(kPPA), atMER: kMER == null ? null : r1(kMER), atBR: kBR == null ? null : r1(kBR), minFCtoMER: kMin == null ? null : r1(kMin), dFCtoPVGRF: dFCtoPVGRF, dFCtoMER: dFCtoMER, dFCtoBR: dFCtoBR, lateCollapse: lateCollapse, sdFCtoPVGRF: sdFCtoPVGRF, sdFCtoMER: sdFCtoMER },
      velocity: { peakExtVel: peakKEV, tPKEVms: relMs(iPKEV), extOnsetMs: relMs(iKEO), peakFlexIncVel: peakKFIV },
      work: { posWorkFCtoPPA: posWPPA, negWorkFCtoPPA: negWPPA, posWorkFCtoMER: posWMER, negWorkFCtoMER: negWMER, posWorkFCtoBR: posWBR, negWorkFCtoBR: negWBR, absorptionRatio: absRatio },
      pelvis: { angAccPeak: pelvisAccPeak, tPPAms: relMs(iPPA), angVelPeak: pelvisVelPeak, tPPVms: relMs(iPPV) },
      timing: { dtPVGRFtoPPA: dtPVGRFtoPPA, dtPBGtoPVGRF: dtPBGtoPVGRF, dtPVGRFtoKEV: dtPVGRFtoKEV, dtKEVtoPPA: dtKEVtoPPA, dtPVGRFtoPPV: dtPVGRFtoPPV },
      coupling: coupling,
      scores: { verticalSupport: vSupport, pattern: patternScore, workBalance: workBalance, timing: timingScore, coupling: couplingScore }, lateCollapsePenalty: lateCollapsePenalty, absPenalty: absPenalty,
      kneeTransferScore: kneeScore, kneeTransferScoreLegacy: true, kneeTransferScoreLabel: '레거시 무릎전달 종합점수 (research/debug)',
      phasesKneeTransferNote: '선수/코치 표시 SSOT = phases.kneeTransfer(앞다리 버팀 겹침률). 위 점수와 정의·산식이 다름.',
      type: type, typeKo: KNEE5_TYPE_KO[type] || type, warnings: warn, summary: summary, norm: N
    };
  }

  // ══ 진단6 골반→몸통 회전 증폭 (개발문서 v1) ══
  var PT_TYPE_KO = { functional: '잘 키운형', trunk_gain_low: '골반 돌지만 몸통서 못 키운형', early_trunk_open: '몸통 너무 일찍 열린형', delayed_trunk: '몸통 늦게 반응한형', trunk_self: '몸통 혼자 도는형' };
  // 상동고 20명 그룹 기준 — /tmp/ef/p6norm.js, Normative_data 20명(2026-05-27, n=20).
  // handoff overlap 중앙 0.29로 낮음=정상(골반 분절E ~156J 가 몸통 ~720J 보다 작아 정규화 겹침이 낮게 나옴) → 그룹 상대 평가.
  // dtAcc(각가속 peak 간격)는 미분 노이즈 커 점수 제외·참고만.
  var PT_NORM = { gain: { med: 1.44, q1: 1.28, q3: 1.49 }, dtVel: { med: 27, q1: 6, q3: 77 }, dtAcc: { med: 72, q1: 12, q3: 139 }, handoff: { med: 0.29, q1: 0.2, q3: 0.41 }, pelvisVel: { med: 646, q1: 612, q3: 711 }, trunkVel: { med: 909, q1: 831, q3: 980 }, n: 20 };
  function pelvisTrunkEval(t, mass, RHP, R, xfL) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br;
    if (iFC == null || iBR == null) return null;
    var N = PT_NORM;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    var pav = (S.Pelvis_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var tav = (S.Thorax_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var ppv = peak(pav, iKH, iBR, 'max'), tvp = peak(tav, iKH, iBR, 'max');
    var pelvisVelPeak = ppv.v == null ? null : Math.round(ppv.v), trunkVelPeak = tvp.v == null ? null : Math.round(tvp.v);
    var dtVel = (ppv.i != null && tvp.i != null) ? Math.round((tvp.i - ppv.i) * dt * 1000) : null;
    var gain = (pelvisVelPeak && trunkVelPeak) ? r2(trunkVelPeak / pelvisVelPeak) : null;
    var paa = deriv(movavg(pav, 2), dt), taa = deriv(movavg(tav, 2), dt);
    var ppa = peak(paa, iKH, iBR, 'max'), tap = peak(taa, iKH, iBR, 'max');
    var pelvisAccPeak = ppa.v == null ? null : Math.round(ppa.v), trunkAccPeak = tap.v == null ? null : Math.round(tap.v);
    var dtAcc = (ppa.i != null && tap.i != null) ? Math.round((tap.i - ppa.i) * dt * 1000) : null;
    var pE = S.Pelvis_ME_X || [], tE = S.Trunk_ME_X || [];
    var pep = peak(pE, iKH, iBR, 'max'), tep = peak(tE, iKH, iBR, 'max');
    var pelvisEnergyPeak = pep.v == null ? null : Math.round(pep.v), trunkEnergyPeak = tep.v == null ? null : Math.round(tep.v);
    // handoff overlap (타이밍 동기화 proxy): 골반E 방출률 vs 몸통E 생성률 정규화 겹침 (PEP~TEP, 폴백 FC~TEP)
    var handoff = (function () {
      if (!pE.length || !tE.length) return null;
      var dpE = deriv(pE, dt), dtE = deriv(tE, dt);
      var rel = dpE.map(function (d) { return isFinite(d) ? Math.max(0, -d) : 0; }), gn = dtE.map(function (d) { return isFinite(d) ? Math.max(0, d) : 0; });
      var lo = (pep.i != null ? pep.i : iFC), hi = (tep.i != null ? tep.i : iBR); if (hi <= lo) { lo = iFC; hi = (tep.i != null ? tep.i : iBR); } if (hi <= lo) return null;
      var pr = peak(rel, iKH, iBR, 'max').v || 1, pg = peak(gn, iKH, iBR, 'max').v || 1;
      var num = 0, den = 0; for (var i = lo; i <= hi && i < gn.length; i++) { var rn = rel[i] / pr, gnn = gn[i] / pg; num += Math.min(rn, gnn) * dt; den += gnn * dt; }
      return den > 0 ? r2(num / den) : null;
    })();
    // X-factor release → 몸통 에너지 상승 연결
    var xrpvMs = (xfL && xfL.releasePeakVelMs != null) ? xfL.releasePeakVelMs : null;
    var dtXRtoTEP = (xrpvMs != null && tep.i != null) ? (relMs(tep.i) - xrpvMs) : null;
    var thoraxOpenFC = (xfL && xfL.thoraxOpenVelFC != null) ? xfL.thoraxOpenVelFC : null;
    var xfReleasedByFC = (xfL && xfL.releasedPct != null) ? xfL.releasedPct : null;
    // 점수
    function nRange(v, n) { if (v == null || !n) return null; if (v >= n.q1 && v <= n.q3) return 90; var iqr = (n.q3 - n.q1) || 1; var d = v < n.q1 ? n.q1 - v : v - n.q3; return d <= iqr ? 66 : 40; }
    function nHi(v, n) { if (v == null || !n) return null; if (v >= n.med) return 90; if (v >= n.q1) return 72; var iqr = (n.q3 - n.q1) || 1; return v >= n.q1 - iqr ? 52 : 36; }
    var sGain = nRange(gain, N.gain), sDtVel = nRange(dtVel, N.dtVel), sHandoff = nHi(handoff, N.handoff);
    var ampScore = (function () { var w = { g: [0.35, sGain], t: [0.30, sDtVel], h: [0.35, sHandoff] }, s = 0, ws = 0; for (var k in w) { if (w[k][1] != null) { s += w[k][0] * w[k][1]; ws += w[k][0]; } } return ws ? Math.round(s / ws) : null; })();
    // 유형
    var earlyOpen = (dtVel != null && dtVel < N.dtVel.q1 - (N.dtVel.q3 - N.dtVel.q1)) || (dtVel != null && dtVel < 0) || (thoraxOpenFC != null && thoraxOpenFC > 600 && xfReleasedByFC != null && xfReleasedByFC > 25);
    var lowGain = gain != null && gain < N.gain.q1;
    var delayed = dtVel != null && dtVel > N.dtVel.q3 && handoff != null && handoff < N.handoff.q1;
    var selfRot = gain != null && gain > N.gain.q3 && handoff != null && handoff < N.handoff.q1;
    var type;
    if (earlyOpen) type = 'early_trunk_open';
    else if (delayed) type = 'delayed_trunk';
    else if (selfRot) type = 'trunk_self';
    else if (lowGain) type = 'trunk_gain_low';
    else type = 'functional';
    // 요약
    var ord = (dtVel == null) ? '' : (dtVel >= 0 ? '골반(착지 ' + relMs(ppv.i) + 'ms)→몸통(착지 ' + relMs(tvp.i) + 'ms) 순서로 ' + dtVel + 'ms 간격' : '몸통 회전 속도 최고점이 골반보다 먼저 나타나(' + dtVel + 'ms)');
    var issue;
    if (type === 'functional') issue = '골반 회전이 몸통 회전으로 잘 커집니다(키우는 비율 ' + (gain == null ? '–' : gain) + ', 전달 맞물림 ' + (handoff == null ? '–' : handoff) + '). 다음은 몸통 힘이 팔로 넘어가는지 봅니다';
    else if (type === 'trunk_gain_low') issue = '골반은 충분히 돌지만(' + (pelvisVelPeak || '–') + '°/s) 몸통에서 회전을 키우는 정도(비율 ' + (gain == null ? '–' : gain) + ')가 약해, 이후 팔이 더 많은 일을 해야 할 수 있습니다';
    else if (type === 'early_trunk_open') issue = '몸통이 골반 힘을 받은 뒤 열리지 않고 너무 빨리 열려, 하체·골반 힘을 순서대로 받기 어렵습니다';
    else if (type === 'delayed_trunk') issue = '골반이 돈 뒤 몸통이 늦게 반응(간격 ' + dtVel + 'ms·맞물림 ' + (handoff == null ? '–' : handoff) + ')해 골반 힘이 몸통으로 바로 이어지지 못합니다';
    else issue = '몸통 회전 속도는 높지만(비율 ' + (gain == null ? '–' : gain) + ') 골반 힘으로 커진 것이라기보다 몸통 혼자 도는 경향일 수 있습니다(맞물림 ' + (handoff == null ? '–' : handoff) + ')';
    var summary = '이 투수는 ' + (ord ? ord + ', ' : '') + issue + '.';
    return {
      events: { KH: relMs(iKH), FC: 0, PPV: relMs(ppv.i), TVP: relMs(tvp.i), PPA: relMs(ppa.i), TAP: relMs(tap.i), PEP: relMs(pep.i), TEP: relMs(tep.i), BR: relMs(iBR),
        idx: { KH: iKH, FC: iFC, PPV: ppv.i, TVP: tvp.i, PPA: ppa.i, TAP: tap.i, PEP: pep.i, TEP: tep.i, BR: iBR } },
      pelvisVelPeak: pelvisVelPeak, trunkVelPeak: trunkVelPeak, dtPelvisToTrunkVel: dtVel, trunkOverPelvisGain: gain,
      pelvisAccPeak: pelvisAccPeak, trunkAccPeak: trunkAccPeak, dtPelvisToTrunkAcc: dtAcc,
      pelvisEnergyPeak: pelvisEnergyPeak, trunkEnergyPeak: trunkEnergyPeak, handoffOverlap: handoff,
      xfReleasePeakMs: xrpvMs, dtXReleaseToTrunkE: dtXRtoTEP, thoraxOpenVelFC: thoraxOpenFC, xfReleasedByFC: xfReleasedByFC,
      scores: { gain: sGain, dtVel: sDtVel, handoff: sHandoff }, ampScore: ampScore, type: type, typeKo: PT_TYPE_KO[type] || type, summary: summary, norm: N
    };
  }

  // ══ 진단7 몸통 회전+굴곡 에너지 생산 (개발문서 v1) ══
  var TRUNK7_TYPE_KO = { balanced: '회전·숙이기 균형형', rotation_dominant: '회전 위주형(숙이기 적음)', flexion_dominant: '숙이기 비중 큰형', low_energy: '몸통 출력 향상 여지형', peak_timing: '몸통 타이밍 조율 여지형' };
  // 상동고 20명 그룹 기준 — /tmp/ef/p7norm.js(2026-05-27, n=20).
  // rotShare = de Leva 분절관성 반영 회전 에너지 비중(중앙 ~68% = 회전 2/3·굴곡 1/3, 생리학적 타당). 회전/굴곡 우세는 그룹 상대 판정.
  var TRUNK7_NORM = { eTotal: { med: 489, q1: 464, q3: 523 }, rotShare: { med: 68, q1: 63, q3: 74 }, gainRate: { med: 2587, q1: 2041, q3: 2940 }, tTEP: { med: 37, q1: 16, q3: 48 }, trunkArmHandoff: { med: 0.69, q1: 0.59, q3: 0.83 }, asr: { med: 0.3, q1: 0.25, q3: 0.33 }, n: 20 };
  function trunkEnergyEval(t, mass, RHP, R, xfL) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br;
    if (iFC == null || iBR == null) return null;
    var N = TRUNK7_NORM;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    var tE = S.Trunk_ME_X || []; var tep = peak(tE, iKH, iBR, 'max'); var iTEP = tep.i, eTotalPeak = tep.v == null ? null : Math.round(tep.v);
    var rotV = (S.Thorax_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var flexV = (S.Thorax_Ang_Vel_X || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var rotPk = peak(rotV, iKH, iBR, 'max'), flexPk = peak(flexV, iKH, iBR, 'max');
    // 회전/굴곡 에너지 = 분절 관성(de Leva 1996, Visual3D 표준, 남) × ω². 축회전축(IZZ 0.169)보다 굴곡축(IXX 0.328) 관성이 ~3.8배 커 굴곡 에너지 반영.
    // trunk 질량=0.4346×체중, 길이=중앙고관절~목 3D 거리(실측 마커, KH~BR 평균). I = m×(L×ROG)².
    var mTrunk = 0.4346 * mass, fr = t.frames || [], D2R = Math.PI / 180;
    var Ls = []; for (var ii = iKH; ii <= iBR && ii < fr.length; ii++) { var f = fr[ii]; if (f && f.neck && f.l_hip && f.r_hip) { var mhx = (f.l_hip[0] + f.r_hip[0]) / 2, mhy = (f.l_hip[1] + f.r_hip[1]) / 2, mhz = (f.l_hip[2] + f.r_hip[2]) / 2; var d = Math.sqrt(Math.pow(f.neck[0] - mhx, 2) + Math.pow(f.neck[1] - mhy, 2) + Math.pow(f.neck[2] - mhz, 2)); if (isFinite(d)) Ls.push(d / 1000); } }
    var Ltrunk = Ls.length ? mean(Ls) : null;
    var Ilong = Ltrunk != null ? mTrunk * Math.pow(Ltrunk * 0.169, 2) : null, Iflex = Ltrunk != null ? mTrunk * Math.pow(Ltrunk * 0.328, 2) : null;
    var eRotSeries = (Ilong != null) ? rotV.map(function (w) { return isFinite(w) ? 0.5 * Ilong * Math.pow(w * D2R, 2) : NaN; }) : [];
    var eFlexSeries = (Iflex != null) ? flexV.map(function (w) { return isFinite(w) ? 0.5 * Iflex * Math.pow(w * D2R, 2) : NaN; }) : [];
    var eRotPk = peak(eRotSeries, iKH, iBR, 'max'), eFlexPk = peak(eFlexSeries, iKH, iBR, 'max');
    var eRotEst = eRotPk.v == null ? null : Math.round(eRotPk.v), eFlexEst = eFlexPk.v == null ? null : Math.round(eFlexPk.v);
    var rotShare = (eRotEst != null && eFlexEst != null && (eRotEst + eFlexEst) > 0) ? r1(eRotEst / (eRotEst + eFlexEst) * 100) : null;
    var flexShare = rotShare == null ? null : r1(100 - rotShare);
    var gr = deriv(tE, dt).map(function (d) { return isFinite(d) ? Math.max(0, d) : NaN; }); var grp = peak(gr, iKH, iBR, 'max'); var gainRate = grp.v == null ? null : Math.round(grp.v);
    // 팔 전달 예고(bridge) — owner는 진단8. 여기선 7-4/7-5 유형 판정·예고용.
    var armE = S.Pitching_Humerus_ME_X || []; var armPk = peak(armE, iFC, iBR, 'max'); var armPeak = armPk.v == null ? null : Math.round(armPk.v);
    var shIR = (S.Pitching_Shoulder_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }); var sirp = peak(shIR, iFC, iBR, 'max'); var dtTEPtoSIR = (iTEP != null && sirp.i != null) ? Math.round((sirp.i - iTEP) * dt * 1000) : null;
    var trkArmHandoff = (function () {
      if (!tE.length || !armE.length) return null; var rel = deriv(tE, dt).map(function (d) { return isFinite(d) ? Math.max(0, -d) : 0; }), gn = deriv(armE, dt).map(function (d) { return isFinite(d) ? Math.max(0, d) : 0; });
      var lo = (iTEP != null ? iTEP : iFC), hi = iBR; if (hi <= lo) return null; var pr = peak(rel, iFC, iBR, 'max').v || 1, pg = peak(gn, iFC, iBR, 'max').v || 1;
      var num = 0, den = 0; for (var i = lo; i <= hi && i < gn.length; i++) { num += Math.min(rel[i] / pr, gn[i] / pg) * dt; den += (gn[i] / pg) * dt; } return den > 0 ? r2(num / den) : null;
    })();
    var asr = (function () {
      var shP = S.Pitching_Shoulder_Power_X, elP = S.Pitching_Elbow_Power_X; var lo = (iTEP != null ? iTEP : iFC);
      var local = (integ(shP, lo, iBR, dt, 1) || 0) + (integ(elP, lo, iBR, dt, 1) || 0);
      var rel = deriv(tE, dt).map(function (d) { return isFinite(d) ? Math.max(0, -d) : 0; }), gn = deriv(armE, dt).map(function (d) { return isFinite(d) ? Math.max(0, d) : 0; });
      var hw = 0; for (var i = lo; i <= iBR && i < gn.length; i++) hw += Math.min(rel[i], gn[i]) * dt;
      return (local + hw) > 0 ? r2(local / (local + hw)) : null;
    })();
    // 점수(몸통 에너지 생산만)
    function nHi(v, n) { if (v == null || !n) return null; if (v >= n.med) return 90; if (v >= n.q1) return 72; var iqr = (n.q3 - n.q1) || 1; return v >= n.q1 - iqr ? 52 : 36; }
    function nRange(v, n) { if (v == null || !n) return null; if (v >= n.q1 && v <= n.q3) return 90; var iqr = (n.q3 - n.q1) || 1; var d = v < n.q1 ? n.q1 - v : v - n.q3; return d <= iqr ? 66 : 40; }
    var sE = nHi(eTotalPeak, N.eTotal), sBal = nRange(rotShare, N.rotShare), sGain = nHi(gainRate, N.gainRate);
    var prodScore = (function () { var w = { e: [0.5, sE], b: [0.25, sBal], g: [0.25, sGain] }, s = 0, ws = 0; for (var k in w) { if (w[k][1] != null) { s += w[k][0] * w[k][1]; ws += w[k][0]; } } return ws ? Math.round(s / ws) : null; })();
    // 유형 (진단7=몸통 에너지 생산. handoff/ASR 기반 전달 유형은 진단8 소유 → 여기선 bridge 예고만)
    var lowE = eTotalPeak != null && eTotalPeak < N.eTotal.q1;
    var rotDom = rotShare != null && rotShare > N.rotShare.q3, flexDom = rotShare != null && rotShare < N.rotShare.q1;
    var iqrT = (N.tTEP.q3 - N.tTEP.q1) || 1, vT = relMs(iTEP); var timingOff = vT != null && (vT < N.tTEP.q1 - iqrT || vT > N.tTEP.q3 + iqrT);
    var type;
    if (lowE) type = 'low_energy';
    else if (timingOff) type = 'peak_timing';
    else if (rotDom) type = 'rotation_dominant';
    else if (flexDom) type = 'flexion_dominant';
    else type = 'balanced';
    // 요약
    var eTxt = (eTotalPeak != null && eTotalPeak >= N.eTotal.q1) ? '몸통이 만든 힘은 충분(' + eTotalPeak + 'J, 또래 중앙 ' + N.eTotal.med + ')' : '몸통이 만든 힘(' + (eTotalPeak == null ? '–' : eTotalPeak + 'J') + ')이 또래보다 적';
    var srcTxt = (rotShare == null) ? '' : '회전 ' + rotShare + '%·앞으로 숙이기 ' + flexShare + '%로 ' + (rotDom ? '회전 우세' : flexDom ? '숙이기 우세' : '회전·숙이기 균형');
    var issue;
    if (type === 'low_energy') issue = '몸통이 만든 힘이 또래보다 적어, 팔이 부족분을 메우기 쉬운 패턴입니다. 구속을 올리려면 팔을 더 쓰기보다 몸통 힘을 먼저 키우는 것이 우선입니다(팔로 전달은 몸통→팔 단계에서 확인)';
    else if (type === 'peak_timing') issue = '몸통 힘이 가장 커지는 시점(착지' + (vT == null ? '' : '+' + vT + 'ms') + ')이 또래 범위를 벗어나, 크기보다 그 타이밍(팔로 넘기는 시점과의 정렬)을 맞추는 것이 우선일 수 있습니다';
    else if (type === 'rotation_dominant') issue = '회전으로 만든 힘 비중이 또래보다 큽니다(앞으로 숙이기 기여는 상대적으로 적음). 공 놓는 방향으로 숙이기를 더하면 전달 효율 여지가 있을 수 있습니다(영상 병행)';
    else if (type === 'flexion_dominant') issue = '또래보다 앞으로 숙이기 기여가 큰 편입니다. 회전과 숙이기 타이밍 조합, 상체 덮임을 함께 보세요';
    else issue = '몸통이 회전과 숙이기를 또래 평균 범위로 균형 있게 써 힘을 만듭니다. 다음은 이 힘이 팔로 넘어가는지(몸통→팔 단계)를 봅니다';
    var summary = '이 투수는 ' + eTxt + '하며, ' + (srcTxt ? srcTxt + '입니다. ' : '') + issue + '.';
    return {
      events: { KH: relMs(iKH), FC: 0, TEP: relMs(iTEP), TRotP: relMs(rotPk.i), TFlexP: relMs(flexPk.i), SIRP: relMs(sirp.i), ARMEP: relMs(armPk.i), BR: relMs(iBR),
        idx: { KH: iKH, FC: iFC, TEP: iTEP, TRotP: rotPk.i, TFlexP: flexPk.i, SIRP: sirp.i, ARMEP: armPk.i, BR: iBR } },
      eTotalPeak: eTotalPeak, tTEPms: relMs(iTEP), rotShare: rotShare, flexShare: flexShare, eRotPeak: eRotEst, eFlexPeak: eFlexEst, tRotEPeakMs: relMs(eRotPk.i), tFlexEPeakMs: relMs(eFlexPk.i),
      trunkLengthM: Ltrunk == null ? null : r2(Ltrunk), inertiaLong: Ilong == null ? null : r2(Ilong), inertiaFlex: Iflex == null ? null : r2(Iflex),
      rotVelPeak: rotPk.v == null ? null : Math.round(rotPk.v), tRotPeakMs: relMs(rotPk.i), flexVelPeak: flexPk.v == null ? null : Math.round(flexPk.v), tFlexPeakMs: relMs(flexPk.i),
      energyGainRate: gainRate,
      bridge: { armEnergyPeak: armPeak, shoulderIRpeak: sirp.v == null ? null : Math.round(sirp.v), dtTEPtoShoulderIR: dtTEPtoSIR, trunkArmHandoff: trkArmHandoff, armSelfReliance: asr },
      scores: { energy: sE, balance: sBal, gainRate: sGain }, prodScore: prodScore, type: type, typeKo: TRUNK7_TYPE_KO[type] || type, summary: summary, norm: N
    };
  }

  // 팔 총 에너지(de Leva 추정): 상완 ME(측정) + 전완·손 병진 KE(글로벌 프레임 COM 속도). 전완/손 ME 채널 없어 추정.
  function armTotalEnergy(t, mass, RHP) {
    var S = t.series || {}, fr = t.frames || [], dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var side = RHP ? 'r' : 'l', hum = S.Pitching_Humerus_ME_X || [];
    var mfa = 0.0162 * mass, mh = 0.0061 * mass, n = fr.length, out = new Array(n);
    function comSpeed(prox, dist, r, i) { var a = fr[i], b = fr[i - 1]; if (!a || !b || !a[prox] || !a[dist] || !b[prox] || !b[dist]) return NaN; var s = 0; for (var k = 0; k < 3; k++) { var c1 = a[prox][k] + r * (a[dist][k] - a[prox][k]), c0 = b[prox][k] + r * (b[dist][k] - b[prox][k]); s += (c1 - c0) * (c1 - c0); } return Math.sqrt(s) / dt / 1000; }
    // 전완 회전 KE(de Leva): 전완 길이=팔꿈치~손목, 장축 회전반경 IZZ=0.121. 전완 각속도(Pitching_Forearm_Ang_Vel_Z, 회내/장축). 손 회전 KE는 질량·길이 미미해 생략.
    var Lfa = (function () { var a = [], c; for (var i = 0; i < fr.length; i++) { c = fr[i]; if (c && c[side + '_elbow'] && c[side + '_wrist']) { var dd = Math.sqrt(Math.pow(c[side + '_elbow'][0] - c[side + '_wrist'][0], 2) + Math.pow(c[side + '_elbow'][1] - c[side + '_wrist'][1], 2) + Math.pow(c[side + '_elbow'][2] - c[side + '_wrist'][2], 2)); if (isFinite(dd)) a.push(dd / 1000); } } return a.length ? a.reduce(function (p, q) { return p + q; }, 0) / a.length : null; })();
    var IfaLong = Lfa != null ? mfa * Math.pow(Lfa * 0.121, 2) : 0, D2R = Math.PI / 180, faw = S.Pitching_Forearm_Ang_Vel_Z || [];
    for (var i = 0; i < n; i++) { var vfa = comSpeed(side + '_elbow', side + '_wrist', 0.4574, i), vh = comSpeed(side + '_wrist', side + '_hand_tip', 0.79, i); var h = isFinite(hum[i]) ? hum[i] : 0; var kfa = isFinite(vfa) ? 0.5 * mfa * vfa * vfa : 0, kh = isFinite(vh) ? 0.5 * mh * vh * vh : 0; var krot = (isFinite(faw[i]) && IfaLong) ? 0.5 * IfaLong * Math.pow(faw[i] * D2R, 2) : 0; out[i] = h + kfa + kh + krot; }
    return out;
  }
  // 손 COM 속도 시계열(m/s, 글로벌 프레임)
  function handSpeedSeries(t, RHP) {
    var fr = t.frames || [], dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333, side = RHP ? 'r' : 'l', n = fr.length, out = new Array(n);
    for (var i = 0; i < n; i++) { var a = fr[i], b = fr[i - 1]; if (!a || !b || !a[side + '_wrist'] || !a[side + '_hand_tip'] || !b[side + '_wrist'] || !b[side + '_hand_tip']) { out[i] = NaN; continue; } var s = 0; for (var k = 0; k < 3; k++) { var c1 = a[side + '_wrist'][k] + 0.79 * (a[side + '_hand_tip'][k] - a[side + '_wrist'][k]), c0 = b[side + '_wrist'][k] + 0.79 * (b[side + '_hand_tip'][k] - b[side + '_wrist'][k]); s += (c1 - c0) * (c1 - c0); } out[i] = Math.sqrt(s) / dt / 1000; }
    return out;
  }
  // ══ 진단8 몸통→팔 핸드오프 (개발문서 v1 · 리포트 핵심) ══
  var TA_TYPE_KO = { efficient: '잘 넘긴형', delayed_arm: '팔 늦게 반응한형', early_arm: '팔 먼저 나선형', high_e_low_handoff: '몸통 힘 크지만 못 넘긴형', arm_reliant: '팔에 의존한 구속형' };
  // 상동고 20명 그룹 기준 — /tmp/ef/p8norm.js(2026-05-27, n=20). 팔E=상완 ME + 전완·손 de Leva 추정 KE.
  // 1명(마커 아티팩트: 손속도 71m/s) 포함하나 median/IQR robust. [2026-05-28 #2] 타이밍 기준을 몸통 회전속도 peak(iTRV)로 변경. dtTEPtoSIR 기준 재산출(상동고 20명, recal_dt.js): 회전속도 peak→어깨IR peak 간격 min47/q1 56/med 65/q3 116/max 253(박찬우 253=아티팩트, 중앙·IQR robust). 옛 몸통E peak 기준 med120/q1110/q3126에서 갱신.
  var TA_NORM = { handoff: { med: 0.79, q1: 0.75, q3: 0.86 }, asr: { med: 0.17, q1: 0.12, q3: 0.2 }, dtTEPtoSIR: { med: 65, q1: 56, q3: 116 }, armEnergyPeak: { med: 385, q1: 367, q3: 435 }, shoulderIR: { med: 4055, q1: 3893, q3: 4299 }, n: 20 };
  function trunkArmEval(t, mass, RHP, R, trunkEL) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iKH = e.i_kl_peak == null ? 0 : e.i_kl_peak, iFC = e.i_fc, iBR = e.i_br, iMER = e.i_mer;
    if (iFC == null || iBR == null) return null;
    var N = TA_NORM;
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    var tE = S.Trunk_ME_X || []; var tep = peak(tE, iKH, iBR, 'max'); var iTEP = tep.i, trunkEPeak = tep.v == null ? null : Math.round(tep.v);
    var armE = armTotalEnergy(t, mass, RHP); var aep = peak(armE, iFC, iBR, 'max'); var iAEP = aep.i, armEPeak = aep.v == null ? null : Math.round(aep.v);
    var humPeak = peak(S.Pitching_Humerus_ME_X || [], iFC, iBR, 'max').v; humPeak = humPeak == null ? null : Math.round(humPeak);
    var shIR = (S.Pitching_Shoulder_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var sirp = peak(shIR, iFC, iBR, 'max'); var iSIR = sirp.i, shoulderIRpeak = sirp.v == null ? null : Math.round(sirp.v);
    // [2026-05-28 #2] 타이밍 기준 = 몸통 회전속도 peak(분절 에너지 peak는 조기정점 경향 → 간격 과대평가 보정). 에너지 overlap(handoff)은 아래에서 별도로 분절 에너지 사용.
    var trVabs = (S.Thorax_Ang_Vel_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }); var iTRV = peak(trVabs, iKH, iBR, 'max').i;
    var dtTEPtoSIR = (iTRV != null && iSIR != null) ? Math.round((iSIR - iTRV) * dt * 1000) : ((iTEP != null && iSIR != null) ? Math.round((iSIR - iTEP) * dt * 1000) : null);
    var elbV = (S.Pitching_Elbow_Ang_Vel_X || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; });
    var eep = peak(elbV, iFC, iBR, 'max'); var iEEP = eep.i, elbowExtPeak = eep.v == null ? null : Math.round(eep.v);
    var dtSIRtoElb = (iSIR != null && iEEP != null) ? Math.round((iEEP - iSIR) * dt * 1000) : null;
    var hs = handSpeedSeries(t, RHP); var hsp = peak(hs, iFC, iBR, 'max'); var iHSP = hsp.i, handSpeedPeak = hsp.v == null ? null : r1(hsp.v);
    var dtHSPtoBR = (iHSP != null) ? Math.round((iBR - iHSP) * dt * 1000) : null, dtElbToHS = (iEEP != null && iHSP != null) ? Math.round((iHSP - iEEP) * dt * 1000) : null;
    // handoff overlap (TEP~BR): 몸통E 방출률 vs 팔E 생성률 정규화 겹침
    var trkArmHandoff = (function () {
      var rel = deriv(tE, dt).map(function (d) { return isFinite(d) ? Math.max(0, -d) : 0; }), gn = deriv(armE, dt).map(function (d) { return isFinite(d) ? Math.max(0, d) : 0; });
      var lo = (iTEP != null ? iTEP : iFC), hi = iBR; if (hi <= lo) return null; var pr = peak(rel, iFC, iBR, 'max').v || 1, pg = peak(gn, iFC, iBR, 'max').v || 1;
      var num = 0, den = 0; for (var i = lo; i <= hi && i < gn.length; i++) { num += Math.min(rel[i] / pr, gn[i] / pg) * dt; den += (gn[i] / pg) * dt; } return den > 0 ? r2(num / den) : null;
    })();
    // Arm local positive work + ASR
    var armLocal = (function () { var lo = (iTEP != null ? iTEP : iFC); return r1((integ(S.Pitching_Shoulder_Power_X, lo, iBR, dt, 1) || 0) + (integ(S.Pitching_Elbow_Power_X, lo, iBR, dt, 1) || 0)); })();
    var handoffWork = (function () { var rel = deriv(tE, dt).map(function (d) { return isFinite(d) ? Math.max(0, -d) : 0; }), gn = deriv(armE, dt).map(function (d) { return isFinite(d) ? Math.max(0, d) : 0; }); var lo = (iTEP != null ? iTEP : iFC), hw = 0; for (var i = lo; i <= iBR && i < gn.length; i++) hw += Math.min(rel[i], gn[i]) * dt; return hw; })();
    var asr = (armLocal != null && (armLocal + handoffWork) > 0) ? r2(armLocal / (armLocal + handoffWork)) : null;
    // 부하 예고(진단9 소유): 어깨·팔꿈치 토크 peak
    var elbTorque = peak((S.Pitching_Elbow_Moment_X || S.Pitching_Elbow_Moment_Y || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }), iFC, iBR, 'max').v;
    var shTorque = peak((S.Pitching_Shoulder_Moment_X || S.Pitching_Shoulder_Moment_Z || []).map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }), iFC, iBR, 'max').v;
    // 점수
    function nHi(v, n) { if (v == null || !n) return null; if (v >= n.med) return 90; if (v >= n.q1) return 72; var iqr = (n.q3 - n.q1) || 1; return v >= n.q1 - iqr ? 52 : 36; }
    function nLow(v, n) { if (v == null || !n) return null; if (v <= n.med) return 90; if (v <= n.q3) return 72; var iqr = (n.q3 - n.q1) || 1; return v <= n.q3 + iqr ? 52 : 36; }
    function nRange(v, n) { if (v == null || !n) return null; if (v >= n.q1 && v <= n.q3) return 90; var iqr = (n.q3 - n.q1) || 1; var d = v < n.q1 ? n.q1 - v : v - n.q3; return d <= iqr ? 66 : 40; }
    var sHandoff = nHi(trkArmHandoff, N.handoff), sASR = nLow(asr, N.asr), sTiming = nRange(dtTEPtoSIR, N.dtTEPtoSIR);
    var taScore = (function () { var w = { h: [0.45, sHandoff], a: [0.30, sASR], t: [0.25, sTiming] }, s = 0, ws = 0; for (var k in w) { if (w[k][1] != null) { s += w[k][0] * w[k][1]; ws += w[k][0]; } } return ws ? Math.round(s / ws) : null; })();
    // 유형
    var earlyArm = dtTEPtoSIR != null && dtTEPtoSIR < 0;
    var delayedArm = dtTEPtoSIR != null && dtTEPtoSIR > N.dtTEPtoSIR.q3 && trkArmHandoff != null && trkArmHandoff < N.handoff.q1;
    var hiE = trunkEPeak != null && trunkEPeak >= 489, lowHandoff = trkArmHandoff != null && trkArmHandoff < N.handoff.q1, hiASR = asr != null && asr > N.asr.q3;
    var type;
    if (earlyArm) type = 'early_arm';
    else if (hiE && lowHandoff && hiASR) type = 'high_e_low_handoff';
    else if (delayedArm) type = 'delayed_arm';
    else if (hiASR) type = 'arm_reliant';
    else type = 'efficient';
    // 요약
    var seqTxt = '몸통 회전 속도 최고점(착지' + (relMs(iTRV) == null ? '' : '+' + relMs(iTRV) + 'ms') + ')→어깨 회전(착지+' + (relMs(iSIR) || '–') + 'ms, 간격 ' + (dtTEPtoSIR == null ? '–' : dtTEPtoSIR + 'ms') + ')→팔꿈치 펴기→손(착지+' + (relMs(iHSP) || '–') + 'ms)';
    var issue;
    if (type === 'efficient') issue = '몸통 힘이 어깨 회전·팔 가속으로 잘 이어집니다(전달 맞물림 ' + (trkArmHandoff == null ? '–' : trkArmHandoff) + ', 팔 의존도 ' + (asr == null ? '–' : asr) + '). 팔이 몸통 힘을 받아 던지는 효율적 패턴';
    else if (type === 'delayed_arm') issue = '몸통 회전 최고점 이후 어깨 회전이 늦게(간격 ' + dtTEPtoSIR + 'ms) 따라와, 몸통 힘이 팔로 제때 못 넘어가 팔이 스스로 메우는 부담이 커질 수 있';
    else if (type === 'early_arm') issue = '어깨 회전이 몸통 회전 최고점보다 먼저 작동(간격 ' + dtTEPtoSIR + 'ms)해, 팔이 몸통보다 앞서 움직이는 팔 중심 패턴일 수 있';
    else if (type === 'high_e_low_handoff') issue = '몸통 힘은 충분하지만(' + (trunkEPeak || '–') + 'J) 팔로 넘기는 연결이 약하고(맞물림 ' + (trkArmHandoff == null ? '–' : trkArmHandoff) + ') 팔 자체 의존이 큽니다(팔 의존도 ' + (asr == null ? '–' : asr) + '). 몸통을 더 쓰기보다 몸통 최고점 이후 어깨 회전 타이밍을 맞추는 것이 우선';
    else issue = '공은 빠르게 던질 수 있어도 팔 자체 부담(팔 의존도 ' + (asr == null ? '–' : asr) + ')으로 구속을 만드는 경향이 있어, 길게 보면 몸통→팔 전달 효율 개선이 필요할 수 있';
    var summary = '이 투수는 ' + seqTxt + ' 순서이며, ' + issue + '는 패턴입니다.';
    return {
      events: { KH: relMs(iKH), FC: 0, TEP: relMs(iTEP), SIRP: relMs(iSIR), EEP: relMs(iEEP), HSP: relMs(iHSP), AEP: relMs(iAEP), MER: relMs(iMER), BR: relMs(iBR),
        idx: { KH: iKH, FC: iFC, TEP: iTEP, SIRP: iSIR, EEP: iEEP, HSP: iHSP, AEP: iAEP, MER: iMER, BR: iBR } },
      trunkEnergyPeak: trunkEPeak, armEnergyPeak: armEPeak, humerusEnergyPeak: humPeak,
      shoulderIRpeak: shoulderIRpeak, dtTEPtoShoulderIR: dtTEPtoSIR, elbowExtPeak: elbowExtPeak, dtSIRtoElbow: dtSIRtoElb,
      handSpeedPeak: handSpeedPeak, dtElbowToHand: dtElbToHS, dtHandToBR: dtHSPtoBR,
      trunkArmHandoff: trkArmHandoff, armLocalWork: armLocal, armSelfReliance: asr,
      elbowTorquePeak: elbTorque == null ? null : Math.round(elbTorque), shoulderTorquePeak: shTorque == null ? null : Math.round(shTorque),
      scores: { handoff: sHandoff, asr: sASR, timing: sTiming }, taScore: taScore, type: type, typeKo: TA_TYPE_KO[type] || type, summary: summary, norm: N
    };
  }

  // ══ 진단9 팔→공 방출 효율·부하 비용 (개발문서 v1) ══
  var AB_TYPE_KO = { efficient: '잘 풀어낸형', early_hand: '손끝 가속 조기형', late_hand: '손끝 속도 늦은형', high_load_low_out: '출력 효율 향상 여지형', high_velo_high_load: '구속 높지만 부담 큰형', low_output: '출력 향상 여지형' };
  // 상동고 20명 그룹 기준 — /tmp/ef/p9norm.js(2026-05-27, n=20). 공속도=meta.ball_speed_max. transferProxy=공KE/팔E(de Leva).
  // 1명 마커 아티팩트(팔꿈치 토크 1316N·m·손71m/s) 포함하나 median/IQR robust. 엘리트라 어깨·팔꿈치 토크는 본래 높음(부하=구속의 비용).
  var AB_NORM = { ballV: { med: 141.7, q1: 140.1, q3: 144.7 }, handSpeed: { med: 25.9, q1: 25.1, q3: 27.2 }, dtHandToBR: { med: 8.5, q1: 7, q3: 10 }, elbowTorque: { med: 51.5, q1: 43, q3: 65 }, shoulderTorque: { med: 170, q1: 147, q3: 200 }, transferProxy: { med: 0.29, q1: 0.25, q3: 0.32 }, ballPerElbow: { med: 0.77, q1: 0.61, q3: 0.9 }, n: 20 };
  function armBallEval(t, mass, RHP, R, trunkArmL, ballKmh) {
    var S = t.series || {}, e = t.events || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var iFC = e.i_fc, iBR = e.i_br, iMER = e.i_mer;
    if (iFC == null || iBR == null) return null;
    var N = AB_NORM, A = trunkArmL || {};
    function relMs(i) { return i == null ? null : Math.round((i - iFC) * dt * 1000); }
    var ballV = (ballKmh != null && isFinite(ballKmh)) ? r1(ballKmh) : null;
    var ballMs = ballV == null ? null : ballV / 3.6, ballKE = ballMs == null ? null : Math.round(0.5 * 0.145 * ballMs * ballMs);
    var handSpeedPeak = A.handSpeedPeak != null ? A.handSpeedPeak : null;
    var dtHandToBR = A.dtHandToBR != null ? A.dtHandToBR : null;
    var armEPeak = A.armEnergyPeak != null ? A.armEnergyPeak : null;
    var asr = A.armSelfReliance != null ? A.armSelfReliance : null;
    // 토크 peak·impulse (FC~BR). 부호 무시 magnitude.
    function tqPk(keys) { var arr = null; for (var k = 0; k < keys.length; k++) { if (S[keys[k]]) { arr = S[keys[k]]; break; } } if (!arr) return { v: null, imp: null }; var ab = arr.map(function (x) { return isFinite(x) ? Math.abs(x) : NaN; }); return { v: peak(ab, iFC, iBR, 'max').v, imp: integ(ab, iFC, iBR, dt, 0) }; }
    var elb = tqPk(['Pitching_Elbow_Moment_X', 'Pitching_Elbow_Moment_Y', 'Pitching_Elbow_Moment_Z']);
    var sho = tqPk(['Pitching_Shoulder_Moment_X', 'Pitching_Shoulder_Moment_Z', 'Pitching_Shoulder_Moment_Y']);
    var elbowTorque = elb.v == null ? null : Math.round(elb.v), elbowImpulse = elb.imp == null ? null : r1(elb.imp);
    var shoulderTorque = sho.v == null ? null : Math.round(sho.v), shoulderImpulse = sho.imp == null ? null : r1(sho.imp);
    // 전달 효율 proxy: 공KE / 팔에너지peak (de Leva 팔E). 무차원 비율(완전효율 아님).
    var transferProxy = (ballKE != null && armEPeak != null && armEPeak > 0) ? r2(ballKE / armEPeak) : null;
    var ballPerHand = (ballMs != null && handSpeedPeak != null && handSpeedPeak > 0) ? r2(ballMs / handSpeedPeak) : null;
    var ballPerElbow = (ballMs != null && elbowTorque != null && elbowTorque > 0) ? r2(ballMs / elbowTorque) : null;
    // 비용 지표(그룹 상대): 토크·ASR 높고 구속 낮으면 cost↑
    function zc(v, n) { if (v == null || !n) return 0; return (v - n.med) / (((n.q3 - n.q1) / 1.349) || 1); }
    var velocityCostIndex = r2(zc(elbowTorque, N.elbowTorque) + zc(shoulderTorque, N.shoulderTorque) + zc(asr, { med: 0.17, q1: 0.12, q3: 0.2 }) - zc(ballV, N.ballV));
    // 점수: output(구속·전달proxy) - cost(토크). 그룹 기준.
    function nHi(v, n) { if (v == null || !n) return null; if (v >= n.med) return 90; if (v >= n.q1) return 72; var iqr = (n.q3 - n.q1) || 1; return v >= n.q1 - iqr ? 52 : 36; }
    function nLow(v, n) { if (v == null || !n) return null; if (v <= n.med) return 90; if (v <= n.q3) return 72; var iqr = (n.q3 - n.q1) || 1; return v <= n.q3 + iqr ? 52 : 36; }
    function nRange(v, n) { if (v == null || !n) return null; if (v >= n.q1 && v <= n.q3) return 90; var iqr = (n.q3 - n.q1) || 1; var d = v < n.q1 ? n.q1 - v : v - n.q3; return d <= iqr ? 66 : 40; }
    var sOut = nHi(ballV, N.ballV), sTransfer = nHi(transferProxy, N.transferProxy), sRelTiming = nRange(dtHandToBR, N.dtHandToBR), sCost = nLow(elbowTorque, N.elbowTorque);
    var abScore = (function () { var w = { o: [0.35, sOut], t: [0.25, sTransfer], r: [0.20, sRelTiming], c: [0.20, sCost] }, s = 0, ws = 0; for (var k in w) { if (w[k][1] != null) { s += w[k][0] * w[k][1]; ws += w[k][0]; } } return ws ? Math.round(s / ws) : null; })();
    // 유형
    var hiV = ballV != null && ballV >= N.ballV.med, lowV = ballV != null && ballV < N.ballV.q1;
    var hiTq = (elbowTorque != null && elbowTorque > N.elbowTorque.q3) || (shoulderTorque != null && shoulderTorque > N.shoulderTorque.q3);
    var earlyHand = dtHandToBR != null && dtHandToBR > N.dtHandToBR.q3 + (N.dtHandToBR.q3 - N.dtHandToBR.q1);
    var lateHand = dtHandToBR != null && dtHandToBR < 0;
    var lowHand = handSpeedPeak != null && handSpeedPeak < N.handSpeed.q1;
    var type;
    if (lateHand) type = 'late_hand';
    else if (earlyHand) type = 'early_hand';
    else if (hiV && hiTq) type = 'high_velo_high_load';
    else if (!hiV && hiTq) type = 'high_load_low_out';
    else if (lowV && lowHand) type = 'low_output';
    else type = 'efficient';
    // 요약
    var outTxt = '공 속도 ' + (ballV == null ? '–' : ballV + 'km/h') + '(공 에너지 ' + (ballKE == null ? '–' : ballKE + 'J') + ') · 손끝 속도 최고 ' + (handSpeedPeak == null ? '–' : handSpeedPeak + 'm/s') + '(공 놓는 순간 대비 ' + (dtHandToBR == null ? '–' : (dtHandToBR >= 0 ? dtHandToBR + 'ms 전' : (-dtHandToBR) + 'ms 후') ) + ')';
    var issue;
    if (type === 'efficient') issue = '팔·손끝 속도가 공 놓는 순간 근처에서 공으로 잘 전달되고, 구속에 비해 팔 부담도 효율적인';
    else if (type === 'late_hand') issue = '손끝 속도 최고점이 공을 놓은 뒤/너무 늦게 나타나, 공이 손을 떠난 뒤에 속도가 올라가 실제 구속에 반영되지 못할 수 있는(공 놓는 시점·마커 확인 필요)';
    else if (type === 'early_hand') issue = '손끝 속도 최고점이 공 놓기보다 너무 일찍 나타나, 마지막 속도가 공에 충분히 실리지 못할 수 있는';
    else if (type === 'high_velo_high_load') issue = '구속은 나오지만 팔꿈치(' + (elbowTorque || '–') + 'N·m)·어깨(' + (shoulderTorque || '–') + 'N·m)에 걸리는 부담이 커, 큰 부담으로 구속을 만드는 — 길게 보면 같은 구속을 더 낮은 부담으로 내야 하는';
    else if (type === 'high_load_low_out') issue = '팔 부담은 큰데 공 속도로 충분히 바뀌지 않는 비효율적인 — 팔을 더 쓰기보다 몸통→팔 전달과 공 놓는 타이밍 개선이 먼저인';
    else issue = '마지막 팔·손끝 속도 자체가 부족해 공 속도가 제한되는 — 몸통→팔 전달과 팔 내부 순서를 함께 확인해야 하는';
    var summary = '이 투수는 ' + outTxt + '이며, ' + issue + ' 패턴입니다.';
    return {
      events: { FC: 0, SIRP: A.events ? A.events.SIRP : null, EEP: A.events ? A.events.EEP : null, HSP: A.events ? A.events.HSP : null, MER: relMs(iMER), BR: relMs(iBR) },
      ballVelocityKmh: ballV, ballKE: ballKE, handSpeedPeak: handSpeedPeak, dtHandToBR: dtHandToBR,
      dtSIRtoElbow: A.dtSIRtoElbow, dtElbowToHand: A.dtElbowToHand,
      armEnergyPeak: armEPeak, transferProxy: transferProxy, ballPerHandSpeed: ballPerHand, ballPerElbowTorque: ballPerElbow,
      elbowTorquePeak: elbowTorque, elbowTorqueImpulse: elbowImpulse, shoulderTorquePeak: shoulderTorque, shoulderTorqueImpulse: shoulderImpulse, armSelfReliance: asr,
      velocityCostIndex: velocityCostIndex,
      scores: { output: sOut, transfer: sTransfer, releaseTiming: sRelTiming, cost: sCost }, abScore: abScore, type: type, typeKo: AB_TYPE_KO[type] || type, summary: summary, norm: N
    };
  }

  // ══ 진단 기반 팔 부담·부하 평가 (부상 위험 재판단) — output(구속) 대비 cost, 전달 비효율이 부하를 키우는지 ══
  // 부상 '예측'이 아니라 '팔 부담 비용' 관점(선수전달 가이드 §14): 진단8/9 토크·ASR·전달효율을 근거로.
  function injuryFromDiagnosis(X) {
    var ab = X.armball9, ta = X.trunkarm8, kn = X.knee5, bl = X.blocking, p6 = X.pelvistrunk6, t7 = X.trunk7;
    if (!ab) return null;
    var N = ab.norm || {}, TN = (ta && ta.norm) || { asr: { med: 0.17, q3: 0.2 } };
    function lv3(v, med, q3) { if (v == null) return null; return v > q3 ? 2 : (v > med ? 1 : 0); }
    var elbV = ab.elbowTorquePeak, shoV = ab.shoulderTorquePeak, asr = (ta && ta.armSelfReliance != null) ? ta.armSelfReliance : (ab.armSelfReliance);
    var elbLv = lv3(elbV, N.elbowTorque && N.elbowTorque.med, N.elbowTorque && N.elbowTorque.q3);
    var shoLv = lv3(shoV, N.shoulderTorque && N.shoulderTorque.med, N.shoulderTorque && N.shoulderTorque.q3);
    var asrLv = lv3(asr, TN.asr.med, TN.asr.q3);
    var lvs = [elbLv, shoLv, asrLv].filter(function (x) { return x != null; });
    var hi = lvs.filter(function (x) { return x === 2; }).length, mid = lvs.filter(function (x) { return x === 1; }).length;
    var level = hi >= 2 ? 'high' : ((hi >= 1 || mid >= 2) ? 'moderate' : 'low');
    var levelKo = { high: '높음', moderate: '보통', low: '낮음' }[level];
    // 부하를 키우는 진단 근거(원인) — 전달 비효율 → 팔 자체 보완
    var drivers = [];
    if (ta && (ta.type === 'delayed_arm' || ta.type === 'high_e_low_handoff' || ta.type === 'arm_reliant'))
      drivers.push({ stage: '진단8 몸통→팔', tab: 'ed-trunkarm', text: '몸통 에너지가 팔로 늦게/덜 전달되어(' + ta.typeKo + ') 팔이 부족분을 스스로 보완 → 팔 부담↑' });
    if (asrLv === 2) drivers.push({ stage: '진단8 ASR', tab: 'ed-trunkarm', text: '팔 자체 의존도(ASR ' + asr + ')가 그룹 상위 — 팔 국소 생성 부담 큼' });
    if (elbLv === 2) drivers.push({ stage: '진단9 팔꿈치 토크', tab: 'ed-armball', text: '팔꿈치 토크 peak ' + elbV + 'N·m가 그룹 상위(중앙 ' + (N.elbowTorque && N.elbowTorque.med) + ')' });
    if (shoLv === 2) drivers.push({ stage: '진단9 어깨 토크', tab: 'ed-armball', text: '어깨 토크 peak ' + shoV + 'N·m가 그룹 상위(중앙 ' + (N.shoulderTorque && N.shoulderTorque.med) + ')' });
    if (ab.type === 'high_velo_high_load') drivers.push({ stage: '진단9 output/cost', tab: 'ed-armball', text: '강속구(' + (ab.ballVelocityKmh) + 'km/h)를 높은 관절 부하로 만드는 패턴 — 부하는 구속의 비용' });
    if (kn && kn.work && kn.work.absorptionRatio != null && kn.norm && kn.work.absorptionRatio > kn.norm.absorptionRatio.q3)
      drivers.push({ stage: '진단5 무릎 흡수', tab: 'ed-knee', text: '리드 무릎 흡수 비율(' + kn.work.absorptionRatio + ')이 높아 하체 에너지가 일부 무릎에서 소실 → 상위 단계가 보완' });
    if (!drivers.length) drivers.push({ stage: '진단 종합', tab: 'etdiag', text: '전달 효율이 양호해 팔 자체 부담을 키우는 뚜렷한 비효율이 없습니다' });
    // 요약(성능-비용 프레이밍, 부상 공포 금지)
    var costTxt = (level === 'low') ? '현재 구속을 비교적 효율적인 팔 부담으로 만들고 있습니다. 전달 효율을 유지하면 부담이 과해지지 않습니다.'
      : (level === 'moderate') ? '현재 구속을 만들 때 팔꿈치·어깨 부담이 보통~다소 높은 수준입니다. 전달 효율을 높이면 같은 구속을 더 낮은 부담으로 만들 수 있습니다.'
      : '현재 구속을 만들 때 팔꿈치·어깨가 부담하는 비용이 큰 편입니다. 목표는 더 빠른 공이 아니라, 같은 구속을 더 낮은 팔 부담으로 만드는 것입니다(몸통→팔 전달 개선).';
    return {
      level: level, levelKo: levelKo,
      elbowTorque: elbV, elbowLevel: elbLv, shoulderTorque: shoV, shoulderLevel: shoLv, armSelfReliance: asr, asrLevel: asrLv,
      elbowImpulse: ab.elbowTorqueImpulse, shoulderImpulse: ab.shoulderTorqueImpulse, ballVelocity: ab.ballVelocityKmh, velocityCostIndex: ab.velocityCostIndex,
      drivers: drivers, summary: costTxt, basis: '진단8(몸통→팔 전달·ASR)·진단9(팔꿈치/어깨 토크·output/cost)·진단5(무릎 흡수) 종합'
    };
  }

  return { compute: compute, powerSequence: powerSequence, powerSeqTrial: powerSeqTrial, trunkEnergySplit: trunkEnergySplit, rawTrial: rawTrial, windupLoading: windupLoading, strideEval: strideEval, xfactorTiming: xfactorTiming, blockingEval: blockingEval, kneeTransfer: kneeTransfer, pelvisTrunkEval: pelvisTrunkEval, trunkEnergyEval: trunkEnergyEval, trunkArmEval: trunkArmEval, armBallEval: armBallEval, injuryFromDiagnosis: injuryFromDiagnosis, armTotalEnergy: armTotalEnergy, handSpeedSeries: handSpeedSeries, TAG: TAG };
});
