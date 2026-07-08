/**
 * DEPRECATED / ARCHIVED (production bundle excludes this module):
 * Rig driver for Skeleton β / Anatomical Legacy PoC only.
 * Production viewer is Stick-only.
 *
 * rig_driver.js — Theia landmark → anatomical bone pose (PoC only)
 * stick3D.positionBone math 동일 · 계산 파이프 변경 없음
 * Node + browser dual export
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RigDriver = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MARKER_NAMES = [
    'pelvis_o', 'neck', 'head', 'l_shoulder', 'r_shoulder',
    'l_elbow', 'r_elbow', 'l_wrist', 'r_wrist', 'l_hip', 'r_hip',
    'l_knee', 'r_knee', 'l_heel', 'r_heel', 'l_toe', 'r_toe',
    'l_hand_tip', 'r_hand_tip'
  ];

  const COLOR = {
    THROW: 0xff5a3c, GLOVE: 0xa855f7, SPINE: 0xff3ce0,
    LEAD: 0x5bd3ff, REAR: 0xffc24d, WHITE: 0xe8ecf2
  };

  /** Anatomical Skeleton beta — 골반·몸통·머리 색상 명확 분리 */
  const ANATOMICAL_COLORS = {
    PELVIS: 0xd9782a,
    TORSO: 0x3d9ee0,
    HEAD: 0xfff5eb,
    THROW: COLOR.THROW,
    GLOVE: COLOR.GLOVE,
    LEAD: COLOR.LEAD,
    REAR: COLOR.REAR
  };

  const Y_UP = { x: 0, y: 1, z: 0 };

  function handednessConfig(handedness) {
    const hand = String(handedness || 'R').toUpperCase();
    const RHP = hand !== 'L';
    return {
      handedness: hand,
      RHP,
      armThrow: RHP ? 'r' : 'l',
      armGlove: RHP ? 'l' : 'r',
      legLead: RHP ? 'l' : 'r',
      legRear: RHP ? 'r' : 'l'
    };
  }

  function isVec3(v) {
    return v && v.length >= 3 && v.every(function (x) { return isFinite(x); });
  }

  function v3(a) { return { x: a[0], y: a[1], z: a[2] }; }
  function arr3(v) { return [v.x, v.y, v.z]; }

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function scale(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
  function len(v) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
  function norm(v) {
    const l = len(v);
    if (l < 1e-6) return { x: 0, y: 1, z: 0 };
    return scale(v, 1 / l);
  }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
  function lerp3(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  }

  /** stick3D.positionBone 동일: Y축 → bone direction quaternion */
  function quatFromYToDir(dir) {
    const d = norm(dir);
    const ux = Y_UP.x, uy = Y_UP.y, uz = Y_UP.z;
    const dx = d.x, dy = d.y, dz = d.z;
    const c = ux * dx + uy * dy + uz * dz;
    if (c > 0.999999) return { x: 0, y: 0, z: 0, w: 1 };
    if (c < -0.999999) return { x: 1, y: 0, z: 0, w: 0 };
    const ax = uy * dz - uz * dy;
    const ay = uz * dx - ux * dz;
    const az = ux * dy - uy * dx;
    const s = Math.sqrt((1 + c) * 2);
    const inv = 1 / s;
    return { x: ax * inv, y: ay * inv, z: az * inv, w: s * 0.5 };
  }

  function virtualAnkle(knee, heel) {
    if (!isVec3(knee) || !isVec3(heel)) return null;
    return lerp3(knee, heel, 0.85);
  }

  function bonePose(p1, p2) {
    if (!isVec3(p1) || !isVec3(p2)) return null;
    const a = v3(p1), b = v3(p2);
    const d = sub(b, a);
    const L = len(d);
    if (L < 0.5) return null;
    const mid = add(a, scale(d, 0.5));
    return {
      start: p1,
      end: p2,
      position: arr3(mid),
      direction: arr3(norm(d)),
      length: L,
      quaternion: quatFromYToDir(d)
    };
  }

  /** 발 박스 — heel→toe 3D 중점(정강이 접합) · groundContact는 접지면 유지 */
  function footGroundPose(heel, toe, footHalfThick) {
    if (!isVec3(heel) || !isVec3(toe)) return null;
    footHalfThick = footHalfThick == null ? 7 : footHalfThick;
    const d = [toe[0] - heel[0], toe[1] - heel[1], toe[2] - heel[2]];
    const L = len(d);
    if (L < 0.5) return null;
    const mid = [(heel[0] + toe[0]) * 0.5, (heel[1] + toe[1]) * 0.5, (heel[2] + toe[2]) * 0.5];
    const gy = Math.min(heel[1], toe[1]);
    return {
      start: heel,
      end: toe,
      position: mid,
      groundContact: [(heel[0] + toe[0]) * 0.5, gy, (heel[2] + toe[2]) * 0.5],
      direction: arr3(norm(d)),
      length: L,
      quaternion: quatFromYToDir(d)
    };
  }

  function grfFootGroundPos(frame, cfg, which) {
    if (!frame || !cfg) return null;
    const side = which === 'lead' ? cfg.legLead : cfg.legRear;
    if (!side) return null;
    const heel = frame[side + '_heel'];
    const toe = frame[side + '_toe'];
    const pose = footGroundPose(heel, toe, 7);
    return pose ? pose.groundContact : null;
  }

  function stickBoneDefs(cfg) {
    const t = cfg.armThrow, g = cfg.armGlove, ll = cfg.legLead, lr = cfg.legRear;
    return [
      { id: 'spine', from: 'pelvis_o', to: 'neck', color: COLOR.SPINE, radius: 16 },
      { id: 'head', from: 'neck', to: 'head', color: COLOR.SPINE, radius: 11 },
      { id: 'neck_throw', from: 'neck', to: t + '_shoulder', color: COLOR.SPINE, radius: 11 },
      { id: 'neck_glove', from: 'neck', to: g + '_shoulder', color: COLOR.SPINE, radius: 11 },
      { id: 'humerus_throw', from: t + '_shoulder', to: t + '_elbow', color: COLOR.THROW, radius: 13 },
      { id: 'forearm_throw', from: t + '_elbow', to: t + '_wrist', color: COLOR.THROW, radius: 11 },
      { id: 'hand_throw', from: t + '_wrist', to: t + '_hand_tip', color: COLOR.THROW, radius: 8 },
      { id: 'humerus_glove', from: g + '_shoulder', to: g + '_elbow', color: COLOR.GLOVE, radius: 13 },
      { id: 'forearm_glove', from: g + '_elbow', to: g + '_wrist', color: COLOR.GLOVE, radius: 11 },
      { id: 'hand_glove', from: g + '_wrist', to: g + '_hand_tip', color: COLOR.GLOVE, radius: 8 },
      { id: 'hip_lead', from: 'pelvis_o', to: ll + '_hip', color: COLOR.SPINE, radius: 12 },
      { id: 'hip_rear', from: 'pelvis_o', to: lr + '_hip', color: COLOR.SPINE, radius: 12 },
      { id: 'thigh_lead', from: ll + '_hip', to: ll + '_knee', color: COLOR.LEAD, radius: 15 },
      { id: 'shank_lead', from: ll + '_knee', to: ll + '_heel', color: COLOR.LEAD, radius: 13 },
      { id: 'foot_lead', from: ll + '_heel', to: ll + '_toe', color: COLOR.LEAD, radius: 9 },
      { id: 'thigh_rear', from: lr + '_hip', to: lr + '_knee', color: COLOR.REAR, radius: 15 },
      { id: 'shank_rear', from: lr + '_knee', to: lr + '_heel', color: COLOR.REAR, radius: 13 },
      { id: 'foot_rear', from: lr + '_heel', to: lr + '_toe', color: COLOR.REAR, radius: 9 }
    ];
  }

  /**
   * Simple Body — 코치용 간소화 인체 (PoC)
   * 골반 ring · 흉곽 ellipsoid · 척추축 · 골반/어깨선 · 얇은 limb capsule
   */
  function simpleBodyBoneDefs(cfg) {
    const t = cfg.armThrow, g = cfg.armGlove, ll = cfg.legLead, lr = cfg.legRear;
    return [
      { id: 'pelvis_ring', kind: 'ring', from: 'l_hip', to: 'r_hip', color: 0xe8954e, radius: 100, tube: 8, role: 'pelvis' },
      { id: 'rib_cage', kind: 'ellipsoid', from: 'virtual_thorax', to: 'virtual_thorax', color: 0x5bb6e6, rx: 155, ry: 118, rz: 82, opacity: 0.28, role: 'thorax' },
      { id: 'spine_axis', kind: 'bar', from: 'pelvis_o', to: 'virtual_thorax', color: 0xff3ce0, radius: 5, role: 'spine' },
      { id: 'neck_seg', kind: 'capsule', from: 'neck', to: 'head', color: COLOR.SPINE, radius: 18, role: 'neck' },
      { id: 'clavicle_throw', kind: 'capsule', from: 'neck', to: t + '_shoulder', color: COLOR.SPINE, radius: 8, role: 'clavicle' },
      { id: 'clavicle_glove', kind: 'capsule', from: 'neck', to: g + '_shoulder', color: COLOR.SPINE, radius: 8, role: 'clavicle' },
      { id: 'humerus_throw', kind: 'capsule', from: t + '_shoulder', to: t + '_elbow', color: COLOR.THROW, radius: 20, role: 'upper_arm' },
      { id: 'forearm_throw', kind: 'capsule', from: t + '_elbow', to: t + '_wrist', color: COLOR.THROW, radius: 15, role: 'forearm' },
      { id: 'hand_throw', kind: 'capsule', from: t + '_wrist', to: t + '_hand_tip', color: COLOR.THROW, radius: 10, role: 'hand' },
      { id: 'humerus_glove', kind: 'capsule', from: g + '_shoulder', to: g + '_elbow', color: COLOR.GLOVE, radius: 20, role: 'upper_arm' },
      { id: 'forearm_glove', kind: 'capsule', from: g + '_elbow', to: g + '_wrist', color: COLOR.GLOVE, radius: 15, role: 'forearm' },
      { id: 'hand_glove', kind: 'capsule', from: g + '_wrist', to: g + '_hand_tip', color: COLOR.GLOVE, radius: 10, role: 'hand' },
      { id: 'thigh_lead', kind: 'capsule', from: ll + '_hip', to: ll + '_knee', color: COLOR.LEAD, radius: 22, role: 'thigh' },
      { id: 'shank_lead', kind: 'capsule', from: ll + '_knee', to: ll + '_heel', color: COLOR.LEAD, radius: 17, role: 'shank' },
      { id: 'foot_lead', kind: 'capsule', from: ll + '_heel', to: ll + '_toe', color: COLOR.LEAD, radius: 9, role: 'foot' },
      { id: 'thigh_rear', kind: 'capsule', from: lr + '_hip', to: lr + '_knee', color: COLOR.REAR, radius: 22, role: 'thigh' },
      { id: 'shank_rear', kind: 'capsule', from: lr + '_knee', to: lr + '_heel', color: COLOR.REAR, radius: 17, role: 'shank' },
      { id: 'foot_rear', kind: 'capsule', from: lr + '_heel', to: lr + '_toe', color: COLOR.REAR, radius: 9, role: 'foot' }
    ];
  }

  /** Anatomical legacy (09ed131) — box torso/pelvis · knee→heel shank · heel→toe foot */
  function anatomicalLegacyBoneDefs(cfg) {
    const t = cfg.armThrow, g = cfg.armGlove, ll = cfg.legLead, lr = cfg.legRear;
    const A = ANATOMICAL_COLORS;
    return [
      { id: 'pelvis_block', kind: 'box', from: 'pelvis_o', to: 'pelvis_o', color: A.PELVIS, width: 210, height: 82, depth: 132, role: 'pelvis' },
      { id: 'rib_cage', kind: 'box', from: 'virtual_lumbar', to: 'virtual_thorax_top', color: A.TORSO, width: 208, height: 58, depth: 102, role: 'thorax' },
      { id: 'head', kind: 'sphere', from: 'head', to: 'head', color: A.HEAD, radius: 52, role: 'head' },
      { id: 'humerus_L', kind: 'capsule', from: 'l_shoulder', to: 'l_elbow', color: t === 'l' ? A.THROW : A.GLOVE, radius: 30, role: 'upper_arm' },
      { id: 'humerus_R', kind: 'capsule', from: 'r_shoulder', to: 'r_elbow', color: t === 'r' ? A.THROW : A.GLOVE, radius: 30, role: 'upper_arm' },
      { id: 'forearm_L', kind: 'capsule', from: 'l_elbow', to: 'l_wrist', color: t === 'l' ? A.THROW : A.GLOVE, radius: 22, role: 'forearm' },
      { id: 'forearm_R', kind: 'capsule', from: 'r_elbow', to: 'r_wrist', color: t === 'r' ? A.THROW : A.GLOVE, radius: 22, role: 'forearm' },
      { id: 'hand_L', kind: 'capsule', from: 'l_wrist', to: 'l_hand_tip', color: t === 'l' ? A.THROW : A.GLOVE, radius: 14, role: 'hand' },
      { id: 'hand_R', kind: 'capsule', from: 'r_wrist', to: 'r_hand_tip', color: t === 'r' ? A.THROW : A.GLOVE, radius: 14, role: 'hand' },
      { id: 'thigh_L', kind: 'capsule', from: 'l_hip', to: 'l_knee', color: ll === 'l' ? A.LEAD : A.REAR, radius: 36, role: 'thigh' },
      { id: 'thigh_R', kind: 'capsule', from: 'r_hip', to: 'r_knee', color: ll === 'r' ? A.LEAD : A.REAR, radius: 36, role: 'thigh' },
      { id: 'shank_L', kind: 'capsule', from: 'l_knee', to: 'l_heel', color: ll === 'l' ? A.LEAD : A.REAR, radius: 26, role: 'shank' },
      { id: 'shank_R', kind: 'capsule', from: 'r_knee', to: 'r_heel', color: ll === 'r' ? A.LEAD : A.REAR, radius: 26, role: 'shank' },
      { id: 'foot_L', kind: 'foot', from: 'l_heel', to: 'l_toe', color: ll === 'l' ? A.LEAD : A.REAR, width: 90, depth: 220, role: 'foot' },
      { id: 'foot_R', kind: 'foot', from: 'r_heel', to: 'r_toe', color: ll === 'r' ? A.LEAD : A.REAR, width: 90, depth: 220, role: 'foot' }
    ];
  }

  /** Anatomical beta — joint-anchored segments (endpoint = landmark A→B) */
  function anatomicalBoneDefs(cfg) {
    const t = cfg.armThrow, g = cfg.armGlove, ll = cfg.legLead, lr = cfg.legRear;
    const A = ANATOMICAL_COLORS;
    return [
      { id: 'pelvis_plate', kind: 'capsule', from: 'l_hip', to: 'r_hip', color: A.PELVIS, radius: 14, role: 'pelvis' },
      { id: 'torso_seg', kind: 'capsule', from: 'virtual_hip_mid', to: 'virtual_shoulder_mid', color: A.TORSO, radius: 32, role: 'torso' },
      { id: 'neck_seg', kind: 'capsule', from: 'virtual_shoulder_mid', to: 'virtual_head_bottom', color: A.HEAD, radius: 14, role: 'neck' },
      { id: 'head', kind: 'joint_sphere', from: 'head', to: 'head', color: A.HEAD, radius: 44, role: 'head' },
      { id: 'humerus_L', kind: 'capsule', from: 'l_shoulder', to: 'l_elbow', color: t === 'l' ? A.THROW : A.GLOVE, radius: 28, role: 'upper_arm' },
      { id: 'humerus_R', kind: 'capsule', from: 'r_shoulder', to: 'r_elbow', color: t === 'r' ? A.THROW : A.GLOVE, radius: 28, role: 'upper_arm' },
      { id: 'forearm_L', kind: 'capsule', from: 'l_elbow', to: 'l_wrist', color: t === 'l' ? A.THROW : A.GLOVE, radius: 20, role: 'forearm' },
      { id: 'forearm_R', kind: 'capsule', from: 'r_elbow', to: 'r_wrist', color: t === 'r' ? A.THROW : A.GLOVE, radius: 20, role: 'forearm' },
      { id: 'hand_L', kind: 'capsule', from: 'l_wrist', to: 'l_hand_tip', color: t === 'l' ? A.THROW : A.GLOVE, radius: 12, role: 'hand' },
      { id: 'hand_R', kind: 'capsule', from: 'r_wrist', to: 'r_hand_tip', color: t === 'r' ? A.THROW : A.GLOVE, radius: 12, role: 'hand' },
      { id: 'thigh_L', kind: 'capsule', from: 'l_hip', to: 'l_knee', color: ll === 'l' ? A.LEAD : A.REAR, radius: 32, role: 'thigh' },
      { id: 'thigh_R', kind: 'capsule', from: 'r_hip', to: 'r_knee', color: ll === 'r' ? A.LEAD : A.REAR, radius: 32, role: 'thigh' },
      { id: 'shank_L', kind: 'capsule', from: 'l_knee', to: 'virtual_ankle_l', color: ll === 'l' ? A.LEAD : A.REAR, radius: 22, role: 'shank' },
      { id: 'shank_R', kind: 'capsule', from: 'r_knee', to: 'virtual_ankle_r', color: ll === 'r' ? A.LEAD : A.REAR, radius: 22, role: 'shank' },
      { id: 'foot_L', kind: 'foot', from: 'virtual_ankle_l', to: 'l_toe', color: ll === 'l' ? A.LEAD : A.REAR, width: 88, depth: 210, role: 'foot' },
      { id: 'foot_R', kind: 'foot', from: 'virtual_ankle_r', to: 'r_toe', color: ll === 'r' ? A.LEAD : A.REAR, width: 88, depth: 210, role: 'foot' }
    ];
  }

  function resolveFrame(frame) {
    const out = Object.assign({}, frame);
    if (isVec3(frame.l_hip) && isVec3(frame.r_hip)) {
      out.virtual_hip_mid = lerp3(frame.l_hip, frame.r_hip, 0.5);
    } else if (isVec3(frame.pelvis_o)) {
      out.virtual_hip_mid = frame.pelvis_o.slice();
    }
    if (isVec3(frame.l_shoulder) && isVec3(frame.r_shoulder)) {
      out.virtual_shoulder_mid = lerp3(frame.l_shoulder, frame.r_shoulder, 0.5);
    } else if (isVec3(frame.neck)) {
      out.virtual_shoulder_mid = frame.neck.slice();
    }
    if (isVec3(frame.pelvis_o) && isVec3(frame.neck)) {
      out.virtual_lumbar = lerp3(frame.pelvis_o, frame.neck, 0.35);
      out.virtual_thorax = lerp3(frame.pelvis_o, frame.neck, 0.62);
      out.virtual_thorax_top = lerp3(frame.pelvis_o, frame.neck, 0.68);
    }
    if (isVec3(frame.neck) && isVec3(frame.head)) {
      out.virtual_head_attach = lerp3(frame.neck, frame.head, 0.86);
      out.virtual_head_bottom = lerp3(frame.neck, frame.head, 0.82);
    }
    out.virtual_ankle_l = virtualAnkle(frame.l_knee, frame.l_heel);
    out.virtual_ankle_r = virtualAnkle(frame.r_knee, frame.r_heel);
    return out;
  }

  function computePoses(frame, cfg, mode) {
    const fr = resolveFrame(frame);
    var defs = stickBoneDefs(cfg);
    if (mode === 'anatomical') defs = anatomicalBoneDefs(cfg);
    else if (mode === 'anatomical-legacy') defs = anatomicalLegacyBoneDefs(cfg);
    else if (mode === 'simpleBody') defs = simpleBodyBoneDefs(cfg);
    const poses = {};
    defs.forEach(function (def) {
      const p1 = fr[def.from];
      let p2 = fr[def.to];
      if (def.kind === 'ellipsoid') {
        if (!isVec3(p1)) return;
        poses[def.id] = Object.assign({}, def, { position: p1, kind: 'ellipsoid' });
        return;
      }
      if (def.kind === 'box' && def.id === 'pelvis_block') {
        p2 = p1;
      }
      if (def.kind === 'foot') {
        const fpose = footGroundPose(p1, p2, 7);
        if (fpose) poses[def.id] = Object.assign({}, def, fpose);
        return;
      }
      if (def.kind === 'sphere' && def.role === 'head' && isVec3(fr.head)) {
        poses[def.id] = Object.assign({}, def, { position: fr.head, kind: 'head_sphere', fixedScale: true });
        return;
      }
      if (def.kind === 'joint_sphere' && isVec3(fr[def.from])) {
        poses[def.id] = Object.assign({}, def, { position: fr[def.from], kind: 'joint_sphere', fixedScale: true });
        return;
      }
      const pose = bonePose(p1, p2);
      if (pose) poses[def.id] = Object.assign({}, def, pose);
    });
    return poses;
  }

  function lmColor(name, cfg) {
    if (['pelvis_o', 'neck', 'head'].includes(name)) return COLOR.SPINE;
    const isArmJ = /shoulder|elbow|wrist|hand_tip/.test(name);
    const isLegJ = /hip|knee|heel|toe/.test(name);
    if (isArmJ && name[0] === cfg.armThrow) return COLOR.THROW;
    if (isArmJ && name[0] === cfg.armGlove) return COLOR.GLOVE;
    if (isLegJ && name[0] === cfg.legLead) return COLOR.LEAD;
    if (isLegJ && name[0] === cfg.legRear) return COLOR.REAR;
    return COLOR.WHITE;
  }

  /** G1: quaternion dot-product flip count between consecutive frames */
  function quatDot(a, b) {
    return Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  }

  function countQuatFlips(frames, cfg, boneId) {
    let flips = 0;
    let prev = null;
    for (let i = 0; i < frames.length; i++) {
      const poses = computePoses(frames[i], cfg, 'anatomical');
      const q = poses[boneId] && poses[boneId].quaternion;
      if (!q) continue;
      if (prev && quatDot(prev, q) < 0.2) flips++;
      prev = q;
    }
    return flips;
  }

  /** G4: landmark RMSE between stick endpoints and anatomical bone ends */
  function landmarkRMSE(frame, cfg) {
    const fr = resolveFrame(frame);
    let sum = 0, n = 0;
    const stick = computePoses(frame, cfg, 'stick');
    const ana = computePoses(frame, cfg, 'anatomical');
    const checkPairs = [
      ['spine', 'pelvis_o', 'neck'],
      ['humerus_throw', cfg.armThrow + '_shoulder', cfg.armThrow + '_elbow'],
      ['thigh_lead', cfg.legLead + '_hip', cfg.legLead + '_knee']
    ];
    checkPairs.forEach(function (pair) {
      const bone = stick[pair[0]] || ana[pair[0]];
      if (!bone || !isVec3(fr[pair[1]]) || !isVec3(fr[pair[2]])) return;
      [['start', fr[pair[1]]], ['end', fr[pair[2]]]].forEach(function (pt) {
        const a = v3(pt[1]), b = v3(bone[pt[0]]);
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        sum += dx * dx + dy * dy + dz * dz;
        n++;
      });
    });
    return n ? Math.sqrt(sum / n) : Infinity;
  }

  /** G2: handedness — throw arm color on correct side (no world mirror) */
  function validateHandednessColors(cfg) {
    const ana = anatomicalBoneDefs(cfg);
    const throwH = ana.find(function (b) { return b.id === 'humerus_' + (cfg.armThrow === 'r' ? 'R' : 'L'); });
    const gloveH = ana.find(function (b) { return b.id === 'humerus_' + (cfg.armGlove === 'r' ? 'R' : 'L'); });
    if (!throwH || !gloveH) return false;
    return throwH.color === COLOR.THROW && gloveH.color === COLOR.GLOVE;
  }

  /** G3 proxy: humerus–forearm plane angle stability vs stick (same landmarks) */
  function armPlaneAngleDeg(frame, side) {
    const s = side === 'l' ? 'l' : 'r';
    const sh = frame[s + '_shoulder'], el = frame[s + '_elbow'], wr = frame[s + '_wrist'];
    if (!isVec3(sh) || !isVec3(el) || !isVec3(wr)) return null;
    const u = norm(sub(v3(el), v3(sh)));
    const v = norm(sub(v3(wr), v3(el)));
    const c = Math.max(-1, Math.min(1, dot(u, v)));
    return Math.acos(c) * 180 / Math.PI;
  }

  function hipShoulderSeparationDeg(frame) {
    function hang(p, q) {
      if (!isVec3(p) || !isVec3(q)) return NaN;
      return Math.atan2(q[2] - p[2], q[0] - p[0]) * 180 / Math.PI;
    }
    const hip = hang(frame.l_hip, frame.r_hip);
    const sho = hang(frame.l_shoulder, frame.r_shoulder);
    if (!isFinite(hip) || !isFinite(sho)) return null;
    let d = sho - hip;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return Math.abs(d);
  }

  /** Joint anchoring audit — pose endpoints vs landmark joints (render-only) */
  function auditSegmentAnchoring(frame, cfg, opts) {
    opts = opts || {};
    var tol = opts.toleranceMm != null ? opts.toleranceMm : 12;
    var warn = opts.warn !== false;
    var mode = opts.mode || 'anatomical';
    var fr = resolveFrame(frame);
    var poses = computePoses(frame, cfg, mode);
    var defs = mode === 'anatomical-legacy' ? anatomicalLegacyBoneDefs(cfg) : anatomicalBoneDefs(cfg);
    var detached = [];
    var maxErr = 0;

    function dist3(a, b) {
      if (!isVec3(a) || !isVec3(b)) return Infinity;
      var dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function checkSeg(name, jointA, jointB, pose, limit) {
      if (!pose || !isVec3(jointA) || !isVec3(jointB)) return;
      var lim = limit != null ? limit : tol;
      var errA = dist3(pose.start, jointA);
      var errB = dist3(pose.end, jointB);
      maxErr = Math.max(maxErr, errA, errB);
      if (errA > lim || errB > lim) {
        var row = { segment: name, errStartMm: errA, errEndMm: errB, limitMm: lim };
        detached.push(row);
        if (warn && typeof console !== 'undefined' && console.warn) {
          console.warn('Skeleton β anchor FAIL · ' + name + ' · start=' + errA.toFixed(1) + ' end=' + errB.toFixed(1) + 'mm');
        }
      }
    }

    defs.forEach(function (def) {
      var pose = poses[def.id];
      if (!pose && !(def.kind === 'box' && def.role === 'pelvis')) return;
      if (def.kind === 'capsule') {
        checkSeg(def.id, fr[def.from], fr[def.to], pose, tol + (def.radius || 12) * 0.15);
      } else if (def.kind === 'foot') {
        checkSeg(def.id, fr[def.from], fr[def.to], pose, tol + 10);
      } else if (def.kind === 'box' && def.role === 'thorax') {
        checkSeg(def.id, fr[def.from], fr[def.to], pose, tol + 14);
      } else if (def.kind === 'sphere' && def.role === 'head') {
        var hErr = dist3(pose.position, fr.head);
        maxErr = Math.max(maxErr, hErr);
        if (hErr > tol + (def.radius || 40) * 0.2) {
          detached.push({ segment: def.id, errCenterMm: hErr, limitMm: tol });
        }
      } else if (def.kind === 'joint_sphere') {
        var err = dist3(pose.position, fr[def.from]);
        maxErr = Math.max(maxErr, err);
        if (err > tol + (def.radius || 40) * 0.2) {
          detached.push({ segment: def.id, errCenterMm: err, limitMm: tol });
        }
      }
    });

    var pelvisPass = !detached.some(function (d) { return /pelvis/.test(d.segment); });
    var torsoPass = !detached.some(function (d) { return /torso/.test(d.segment); });
    var footPass = !detached.some(function (d) { return /foot/.test(d.segment); });

    var passKey = mode === 'anatomical-legacy' ? 'anatomicalLegacyAnchoringPass' : 'skeletonBetaAnchoringPass';
    var out = {
      detachedSegmentCount: detached.length,
      detachedSegments: detached,
      maxAnchorError: maxErr,
      torsoAnchoringPass: torsoPass,
      pelvisAnchoringPass: pelvisPass,
      footAnchoringPass: footPass,
      toleranceMm: tol,
      rendererMode: mode,
      skeletonBetaAnchoringPass: mode === 'anatomical' ? detached.length === 0 : null,
      anatomicalLegacyAnchoringPass: mode === 'anatomical-legacy' ? detached.length === 0 : null
    };
    out[passKey] = detached.length === 0;
    return out;
  }

  return {
    MARKER_NAMES,
    COLOR,
    ANATOMICAL_COLORS,
    handednessConfig,
    virtualAnkle,
    lerp3,
    quatFromYToDir,
    bonePose,
    footGroundPose,
    grfFootGroundPos,
    stickBoneDefs,
    simpleBodyBoneDefs,
    anatomicalBoneDefs,
    anatomicalLegacyBoneDefs,
    resolveFrame,
    computePoses,
    lmColor,
    countQuatFlips,
    landmarkRMSE,
    validateHandednessColors,
    armPlaneAngleDeg,
    hipShoulderSeparationDeg,
    auditSegmentAnchoring,
    isVec3
  };
});
