
// dashboard_adapter.js — web-port DATA → 코치 대시보드(coach.html/dashboard.html) m 스키마 + localStorage payload
//  목적: 빌더가 만든 web-port per-player DATA 를 대시보드 'sangdong_dashboard_v1' 포맷으로 변환해
//        coach.html(팀 현황·선수 드릴다운)을 무수정(helpers.js 비파괴 3필드 추가만)으로 재사용.
//  검증: computeDvl5/compositeScore/computeTop3 경로로 composite·5모델·top3 가 개인 리포트와 일치(99/100·104·92·102·94).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.dashboardAdapter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var r1 = function (x) { return x == null ? null : Math.round(x * 10) / 10; };
  var ri = function (x) { return x == null ? null : Math.round(x); };

  // web-port injury_risk.metrics 등급 → 'low'/'mid'/'high'
  function injuryRisk(DATA) {
    var ms = (DATA.injury_risk && DATA.injury_risk.metrics) || [];
    var worst = 'low';
    ms.forEach(function (m) {
      if (m.grade === 'danger') worst = 'high';
      else if (m.grade === 'caution' && worst !== 'high') worst = 'mid';
    });
    return worst;
  }

  // 단일 선수 web-port DATA → 대시보드 m (1 회차 셀)
  function webportToM(DATA) {
    var iv = (DATA.biomotion && DATA.biomotion.input_vector) || {};
    var ks = (DATA.session_summary && DATA.session_summary.kseq) || {};
    var bestArm = 0;
    try { bestArm = (DATA.trials[DATA.best_trial_index - 1].kseq.segments.arm || {}).peak_abs || 0; } catch (e) {}
    var m = {
      velocity: {
        measured_kmh: r1(DATA.measured_kmh),
        score: DATA.biomotion ? DATA.biomotion.composite_score : null,
        potential_kmh: (DATA.biomotion && DATA.biomotion.ceiling) ? r1(DATA.biomotion.ceiling.retest_kmh || DATA.biomotion.ceiling.max_kmh) : null,
        // [CALC-007] 이 값은 '모델 예측 구속 여력(잠재 상한)'이지 점수부족분/목표가 아님. 표시 라벨은 '잠재 여력'으로.
        predicted_kmh: (DATA.biomotion && DATA.biomotion.ceiling) ? r1(DATA.biomotion.ceiling.retest_kmh || DATA.biomotion.ceiling.max_kmh) : null,
        src: 'webport'
      },
      sequence: {
        pelvis_dps: ri(iv.pelvis_rot_velo),
        trunk_dps: ri(iv.torso_rot_velo),
        arm_dps: ri(bestArm),
        peak_shoulder_v: ri(iv.shoulder_rot_velo),
        peak_elbow_v: ri(iv.elbow_ext_velo),
        ete_pct: ks.arm_over_trunk_gain_avg != null ? Math.round(Math.min(100, ks.arm_over_trunk_gain_avg / 5 * 100)) : null,
        score: DATA.biomotion ? DATA.biomotion.composite_score : null
      },
      energy: {
        transfer: {
          speed_gain_pt: ks.trunk_over_pelvis_gain_avg,
          speed_gain_ta: ks.arm_over_trunk_gain_avg,
          pelvis_to_trunk_lag_ms: ks.pelvis_to_trunk_ms_avg,
          trunk_to_arm_lag_ms: ks.trunk_to_arm_ms_avg
        }
      },
      cog: { decel: r1(iv.cog_decel), decel_ae: r1(iv.cog_decel_ae), max_velo: r1(iv.max_cog_velo) },
      grf: { lead_force_pct: r1(iv.lead_force_pct), rear_force_pct: r1(iv.rear_force_pct) },
      faults: {
        // arm_action
        shoulder_er_max_deg: r1(iv.layback), shoulder_abd_fp_deg: r1(iv.shoulder_abd_fp),
        scap_load_fp_deg: r1(iv.scap_load_fp), elbow_flex_fp_deg: r1(iv.elbow_flex_fp),
        // posture (peak/FP X-Factor 분리)
        x_factor_deg: r1(iv.hip_shoulder_sep_peak), x_factor_peak_deg: r1(iv.hip_shoulder_sep_peak),
        x_factor_at_fp_deg: r1(iv.hip_shoulder_sep_fp),
        torso_counter_rot_deg: r1(iv.torso_counter_rot), trunk_tilt_at_fc_deg: r1(iv.torso_fwd_tilt_fp),
        torso_rot_fp_deg: r1(iv.torso_rot_fp), torso_rot_br_deg: r1(iv.torso_rot_br),
        trunk_lat_tilt_deg: r1(iv.torso_side_bend_mer),
        // block / cog (GRF + stride cm 직접)
        lead_force_pct: r1(iv.lead_force_pct), rear_force_pct: r1(iv.rear_force_pct),
        lead_knee_change: r1(iv.lead_knee_ext), lead_knee_ext_velo: r1(iv.lead_knee_ext_velo),
        stride_length_cm: r1(iv.stride_length), stride_length_m: r1(iv.stride_length / 100),
        injury_risk: injuryRisk(DATA)
      }
    };
    return m;
  }

  // meta.json → PLAYERS 항목 (id 우선순위: meta.code → meta.id → fallback)
  function playerEntry(meta, fallbackId) {
    meta = meta || {};
    var arm = (meta.handedness || 'R').toUpperCase().charAt(0) === 'L' ? 'L' : 'R';
    return {
      id: String(meta.code || meta.id || meta.pid || fallbackId),
      name: meta.name || fallbackId,
      arm: arm,
      height: meta.height_cm != null ? Math.round(meta.height_cm) : (meta.height_m != null ? Math.round(meta.height_m * 100) : null),
      weight: meta.weight_kg != null ? Math.round(meta.weight_kg) : null,
      grade: meta.grade != null ? meta.grade : (meta.school_year != null ? meta.school_year : null),
      dob: meta.dob || null
    };
  }

  // players: [{ meta, DATA }] → localStorage payload (sangdong_dashboard_v1)
  function buildPayload(players, opts) {
    opts = opts || {};
    var PLAYERS = [], realData = {}, realKeys = [];
    var sid = String(opts.sid || 1);
    players.forEach(function (pl, i) {
      var pe = playerEntry(pl.meta, '선수' + (i + 1));
      PLAYERS.push(pe);
      realData[pe.id] = {}; realData[pe.id][sid] = webportToM(pl.DATA);
      realKeys.push(pe.id + ':' + sid);
    });
    return {
      version: 1, savedAt: new Date().toISOString(),
      players: PLAYERS, realData: realData, realKeys: realKeys, realSectionKeys: []
    };
  }

  return { webportToM: webportToM, playerEntry: playerEntry, buildPayload: buildPayload, injuryRisk: injuryRisk };
});

