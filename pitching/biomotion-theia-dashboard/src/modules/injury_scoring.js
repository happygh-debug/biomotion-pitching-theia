// injury.js — 부상위험 (build_report_theia.py injury_risk 포팅)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tuning_models.json'));
  else root.injury = factory(root.TUNING_MODELS);
})(typeof self !== 'undefined' ? self : this, function (T) {
  const TH = T.INJURY_THRESHOLDS;
  function peakWin(arr, lo, hi) { if (!arr) return null; const a = Math.max(0, lo), b = Math.min(arr.length - 1, hi);
    let m = -Infinity, ok = false; for (let i = a; i <= b; i++) { const v = Math.abs(arr[i]); if (isFinite(v) && v > m) { m = v; ok = true; } } return ok ? m : null; }
  function compute(trials, bodyWeightN) {
    const KEYS = { shoulder_moment_x: 'Pitching_Shoulder_Moment_X', shoulder_moment_y: 'Pitching_Shoulder_Moment_Y', shoulder_moment_z: 'Pitching_Shoulder_Moment_Z',
      elbow_moment_x: 'Pitching_Elbow_Moment_X', elbow_moment_y: 'Pitching_Elbow_Moment_Y', elbow_moment_z: 'Pitching_Elbow_Moment_Z',
      shoulder_force_x: 'Pitching_Shoulder_Force_X', shoulder_force_y: 'Pitching_Shoulder_Force_Y', shoulder_force_z: 'Pitching_Shoulder_Force_Z' };
    const acc = {}; for (const k in KEYS) acc[k] = [];
    for (const t of trials) { const ser = t.series, ev = t.events; const ifc = ev.i_fc, ibr = ev.i_br; if (ifc == null || ibr == null) continue;
      for (const k in KEYS) { const v = peakWin(ser[KEYS[k]], ifc, ibr + 5); if (v != null) acc[k].push(v); } }
    const avg = k => acc[k].length ? Math.round(acc[k].reduce((a, b) => a + b, 0) / acc[k].length * 10) / 10 : null;
    const grade = (v, w, d) => v == null ? 'unavailable' : (v >= d ? 'danger' : (v >= w ? 'caution' : 'normal'));
    const ev = avg('elbow_moment_y'), sir = avg('shoulder_moment_z'), sd = avg('shoulder_force_y');
    const _ev = TH.elbow_valgus, _sir = TH.shoulder_ir, _sd = TH.shoulder_distraction;
    // [CALC-008] 체중(N)이 없거나 0·음수·비정상이면 distraction %BW 는 Infinity/NaN 이 되므로 null 처리
    const _validBW = (bodyWeightN != null && isFinite(bodyWeightN) && bodyWeightN > 0);
    const distractPct = (sd != null && _validBW) ? Math.round(sd / bodyWeightN * 100) : null;
    return {
      note: '축 정의(연구원 답변 v2): Elbow Varus=Y, Shoulder IR=Z, Distraction=Force_Y(상완·몸통 Local축). 임계값은 투구 바이오메카닉스 문헌(Fleisig/ASMI 등)의 피크 부하 일반 범위 기반 — 정규화·축 정의에 따라 미세조정 가능. 참고용·단독 진단 금지.',
      bw_n: _validBW ? Math.round(bodyWeightN) : null,
      metrics: [
        { key:'elbow_valgus', label:'Elbow Valgus/Varus Moment (UCL·Tommy John)', value:ev, unit:'Nm', axis:'Pitching_Elbow_Moment_Y (Varus · 상완 Local축)',
          hs_mean:_ev.hs_mean, warn:_ev.warn, danger:_ev.danger, grade:grade(ev,_ev.warn,_ev.danger), ref:'문헌 기반 일반 기준(Local축)' },
        { key:'shoulder_ir', label:'Shoulder Internal Rotation Moment (labrum·RC)', value:sir, unit:'Nm', axis:'Pitching_Shoulder_Moment_Z (IR · 몸통 Local축)',
          hs_mean:_sir.hs_mean, warn:_sir.warn, danger:_sir.danger, grade:grade(sir,_sir.warn,_sir.danger), ref:'문헌 기반 일반 기준(Local축)' },
        { key:'shoulder_distraction', label:'Shoulder Distraction Force (RC strain)', value:distractPct, unit:'%BW', axis:'Pitching_Shoulder_Force_Y (몸통→상완 장축=견인)',
          hs_mean:_sd.hs_mean, warn:_sd.warn, danger:_sd.danger, grade:grade(distractPct,_sd.warn,_sd.danger), ref:'문헌 기반 일반 기준(Local축)' },
      ],
      all_axes: Object.fromEntries(Object.keys(KEYS).map(k => [k, avg(k)])),
    };
  }
  return { compute };
});
