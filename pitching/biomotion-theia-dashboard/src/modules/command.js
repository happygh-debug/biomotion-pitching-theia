// command.js — 제구 평가 (Outcome / Consistency layer · build_report_theia.py command 포팅)
// [C5 2026-06-03] commandOutcome(Rapsodo) · mechanicsConsistency(mech-only) 분리 — Rapsodo 없어도 동작 반복성 유지
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.command = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const pstdev = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
  const r1 = x => x == null ? null : Math.round(x * 10) / 10;
  const fin = v => v != null && isFinite(v);
  const clamp = v => Math.max(20, Math.min(100, Math.round(v)));

  function computeMechanics(trials, handedness) {
    const RHP = (handedness || 'R').toUpperCase() !== 'L';
    const hk = RHP ? 'r_hand_tip' : 'l_hand_tip';
    const rel = [], tim = [], arm = [], str = [];
    for (const t of (trials || [])) {
      const ev = t.events, fr = t.frames || [], ser = t.series || {}, dt = (t.meta && t.meta.dt) || (t.setup && t.setup.dt) || 0.00333;
      const ifc = ev.i_fc, ibr = ev.i_br;
      if (ifc == null || ibr == null) continue;
      if (t.throwing_wrist_pos_available !== false && ibr < fr.length && fr[ibr] && fr[ibr][hk]) rel.push(fr[ibr][hk]);
      tim.push((ibr - ifc) * dt * 1000);
      const sa = ser['Pitching_Shoulder_Angle_Y'] || [];
      if (ifc < sa.length && isFinite(sa[ifc])) arm.push(sa[ifc]);
      const sl = (ser['STRIDE_LENGTH_X'] || []).filter(isFinite);
      if (sl.length) str.push(sl.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a));
    }
    const sd = a => a.length > 1 ? pstdev(a) : 0;
    const relSd = rel.length > 1 ? Math.sqrt(sd(rel.map(p => p[0])) ** 2 + sd(rel.map(p => p[1])) ** 2 + sd(rel.map(p => p[2])) ** 2) : null;
    const timCv = (tim.length > 1 && mean(tim)) ? sd(tim) / mean(tim) * 100 : null;
    const armSd = arm.length > 1 ? sd(arm) : null;
    const strCv = (str.length > 1 && Math.abs(mean(str)) > 1e-6) ? sd(str) / Math.abs(mean(str)) * 100 : null;
    const relScore = relSd != null ? clamp(100 - relSd * 0.55) : null;
    const timScore = timCv != null ? clamp(100 - timCv * 4) : null;
    const armScore = armSd != null ? clamp(100 - armSd * 8) : null;
    const strScore = strCv != null ? clamp(100 - strCv * 8) : null;
    const mechs = [relScore, timScore, armScore, strScore].filter(v => v != null);
    const composite = mechs.length ? Math.round(mechs.reduce((a, b) => a + b, 0) / mechs.length) : null;
    return {
      relTimingCvPct: timCv != null ? r1(timCv) : null,
      armSlotSdDeg: armSd != null ? r1(armSd) : null,
      releaseSdMm: relSd != null ? r1(relSd) : null,
      strideLenCV: strCv != null ? r1(strCv) : null,
      composite_score: composite,
      release_score: relScore,
      timing_score: timScore,
      arm_score: armScore,
      stride_score: strScore,
      n_trials: (trials || []).length
    };
  }

  function computeOutcome(pitches) {
    if (!pitches || !pitches.length) return null;
    const strikes = pitches.filter(p => p.is_strike).length;
    const locPairs = pitches.map(p => [p.sz_side_in, p.sz_height_in]).filter(a => fin(a[0]) && fin(a[1]));
    const haveLoc = locPairs.length >= 3;
    const sides = locPairs.map(a => a[0]), heights = locPairs.map(a => a[1]);
    const sdS = haveLoc ? pstdev(sides) : null, sdH = haveLoc ? pstdev(heights) : null;
    const locSd = haveLoc ? Math.sqrt(sdS * sdS + sdH * sdH) : null;
    const cmdScore = haveLoc ? clamp(100 - locSd * 1.4) : null;
    const strikePct = pitches.length ? Math.round(strikes / pitches.length * 100) : null;
    const strikeScore = strikePct != null ? clamp(strikePct * 1.25) : null;
    return {
      score: cmdScore,
      location_score: cmdScore,
      loc_outcome: cmdScore,
      strike_score: strikeScore,
      strike_pct: strikePct,
      n: pitches.length,
      valid_location_n: locPairs.length,
      location_reason: haveLoc ? null : '쌍을 이룬 랩소도 로케이션 데이터 부족(최소 3구)',
      side_sd: r1(sdS),
      height_sd: r1(sdH),
      loc_sd: r1(locSd),
      has_location: haveLoc
    };
  }

  function compute(pitches, trials, handedness) {
    if (!trials || !trials.length) return null;
    const mc = computeMechanics(trials, handedness);
    const outcome = computeOutcome(pitches);
    const hasLoc = outcome && outcome.has_location;
    const mech = mc.composite_score;
    let final = hasLoc
      ? ((mech != null) ? Math.round(0.65 * outcome.score + 0.35 * mech) : outcome.score)
      : (mech != null ? mech : null);
    const out = {
      commandOutcome: outcome,
      mechanicsConsistency: mc,
      has_rapsodo_location: !!hasLoc,
      score: final,
      mech_consistency: mech,
      location_score: outcome ? outcome.location_score : null,
      loc_outcome: outcome ? outcome.loc_outcome : null,
      strike_score: outcome ? outcome.strike_score : null,
      strike_pct: outcome ? outcome.strike_pct : null,
      n: outcome ? outcome.n : 0,
      valid_location_n: outcome ? outcome.valid_location_n : 0,
      location_reason: outcome ? outcome.location_reason : null,
      side_sd: outcome ? outcome.side_sd : null,
      height_sd: outcome ? outcome.height_sd : null,
      loc_sd: outcome ? outcome.loc_sd : null,
      relTimingCvPct: mc.relTimingCvPct,
      armSlotSdDeg: mc.armSlotSdDeg,
      releaseSdMm: mc.releaseSdMm,
      strideLenCV: mc.strideLenCV,
      release_sd_mm: mc.releaseSdMm,
      timing_cv: mc.relTimingCvPct,
      arm_slot_sd: mc.armSlotSdDeg,
      stride_cv: mc.strideLenCV,
      release_score: mc.release_score,
      timing_score: mc.timing_score,
      arm_score: mc.arm_score,
      stride_score: mc.stride_score
    };
    return out;
  }

  return { compute, computeMechanics, computeOutcome };
});
