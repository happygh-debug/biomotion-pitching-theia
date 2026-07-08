
// energy.js — 에너지 전달(운동사슬 효율) 점수화. BioMotion 5모델과 차별: 속도/시퀀스 + web-port 에너지 변인(분절 ME 흐름) 반영.
//  metrics: 시퀀스 정확도 · 채찍 가속(팔/몸통) · 운동사슬 타이밍 · 분절 에너지 흐름(근위→원위 ME peak 순서).
//  레퍼런스는 잠정(UNVERIFIED) — tuning_models.json ENERGY_TRANSFER 로 튜닝 가능.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tuning_models.json'));
  else root.energy = factory(root.TUNING_MODELS);
})(typeof self !== 'undefined' ? self : this, function (T) {
  var R = (T && T.ENERGY_TRANSFER) || {
    whip_gain: { median_elite: 4.5, per_unit: 0.5, importance: 'high' },
    chain_timing: { optimal_range: [45, 95], per_unit: 15, importance: 'med' },
    seq_correct: { ideal: 100, importance: 'high' },
    segment_flow: { ideal: 2, importance: 'high' }
  };
  var IW = { high: 3, med: 2, low: 1 };
  function clamp(v) { return Math.max(20, Math.min(100, Math.round(v))); }
  function scoreDir(v, me, per) { return (v == null || !isFinite(v)) ? null : clamp(100 + (v - me) / per * 5); }
  function scoreOpt(v, lo, hi, per) { if (v == null || !isFinite(v)) return null; if (v >= lo && v <= hi) return 100; return clamp(100 + ((v < lo ? (v - lo) : (hi - v)) / per) * 5); }
  function peakFrame(arr, lo, hi) { if (!arr) return null; var m = -Infinity, bi = -1; lo = lo || 0; hi = (hi == null ? arr.length - 1 : hi);
    for (var i = lo; i <= hi && i < arr.length; i++) { var v = arr[i]; if (isFinite(v) && v > m) { m = v; bi = i; } } return bi >= 0 ? bi : null; }
  var mean = function (a) { a = a.filter(function (x) { return x != null && isFinite(x); }); return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };

  // trials: reportData 의 trials (각 t.kseq, t.series, t.events)
  function energyTransfer(trials) {
    var seqOk = 0, gains = [], lags = [], flows = [], n = 0, pmeV = [], tmeV = [], hmeV = [], ptLag = [], taLag = [];
    trials.forEach(function (pt) {
      var t = pt.trial || pt; if (!t || !t.kseq) return; n++;
      if (t.kseq.sequence_ok) seqOk++;
      var g = t.kseq.gains || {}; if (g.arm_over_trunk != null) gains.push(g.arm_over_trunk);
      var d = t.kseq.deltas || {}; if (d.pelvis_to_trunk_ms != null && d.trunk_to_arm_ms != null) lags.push((d.pelvis_to_trunk_ms + d.trunk_to_arm_ms) / 2);
      var ev = t.events || {}, ser = t.series || {};
      var pp = peakFrame(ser.Pelvis_ME_X, ev.i_kl_peak, ev.i_br), tp = peakFrame(ser.Trunk_ME_X, ev.i_kl_peak, ev.i_br), hp = peakFrame(ser.Pitching_Humerus_ME_X, ev.i_kl_peak, ev.i_br);
      if (pp != null && tp != null && hp != null) { var o = 0; if (pp < tp) o++; if (tp < hp) o++; flows.push(o); }
      if (pp != null && isFinite(ser.Pelvis_ME_X[pp])) pmeV.push(ser.Pelvis_ME_X[pp]);
      if (tp != null && isFinite(ser.Trunk_ME_X[tp])) tmeV.push(ser.Trunk_ME_X[tp]);
      if (hp != null && isFinite(ser.Pitching_Humerus_ME_X[hp])) hmeV.push(ser.Pitching_Humerus_ME_X[hp]);
      if (d.pelvis_to_trunk_ms != null) ptLag.push(d.pelvis_to_trunk_ms);
      if (d.trunk_to_arm_ms != null) taLag.push(d.trunk_to_arm_ms);
    });
    n = n || 1;
    var seqPct = Math.round(100 * seqOk / n);
    var whip = gains.length ? Math.round(mean(gains) * 100) / 100 : null;
    var lag = lags.length ? Math.round(mean(lags) * 10) / 10 : null;
    var flow = flows.length ? Math.round(mean(flows) * 100) / 100 : null;  // 0~2
    var metrics = [
      { key: 'seq_correct', label: '시퀀스 정확도', unit: '%', value: seqPct, score: seqPct == null ? null : clamp(seqPct), median_elite: 100, importance: R.seq_correct.importance, note: '골반→몸통→팔 올바른 순서 비율(12구)' },
      { key: 'whip_gain', label: '채찍 가속 (팔/몸통)', unit: '×', value: whip, score: scoreDir(whip, R.whip_gain.median_elite, R.whip_gain.per_unit), median_elite: R.whip_gain.median_elite, importance: R.whip_gain.importance, note: '몸통→팔 각속도 증폭(채찍 효과)' },
      { key: 'chain_timing', label: '운동사슬 타이밍', unit: 'ms', value: lag, score: scoreOpt(lag, R.chain_timing.optimal_range[0], R.chain_timing.optimal_range[1], R.chain_timing.per_unit), optimal_range: R.chain_timing.optimal_range, importance: R.chain_timing.importance, note: '분절간 peak 지연(근위→원위 적정 간격)' },
      { key: 'segment_flow', label: '분절 에너지 흐름', unit: '/2', value: flow, score: flow == null ? null : clamp(flow / 2 * 100), median_elite: 2, importance: R.segment_flow.importance, note: '분절 역학에너지(ME) peak 가 골반→몸통→상완 순서로 전달되는가' }
    ];
    var sc = [], W = 0, S = 0;
    metrics.forEach(function (m) { if (m.score != null) { var w = IW[m.importance] || 1; W += w; S += m.score * w; } });
    var score = W > 0 ? Math.round(S / W) : null;
    var weakest = metrics.filter(function (m) { return m.score != null; }).sort(function (a, b) { return a.score - b.score; })[0] || null;
    return {
      label: ' 에너지 전달 (Energy Transfer)', sub: '운동사슬 효율 — 시퀀스·채찍 가속·전달 타이밍·분절 에너지 흐름',
      score: score, mph_contribution: null, metrics: metrics, weakest: weakest ? weakest.key : null,
      info: (function () {
        var pJ = pmeV.length ? Math.round(mean(pmeV)) : null, tJ = tmeV.length ? Math.round(mean(tmeV)) : null, hJ = hmeV.length ? Math.round(mean(hmeV)) : null;
        return {
          me_peak_pelvis_J: pJ, me_peak_trunk_J: tJ, me_peak_humerus_J: hJ,
          me_amp_trunk_over_pelvis: (pJ && tJ) ? Math.round(tJ / pJ * 100) / 100 : null,
          lag_pelvis_trunk_ms: ptLag.length ? Math.round(mean(ptLag)) : null,
          lag_trunk_arm_ms: taLag.length ? Math.round(mean(taLag)) : null,
          arm_transfer_pct: null
        };
      })(),
      source_note: 'web-port 에너지 변인(분절 ME) + kseq 기반. 레퍼런스 잠정(UNVERIFIED) — 코호트 확정 시 튜닝.'
    };
  }
  return { energyTransfer: energyTransfer };
});

