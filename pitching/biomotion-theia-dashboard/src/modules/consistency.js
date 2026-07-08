// consistency.js — C1 trial-by-trial dispersion SSOT (점수화·mech5 변경 없음)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.consistency = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var VERSION = 'C1';

  var LABELS = {
    relTimingCvPct: '릴리스 타이밍 CV',
    releaseSdMm: '릴리스 위치 SD',
    armSlotSdDeg: '암슬롯 SD',
    strideLenCV: '보폭 CV',
    grfDelaySd: '체중이동 시간 SD',
    seqSpanSd: '시퀀스 span SD',
    seqPelvisTrunkSd: '골반→몸통 lag SD',
    seqTrunkArmSd: '몸통→팔 lag SD',
    pelvisRotVCv: '골반 회전속도 CV',
    torsoRotVCv: '몸통 회전속도 CV',
    armRotVCv: '상완 회전속도 CV',
    elbowExtVCv: '팔꿈치 신전속도 CV',
    khFcSd: 'KH→FC 시간 SD',
    fcMerSd: 'FC→MER 시간 SD',
    fcBrSd: 'FC→BR 시간 SD',
    merPkSd: 'MER 각도 SD',
    trunkFlexBrSd: '릴리스 몸통 굴곡 SD',
    trunkRotBrSd: '릴리스 몸통 회전 SD',
    leadGrfPeakCv: '앞발 GRF peak CV'
  };

  function mean(a) {
    if (!a || !a.length) return null;
    return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
  }

  function pstdev(a) {
    if (!a || a.length < 2) return null;
    var m = mean(a);
    return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / a.length);
  }

  function r1(x) { return x == null || !isFinite(x) ? null : Math.round(x * 10) / 10; }
  function r2(x) { return x == null || !isFinite(x) ? null : Math.round(x * 100) / 100; }

  function cvPct(sd, mn) {
    if (sd == null || mn == null || !isFinite(sd) || !isFinite(mn) || Math.abs(mn) <= sd) return null;
    return r1(Math.abs(sd / Math.abs(mn) * 100));
  }

  function pkAbs(a, lo, hi) {
    if (!a || !a.length) return null;
    lo = Math.max(0, lo | 0);
    hi = Math.min(a.length - 1, hi == null ? a.length - 1 : (hi | 0));
    var b = null;
    for (var i = lo; i <= hi; i++) {
      var v = a[i];
      if (isFinite(v) && (b == null || Math.abs(v) > Math.abs(b))) b = v;
    }
    return b == null ? null : Math.abs(b);
  }

  function peakFrame(a, lo, hi) {
    if (!a) return null;
    lo = Math.max(0, lo | 0);
    hi = Math.min(a.length - 1, hi == null ? a.length - 1 : (hi | 0));
    var bi = null, bv = -Infinity;
    for (var i = lo; i <= hi; i++) {
      var v = a[i];
      if (isFinite(v) && v > bv) { bv = v; bi = i; }
    }
    return bi;
  }

  /** n_valid < 3 → null · 3–4 SD만 · 5+ CV 허용 */
  function finalizeDisp(raw, unit, key) {
    var v = raw || { n: 0, mean: null, sd: null, cv: null, range: null };
    var out = {
      key: key,
      label: LABELS[key] || key,
      n: v.n,
      mean: v.mean,
      sd: v.sd,
      cv: v.cv,
      range: v.range,
      unit: unit || '',
      available: true
    };
    if (v.n < 3) {
      out.mean = null;
      out.sd = null;
      out.cv = null;
      out.range = null;
      out.available = false;
      out.note = 'n_valid<3';
      return out;
    }
    if (v.n < 5) {
      out.cv = null;
      out.note = 'SD only (n<5)';
    }
    return out;
  }

  function disp(vals, unit, key) {
    var v = (vals || []).filter(function (x) { return x != null && isFinite(x); });
    if (!v.length) return finalizeDisp({ key: key, n: 0, mean: null, sd: null, cv: null, range: null }, unit, key);
    var mn = mean(v), sd = v.length > 1 ? pstdev(v) : null;
    var rng = v.length > 1 ? (Math.max.apply(null, v) - Math.min.apply(null, v)) : null;
    return finalizeDisp({
      key: key, n: v.length, mean: r2(mn), sd: r2(sd), cv: cvPct(sd, mn), range: r2(rng)
    }, unit, key);
  }

  function reliabilityTier(n) {
    if (n >= 10) return { tier: 'A', label: '충분', message: '반복성 추정 신뢰 가능' };
    if (n >= 7) return { tier: 'B', label: '보통', message: '참고용 · 추가 측정 권장' };
    if (n >= 4) return { tier: 'C', label: '낮음', message: 'CV 제한 · 코치 코멘트 보수' };
    return { tier: 'D', label: '불가', message: 'trial 수 부족 · 일관성 평가 불가' };
  }

  function selectPopulation(trials, opts) {
    opts = opts || {};
    var all = trials || [];
    var scored = all.filter(function (t) { return !t.validity || t.validity.valid_for_score !== false; });
    var use = (opts.population === 'all') ? all : (scored.length ? scored : all);
    var excluded = all.filter(function (t) { return t.validity && t.validity.valid_for_score === false; });
    return {
      trials: use,
      n_trials: all.length,
      n_used: use.length,
      n_excluded: excluded.length,
      fallback_all_trials: !scored.length && all.length > 0,
      policy: opts.population === 'all' ? 'all_trials' : 'valid_for_score',
      excluded: excluded.map(function (t) {
        return {
          trial_label: (t.meta && t.meta.trial_label) || '',
          reasons: (t.validity && t.validity.exclusion_reasons) || []
        };
      })
    };
  }

  function trialScalars(t, meta) {
    var ts = t.series || {}, te = t.events || {}, fr = t.frames || [];
    var dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
    var ht = (meta && meta.height_m) || 1.8;
    var bw = (meta && meta.weight_kg) || 75;
    var RHP = ((meta && meta.handedness) || 'R').toUpperCase() !== 'L';
    var hk = RHP ? 'r_hand_tip' : 'l_hand_tip';
    var ik = te.i_kl_peak, ifc = te.i_fc;
    var imer = te.i_mer != null ? te.i_mer : te.i_mer_erpeak;
    var ibr = te.i_br;
    var kd = (t.kseq && t.kseq.deltas) || {};
    var gm = t.grf_metrics || {};
    var rel3d = null;
    if (ibr != null && ibr < fr.length && fr[ibr] && fr[ibr][hk]) {
      var p = fr[ibr][hk];
      rel3d = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
    }
    var grfDelay = null;
    var s1 = ts.FP1_Z, s2 = ts.FP2_Z;
    if (s1 && s2 && ik != null && ibr != null) {
      var i1 = peakFrame(s1, ik, ibr), i2 = peakFrame(s2, ik, ibr);
      if (i1 != null && i2 != null) grfDelay = (i2 - i1) * dt * 1000;
    }
    var leadGrfPeak = null;
    if (s2 && ifc != null && ibr != null) {
      var lg = pkAbs(s2, ifc, ibr);
      if (lg != null && bw > 0) leadGrfPeak = lg / (bw * 9.81) * 100;
    }
    var strideLen = null;
    if (gm.stride_cop_m != null && isFinite(gm.stride_cop_m)) strideLen = gm.stride_cop_m / ht * 100;
    else {
      var sl = ts.STRIDE_LENGTH_X || [];
      if (sl.length) {
        var m = sl[0];
        sl.forEach(function (v) { if (Math.abs(v) > Math.abs(m)) m = v; });
        strideLen = Math.abs(m) / ht * 100;
      }
    }
    return {
      relTimingMs: (ifc != null && ibr != null) ? (ibr - ifc) * dt * 1000 : null,
      khFcMs: (ik != null && ifc != null) ? (ifc - ik) * dt * 1000 : null,
      fcMerMs: (ifc != null && imer != null && imer > ifc) ? (imer - ifc) * dt * 1000 : null,
      pelvisRotV: pkAbs(ts.Pelvis_Ang_Vel_Z, ik, ibr),
      torsoRotV: pkAbs(ts.Thorax_Ang_Vel_Z, ik, ibr),
      armRotV: pkAbs(ts.Pitching_Shoulder_Ang_Vel_Z, ik, ibr),
      elbowExtV: pkAbs(ts.Pitching_Elbow_Ang_Vel_X, ik, ibr),
      armSlot: (ifc != null && ts.Pitching_Shoulder_Angle_Y && isFinite(ts.Pitching_Shoulder_Angle_Y[ifc])) ? ts.Pitching_Shoulder_Angle_Y[ifc] : null,
      merPk: pkAbs(ts.Pitching_Shoulder_Angle_Z, ifc, ibr),
      trunkFlexBR: (ibr != null && ts.Trunk_Angle_X && isFinite(ts.Trunk_Angle_X[ibr])) ? ts.Trunk_Angle_X[ibr] : null,
      trunkRotBR: (ibr != null && ts.Trunk_Angle_Z && isFinite(ts.Trunk_Angle_Z[ibr])) ? ts.Trunk_Angle_Z[ibr] : null,
      grfDelay: grfDelay,
      leadGrfPeak: leadGrfPeak,
      seqSpan: (kd.pelvis_to_trunk_ms != null && kd.trunk_to_arm_ms != null) ? kd.pelvis_to_trunk_ms + kd.trunk_to_arm_ms : null,
      pelTrunkLag: kd.pelvis_to_trunk_ms,
      trunkArmLag: kd.trunk_to_arm_ms,
      strideLen: strideLen,
      release3d: rel3d
    };
  }

  function buildSummary(variables, reliability, pop) {
    var mergeKeys = ['relTimingCvPct', 'releaseSdMm', 'armSlotSdDeg', 'strideLenCV', 'grfDelaySd', 'seqSpanSd', 'fcBrSd', 'khFcSd'];
    var worst = null;
    Object.keys(variables).forEach(function (k) {
      var v = variables[k];
      if (!v || !v.available || v.cv == null) return;
      if (!worst || v.cv > worst.cv) worst = { key: k, cv: v.cv, label: v.label };
    });
    return {
      population_note: pop.n_used + '/' + pop.n_trials + '구 (valid_for_score' + (pop.fallback_all_trials ? ' · 폴백' : '') + ')',
      reliability_tier: reliability.tier,
      merge_ssot_keys: mergeKeys,
      worst_cv: worst,
      coach_t0_keys: ['relTimingCvPct', 'releaseSdMm', 'armSlotSdDeg', 'strideLenCV']
    };
  }

  function enrichDomains(domains, variables) {
    var out = {};
    Object.keys(domains).forEach(function (id) {
      var d = domains[id];
      out[id] = {
        id: id,
        label: d.label,
        keys: d.keys,
        metrics: (d.keys || []).map(function (k) {
          var v = variables[k] || {};
          return { key: k, label: v.label || k, n: v.n, mean: v.mean, sd: v.sd, cv: v.cv, unit: v.unit, available: v.available !== false };
        })
      };
    });
    return out;
  }

  function compute(trials, meta, opts) {
    var pop = selectPopulation(trials, opts);
    var rel = reliabilityTier(pop.n_used);
    var rows = pop.trials.map(function (t) {
      return {
        trial_label: (t.meta && t.meta.trial_label) || '',
        valid_for_score: !(t.validity && t.validity.valid_for_score === false),
        scalars: trialScalars(t, meta)
      };
    });
    function col(k) { return rows.map(function (r) { return r.scalars[k]; }); }

    var fcBr = disp(col('relTimingMs'), 'ms', 'fcBrSd');
    var variables = {
      relTimingCvPct: Object.assign({}, fcBr, { key: 'relTimingCvPct', label: LABELS.relTimingCvPct, unit: '%' }),
      releaseSdMm: disp(col('release3d'), 'mm', 'releaseSdMm'),
      armSlotSdDeg: disp(col('armSlot'), '°', 'armSlotSdDeg'),
      strideLenCV: disp(col('strideLen'), '%HT', 'strideLenCV'),
      grfDelaySd: disp(col('grfDelay'), 'ms', 'grfDelaySd'),
      seqSpanSd: disp(col('seqSpan'), 'ms', 'seqSpanSd'),
      pelvisRotVCv: disp(col('pelvisRotV'), '°/s', 'pelvisRotVCv'),
      torsoRotVCv: disp(col('torsoRotV'), '°/s', 'torsoRotVCv'),
      armRotVCv: disp(col('armRotV'), '°/s', 'armRotVCv'),
      elbowExtVCv: disp(col('elbowExtV'), '°/s', 'elbowExtVCv'),
      khFcSd: disp(col('khFcMs'), 'ms', 'khFcSd'),
      fcMerSd: disp(col('fcMerMs'), 'ms', 'fcMerSd'),
      fcBrSd: fcBr,
      merPkSd: disp(col('merPk'), '°', 'merPkSd'),
      trunkFlexBrSd: disp(col('trunkFlexBR'), '°', 'trunkFlexBrSd'),
      trunkRotBrSd: disp(col('trunkRotBR'), '°', 'trunkRotBrSd'),
      seqPelvisTrunkSd: disp(col('pelTrunkLag'), 'ms', 'seqPelvisTrunkSd'),
      seqTrunkArmSd: disp(col('trunkArmLag'), 'ms', 'seqTrunkArmSd'),
      leadGrfPeakCv: disp(col('leadGrfPeak'), '%BW', 'leadGrfPeakCv')
    };
    variables.relTimingCvPct.cv = fcBr.cv;
    variables.relTimingCvPct.sd = fcBr.sd;
    variables.relTimingCvPct.mean = fcBr.mean;
    variables.relTimingCvPct.n = fcBr.n;
    if (fcBr.n < 5) variables.relTimingCvPct.cv = null;

    var domainDefs = {
      seq_timing: { keys: ['seqPelvisTrunkSd', 'seqTrunkArmSd', 'seqSpanSd'], label: '키네마틱 시퀀스 타이밍' },
      rot_velocity: { keys: ['pelvisRotVCv', 'torsoRotVCv', 'armRotVCv', 'elbowExtVCv'], label: '회전속도' },
      event_interval: { keys: ['khFcSd', 'fcMerSd', 'fcBrSd', 'relTimingCvPct'], label: 'FC–MER–BR 구간' },
      release_posture: { keys: ['armSlotSdDeg', 'merPkSd', 'trunkFlexBrSd', 'trunkRotBrSd'], label: '릴리스 자세' },
      grf_pattern: { keys: ['grfDelaySd', 'leadGrfPeakCv'], label: '지면반력 패턴' },
      release_geometry: { keys: ['releaseSdMm', 'strideLenCV'], label: '릴리스·보폭' }
    };

    var domains = enrichDomains(domainDefs, variables);
    var summary = buildSummary(variables, rel, pop);

    return {
      version: VERSION,
      population: pop,
      reliability: rel,
      domains: domains,
      variables: variables,
      summary: summary,
      trials: rows
    };
  }

  return { VERSION: VERSION, compute: compute, selectPopulation: selectPopulation, trialScalars: trialScalars };
});
