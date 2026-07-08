// biomotion.js — biomotion.py/biomotion_theia.py 스코어링 엔진 포팅
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tuning_models.json'));
  else root.biomotion = factory(root.TUNING_MODELS);
})(typeof self !== 'undefined' ? self : this, function (T) {
  const MODELS = T.BIOMOTION_5_MODELS, IW = T.IMPORTANCE_WEIGHT,
        RETEST = T.RETEST_TARGET_SCORE, MAXC = T.MAX_CEILING_SCORE;

  function metricScore(value, d) {
    if (value == null || !isFinite(value)) return null;
    const me = d.median_elite, per = d.per_1mph;
    if (me == null || per == null || per === 0) return null;
    // v9: optimal_range 존중 — 정상권 안은 100(감점 없음), 범위 밖만 가장 가까운 경계 기준 감점 (metricMph 와 일치)
    const opt = d.optimal_range; let score;
    if (opt) { const lo = opt[0], hi = opt[1];
      if (value >= lo && value <= hi) score = 100;
      else if (value < lo) score = 100 + ((value - lo) / per) * 5;
      else score = 100 + ((hi - value) / per) * 5;
    } else { const sgn = (d.dir === -1) ? -1 : 1; score = 100 + (sgn * (value - me) / per) * 5; }
    return Math.round(Math.max(20, Math.min(100, score)));
  }
  function metricMph(value, d) {
    if (value == null || !isFinite(value)) return null;
    const me = d.median_elite, per = d.per_1mph;
    if (me == null || per == null || per === 0) return null;
    const opt = d.optimal_range;
    if (opt) { const [lo, hi] = opt;
      if (value >= lo && value <= hi) return 0.0;
      if (value < lo) return Math.round(Math.max(-3.0, (value - lo) / per) * 100) / 100;
      return Math.round(Math.max(-3.0, -(value - hi) / per) * 100) / 100;
    }
    const raw = ((d.dir === -1) ? -1 : 1) * (value - me) / per;
    return Math.round(Math.max(-3.0, Math.min(3.0, raw)) * 100) / 100;
  }
  function diagnose(input_vector, metricToInp, measured_kmh) {
    const matched = {};
    for (const k in metricToInp) matched[k] = input_vector[metricToInp[k]];
    const outModels = {};
    for (const mk in MODELS) {
      const mdef = MODELS[mk]; const scores = []; const mphs = []; const metricsOut = [];
      for (const metK in mdef.metrics) {
        const def = mdef.metrics[metK]; const v = matched[metK];
        const s = metricScore(v, def); const mph = metricMph(v, def);
        const wt = IW[def.importance] || 1;
        if (s != null) for (let i = 0; i < wt; i++) scores.push(s);
        if (mph != null) for (let i = 0; i < wt; i++) mphs.push(mph);
        metricsOut.push({ key: metK, label: def.label, unit: def.unit, value: (v == null ? null : v), score: s, mph_contrib: mph,
          median_elite: def.median_elite, per_1mph: def.per_1mph, importance: def.importance,
          optimal_range: def.optimal_range || null, verify: 'UNVERIFIED', verify_note: '' });
      }
      const avgS = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const avgM = mphs.length ? Math.round(mphs.reduce((a, b) => a + b, 0) / mphs.length * 100) / 100 : null;
      outModels[mk] = { label: mdef.label, sub: mdef.sub, weight: mdef.weight, velo_rank: mdef.velo_rank, ae_rank: mdef.ae_rank,
        score: avgS, mph_contribution: avgM, metrics: metricsOut };
    }
    const valid = Object.values(outModels).filter(m => m.score != null);
    let total = null, strength = null, weakness = null;
    if (valid.length) {
      const tw = valid.reduce((a, m) => a + m.weight, 0);
      total = Math.round(valid.reduce((a, m) => a + m.score * m.weight, 0) / tw);
      const srt = valid.slice().sort((a, b) => b.score - a.score);
      strength = srt[0].label; weakness = srt[srt.length - 1].label;
    }
    // ceiling — [CALC-007] '모델 예측 구속 여력(잠재 상한)' 의미. RETEST(125)/MAXC(150)는 점수 부족분이 아니라
    //   엘리트-최대 물리 상한까지의 모델 여력 → 종합 100점이어도 추가 여력이 남을 수 있음(score-deficit 아님).
    //   표시 시 반드시 '여력/잠재'로 라벨(목표·예측 구속처럼 '부족분'으로 오해 금지).
    let retestCapped = null, maxCapped = null;
    if (total != null) {
      let ra = 0, ma = 0;
      for (const m of valid) { ra += Math.max(0, (RETEST - m.score) / 5) * m.weight; ma += Math.max(0, (MAXC - m.score) / 5) * m.weight; }
      const cap = total < 70 ? 3.0 : (total >= 90 ? 2.0 : 4.0);
      retestCapped = Math.min(ra, cap); maxCapped = Math.min(ma, 8.0);
    }
    const r1 = x => x == null ? null : Math.round(x * 10) / 10;
    const ceiling = { retest_mph_gain: r1(retestCapped), max_mph_gain: r1(maxCapped),
      retest_kmh_gain: r1(retestCapped != null ? retestCapped * 1.60934 : null),
      max_kmh_gain: r1(maxCapped != null ? maxCapped * 1.60934 : null), measured_kmh,
      retest_kmh: r1(measured_kmh != null && retestCapped != null ? measured_kmh + retestCapped * 1.60934 : null),
      max_kmh: r1(measured_kmh != null && maxCapped != null ? measured_kmh + maxCapped * 1.60934 : null),
      semantics: 'modeled_upside', label_ko: '모델 예측 구속 여력(잠재)' }; // [CALC-007] 점수부족분 아님 — 표시는 '여력'으로
    return { models: outModels, composite_score: total, strength_model: strength, weakness_model: weakness, ceiling };
  }

  // ── build_input_vector (biomotion_theia.py 포팅) ──
  function _grad(a, dt) { const n = a.length, g = new Array(n).fill(NaN);
    if (n < 2) return g;
    g[0] = (a[1] - a[0]) / dt; g[n-1] = (a[n-1] - a[n-2]) / dt;
    for (let i = 1; i < n-1; i++) g[i] = (a[i+1] - a[i-1]) / (2*dt); return g; }
  function _peakWin(ser, key, lo, hi, signed) { const a = ser[key]; if (!a) return null;
    lo = Math.max(0, Math.min(lo, a.length-1)); hi = Math.max(lo, Math.min(hi, a.length-1));
    const sl = []; for (let i = lo; i <= hi; i++) if (isFinite(a[i])) sl.push(a[i]);
    if (!sl.length) return null;
    if (signed === false) return Math.max.apply(null, sl);
    let bi = 0, bv = -Infinity; for (let i = 0; i < sl.length; i++) { const m = Math.abs(sl[i]); if (m > bv) { bv = m; bi = i; } } return sl[bi]; }
  function _at(ser, key, idx) { if (idx == null) return null; const a = ser[key]; if (!a || idx < 0 || idx >= a.length) return null; const v = a[idx]; return isFinite(v) ? v : null; }
  function _peakDeriv(ser, key, lo, hi, dt) { const a = ser[key]; if (!a || !dt) return null;
    let fin = 0; for (const v of a) if (isFinite(v)) fin++; if (fin < 5) return null;
    const g = _grad(a, dt); lo = Math.max(0, Math.min(lo, g.length-1)); hi = Math.max(lo, Math.min(hi, g.length-1));
    let bv = -Infinity, ok = false; for (let i = lo; i <= hi; i++) { const m = Math.abs(g[i]); if (isFinite(m) && m > bv) { bv = m; ok = true; } } return ok ? bv : null; }
  // [CALC-004] 이벤트 인덱스가 없으면 frame 0 으로 떨어지지 않고 null 반환(엉뚱한 국면 값 방지)
  function _vw(lo, hi) { return (lo != null && isFinite(lo) && hi != null && isFinite(hi) && hi > lo); }
  function _pw(ser, key, lo, hi, signed) { return _vw(lo, hi) ? _peakWin(ser, key, lo, hi, signed) : null; }
  function _pd(ser, key, lo, hi, dt) { return _vw(lo, hi) ? _peakDeriv(ser, key, lo, hi, dt) : null; }

  function buildInputVector(trial) {
    const ser = trial.series, ev = trial.events, sc = trial.scalars || {}, grf = trial.grf || {};
    const dt = (trial.setup && trial.setup.dt) || (trial.meta && trial.meta.dt);
    const iKL = ev.i_kl_peak, iFC = ev.i_fc, iMER = ev.i_mer, iBR = ev.i_br;
    const xf = trial.x_factor || [];
    const inp = {};
    inp.layback = _pw(ser, 'Pitching_Shoulder_Angle_Z', iFC, iBR, true);
    inp.shoulder_abd_fp = _at(ser, 'Pitching_Shoulder_Angle_Y', iFC);
    const hadd = _at(ser, 'Pitching_Shoulder_Angle_X', iFC); inp.scap_load_fp = hadd == null ? null : -hadd;
    const srv = _pw(ser, 'Pitching_Shoulder_Ang_Vel_Z', iKL, iBR, true); inp.shoulder_rot_velo = srv == null ? null : Math.abs(srv);
    inp.elbow_flex_fp = _at(ser, 'Pitching_Elbow_Angle_X', iFC);
    inp.elbow_ext_velo = _pd(ser, 'Pitching_Elbow_Angle_X', iKL, iBR, dt);
    // [CALC-005] 유한 값이 없으면 Math.max 가 -Infinity 가 되지 않도록 가드
    const validXf = xf.filter(v => v != null && isFinite(v)); const pos = validXf.filter(v => v > 0);
    inp.hip_shoulder_sep_peak = pos.length ? Math.max.apply(null, pos) : (validXf.length ? Math.max.apply(null, validXf) : null);
    inp.hip_shoulder_sep_fp = (iFC != null && iFC >= 0 && iFC < xf.length) ? xf[iFC] : null;
    if (xf.length && iKL != null && iFC != null && iFC > iKL) {
      const seg = xf.slice(iKL, iFC + 1).filter(v => v != null && isFinite(v)); inp.torso_counter_rot = seg.length ? Math.min.apply(null, seg) : null;
    }
    inp.torso_fwd_tilt_fp = _at(ser, 'Trunk_Angle_X', iFC);
    inp.torso_side_bend_mer = _at(ser, 'Trunk_Angle_Y', iMER);
    const zKL = (col, idx) => { const a = ser[col]; if (!a || idx == null || iKL == null || idx >= a.length || iKL >= a.length) return null; const vi = a[idx], vk = a[iKL]; return (isFinite(vi) && isFinite(vk)) ? -(vi - vk) : null; };
    inp.torso_rot_fp = zKL('Trunk_Angle_Z', iFC); inp.torso_rot_br = zKL('Trunk_Angle_Z', iBR);
    // [CALC-003] 속도 지표는 부호가 아니라 크기로 표시 — shoulder_rot_velo 와 동일하게 절대값
    var _trv = _pw(ser, 'Thorax_Ang_Vel_Z', iKL, iBR, true); inp.torso_rot_velo = _trv == null ? null : Math.abs(_trv);
    var _prv = _pw(ser, 'Pelvis_Ang_Vel_Z', iKL, iBR, true); inp.pelvis_rot_velo = _prv == null ? null : Math.abs(_prv);
    inp.lead_force_pct = (grf.fp2 || {}).peak_z_pct_bw;
    inp.lead_knee_ext = _at(ser, 'Lead_Knee_Angle_X', iBR);
    const sm = sc.stride_length; inp.stride_length = sm == null ? null : sm * 100;
    inp.lead_knee_ext_velo = _peakDeriv(ser, 'Lead_Knee_Angle_X', iFC || 0, iBR || 0, dt);
    inp.rear_force_pct = (grf.fp1 || {}).peak_z_pct_bw;
    // cog
    let vel = null; const velc = ser['COM_Velocity_Y'];
    if (velc && velc.length > 5) vel = velc.slice();
    else { const com = ser['COM_displacement_Y']; if (com && com.length > 5) { vel = _grad(com, dt);
      const seg = vel.slice(iKL || 0, (iBR || vel.length)); const finv = seg.filter(isFinite).sort((a,b)=>a-b);
      const med = finv.length ? finv[Math.floor(finv.length/2)] : 0; if (med < 0) vel = vel.map(v => -v); } }
    inp.max_cog_velo = null; inp.cog_decel = null; inp.cog_decel_ae = null;
    if (vel) {
      if (iKL != null && iBR != null) { const sub = vel.slice(iKL, iBR + 1).filter(isFinite); if (sub.length) inp.max_cog_velo = Math.max.apply(null, sub); }
      if (iFC != null && iBR != null) { const sub = vel.slice(iFC, iBR + 1).filter(isFinite); if (sub.length) inp.cog_decel = Math.max.apply(null, sub) - Math.min.apply(null, sub); }
      const mcv = inp.max_cog_velo, vbr = (iBR != null && iBR < vel.length && isFinite(vel[iBR])) ? vel[iBR] : null;
      if (mcv != null && vbr != null) { const act = mcv - vbr, exp = Math.max(0, 0.755 * mcv - 0.567); inp.cog_decel_ae = Math.round((act - exp) * 1000) / 1000; }
    }
    return inp;
  }

  return { metricScore, metricMph, diagnose, buildInputVector };
});
