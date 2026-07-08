/* xfactor_research.js — research_only 병렬 X-factor 정의 (score·feedback 미반영)
 * SSOT(trial.x_factor) 변경 없음. 감사·비교 스크립트 전용.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.xfactorResearch = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  function wrap180(d) {
    return ((d + 180) % 360 + 360) % 360 - 180;
  }

  function peakSigned(a, lo, hi) {
    if (!a || !a.length) return { v: null, i: null, mag: null };
    lo = lo || 0;
    hi = (hi == null ? a.length - 1 : hi);
    var bi = null, bv = -Infinity, mag = null;
    for (var i = lo; i <= hi && i < a.length; i++) {
      var v = a[i];
      if (!isFinite(v)) continue;
      var t = Math.abs(v);
      if (t > bv) { bv = t; bi = i; mag = t; }
    }
    return { v: bi == null ? null : a[bi], i: bi, mag: mag };
  }

  function valAt(a, i) {
    return (a && i != null && i < a.length && isFinite(a[i])) ? a[i] : null;
  }

  function unwindV(a, iPk, ibr, dt) {
    if (iPk == null || ibr == null || ibr <= iPk + 1 || !dt) return null;
    var uw = 0;
    for (var k = iPk + 1; k <= ibr && k < a.length; k++) {
      var d = (Math.abs(a[k - 1]) - Math.abs(a[k])) / dt;
      if (isFinite(d) && d > uw) uw = d;
    }
    return uw > 0 ? Math.round(uw) : null;
  }

  /** shoulder_line_yaw − pelvis_line_yaw (수평 투영, frames 기반) */
  function buildGlobalYawSeries(frames) {
    if (!frames || !frames.length) return [];
    function hang(p, q) {
      return (p && q && isFinite(p[0]) && isFinite(q[0]))
        ? Math.atan2(q[2] - p[2], q[0] - p[0]) * 180 / Math.PI : NaN;
    }
    var out = new Array(frames.length);
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i] || {};
      var hip = hang(f.l_hip, f.r_hip), sho = hang(f.l_shoulder, f.r_shoulder);
      out[i] = (isFinite(hip) && isFinite(sho)) ? wrap180(sho - hip) : NaN;
    }
    return out;
  }

  /** orient: KH~BR max|·| 양수 (extract_theia._orientXf 동일) */
  function orientPositive(a, ikl, ibr) {
    if (!a) return a;
    var pk = peakSigned(a, ikl, ibr);
    if (pk.i != null && pk.v < 0) {
      var o = a.slice();
      for (var i = 0; i < o.length; i++) o[i] = isFinite(o[i]) ? -o[i] : o[i];
      return o;
    }
    return a.slice();
  }

  /**
   * @param {object} trial — extractTrial 산출물
   * @returns {object|null} research_only metrics
   */
  function computeResearchMetrics(trial) {
    if (!trial) return null;
    var ev = trial.events || {};
    var dt = (trial.setup && trial.setup.dt) || (trial.meta && trial.meta.dt) || 0.00333;
    var ikl = ev.i_kl_peak || 0, ifc = ev.i_fc, ibr = ev.i_br;
    if (ibr == null) return null;

    var segZ = (trial.x_factor && trial.x_factor.length) ? trial.x_factor.slice()
      : ((trial.series && trial.series.Trunk_wrt_Pelvis_Angle_Z) ? trial.series.Trunk_wrt_Pelvis_Angle_Z.slice() : []);
    var globRaw = buildGlobalYawSeries(trial.frames || []);
    var globYaw = orientPositive(globRaw, ikl, ibr);

    var pkSeg = peakSigned(segZ, ikl, ibr);
    var pkGlob = peakSigned(globYaw, ikl, ibr);

    var segAtFC = valAt(segZ, ifc); segAtFC = segAtFC == null ? null : Math.abs(segAtFC);
    var globAtFC = valAt(globYaw, ifc); globAtFC = globAtFC == null ? null : Math.abs(globAtFC);
    var segAtBR = valAt(segZ, ibr); segAtBR = segAtBR == null ? null : Math.abs(segAtBR);
    var globAtBR = valAt(globYaw, ibr); globAtBR = globAtBR == null ? null : Math.abs(globAtBR);

    var segPkMag = pkSeg.mag;
    var segReleasedPct = null;
    if (segAtFC != null && segPkMag != null && segPkMag > 1) {
      var rel = (pkSeg.i != null && ifc != null && pkSeg.i < ifc) ? (segPkMag - segAtFC) : 0;
      segReleasedPct = Math.max(0, Math.round(rel / segPkMag * 1000) / 10);
    }

    return {
      _research_only: true,
      xFactorSegmentZ: segZ,
      xFactorGlobalYaw: globYaw,
      xFactorSegmentZPeak: pkSeg.mag == null ? null : Math.round(pkSeg.mag * 10) / 10,
      xFactorSegmentZPeakSigned: pkSeg.v == null ? null : Math.round(pkSeg.v * 10) / 10,
      xFactorGlobalYawPeak: pkGlob.mag == null ? null : Math.round(pkGlob.mag * 10) / 10,
      xFactorGlobalYawPeakSigned: pkGlob.v == null ? null : Math.round(pkGlob.v * 10) / 10,
      xFactorSegmentZPeakFromFC: (pkSeg.i != null && ifc != null && dt) ? Math.round((pkSeg.i - ifc) * dt * 1000) : null,
      xFactorGlobalYawPeakFromFC: (pkGlob.i != null && ifc != null && dt) ? Math.round((pkGlob.i - ifc) * dt * 1000) : null,
      xFactorSegmentZAtFC: segAtFC,
      xFactorGlobalYawAtFC: globAtFC,
      xFactorSegmentZAtBR: segAtBR,
      xFactorGlobalYawAtBR: globAtBR,
      xFactorSegmentZUnwindV: unwindV(segZ, pkSeg.i, ibr, dt),
      xFactorGlobalYawUnwindV: unwindV(globYaw, pkGlob.i, ibr, dt),
      xFactorSegmentZReleasedPctByFC: segReleasedPct,
      x_factor_method: trial.x_factor_method || null,
      handedness: (trial.meta && trial.meta.handedness) || (trial.throw_side === 'left' ? 'L' : 'R')
    };
  }

  return {
    wrap180: wrap180,
    buildGlobalYawSeries: buildGlobalYawSeries,
    orientPositive: orientPositive,
    peakSigned: peakSigned,
    computeResearchMetrics: computeResearchMetrics
  };
});
