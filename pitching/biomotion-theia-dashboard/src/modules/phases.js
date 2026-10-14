// @SYSTEM=THEIA · dashboard_core SSOT — uplift/core 와 독립. 무단 cp 금지(check_system_isolation.py 배포가드). 시스템별 의도적 변경만.

// phases.js — 5단계 생체역학 메카닉 (에너지 저장→드라이브→블로킹→에너지 방출→에너지 전달)
// BioMotion 5모델 대체. 점수는 문헌/OBP 145km/h+ 상위5% 기준이 있는 변인만, 없으면 값만.
// ⚠️ [2026-06-19] Theia↔Uplift 격리: 이 파일은 Theia 의 SSOT. uplift core/phases.js 와 현재
//   byte-동일(cp)이나 이는 우연이며, **uplift 변경을 무조건 cp 로 덮지 말 것**. 특히 '동작 유형' 분류
//   메트릭(blockingType·driveType·kneeExtROM·vgrfPattern·각 단계 유형카드)은 Theia 차별점 —
//   uplift(마커리스 IMU) 평가와 뒤섞이면 유형이 소실됨. 배포 가드 check_theia_typecards.py 가
//   players.js 의 단계별 유형카드·차별화평가(typeNeutral) 소실 시 배포를 차단한다(영구 보호).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.phases = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function peak(a, lo, hi, abs) {
    if (!a) return { v: null, i: null };
    lo = lo || 0; hi = (hi == null ? a.length - 1 : hi);
    var b = -Infinity, bi = null;
    for (var i = lo; i <= hi && i < a.length; i++) { var v = a[i]; if (!isFinite(v)) continue; var t = abs ? Math.abs(v) : v; if (t > b) { b = t; bi = i; } }
    return { v: b === -Infinity ? null : a[bi], i: bi };
  }
  function valAt(a, i) { return (a && i != null && i < a.length && isFinite(a[i])) ? a[i] : null; }
  /* [2026-08-12 코덱스 P1-1 확정 반영] 창 부적격·유효 표본 0 → null(0 아님 — 0은 실측값이라 결측 대체 금지).
     ①lo/hi null이면 옛 코드는 null<hi 비교(null→0 강제)로 0부터 몰래 적분했다 → null 반환.
     ②창 안에 finite 표본이 하나도 없으면(전부 NaN·빈 창·역전 창) → null 반환.
     ★값 보존: finite 표본이 있는데 부호 필터로 전부 걸러진 경우(예: 음의 파워만 있는 ∫P⁺)는
       물리적으로 유효한 0이므로 그대로 0 — 기존 유효 산출값은 전부 불변. */
  function integ(a, lo, hi, dt, sign) {
    if (!a || lo == null || hi == null || !(hi > lo) || !dt) return null;
    var s = 0, nf = 0;
    for (var i = lo; i < hi && i < a.length; i++) { var v = a[i]; if (!isFinite(v)) continue; nf++; if (sign > 0 && v < 0) continue; if (sign < 0 && v > 0) continue; s += v * dt; }
    return nf ? s : null;
  }
  function deriv(a, dt) { var o = []; for (var i = 0; i < a.length; i++) o.push((i === 0 || !isFinite(a[i]) || !isFinite(a[i - 1])) ? NaN : (a[i] - a[i - 1]) / dt); return o; }
  function r1(x) { return x == null ? null : Math.round(x * 10) / 10; }
  function r2(x) { return x == null ? null : Math.round(x * 100) / 100; }
  function absn(x) { return x == null ? null : Math.abs(x); }
  function sc(v, ref, per, dir) { if (v == null || ref == null || !per) return null; var sgn = dir === -1 ? -1 : 1; return Math.max(20, Math.min(100, Math.round(100 + sgn * (v - ref) / per * 5))); }
  // 범위(윈도우) 점수: 엘리트 IQR[q1,q3] 안=최고, 1 IQR 벗어남=중간, 그 이상=낮음. (방향 우열이 아니라 '정상 윈도우' 변인용 — remap 전 sc 스케일로 반환: 88/80/72 → elite ~89/65/41)
  function scR(v, q1, q3) { if (v == null || q1 == null || q3 == null) return null; if (v >= q1 && v <= q3) return 88; var iqr = (q3 - q1) || 1; var d = v < q1 ? (q1 - v) : (v - q3); return d <= iqr ? 80 : 72; }

  function compute(trial, meta, energyTransfer, allTrials, command) {
    var bw = (((meta && meta.weight_kg) || 86) * 9.80665);
    var ht = ((meta && meta.height_m) || 1.8);  // 신장(m) — 스트라이드 %신장 정규화에 사용
    var RHP = (((meta && meta.handedness) || 'R').toUpperCase() !== 'L');
    var UPLIFT = !!(meta && String(meta.system||'').toLowerCase()==='uplift');  // Uplift=키네매틱전용(trunk절대각 규약 다름)

    // ── 단일 투구 스칼라 계산 (best/fast/slow 공통) ──
    function scalars(t) {
      var S = t.series || {}, ev = t.events || {}, dt = (t.setup && t.setup.dt) || (t.meta && t.meta.dt) || 0.00333;
      var ikl = ev.i_kl_peak || 0, ifc = ev.i_fc, ibr = ev.i_br;
      var pctf = function (v) { return v == null ? null : v / bw * 100; };
      var rearHipMom = RHP ? S.R_Hip_Moment_Z : S.L_Hip_Moment_Z;
      var merPk = peak(S.Pitching_Shoulder_Angle_Z, ifc, ibr, true).v;  /* [2026-08-12 코덱스 P1-2] signed→max-abs 통일 — 실데이터 65명 전수에서 두 방식 동일(양수 관례 채널)·값 불변. 방어적 규약 통일 */
      var scapLoad = absn(valAt(S.Pitching_Shoulder_Angle_X, ifc));  // 견갑골 로딩 프록시: FC 어깨 수평외전 |각| (마커리스 견갑골 직접측정 불가)
      // [2026-06-05 정책] X-Factor SSOT = trial.x_factor (Trunk_wrt_Pelvis_Angle_Z · 골반 기준 몸통 Z축 상대회전) KH→BR peak.
      //   Uplift: vendor max_x_factor 헤드라인 폴백 가능 · 파생 타이밍은 항상 trial.x_factor.
      var _xfArr = t.x_factor || [];
      var _xfPk = peak(_xfArr, ikl, ibr, true);
      var xfPeak = (UPLIFT && t.scalars && t.scalars.max_x_factor != null && isFinite(t.scalars.max_x_factor))
        ? t.scalars.max_x_factor : _xfPk.v;
      // [2026-05-27] X-Factor 풀림(flying open) 지표 — series 곡선 기반(헤드라인 소스와 무관하게 타이밍은 series로 평가).
      //   (1) xfPeakFromFC: peak 분리 시점 − FC (ms). 엘리트 중앙 +13ms(FC 직후 유지). 음수 클수록 조기 풀림=flying open.
      //   (2) xfUnwindV: peak 이후 BR 까지 분리 감소 최대 각속도(°/s). 풀림(상체가 골반 따라잡기) 속도.
      //   ★ FC 검출 의존: Theia=앞발 GRF(신뢰), Uplift=검출로직(Theia 교차검증으로 보정 — 14쌍 오차 기록).
      var xfPeakFromFC = (_xfPk.i != null && ifc != null && dt) ? Math.round((_xfPk.i - ifc) * dt * 1000) : null;
      var xfUnwindV = null;
      if (_xfPk.i != null && ibr != null && ibr > _xfPk.i + 1 && dt) {
        var _uw = 0; for (var _k = _xfPk.i + 1; _k <= ibr && _k < _xfArr.length; _k++) {
          var _d = (Math.abs(_xfArr[_k - 1]) - Math.abs(_xfArr[_k])) / dt; if (isFinite(_d) && _d > _uw) _uw = _d; }
        xfUnwindV = _uw > 0 ? Math.round(_uw) : null;
      }
      // [2026-05-27] flying open 주지표(교수 제안): FC 시 X-Factor를 최대와 비교 → "FC까지 이미 얼마나 풀렸나".
      //   xfAtFC = FC 시 |X-Factor|. peak가 FC 이전이면 (peak − FC값)=FC까지 풀린 양 → /peak*100 = 풀린 비율(%). peak가 FC 이후면 0(분리 유지).
      //   엘리트 그룹: 중앙 0% · p90 5% · 최대 16%(FC 유지율 95~97%). >25%면 명백한 flying open. 풀림 시점+풀림량을 한 지표로 통합.
      var _xfAtFC = valAt(_xfArr, ifc); _xfAtFC = (_xfAtFC == null) ? null : Math.abs(_xfAtFC);
      var _xfPkMag = (_xfPk.v == null) ? null : Math.abs(_xfPk.v);
      var xfAtFC = (_xfAtFC == null) ? null : Math.round(_xfAtFC * 10) / 10;
      var xfReleasedPctByFC = null;
      if (_xfAtFC != null && _xfPkMag != null && _xfPkMag > 1) {
        var _rel = (_xfPk.i != null && ifc != null && _xfPk.i < ifc) ? (_xfPkMag - _xfAtFC) : 0;
        xfReleasedPctByFC = Math.max(0, Math.round(_rel / _xfPkMag * 1000) / 10);
      }
      // KH 이전 최대 꼬임 토크 = 가장 음수인 FP1_Z_3(꼬임=−)의 크기. 양의 피크(KH직전 열림/드라이브 토크) 아님
      var _fpCoil = peak((S.FP1_Z_3 || []).map(function (x) { return isFinite(x) ? -x : x; }), 0, ikl, false).v;  // = -min = |음의 피크|
      var freeMo = (_fpCoil == null) ? null : _fpCoil;
      // 골반 닫힘각(셋업→KH gain): KH 이전 골반이 홈 반대로 꼬인(닫힌) 양. 우투=각 증가가 닫힘, 좌투=각 감소가 닫힘. freeMo와 r≈0.68(코일 운동학 지표)
      var pelZ = S.Pelvis_Angle_Z || [];
      var pelStart = null; for (var _pi = 0; _pi < pelZ.length; _pi++) { if (isFinite(pelZ[_pi])) { pelStart = pelZ[_pi]; break; } }
      var pelMax = peak(pelZ, 0, ikl, false).v;
      var pelMin = peak(pelZ.map(function (x) { return isFinite(x) ? -x : x; }), 0, ikl, false).v;
      pelMin = (pelMin == null) ? null : -pelMin;
      // [FIX 2026-05-26] 골반 닫힘각 복원: Back_Hip_Rotation_X 채널이 어떤 익스포트에도 없어(전원 null) Pelvis_Angle_Z 기반 셋업→KH 회전 excursion으로 환원.
      // 닫힘 정도 = 셋업(초기)에서 KH 이전까지 골반 횡단면 회전의 최대 절대 편차(좌우 무관 — 양 손잡이 모두 단방향 코일 확인).
      var pelClose = (pelStart != null && (pelMax != null || pelMin != null))
        ? Math.max(pelMax != null ? Math.abs(pelMax - pelStart) : 0, pelMin != null ? Math.abs(pelMin - pelStart) : 0)
        : null;
      // 힙 힌지: KH 이전 뒷고관절(스탠스다리) 시상면 최대 굴곡 — "뒷고관절에 앉아" 적재. 좌우 무관(Back_Hip=스탠스다리 기준). pelClose/freeMo와 r≈0.5(보완적 시상면 적재)
      /* [2026-08-02 정의 변경 · 교수 확정] 시작~KH → 니하이(KH)~앞발착지(FC) 드라이브 구간 최대.
         근거·밴드 재산출 = _ku_theia_bake/HANDOVER_hipHinge_drivewindow_260707.md.
         옛 창은 선수마다 피크 위치가 구간의 0~100%로 흩어지고 일부는 셋업 자세를 잡았다.
         새 창은 '뒷고관절에 앉는' 실제 적재 구간이다(피크가 KH~FC의 70~90%에 몰림). */
      var hipHinge = peak(S.Back_Hip_Angle_X, ikl, (ifc != null ? ifc : ibr), false).v;
      var tzRaw = valAt(S.Trunk_Angle_Z, ifc);
      var openAng = UPLIFT ? ((t.trunk_fc && t.trunk_fc.openAng!=null)?t.trunk_fc.openAng:null) : (tzRaw == null ? null : (RHP ? (90 - tzRaw) : (tzRaw - 90)));
      var txRaw = valAt(S.Trunk_Angle_X, ifc);
      var leanBack = UPLIFT ? ((t.trunk_fc && t.trunk_fc.leanBack!=null)?t.trunk_fc.leanBack:null) : (txRaw == null ? null : -txRaw);
      // ★[2026-10-12 교수 「권장대로」] 추진 점수 변인(최대힘·임펄스·peak 타이밍)에 진행 부호 적용 — 뒷발판 FP1_Y 는 진행 방향과 같은 부호(확정판 358/358 검증 · 2026-10-11)라
      //   +Y 로 던진 세션(코호트·현장 전부)은 값 불변 · 반대 방향으로 던진 세션(옛 고려대 꼴)은 전엔 0 으로 떨어졌음 → 진행 부호 = KH→FC COM_Velocity_Y 평균의 부호(없으면 +1)
      var _fwdSign = (function () { var cv = S.COM_Velocity_Y; if (!cv || ikl == null || ifc == null || !(ifc > ikl)) return 1; var s = 0, n = 0; for (var i = ikl; i < ifc && i < cv.length; i++) { if (isFinite(cv[i])) { s += cv[i]; n++; } } return (n && s < 0) ? -1 : 1; })();
      var _fp1Fwd = S.FP1_Y ? S.FP1_Y.map(function (x) { return isFinite(x) ? _fwdSign * x : x; }) : S.FP1_Y;
      var rearPropN = peak(_fp1Fwd, ikl, ifc, false).v;
      var propImp = integ(_fp1Fwd, ikl, ifc, dt, 1);
      var comVel = peak(S.COM_Velocity_Y, ikl, ibr, false).v;
      // COM 수직 낙하 (KH→FC, cm) — 마운드 내리막+하체로 위치E→전진 운동량. 검증(34명): 엘리트>상동고 p=.004, 구속 r=.52.
      var comVDrop = (function(){ var z = S.COM_displacement_Z; if (!z || ikl == null || ifc == null || !isFinite(z[ikl]) || !isFinite(z[ifc])) return null; return (z[ikl] - z[ifc]) * 100; })();
      // [2026-06-03] 자세 유지(Posture Maintenance) = 0.7·COM 낙하 + 0.3·몸통 전경변화(KH→FC). 힙 힌지 carryover 비율(불안정) 대체.
      // 몸통 전경변화 = Trunk_Angle_X[KH]−Trunk_Angle_X[FC] (+면 KH→FC 더 숙임/유지, −면 세워짐). 부호규약: 음수=전경(개발자 검증).
      var trunkLeanChange = (S.Trunk_Angle_X && ifc != null && isFinite(S.Trunk_Angle_X[ikl]) && isFinite(S.Trunk_Angle_X[ifc])) ? (S.Trunk_Angle_X[ikl] - S.Trunk_Angle_X[ifc]) : null;
      var postureMaint = (function () {   // [v2] 단위 혼합 방지 — 백분위 가중합(0.7 COM낙하 + 0.3 몸통전경변화), 0~100
        var NB = (typeof PITCH_NORMS !== 'undefined') ? PITCH_NORMS : null, PS = (typeof PITCH_STATS !== 'undefined') ? PITCH_STATS : null;
        if (!NB || !PS) return (comVDrop != null ? comVDrop : null);
        function pc(v, nm) { if (v == null || !nm) return null; return PS.cdf(PS.stat(v, nm, 1).z) * 100; }
        var a = pc(comVDrop, NB.comVDrop), b = pc(trunkLeanChange, NB.trunkLeanChange);
        if (a != null && b != null) return 0.7 * a + 0.3 * b;
        return a != null ? a : null;
      })();
      // [FIX 0525] 외전→내전 속도: 외전각 감소 방향(=내전)의 peak 각속도. (-d(abduction)/dt 의 양의 peak, KH~릴리스)
      var hipAbd = peak(deriv(S.Back_Hip_Angle_Y || [], dt).map(function(x){return isFinite(x)?-x:x;}), ikl, ibr, false).v;
      var iR = peak(S.FP1_Z, ikl, ibr, false).i, iL = peak(S.FP2_Z, ikl, ibr, false).i;
      var grfDelay = (iR != null && iL != null) ? (iL - iR) * dt * 1000 : null;
      // 뒷다리 신전 일(드라이브): KH→FC 뒷고관절+뒷무릎 양의 일(∫P·dt) = 드라이브가 생성한 관절 에너지(동력원)
      var _dwHip = integ(S.Back_Hip_Power_X, ikl, ifc, dt, 1), _dwKnee = integ(S.Back_Knee_Power_X, ikl, ifc, dt, 1);
      var driveWork = (_dwHip == null && _dwKnee == null) ? null : ((_dwHip || 0) + (_dwKnee || 0));
      var leadGrfN = peak(S.FP2_Z, ifc, ibr, false).v;
      // 무릎→골반 회전 전달(연결): 수직GRF(FP2_Z)와 골반 회전 각가속의 시간 겹침 (etdiag coupling 동일 개념). 높을수록 받친 힘이 골반(몸통) 회전으로 전달.
      var kneeTransfer = (function(){
        var vg=S.FP2_Z, pz=S.Pelvis_Ang_Vel_Z; if(!vg||!pz||ifc==null||ibr==null) return null;
        var ipv=peak(vg,ifc,ibr,true).i;
        var paa=deriv(pz.map(function(x){return isFinite(x)?Math.abs(x):0;}),dt);
        var ppa=peak(paa,ifc,ibr,false), ippa=ppa.i, peakAcc=ppa.v||1, peakVG=peak(vg,ifc,ibr,true).v||1;
        var lo=ifc, hi=Math.max(ippa==null?ifc:ippa, ipv==null?ifc:ipv); if(hi<=lo) hi=Math.min(ibr,lo+10);
        var num=0,den=0; for(var i=lo;i<=hi&&i<vg.length;i++){ var sv=isFinite(vg[i])?Math.min(1,Math.abs(vg[i])/peakVG):0, ga=(isFinite(paa[i])?Math.max(0,paa[i]):0)/peakAcc; num+=Math.min(sv,ga)*dt; den+=ga*dt; }
        return den>0?(num/den):null;
      })();
      var comDecel = peak(deriv(S.COM_Velocity_Y || [], dt).map(function (x) { return -x; }), Math.max(0, ifc - 12), ibr, false).v;
      var comVelReductionFCBR = (function () {
        var cv = S.COM_Velocity_Y; if (!cv || ifc == null || ibr == null || !isFinite(cv[ifc])) return null;
        var vFC = Math.abs(cv[ifc]), vMin = vFC;
        for (var i = ifc; i <= ibr && i < cv.length; i++) if (isFinite(cv[i])) vMin = Math.min(vMin, Math.abs(cv[i]));
        return vFC - vMin;
      })();
      var kneeBrace = absn(peak(RHP ? S.L_Knee_Moment_X : S.R_Knee_Moment_X, ifc, ibr, true).v);  // 리드무릎 버팀(굴곡저항) 모멘트 크기(N·m). 부호규약이 데이터셋마다 반대(한 선수+/기준−)라 절대값 사용
      // [FIX 2026-05-25] 앞발 AP 제동력 = 착지 시 전방(+FP2_Y) peak. 기존 -FP2_Y는 후방 작은 값(잘못)이었음.
      // (타이밍 검증: 앞발 수직 GRF peak 순간 Fy=+919N. MR3 +Fy=홈방향=제동력.)
      var leadApGrfN = peak(S.FP2_Y || [], ifc, ibr, false).v;
      // [2026-06-10 4d-A] FP(포스플레이트) 채널 부재 시 0이 아니라 null — 자체 산출 불가 변인은 '없음'이 정직(Uplift). Theia는 FP 항상 존재→가드 미발동→동작 불변(diff=0).
      var apBrakeImpulse = (function () { var a = S.FP2_Y; if (!a || !a.length) return null; var imp = integ(a.map(function (x) { return isFinite(x) ? Math.abs(x) : x; }), ifc, ibr, dt, 0); return imp == null ? null : imp / bw * 100; })();
      /* [2026-08-12 코덱스 P1-6 착수] 수직 임펄스 정의 2벌 존재 — canonical 선언:
         ①이 산출(점수·규준의 정본) = 저속 신호 · [FC,BR) half-open · |FP2_Z| 적분 /BW. Elite28 규준이 이 정의로 산출됨.
         ②extract_theia grf_metrics.impulse_pct_bw_s = 고속 신호 · [FC,BR] 양끝 포함 · signed — 표시·연구용 병렬 정의.
         ★두 정의의 값 통일(고속·signed 전환)은 원자료 검증 + 규준 재산출과 세트(보류_규준재발행_묶음) — 규준 스케일이
         이 정의에 잠겨 있어 단독 전환 금지. 물리상 수직 GRF는 비음수라 |·|≈signed 예상이나 원자료 실증 전 불변 유지.
         ★뷰어 frames의 FP 채널은 canonical 회전본이라 검증에 쓸 수 없음(축이 다름). */
      var leadVGRFImpulse = (function () { var a = S.FP2_Z; if (!a || !a.length) return null; var imp = integ(a.map(function (x) { return isFinite(x) ? Math.abs(x) : x; }), ifc, ibr, dt, 0); return imp == null ? null : imp / bw * 100; })();
      var kFCa = valAt(S.Lead_Knee_Angle_X, ifc), kBRa = valAt(S.Lead_Knee_Angle_X, ibr);
      var kneeExtROM = (kFCa != null && kBRa != null) ? (kFCa - kBRa) : null;
      var kMaxFlex = peak(S.Lead_Knee_Angle_X, ifc, ibr, false).v;  // FC→BR 최대 굴곡각
      var kneeCollapse = (kFCa != null && kMaxFlex != null) ? (kMaxFlex - kFCa) : null;  // 굴곡무너짐 정도(°): FC 대비 추가 굴곡(+클수록 무너짐). 각도규약 양 데이터 동일
      var kneeExtE = integ(S.Lead_Knee_Power_X, ifc, ibr, dt, 1);
      // 앞무릎 흡수 에너지(FC→BR): 앞무릎 음의 파워 적분 크기 |∫P⁻·dt| — 착지 충격 흡수량(적을수록 단단한 블록)
      var _kae = integ(S.Lead_Knee_Power_X, ifc, ibr, dt, -1); var kneeAbsE = (_kae == null) ? null : Math.abs(_kae);
      // COM 운동에너지 감소량(블록): ½m(v_peak²−v_min²) — 블록이 제거한 선형 KE(선형→회전 전환)
      var comKEdrop = (function () { var cv = S.COM_Velocity_Y || []; var vp = -Infinity, vpi = ikl; for (var i = ikl; i <= ibr && i < cv.length; i++) { if (isFinite(cv[i]) && cv[i] > vp) { vp = cv[i]; vpi = i; } } if (vp === -Infinity) return null; var vmin = Infinity; for (var j = vpi; j <= ibr && j < cv.length; j++) { if (isFinite(cv[j]) && cv[j] < vmin) vmin = cv[j]; } if (vmin === Infinity) return null; var mass = ((meta && meta.weight_kg) || 86); return 0.5 * mass * (vp * vp - vmin * vmin); })();
      // 골반+몸통 회전 KE (직접 산출, ½Iω² · de Leva 흉부+골반) + 선형→회전 전달.
      //  rotKEpeak(피크, 구속 r=.49 검증)·rotKEgain(FC→피크 증가)·linRotRatio(증가/선형손실 %, 참고).
      var _rotKE = (function () {
        var pz = S.Pelvis_Ang_Vel_Z, tz = S.Thorax_Ang_Vel_Z, cy = S.COM_Velocity_Y;
        if (!pz || !tz || !cy || ifc == null) return { pk: null, gain: null, ratio: null };
        var massK = ((meta && meta.weight_kg) || 86), D2R = Math.PI / 180;
        var Itr = massK * 0.1596 * Math.pow(0.349 * 0.30 * ht, 2), Ipl = massK * 0.1117 * Math.pow(0.551 * 0.145 * ht, 2);
        function rk(i) { var wp = isFinite(pz[i]) ? Math.abs(pz[i]) * D2R : 0, wt = isFinite(tz[i]) ? Math.abs(tz[i]) * D2R : 0; return 0.5 * Ipl * wp * wp + 0.5 * Itr * wt * wt; }
        var hi = (ibr != null ? ibr : cy.length - 1), keFC = rk(ifc), pk = keFC;
        for (var i = ifc; i <= hi && i < pz.length; i++) { var k = rk(i); if (k > pk) pk = k; }
        var vFC = Math.abs(cy[ifc]), vMin = vFC;
        for (var j = ifc; j <= hi && j < cy.length; j++) { if (isFinite(cy[j]) && Math.abs(cy[j]) < vMin) vMin = Math.abs(cy[j]); }
        var linLoss = 0.5 * massK * (vFC * vFC - vMin * vMin), gain = pk - keFC;
        return { pk: pk, gain: gain, ratio: (linLoss > 5 ? gain / linLoss * 100 : null) };
      })();
      var rotKEpeak = _rotKE.pk, rotKEgain = _rotKE.gain, linRotRatio = _rotKE.ratio;
      var trunkFlexV = peak(deriv(S.Trunk_Angle_X || [], dt), ifc, ibr, true).v;
      var trunkME = peak(S.Trunk_ME_X, ifc, ibr, true).v;
      var torsoRotV = peak(S.Thorax_Ang_Vel_Z, ifc, ibr, true).v;
      var trunkLatV = peak(S.Thorax_Ang_Vel_Y, ifc, ibr, true).v;  // 몸통 측굴(lateral) 각속도 peak — 측굴 KE 대체(분절내 운동학=속도)
      // 몸통 회전·굴곡·측굴 운동에너지 (관성반영 ½Iω², de Leva 흉부) — 자체 로직. 분배%는 견고, 절대J는 추정.
      var _tSplit = (function () {
        var wx = S.Thorax_Ang_Vel_X, wy = S.Thorax_Ang_Vel_Y, wz = S.Thorax_Ang_Vel_Z;
        if (!wx || !wy || !wz) return { rotKE: null, flexKE: null, latKE: null, rotShare: null, flexShare: null, latShare: null };
        var mass = ((meta && meta.weight_kg) || 86), ht = ((meta && meta.height_m) || 1.8), D = Math.PI / 180, mTr = mass * 0.1596, L = 0.30 * ht;
        var Ix = mTr * Math.pow(0.716 * L, 2), Iy = mTr * Math.pow(0.659 * L, 2), Iz = mTr * Math.pow(0.349 * L, 2);
        var pr = 0, pf = 0, pl = 0, sr = 0, sf = 0, sl = 0;
        for (var i = ifc; i <= ibr && i < wz.length; i++) {
          var ox = (wx[i] || 0) * D, oy = (wy[i] || 0) * D, oz = (wz[i] || 0) * D;
          var er = 0.5 * Iz * oz * oz, ef = 0.5 * Ix * ox * ox, el = 0.5 * Iy * oy * oy;
          if (er > pr) pr = er; if (ef > pf) pf = ef; if (el > pl) pl = el; sr += er; sf += ef; sl += el;
        }
        var tot = sr + sf + sl || 1;
        return { rotKE: pr, flexKE: pf, latKE: pl, rotShare: Math.round(100 * sr / tot), flexShare: Math.round(100 * sf / tot), latShare: Math.round(100 * sl / tot) };
      })();
      var armRotV = peak(S.Pitching_Shoulder_Ang_Vel_Z, ifc, ibr, true).v;
      var humME = peak(S.Pitching_Humerus_ME_X, ifc, ibr, true).v;
      // 앞발 수직 GRF 패턴(유지·증가·감소) — 무릎 각도유형과 별개 차원 [그룹 34명]
      var _vgrf = (function () {
        var vg = S.FP2_Z; if (!vg) return { pattern: null, ttp: null, drop: null, retain: null };
        var ip = null, pv = -1; for (var i = ifc; i <= ibr && i < vg.length; i++) { var a = Math.abs(vg[i]); if (isFinite(a) && a > pv) { pv = a; ip = i; } }
        if (ip == null || pv <= 0) return { pattern: null, ttp: null, drop: null, retain: null };
        var ttp = (ibr > ifc) ? Math.round(100 * (ip - ifc) / (ibr - ifc)) : null;
        var mn = pv; for (var j = ip; j <= ibr && j < vg.length; j++) { var b = Math.abs(vg[j]); if (isFinite(b) && b < mn) mn = b; }
        var drop = Math.round(100 * (pv - mn) / pv);
        var atBR = isFinite(vg[ibr]) ? Math.abs(vg[ibr]) : null, retain = (atBR != null) ? Math.round(100 * atBR / pv) : null;
        var pat = (ttp >= 65 && drop <= 25) ? '증가형' : ((ttp <= 40 && drop >= 45) ? '감소형' : '유지형');
        return { pattern: pat, ttp: ttp, drop: drop, retain: retain };
      })();
      // 피크 파워 정점 시점(FC기준 ms) — 분절파워(dME/dt)·관절파워. 인접 쌍 '전달 타이밍'으로 5단계에 배분.
      var _pkt = function (arr, segPow) { if (!arr) return null; var pw = segPow ? deriv(arr, dt) : arr; var bi = null, bv = -1e9; for (var i = ifc; i <= ibr && i < pw.length; i++) { if (isFinite(pw[i]) && pw[i] > bv) { bv = pw[i]; bi = i; } } return bi == null ? null : Math.round((bi - ifc) * dt * 1000); };
      var _ptKnee = _pkt(S.Lead_Knee_Power_X, false), _ptTrunkP = _pkt(S.Trunk_ME_X, true), _ptHumP = _pkt(S.Pitching_Humerus_ME_X, true), _ptShoP = _pkt(S.Pitching_Shoulder_Power_X, false), _ptElbP = _pkt(S.Pitching_Elbow_Power_X, false);
      var ppKneeTrunk = (_ptKnee != null && _ptTrunkP != null) ? (_ptTrunkP - _ptKnee) : null;
      var ppTrunkHum = (_ptTrunkP != null && _ptHumP != null) ? (_ptHumP - _ptTrunkP) : null;
      var ppShoElb = (_ptShoP != null && _ptElbP != null) ? (_ptElbP - _ptShoP) : null;
      // 몸통→팔 기여비율 (교수 방법: 팔 총에너지 − 팔 자체생성 = 몸통에서 받은 분). 자체=어깨+팔꿈치 관절 양의 일.
      var armTransferRatio = (function () {
        var hME = S.Pitching_Humerus_ME_X, sp = S.Pitching_Shoulder_Power_X, ep = S.Pitching_Elbow_Power_X, tME = S.Trunk_ME_X;
        if (!hME || !sp || !ep) return null;
        var iTP = null, tv = -1e9; if (tME) for (var i = ifc; i <= ibr && i < tME.length; i++) { if (isFinite(tME[i]) && tME[i] > tv) { tv = tME[i]; iTP = i; } }
        var lo = (iTP != null ? iTP : ifc);
        var hPk = -1e9; for (var j = lo; j <= ibr && j < hME.length; j++) { if (isFinite(hME[j]) && hME[j] > hPk) hPk = hME[j]; }
        var hStart = isFinite(hME[lo]) ? hME[lo] : null;
        var gain = (hPk > -1e9 && hStart != null) ? (hPk - hStart) : null;
        if (gain == null || gain <= 0) return null;
        var self = 0; for (var k = lo; k <= ibr && k < sp.length; k++) { var p = (isFinite(sp[k]) ? sp[k] : 0) + (isFinite(ep[k]) ? ep[k] : 0); if (p > 0) self += p * dt; }
        return Math.max(0, Math.min(100, Math.round(100 * (gain - self) / gain)));
      })();
      var elbowExtV = peak(S.Pitching_Elbow_Ang_Vel_X, ifc, ibr, true).v;
      var elbowP = peak(S.Pitching_Elbow_Power_X, ifc, ibr, true).v;
      var shGen = integ(S.Pitching_Shoulder_Power_X, ifc, ibr, dt, 1);
      var elbAbsR = integ(S.Pitching_Elbow_Power_X, ifc, ibr, dt, -1);
      // [2026-06-23] ★직접전달 = force power(F·v_jc) — 분절 간 *전달*(생성shGen=moment power와 구분, Robertson-Winter). 신 V3D export(force power 추가본)에만 존재(*_Force_Power_X 스칼라·좌표계무관). 채널 없으면 null→필터.
      var shForceTransfer = (S.Pitching_Shoulder_Force_Power_X ? integ(S.Pitching_Shoulder_Force_Power_X, ifc, ibr, dt, 1) : null);  // 어깨 직접전달(트렁크→상완) 일
      var elForceTransfer = (S.Pitching_Elbow_Force_Power_X ? integ(S.Pitching_Elbow_Force_Power_X, ifc, ibr, dt, 1) : null);        // 팔꿈치 직접전달(상완→전완) 일
      // [2026-06-23] 하체 사슬 직접전달(force power) — V3D 재설계 없이 신 데이터 *_Force_Power 채널 사용. 윈도=기존 관절일 변인과 동일(드라이브 ikl→ifc·블록 ifc→ibr). Lead/Back=핸드 해소채널(L/R 매핑 불필요).
      var backHipTransfer  = (S.Back_Hip_Force_Power_X  ? integ(S.Back_Hip_Force_Power_X,  ikl, ifc, dt, 1) : null);  // 뒷고관절 직접전달(드라이브·지면→골반)
      var backKneeTransfer = (S.Back_Knee_Force_Power_X ? integ(S.Back_Knee_Force_Power_X, ikl, ifc, dt, 1) : null);  // 뒷무릎 직접전달(드라이브)
      // [2026-10-11 교수 「C · 지금 모두」] 뒷다리 에너지 흐름 — 방향을 보는 분절 파워(Robertson-Winter · 골반 쪽 · + = 뒷대퇴에서 골반으로 들어옴).
      //   위 backHipTransfer 는 대퇴 쪽 관절력 파워의 양(+) 몫 = 골반에서 뒷다리로 「내려간」 몫(그 89%가 로딩 구간) — 드라이브(올라옴)가 아님.
      //   로딩 = KH→뒷무릎 최대 굽힘(골반 → 뒷다리) · 푸시오프 = 최대 굽힘→FC(뒷다리 → 골반) · 순 에너지 전달 = KH→FC 합(+ = 뒷다리가 골반에 에너지를 더함).
      //   골반 쪽 분절 파워·뒷무릎 각 칸은 확정판(v2.0)·C3D 길에만 있다(옛 판 = null). 단위 J/kg(체중 = 명부값 · 없으면 null).
      //   검산: 분절 양 끝 파워 합 = 분절 에너지 변화(r .96~1.00) · 골반 쪽·대퇴 쪽 관절력 파워 합 = 0 · 근거 = 코호트 38명·OBP 100명 같은 구간 대조(10-10).
      var _bhSP = S.Pelvis_BackHip_SP_X, _bkAng = S.Back_Knee_Angle_X, _bodyKg = (meta && meta.weight_kg) || null;
      var _imkf = null;
      if (_bhSP && _bkAng && ifc != null && ifc > ikl) { var _mkv = -1; for (var _q = ikl; _q < ifc && _q < _bkAng.length; _q++) { var _ak = Math.abs(_bkAng[_q]); if (isFinite(_ak) && _ak > _mkv) { _mkv = _ak; _imkf = _q; } } }
      var _perKg = function (x) { return (x == null || !_bodyKg) ? null : x / _bodyKg; };
      var backHipNet     = _bhSP ? _perKg(integ(_bhSP, ikl, ifc, dt, 0)) : null;                                                      // 순 에너지 전달(KH→FC 합)
      var backHipLoad    = (_bhSP && _imkf != null) ? _perKg(integ(_bhSP, ikl, _imkf, dt, 0)) : null;                                 // 로딩(−가 보통)
      var backHipPush    = (_bhSP && _imkf != null) ? _perKg(integ(_bhSP, _imkf, ifc, dt, 0)) : null;                                 // 푸시오프(+가 정상 방향)
      var backHipPushLin = (S.Pelvis_BackHip_JFP_X && _imkf != null) ? _perKg(integ(S.Pelvis_BackHip_JFP_X, _imkf, ifc, dt, 0)) : null; // 푸시오프 관절력 성분(JFP)
      var backHipPushRot = (S.Pelvis_BackHip_STP_X && _imkf != null) ? _perKg(integ(S.Pelvis_BackHip_STP_X, _imkf, ifc, dt, 0)) : null; // 푸시오프 분절 토크 성분(STP)
      var backKneePush   = (S.Back_Thigh_Dist_SP_X && _imkf != null) ? _perKg(integ(S.Back_Thigh_Dist_SP_X, _imkf, ifc, dt, 0)) : null; // 푸시오프 때 뒷하퇴→뒷대퇴
      var leadHipTransfer  = (S.Lead_Hip_Force_Power_X  ? integ(S.Lead_Hip_Force_Power_X,  ifc, ibr, dt, 1) : null);  // 앞고관절 직접전달(블록→회전)
      var leadKneeTransfer = (S.Lead_Knee_Force_Power_X ? integ(S.Lead_Knee_Force_Power_X, ifc, ibr, dt, 1) : null);  // 앞무릎 직접전달(블록)
      // [2026-08-12] 앞고관절 흡수(받아내기) — de Swart 2022 검증 후속. 양수(전달)적분은 구속 null(-.02·마커계 특이)이나
      //   음수(흡수)적분은 마커리스 89명서 구속 r=+.43(comKEdrop급·통제 후 고유신호 pr=.22) — "흡수=안정 기저" 구조와 정합.
      //   창=FC-120ms→BR(착지 직전 받아내기 포함 — 사슬 실측·FC→BR 대비 r .33→.43). 근거: _분석/obp_validation/leadhip_variants_pilot.js.
      var _lha = (S.Lead_Hip_Force_Power_X ? integ(S.Lead_Hip_Force_Power_X, Math.max(0, ifc - Math.round(0.120 / dt)), ibr, dt, -1) : null);
      var leadHipAbsorb = (_lha == null) ? null : Math.abs(_lha);
      // [2026-05-26] 신 Theia 직접 키네틱(투구팔 모멘트·관절력·글러브팔) — 결과 크기(3축 합) peak. (Uplift엔 채널 없어 null→필터)
      function _resultPk(pre, lo, hi){ var x=S[pre+'_X'],y=S[pre+'_Y'],z=S[pre+'_Z']; if(!x)return null; var best=null; for(var i=(lo||0);i<=hi&&i<x.length;i++){ var vx=x[i],vy=y?y[i]:0,vz=z?z[i]:0; if(!isFinite(vx))continue; var r=Math.sqrt(vx*vx+(isFinite(vy)?vy*vy:0)+(isFinite(vz)?vz*vz:0)); if(best==null||r>best)best=r; } return best; }
      var elbowMomentPk = _resultPk('Pitching_Elbow_Moment', ifc, ibr);     // 팔꿈치 관절 모멘트 3축 합성 크기
      var shoulderMomentPk = _resultPk('Pitching_Shoulder_Moment', ifc, ibr); // 어깨 관절 모멘트 3축 합성 크기
      var shoulderForcePk = _resultPk('Pitching_Shoulder_Force', ifc, ibr);   // 어깨 분리력(distraction)
      var elbowForcePk = _resultPk('Pitching_Elbow_Force', ifc, ibr);
      var gloveShPow = peak(S.Glove_Shoulder_Power_X, ifc, ibr, true).v;       // 글러브팔 어깨 파워
      var gloveHumME = peak(S.Glove_Humerus_ME_X, ifc, ibr, true).v;          // 글러브 상완 역학에너지
      // [2026-05-26] 하지 블록 키네틱 보완 — 앞다리(블록)·고관절 모멘트가 미측정이던 부분. Moment채널은 L/R 리터럴→핸드로 back/lead 매핑.
      var _bHipM=RHP?'R_Hip_Moment':'L_Hip_Moment', _lHipM=RHP?'L_Hip_Moment':'R_Hip_Moment', _lKneeM=RHP?'L_Knee_Moment':'R_Knee_Moment';
      var leadHipWork = integ(S.Lead_Hip_Power_X, ifc, ibr, dt, 1);            // 앞고관절 일(FC→BR, 블록 생성에너지) — 엘리트 변별 큼
      var backHipMoment = _resultPk(_bHipM, ikl, ibr);                          // 뒷고관절 모멘트(드라이브 토크)
      var leadHipMoment = _resultPk(_lHipM, ifc, ibr);                          // 앞고관절 모멘트(블록 토크)
      var leadKneeMoment = _resultPk(_lKneeM, ifc, ibr);                        // 앞무릎 모멘트(결과·블록 강성)
      var leadKneeForce = _resultPk('Lead_Knee_Force', ifc, ibr);               // 앞무릎 관절 반력(제동 부하)
      var backHipWork = integ(S.Back_Hip_Power_3AX_X || S.Back_Hip_Power_X, ikl, ifc, dt, 1);   // 뒷고관절 일(KH→FC, 드라이브 생성) · [10-07] 3축 칸(최종판 — 현장 앱 어댑터가 덧붙임 · 신전·외전·회전 순 파워)이 있으면 3축 · 없으면 X(굴곡·신전)만
      // [2026-10-11 교수 「진행」] 뒷고관절 일 — 푸시오프(뒷무릎 최대 굽힘→FC) · 3축 순 파워의 양(+) 적분 · J/kg · 판정 기준 = 아래 BH_PUSH_WORK_FLOOR(3축 값).
      //   3축 칸이 없으면 null — X 만으로 대신하지 않음(같은 구간 X 값이 3축보다 커서 기준과 맞지 않음 · 코호트 엘리트 가운데 X 0.86 vs 3축 0.76).
      var backHipPushWork = (S.Back_Hip_Power_3AX_X && _imkf != null) ? _perKg(integ(S.Back_Hip_Power_3AX_X, _imkf, ifc, dt, 1)) : null;
      // [2026-10-11 교수 「진행」] 앞무릎 신전 일(앞무릎 최대 굽힘→BR) · 굴곡·신전(X) 파워의 양(+) 적분 · J/kg · 참고(판정은 같은 묶음인 앞무릎 신전속도·버팀량 · 선수 사이 ρ .87 · .74).
      //   브레이크(FC→앞무릎 최대 굽힘) 흡수는 판정하지 않음 — 크기가 공개 투수 자료(OBP)와 같은 수준이고 구속·전진 감속·몸통 회전과 관계 없음(코호트·OBP 둘 다 · 10-11).
      var _ilkm = (S.Lead_Knee_Angle_X && ifc != null && ibr != null && ibr > ifc) ? peak(S.Lead_Knee_Angle_X, ifc, ibr, false).i : null;
      var leadKneePush = (S.Lead_Knee_Power_X && _ilkm != null) ? _perKg(integ(S.Lead_Knee_Power_X, _ilkm, ibr, dt, 1)) : null;
      var relTimingMs = (ifc != null && ibr != null) ? (ibr - ifc) * dt * 1000 : null;
      var armSlot = valAt(S.Pitching_Shoulder_Angle_Y, ifc);
      // 스트라이드: [2026-06-01 FIX] 발끝-발끝(toe) 수평거리 우선(관용 정의·문헌 일치). 없으면 CoP, 그다음 STRIDE_LENGTH_X.
      var _stm = (t.grf_metrics && (t.grf_metrics.stride_toe_m != null ? t.grf_metrics.stride_toe_m : t.grf_metrics.stride_cop_m));
      if (_stm != null && isFinite(_stm) && _stm > 50) _stm = _stm / 1000;  // ★[2026-06-02 FIX] stride_toe_m이 mm로 저장된 케이스(예 1641mm) → m로 보정. (stride_cop_m은 m라 영향 없음)
      var strideLen;
      if (_stm != null && isFinite(_stm)) { strideLen = _stm / ht * 100; }
      else { var sl = (S.STRIDE_LENGTH_X || []).filter(isFinite); strideLen = sl.length ? Math.abs(sl.reduce(function (a, b) { return Math.abs(b) > Math.abs(a) ? b : a; })) / ht * 100 : null; }
      var kd = (t.kseq && t.kseq.deltas) || {};
      var seqSpan = (kd.pelvis_to_trunk_ms != null && kd.trunk_to_arm_ms != null) ? (kd.pelvis_to_trunk_ms + kd.trunk_to_arm_ms) : null;
      // ── 회전(⑤) · 에너지 전달(⑥) 추가 변인 ──
      var pelvisRotV = peak(S.Pelvis_Ang_Vel_Z, ifc, ibr, true).v;  // 골반 회전 속도 peak (°/s)
      // 무릎 신전 기여 비율 = 무릎 생성에너지 / (생성+흡수) — 높을수록 신전(생성)우세
      var kneeContribPct = (kneeExtE != null && kneeAbsE != null && (kneeExtE + kneeAbsE) > 0) ? (kneeExtE / (kneeExtE + kneeAbsE) * 100) : null;
      // 무릎 신전–몸통 회전 타이밍 지연(ms) = 무릎 신전속도 peak − 몸통 회전속도 peak (+면 무릎이 회전 뒤)
      var _ikExt = peak(deriv(S.Lead_Knee_Angle_X || [], dt).map(function (x) { return -x; }), ifc, ibr, false).i;
      var _itRot = peak(S.Thorax_Ang_Vel_Z || [], ifc, ibr, true).i;
      var kneeTrunkLag = (_ikExt != null && _itRot != null) ? (_ikExt - _itRot) * dt * 1000 : null;
      // 무릎 활용 유형: 순 신전(kneeExtROM) ≥13° = 무릎신전-주도형(vault형), 미만 = 회전-주도형(흡수형). 둘 다 유효 엘리트 패턴(서술형)
      var driveType = (kneeExtROM == null) ? null : (kneeExtROM >= 13 ? '신전-vault형' : '버팀-흡수형');
      // ── 와인드업 회전 저장(preload) 스칼라 [2026-06-03 개발지침서] · PI(i_start)~KH ──
      var _is = ev.i_start;
      function _pkA(a, lo, hi) { if (!a || lo == null || hi == null) return null; lo = Math.max(0, lo | 0); hi = Math.min(a.length - 1, hi | 0); var b = null; for (var i = lo; i <= hi; i++) { var v = a[i]; if (isFinite(v) && (b == null || Math.abs(v) > Math.abs(b))) b = v; } return b == null ? null : Math.abs(b); }
      var _xf = t.x_factor;
      // [2026-06-03 v2 검토반영] 닫힘각@KH(절대) vs 코일 변화량(PI→KH) 분리. 꼬임토크=방향정규화+체중정규화. 평가=엘리트 범위(range).
      var wuPelCloseKH = (S.Pelvis_Angle_Z && isFinite(S.Pelvis_Angle_Z[ikl])) ? Math.abs(S.Pelvis_Angle_Z[ikl]) : null;          // KH 시점 골반 닫힘각(절대)
      var wuPelCoil = (_is != null && S.Pelvis_Angle_Z && isFinite(S.Pelvis_Angle_Z[_is]) && isFinite(S.Pelvis_Angle_Z[ikl])) ? Math.abs(S.Pelvis_Angle_Z[ikl] - S.Pelvis_Angle_Z[_is]) : null;  // PI→KH 코일 변화량
      var wuTrunkCloseKH = (S.Trunk_Angle_Z && isFinite(S.Trunk_Angle_Z[ikl])) ? Math.abs(S.Trunk_Angle_Z[ikl]) : null;
      var wuTrunkCoil = (_is != null && S.Trunk_Angle_Z && isFinite(S.Trunk_Angle_Z[_is]) && isFinite(S.Trunk_Angle_Z[ikl])) ? Math.abs(S.Trunk_Angle_Z[ikl] - S.Trunk_Angle_Z[_is]) : null;
      var wuHSS = (_xf && isFinite(_xf[ikl])) ? Math.abs(_xf[ikl]) : null;
      var wuHSSbuild = (_xf && _is != null && isFinite(_xf[ikl]) && isFinite(_xf[_is])) ? (Math.abs(_xf[ikl]) - Math.abs(_xf[_is])) : null;
      var wuDriveHipER = (S.Back_Hip_Angle_Z && isFinite(S.Back_Hip_Angle_Z[ikl])) ? Math.abs(S.Back_Hip_Angle_Z[ikl]) : null;
      // 꼬임 토크: 코일(counter-rotation) 방향 정규화(RHP −, LHP +) peak / 체중(N·m/kg). 반대 방향 토크는 제외.
      var wuCoilTq = (function () { var a = S.FP1_Z_3, wt = (meta && meta.weight_kg) || 86; if (!a || _is == null) return null; var lo = Math.max(0, _is | 0), hi = Math.min(a.length - 1, ikl | 0), b = 0; for (var i = lo; i <= hi; i++) { var v = RHP ? -a[i] : a[i]; if (isFinite(v) && v > b) b = v; } return b / wt; })();
      var wuPelVel = _pkA(S.Pelvis_Ang_Vel_Z, _is, ikl);
      var wuTrkVel = _pkA(S.Thorax_Ang_Vel_Z, _is, ikl);
      var wuShER = (S.Pitching_Shoulder_Angle_Z && isFinite(S.Pitching_Shoulder_Angle_Z[ikl])) ? Math.abs(S.Pitching_Shoulder_Angle_Z[ikl]) : null;
      // ── [2026-06-03 개발지침서] KH 팔 조기 장전 위험 — "어깨 외회전@KH=좋음"(wuShER) 폐기. 손분리 시점 조건부 + 팔 뒤쪽 이동 ──
      //   wuShER(Pitching_Shoulder_Angle_Z@KH)는 보조값으로만. 실제 위험 = 손분리가 KH 전후로 빠르고 + 던지는 팔이 어깨선보다 뒤(posterior)로 빠진 정도.
      var _th = RHP ? 'R_HAND_TIP' : 'L_HAND_TIP', _gl = RHP ? 'L_HAND_TIP' : 'R_HAND_TIP', _tel = RHP ? 'R_ELBOW' : 'L_ELBOW', _tsh = RHP ? 'R_SHOULDER' : 'L_SHOULDER';
      function _posY(mk, i) { var a = S[mk + '_Y']; return (a && isFinite(a[i])) ? a[i] : null; }
      function _d3(a, b, i) { var ax = S[a+'_X'], ay = S[a+'_Y'], az = S[a+'_Z'], bx = S[b+'_X'], by = S[b+'_Y'], bz = S[b+'_Z']; if (!ax||!ay||!az||!bx||!by||!bz||!isFinite(ax[i])||!isFinite(ay[i])||!isFinite(az[i])||!isFinite(bx[i])||!isFinite(by[i])||!isFinite(bz[i])) return null; return Math.sqrt(Math.pow(ax[i]-bx[i],2)+Math.pow(ay[i]-by[i],2)+Math.pow(az[i]-bz[i],2)); }
      // 손분리 시점(PI→KH): 손-글러브 거리가 PI 직전 baseline+0.15m(최소 0.20m) 넘고 3프레임 상승하는 첫 시점. earlySep = sep ≤ KH+3프레임.
      var handSepKHms = null, earlySep = null, handSepConf = true;
      (function () {
        if (_is == null || ikl == null || !dt) return;
        var base = []; for (var i = Math.max(0, _is - Math.round(0.10 / dt)); i <= _is; i++) { var dd = _d3(_th, _gl, i); if (dd != null) base.push(dd); }
        if (!base.length) { handSepConf = false; return; }
        base.sort(function (a, b) { return a - b; }); var baseline = base[Math.floor(base.length / 2)];
        // 연구원 지적: 대부분 PI 무렵 손분리 = 정상. (1) PI에 이미 분리(>0.25m)면 PI 이전 분리 → 조기분리.
        if (baseline > 0.25) { earlySep = true; handSepKHms = Math.round((_is - ikl) * dt * 1000); return; }
        // (2) 아니면 PI 이후 baseline+0.12m(최소 0.20m) 넘고 3프레임 상승하는 첫 시점 검출.
        var thr = Math.max(baseline + 0.12, 0.20), sep = null, hiF = Math.min((S[_th + '_Y'] || []).length - 1, ikl + 8);
        for (var k = _is; k <= hiF; k++) { var d0 = _d3(_th, _gl, k), d1 = _d3(_th, _gl, k-1), d2 = _d3(_th, _gl, k-2), d3 = _d3(_th, _gl, k-3); if (d0 != null && d0 > thr && d1 != null && d2 != null && d3 != null && d0 >= d1 && d1 >= d2 && d2 >= d3) { sep = k; break; } }
        if (sep != null) { handSepKHms = Math.round((sep - ikl) * dt * 1000); earlySep = (sep <= ikl + 3); } else { earlySep = false; }   // 검출 안 됨 = KH까지 손 붙어있음(조기분리 아님)
      })();
      // KH 팔/팔꿈치 뒤쪽 위치(투구방향 +Y=home, 뒤=낮은 Y). 던지는 어깨 기준 %신장(+=어깨선보다 뒤=조기장전 경향).
      var handPostKH = (function () { var hy = _posY(_th, ikl), sy = _posY(_tsh, ikl); return (hy != null && sy != null) ? Math.round((sy - hy) / ht * 100 * 10) / 10 : null; })();
      var elbowPostKH = (function () { var ey = _posY(_tel, ikl), sy = _posY(_tsh, ikl); return (ey != null && sy != null) ? Math.round((sy - ey) / ht * 100 * 10) / 10 : null; })();
      var horizAbdKH = (S.Pitching_Shoulder_Angle_X && isFinite(S.Pitching_Shoulder_Angle_X[ikl])) ? Math.abs(S.Pitching_Shoulder_Angle_X[ikl]) : null;
      // ── [2026-06-03 스트라이드 재구성 v3 · 개발지침서] 3기능(전진생성·회전준비·블로킹입력) 신규 변인 ──
      //   기존 신호 재사용. 모두 KH(ikl)→FC(ifc) 또는 FC 시점. 점수화/해석타입은 mech6·report에서 결정(여기선 값만 산출).
      // (a) 추진 타이밍 — 뒷발 추진 peak가 KH→FC 중 언제(%). 너무 이르면 조기소실·늦으면 FC준비 부족.
      var _ipp = peak(_fp1Fwd, ikl, ifc, false).i;   // 진행 부호 적용(위 _fp1Fwd)
      var propPeakTiming = (_ipp != null && ifc != null && ikl != null && ifc > ikl) ? Math.round(100 * (_ipp - ikl) / (ifc - ikl)) : null;
      // (b) 임펄스/최대힘 비(≈유효 추진시간 s) — 짧게 세게 vs 오래 밀기.
      var impPeakRatio = (propImp != null && rearPropN != null && rearPropN > 1) ? (propImp / rearPropN) : null;
      // (c) COM 전진속도 @FC — 생성된 전진운동의 결과 검증.
      var comVelFC = valAt(S.COM_Velocity_Y, ifc);
      // (d) 골반/몸통 열림 KH→FC — 회전 생성 시작(투구방향 무관 절대 excursion).
      var pelOpenKF = (S.Pelvis_Angle_Z && isFinite(S.Pelvis_Angle_Z[ikl]) && isFinite(S.Pelvis_Angle_Z[ifc])) ? Math.abs(S.Pelvis_Angle_Z[ifc] - S.Pelvis_Angle_Z[ikl]) : null;
      var trkOpenKF = (S.Trunk_Angle_Z && isFinite(S.Trunk_Angle_Z[ikl]) && isFinite(S.Trunk_Angle_Z[ifc])) ? Math.abs(S.Trunk_Angle_Z[ifc] - S.Trunk_Angle_Z[ikl]) : null;
      // (e) HSS(골반-어깨 분리) @FC = |x_factor[FC]|. HSS 빌드업 = HSS_FC − HSS_KH(스트라이드 중 분리 발달).
      var hssFC = xfAtFC;
      var _hssKH = (_xfArr && isFinite(_xfArr[ikl])) ? Math.abs(_xfArr[ikl]) : null;
      var hssBuildKF = (hssFC != null && _hssKH != null) ? Math.round((hssFC - _hssKH) * 10) / 10 : null;
      /* [2026-08-12 연구원 의견·구현1] 축발 추진을 PI→KH(초기)와 KH→FC(드라이브)로 분리 + 절대(N·N·s)와 정규화(%BW·%BW·s) 병기.
         전부 role D·비점수(neutral·normNA) — 기존 rearProp/propImpPct 점수 불변. 신키는 그 "짝"이라 같은 저속 FP1_Y 신호 사용
         (고속 force 신호·필터 정본화는 후속 선행조건 — 규준 재발행과 세트). 방향 규약:
           F_prop(t) = max(0, s_forward · FP1_Y(t)),  s_forward = sign(KH→FC 평균 COM 전진속도)  (미측정 시 +1 폴백)
         원자료 관례 +FP1_Y=홈방향이라 s_forward=+1이 정상(현 데이터 COM_Velocity_Y[KH→FC] 양수). 창은 half-open, PI/KH/FC 결측·역순이면 null(0 대체 금지). */
      var _rearProp = (function () {
        var a = S.FP1_Y; if (!a || !a.length) return {};
        var sf = 1; if (S.COM_Velocity_Y && _is != null && ifc != null) { var sm = 0, c = 0; for (var i = _is; i < ifc && i < S.COM_Velocity_Y.length; i++) { var v = S.COM_Velocity_Y[i]; if (isFinite(v)) { sm += v; c++; } } if (c && sm < 0) sf = -1; }
        function fwd(x) { return isFinite(x) ? Math.max(0, sf * x) : x; }
        function win(lo, hi) { if (lo == null || hi == null || !(hi > lo)) return { pk: null, imp: null }; var pk = null, nf = 0, s = 0; for (var i = lo; i < hi && i < a.length; i++) { var x = a[i]; if (!isFinite(x)) continue; nf++; var f = fwd(x); if (pk == null || f > pk) pk = f; s += f * dt; } return nf ? { pk: pk, imp: s } : { pk: null, imp: null }; }
        var pk = win(_is, ikl), kf = win(ikl, ifc), pf = win(_is, ifc);
        return { s_forward: sf,
          peakPIKH_N: pk.pk, impPIKH_Ns: pk.imp, peakKHFC_N: kf.pk, impKHFC_Ns: kf.imp, impPIFC_Ns: pf.imp };
      })();
      /* [2026-08-12 연구원 의견·구현4 부분] 1.0 BW 하중수용 이벤트 + 그 시점까지의 분리 빌드업(D). ★full-foot plant(해부학적 안착)와
         1.0 BW load(하중 사건)는 다른 사건 — 여기선 "1.0 BW load"만 산출(i_full_plant는 heel/toe 접지 gold 라벨 필요로 이연).
         i_lead_1bw = FC~min(FC+120ms,BR)에서 FP2_Z/BW ≥ 1.0 이 ≥10ms 지속되는 첫 프레임(미도달 null). 전부 role D·비점수. */
      var _lead1bw = (function () {
        var z = S.FP2_Z; if (!z || ifc == null || ibr == null || !dt || bw <= 0) return {};
        var hold = Math.max(1, Math.round(0.010 / dt)), lim = Math.min(ibr, ifc + Math.round(0.120 / dt)), i1bw = null;
        for (var i = ifc; i <= lim && i < z.length; i++) {
          var ok = true; for (var k = i; k < i + hold && k <= lim && k < z.length; k++) { var v = z[k]; if (!isFinite(v) || Math.abs(v) / bw < 1.0) { ok = false; break; } }
          if (ok) { i1bw = i; break; }
        }
        if (i1bw == null) return { i: null };
        var xf1bw = (_xfArr && isFinite(_xfArr[i1bw])) ? Math.abs(_xfArr[i1bw]) : null;
        var hssKH = (_xfArr && isFinite(_xfArr[ikl])) ? Math.abs(_xfArr[ikl]) : null;
        return { i: i1bw,
          hssLead1BW: xf1bw == null ? null : Math.round(xf1bw * 10) / 10,
          hssBuildKHLead1BW: (xf1bw != null && hssKH != null) ? Math.round((xf1bw - hssKH) * 10) / 10 : null,
          fcToLead1BWMs: Math.round((i1bw - ifc) * dt * 1000) };
      })();
      // (f) 몸통 버팀비 = 골반열림 ÷ 몸통열림(>1=골반 선행, 몸통 버팀).
      var trunkResistRatio = (pelOpenKF != null && trkOpenKF != null && trkOpenKF > 0.5) ? Math.round(pelOpenKF / trkOpenKF * 100) / 100 : null;
      // (g) FC 블로킹 입력 — 리드무릎 굴곡각·앞발 각도·뒷무릎 굴곡변화(자세가 힙힌지인지 주저앉음인지).
      var leadKneeFlexFC = kFCa;
      var leadFootAngleFC = (t.grf_metrics && t.grf_metrics.stride_angle_deg != null && isFinite(t.grf_metrics.stride_angle_deg)) ? t.grf_metrics.stride_angle_deg : null;
      var driveKneeFlexKF = (S.Back_Knee_Angle_X && isFinite(S.Back_Knee_Angle_X[ikl]) && isFinite(S.Back_Knee_Angle_X[ifc])) ? Math.round((S.Back_Knee_Angle_X[ifc] - S.Back_Knee_Angle_X[ikl]) * 10) / 10 : null;
      var strideTime = (ikl != null && ifc != null && dt) ? (ifc - ikl) * dt : null;   // 스트라이드 소요시간(KH→FC, s)
      /* [2026-08-12 코덱스 P1-4 착수 · 핵심 후보 3종 선행] 제동 임펄스 재정의 — 신키 leadBrakeImpulse(비점수·D).
         기존 apBrakeImpulse(∫|FP2_Y|dt)는 제동+추진 성분 혼합(코덱스 확정). 재정의 = COM 진행방향 기준 제동 성분만:
         F_brake(t) = max(0, sgn(v_COM_Y[FC]) · FP2_Y(t)) — V3D 원자료 관례 +FP2_Y=제동(2026-05-25 타이밍 실증 919N)에
         진행방향 부호 정규화를 더한 것(현 데이터 COM_Velocity_Y[FC] 전원 양수라 정규화는 방어용 no-op).
         ★비점수·규준 없음 — 잠금 코호트 검증 통과 후 승격(안건5 절차). 저속 신호 기준 — 고속 force 신호·필터 이관은
         선행조건 잔여(규준 재산출과 세트). ★뷰어 frames의 FP 채널은 canonical 회전본이라 이 부호 검증에 쓸 수 없음
         (65명 sweep에서 선수별 부호 혼재 실증) — 실값 검증은 원자료(V3D TXT)로. metric-v1 */
      // ★[2026-10-11 교수 「권장대로」 · 연구원 답 #36 축 확정(Y 앞뒤 · X 좌우 · Z 수직)] 부호 규약 검증 — 확정판(v200) TXT 39세션 358시행: 뒷발판 FP1_Y 는 COM 진행 방향과 같은 부호(추진) 358/358 ·
      //   앞발판 FP2_Y 는 반대 부호(제동) 358/358 → 힘은 「몸에 작용」(실험실 축) · 제동 성분 = max(0, −진행부호·FP2_Y). 옛 가정 「+FP2_Y=제동」(뷰어 회전본 기준)은 이 자료에서 0 으로 떨어졌었음(현장 기준 띠 p25~p75 = 0~0.04).
      var _brakeSign = (comVelFC != null && isFinite(comVelFC) && comVelFC < 0) ? -1 : 1;   // 진행 부호(COM_Velocity_Y at FC) · 제동 = −진행부호 쪽
      var leadBrakeImpulse = (function () {
        var a = S.FP2_Y; if (!a || !a.length || ifc == null || ibr == null) return null;
        var imp = integ(a.map(function (x) { return isFinite(x) ? Math.max(0, -_brakeSign * x) : x; }), ifc, ibr, dt, 0);
        return imp == null ? null : imp / bw * 100;
      })();
      var leadBrakePeakN = (function () {   // 앞발 제동력 peak(방향 성분 · N) — 표시 전용(비점수 · 규준 없음)
        var a = S.FP2_Y; if (!a || !a.length || ifc == null || ibr == null) return null;
        var pk = null; for (var i = ifc; i <= ibr && i < a.length; i++) { var v = -_brakeSign * a[i]; if (isFinite(v) && (pk == null || v > pk)) pk = v; }
        return pk == null ? null : Math.max(0, pk);
      })();
      // ── [2026-06-10 §3] 에너지 흐름 결정변인 (전부 neutral · mech6 미반영) ──
      var iMerEv = (ev.i_mer != null ? ev.i_mer : ev.i_mer_erpeak);
      var leadKneeExtVel = (function () {
        var v = S['Lead_Knee_Ang_Vel_X'];
        if (v && ifc != null && ibr != null) {  // Theia: 각속도 시계열 직접(기존 — 동작 불변)
          var pk = -1e9; for (var i = ifc; i <= ibr && i < v.length; i++) { var x = v[i]; if (isFinite(x) && -x > pk) pk = -x; }
          return pk <= -1e8 ? null : r1(pk);
        }
        // [2026-06-10] 각속도 채널 없을 때(Uplift): 무릎 각도에서 직접 미분 — Theia와 동일 로직(신전=각 감소→-d/dt peak). 벤더 제공 속도값 대신 관절각 기반 자체 산출.
        var a = S['Lead_Knee_Angle_X']; if (!a || ifc == null || ibr == null) return null;
        var dv = deriv(a, dt), pk2 = -1e9;
        for (var j = ifc; j <= ibr && j < dv.length; j++) { var y = dv[j]; if (isFinite(y) && -y > pk2) pk2 = -y; }
        return pk2 <= -1e8 ? null : r1(pk2);
      })();
      var efEtaE = (linRotRatio != null && isFinite(linRotRatio)) ? r2(linRotRatio / 100) : null;
      var efLeadHipHinge = (function () {
        var a = S.Lead_Hip_Angle_X; if (!a || ifc == null || !isFinite(a[ifc])) return null;
        if (iMerEv == null || !isFinite(a[iMerEv])) return null;
        return r1(a[iMerEv] - a[ifc]);
      })();
      var efDeltaTrunkME = (function () {
        var t = S.Trunk_ME_X; if (!t || ifc == null || ibr == null) return null;
        if (!isFinite(t[ifc]) || !isFinite(t[ibr])) return null;
        return r1(t[ifc] - t[ibr]);
      })();
      var efDeltaHumME = (function () {
        var h = S.Pitching_Humerus_ME_X; if (!h || ibr == null) return null;
        if (iMerEv == null || !isFinite(h[iMerEv]) || !isFinite(h[ibr])) return null;
        return r1(h[iMerEv] - h[ibr]);
      })();
      var efBalanceML = (function () {
        var x = S.COM_displacement_X; if (!x || _is == null || ikl == null) return null;
        var lo = Math.max(0, _is | 0), hi = Math.min(ikl | 0, x.length - 1), mn = Infinity, mx = -Infinity;
        for (var i = lo; i <= hi; i++) { if (isFinite(x[i])) { mn = Math.min(mn, x[i]); mx = Math.max(mx, x[i]); } }
        return mn < Infinity ? r2((mx - mn) * 100) : null;
      })();
      var efStoredPE = (function () {
        var z = S.COM_displacement_Z; if (!z || _is == null || ikl == null) return null;
        if (!isFinite(z[_is]) || !isFinite(z[ikl])) return null;
        var mass = ((meta && meta.weight_kg) || 86);
        return r1(mass * 9.81 * (z[ikl] - z[_is]));
      })();
      var efKappaH = null;
      /* [2026-08-13 ①a 하체 활용 점수 엔진 · 설계 v1.2(배팅 v9 상속)] 드라이브 생성·블록 생성·블록 흡수 3독립 점수.
         ★검증 전 전량 중립 — score:null·scoreEligible:false·qualityStatus:'unvalidated'·composite value:null(#58 표현적합성 내장·우열 라벨 없음).
         스칼라 관절파워 *_Power_X(=Moment_Power alias·생성·전달 아님)·관절별 부호분리 후 합(합친 뒤 자르면 상쇄).
         드라이브=Back_Hip+Back_Knee(KH→FC)·블록=Lead_Hip+Lead_Knee(FC→BR)·흡수=−blockNegJ. J/kg=실측 mass만(86 fallback 금지→null·missing_mass).
         적격성 어댑터 detect_src: tag→stable·auto→reference_only·null/부재→unavailable. 순수 추가 데이터 — 기존 점수·표시 불변(표시·현행 인덱스 차단은 별도 ①b). */
      var _lbu = (function () {
        var massValid = !!(meta && isFinite(meta.weight_kg) && meta.weight_kg > 0);
        var massKg = massValid ? meta.weight_kg : null;
        var ds = ev.detect_src || {};
        function q(src) { return src === 'tag' ? 'stable' : (src === 'auto' ? 'reference_only' : 'unavailable'); }
        var driveEv = (q(ds.kl) === 'stable' && q(ds.fc) === 'stable');   // 드라이브 = kl+fc
        var blockEv = (q(ds.fc) === 'stable' && q(ds.br) === 'stable');   // 블록 = fc+br
        // phase당 스칼라 2채널 커버리지: finite≥95%·연속결측≤3 (NaN→0 금지)
        function cov(ch, lo, hi) {
          if (!ch) return 'missing_channel';
          if (lo == null || hi == null || !(hi > lo)) return 'invalid_window';
          var n = 0, fin = 0, run = 0, maxRun = 0;
          for (var i = lo; i < hi && i < ch.length; i++) { n++; if (isFinite(ch[i])) { fin++; run = 0; } else { run++; if (run > maxRun) maxRun = run; } }
          if (n === 0) return 'invalid_window';
          if (fin / n < 0.95 || maxRun > 3) return 'insufficient_coverage';
          return null;
        }
        // 관절별 부호분리 후 합(합친 뒤 자르면 상쇄 — v1.0 결함 회피). 2채널 중 하나라도 커버리지 실패 → phase work 무효(부분합 노출 금지)
        function work(chs, lo, hi) {
          var pos = 0, neg = 0, covReason = null;
          for (var k = 0; k < chs.length; k++) {
            var cr = cov(chs[k], lo, hi); if (cr) { if (!covReason) covReason = cr; continue; }
            var p = integ(chs[k], lo, hi, dt, 1), m = integ(chs[k], lo, hi, dt, -1);
            if (p != null) pos += p; if (m != null) neg += m;
          }
          return covReason ? { pos: null, neg: null, covReason: covReason } : { pos: pos, neg: neg, covReason: null };
        }
        var drv = work([S.Back_Hip_Power_X, S.Back_Knee_Power_X], ikl, ifc);
        var blk = work([S.Lead_Hip_Power_X, S.Lead_Knee_Power_X], ifc, ibr);
        function jkg(j) { return (j != null && massValid) ? Math.round(j / massKg * 100) / 100 : null; }
        // 근위 outcome(절대크기)·경계피크 규칙(피크가 창 끝=절단 의심→unreliable)
        function outcome(arr, lo, hi) {
          if (!arr || lo == null || hi == null || !(hi > lo)) return { v: null, boundary: true };
          var pk = peak(arr, lo, hi, true);
          if (pk.v == null || pk.i == null) return { v: null, boundary: true };
          return { v: Math.abs(pk.v), boundary: (pk.i <= lo || pk.i >= hi) };
        }
        var oDrive = outcome(S.Pelvis_Ang_Vel_Z, ifc, ibr);   // 드라이브 → |pelvisRotV| (FC→BR·드라이브창 KH→FC와 분리→순환 없음·전방예측)
        var oBlock = outcome(S.Thorax_Ang_Vel_Z, ifc, ibr);   // 블록생성 → |torsoRotV| (FC→BR·동일창→windowMs 통제 필요)
        var winMs = (ifc != null && ibr != null) ? Math.round((ibr - ifc) * dt * 1000) : null;
        function seg(raw, covReason, evOk, outc, po) {
          var workAvail = (raw != null && !covReason);
          var displayElig = workAvail && evOk && massValid;   // 필요이벤트 전부 stable ∧ mass.valid
          var primAnaElig = displayElig && !!outc && outc.v != null && !outc.boundary;
          var reason = covReason ? covReason : (!evOk ? 'low_event_quality' : (!massValid ? 'missing_mass' : (primAnaElig ? null : 'outcome_unreliable')));
          return {
            rawJ: raw == null ? null : Math.round(raw * 10) / 10, jkg: jkg(raw),
            workAvailable: workAvail, displayEligible: displayElig,
            primaryAnalysisEligible: primAnaElig, scoreEligible: false,
            score: null, qualityStatus: 'unvalidated', reason: reason, primaryOutcome: po || null
          };
        }
        var absorptionJ = (blk.neg == null) ? null : Math.abs(blk.neg);   // −blockNegJ ≥ 0 (기존 leadHipAbsorb=Force_Power·다른 창과 무관·방향 근거 미상속)
        var absSeg = seg(absorptionJ, blk.covReason, blockEv, null, null);
        // 흡수 방향(흡수↑=안정?) 미확정 → primary outcome 사전고정·calibration 전 분석·점수 노출 금지
        absSeg.primaryAnalysisEligible = false; absSeg.directionFixed = false;
        if (!absSeg.reason || absSeg.reason === 'outcome_unreliable') absSeg.reason = 'direction_unfixed';
        return {
          scoreVersion: 'pitch-lbu-v1.2', massValid: massValid,
          driveGen: seg(drv.pos, drv.covReason, driveEv, oDrive,
            { key: 'pelvisRotVAbs', value: oDrive.v == null ? null : Math.round(oDrive.v), window: 'FC-BR', boundary: oDrive.boundary }),
          blockGen: seg(blk.pos, blk.covReason, blockEv, oBlock,
            { key: 'torsoRotVAbs', value: oBlock.v == null ? null : Math.round(oBlock.v), window: 'FC-BR', windowMs: winMs, boundary: oBlock.boundary }),
          blockAbsorb: absSeg,
          composite: { value: null, qualityStatus: 'unvalidated' }
        };
      })();
      return {
        strideTime: strideTime,
        propPeakTiming: propPeakTiming, impPeakRatio: (impPeakRatio == null ? null : Math.round(impPeakRatio * 1000) / 1000), comVelFC: comVelFC,
        pelOpenKF: r1(pelOpenKF), trkOpenKF: r1(trkOpenKF), hssFC: hssFC, hssBuildKF: hssBuildKF, trunkResistRatio: trunkResistRatio,
        leadKneeFlexFC: r1(leadKneeFlexFC), leadFootAngleFC: r1(leadFootAngleFC), driveKneeFlexKF: driveKneeFlexKF,
        wuPelCloseKH: wuPelCloseKH, wuPelCoil: wuPelCoil, wuTrunkCloseKH: wuTrunkCloseKH, wuTrunkCoil: wuTrunkCoil, wuHSS: wuHSS, wuHSSbuild: wuHSSbuild, wuDriveHipER: wuDriveHipER, wuCoilTq: wuCoilTq, wuPelVel: wuPelVel, wuTrkVel: wuTrkVel, wuShER: wuShER,
        handSepKHms: handSepKHms, earlySep: earlySep, handSepConf: handSepConf, handPostKH: handPostKH, elbowPostKH: elbowPostKH, horizAbdKH: horizAbdKH,
        merPk: absn(merPk), xfPeak: xfPeak, xfPeakFromFC: xfPeakFromFC, xfUnwindV: xfUnwindV, xfAtFC: xfAtFC, xfReleasedPctByFC: xfReleasedPctByFC, pelClose: pelClose, freeMo: freeMo, hipHinge: hipHinge, scapLoad: scapLoad, openAng: absn(openAng), leanBack: leanBack,
        rearProp: pctf(rearPropN), propImpPct: (propImp == null ? null : propImp / bw * 100), comVel: comVel, comVDrop: comVDrop, trunkLeanChange: trunkLeanChange, postureMaint: postureMaint, hipAbd: hipAbd, grfDelay: grfDelay, driveWork: driveWork,
        /* [2026-08-12 연구원 의견·구현1] 축발 추진 분리 신키 8종(전부 D·비점수) — raw(N·N·s)+정규화(%BW·%BW·s). r1 반올림, %는 /bw*100. */
        rearPropPeakPIKH_N: r1(_rearProp.peakPIKH_N), rearPropPeakPIKH_PctBW: (_rearProp.peakPIKH_N == null ? null : r1(_rearProp.peakPIKH_N / bw * 100)),
        rearPropImpulsePIKH_Ns: r2(_rearProp.impPIKH_Ns), rearPropImpulsePIKH_PctBWs: (_rearProp.impPIKH_Ns == null ? null : r2(_rearProp.impPIKH_Ns / bw * 100)),
        rearPropPeakKHFC_N: r1(_rearProp.peakKHFC_N), rearPropImpulseKHFC_Ns: r2(_rearProp.impKHFC_Ns),
        rearPropImpulsePIFC_Ns: r2(_rearProp.impPIFC_Ns), rearPropImpulsePIFC_PctBWs: (_rearProp.impPIFC_Ns == null ? null : r2(_rearProp.impPIFC_Ns / bw * 100)),
        rearPropForwardSign: (_rearProp.s_forward == null ? null : _rearProp.s_forward),
        /* [2026-08-12 연구원 의견·구현4 부분] 1.0 BW 하중수용 이벤트·분리 빌드업(전부 D·비점수). */
        hssLead1BW: _lead1bw.hssLead1BW, hssBuildKHLead1BW: _lead1bw.hssBuildKHLead1BW, fcToLead1BWMs: _lead1bw.fcToLead1BWMs,
        leadGrf: pctf(leadGrfN), leadVGRFImpulse: leadVGRFImpulse, comDecel: comDecel, comVelReductionFCBR: comVelReductionFCBR, apBrake: pctf(leadApGrfN), apBrakeImpulse: apBrakeImpulse, leadBrakeImpulse: leadBrakeImpulse, leadBrakePeak: pctf(leadBrakePeakN), leadKneeFlexionBR: r1(kBRa), kneeExtROM: kneeExtROM, kneeAbs: kneeBrace, kneeCollapse: kneeCollapse, kneeExtE: kneeExtE, kneeAbsE: kneeAbsE, comKEdrop: comKEdrop, rotKEpeak: rotKEpeak, rotKEgain: rotKEgain, linRotRatio: linRotRatio, trunkFlexV: absn(trunkFlexV), trunkLatV: absn(trunkLatV), trunkME: trunkME,
        torsoRotV: absn(torsoRotV), armRotV: absn(armRotV), humME: humME, elbowExtV: absn(elbowExtV), elbowP: absn(elbowP),
        trunkRotKE: _tSplit.rotKE, trunkFlexKE: _tSplit.flexKE, trunkLatKE: _tSplit.latKE, trunkRotShare: _tSplit.rotShare, trunkFlexShare: _tSplit.flexShare, trunkLatShare: _tSplit.latShare,
        vgrfPattern: _vgrf.pattern, vgrfTtp: _vgrf.ttp, vgrfDrop: _vgrf.drop, vgrfRetain: _vgrf.retain,
        ppKneeTrunk: ppKneeTrunk, ppTrunkHum: ppTrunkHum, ppShoElb: ppShoElb, armTransferRatio: armTransferRatio,
        shGen: shGen, elbAbs: (elbAbsR == null ? null : Math.abs(elbAbsR)), humMEt: humME,
        shForceTransfer: shForceTransfer, elForceTransfer: elForceTransfer,
        backHipTransfer: backHipTransfer, backKneeTransfer: backKneeTransfer, leadHipTransfer: leadHipTransfer, leadKneeTransfer: leadKneeTransfer, leadHipAbsorb: leadHipAbsorb,
        backHipNet: backHipNet, backHipLoad: backHipLoad, backHipPush: backHipPush, backHipPushLin: backHipPushLin, backHipPushRot: backHipPushRot, backKneePush: backKneePush,
        backHipPushWork: backHipPushWork, leadKneePush: leadKneePush,
        pelvisRotV: absn(pelvisRotV), kneeContribPct: kneeContribPct, kneeTrunkLag: kneeTrunkLag, kneeTransfer: kneeTransfer, driveType: driveType,
        relTimingMs: relTimingMs, armSlot: armSlot, strideLen: absn(strideLen), seqSpan: seqSpan,
        elbowMoment: elbowMomentPk, shoulderMoment: shoulderMomentPk, shoulderForce: shoulderForcePk, elbowForce: elbowForcePk, gloveShPow: gloveShPow, gloveHumME: gloveHumME,
        leadHipWork: leadHipWork, backHipMoment: backHipMoment, leadHipMoment: leadHipMoment, leadKneeMoment: leadKneeMoment, leadKneeForce: leadKneeForce, backHipWork: backHipWork,
        lowerBodyUtil: _lbu,   /* [2026-08-13 ①a] 하체 활용 3독립점수(중립·미검증·score:null) — 표시·현행 인덱스 차단은 ①b */
        leadKneeExtVel: leadKneeExtVel, efEtaE: efEtaE, efLeadHipHinge: efLeadHipHinge, efDeltaTrunkME: efDeltaTrunkME, efDeltaHumME: efDeltaHumME, efBalanceML: efBalanceML, efStoredPE: efStoredPE, efKappaH: efKappaH
      };
    }

    // [GPT inbox v1·P2] 점수용 스칼라 평균 B = valid_for_score trial만(이벤트 순서 gate). 전부 제외 시 전체 trial 폴백.
    function _trialOkForScore(t) { return !t || !t.validity || t.validity.valid_for_score !== false; }
    var _scoreTrialsPack = (function () {
      var all = (allTrials && allTrials.length) ? allTrials : [trial];
      var scored = all.filter(_trialOkForScore);
      return { trials: scored.length ? scored : all, usedFallback: !scored.length && all.length > 0, nUsed: (scored.length || all.length), nAll: all.length, nExcluded: all.length - (scored.length || all.length) };
    })();
    var _scoreTrials = _scoreTrialsPack.trials;
    // [2026-05-31] 평균 trial 점수화 — 체리피킹 제거. 숫자 변인은 점수용 trial 평균(B), 문자열(유형 등)은 대표 trial 유지.
    var _allScB = null;   // [2026-10-11] 투구별 스칼라(점수용 투구) — 뒷다리 → 골반 순 에너지 전달의 「투구 2/3 같은 쪽」 규칙이 쓴다(아래 _bhRule)
    var B = (function(){ var bt=scalars(trial); var _all=_scoreTrials.map(scalars); _allScB=_all; var o={}; Object.keys(bt).forEach(function(k){ var vs=_all.map(function(z){return z&&z[k];}).filter(function(x){return typeof x==='number'&&isFinite(x);}); o[k]=vs.length?(vs.reduce(function(a,b){return a+b;},0)/vs.length):bt[k]; }); return o; })();

    // [2026-05-27] flying open(조기 풀림) 평가 — 주지표=FC까지 풀린 비율(xfReleasedPctByFC), 보조=풀림 시점(xfPeakFromFC).
    //   최대 분리 대비 FC 시점에 이미 풀린 비율이 클수록 착지 전 분리 누수 = flying open. 엘리트 중앙 0%·>25% 명백.
    //   ★ FC 검출 신뢰도 의존: Theia=앞발 GRF(고신뢰) / Uplift=자체 이벤트 사용하나 X-Factor peak 시점 추정 한계로 저신뢰.
    var _xfFC = B.xfPeakFromFC, _foPct = B.xfReleasedPctByFC;
    var _foStatus = (_foPct == null) ? null : (_foPct > 25 ? '조기풀림' : (_foPct > 10 ? '경계' : '정상'));
    var _evSrc = (trial.events && trial.events.events_source) || (trial.meta && trial.meta.events_source) || null;
    var _foWarn = (!UPLIFT && _foPct != null && _foPct > 25)
      ? ('FC 시점에 최대 분리의 ' + Math.round(_foPct) + '%가 이미 풀림 — 착지 전 조기 풀림(flying open). ' + ((B.openAng != null && B.openAng >= 15) ? 'FC 몸통 열림 ' + r1(B.openAng) + '°로도 확인됨.' : '') + (_xfFC != null && _xfFC < 0 ? ' (최대 분리 시점 FC ' + r1(-_xfFC) + 'ms 전)' : ''))
      : null;

    // ── 가장 빠른/느린 투구 선택 (Rapsodo 구속) ──
    var withV = (allTrials || []).filter(function (t) { return t.rapsodo && t.rapsodo.velocity_kmh != null; });
    var fastT = null, slowT = null, fastKmh = null, slowKmh = null;
    if (withV.length >= 2) {
      fastT = withV[0]; slowT = withV[0];
      withV.forEach(function (t) {
        if (t.rapsodo.velocity_kmh > fastT.rapsodo.velocity_kmh) fastT = t;
        if (t.rapsodo.velocity_kmh < slowT.rapsodo.velocity_kmh) slowT = t;
      });
      if (fastT === slowT) { fastT = null; slowT = null; }
      else { fastKmh = r1(fastT.rapsodo.velocity_kmh); slowKmh = r1(slowT.rapsodo.velocity_kmh); }
    }
    var FS = fastT ? scalars(fastT) : null, SS = slowT ? scalars(slowT) : null;

    // M(label, value, unit, score, note, key, dir, warn)
    //   key = scalars 키(빠름/느림 비교용) · dir = +1 클수록 / -1 작을수록 / 'abs' 절대값 클수록
    //   warn = 경고 메시지(best 값 기준) 또는 null
    var M = function (label, value, unit, score, note, key, dir, warn) {
      return { label: label, value: value, unit: unit || '', score: (score == null ? null : score), note: note || '', key: key || null, dir: dir || null, warn: warn || null };
    };

    /* [2026-08-02 FIX] 선언 순서 — 아래 windup 블록이 _scRk 를 쓰므로 헬퍼를 그 위로 올린다.
       874b1ed(와인드업 range 정합화)에서 windup 에 _scRk 가 들어왔는데 NB(var) 선언은 그 뒤에
       있어, 재베이크 때 phases.compute 가 첫 선수에서 TypeError 로 죽었다(라이브 baked 산출물은
       그 전에 만들어져 있어 드러나지 않았다). 로직 변경 없음 — 위치만 이동. */
    var NB = (typeof PITCH_NORMS !== 'undefined') ? PITCH_NORMS : {};
    function _per(k){ var n=NB[k]; return n?(Math.abs(n.p75-n.p25)/1.349||1):1; }
    function _scN(v,k,d){ var n=NB[k]; return (v==null||!n)?null:sc(v,n.med,_per(k),d||1); }   // 방향성 점수(norm med·IQR)
    function _scRk(v,k){ var n=NB[k]; return (v==null||!n)?null:scR(v,n.p25,n.p75); }            // 적정범위 점수(엘리트 IQR 안=최고)
    // [2026-10-11] 방향 규칙 판정(엘리트 범위 아님) — 대표값(점수용 투구 평균)이 기준값(thr · 없으면 0 = 부호)의 어느 쪽인가 · 투구 2/3 이상이 같은 쪽일 때만 확정 · 섞이면 「판정 보류」(경계) · 투구 3구 미만 = 대표값 쪽
    function _bhRule(key, thr){ var v=B[key], t=(thr==null?0:thr); if(v==null||!isFinite(v)) return null;
      var vs=(_allScB||[]).map(function(z){ return z&&z[key]; }).filter(function(x){ return typeof x==='number'&&isFinite(x); });
      if(vs.length<3) return v>t?'정상':'미흡';
      var pos=vs.filter(function(x){ return x>t; }).length/vs.length;
      if(v>t&&pos>=2/3) return '정상'; if(v<=t&&pos<=1/3) return '미흡'; return '판정 보류'; }
    // [2026-10-11 교수 「진행」] 뒷고관절 일 — 푸시오프 판정 기준값(J/kg · 3축) = 공개 투수 자료(OBP 마커+힘판 100명) 선수 평균의 25백분위 0.959 — 같은 구간·같은 정의로 다시 계산.
    //   우리 엘리트 기준을 쓰지 않는 이유: 엘리트 가운데 0.76 = OBP 15백분위(엘리트도 덜 민다). 측정계 탓 아님 — 같은 계산의 앞다리 값(앞무릎 흡수·푸시오프 일)과 뒷고관절 모멘트는 OBP 수준 ·
    //   FC 무게중심 전진 속도도 OBP 11백분위. 재현성 ICC .90 · 뒷발 추진 몫 +.47 · FC 무게중심 속도 +.30(선수 사이) · 구속과는 약함(+.20 · OBP +.14) → 구속 약속 문구 금지.
    var BH_PUSH_WORK_FLOOR = 0.96;
    // [2026-10-11 교수 「권장대로」] 규칙 칸 점수화(기준값 점수) — 기준값에서 원점수(mech5 remap) 100 · 그 아래는 OBP 표준편차 1 당 15점 감점(기존 원점수 눈금과 같음).
    //   sc 눈금 = 100 + 5z → remap(3s − 175.325) 이 100 이 되는 sc = 91.775 → sc 의 기준점 = 기준값 + 1.645·표준편차. 판정 보류면 점수 없음(충족률에서 빠지는 것과 같게).
    //   표준편차 = OBP 100명 선수 평균 IQR ÷ 1.349(순 에너지 전달 0.797~1.516 → 0.533 · 푸시오프 일 0.959~1.680 → 0.534) · 판정(정상/미흡)은 그대로.
    var BH_NET_SD = 0.533, BH_PUSH_WORK_SD = 0.534;
    function _scThr(v, thr, per, st){ return (st === '판정 보류' || v == null || !isFinite(v) || !per) ? null : sc(v, thr + 1.645 * per, per, 1); }

    var windup = {
      key: 'windup', label: '1. 와인드업', sub: 'KH(다리들기 정점) 이전 — 드라이브 직전 회전·앞뒤 기울임(시상면) 부하 적재(코일·로딩)',
      metrics: [
        M('골반 닫힘각 (코일)', r1(B.pelClose), '°', sc(B.pelClose, 46, 34, 1), 'KH 이전 골반이 셋업 대비 횡단면으로 꼬인(닫힌) 최대 각 — 골반 코일·적재의 운동학 지표(Pelvis_Angle_Z excursion). 클수록 깊은 코일. freeMo(꼬임 토크)와 상관.', 'pelClose', 1),
        M('뒷발 지면반력 꼬임 토크', r1(B.freeMo), 'N·m', sc(B.freeMo, 12, 6, 1), 'KH 이전 최대 꼬임 토크 = 뒷발 지면반력 프리모멘트(Mz) 음의 피크 크기(꼬임=−) — 골반 코일을 만드는 역학적 동력. 클수록 적재. (양의 토크는 KH 직전 열림/드라이브 시작)', 'freeMo', 1),
        M('KH 시 몸통 기울기 (전후)', r1(B.trunkKH_fwd), '°', _scRk(B.trunkKH_fwd, 'trunkKH_fwd'), '무릎 최고점(KH) 시점 몸통 전후 기울기(Trunk_Angle_X) — 음수(−)=전경(앞으로 숙임), 양수(+)=후경. 와인드업 안정성 및 전진 준비 자세 지표(고려대 규준 반영).', 'trunkKH_fwd', 'range'),
        // ── 회전 에너지 저장(preload) — PI~KH · 엘리트 n=20 · 평가="엘리트 범위 적합"(부족<p25 / 엘리트범위 / 높음>p75), 클수록 좋음 아님 ──
        M('골반 닫힘각 (무릎 최고점)', r1(B.wuPelCloseKH), '°', _scRk(B.wuPelCloseKH, 'wuPelCloseKH'), '무릎 최고점(KH)에서 위에서 본 골반 방향 각(좌표 기준). 감긴 양과는 구분. 엘리트 범위에 가까운지로 평가.', 'wuPelCloseKH', 'range'),
        M('골반 감긴 양 (다리 들기~무릎 최고점)', r1(B.wuPelCoil), '°', _scRk(B.wuPelCoil, 'wuPelCoil'), '다리 들기~무릎 최고점 사이 골반이 반대로 감긴 변화량 = 와인드업 동안 감은 양.', 'wuPelCoil', 'range'),
        M('몸통 닫힘각 (무릎 최고점)', r1(B.wuTrunkCloseKH), '°', _scRk(B.wuTrunkCloseKH, 'wuTrunkCloseKH'), '무릎 최고점에서 위에서 본 몸통 방향 각.', 'wuTrunkCloseKH', 'range'),
        M('몸통 감긴 양 (다리 들기~무릎 최고점)', r1(B.wuTrunkCoil), '°', _scRk(B.wuTrunkCoil, 'wuTrunkCoil'), '다리 들기~무릎 최고점 사이 몸통이 반대로 감긴 변화량.', 'wuTrunkCoil', 'range'),
        M('골반·몸통 분리 (무릎 최고점)', r1(B.wuHSS), '°', _scRk(B.wuHSS, 'wuHSS'), '무릎 최고점 X-Factor(|trial.x_factor|). 착지 무렵 peak와 시점이 다름. 엘리트 범위 참고.', 'wuHSS', 'range'),
        M('비틀림 쌓인 양 (다리 들기~무릎 최고점)', r1(B.wuHSSbuild), '°', _scRk(B.wuHSSbuild, 'wuHSSbuild'), '다리 들기~무릎 최고점 사이 비틀림이 늘어난 양.', 'wuHSSbuild', 'range'),
        M('축발 고관절 바깥 돌림 (무릎 최고점)', r1(B.wuDriveHipER), '°', _scRk(B.wuDriveHipER, 'wuDriveHipER'), '무릎 최고점에서 축발(뒷발) 고관절이 바깥으로 돌아간 정도. 지나치면 힘이 샐 수 있음 → 엘리트 범위에 가까운지로 평가.', 'wuDriveHipER', 'range'),
        M('축발 비트는 힘 (체중 대비)', (B.wuCoilTq == null ? null : Math.round(B.wuCoilTq * 1000) / 1000), 'N·m/kg', _scRk(B.wuCoilTq, 'wuCoilTq'), '다리 들기~무릎 최고점, 축발(뒷발)이 땅을 감는 방향으로 비트는 힘의 최댓값 ÷ 체중. 반대 방향 힘은 제외. 엘리트 범위에 가까운지로 평가.', 'wuCoilTq', 'range'),
        M('골반 회전 속도 (와인드업)', r1(B.wuPelVel), '°/s', _scRk(B.wuPelVel, 'wuPelVel'), '다리 들기~무릎 최고점, 골반이 도는 속도의 최댓값. 지나치면 급한 흔들림 가능 → 엘리트 범위에 가까운지로 평가.', 'wuPelVel', 'range'),
        M('몸통 회전 속도 (와인드업)', r1(B.wuTrkVel), '°/s', _scRk(B.wuTrkVel, 'wuTrkVel'), '다리 들기~무릎 최고점, 몸통이 도는 속도의 최댓값. 지나치면 상체가 일찍 돌 수 있음 → 엘리트 범위에 가까운지로 평가.', 'wuTrkVel', 'range'),
        (function(){ var m=M('KH 어깨 Z각 (보조)', r1(B.wuShER), '°', null, (UPLIFT?'마커리스':'Theia')+' 어깨 Z축 각(무릎 최고점). ★실제 임상 어깨 외회전과 축 정의가 달라 보조 참고값. KH 팔 조기 장전 위험 신호는 손분리·팔 뒤쪽 위치로 별도 평가(개요 배지 참고).', 'wuShER', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('균형 ML 변위 (start→KH)', B.efBalanceML, 'cm', null, 'COM ML 변위폭 · 와인드업 균형 context · neutral · score 미반영.', 'efBalanceML', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('저장 PE (start→KH)', B.efStoredPE, 'J', null, 'm·g·ΔCOM_z 상승 · 위치에너지 저장 context · neutral.', 'efStoredPE', 1); m.neutral=true; return m; })()
      ]
    };
    // ── 2. 드라이브 (KH→FC) — [2026-06-03 재구성 v3 · 개발지침서] 3기능: ①전진 에너지 생성 ②회전 preload 전개 ③FC 블로킹 입력 조건 ──
    //   해석타입(itype): performance(클수록↑) / optimal(엘리트 범위 적정·과도 주의) / risk(클수록 위험) / transition(블로킹과 함께 해석).
    //   점수 반영(mech6 MAP)=propImpPct·rearProp(생성)+postureMaint·strideLen(자세·결과 optimal)+hssBuildKF(회전준비 부분). 나머지=참고·전환·위험(neutral, 화면 표시).
    //   모듈 그룹(smod): gen 전진생성 / posture 자세·COM / rot 회전준비 / fcinput FC블로킹입력.
    var _trkOpenWarn = (B.trkOpenKF!=null && NB.trkOpenKF && B.trkOpenKF > NB.trkOpenKF.p75) ? ('몸통이 KH→FC 중 '+r1(B.trkOpenKF)+'° 열림 — 엘리트 상위 범위 초과(조기 열림 주의)') : null;
    var _blkLowBrake = !!(NB.apBrakeImpulse && B.apBrakeImpulse != null && B.apBrakeImpulse < NB.apBrakeImpulse.p25);
    var _blkLowCom = !!(NB.comVelReductionFCBR && B.comVelReductionFCBR != null && B.comVelReductionFCBR < NB.comVelReductionFCBR.p25);
    var _blkHighCollapse = !!(NB.kneeCollapse && B.kneeCollapse != null && B.kneeCollapse > NB.kneeCollapse.p75);
    var _blkLowSupport = !!(NB.vgrfRetain && B.vgrfRetain != null && B.vgrfRetain < NB.vgrfRetain.p25);
    var _blkPenalty = (_blkHighCollapse && _blkLowBrake && _blkLowCom) ? 15 : ((_blkHighCollapse && (_blkLowBrake || _blkLowCom)) ? 10 : 0);
    var _blkRiskWarn = _blkPenalty ? '앞무릎 무너짐와 제동 부족이 함께 나타남 — Collapse / Leakage risk' : null;
    var _blkType = (function () {
      var brakeOK = !(NB.apBrakeImpulse && B.apBrakeImpulse != null && B.apBrakeImpulse < NB.apBrakeImpulse.p25);
      var comOK = !(NB.comVelReductionFCBR && B.comVelReductionFCBR != null && B.comVelReductionFCBR < NB.comVelReductionFCBR.p25);
      var supportOK = !(NB.vgrfRetain && B.vgrfRetain != null && B.vgrfRetain < NB.vgrfRetain.p25);
      if (_blkHighCollapse && (_blkLowBrake || _blkLowCom)) return { key: 'collapse_leakage', label: 'Collapse / Leakage Type', easy: '블로킹 안정성 보강형' };
      if (B.kneeExtROM != null && NB.kneeExtROM && B.kneeExtROM >= NB.kneeExtROM.p75 && brakeOK && comOK) return { key: 'extension', label: 'Extension Blocking Type', easy: '신전 블로킹형' };
      if (B.kneeExtROM != null && B.kneeExtROM < 0 && brakeOK && comOK && !_blkHighCollapse) return { key: 'controlled_flexion', label: 'Controlled Flexion Type', easy: '조절 굴곡형' };
      if (brakeOK && comOK && supportOK) return { key: 'bracing_holding', label: 'Bracing / Holding Type', easy: '버팀·유지형' };
      return { key: 'mixed', label: 'Mixed Blocking Type', easy: '혼합형' };
    })();
    var drive = {
      key: 'drive', label: '2. 드라이브 (밀고 나가기)', sub: 'KH→FC · Pre-FC 준비의 생성 단계 — 앞으로 미는 힘 생성 · 낮은 자세 유지 · 회전 준비 · 착지(FC) 블로킹 조건 형성',
      metrics: [
        // ── A. 전진 에너지 생성 (얼마나 잘 밀어 전진 운동량을 만들었나) ──
        M('뒷발 추진 임펄스', r2(B.propImpPct), '%BW·s', _scN(B.propImpPct,'propImpPct',1), '∫추진력=전진 운동량 생성 · ★핵심 추진 지표(클수록 좋음) · 엘리트 중앙 '+(NB.propImpPct?NB.propImpPct.med:'–')+'%BW·s', 'propImpPct', 1),
        (function(){ var m=M('뒷발 추진 최대힘 (참고)', r1(B.rearProp), '%BW', null, '뒷발이 홈쪽으로 미는 힘 peak · 순간 추진력(임펄스와 함께 봄) · 엘리트 중앙 '+(NB.rearProp?NB.rearProp.med:'–')+'%BW · [2026-10-12 교수 「권장대로」] 참고로(드라이브 = 충격량 원칙 10-08 · 우리 엘리트 27명 구속 r +.04 · OBP +.22)', 'rearProp', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('추진 peak 타이밍', r1(B.propPeakTiming), '%', null, '추진 최대힘이 KH→FC 중 발생 시점(%) · 너무 이르면 조기 소실·늦으면 FC 준비 부족 · 엘리트 중앙 '+(NB.propPeakTiming?NB.propPeakTiming.med:'–')+'%', 'propPeakTiming', 1); m.neutral=true; m.itype='optimal'; return m; })(),
        (function(){ var m=M('COM 전진속도 @FC', r2(B.comVelFC), 'm/s', null, '착지 시점 무게중심 전진속도 · 생성된 전진운동의 결과(검증 지표) · 엘리트 중앙 '+(NB.comVelFC?NB.comVelFC.med:'–')+'m/s', 'comVelFC', 1); m.neutral=true; m.itype='optimal'; return m; })(),
        /* [2026-08-12 연구원 의견·구현1] 축발 추진 구간 분리 — 분석원 표시(전부 참고·비점수·normNA). 절대(N·N·s)와 체중 대비(%BW·%BW·s) 병기.
           ★기존 '뒷발 추진 임펄스(%BW·s)'·'뒷발 추진 최대힘(%BW)'과 이중 가산 금지 — 같은 force curve라 점수는 기존 정규화값 1개만. */
        (function(){ var m=M('초기 추진 최대힘 (PI→KH)', B.rearPropPeakPIKH_N, 'N', null, '다리 들기~무릎 최고점, 축발 전방(홈 방향) 지면반력 최대 · 절대값(체격 영향 포함) · 체중 대비 '+(B.rearPropPeakPIKH_PctBW==null?'–':B.rearPropPeakPIKH_PctBW+'%BW')+' · 참고(비점수)', 'rearPropPeakPIKH_N', 1); m.neutral=true; m.normNA=true; m.smod='gen'; m.pair='rearPropPeakPIKH_PctBW'; return m; })(),
        (function(){ var m=M('초기 추진 임펄스 (PI→KH)', B.rearPropImpulsePIKH_Ns, 'N·s', null, '다리 들기~무릎 최고점 전방 추진 임펄스(∫F⁺dt) · 절대값 · 체중 대비 '+(B.rearPropImpulsePIKH_PctBWs==null?'–':B.rearPropImpulsePIKH_PctBWs+'%BW·s')+' · 참고(비점수) · ★기존 KH→FC 임펄스와 다른 구간', 'rearPropImpulsePIKH_Ns', 1); m.neutral=true; m.normNA=true; m.smod='gen'; m.pair='rearPropImpulsePIKH_PctBWs'; return m; })(),
        (function(){ var m=M('드라이브 추진 최대힘 (KH→FC·절대)', B.rearPropPeakKHFC_N, 'N', null, '기존 「뒷발 추진 최대힘(%BW)」의 절대(N) 짝 · 체격 영향 포함 · 참고(비점수·점수는 %BW쪽)', 'rearPropPeakKHFC_N', 1); m.neutral=true; m.normNA=true; m.smod='gen'; m.pair='rearProp'; return m; })(),
        (function(){ var m=M('드라이브 추진 임펄스 (KH→FC·절대)', B.rearPropImpulseKHFC_Ns, 'N·s', null, '기존 「뒷발 추진 임펄스(%BW·s)」의 절대(N·s) 짝 · 참고(비점수·점수는 %BW·s쪽)', 'rearPropImpulseKHFC_Ns', 1); m.neutral=true; m.normNA=true; m.smod='gen'; m.pair='propImpPct'; return m; })(),
        (function(){ var m=M('총 추진 임펄스 (PI→FC)', B.rearPropImpulsePIFC_Ns, 'N·s', null, '전 구간 합(≈초기+드라이브) · 체중 대비 '+(B.rearPropImpulsePIFC_PctBWs==null?'–':B.rearPropImpulsePIFC_PctBWs+'%BW·s')+' · 분해 검산용 · 선수 카드 기본 숨김 · 참고(비점수)', 'rearPropImpulsePIFC_Ns', 1); m.neutral=true; m.normNA=true; m.smod='gen'; m.aux=true; return m; })(),
        (function(){ var m=M('뒷다리 고관절 내전 속도', r1(B.hipAbd), '°/s', null, '뒷다리 고관절 내전 방향 peak 각속도(IMU 직접) · 추진 보조 · 참고', 'hipAbd', 1); m.neutral=true; return m; })(),
        (function(){ var _bh3=!!(trial&&trial.series&&trial.series.Back_Hip_Power_3AX_X); var m=M('뒷고관절 일 (KH→FC)', r1(B.backHipWork), 'J', null, _bh3?'뒷고관절 3축(신전·외전·회전) 순 파워의 양의 일 ∫P·dt=추진 동력원(고관절 단독) · 참고(마커리스 관절동역학) · 판정은 푸시오프 구간만 본 「뒷고관절 일 — 푸시오프」':'뒷고관절 양의 일 ∫P·dt=추진 동력원(고관절 단독) · 참고(마커리스 관절동역학)', 'backHipWork', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('뒷다리 신전 일 (드라이브)', r1(B.driveWork), 'J', null, '뒷고관절+무릎 양의 일 · 추진력·임펄스와 중복·노이즈 → 참고', 'driveWork', 1); m.neutral=true; return m; })(),
        /* [2026-10-11 교수 「C · 지금 모두」] 뒷다리 에너지 흐름(방향) — 판정 = 순 에너지 전달 하나(방향 규칙 · 엘리트 범위 아님) · 로딩·푸시오프·성분·뒷무릎 = 참고.
           옛 「관절력으로 전달된 일」 두 칸은 내려간 몫이라 판정에서 뺀다(값은 참고로 남김). 칸이 없는 옛 판 자료는 새 칸 값 없음(—). */
        (function(){ var m=M('뒷다리 → 골반 순 에너지 전달 (KH→FC)', r2(B.backHipNet), 'J/kg', null, 'KH→FC 동안 뒷고관절을 지나 골반으로 들어온 에너지의 순 합(골반 쪽 분절 파워 적분) = 로딩(KH→뒷무릎 최대 굽힘 · 보통 − = 골반 → 뒷다리) + 푸시오프(→FC · 보통 + = 뒷다리 → 골반) · + = 뒷다리가 골반에 에너지를 더함 · − = 로딩 때 빠져나간 만큼 푸시오프로 되돌리지 못함 · 판정 = 방향(0 기준 · 투구 2/3 이상이 같은 쪽일 때 확정 · 섞이면 판정 보류) · 점수 = 기준값(0) 점수 · 크기 기준 없음', 'backHipNet', 1);
          // [2026-10-12 교수 「권장대로」 · OBP 검토] 방향(부호) 규칙 판정 보류 → 표시만: OBP 원신호 관절력 파워 순적분(PKH→FC) 100세션 중 81 이 음수(med −0.36 J/kg) · 구속 r +.04 · 우리 엘리트 27명 13 음수 · r +.11 → 음수 = 미흡으로 볼 근거 없음 · 판정은 「뒷고관절 일 — 푸시오프」(기준값)가 맡음
          m.neutral=true; m.role='D'; return m; })(),
        /* [2026-10-11 교수 「진행」] 뒷고관절 일 — 푸시오프 = 크기 판정(기준값 BH_PUSH_WORK_FLOOR · 엘리트 범위 아님) · 같은 「기준값의 어느 쪽」 규칙(rule 'sign' + thr) · 과제 문구 보류(역할 정본 deferred) */
        (function(){ var m=M('뒷고관절 일 — 푸시오프 (뒷무릎 최대 굽힘→FC)', r2(B.backHipPushWork), 'J/kg', null, '푸시오프(뒷무릎 최대 굽힘→FC) 동안 뒷고관절 근육이 만든 일(3축 관절 파워의 양(+) 적분 · 체중당) — 고관절 신전·회전으로 만든 일의 크기 · 판정 = 기준값 '+BH_PUSH_WORK_FLOOR+' J/kg 보다 크면 정상(공개 투수 자료 OBP 100명의 하위 25% 선 · 투구 2/3 이상이 같은 쪽일 때 확정 · 섞이면 판정 보류) · 점수 = 기준값 점수 · 3축 칸이 있는 자료만', 'backHipPushWork', 1);
          var st=_bhRule('backHipPushWork', BH_PUSH_WORK_FLOOR); if(st){ m.st=st; m.rule='sign'; m.thr=BH_PUSH_WORK_FLOOR; m.scored=true; m.score=_scThr(B.backHipPushWork, BH_PUSH_WORK_FLOOR, BH_PUSH_WORK_SD, st); } return m; })(),
        (function(){ var m=M('로딩 구간 뒷다리 → 골반 에너지 (KH→뒷무릎 최대 굽힘)', r2(B.backHipLoad), 'J/kg', null, '− = 골반에서 뒷다리로 빠져나간 에너지(로딩 · 보통 −) · 순 에너지 전달 = 로딩 + 푸시오프 · 참고', 'backHipLoad', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('푸시오프 구간 뒷다리 → 골반 에너지 (뒷무릎 최대 굽힘→FC)', r2(B.backHipPush), 'J/kg', null, '+ = 뒷다리에서 골반으로 들어온 에너지(정상 방향) · 0 이하 = 방향 결함 · 크기 판정은 「뒷고관절 일 — 푸시오프」 · 참고', 'backHipPush', 1, (B.backHipPush != null && B.backHipPush <= 0) ? '푸시오프 때 뒷다리에서 골반으로 들어온 에너지 없음 — 방향 결함' : null); m.neutral=true; return m; })(),
        (function(){ var m=M('푸시오프 에너지 — 관절력 성분 (JFP · 병진)', r2(B.backHipPushLin), 'J/kg', null, '푸시오프 때 골반으로 들어온 에너지 중 관절력 파워(F·v) 성분 — 골반 병진(홈 쪽 전진)과 같이 감 · 참고', 'backHipPushLin', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('푸시오프 에너지 — 분절 토크 성분 (STP · 회전)', r2(B.backHipPushRot), 'J/kg', null, '푸시오프 때 골반으로 들어온 에너지 중 분절 토크 파워(M·ω) 성분 — 골반 회전 · 참고', 'backHipPushRot', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('푸시오프 구간 뒷하퇴 → 뒷대퇴 에너지 (뒷무릎 최대 굽힘→FC)', r2(B.backKneePush), 'J/kg', null, '+ = 뒷하퇴에서 뒷대퇴로 들어온 에너지(정상 방향) · 0 이하 = 방향 결함 · 크기 기준 없음 · 참고', 'backKneePush', 1, (B.backKneePush != null && B.backKneePush <= 0) ? '푸시오프 때 뒷하퇴에서 뒷대퇴로 들어온 에너지 없음 — 방향 결함' : null); m.neutral=true; return m; })(),
        (function(){ var m=M('뒷고관절 관절력으로 전달된 일 — 골반→뒷대퇴', r1(B.backHipTransfer), 'J', null, '뒷고관절 관절력 파워(F·v)의 양(+) 적분(무릎 최고점→착지) — 골반 쪽에서 뒷대퇴 쪽으로 들어간 일(근위→원위 · J · 그 대부분이 로딩 구간) · 드라이브(원위→근위)를 잰 값이 아님 → 판정 제외(2026-10-11 · 방향 판정은 「뒷다리 → 골반 순 에너지 전달」) · 참고', 'backHipTransfer', 'range'); m.neutral=true; return m; })(),
        (function(){ var m=M('뒷무릎 관절력으로 전달된 일 — 뒷대퇴→뒷하퇴', r1(B.backKneeTransfer), 'J', null, '뒷무릎 관절력 파워(F·v)의 양(+) 적분(무릎 최고점→착지) — 뒷대퇴 쪽에서 뒷하퇴 쪽으로 들어간 일(근위→원위 · J) · 드라이브(원위→근위)를 잰 값이 아님 → 판정 제외(2026-10-11 · 방향은 「푸시오프 구간 뒷하퇴 → 뒷대퇴 에너지」) · 참고', 'backKneeTransfer', 'range'); m.neutral=true; return m; })(),
        (function(){ var m=M('무게중심 전진 속도 (피크)', r2(B.comVel), 'm/s', null, '전진속도 peak · 추진 계열과 중복 → 참고(그룹 위치)', 'comVel', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('뒷고관절 모멘트 (결과)', r1(B.backHipMoment), 'N·m', null, '뒷고관절 모멘트 peak(3축 결과)=추진 토크 · 판정하지 않음 — 크기가 공개 투수 자료(OBP)와 같은 수준이고 엘리트·나머지 차이가 없으며 구속·드라이브 결과와 관계 없음(2026-10-11) · 부족한 쪽은 이 힘으로 고관절 신전·회전을 해 낸 일(「뒷고관절 일 — 푸시오프」) · 참고(Theia 직접)', 'backHipMoment', 1); m.neutral=true; return m; })(),
        // ── B. 자세·COM 관리 (낮은 자세·힙힌지를 잃지 않고 이동했나) ──
        M('자세 유지 점수', r1(B.postureMaint), '점', _scN(B.postureMaint,'postureMaint',1), '0.7·백분위(COM 낙하)+0.3·백분위(몸통 전경변화) 가중합(0~100) · 낮은 자세·전경 유지 · [2026-06-22] 단조(클수록↑)로 수정 — 구속 r=.31·상한 페널티 데이터 미지지(기존 적정범위=pos↔st 모순). 성능·안전 이중성(과도 전경↔elbow varus)은 분해검증 백로그 · 엘리트 범위 '+(NB.postureMaint?NB.postureMaint.p25+'~'+NB.postureMaint.p75:'–'), 'postureMaint', 1),
        (function(){ var m=M('COM 수직 낙하 (KH→FC)', r1(B.comVDrop), 'cm', null, '무게중심 낙하량=낮은 자세 유지(자세 유지 점수 주성분 0.7) · 적정 범위(과도 시 무너짐) · 엘리트 범위 '+(NB.comVDrop?NB.comVDrop.p25+'~'+NB.comVDrop.p75+'cm':'–'), 'comVDrop', 1); m.neutral=true; m.itype='optimal'; return m; })(),
        (function(){ var m=M('몸통 전경 변화 (KH→FC)', r1(B.trunkLeanChange), '°', null, 'Trunk_X[KH]−[FC] · 상체 전경 유지(자세 유지 점수 0.3 성분) · 음수=전경 유지', 'trunkLeanChange', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('뒷무릎 굴곡 변화 (KH→FC)', r1(B.driveKneeFlexKF), '°', null, '낮은 자세가 고관절 힌지인지 주저앉음인지 구분 · +면 더 굽음 · 참고', 'driveKneeFlexKF', 1); m.neutral=true; m.itype='optimal'; return m; })(),
        (function(){ var m=M('드라이브 시간 (KH→FC)', r2(B.strideTime), 's', null, '드라이브 소요시간 · 빠른 템포형은 짧아도 정상(적정 범위) · 엘리트 중앙 '+(NB.strideTime?NB.strideTime.med:'–')+'s', 'strideTime', 1); m.neutral=true; m.itype='optimal'; return m; })(),
        // ── C. 회전 준비 (와인드업 preload가 회전 준비로 이어졌나) ──
        (function(){ var m=M('분리 빌드업 (KH→FC · 참고)', r1(B.hssBuildKF), '°', null, 'FC−KH X-Factor 분리 발달량 · 엘리트 중앙 '+(NB.hssBuildKF?NB.hssBuildKF.med:'–')+'° · [2026-10-12 교수 「권장대로」 · OBP 검토] 「클수록 좋음」 점수 해제 → 참고: 우리 엘리트 27명 구속 r −.14 · 분리 수준(FC·최대)도 −.09~−.12 · OBP 는 착지 시 분리 수준만 +.32', 'hssBuildKF', 1); m.neutral=true; return m; })(),
        /* [2026-08-12 연구원 의견·구현4 부분] KH→1.0 BW 하중수용 시점까지의 분리 빌드업(대안 지표·참고·비점수). ★기존 KH→FC(hssBuildKF)와 나란히 비교·대체 아님.
           full-foot plant(해부학적 안착) 시점 지표는 heel/toe 접지 gold 라벨 검증 후 추가 예정(이연). */
        (function(){ var m=M('분리 빌드업 (KH→1.0BW 하중)', r1(B.hssBuildKHLead1BW), '°', null, '앞발 수직힘이 체중(1.0 BW)에 처음 도달한 시점의 |X-Factor| − KH |X-Factor| · KH→FC의 대안 창(하중수용 기준) · 참고(비점수) · 미도달 시 값 없음', 'hssBuildKHLead1BW', 1); m.neutral=true; m.normNA=true; m.smod='rot'; return m; })(),
        (function(){ var m=M('1.0BW 하중 도달 시간 (FC→)', B.fcToLead1BWMs, 'ms', null, '착지 후 앞발 수직힘이 체중에 도달하기까지 시간 · 하중수용 속도 맥락 · 참고(비점수) · ★full-foot plant(안착)와 다른 하중 사건', 'fcToLead1BWMs', 1); m.neutral=true; m.normNA=true; m.smod='rot'; return m; })(),
        (function(){ var m=M('골반 열림 (KH→FC)', r1(B.pelOpenKF), '°', null, '골반 횡단면 회전 시작량 · 회전 생성 시작 · 전환 준비 변인 · 엘리트 중앙 '+(NB.pelOpenKF?NB.pelOpenKF.med:'–')+'°', 'pelOpenKF', 1); m.neutral=true; m.itype='transition'; return m; })(),
        (function(){ var m=M('몸통 열림 (KH→FC · 참고)', r1(B.trkOpenKF), '°', null, '몸통 횡단면 회전량 · [2026-10-12 교수 「권장대로」 · OBP 검토] 「클수록 위험」 점수(07-03 · dir=-1) 해제 → 참고: 우리 엘리트 27명 구속 r +.35(열릴수록 빠름) · OBP 착지 시 몸통 회전 −.04 → 방향 근거 없음 · 엘리트 중앙 '+(NB.trkOpenKF?NB.trkOpenKF.med:'–')+'°', 'trkOpenKF', 0); m.neutral=true; return m; })(),
        (function(){ var m=M('몸통 버팀비 (골반÷몸통 열림)', r2(B.trunkResistRatio), '비', null, '골반은 열리고 몸통은 버티는지 · >1=골반 선행(중심부=근위 먼저 양호) · 엘리트 중앙 '+(NB.trunkResistRatio?NB.trunkResistRatio.med:'–'), 'trunkResistRatio', 1); m.neutral=true; m.itype='transition'; return m; })(),
        // ── D. 착지(FC) 블로킹 입력 조건 (드라이브 결과 = 블로킹 입력값) ──
        M('보폭 (키%)', r1(B.strideLen), '%', _scRk(B.strideLen,'strideLen'), '★[2026-08-12 명문화] FC(앞발 최초 접촉) 시점 양 발끝(L_TOE·R_TOE)의 지면 수평거리 ÷ 신장. FC는 이벤트 태그 우선, 누락 시 앞발 수직힘 10N 최초 도달로 검출(발끝 좌표 없으면 CoP→STRIDE_LENGTH_X 폴백). ‘완전 안착’이나 ‘1.0BW 도달’ 시점 아님 · 적정 범위(너무 짧으면 전진 부족·너무 길면 FC 무너짐) · 엘리트 범위 '+(NB.strideLen?NB.strideLen.p25+'~'+NB.strideLen.p75+'%':'–')+'(중앙 '+(NB.strideLen?NB.strideLen.med:'–')+'%)', 'strideLen', 1),
        (function(){ var m=M('FC 리드무릎 굴곡', r1(B.leadKneeFlexFC), '°', null, '착지 시 앞무릎 굽힘 · 블로킹 준비자세 · 너무 펴지면 흡수 부족·너무 굽으면 무너짐(적정 범위) · 엘리트 범위 '+(NB.leadKneeFlexFC?NB.leadKneeFlexFC.p25+'~'+NB.leadKneeFlexFC.p75+'°':'–'), 'leadKneeFlexFC', 1); m.neutral=true; m.itype='optimal'; m.smod='fcinput'; return m; })(),
        (function(){ var m=M('스트라이드 선 방향 (참고)', r1(B.leadFootAngleFC), '°', null, '★[2026-08-12 정정] 이 값은 앞발 heel→toe 방향이 아니라 뒷발 CoP→앞발 CoP 선(스트라이드 선) 방향(FC→BR) · 앞발 방향 연구의 독립변수가 아니므로 밴드·판정은 이미 제거됨 · 손잡이 정규화·target-line 기준의 앞발 방향 v2(heel→toe)는 발끝 마커 채널·OBP crosswalk 검증 후 별키로 추가 예정(이연) · ★부상 위험 표시 금지 — 부하 맥락 후보로만', 'leadFootAngleFC', 1); m.neutral=true; m.itype='transition'; m.smod='fcinput'; m.normNA=true; m.aka='strideLineAngle'; return m; })(),
        (function(){ var m=M('골반·몸통 분리 @FC', r1(B.hssFC), '°', null, 'FC 시점 |X-Factor|=블로킹 직전 회전 preload · 전환 핵심 · 엘리트 중앙 '+(NB.hssFC?NB.hssFC.med:'–')+'°', 'hssFC', 1); m.neutral=true; m.itype='transition'; m.smod='fcinput'; return m; })()
      ]
    };
    // 단계 모듈 그룹·해석타입 태깅 (report 4모듈 표시·밴드 의미 분기) + 적정범위 변인은 dir='range'(부족/엘리트 범위/높음)로 전환 — 기존 인프라 재사용, p75 초과를 '우수'로 표시 안 함.
    (function(){
      var SM={ propImpPct:'gen',rearProp:'gen',propPeakTiming:'gen',comVelFC:'gen',hipAbd:'gen',backHipWork:'gen',driveWork:'gen',comVel:'gen',backHipMoment:'gen', postureMaint:'posture',comVDrop:'posture',trunkLeanChange:'posture',driveKneeFlexKF:'posture',strideTime:'posture', hssBuildKF:'rot',pelOpenKF:'rot',trkOpenKF:'rot',trunkResistRatio:'rot', strideLen:'fcinput',leadKneeFlexFC:'fcinput',leadFootAngleFC:'fcinput',hssFC:'fcinput' };
      var RANGE={ strideLen:1,comVDrop:1,comVelFC:1,strideTime:1,propPeakTiming:1,driveKneeFlexKF:1,leadKneeFlexFC:1,leadFootAngleFC:1 };  // optimal/transition 적정범위 → dir='range' · [2026-06-22] postureMaint 제거(단조 전환·구속 r=.31)
      drive.metrics.forEach(function(m){
        if(!m.key) return;
        if(SM[m.key]&&!m.smod) m.smod=SM[m.key];
        if(!m.itype){ if(m.key==='propImpPct'||m.key==='rearProp'||m.key==='hssBuildKF') m.itype='performance'; else if(m.key==='postureMaint'||m.key==='strideLen') m.itype='optimal'; }
        if(RANGE[m.key]) m.dir='range';
      });
    })();

    var blocking = {
      key: 'blocking', label: '3. 블로킹 (착지·제동)', sub: '전진 에너지 제동 · COM 제어 · 앞다리 지지 · 앞무릎 전략/위험 분리',
      metrics: [
        (function(){ var m=M('블로킹 유형', _blkType ? _blkType.easy : null, '', null, '앞무릎 신전량·무너짐 정도·제동 임펄스·전진속도 감소를 함께 본 전략 분류. 우열 점수가 아니라 해석 라벨. 전달 효율은 이 유형(ROM)이 아니라 ‘앞무릎 신전속도’가 가름(34명 검증 r≈.55) — 유형=서술 라벨.', 'blockingType', null); m.neutral=true; return m; })(),
        M('제동 임펄스 (FC→BR)', r2(B.apBrakeImpulse), '%BW·s', _scN(B.apBrakeImpulse,'apBrakeImpulse',1), '앞발 AP 제동력의 시간 누적량(∫|FP2_Y|dt/BW) · peak보다 실제 전진 에너지를 얼마나 충분히 멈췄는지에 가까운 핵심 score 변인 ★정의 주의(2026-08-12 코덱스 확정): 절대값 적분이라 제동+추진 성분이 섞임 — 방향 성분만의 재정의판(아래 "제동 임펄스(재정의)")을 병기 · 점수 제외 여부는 역할 개편(안건1)과 함께 결정·규준 스케일 유지 위해 현행 산출 불변', 'apBrakeImpulse', 1),
        (function(){ var m=M('제동 임펄스 (재정의·방향 성분)', r2(B.leadBrakeImpulse), '%BW·s', null, '진행방향 반대(제동) 성분만 적분한 재정의 임펄스 — F_brake=max(0, −진행부호·FP2_Y), FC→릴리스, 체중 정규화(코덱스 P1-4·2026-08-12 착수 · ★부호 규약 2026-10-11 확정판 TXT 358시행으로 확정 — 제동 = 진행 방향의 반대 부호). 기존 "제동 임펄스"(절대값 적분)의 교정판. ★비점수·규준 없음 — 잠금 코호트 검증 후 승격 예정(핵심 후보 3종 선행). 저속 신호 기준·고속 이관은 후속.', 'leadBrakeImpulse', 1); m.neutral=true; m.role='D'; m.normNA=true; return m; })(),
        (function(){ var m=M('앞발 제동력 peak (방향 성분)', r1(B.leadBrakePeak), '%BW', null, '진행 방향 반대(제동) 성분의 최댓값(FC→릴리스 · 체중 대비) — 2026-10-11 부호 규약 확정 뒤 표시 전용으로 연 칸(교수 「권장대로」 · 연구원 답 #36). 기존 "앞발 AP 제동력 peak (deprecated)"(부호 미정 · 옛 규준 스케일)의 교정판 · ★비점수·규준 없음.', 'leadBrakePeak', 1); m.neutral=true; m.role='D'; m.normNA=true; return m; })(),
        M('전진속도 감소량 (FC→BR)', r2(B.comVelReductionFCBR), 'm/s', _scN(B.comVelReductionFCBR,'comVelReductionFCBR',1), '착지 후 공 릴리스까지 COM 전진속도가 줄어든 양. 낮으면 앞다리에서 전진 에너지가 충분히 멈추지 못하고 몸이 계속 앞으로 밀리는 패턴.', 'comVelReductionFCBR', 1),
        (function(){ var m=M('바닥 힘 후기 유지율', (B.vgrfDrop==null?null:r1(100-B.vgrfDrop)), '%', null, '앞발 수직 지면반력이 정점 후 릴리스까지 얼마나 유지됐나(100−후기 최대 감소율). ★[2026-06-21] 릴리스 단일프레임이라 i_br 흔들림·빠른신전형(앞다리 일찍 펴고 볼팅)을 약점 오판 → 채점 제외(context), 블로킹 강도는 임펄스로. 패턴 표시만. 정점 도달 ' + (B.vgrfTtp==null?'–':B.vgrfTtp+'%') + '·후기 감소 ' + (B.vgrfDrop==null?'–':B.vgrfDrop+'%'), 'vgrfRetain', 1); m.neutral=true; return m; })(),
        M('앞발 수직 지지 임펄스', r2(B.leadVGRFImpulse), '%BW·s', _scN(B.leadVGRFImpulse,'leadVGRFImpulse',1), '앞발 수직 지지력의 시간 누적(∫). ★[2026-06-21] 블로킹 강도의 생체역학 정론 — 릴리스 단일프레임(vgrfRetain) 대신 본 임펄스를 채점(코치검증 재검토). 단 GRF=구속 강예측이라 약점은 블록유형과 함께 해석.', 'leadVGRFImpulse', 1),
        (function(){ var m=M('앞발 AP 제동력 peak (deprecated)', r1(B.apBrake), '%BW', null, '기존 apBrake score는 산식/부호/스케일이 PITCH_NORMS와 맞지 않아 Blocking score에서 제외. 산식 확인 전 연구자용 context/debug로만 유지.', 'apBrake', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('제동 가속도 peak (보조)', r2(B.comDecel), 'm/s²', null, 'COM 전진속도의 순간 감속 peak. 미분/필터링·이벤트에 민감하므로 score 대신 전진속도 감소량과 함께 보는 context.', 'comDecel', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞발 수직 GRF peak', r1(B.leadGrf), '%BW', null, '앞발 수직 지면반력 순간 peak. 수직 지지 맥락 지표이며, 단독으로 클수록 좋다고 단정하지 않음.', 'leadGrf', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 신전 ROM (유형)', r1(B.kneeExtROM), '°', null, 'FC→BR 앞무릎 각도 변화(+신전/−굴곡). score 직접 반영이 아니라 Extension/Bracing/Controlled Flexion/Collapse 유형 분류용.', 'kneeExtROM', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('BR 리드무릎 굴곡각', r1(B.leadKneeFlexionBR), '°', null, '공 릴리스 시점 앞무릎 굴곡각. FC 굴곡각·신전 ROM과 함께 앞무릎 전략 분류에 사용.', 'leadKneeFlexionBR', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 굴곡 무너짐 정도 (risk)', r1(B.kneeCollapse), '°', null, '착지 후 FC 대비 무릎이 추가로 굽은 최대량. 단독 score 평균이 아니라 제동 임펄스/전진속도 감소 부족과 함께 나타날 때 Collapse / Leakage risk 및 penalty로 처리.', 'kneeCollapse', -1, _blkRiskWarn); m.neutral=true; return m; })(),
        (function(){ var m=M('블로킹 위험 penalty', _blkPenalty, '점', null, 'kneeCollapse가 엘리트 p75 초과이고 제동 임펄스 또는 전진속도 감소가 p25 미만이면 10~15점 감점. 일반 score 평균 변인이 아니라 조건부 risk penalty.', 'blockRiskPenalty', -1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 버팀 모멘트 (context)', r1(B.kneeAbs), 'N·m', null, '앞무릎이 굴곡 부하에 저항하며 받는 편심 버팀 모멘트 peak · 마커리스 역동역학 추정이므로 score보다 context', 'kneeAbs', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 흡수 에너지 — X축(굴곡·신전) 성분 (context)', r1(B.kneeAbsE), 'J', null, '앞무릎 음의 파워 적분 크기. 흡수 적음=항상 좋음으로 단정하지 않고 버팀 지속성·collapse와 함께 해석.', 'kneeAbsE', -1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞다리 버팀 겹침률 (SSOT)', (B.kneeTransfer==null?null:r1(B.kneeTransfer*100)), '%', null, '[K5-A SSOT] VGRF×골반 각가속 overlap %. score 미반영 · etdiag 종합점수(5요소)와 정의 상이 → legacy/research만.', 'kneeTransfer', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('COM 운동에너지 감소량 (블록)', r1(B.comKEdrop), 'J', null, '무릎 최고점~릴리스 구간 몸 중심(COM) 전진 속도 최고점 뒤 최저점까지 줄어든 운동에너지 ½m(v_peak²−v_min²) — 전진 운동에너지 감소 관찰값(앞다리 몫만 따로 나눈 값 아님 · 착지 기준 값 아님) · 이 에너지가 회전으로 바뀌었다는 뜻은 아님(회전 운동에너지 증가는 따로 잼) · 점수에는 쓰지 않는 참고값', 'comKEdrop', 1); m.neutral=true; return m; })(),
        // [2026-06-10 4b] Uplift(GRF 없음)는 블로킹 score 변인 3종(apBrake·vgrf·leadVGRF)이 비어 → 키네마틱 전환 변인으로 score 부여.
        //   Theia(UPLIFT=false)는 기존 그대로 neutral(참고) → Theia 점수 diff=0 보장. Uplift만 score 집계.
        (function(){ var m=M('회전 KE 증가 (골반+몸통)', r1(B.rotKEgain), 'J', UPLIFT?_scN(B.rotKEgain,'rotKEgain',1):null, '착지 뒤 골반+몸통 회전 운동에너지(½Iω², de Leva)가 늘어난 양 — 전진 에너지 감소와 함께 보는 관찰값이며, 그 에너지가 회전으로 바뀐 양이라는 뜻은 아님 · 잡음이 커 점수가 아닌 참고(분위수 19/39/46 J)', 'rotKEgain', 1); m.neutral=!UPLIFT; return m; })(),
        (function(){ var m=M('전진→회전 운동에너지 변화비', (B.linRotRatio==null?null:r1(B.linRotRatio)), '%', UPLIFT?_scN(B.linRotRatio,'linRotRatio',1):null, '회전 운동에너지 증가(착지→최고점) ÷ 전진 운동에너지 감소(무릎 최고점~릴리스) ×100 — 구간이 다른 두 양의 비율 · 덜 멈출수록(분모가 작을수록) 커질 수 있어 높을수록 좋은 값이 아니며, 전환된 비율이나 효율이 아님 · 참고값(목표 아님 · 분위수 9/17/24%)', 'linRotRatio', 1); m.neutral=!UPLIFT; return m; })(),
        (function(){ var m=M('전환 효율 η_E', B.efEtaE, '', null, '변화비 ÷ 100 — 회전 운동에너지 증가(착지→최고점) ÷ 전진 운동에너지 최대 감소(무릎 최고점~릴리스) · 1을 넘을 수 있고 효율 아님(이름의 「효율」은 옛 표현) · 참고 · 점수 미반영 · 34명 자료 기준', 'efEtaE', 'range'); m.neutral=true; m.lowConfidence=true; return m; })(),
        M('앞무릎 신전속도 peak', B.leadKneeExtVel, '°/s', _scN(B.leadKneeExtVel, 'leadKneeVelPk', 1), 'FC→BR Lead_Knee_Ang_Vel_X 신전방향 peak. 블로킹→몸통 회전 전달 효율 지표(34명 검증 r≈.55·유형 무관 공통·비중복) → 점수화. [2026-06-14]', 'leadKneeVelPk', 1),
        M('앞무릎 버팀량 (FC→BR 신전 · 회전 조직화)', B.kneeExtROM==null?null:r1(B.kneeExtROM), '°', _scRk(B.kneeExtROM,'kneeExtROM'), '착지→릴리스 앞무릎 순 신전(버팀량, =kneeExtROM). ★[2026-07-11 OBP within 검증→채점 승격] 버팀→몸통 회전속도 within +0.33(전체 최강 선수내 고리·GRF 통제 후 +0.30·partial +0.29 독립) = 지면반력을 회전으로 넘기는 관문. ★적정범위(range) 채점: 유형(신전-vault/버팀-흡수) 유효성 존중 — 낮음=결함 아닌 전략, 엘리트 IQR(2.4~22.7°) 밖 극단만 감점(방향채점 아님). 구속 직접효과는 작음(<1mph·회전 조직화 근거)이라 range로 신중 편입. ★재베이크·velo 검증 게이트(라이브 점수 반영=재베이크 시).', 'kneeExtROM', 'range'),
        (function(){ var m=M('앞무릎 신전 일 (앞무릎 최대 굽힘→BR)', r2(B.leadKneePush), 'J/kg', null, '앞무릎 최대 굽힘→BR 동안 앞무릎 신전으로 만든 일(굴곡·신전(X) 파워의 양(+) 적분 · 체중당) · 이 구간 전진속도 감소·몸통 회전 속도와 같이 커짐 · 판정은 같은 요인(상관 높음)인 앞무릎 신전속도·버팀량이 함 · 참고', 'leadKneePush', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞고관절 hinge (FC→MER)', B.efLeadHipHinge, '°', null, 'Lead_Hip_Angle_X[MER]−[FC]. 전환 자세 context · neutral.', 'efLeadHipHinge', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('운동량계수 κ_H', B.efKappaH, '', null, '앞뒤면(시상면) H 기반 전환계수 — 채널 미연결 · 데이터 축적 중 · low-confidence · neutral.', 'efKappaH', 'range'); m.neutral=true; m.lowConfidence=true; return m; })(),
        // [2026-05-26] 신 Theia 직접 하지 키네틱(블록). 기준은 엘리트 그룹로 산출(BIOMOTION_NORMS 교체 후 z 표시). 엘리트 변별 큼(앞고관절 일 9 vs 39J 등).
        (function(){ var m=M('앞고관절 일 (context)', r1(B.leadHipWork), 'J', null, '블록 구간 앞고관절 양의 일. 앞다리 능동 활용 context이나 마커리스 역동역학 추정.', 'leadHipWork', 1); m.neutral=true; return m; })(),
        /* [2026-10-11 교수 「진행」] 앞다리 옛 「관절력으로 전달된 일」 두 칸 = 판정 제외(값은 참고) — 위에서 아래로 내려간 몫이라 브레이크(FC→앞무릎 최대 굽힘) 흡수와 같은 묶음(선수 사이 ρ −.37~−.63) ·
           구속(+.07/−.10)·전진속도 감소(+.18/+.03)·몸통 회전 속도(0)와 관계 없음(체중당 · 코호트 38명). 뒷다리 두 칸과 같은 처리 · mech5/mech6 블로킹 점수 목록에서도 뺌. */
        (function(){ var m=M('앞고관절 관절력으로 전달된 일 — 골반→앞대퇴', r1(B.leadHipTransfer), 'J', null, '앞고관절 관절력 파워(F·v)의 양(+) 적분(착지→릴리스) — 골반 쪽에서 앞대퇴 쪽으로 들어간 일(J) · 앞다리에서 골반으로 올라가는 전달을 잰 값이 아님 · 반대 방향 몫과 관절 토크 파워는 이 값에 들어 있지 않음 · 판정 제외(2026-10-11 · 브레이크 흡수와 같은 요인(상관 높음) · 구속·전진속도 감소·몸통 회전과 관계 없음) · 참고', 'leadHipTransfer', 'range'); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 관절력으로 전달된 일 — 앞대퇴→앞하퇴', r1(B.leadKneeTransfer), 'J', null, '앞무릎 관절력 파워(F·v)의 양(+) 적분(착지→릴리스) — 앞대퇴 쪽에서 앞하퇴 쪽으로 들어간 일(J) · 아래에서 위로 올라가는 전달을 잰 값이 아님 · 반대 방향 몫과 관절 토크 파워는 이 값에 들어 있지 않음 · 판정 제외(2026-10-11 · 브레이크 흡수와 같은 요인(상관 높음) · 구속·전진속도 감소·몸통 회전과 관계 없음 — 버티기·신전 판정은 앞무릎 신전속도·버팀량) · 참고', 'leadKneeTransfer', 'range'); m.neutral=true; return m; })(),
        (function(){ var m=M('앞고관절 관절력으로 전달된 일 — 앞대퇴→골반', r1(B.leadHipAbsorb), 'J', null, '앞고관절 관절력 파워(F·v)의 음(−) 부분 적분 크기(착지 직전~릴리스) — 앞대퇴 쪽에서 골반 쪽으로 관절력을 통해 들어간 일(J) · 관절이 에너지를 「흡수」한 양이 아니며, 클수록 단단한 블로킹이라는 뜻도 아님 · 우리 마커리스 89명에서 구속과 r=+.43 · 참고(무채점·밴드=엘리트28 중앙 '+(NB.leadHipAbsorb?NB.leadHipAbsorb.med:'–')+'J · 2026-08-12 수동 발행).', 'leadHipAbsorb', 1); m.neutral=true; return m; })(),
        (function(){ // [2026-07-11] leadKneeTransfer 「저전달 잔차」 진단 플래그 → [2026-10-11 교수 「진행」] 쓰지 않음(값 없음): 기준 칸이 브레이크 때 내려간 몫이라 「전달 누수」로 읽을 근거가 없음.
          var m=M('앞무릎 전달 잔차 (상류 통제·진단)', null, '', null, '쓰지 않음(2026-10-11) — 기준 칸 「앞무릎 관절력으로 전달된 일」이 근위→원위로 들어간 일(브레이크 흡수와 같은 요인)이라 「전달 누수」 진단 근거가 없어 판정에서 뺌 · 버티기·신전은 앞무릎 신전속도·버팀량으로 봄', 'leadKneeTransferResid', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞고관절 모멘트 (research)', r1(B.leadHipMoment), 'N·m', null, '앞고관절 모멘트 peak. research_only/debug 성격.', 'leadHipMoment', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 모멘트 (research)', r1(B.leadKneeMoment), 'N·m', null, '앞무릎 모멘트 peak. research_only/debug 성격이며 kneeAbs와 중복 가능.', 'leadKneeMoment', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('앞무릎 관절력 (부하)', r1(B.leadKneeForce), 'N', null, '앞무릎 관절 반력 peak · 성능 score보다 부하 맥락(단독 우열 아님)', 'leadKneeForce', 1); m.neutral=true; return m; })(),
        (function(){ var _pat=(B.vgrfTtp==null||B.vgrfDrop==null)?B.vgrfPattern:((B.vgrfTtp>=65&&B.vgrfDrop<=25)?'증가형':((B.vgrfTtp<=40&&B.vgrfDrop>=45)?'감소형':'유지형')); var m=M('바닥 미는 힘 유지 패턴', _pat, '', null, '앞발 수직 지면반력의 시간 패턴: 증가형(릴리스까지 유지·상승)·유지형(plateau)·감소형(조기 정점 후 급감). 무릎 각도유형과 별개 차원 — 각도가 버텨도 GRF가 조기 감소하면 후기 지지 약화. 그룹 34명에서 유지형이 구속·회전 최고.', 'vgrfPattern', null); m.neutral=true; return m; })(),
        (function(){ var be=null; if(B.torsoRotV!=null&&B.apBrake!=null){ var pred=837+19.6*B.apBrake; var resid=B.torsoRotV-pred; be=Math.max(10,Math.min(100,Math.round(50+resid/57.6*15))); } var m=M('블로킹→회전 전환 연결', be, '', null, '몸통 회전 속도가 제동 크기로 예측한 값(837+19.6×제동)보다 얼마나 높은지(잔차)를 10~100으로 바꾼 참고값 · 블로킹과 회전 사이의 인과나 시간 연결을 뜻하지 않으며, 몸통 회전 변인과 겹쳐 블로킹 점수에서 뺌', 'blockConvEff', 1); m.neutral=true; return m; })()
      ]
    };

    // 4. 에너지 저장 (블로킹 다음 신설): 착지~코킹기 탄성 에너지 저장 — 분리·외회전·로딩·뒤젖힘
    var storage = {
      key: 'storage', label: '4. 몸통 (저장)', sub: '착지~코킹기 탄성 에너지 저장 — 골반·몸통 분리(X-Factor)·어깨 외회전·견갑 로딩·몸통 뒤젖힘',
      metrics: [
        (function(){ var m=M('피크 X-Factor (분리 크기)', r1(B.xfPeak == null ? null : Math.abs(B.xfPeak)), '°', null, '골반-몸통 분절 간 수직축 상대회전(Trunk_wrt_Pelvis_Angle_Z) KH→BR peak · 코치=|magnitude| · 골반과 몸통이 얼마나 분리되어 회전 준비가 되었는지를 봄 · 분리가 크다고 항상 좋은 것은 아니며, 언제 만들어지고 언제 풀리는지가 중요 · 엘리트 중앙 ' + ((typeof PITCH_NORMS !== 'undefined' && PITCH_NORMS.xfPeak) ? PITCH_NORMS.xfPeak.med : '–') + '°.', 'xfPeak', 1); m.neutral=true; m.signedValue=B.xfPeak; m.displayAbsCoach=true; return m; })(),
        (function(){ var m=M('어깨 MER (최대 외회전)', r1(B.merPk), '°', null, '코킹기 최대 외회전. [A5] 적정 범위형 — 과도·부족 모두 MER·몸통 전달과 함께 해석(arm MAP score 제외).', 'merPk', 'range'); m.neutral=true; return m; })(),
        (function(){ var m=M('견갑골 로딩 (프록시)', r1(B.scapLoad), '°', null, '견갑골 로딩 프록시 = FC 어깨 수평외전 |각|. [A5] range·context — 단독 우열 아님(arm MAP score 제외).', 'scapLoad', 'range'); m.neutral=true; return m; })(),
        M('FC 몸통 뒤젖힘각', r1(B.leanBack), '°', _scN(B.leanBack, 'leanBack', 1), '착지 시 후방 기울임(직립=0, 뒤로 +). +가 정상, 음수면 FC에서 앞으로 굽음 경고', 'leanBack', 1, (B.leanBack != null && B.leanBack < 0) ? 'FC에서 몸통이 앞으로 ' + r1(-B.leanBack) + '° 굽음 — 후방 기울임 부족' : null),  // [H3 2026-06-14] sc(10.1,4.6)→_scN(norm med 2.6): 표시밴드(norm)와 점수 정합
        M('FC 몸통 열림 각도', r1(B.openAng), '°', _scN(B.openAng, 'openAng', -1), '착지 시 몸통 열림(3루/1루 정면=0, 홈쪽으로 갈수록 큼). 작을수록 닫힘 유지(조기 오픈 시 저장 누수, 20° 이상 경고)', 'openAng', -1, (B.openAng != null && B.openAng >= 20) ? 'FC에서 몸통이 ' + r1(B.openAng) + '° 열림 — 조기 오픈(flying open) 주의' : null),  // [H3/M1 2026-06-14] sc(0.8,6.3)→_scN(norm med 11.3): 엘리트 중앙값 자기변인 저점 해소
        M('flying open — FC까지 풀린 비율' + (_foStatus ? ' · ' + _foStatus : ''), B.xfReleasedPctByFC, '%', UPLIFT ? null : _scN(B.xfReleasedPctByFC, 'xfReleasedPctByFC', -1),  // [H3 2026-06-14] sc(0,5)→_scN(norm med 0)
          '최대 X-Factor 대비 착지(FC) 시점에 이미 풀린 분리의 비율 = flying open 정량 지표. (최대 분리가 FC 이전에 발생한 경우만 산정; FC 이후면 0=분리 유지.) 엘리트 그룹 중앙 0%·p90 5%·최대 16%. 평가 등급: 정상(≤10%) · 경계(10~25%) · 조기풀림(>25%). FC 시 X-Factor='
          + (B.xfAtFC != null ? r1(B.xfAtFC) + '° / 최대 ' + r1(B.xfPeak == null ? null : Math.abs(B.xfPeak)) + '°. ' : '. ')
          + (UPLIFT
            ? 'Uplift는 FC=자체검출 사용하나 X-Factor peak 시점 추정 한계로 참고용(저신뢰) — 정밀 평가는 Theia(앞발 GRF FC) 권장.'
            : (_evSrc === 'kinematic'
              ? '키네마틱 FC 검출(힘판 미측정). 현재 평가: ' + (_foStatus || '-') + '.'   // [2026-07-19 grf_absent 정직성] 힘판 없는 세션은 GRF 기반 FC라 주장하지 않음
              : 'Theia=앞발 GRF 기반 FC라 신뢰. 현재 평가: ' + (_foStatus || '-') + '.')),
          'xfReleasedPctByFC', -1, _foWarn),
        (function(){ var m=M('X-Factor 풀림 시점 (FC 기준, 보조)', B.xfPeakFromFC, 'ms', null, '최대 분리 시점 − FC. 양수=FC 직후 유지(엘리트 중앙 +13ms), 음수=착지 전 풀림. flying open 주지표는 위 「FC까지 풀린 비율」. ' + (UPLIFT ? 'Uplift 저신뢰(참고용).' : ''), 'xfPeakFromFC', 1); m.neutral=true; return m; })(),
        M('X-Factor 풀림 속도', B.xfUnwindV, '°/s', _scN(B.xfUnwindV, 'xfUnwindV', 1), 'peak 분리 이후 BR 까지 분리가 줄어드는 최대 각속도 = 상체가 골반을 따라잡는(풀림) 속도. 엘리트 그룹 중앙 772°/s. 적절히 빨라야 저장된 탄성 에너지가 상체로 전달됨', 'xfUnwindV', 1)  // [H3 2026-06-14] sc(772,70)→_scN(norm med 772·IQR per)
      ]
    };
    // [2026-05-31→2026-07-03] xfPeak = 분리 형성 '크기' 맥락 지표(현재 neutral·적정범위형: 과도·부족 모두 주의). 구속 예측력(r≈0.1) 근거는 삭제(메카닉≠구속) — 전달은 타이밍(xfReleasedPctByFC·xfUnwindV·hssBuildKF)이 담당하므로 크기는 맥락으로 유지.

    // 5. 몸통·팔 가속 (FC→릴리스): 착지 후 근위→원위 몸통·팔 가속 — 회전(횡단면) + 굴곡(시상면) 키네마틱스/키네틱스
    var release = {
      key: 'release', label: '5. 몸통 (생성)', sub: '착지~릴리스(FC→BR) 몸통·팔 가속 — 골반→몸통→팔 회전 + 몸통 굴곡 + 분절 에너지',
      metrics: [
        M('골반 회전 속도', r1(B.pelvisRotV), '°/s', _scN(B.pelvisRotV,'pelvisRotV',1), 'FC→BR 골반 회전 각속도 peak (중심부=근위 회전 동력, 엘리트 중앙 '+(NB.pelvisRotV?NB.pelvisRotV.med:'–')+'°/s)', 'pelvisRotV', 1),
        M('몸통 회전 속도', r1(B.torsoRotV), '°/s', _scN(B.torsoRotV,'torsoRotV',1), '흉곽(가슴) 회전 각속도 · 엘리트 중앙 '+(NB.torsoRotV?NB.torsoRotV.med:'–')+'°/s', 'torsoRotV', 1),
        M('몸통 굴곡 속도', r1(B.trunkFlexV), '°/s', _scN(B.trunkFlexV,'trunkFlexV',1), '상체 전방 굴곡(앞으로 숙임) 각속도 peak — 엘리트 중앙 '+(NB.trunkFlexV?NB.trunkFlexV.med:'–')+'°/s', 'trunkFlexV', 1),
        M('팔 회전 속도', r1(B.armRotV), '°/s', _scN(B.armRotV,'armRotV',1), '어깨 내회전 각속도 · 엘리트 중앙 '+(NB.armRotV?NB.armRotV.med:'–')+'°/s', 'armRotV', 1),
        (function(){ var m=M('팔꿈치 신전 속도', r1(B.elbowExtV), '°/s', null, '전완 각속도 peak. [A5] optional context — 높다고 무조건 우수 아님(몸통 전달 부족 시 팔꿈치 의존 가능). 엘리트 중앙 '+(NB.elbowExtV?NB.elbowExtV.med:'–')+'°/s', 'elbowExtV', 1); m.neutral=true; return m; })(),
        M('몸통 ME 피크', r1(B.trunkME), 'J', _scN(B.trunkME, 'trunkME', 1), '몸통 분절 역학에너지. 클수록 좋음', 'trunkME', 1),  // [H3 2026-06-14] sc(588,42)→_scN(norm med 480.4): 엘리트 중앙값 밴드'정상'↔점수87 모순 해소
        M('몸통 역학적 에너지 · 체중당(위치에너지 포함)', (B.trunkME!=null&&meta&&meta.weight_kg?r2(B.trunkME/meta.weight_kg):null), 'J/kg', _scN((B.trunkME!=null&&meta&&meta.weight_kg?B.trunkME/meta.weight_kg:null), 'trunkME_kg', 1), '몸통 분절 역학적 에너지(위치에너지 + 병진 운동에너지 + 회전 운동에너지)의 정점을 체중으로 나눈 값(J/kg) · 효율이나 몸통 근육이 만든 에너지를 잰 값 아님 · 절대값(J)은 체격과 r≈0.86이라 함께 봄', 'trunkME_kg', 1),  // [2026-06-21 코치검증 재검토] 에너지 체격의존 보정·병기
        M('상완 ME 피크', r1(B.humME), 'J', _scN(B.humME, 'humME', 1), '투구 상완 분절 역학에너지. 클수록 좋음', 'humME', 1),  // [H3 2026-06-14] sc(207,23)→_scN(norm med 154.2)
        M('상완 역학적 에너지 · 체중당(위치에너지 포함)', (B.humME!=null&&meta&&meta.weight_kg?r2(B.humME/meta.weight_kg):null), 'J/kg', _scN((B.humME!=null&&meta&&meta.weight_kg?B.humME/meta.weight_kg:null), 'humME_kg', 1), '투구 팔 상완 분절 역학적 에너지(위치에너지 + 병진 운동에너지 + 회전 운동에너지)의 정점을 체중으로 나눈 값(J/kg) · 효율을 잰 값 아님 · 상완은 체중과 r≈0.48이라 절반은 속도 신호', 'humME_kg', 1),  // [2026-06-21 코치검증 재검토] 에너지 체격의존 보정·병기
        (function(){ var m=M('몸통 돌리기 에너지', r1(B.trunkRotKE), 'J', null, '몸통 축회전 운동에너지(½Iω², 추정). ★회전 속도(점수)와 r=.83으로 거의 같은 변인이라 점수 중복 → 참고(분배%·절대J 추정)로만. 회전 분배 ' + (B.trunkRotShare == null ? '–' : B.trunkRotShare + '%'), 'trunkRotKE', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('몸통 앞으로 덮기 에너지', r1(B.trunkFlexKE), 'J', null, '몸통 전방 굴곡 운동에너지(½Iω², 추정). 굴곡 속도(점수)와 같은 계열 → 참고로만. 굴곡 분배 ' + (B.trunkFlexShare == null ? '–' : B.trunkFlexShare + '%'), 'trunkFlexKE', 1); m.neutral=true; return m; })(),
        M('몸통 측굴 속도', r1(B.trunkLatV), '°/s', _scN(B.trunkLatV, 'trunkLatV', 1), '몸통 측굴(옆 기울이기) 각속도 peak — 팔 높이·릴리스 기여(분절내 운동학이라 에너지 대신 속도로 점수). 검증(34명): 엘리트 324>상동고 288°/s, 구속 r=.51. 클수록 좋음', 'trunkLatV', 1),  // [H3 2026-06-14] sc(404,31)→_scN(norm med 322)
        (function(){ var m=M('몸통 옆 기울이기 에너지', r1(B.trunkLatKE), 'J', null, '몸통 측굴 운동에너지(½Iω², 추정). 측굴 속도(점수)와 같은 계열 → 참고로만. 측굴 분배 ' + (B.trunkLatShare == null ? '–' : B.trunkLatShare + '%'), 'trunkLatKE', 1); m.neutral=true; return m; })(),
        (function(){ var m=M('몸통 에너지 변화(착지→릴리스)', B.efDeltaTrunkME, 'J', null, 'Trunk_ME[FC]−[BR] · 역동역학 low-confidence · context · score 미반영.', 'efDeltaTrunkME', 1); m.neutral=true; m.lowConfidence=true; return m; })(),
        (function(){ var m=M('ΔHumME (MER→BR)', B.efDeltaHumME, 'J', null, 'Humerus_ME[MER]−[BR] · low-confidence · context · score 미반영.', 'efDeltaHumME', 1); m.neutral=true; m.lowConfidence=true; return m; })(),
        (function(){ var m=M('어깨·팔꿈치 관절 파워 정점 시간차', r1(B.ppShoElb), 'ms', null, '어깨 관절 파워 정점에서 팔꿈치 관절 파워 정점까지의 시간차(ms) · 팔 안에서 에너지가 넘어간 순서를 잰 값이 아니라 두 정점의 시각 차이 · 그룹에서는 팔꿈치 정점이 먼저 오는 경우가 많아 음수가 흔하며, 우열이 아니라 그룹 안 위치로 봄', 'ppShoElb', 1); m.neutral=true; return m; })()
        // [2026-05-26] 팔꿈치 신전 파워(역동역학 추정) 삭제(교수 지시) — 릴리스는 직접 운동학(회전속도·분절KE)만 유지
      ]
    };

    // [2026-05-26] 부상 잠재 부하(추정) — 상지 관절 토크/관절력(어깨→팔꿈치). 상체가속에서 분리해 '비효율' 다음 부상 탭으로 이동(교수 지시).
    //   마커리스 역동역학 추정 + 14쌍 보정값. 부상 확률이 아니라 임계 대비 상대 부하 스크리닝.
    var injuryLoad = {
      key: 'injuryload', aux: true, label: '부상 잠재 부하 (추정)', sub: '상지 관절 토크·관절력 — 회전 가속을 만들고 견디는 내부 부하 (어깨→팔꿈치 순). 마커리스 역동역학 추정·14쌍 보정. 참고용·단독 진단 금지',
      metrics: [
        M('어깨 관절 모멘트(3축 합성 크기)', r1(B.shoulderMoment), 'N·m', null, '투구 어깨 관절 모멘트의 3축 합성 크기 정점(N·m) — 회전근개·관절낭 부하 지표 · 내회전 성분만 따로 잰 값 아님 · 어깨·팔꿈치 부하는 거의 같은 양(우리 r 0.94) — 따로 떼어 해석하지 않음 · 마커리스 역동역학 추정·14쌍 보정', 'shoulderMoment', 1),
        M('어깨 분리력 (distraction)', r1(B.shoulderForce), 'N', null, '투구 어깨 관절 반력 peak(결과) — 견인 부하 부상지표. 마커리스 역동역학 추정·14쌍 보정', 'shoulderForce', 1),
        M('팔꿈치 관절 모멘트(3축 합성 크기)', r1(B.elbowMoment), 'N·m', null, '투구 팔꿈치 관절 모멘트의 3축 합성 크기 정점(N·m) · 외반(내측) 성분만 따로 잰 값이 아니어서 내측측부인대(UCL)가 받는 부하와 같지 않음 · 어깨·팔꿈치 부하는 거의 같은 양(우리 r 0.94) — 따로 떼어 해석하지 않음 · 마커리스 역동역학 추정·14쌍 보정', 'elbowMoment', 1),
        M('팔꿈치 관절력', r1(B.elbowForce), 'N', null, '투구 팔꿈치 관절 반력 peak(결과) — 관절 부하. 마커리스 역동역학 추정·14쌍 보정', 'elbowForce', 1)
      ]
    };

    var transfer = null;
    if (energyTransfer) {
      var magM = [
        (function(){ var m=M('어깨 에너지 생성 — X축(굴곡·신전) 성분', r1(B.shGen), 'J', null, '어깨 관절 에너지 생성 ∫P dt. [A5] load context — 몸통 전달 부족 시 어깨 보상 가능(arm MAP score 제외).', 'shGen', 1); m.neutral=true; return m; })(),
        M('어깨 관절력으로 전달된 에너지 — 몸통→상완(관절력 경로 성분)', r1(B.shForceTransfer), 'J', _scRk(B.shForceTransfer,'shForceTransfer'), '어깨 관절력 파워(F·v)의 양(+) 적분 — 몸통 쪽에서 상완 쪽으로 관절력을 통해 들어간 일(J) · 관절력 경로 성분이며 몸통→팔 에너지 전달 전체가 아님 · 관절 토크 파워 경로는 포함하지 않고, 허리(L5/S1) 관절은 이 모델에 없음 · 적정범위 점수(엘리트 n=28 IQR · coach-blind 검증완료·2026-07-02 교수 승인)', 'shForceTransfer', 'range'),
        M('팔꿈치 관절력으로 전달된 에너지 — 상완→전완(관절력 경로 성분)', r1(B.elForceTransfer), 'J', _scRk(B.elForceTransfer,'elForceTransfer'), '팔꿈치 관절력 파워(F·v)의 양(+) 적분 — 상완 쪽에서 전완 쪽으로 관절력을 통해 들어간 일(J) · 관절력 경로 성분이며 에너지 전달 전체가 아님 · 관절 토크 파워 경로는 포함하지 않음 · 적정범위 점수(엘리트 n=28)', 'elForceTransfer', 'range'),
        (function(){ var m=M('팔꿈치 에너지 흡수 — X축(굴곡·신전) 성분', r1(B.elbAbs), 'J', null, '팔꿈치 감속 흡수 에너지. [A5] load context — 전달·방출 부족 시 팔꿈치 부담 신호(클수록 좋음 아님).', 'elbAbs', 'abs'); m.neutral=true; return m; })()
      ];
      var _SEQK = { '시퀀스 정확도':'seqPct', '채찍 가속 (팔/몸통)':'whipRatio', '운동사슬 타이밍':'chainTiming' };  // 그룹 기준 부여용 키
      var _SEQLBL = { seqPct:'순서 정확도 (하체→몸통→팔)', whipRatio:'팔 채찍 효과', chainTiming:'연결 타이밍' };  // [2026-06-15 #1] 현장 야구 용어 라벨
      var effM = (energyTransfer.metrics || []).map(function (m) { var k = _SEQK[m.label] || null; return M(_SEQLBL[k] || m.label, m.value, m.unit, m.score, m.note, k, 1); });
      // [2026-06-15 #1 운동사슬] 변별 점수 = '팔 채찍 효과'(whipRatio, 어깨/몸통 속도비, norm 3.0/3.2/3.7 n=20)만.
      //   '순서 정확도'(seqPct)는 손-타이밍 기반이라 거칠고(0/33/67/100·천장) 엘리트 오탐 → 점수 제외.
      //   '연결 타이밍'은 방향 모호 → 표시 맥락.
      //   [GPT검토 item3] whipRatio 단독 '전달 우수' 판정 금지 — torsoRotV/armTransferRatio/ppTrunkHum/trunkME 부족 시
      //     '팔 보상형 whip' 가능성으로 Research/보조 문구 처리(attractor_map.COMPENSATION_RULES).
      //   [GPT검토 item5] seqPct(=kseq.arm=hand 기반)·그 norm 은 backward-compat 로 불변 — kseq.arm 정의를 전역에서 hand→humerus 로
      //     바꾸지 않는다. '골반→몸통→어깨' 순서는 상완(Pitching_Humerus_Ang_Vel_Z) 타이밍 기반 **별도 게이트 필드**
      //     (gateOk/gateLabel/gateG1·g2 + FC0/BR100 정규화 g1n·g2n)로만 보관(apply_score_seq_whip.js, 라이브 임시패치).
      //     계산: peak 시점 골반(Pelvis_Ang_Vel_Z)<몸통(Thorax_Ang_Vel_Z)<어깨(Humerus) · g1<-15ms=몸통 선행 점검(결함 아님).
      magM.concat(effM).forEach(function (m) {
        if (!m || !m.key) return;
        if (m.key === 'whipRatio')   { m.score = _scRk(m.value, 'whipRatio'); m.dir = 'range'; m.neutral = false; }  // [2026-06-21] 단조→적정범위: 낮은 whip=팔느림 OR 몸통빠름(방향모호)+armRotV 이중계상 → 강한 몸통 벌점 방지. 전달은 armTransferRatio가 담당.
        else if (m.key === 'seqPct' || m.key === 'chainTiming') { m.neutral = true; m.score = null; }
      });
      // 앞무릎 신전 활용/전달 유형 (회전-주도/흡수, 무릎신전-주도/생성). 둘 다 유효 엘리트 패턴 → 서술형(점수 없음)
      var kneeM = [
        M('앞무릎 활용 유형', B.driveType, '', null, '순 무릎 신전(FC→BR)≥13° = 신전-vault형(무릎 펴며 에너지 생성·들어올림), 미만 = 버팀-흡수형(앞무릎 버티며 흡수·굽은 축으로 회전). 두 유형 모두 유효 엘리트 패턴(우열 아님). ※ 동작 유형(드라이브/회전 주도)과는 별개 — 이건 앞다리 사용 전략. 전달 효율은 이 유형(ROM)이 아니라 ‘앞무릎 신전속도’가 가름(34명 검증 r≈.55) — 유형=서술 라벨', 'driveType', null),
        M('무릎 신전 에너지', r1(B.kneeExtE), 'J', null, '앞무릎 신전으로 생성한 에너지(∫P⁺·dt · FC→BR 전체 · 체중 보정 없음). 그룹 분포 내 위치(우열 아님) · 앞무릎 최대 굽힘→BR 만 본 체중당 값 = 블로킹 「앞무릎 신전 일」', 'kneeExtE', 1),
        M('무릎 신전 기여 비율', r1(B.kneeContribPct), '%', null, '무릎 생성에너지 ÷ (생성+흡수). 높을수록 신전우세·낮을수록 흡수우세 — 그룹 분포 내 위치(우열 아님)', 'kneeContribPct', 1),
        M('무릎 신전–몸통 회전 타이밍 지연', r1(B.kneeTrunkLag), 'ms', null, '무릎 신전속도 peak − 몸통 회전속도 peak. [K5-A] 적정 범위형 timing(context) — p25~p75=양호, 너무 이르거나 늦으면 범위 이탈(클수록/작을수록 우수 아님).', 'kneeTrunkLag', 1),
        M('앞무릎 관절 파워·몸통 에너지 변화율 정점 시간차', r1(B.ppKneeTrunk), 'ms', null, '앞무릎 관절 파워 정점에서 몸통 분절 에너지 변화율(dME/dt) 정점까지의 시간차(ms · 양수면 무릎이 먼저) · 분절 에너지 변화율은 그 분절 모든 경계의 합이라, 무릎에서 몸통으로 에너지가 넘어간 시점을 잰 값이 아님 · 속도 기준 순서(무릎 신전–몸통 회전 타이밍)와 다를 수 있음 · 그룹 위치로 봄(우열 아님)', 'ppKneeTrunk', 1),
        M('몸통·상완 에너지 변화율 정점 시간차', r1(B.ppTrunkHum), 'ms', scR(B.ppTrunkHum, 59, 86), '몸통 에너지 변화율이 가장 큰 시점에서 상완 에너지 변화율이 가장 큰 시점까지의 시간차(ms) · 분절 에너지 변화율은 그 분절 모든 경계의 합이라, 어깨를 건너 팔로 넘어가는 시점을 잰 값이 아님 · 59~86 ms 안을 「정상」으로 보는 기준은 엘리트 분포 범위이며 최적 타이밍의 근거는 아님 · 점수는 이 범위 안=양호(범위 점수)로 매김', 'ppTrunkHum', 1),
        (function(){ var m=M('몸통→팔 기여비율 (설명·비점수)', r1(B.armTransferRatio), '%', null, '팔(상완) 에너지 중 몸통에서 받은 비율 = (팔 총 − 팔 자체)÷팔 총. ★[2026-06-22 GPT적대검토 반영] 점수 강등(설명변수). 정의상 = 1−(팔 자체생성/팔 총)이라, 팔이 스스로 강하게 만들수록 비율이 *자동으로* 낮아지는 산술 길항(강한 팔을 \'낮은 전달\'로 벌점화 — 한 선수 등 코호트 최강 팔이 pos1 미흡으로 찍힘). 게다가 엘리트 분포가 95~100%에 포화돼 백분위 해상도 없음. 따라서 효율 우열이 아니라 \'팔 에너지 조달 방식(근위 의존 vs 자체생성)\' 설명용. 전달 타이밍=ppTrunkHum(범위점수)·부하=부상탭으로 별도 해석.', 'armTransferRatio', 1); m.neutral=true; return m; })()
      ];
      kneeM.forEach(function(m){ if(m.key==='kneeExtE'||m.key==='kneeContribPct'||m.key==='ppKneeTrunk'||m.key==='kneeTrunkLag') m.neutral=true; });  // 무릎 유형·파워/속도 타이밍 계열: 그룹 위치만(참고). [2026-06-02] 앞무릎 점수=6개(무너짐·전달·신전·버팀모멘트·흡수·골반회전)로 정리 → kneeTrunkLag 참고로. ppTrunkHum은 몸통 전달(범위점수).
      transfer = {
        key: 'transfer', label: '6. 몸통 (전달)', sub: '운동사슬 에너지 흐름 — 분절 핸드오프·키네매틱 시퀀스 + 앞무릎 신전 활용 유형',
        metrics: magM.concat(effM).concat(kneeM)
      };
    } else if (trial && trial.kseq && trial.kseq.deltas) {
      // GRF 없는 동작 데이터(Uplift): 분절 운동에너지(KE)·키네매틱 시퀀스는 GRF 없이 산출 가능 →
      // 전달 단계를 비워두지 않고 렌더(엔진이 시퀀스 스코어카드 + 키네틱 체인 KE 흐름을 그림). 관절 파워·앞무릎 유형(역동역학/GRF 필요)은 생략.
      transfer = {
        key: 'transfer', label: '6. 몸통 (전달)', sub: '운동사슬 에너지 흐름 — 분절 운동에너지(KE)·키네매틱 시퀀스 (동작 기반 · GRF 없음)',
        metrics: [], kinematicOnly: true
      };
    }

    // ── 6. 동작 일관성 (12구 변동성, 낮을수록 일관) ──
    var consistency = null;
    var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    var pstd = function (a) { if (a.length < 2) return null; var m = mean(a); return Math.sqrt(a.reduce(function (s2, x) { return s2 + (x - m) * (x - m); }, 0) / a.length); };
    var clampS = function (v) { return v == null ? null : Math.max(20, Math.min(100, Math.round(v))); };
    var grfDelays = [], seqSpans = [], rel = [], tim = [], armS = [], strd = [];
    var hk = RHP ? 'r_hand_tip' : 'l_hand_tip';
    (allTrials || []).forEach(function (t) {
      var ts = t.series || {}, te = t.events || {}, tdt = (t.setup && t.setup.dt) || ((t.meta && t.meta.dt) || 0.00333), tfr = t.frames || [];
      var ifc2 = te.i_fc, ibr2 = te.i_br;
      var i1 = peak(ts.FP1_Z, te.i_kl_peak || 0, te.i_br, false).i, i2 = peak(ts.FP2_Z, te.i_kl_peak || 0, te.i_br, false).i;
      if (i1 != null && i2 != null) grfDelays.push((i2 - i1) * tdt * 1000);
      var kd = (t.kseq && t.kseq.deltas) || {};
      if (kd.pelvis_to_trunk_ms != null && kd.trunk_to_arm_ms != null) seqSpans.push(kd.pelvis_to_trunk_ms + kd.trunk_to_arm_ms);
      if (ifc2 == null || ibr2 == null) return;
      if (ibr2 < tfr.length && tfr[ibr2] && tfr[ibr2][hk]) rel.push(tfr[ibr2][hk]);
      tim.push((ibr2 - ifc2) * tdt * 1000);
      var sa = ts.Pitching_Shoulder_Angle_Y || []; if (ifc2 < sa.length && isFinite(sa[ifc2])) armS.push(sa[ifc2]);
      var scop2 = (t.grf_metrics && t.grf_metrics.stride_cop_m); if (scop2 != null && isFinite(scop2)) { strd.push(scop2 / ht * 100); } else { var sl = (ts.STRIDE_LENGTH_X || []).filter(isFinite); if (sl.length) strd.push(Math.abs(sl.reduce(function (a, b) { return Math.abs(b) > Math.abs(a) ? b : a; })) / ht * 100); }
    });
    var grfSd = pstd(grfDelays), seqSd = pstd(seqSpans);
    var relSd = rel.length > 1 ? Math.sqrt(Math.pow(pstd(rel.map(function (p) { return p[0]; })) || 0, 2) + Math.pow(pstd(rel.map(function (p) { return p[1]; })) || 0, 2) + Math.pow(pstd(rel.map(function (p) { return p[2]; })) || 0, 2)) : null;
    var timCv = (tim.length > 1 && mean(tim)) ? pstd(tim) / mean(tim) * 100 : null;
    var armSd = armS.length > 1 ? pstd(armS) : null;
    var strCv = (strd.length > 1 && mean(strd)) ? pstd(strd) / Math.abs(mean(strd)) * 100 : null;
    consistency = {
      key: 'consistency', label: '동작 일관성 (보조·5단계 외)', sub: '12구 반복 일관성 (낮은 변동 = 높은 일관성) — 제구의 동작적 기반. 빠름/느림은 그 투구의 원시 수치만 비교',
      metrics: [
        M('릴리즈 포인트 일관성', relSd != null ? r1(relSd) : null, 'mm SD', clampS(relSd == null ? null : 100 - relSd * 0.55), '릴리스 위치 3D 표준편차', 'releaseSdMm', -1),
        M('릴리즈 타이밍 일관성', timCv != null ? r1(timCv) : null, '% CV', clampS(timCv == null ? null : 100 - timCv * 4), 'FC→릴리스 시간 변동계수', 'relTimingCvPct', -1),
        M('암슬롯 일관성', armSd != null ? r1(armSd) : null, '° SD', clampS(armSd == null ? null : 100 - armSd * 8), '착지 시 어깨 외전(암슬롯) 표준편차', 'armSlotSdDeg', -1),
        M('스트라이드 일관성', strCv != null ? r1(strCv) : null, '% CV', clampS(strCv == null ? null : 100 - strCv * 8), '스트라이드 길이 변동계수. ★[2026-06-02] 키를 strideLenCV로 분리 — 드라이브 "스트라이드 길이(보폭, strideLen)"와 충돌 방지(detail6 dedup).', 'strideLenCV', -1),
        M('체중이동 시간 일관성', grfSd != null ? r1(grfSd) : null, 'ms SD', clampS(grfSd == null ? null : 100 - grfSd * 1.2), '양발 수직GRF peak 간격(드라이브 타이밍) 표준편차', 'grfDelay', -1),
        M('키네매틱 시퀀스 타이밍 일관성', seqSd != null ? r1(seqSd) : null, 'ms SD', clampS(seqSd == null ? null : 100 - seqSd * 2.5), '골반→몸통→팔 peak 지연 합 표준편차', 'seqSpan', -1)
      ]
    };

    if (UPLIFT && trial.uplift_extra) {  // Uplift 전용 보조 키네매틱 변인 (값만·점수無)
      var _UX = trial.uplift_extra;
      // [2026-06-10] leadKneeVelPk = 위 leadKneeExtVel(무릎 각도 직접 미분·Theia 동일 로직)로 산출. 벤더 제공 속도값(_UX.leadKneeExtVel) 덮어쓰기 폐기 — 노이즈 컸음(교수 지시: Theia 방식으로 직접 계산).
      // [2026-05-26] 릴리스에서 IMU/마커리스 추정 변인 모두 삭제(교수 지시): 몸통 회전/굴곡 에너지·어깨 회전 파워(추정)·팔꿈치 신전 파워.
      //   릴리스는 직접 운동학(골반·몸통·팔 회전속도, 몸통굴곡속도, 팔꿈치신전속도, 분절 KE)만 유지. 부상성 토크/관절력은 '부상 잠재' 탭으로 이미 이동.
    }
    // [2026-05-26] ⑧ 좌우 밸런스 — 글러브팔 액션(A)·양팔 대칭(B)·다리 밸런스(C)·전두면(D)·비대칭지수(E). frames(양팔·머리·양다리·골반) 기반, GRF 무관.
    function _balOf(t){
      var fr=t.frames, ev2=t.events||{}, ifcB=ev2.i_fc, ibrB=(ev2.i_br!=null?ev2.i_br:ifcB), tdt=(t.setup&&t.setup.dt)||(t.meta&&t.meta.dt)||0.004, f=fr&&fr[ifcB];
      if(!f) return null;
      var TH=((t.throw_side||'').charAt(0).toLowerCase()==='l')?'l':(((t.throw_side||'').charAt(0).toLowerCase()==='r')?'r':(RHP?'r':'l')), GL=(TH==='r')?'l':'r';
      function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
      function nm2(a){return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);}
      function ang(u,w){var d=(u[0]*w[0]+u[1]*w[1]+u[2]*w[2])/(nm2(u)*nm2(w)||1);return Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;}
      function asym(a,b){return (a!=null&&b!=null&&(Math.abs(a)+Math.abs(b))>1e-6)?((a-b)/(Math.abs(a)+Math.abs(b))*100):null;}
      var gS=f[GL+'_shoulder'],gE=f[GL+'_elbow'],gW=f[GL+'_wrist'],tS=f[TH+'_shoulder'],tE=f[TH+'_elbow'],tW=f[TH+'_wrist'],pel=f.pelvis_o,nk=f.neck,lh=f.l_hip,rh=f.r_hip;
      // 다리: glove측=lead(앞다리), throw측=back(뒷다리) — 일반적 우투 좌측리드. 위치로 무릎 굴곡각.
      var leadHip=f[GL+'_hip'],leadKnee=f[GL+'_knee'],leadHeel=f[GL+'_heel'],backHip=f[TH+'_hip'],backKnee=f[TH+'_knee'],backHeel=f[TH+'_heel'];
      if(!gS||!gE||!tS||!tE||!gS.length) return null;
      var down=[0,-1,0];
      var gAbd=ang(sub(gE,gS),down), tAbd=ang(sub(tE,tS),down);
      var gElbFlex=gW?(180-ang(sub(gS,gE),sub(gW,gE))):null, tElbFlex=tW?(180-ang(sub(tS,tE),sub(tW,tE))):null;
      var shL=sub(gS,tS);
      var leadKneeFlex=(leadHip&&leadKnee&&leadHeel)?(180-ang(sub(leadHip,leadKnee),sub(leadHeel,leadKnee))):null;
      var backKneeFlex=(backHip&&backKnee&&backHeel)?(180-ang(sub(backHip,backKnee),sub(backHeel,backKnee))):null;
      // A: 글러브 당김 속도 = 글러브 상완 수평면(ML-AP) 각의 FC→BR peak 각속도(°/s)
      var pullV=null;{ var prev=null,best=0; for(var i=Math.max(1,ifcB);i<=ibrB&&i<fr.length;i++){ var ff=fr[i]; if(!ff)continue; var s=ff[GL+'_shoulder'],e=ff[GL+'_elbow']; if(!s||!e)continue; var u=sub(e,s); var th=Math.atan2(u[2],u[0])*180/Math.PI; if(prev!=null){ var d=Math.abs(th-prev); if(d>180)d=360-d; var w=d/tdt; if(w>best)best=w; } prev=th; } pullV=best||null; }
      return { gElbFlex:gElbFlex, gAbd:gAbd, abdSym:(gAbd!=null?tAbd-gAbd:null), shTilt:Math.atan2(shL[1],Math.hypot(shL[0],shL[2]))*180/Math.PI,
        counterAP:gS[2]-tS[2], gHandH:gW?gW[1]-gS[1]:null,
        trunkLat:(nk&&pel)?Math.atan2(sub(nk,pel)[0],sub(nk,pel)[1])*180/Math.PI:null,
        pelObliq:(lh&&rh)?Math.atan2(sub(lh,rh)[1],Math.hypot(sub(lh,rh)[0],sub(lh,rh)[2]))*180/Math.PI:null,
        glovePullV:pullV, leadKneeFlex:leadKneeFlex, backKneeFlex:backKneeFlex,
        kneeFlexSym:asym(leadKneeFlex,backKneeFlex), elbowFlexAsym:asym(tElbFlex,gElbFlex), shAbdAsym:asym(tAbd,gAbd),
        asymIndex:(function(){ var a=[asym(leadKneeFlex,backKneeFlex),asym(tElbFlex,gElbFlex),asym(tAbd,gAbd)].filter(function(x){return x!=null&&isFinite(x);}); return a.length?Math.round(a.reduce(function(s,v){return s+Math.abs(v);},0)/a.length*10)/10:null; })() };   /* [2026-06-20] 좌우 비대칭 종합(양팔 어깨·팔꿈치·양다리 무릎 대칭편차 평균) — 밸런스 카드용 */
    }
    var balanceStage = (function(){
      var b0=_balOf(trial); if(!b0) return null;
      var allB=_scoreTrials.map(_balOf);
      function av(k){ return allB.map(function(b){ return b?b[k]:null; }); }
      function mk(label,key,unit,dir,note){ return M(label, r1(b0[key]), unit, null, note, key, dir); }
      // [2026-05-26] 좌우 밸런스: 선수에게 명쾌하게 설명 가능한 양팔 대칭 핵심 3종만 유지(교수 지시).
      //  각 그래프에 글러브팔+투구팔을 함께(오버레이) 그려 좌우 균형을 직접 비교 — 렌더는 report.engine.js.
      //  삭제: 글러브 손 높이·글러브 당김 속도·양 어깨 외전 대칭(파생)·카운터 로테이션.
      var defs=[
        ['어깨 외전 (양팔, FC)','gAbd','°',1,'양팔 상완의 외전(벌림)각 — 글러브팔 vs 투구팔을 함께 봄. 비슷한 높이로 벌어지면(T자) 좌우 균형이 좋음'],
        ['팔꿈치 굴곡 (양팔, FC)','gElbFlex','°',null,'양 팔꿈치 굽힘각 — 글러브팔 vs 투구팔. 대칭이면 양팔이 함께 일하며 균형을 잡음'],
        ['어깨 라인 기울기 (FC)','shTilt','°',null,'양 어깨 연결선의 좌우 기울기(+글러브 어깨 높음). 0에 가까울수록 수평 — 머리·시선 안정'],
        ['다리 밸런스 (앞뒤 무릎 대칭)','kneeFlexSym','°',-1,'앞다리·뒷다리 무릎 굽힘각의 좌우 차이 — 작을수록 양다리가 대칭적으로 균형을 잡음'],
        ['비대칭 지수 (좌우 종합)','asymIndex','°',-1,'양팔(어깨·팔꿈치)·양다리 대칭 편차의 종합 — 작을수록 좌우 균형이 고름']
      ];
      var mets=defs.map(function(d){ var m=mk(d[0],d[1],d[2],d[3],d[4]); m.allV=av(d[1]); return m; });
      return { key:'balance', label:'좌우 밸런스 (보조·5단계 외)', sub:'글러브팔 액션·양팔 대칭·다리 밸런스·전두면·비대칭지수 — FC 기준(양팔·머리·양다리 위치, GRF 무관)', metrics:mets };
    })();

    var stages = [windup, drive, blocking, storage, release];
    if (transfer) stages.push(transfer);
    if (consistency) stages.push(consistency);
    if (balanceStage) stages.push(balanceStage);
    if (injuryLoad) stages.push(injuryLoad);   // [2026-05-26] 부상 잠재 부하(추정) — 부상 탭에서 렌더
    // [2026-06-22 변인개혁 Phase4] styleNeutral — 회전우세형만 trunkFlexV·trunkLatV '미흡' 점수중립(전역 아님).
    //   근거: 코치(한 선수=수직축 회전형→굴곡 느림은 스타일). [2026-07-03] 구속상관 근거(굴곡 r.17·측굴.09) 삭제 — 메카닉≠구속 원칙 + 같은 파일 :608 trunkLatV 구속 r=.51과 자기모순. 유형중립은 코치앵커/유형근거로만 성립. 전역중립화=발달선수 폭락→타겟.
    //   보수 다축(GPT v5): 회전강(z≥.25)+몸통ME 심하게 낮지않음(z≥-.3)+굴곡뚜렷낮음(z≤-.5)+체인지지2+안전(측굴 과도아님·팔단독 보상아님).
    (function(){
      function _z(k,v){ var n=NB[k]; if(!n||v==null) return null; var iqr=Math.abs(n.p75-n.p25)/1.349; return iqr?(v-n.med)/iqr:null; }
      var zRot=_z('torsoRotV',B.torsoRotV), zTME=_z('trunkME',B.trunkME), zFlex=_z('trunkFlexV',B.trunkFlexV), zLat=_z('trunkLatV',B.trunkLatV), zArm=_z('armRotV',B.armRotV);
      // [2026-06-22 GPT적대검토 반영 2a] chain 지지 = evidence family 단위(변수 아님). humME+armTransferRatio는 동일 Humerus_ME family라 중복카운트 금지 → 서로 다른 family ≥2.
      var _famEF = ((NB.humME&&B.humME!=null&&B.humME>=NB.humME.p25)||(NB.armTransferRatio&&B.armTransferRatio!=null&&B.armTransferRatio>=NB.armTransferRatio.p25))?1:0;  // energy-flow
      var _famBR = (NB.comVelReductionFCBR&&B.comVelReductionFCBR!=null&&B.comVelReductionFCBR>=NB.comVelReductionFCBR.p25)?1:0;  // bracing
      var _famKIN = (NB.pelvisRotV&&B.pelvisRotV!=null&&B.pelvisRotV>=NB.pelvisRotV.p25)?1:0;  // angular-kinematic
      var chain = _famEF + _famBR + _famKIN;
      // [2026-06-22 GPT적대검토 반영 2b] 안전 veto: 팔꿈치/어깨 부하가 명백한 outlier(z≥2.0=red flag)면 전략 면제 불가(고부하 보상형 미화 방지·asset≠risk).
      //   ★threshold=2.0(≈p98): z≥1.0은 과도해 코치검증 레퍼런스(선수 A zElb1.06·선수 B zSho1.35=회전-부하 coupling 비용)까지 부당탈락 → 명백한 고부하(선수 C z3.25~4.04)만 차단. (교수 튜닝 가능)
      var zElb=_z('elbowMoment',B.elbowMoment), zSho=_z('shoulderMoment',B.shoulderMoment);
      var _safetyOk = !((zElb!=null&&zElb>=2.0)||(zSho!=null&&zSho>=2.0));
      var rotDom = (zRot!=null&&zRot>=0.25) && (zTME!=null&&zTME>=-0.3) && (zFlex!=null&&zFlex<=-0.5) && chain>=2 && _safetyOk
                   && !(zLat!=null&&zLat>=1.0)
                   && !(zArm!=null&&zArm>=1.0&&zTME!=null&&zTME<0.25);
      if(rotDom){
        stages.forEach(function(st){ if(st&&st.metrics) st.metrics.forEach(function(m){ if(m&&(m.key==='trunkFlexV'||m.key==='trunkLatV')&&m.score!=null){ var lo=(NB[m.key]?NB[m.key].p25:null); if(lo!=null&&m.value!=null&&m.value<lo){ m.neutral=true; m.score=null; m.typeNeutral=true; m.note=(m.note?m.note+' · ':'')+'회전우세형 — 굴곡/측굴 낮음은 스타일(유형중립·원인추적)'; } } }); });
      }
    })();

    // [2026-05-26] Uplift(동작 전용)=지면반력 없음 → GRF·역동역학으로만 산출되는 변인은 값이 null.
    // 빈 변인을 '—'로 남기지 말고 단계에서 완전히 제거(교수 지시: "지면반력 있어야만 산출 가능한 변인 모두 삭제").
    // (freeMo·rearProp·propImpPct·grfDelay·driveWork·leadGrf·apBrake·kneeAbs·kneeAbsE·kneeExtE·kneeContribPct·shGen·elbAbs 등 + 채널부재 빈 변인)
    if (UPLIFT) {
      stages.forEach(function (st) { if (st && st.metrics) st.metrics = st.metrics.filter(function (m) { return m && m.value != null; }); });
    }

    // ── 빠름/느린 투구 비교 부착 ──
    function rnd(x) { return x == null ? null : Math.round(x * 10) / 10; }
    stages.forEach(function (st) {
      var isConsist = st.key === 'consistency';
      st.metrics.forEach(function (m) {
        if (!m.key || !FS || !SS) return;
        var f = FS[m.key], s = SS[m.key];
        if (f == null || s == null) return;
        m.fastV = rnd(f); m.slowV = rnd(s); m.cmpDelta = rnd(f - s);
        if (isConsist) { m.cmpRaw = true; return; }   // 일관성: 색 없이 수치만
        // 데드밴드: 두 값 중 큰 쪽의 5% 미만 차이는 노이즈로 보고 중립(회색)
        var denom = Math.max(Math.abs(f), Math.abs(s), 1e-6);
        if (Math.abs(f - s) < 0.05 * denom) { m.cmpNeutral = true; return; }
        var gd = (m.dir === 'abs') ? (Math.abs(f) - Math.abs(s)) : ((m.dir === -1 ? -1 : 1) * (f - s));
        m.cmpBad = gd < 0;
        m.cmpGood = gd > 0;
      });
    });

    stages.forEach(function (st) {
      if (st.score != null) return;
      var ss = st.metrics.filter(function (m) { return m.score != null; });
      st.score = ss.length ? Math.round(ss.reduce(function (a, m) { return a + m.score; }, 0) / ss.length) : null;
    });
        var _allSc = _scoreTrials.map(function(t){return scalars(t);});
    stages.forEach(function(st){ st.metrics.forEach(function(m){ if(m.key && !m.allV){ m.allV = _allSc.map(function(s){ return s[m.key]; }); } }); });
    // [2026-06-03] 스칼라 키 → 전 trial 유효값 배열(표시 스칼라와 동일 정의). 단계 기초통계·기준 산출 공용.
    function _scArr(key){ return (_allSc||[]).map(function(s){ return s && s[key]; }).filter(function(x){ return typeof x==='number' && isFinite(x); }); }
    // ── 투구 유형(딜리버리): 비오버핸드(사이드암 SH / 언더핸드 UH)는 자세·암슬롯 기준이 오버핸드 그룹와 달라 비교 제외 ──
    var _dlv = String((meta && meta.delivery) || '').toUpperCase();
    var _slot = _dlv.indexOf('_') >= 0 ? _dlv.split('_').pop() : _dlv;
    var _nonOH = (_slot === 'SH' || _slot === 'UH');
    if (_nonOH) {
      var _SENS = { pelClose:1, openAng:1, leanBack:1, trunkFlexV:1, merPk:1, scapLoad:1, xfPeak:1, xfPeakFromFC:1, xfUnwindV:1, xfReleasedPctByFC:1, xfAtFC:1, armSlot:1 };  // 유형 민감(자세·몸통·암슬롯·분리/풀림) — armSlotSdDeg는 동일 투수 내 반복성이라 유지
      stages.forEach(function (st) { st.metrics.forEach(function (m) { if (m.key && _SENS[m.key]) { m.normNA = true; m.note = (m.note ? m.note + ' · ' : '') + '유형상 기준 비교 제외(' + (_slot === 'UH' ? '언더핸드' : '사이드암') + ')'; } }); });
    }
    // ── 단계별 기초 통계 (다중 트라이얼 평균 ± SD, CV) — 동작 시작(i_start) 기반 시간 변인 포함 ──
    var stageStats = (function () {
      var lkk = RHP ? 'L_KNEE_Z' : 'R_KNEE_Z';        // 리드(드는) 다리 무릎 수직
      var leadB = RHP ? 'L_KNEE' : 'R_KNEE', rearH = RHP ? 'R_HEEL' : 'L_HEEL';  // 리드무릎 / 뒷발 뒤꿈치
      function pkAbs(a, lo, hi) { if (!a || !a.length) return null; lo = Math.max(0, lo | 0); hi = Math.min(a.length - 1, hi == null ? a.length - 1 : (hi | 0)); var b = null; for (var i = lo; i <= hi; i++) { var v = a[i]; if (isFinite(v) && (b == null || Math.abs(v) > Math.abs(b))) b = v; } return b == null ? null : Math.abs(b); }
      // 시간은 초(s) 단위. 와인드업: 소요시간·PI→FC중 KH비중·무릎 최대높이(cm·키%)·니하이 무릎 전후(홈+)·좌우 위치(뒤꿈치 기준).
      var wuDur = [], wuPct = [], wuHcm = [], wuHpct = [], wuAP = [], wuML = [], stLen = [], stDir = [], stTime = [], blkTime = [], blkGrf = [], knFlex = [], knROM = [], trRotV = [], trXf = [], armMER = [], armRel = [];
      // 회전 에너지 저장(preload) 변인 — 골반/몸통 닫힘·HSS·축발 coil·와인드업 회전속도·상지 준비. [2026-06-03 개발지침서]
      var wuPelClKH = [], wuPelCoil = [], wuTrkClKH = [], wuTrkCoil = [], wuHSS = [], wuHSSb = [], wuDhER = [], wuCoilTq = [], wuPelV = [], wuTrkV = [], wuShER = [];
      var _wt = (meta && meta.weight_kg) || 86;
      _scoreTrials.forEach(function (t) {
        var ts = t.series || {}, te = t.events || {}, tdt = (t.setup && t.setup.dt) || ((t.meta && t.meta.dt) || 0.00333);
        var is = te.i_start, ik = te.i_kl_peak, ifc = te.i_fc, ibr = te.i_br;
        if (is != null && ik != null && ifc != null && ifc > is) {
          wuDur.push((ik - is) * tdt);                 // PI→KH (s)
          wuPct.push((ik - is) / (ifc - is) * 100);    // PI→FC 중 KH까지 %
          var lz = ts[lkk]; if (lz && isFinite(lz[ik])) { wuHcm.push(lz[ik] * 100); wuHpct.push(lz[ik] / ht * 100); }
          var ky = ts[leadB + '_Y'], kx = ts[leadB + '_X'], hy = ts[rearH + '_Y'], hx = ts[rearH + '_X'];
          if (ky && hy && isFinite(ky[ik]) && isFinite(hy[ik])) wuAP.push((ky[ik] - hy[ik]) * 100);   // +홈 방향
          if (kx && hx && isFinite(kx[ik]) && isFinite(hx[ik])) wuML.push((kx[ik] - hx[ik]) * 100);   // 좌우(부호=좌표축)
          // ── 회전 저장(preload) · v2: 닫힘각@KH(절대) vs 코일 변화량(PI→KH) 분리, 토크 방향정규화/체중 ──
          var pz = ts.Pelvis_Angle_Z, tz = ts.Trunk_Angle_Z, xf = t.x_factor, bhz = ts.Back_Hip_Angle_Z, sez = ts.Pitching_Shoulder_Angle_Z;
          if (pz && isFinite(pz[ik])) wuPelClKH.push(Math.abs(pz[ik]));
          if (pz && isFinite(pz[is]) && isFinite(pz[ik])) wuPelCoil.push(Math.abs(pz[ik] - pz[is]));
          if (tz && isFinite(tz[ik])) wuTrkClKH.push(Math.abs(tz[ik]));
          if (tz && isFinite(tz[is]) && isFinite(tz[ik])) wuTrkCoil.push(Math.abs(tz[ik] - tz[is]));
          if (xf && isFinite(xf[ik])) wuHSS.push(Math.abs(xf[ik]));
          if (xf && isFinite(xf[ik]) && isFinite(xf[is])) wuHSSb.push(Math.abs(xf[ik]) - Math.abs(xf[is]));
          if (bhz && isFinite(bhz[ik])) wuDhER.push(Math.abs(bhz[ik]));
          var fa = ts.FP1_Z_3; if (fa) { var cb = 0; for (var ci = Math.max(0, is | 0); ci <= (ik | 0) && ci < fa.length; ci++) { var cv = RHP ? -fa[ci] : fa[ci]; if (isFinite(cv) && cv > cb) cb = cv; } wuCoilTq.push(cb / _wt); }
          var pv = pkAbs(ts.Pelvis_Ang_Vel_Z, is, ik); if (pv != null) wuPelV.push(pv);
          var tvw = pkAbs(ts.Thorax_Ang_Vel_Z, is, ik); if (tvw != null) wuTrkV.push(tvw);
          if (sez && isFinite(sez[ik])) wuShER.push(Math.abs(sez[ik]));
        }
        var gm = t.grf_metrics || {};
        if (gm.stride_cop_m != null && isFinite(gm.stride_cop_m)) stLen.push(gm.stride_cop_m / ht * 100);
        if (gm.stride_angle_deg != null && isFinite(gm.stride_angle_deg)) stDir.push(gm.stride_angle_deg);
        if (ik != null && ifc != null) stTime.push((ifc - ik) * tdt);
        var imer = (te.i_mer != null ? te.i_mer : te.i_mer_erpeak);
        if (ifc != null && imer != null && imer > ifc) blkTime.push((imer - ifc) * tdt);   // 블로킹·전환 = FC→MER(코킹/가속 구간)
        if (ifc != null && ibr != null) armRel.push((ibr - ifc) * tdt);
        var gp = pkAbs(ts.FP2_Z, ifc, ibr); if (gp != null) blkGrf.push(gp / bw * 100);
        var lka = ts.Lead_Knee_Angle_X; if (lka) { if (ifc != null && isFinite(lka[ifc])) knFlex.push(lka[ifc]); if (ifc != null && ibr != null && isFinite(lka[ifc]) && isFinite(lka[ibr])) knROM.push(lka[ifc] - lka[ibr]); }
        var tv = pkAbs(ts.Thorax_Ang_Vel_Z, ik, ibr); if (tv != null) trRotV.push(tv);
        var xf = t.x_factor; if (xf) { var xp = pkAbs(xf, ik, ibr); if (xp != null) trXf.push(xp); }
        var ep = pkAbs(ts.Pitching_Shoulder_Angle_Z, ifc, ibr); if (ep != null) armMER.push(ep);
      });
      // [2026-06-10 교수 승인 · display-only] 표시 기초통계 robust 필터 — 선수 내 MAD 기준 |z|>3.5 trial을
      //   '표시 평균/SD/CV에서만' 제외(점수·이벤트 검출·metric 값·valid_for_score 무변). 현재 wuPelCoil에만 적용.
      function madFilterDisp(a, z) {
        if (!a || a.length < 4) return { arr: a, nExcl: 0 };  // 표본 적으면 미적용(과잉 제외 방지)
        var s = a.slice().sort(function (x, y) { return x - y; });
        var med = s[Math.floor(s.length / 2)];
        var dev = a.map(function (v) { return Math.abs(v - med); }).sort(function (x, y) { return x - y; });
        var mad = dev[Math.floor(dev.length / 2)];
        if (!mad || !isFinite(mad)) return { arr: a, nExcl: 0 };
        var keep = a.filter(function (v) { return Math.abs(v - med) / (1.4826 * mad) <= (z || 3.5); });
        return keep.length ? { arr: keep, nExcl: a.length - keep.length } : { arr: a, nExcl: 0 };
      }
      function ms(a, u, lab, signed, key) { if (!a || !a.length) return null; var mn = mean(a), sd = a.length > 1 ? pstd(a) : null;
        var rng = (a.length > 1) ? (Math.max.apply(null, a) - Math.min.apply(null, a)) : null;
        // [2026-06-03 handoff §4 P1] 평균이 0 근처(|평균| ≤ SD = CV>100%)인 각도/차이 변인은 CV가 왜곡 → cv=null, 반복성은 SD/range 로. (단위 무관 상대 기준)
        var cv = (sd != null && mn != null && Math.abs(mn) > sd) ? Math.abs(sd / Math.abs(mn) * 100) : null;
        return { mean: mn, sd: sd, cv: cv, range: rng, n: a.length, unit: u, label: lab, key: key || null }; }   // CV=SD/|평균|, 단 |평균|≤SD면 null(왜곡 방지)·range 병기
      return {
        windup: {
          linear: [ms(wuDur, 's', '와인드업 걸린 시간 (다리 들기~무릎 최고점)', 0, 'wuDur'), ms(wuPct, '%', '와인드업 비중 (전체 투구 중)', 0, 'wuPct'),
            ms(wuHcm, 'cm', '무릎 최대 높이', 0, 'wuHcm'), ms(wuHpct, '%', '무릎 최대 높이 (키 대비)', 0, 'wuHpct'),
            ms(wuAP, 'cm', '무릎 최고점 때 무릎 앞뒤 위치', 1, 'wuKneeAP'), ms(wuML, 'cm', '무릎 최고점 때 무릎 좌우 위치', 1, 'wuKneeML'),
            ms((_allSc || []).map(function (s) { return s && s.hipHinge; }).filter(function (x) { return typeof x === 'number' && isFinite(x); }), '°', '힙 힌지 형성 (뒷고관절 굽힘)', 0, 'hipHinge')],   // [2026-06-03] 힙힌지=선운동 저장 핵심 자세 → 개요 표에도 표시(교수 지적)
          rot: [ms(wuPelClKH, '°', '골반 닫힘각 (무릎 최고점)', 0, 'wuPelCloseKH'),
            (function () { var f = madFilterDisp(wuPelCoil, 3.5); var m = ms(f.arr, '°', '골반 감긴 양 (다리 들기~무릎 최고점)', 0, 'wuPelCoil'); if (m && f.nExcl) m.nExcl = f.nExcl; return m; })(),
            ms(wuTrkClKH, '°', '몸통 닫힘각 (무릎 최고점)', 0, 'wuTrunkCloseKH'), ms(wuTrkCoil, '°', '몸통 감긴 양 (다리 들기~무릎 최고점)', 0, 'wuTrunkCoil'),
            ms(wuHSS, '°', '골반-어깨 비틀림 (무릎 최고점)', 1, 'wuHSS'), ms(wuHSSb, '°', '비틀림 쌓인 양 (다리 들기~무릎 최고점)', 1, 'wuHSSbuild'),
            ms(wuDhER, '°', '축발 고관절 바깥 돌림 (무릎 최고점)', 1, 'wuDriveHipER'), ms(wuCoilTq, 'N·m/kg', '축발 비트는 힘 (체중 대비)', 0, 'wuCoilTq'),
            ms(wuPelV, '°/s', '골반 회전 속도 (와인드업)', 1, 'wuPelVel'), ms(wuTrkV, '°/s', '몸통 회전 속도 (와인드업)', 1, 'wuTrkVel'),
            ms(wuShER, '°', 'KH 어깨 Z각 (보조 — 조기장전 위험은 별도 배지)', 1, 'wuShER')],
          // [2026-06-03 개발지침서] KH 팔 조기 장전 위험 변인(손분리·팔 뒤쪽 위치) — 기준 산출·기초통계용
          earlyarm: [ms(_scArr('handPostKH'), '%키', 'KH 던지는 손 뒤쪽 위치', 1, 'handPostKH'), ms(_scArr('elbowPostKH'), '%키', 'KH 팔꿈치 뒤쪽 위치', 1, 'elbowPostKH'),
            ms(_scArr('horizAbdKH'), '°', 'KH 어깨 수평외전', 1, 'horizAbdKH'), ms(_scArr('handSepKHms'), 'ms', '손분리 시점 (KH 기준)', 1, 'handSepKHms')]
        },
        stride: [
          // 전진 생성
          ms(_scArr('strideLen'), '%', '스트라이드 길이 (키%)', 0, 'strideLen'), ms(stTime, 's', '스트라이드 시간 (KH→FC)', 0, 'strideTime'),
          ms(_scArr('rearProp'), '%BW', '뒷발 추진 최대힘', 0, 'rearProp'), ms(_scArr('propImpPct'), '%BW·s', '뒷발 추진 임펄스', 0, 'propImpPct'),
          ms(_scArr('propPeakTiming'), '%', '추진 peak 타이밍 (KH→FC 중)', 0, 'propPeakTiming'), ms(_scArr('comVelFC'), 'm/s', 'COM 전진속도 @FC', 0, 'comVelFC'),
          // 자세·COM
          ms(_scArr('comVDrop'), 'cm', 'COM 수직 낙하 (KH→FC)', 0, 'comVDrop'), ms(_scArr('trunkLeanChange'), '°', '몸통 전경 변화 (KH→FC)', 1, 'trunkLeanChange'),
          ms(_scArr('postureMaint'), '점', '자세 유지 점수', 0, 'postureMaint'), ms(_scArr('driveKneeFlexKF'), '°', '뒷무릎 굴곡 변화 (KH→FC)', 1, 'driveKneeFlexKF'),
          // 회전 준비
          ms(_scArr('pelOpenKF'), '°', '골반 열림 (KH→FC)', 0, 'pelOpenKF'), ms(_scArr('trkOpenKF'), '°', '몸통 열림 (KH→FC)', 0, 'trkOpenKF'),
          ms(_scArr('hssFC'), '°', '골반-어깨 분리 @FC', 0, 'hssFC'), ms(_scArr('hssBuildKF'), '°', '분리 빌드업 (KH→FC)', 1, 'hssBuildKF'),
          ms(_scArr('trunkResistRatio'), '비', '몸통 버팀비 (골반÷몸통 열림)', 0, 'trunkResistRatio'),
          // FC 블로킹 입력
          ms(_scArr('leadKneeFlexFC'), '°', 'FC 리드무릎 굴곡', 0, 'leadKneeFlexFC'), ms(_scArr('leadFootAngleFC'), '°', 'FC 앞발 각도', 1, 'leadFootAngleFC'),
          ms(stDir, '°', '스트라이드 방향', 1)
        ],
        blocking: [ms(blkTime, 's', '블로킹·전환 시간 (FC→MER)'), ms(blkGrf, '%BW', '앞발 수직 GRF 피크')],
        knee: [ms(knFlex, '°', 'FC 무릎 굴곡각'), ms(knROM, '°', '무릎 신전 ROM (FC→릴리스)')],
        trunk: [ms(trRotV, '°/s', '몸통 회전속도 피크'), ms(trXf, '°', 'X-factor 피크')],
        arm: [ms(armMER, '°', '최대 외회전 (MER)'), ms(armRel, 's', '릴리스 타이밍 (FC→BR)')]
      };
    })();

    // ── 와인드업 유형 분류(rule-based v1.0) + 공통 위험 신호(v1.1) [2026-06-03 유형별 평가 지침서] ──
    //   "클수록 좋음" 일률 평가 대신, PI→KH 변인 percentile로 저장 전략을 4유형 soft 분류(전체 엘리트 기준은 병기).
    //   유형: high_lift(큰 리듬)/compact(빠른 전환)/coil_dominant(회전 코일)/linear_load(축발 적재). 공통 위험신호는 유형 무관 경고.
    var _WT_NB = (typeof PITCH_NORMS !== 'undefined') ? PITCH_NORMS : null, _WT_PS = (typeof PITCH_STATS !== 'undefined') ? PITCH_STATS : null;
    function _mget(arr, key) { if (!arr) return null; for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].key === key) return arr[i]; return null; }
    function _rawPctl(key, v) { if (!_WT_NB || !_WT_PS || v == null || !_WT_NB[key]) return null; var nm = _WT_NB[key], sig = Math.abs(nm.p75 - nm.p25) / 1.349 || 1; return Math.max(1, Math.min(99, _WT_PS.cdf((v - nm.med) / sig) * 100)); }  // 방향 무관 분포 백분위
    function _avgN(a) { a = a.filter(function (x) { return x != null && isFinite(x); }); return a.length ? a.reduce(function (p, q) { return p + q; }, 0) / a.length : null; }
    var windupType = (function () {
      var lin = stageStats.windup.linear, m;
      var kneeH = (m = _mget(lin, 'wuHpct')) ? m.mean : null, piKH = (m = _mget(lin, 'wuDur')) ? m.mean : null, wuProp = (m = _mget(lin, 'wuPct')) ? m.mean : null, kneeAP = (m = _mget(lin, 'wuKneeAP')) ? m.mean : null;
      var pK = _rawPctl('wuHpct', kneeH), pT = _rawPctl('wuDur', piKH), pProp = _rawPctl('wuPct', wuProp), pAP = _rawPctl('wuKneeAP', kneeAP);
      var pPelC = _rawPctl('wuPelCoil', B.wuPelCoil), pTrkC = _rawPctl('wuTrunkCoil', B.wuTrunkCoil), pDh = _rawPctl('wuDriveHipER', B.wuDriveHipER), pTq = _rawPctl('wuCoilTq', B.wuCoilTq), pHH = _rawPctl('hipHinge', B.hipHinge);
      // [2026-06-19] compact 보정: 보수정의(100−high_lift, 무릎높이 역수)는 회전이 느린 선수도 '빠른 전환형'으로 오라벨(한 선수 회전 7p 등 4명).
      //   → 핵심맵(WIN_CORE)이 정의하는 실제 변별변인(와인드업 회전속도 wuPelVel·wuTrkVel)으로 교체 = 분류기·평가 정합 + 오라벨 해소.
      var pPV = _rawPctl('wuPelVel', B.wuPelVel), pTV = _rawPctl('wuTrkVel', B.wuTrkVel);
      var raw = { high_lift: _avgN([pK, pT, pProp]), compact: _avgN([pPV, pTV]), coil_dominant: _avgN([pPelC, pTrkC, pDh, pTq]), linear_load: _avgN([pHH, pAP]) };
      var keys = Object.keys(raw).filter(function (k) { return raw[k] != null; });
      if (keys.length < 2) return null;
      var ex = {}, sum = 0; keys.forEach(function (k) { var e = Math.exp(raw[k] / 10); ex[k] = e; sum += e; });   // softmax(τ=10) → 전략 혼합 비율(%)
      var prop = {}; keys.forEach(function (k) { prop[k] = Math.round(ex[k] / sum * 100); });
      var sorted = keys.slice().sort(function (a, b) { return raw[b] - raw[a]; });
      var primary = sorted[0], secondary = sorted[1] || null;
      var hybrid = (secondary != null && (raw[primary] - raw[secondary]) < 8);
      var rr = {}; keys.forEach(function (k) { rr[k] = Math.round(raw[k] * 10) / 10; });
      return { scores: rr, prop: prop, primary: primary, secondary: secondary, hybrid: hybrid };
    })();
    // ── [2026-06-03 개발지침서] KH 팔 조기 장전 위험 — wuShER(클수록좋음) 폐기. 손분리 조건부 + 팔 뒤쪽 위치 가중 백분위 ──
    //   위험 = 던지는 손 뒤쪽(0.40)+팔꿈치 뒤쪽(0.25)+어깨 수평외전(0.25)+어깨Z 보조(0.10)의 방향무관 백분위. 손분리가 조기일 때만 위험으로 해석.
    var earlyArm = (function () {
      var N = _WT_NB; if (!N) return null;
      var pH = _rawPctl('handPostKH', B.handPostKH), pE = _rawPctl('elbowPostKH', B.elbowPostKH), pA = _rawPctl('horizAbdKH', B.horizAbdKH), pS = _rawPctl('wuShER', B.wuShER);
      var parts = [[pH, 0.40], [pE, 0.25], [pA, 0.25], [pS, 0.10]].filter(function (x) { return x[0] != null; });
      if (!parts.length) return null;
      var wsum = parts.reduce(function (a, x) { return a + x[1]; }, 0), risk = parts.reduce(function (a, x) { return a + x[0] * x[1]; }, 0) / wsum;
      var early = (B.earlySep !== false);   // 대부분 PI 무렵 분리=정상. false=KH까지 손 붙음(조기장전 해석 의미 낮음)
      var label = !early ? 'normal' : (risk >= 78 ? 'risk' : (risk >= 62 ? 'caution' : 'normal'));
      return { risk: Math.round(risk), label: label, early: early, handSepKHms: (B.handSepKHms == null ? null : Math.round(B.handSepKHms)), handPost: r1(B.handPostKH), elbowPost: r1(B.elbowPostKH), horizAbd: r1(B.horizAbdKH), conf: (B.handSepConf !== false) };
    })();
    var windupRisk = (function () {
      var f = [], lin = stageStats.windup.linear, m;
      if (earlyArm && earlyArm.label !== 'normal') f.push({ id: 'early_arm', label: (earlyArm.label === 'risk' ? 'KH 팔 조기 장전 위험' : 'KH 팔 조기 장전 주의'), detail: '무릎 최고점에서 던지는 팔이 어깨선보다 뒤로 ' + (earlyArm.handPost == null ? '–' : earlyArm.handPost) + '%키 빠짐(팔꿈치 ' + (earlyArm.elbowPost == null ? '–' : earlyArm.elbowPost) + '%키 뒤·수평외전 ' + (earlyArm.horizAbd == null ? '–' : earlyArm.horizAbd) + '°) · 위험도 ' + earlyArm.risk + '/100 → 몸통 회전보다 팔이 먼저 준비되는 경향 · FC 이후 몸통 회전 타이밍·MER·어깨/팔꿈치 부하 함께 확인' + (earlyArm.conf ? '' : ' (손 추적 불안정·신뢰 낮음)') });
      if (B.wuHSSbuild != null && B.wuHSSbuild < -2) f.push({ id: 'early_open', label: '비틀림 일찍 풀림', detail: '상·하체 비틀림 쌓임 ' + r1(B.wuHSSbuild) + '° · 다리 들기~KH에 골반-어깨 비틀림이 오히려 줄어듦 → 저장 전에 몸이 일찍 열릴 수 있음' });
      var cD = (m = _mget(lin, 'wuDur')) ? m.cv : null, cH = (m = _mget(lin, 'wuHpct')) ? m.cv : null;
      if ((cD != null && cD > 30) || (cH != null && cH > 20)) f.push({ id: 'variability', label: '구마다 들쭉날쭉', detail: '와인드업 리듬·무릎높이가 구마다 차이 큼' + (cD != null ? ' · 소요시간 편차 ' + r1(cD) + '%' : '') + (cH != null ? ' · 무릎높이 편차 ' + r1(cH) + '%' : '') + ' → 반복성·제구 점검' });
      var storeGood = !!(_WT_NB && ((B.wuPelCoil != null && _WT_NB.wuPelCoil && B.wuPelCoil >= _WT_NB.wuPelCoil.p75) || (B.wuTrunkCoil != null && _WT_NB.wuTrunkCoil && B.wuTrunkCoil >= _WT_NB.wuTrunkCoil.p75)));
      var carryWeak = !!(_WT_NB && _WT_NB.postureMaint && B.postureMaint != null && B.postureMaint < _WT_NB.postureMaint.p25);
      if (storeGood && carryWeak) f.push({ id: 'no_carry', label: '다음 동작 연결 점검', detail: '와인드업에서 회전할 힘은 잘 모았으나 스트라이드 자세 유지(' + r1(B.postureMaint) + ')가 낮음 → 모은 힘이 다음 동작으로 이어지는지 확인 필요' });
      return f;
    })();

    // ── 스트라이드 유형 분류(rule-based v1.0) + 위험 신호 [2026-06-03 개발지침서 §9·§11] ──
    //   KH→FC 변인 percentile로 전진 전략을 5유형 soft 분류(확률형). 유형명/색=mech6.STRIDE_TYPES(SSOT).
    //   유형: long_power(긴 보폭)/compact_quick(빠른 템포)/low_drop(깊은 낙하)/rot_ready(회전 준비)/linear_drift(미끄러짐).
    var strideType = (function () {
      var pSL = _rawPctl('strideLen', B.strideLen), pImp = _rawPctl('propImpPct', B.propImpPct), pTime = _rawPctl('strideTime', B.strideTime),
          pDrop = _rawPctl('comVDrop', B.comVDrop), pPost = _rawPctl('postureMaint', B.postureMaint), pHssB = _rawPctl('hssBuildKF', B.hssBuildKF),
          pPelO = _rawPctl('pelOpenKF', B.pelOpenKF), pResist = _rawPctl('trunkResistRatio', B.trunkResistRatio), pCV = _rawPctl('comVelFC', B.comVelFC);
      var raw = {
        long_power:    _avgN([pSL, pImp]),
        compact_quick: _avgN([pSL == null ? null : 100 - pSL, pTime == null ? null : 100 - pTime]),
        low_drop:      _avgN([pDrop, pPost]),
        rot_ready:     _avgN([pHssB, pPelO, pResist]),
        linear_drift:  _avgN([pCV, pImp == null ? null : 100 - pImp])
      };
      var keys = Object.keys(raw).filter(function (k) { return raw[k] != null; });
      if (keys.length < 2) return null;
      var ex = {}, sum = 0; keys.forEach(function (k) { var e = Math.exp(raw[k] / 10); ex[k] = e; sum += e; });   // softmax(τ=10) → 전략 혼합 비율(%)
      var prop = {}; keys.forEach(function (k) { prop[k] = Math.round(ex[k] / sum * 100); });
      var sorted = keys.slice().sort(function (a, b) { return raw[b] - raw[a]; });
      var primary = sorted[0], secondary = sorted[1] || null;
      var hybrid = (secondary != null && (raw[primary] - raw[secondary]) < 8);
      var rr = {}; keys.forEach(function (k) { rr[k] = Math.round(raw[k] * 10) / 10; });
      return { scores: rr, prop: prop, primary: primary, secondary: secondary, hybrid: hybrid };
    })();
    // 스트라이드 위험 신호(유형 무관 공통 경고) — 후속 블로킹과 연결해 해석. [개발지침서 §11·TABLE 15]
    var strideRisk = (function () {
      var f = [], N = _WT_NB; if (!N) return f;
      function hi(k, v) { return (N[k] && v != null && v > N[k].p75); }
      function lo(k, v) { return (N[k] && v != null && v < N[k].p25); }
      if (hi('propImpPct', B.propImpPct) && hi('leadKneeFlexFC', B.leadKneeFlexFC))
        f.push({ id: 'push_weak_block', label: '강하게 밀지만 착지 불안정 가능', detail: '추진 임펄스 ' + r2(B.propImpPct) + '%BW·s(상위) · FC 리드무릎 굴곡 ' + r1(B.leadKneeFlexFC) + '°(과도) → 앞으로 가는 힘은 크나 착지에서 받아내는 조건이 부족할 수 있음(리드레그 착지 안정·보폭 조절 점검)' });
      if (hi('strideLen', B.strideLen) && lo('hssFC', B.hssFC))
        f.push({ id: 'long_weak_rot', label: '보폭 길지만 회전 준비 부족', detail: '스트라이드 길이 ' + r1(B.strideLen) + '%(상위) · FC 분리 ' + r1(B.hssFC) + '°(하위) → 멀리 나가지만 골반-어깨 분리가 충분치 않음(골반 선행·상체 닫힘 유지)' });
      if (hi('comVDrop', B.comVDrop) && lo('propImpPct', B.propImpPct))
        f.push({ id: 'low_weak_push', label: '낮은 자세 좋지만 추진 약함', detail: 'COM 낙하 ' + r1(B.comVDrop) + 'cm(상위) · 추진 임펄스 ' + r2(B.propImpPct) + '%BW·s(하위) → 자세는 낮으나 미는 힘 부족(축발 지면밀기·고관절 파워)' });
      if (hi('trkOpenKF', B.trkOpenKF))
        f.push({ id: 'early_trunk_open', label: '몸통 조기 열림 주의', detail: '몸통 열림 ' + r1(B.trkOpenKF) + '°(상위 초과) → 스트라이드 중 몸통이 일찍 열려 몸통-팔 전달 상한이 낮아질 수 있음' });
      return f;
    })();

    /* [2026-08-12 교수 결정·안건6] 유효 투구 0개 = 점수 STOP.
       옛 폴백(무효 시행 전체로 재점수화)은 값 산출에만 남기고(원시 그래프·측정 품질 표시 유지),
       점수는 전부 NA — 무효 투구로 만든 점수를 유효 점수처럼 내보내지 않는다.
       선수는 화면에 유지: 상태 '측정 불충분' · 이유 '유효 투구 0/N' · 재측정 안내는 소비자가 이 플래그로 표시. */
    var measurementInsufficient = null;
    if (_scoreTrialsPack.usedFallback) {
      stages.forEach(function (st) { (st.metrics || []).forEach(function (m) { if (m) m.score = null; }); });
      measurementInsufficient = { status: '측정 불충분', reason: '유효 투구 0/' + _scoreTrialsPack.nAll, advice: '점수 미산출 — 값·그래프는 참고 표시 · 재측정 권장' };
    }
    return { stages: stages, stageStats: stageStats, lowerBodyUtil: (B ? B.lowerBodyUtil : null), measurement_insufficient: measurementInsufficient, windupType: windupType, windupRisk: windupRisk, earlyArm: earlyArm, strideType: strideType, strideRisk: strideRisk, blockingType: _blkType, blockingRisk: { low_brake: _blkLowBrake, low_com_control: _blkLowCom, high_collapse: _blkHighCollapse, low_support: _blkLowSupport, penalty: _blkPenalty, warning: _blkRiskWarn }, fast_kmh: fastKmh, slow_kmh: slowKmh, delivery: _dlv || null, deliverySlot: _slot || null, deliveryNonOH: _nonOH, score_trial_policy: { n_for_score: _scoreTrialsPack.nUsed, n_trials: _scoreTrialsPack.nAll, n_excluded: _scoreTrialsPack.nExcluded, fallback_all_trials: _scoreTrialsPack.usedFallback, policy: 'GPT_v1_valid_for_score_avg_2026-06-03 · stop_when_zero_valid_2026-08-12' }, energyFlowEFI: (function () {
      var comps = [], wSum = 0;
      function bandSc(val, p25, p75, w) {
        if (val == null || !isFinite(val)) return;
        var t = Math.max(0, Math.min(1, (val - p25) / ((p75 - p25) || 1)));
        comps.push({ w: w, sc: 25 + t * 50 }); wSum += w;
      }
      bandSc(B.efEtaE, 0.44, 0.82, 0.22);
      bandSc(B.leadKneeExtVel, 180, 420, 0.18);
      bandSc(B.kneeExtROM, 4, 16, 0.12);
      bandSc(B.torsoRotV, 800, 1200, 0.15);
      bandSc(B.merPk, 155, 195, 0.18);
      bandSc(B.efDeltaTrunkME, 50, 200, 0.15);
      if (!comps.length) return null;
      var sc = 0; comps.forEach(function (c) { sc += c.w * c.sc; });
      return { score: Math.round(sc / wSum), label: '에너지 효율 지수(EFI)', provisional: true, lowConfidence: true, nPilot: 34, note: 'mech6 SSOT와 별개 · 잠정 n=34 · 데이터 확대 시 갱신 · 효율=결과지 원인 아님' };
    })() };
  }

  return { compute: compute };
});

