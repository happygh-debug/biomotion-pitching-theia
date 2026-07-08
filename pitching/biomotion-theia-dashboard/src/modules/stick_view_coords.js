/**
 * stick_view_coords.js — Stick / Anatomical viewer coordinate SSOT (render-only)
 * skeleton · foot · COM · GRF share dataToScreen — no biomechanical calculation changes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StickViewCoords = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Dev: true → joint/foot/COM/GRF labels + frame index HUD */
  var DEBUG_OVERLAY = false;

  var GRF_FOOT_GROUND_TOL_MM = 55;
  var GRF_COP_MAX_DIST_MM = 95;
  var SANITY_COM_DIST_MM = 900;
  var SANITY_GRF_FOOT_DIST_MM = 130;
  var FOOT_STUB_LEN_MM = 95;

  var _skeletonFrameIdx = null;
  var _comFrameIdx = null;
  var _grfFrameIdx = null;

  function isVec3(p) {
    return p && p.length >= 3 && p.every(function (x) { return isFinite(x); });
  }

  function metaFromTrial(trial) {
    var m = (trial && trial.meta) || {};
    return {
      ground: m.ground_y_m || 0,
      ox: m.viewer_origin_horiz0_m || 0,
      oz: m.viewer_origin_horiz1_m || 0,
      haxes: m.horiz_axes || ['X', 'Y'],
      axUp: m.axis_up || 'Z'
    };
  }

  /**
   * Viewer scene mm — same mapping as extract_theia buildFrames:
   *   X = -(horiz0 − origin_h0) × 1000
   *   Y = (vertical_up − ground) × 1000   (+Y = up, ground ≈ 0)
   *   Z = (horiz1 − origin_h1) × 1000
   * opts.fromTheiaMeters: point is [h0, h1_horiz, axis_up] in Theia metres.
   */
  function dataToScreen(point, opts) {
    opts = opts || {};
    if (!point || point.length < 3) return null;
    if (opts.fromTheiaMeters) {
      var meta = opts.meta || {};
      var h0 = point[0], h1 = point[1], up = point[2];
      if (!isFinite(h0) || !isFinite(h1)) return null;
      return [
        -(h0 - (meta.ox || 0)) * 1000,
        isFinite(up) ? (up - (meta.ground || 0)) * 1000 : 0,
        (h1 - (meta.oz || 0)) * 1000
      ];
    }
    if (!isVec3(point)) return null;
    return [point[0], point[1], point[2]];
  }

  function framePoint(frame, key) {
    if (!frame || !key) return null;
    return dataToScreen(frame[key]);
  }

  function comFromFrame(frame) {
    return frame && frame.com ? dataToScreen(frame.com) : null;
  }

  function copFromTrial(trial, frameIdx, prefix) {
    if (!trial || frameIdx == null || !prefix) return null;
    var meta = metaFromTrial(trial);
    var s = trial.series || {};
    var cx = s[prefix + '_' + meta.haxes[0] + '_2'] && s[prefix + '_' + meta.haxes[0] + '_2'][frameIdx];
    var cy = s[prefix + '_' + meta.haxes[1] + '_2'] && s[prefix + '_' + meta.haxes[1] + '_2'][frameIdx];
    var cz = s[prefix + '_' + meta.axUp + '_2'] && s[prefix + '_' + meta.axUp + '_2'][frameIdx];
    if (!isFinite(cx) || !isFinite(cy)) return null;
    return dataToScreen([cx, cy, cz], { fromTheiaMeters: true, meta: meta });
  }

  function virtualAnkle(knee, heel) {
    if (!isVec3(knee) || !isVec3(heel)) return null;
    return [
      knee[0] + (heel[0] - knee[0]) * 0.85,
      knee[1] + (heel[1] - knee[1]) * 0.85,
      knee[2] + (heel[2] - knee[2]) * 0.85
    ];
  }

  /** Foot segment + ground contact — heel/toe preferred, ankle stub fallback */
  function footSegment(frame, cfg, which) {
    if (!frame || !cfg) return null;
    var side = which === 'lead' ? cfg.legLead : cfg.legRear;
    if (!side) return null;
    var heel = dataToScreen(frame[side + '_heel']);
    var toe = dataToScreen(frame[side + '_toe']);
    var knee = dataToScreen(frame[side + '_knee']);
    var ankle = virtualAnkle(frame[side + '_knee'], frame[side + '_heel']);

    if (!heel && !toe && ankle) {
      var stubDir = footStubDirection(frame, cfg, which, ankle, knee);
      if (stubDir) {
        toe = [
          ankle[0] + stubDir[0] * FOOT_STUB_LEN_MM,
          ankle[1],
          ankle[2] + stubDir[2] * FOOT_STUB_LEN_MM
        ];
        heel = [
          ankle[0] - stubDir[0] * (FOOT_STUB_LEN_MM * 0.35),
          ankle[1],
          ankle[2] - stubDir[2] * (FOOT_STUB_LEN_MM * 0.35)
        ];
      } else {
        heel = ankle;
        toe = [ankle[0], ankle[1], ankle[2] + FOOT_STUB_LEN_MM * 0.5];
      }
    }

    if (!heel && toe) heel = toe;
    if (!toe && heel) toe = heel;

    if (!heel || !toe) return null;

    var gy = Math.min(heel[1], toe[1]);
    var center = [(heel[0] + toe[0]) * 0.5, gy, (heel[2] + toe[2]) * 0.5];
    var dx = toe[0] - heel[0], dy = toe[1] - heel[1], dz = toe[2] - heel[2];
    var length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return {
      side: side,
      which: which,
      heel: heel,
      toe: toe,
      ankle: ankle,
      center: center,
      groundContact: [center[0], gy, center[2]],
      length: length
    };
  }

  function footStubDirection(frame, cfg, which, ankle, knee) {
    var fwd = [0, 0, 1];
    if (isVec3(frame.pelvis_o) && isVec3(frame.neck)) {
      var fx = frame.neck[0] - frame.pelvis_o[0];
      var fz = frame.neck[2] - frame.pelvis_o[2];
      var fl = Math.sqrt(fx * fx + fz * fz);
      if (fl > 1e-3) fwd = [fx / fl, 0, fz / fl];
    }
    if (knee && ankle) {
      var kdx = ankle[0] - knee[0], kdz = ankle[2] - knee[2];
      var kl = Math.sqrt(kdx * kdx + kdz * kdz);
      if (kl > 5) {
        var shank = [kdx / kl, 0, kdz / kl];
        return [shank[0] * 0.55 + fwd[0] * 0.45, 0, shank[2] * 0.55 + fwd[2] * 0.45];
      }
    }
    return fwd;
  }

  /**
   * GRF arrow anchor — COP first, else foot ground centre (never COM/pelvis/screen centre).
   */
  function grfAnchor(trial, frameIdx, which, cfg) {
    if (!trial || frameIdx == null) return null;
    var fr = trial.frames && trial.frames[frameIdx];
    if (!fr) return null;
    cfg = cfg || {};
    var prefix = which === 'lead' ? 'FP2' : 'FP1';
    var seg = footSegment(fr, cfg, which);
    var footGround = seg ? seg.groundContact : null;

    var f = leadGrfForceMag(trial, frameIdx, prefix);
    if (which === 'lead' && footGround && footGround[1] > GRF_FOOT_GROUND_TOL_MM && f >= 30) {
      return null;
    }

    var cop = copFromTrial(trial, frameIdx, prefix);
    if (cop) {
      if (footGround) {
        var dx = cop[0] - footGround[0], dz = cop[2] - footGround[2];
        if (dx * dx + dz * dz <= GRF_COP_MAX_DIST_MM * GRF_COP_MAX_DIST_MM) {
          return [cop[0], footGround[1], cop[2]];
        }
      }
      return cop;
    }

    if (seg) {
      if (seg.heel && seg.toe && seg.ankle) {
        return [
          (seg.heel[0] + seg.toe[0] + seg.ankle[0]) / 3,
          seg.groundContact[1],
          (seg.heel[2] + seg.toe[2] + seg.ankle[2]) / 3
        ];
      }
      return seg.groundContact;
    }
    return null;
  }

  function leadGrfForceMag(trial, frameIdx, prefix) {
    prefix = prefix || 'FP2';
    var meta = metaFromTrial(trial);
    var s = trial.series || {};
    var fx = s[prefix + '_' + meta.haxes[0]] && s[prefix + '_' + meta.haxes[0]][frameIdx];
    var fy = s[prefix + '_' + meta.haxes[1]] && s[prefix + '_' + meta.haxes[1]][frameIdx];
    var fz = s[prefix + '_' + meta.axUp] && s[prefix + '_' + meta.axUp][frameIdx];
    if (!isFinite(fx) || !isFinite(fy) || !isFinite(fz)) return 0;
    return Math.sqrt(fx * fx + fy * fy + fz * fz);
  }

  function grfForceComponents(trial, frameIdx, prefix) {
    prefix = prefix || 'FP2';
    var meta = metaFromTrial(trial);
    var s = trial.series || {};
    var fx = s[prefix + '_' + meta.haxes[0]] && s[prefix + '_' + meta.haxes[0]][frameIdx];
    var fy = s[prefix + '_' + meta.haxes[1]] && s[prefix + '_' + meta.haxes[1]][frameIdx];
    var fz = s[prefix + '_' + meta.axUp] && s[prefix + '_' + meta.axUp][frameIdx];
    if (!isFinite(fx) || !isFinite(fy) || !isFinite(fz)) return null;
    return { fx: fx, fy: fy, fz: fz, mag: Math.sqrt(fx * fx + fy * fy + fz * fz) };
  }

  /** Force direction in viewer mm axes (same as legacy stick3D _drawGRF) */
  function forceToViewerDir(fx, fy, fz) {
    var dx = -fx;
    var dy = Math.max(0, fz);
    var dz = fy;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) return null;
    return [dx / len, dy / len, dz / len];
  }

  function grfArrowEnd(anchor, dirUnit, lengthMm) {
    if (!anchor || !dirUnit || !isFinite(lengthMm)) return null;
    return [
      anchor[0] + dirUnit[0] * lengthMm,
      anchor[1] + dirUnit[1] * lengthMm,
      anchor[2] + dirUnit[2] * lengthMm
    ];
  }

  function bboxFromLandmarks(frame, keys) {
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    (keys || []).forEach(function (k) {
      var p = framePoint(frame, k);
      if (!p) return;
      if (p[0] < xMin) xMin = p[0]; if (p[0] > xMax) xMax = p[0];
      if (p[1] < yMin) yMin = p[1]; if (p[1] > yMax) yMax = p[1];
      if (p[2] < zMin) zMin = p[2]; if (p[2] > zMax) zMax = p[2];
    });
    if (!isFinite(xMin)) return null;
    return { xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax, zMin: zMin, zMax: zMax,
      cx: (xMin + xMax) / 2, cy: (yMin + yMax) / 2, cz: (zMin + zMax) / 2 };
  }

  function dist3(a, b) {
    if (!a || !b) return Infinity;
    var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function setFrameIndices(skeletonIdx, comIdx, grfIdx) {
    _skeletonFrameIdx = skeletonIdx;
    _comFrameIdx = comIdx;
    _grfFrameIdx = grfIdx;
    if (skeletonIdx != null && comIdx != null && skeletonIdx !== comIdx) {
      console.warn('[StickViewCoords] skeletonFrameIndex (' + skeletonIdx + ') != comFrameIndex (' + comIdx + ')');
    }
    if (skeletonIdx != null && grfIdx != null && skeletonIdx !== grfIdx) {
      console.warn('[StickViewCoords] skeletonFrameIndex (' + skeletonIdx + ') != grfFrameIndex (' + grfIdx + ')');
    }
  }

  function getFrameIndices() {
    return { skeleton: _skeletonFrameIdx, com: _comFrameIdx, grf: _grfFrameIdx };
  }

  function sanityCheck(ctx) {
    ctx = ctx || {};
    if (!ctx.devMode && typeof window !== 'undefined' && window.location && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
      return;
    }
    var frame = ctx.frame;
    var cfg = ctx.cfg || {};
    if (!frame) return;

    var lmKeys = ['pelvis_o', 'neck', 'head', 'l_hip', 'r_hip', 'l_knee', 'r_knee',
      cfg.legLead + '_heel', cfg.legLead + '_toe', cfg.legRear + '_heel', cfg.legRear + '_toe'];
    lmKeys.forEach(function (k) {
      var raw = frame[k];
      if (raw && raw.some(function (v) { return !isFinite(v); })) {
        console.warn('[StickViewCoords] NaN joint:', k, 'frame', ctx.frameIdx);
      }
    });

    ['lead', 'rear'].forEach(function (w) {
      var seg = footSegment(frame, cfg, w);
      if (!seg) return;
      if (!isFinite(seg.length) || seg.length < 0.5) {
        console.warn('[StickViewCoords] foot segment length invalid:', w, seg.length, 'frame', ctx.frameIdx);
      }
    });

    var bb = bboxFromLandmarks(frame, lmKeys);
    var com = comFromFrame(frame);
    if (bb && com && dist3(com, [bb.cx, bb.cy, bb.cz]) > SANITY_COM_DIST_MM) {
      console.warn('[StickViewCoords] COM far from skeleton bbox — transform suspect, frame', ctx.frameIdx);
    }

    if (ctx.grfAnchor && ctx.leadFootGround) {
      if (dist3(ctx.grfAnchor, ctx.leadFootGround) > SANITY_GRF_FOOT_DIST_MM) {
        console.warn('[StickViewCoords] GRF anchor far from lead foot, frame', ctx.frameIdx);
      }
    }
  }

  function setDebugOverlay(on) { DEBUG_OVERLAY = !!on; }
  function getDebugOverlay() { return DEBUG_OVERLAY; }

  return {
    DEBUG_OVERLAY: DEBUG_OVERLAY,
    GRF_FOOT_GROUND_TOL_MM: GRF_FOOT_GROUND_TOL_MM,
    GRF_COP_MAX_DIST_MM: GRF_COP_MAX_DIST_MM,
    metaFromTrial: metaFromTrial,
    dataToScreen: dataToScreen,
    framePoint: framePoint,
    comFromFrame: comFromFrame,
    copFromTrial: copFromTrial,
    footSegment: footSegment,
    grfAnchor: grfAnchor,
    grfForceComponents: grfForceComponents,
    forceToViewerDir: forceToViewerDir,
    grfArrowEnd: grfArrowEnd,
    bboxFromLandmarks: bboxFromLandmarks,
    setFrameIndices: setFrameIndices,
    getFrameIndices: getFrameIndices,
    sanityCheck: sanityCheck,
    setDebugOverlay: setDebugOverlay,
    getDebugOverlay: getDebugOverlay
  };
});
