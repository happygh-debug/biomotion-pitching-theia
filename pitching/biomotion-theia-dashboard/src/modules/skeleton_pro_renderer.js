/**
 * DEPRECATED / ARCHIVED:
 * Skeleton β and Anatomical Legacy are removed from production UI.
 * Reason: unstable primitive anchoring and unreliable coach/player interpretation.
 * Production viewer is Stick-only.
 * Do not re-enable without full QA and explicit approval.
 *
 * skeleton_pro_renderer.js — Anatomical Skeleton beta
 * procedural 즉시 표시 · GLB async 로드 성공 시 전환 (PoC anatomical_skeleton_viewer)
 */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  var RD = root.RigDriver;
  var ASV = root.AnatomicalSkeletonViewer;
  if (!THREE || !RD) return;

  var capsuleGeoCache = {};
  var _gltfLoaderPromise = null;
  var PLACEHOLDER_GENERATOR = 'biomotion-poc-placeholder';
  var MIN_GLB_VISIBLE = 8;

  function anatomicalMeshPref() {
    try { return localStorage.getItem('bm_anatomical_mesh') || 'auto'; } catch (e) { return 'auto'; }
  }

  function isPlaceholderGlbPack(pack) {
    var gen = pack && pack.gltf && pack.gltf.asset && pack.gltf.asset.generator;
    return gen === PLACEHOLDER_GENERATOR;
  }

  /** joint-anchored procedural only until Skeleton β QA PASS */
  function shouldUseGlbPack(pack, isGlbFile, hasMesh, coverage) {
    return false;
  }

  function pageBase() {
    try {
      var p = location.pathname || '';
      var i = p.lastIndexOf('/');
      return i >= 0 ? p.slice(0, i + 1) : './';
    } catch (e) {
      return './';
    }
  }

  function ensureGLTFLoader() {
    if (THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
    if (_gltfLoaderPromise) return _gltfLoaderPromise;
    _gltfLoaderPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = pageBase() + 'lib/GLTFLoader.js';
      s.onload = function () {
        if (THREE.GLTFLoader) resolve(THREE.GLTFLoader);
        else reject(new Error('GLTFLoader missing after load'));
      };
      s.onerror = function () { reject(new Error('GLTFLoader script load failed')); };
      document.head.appendChild(s);
    });
    return _gltfLoaderPromise;
  }

  function mergeGeometries(geos) {
    var positions = [], normals = [], indices = [], offset = 0;
    geos.forEach(function (g) {
      g.computeVertexNormals();
      var pos = g.attributes.position;
      var norm = g.attributes.normal;
      var idx = g.index;
      var i;
      for (i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
      if (idx) {
        for (i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
      } else {
        for (i = 0; i < pos.count; i++) indices.push(offset + i);
      }
      offset += pos.count;
    });
    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setIndex(indices);
    return merged;
  }

  function makeCapsuleGeometry(radius, cylLen) {
    cylLen = cylLen || 1;
    var key = radius + ':' + cylLen;
    if (capsuleGeoCache[key]) return capsuleGeoCache[key].clone();
    var seg = 14;
    var cyl = new THREE.CylinderGeometry(radius, radius, cylLen, seg);
    var top = new THREE.SphereGeometry(radius, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    top.translate(0, cylLen / 2, 0);
    var bot = new THREE.SphereGeometry(radius, seg, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    bot.translate(0, -cylLen / 2, 0);
    var geo = mergeGeometries([cyl, top, bot]);
    capsuleGeoCache[key] = geo;
    return geo.clone();
  }

  /* ── Anatomical torso/pelvis axes · tapered trunk (render-only) ── */
  var DEBUG_TORSO_PELVIS = false;
  var FALLBACK_SHOULDER_W = 420;
  var FALLBACK_HIP_W = 280;
  var FALLBACK_TORSO_H = 520;
  var FRUSTUM_IDX = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0
  ];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale3(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function lerp3a(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function mid3(a, b) {
    if (!a) return b ? b.slice() : null;
    if (!b) return a.slice();
    return lerp3a(a, b, 0.5);
  }
  function len3(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
  function dist3(a, b) { return len3(sub3(a, b)); }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm3(v, fb) {
    var l = len3(v);
    if (l < 1e-6) return fb ? fb.slice() : [0, 1, 0];
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function orthoMl(ml, vert) {
    var d = dot3(ml, vert);
    return norm3([ml[0] - vert[0] * d, ml[1] - vert[1] * d, ml[2] - vert[2] * d], ml);
  }
  function cornerAt(center, ml, ap, mlS, apS) {
    return [
      center[0] + ml[0] * mlS + ap[0] * apS,
      center[1] + ml[1] * mlS + ap[1] * apS,
      center[2] + ml[2] * mlS + ap[2] * apS
    ];
  }
  function writeFrustumVerts(posArr, off, top, bot, ml, ap, tw, bw, td, bd) {
    var verts = [
      cornerAt(top, ml, ap, -tw, td), cornerAt(top, ml, ap, tw, td),
      cornerAt(top, ml, ap, tw, -td), cornerAt(top, ml, ap, -tw, -td),
      cornerAt(bot, ml, ap, -bw, bd), cornerAt(bot, ml, ap, bw, bd),
      cornerAt(bot, ml, ap, bw, -bd), cornerAt(bot, ml, ap, -bw, -bd)
    ];
    var i, j = off * 3;
    for (i = 0; i < 8; i++) { posArr[j++] = verts[i][0]; posArr[j++] = verts[i][1]; posArr[j++] = verts[i][2]; }
  }

  function computeAnatomicalAxes(fr, cfg, state) {
    var ls = fr.l_shoulder, rs = fr.r_shoulder, lh = fr.l_hip, rh = fr.r_hip;
    var pelvis = fr.pelvis_o, neck = fr.neck;
    var shoulderMid = mid3(ls, rs);
    if (!shoulderMid && RD.isVec3(neck)) shoulderMid = neck.slice();
    var hipMid = mid3(lh, rh);
    if (!hipMid && RD.isVec3(pelvis)) hipMid = pelvis.slice();

    var ml = null;
    if (RD.isVec3(ls) && RD.isVec3(rs)) ml = norm3(sub3(rs, ls));
    else if (RD.isVec3(lh) && RD.isVec3(rh)) ml = norm3(sub3(rh, lh));
    if (!ml || len3(ml) < 0.4) {
      ml = (state && state.ml) ? state.ml.slice() : [1, 0, 0];
      if (typeof console !== 'undefined') console.warn('Skeleton beta: ML axis fallback');
    }

    var vert = null;
    if (shoulderMid && hipMid) vert = norm3(sub3(shoulderMid, hipMid));
    else if (RD.isVec3(pelvis) && RD.isVec3(neck)) vert = norm3(sub3(neck, pelvis));
    if (!vert || len3(vert) < 0.4) {
      vert = (state && state.vert) ? state.vert.slice() : [0, 1, 0];
      if (typeof console !== 'undefined') console.warn('Skeleton beta: vertical axis fallback');
    }

    ml = orthoMl(ml, vert);
    var ap = cross3(vert, ml);
    if (len3(ap) < 0.15) {
      ap = cross3(ml, [0, 0, 1]);
      if (len3(ap) < 0.15) ap = cross3(ml, [0, 1, 0]);
      if (typeof console !== 'undefined') console.warn('Skeleton beta: AP axis unstable — fallback');
    }
    ap = norm3(ap);
    if (dot3(ap, [0, 0, 1]) < 0) ap = scale3(ap, -1);

    if (state) { state.ml = ml.slice(); state.vert = vert.slice(); state.ap = ap.slice(); }

    var shoulderWidth = (RD.isVec3(ls) && RD.isVec3(rs)) ? dist3(ls, rs) : FALLBACK_SHOULDER_W;
    var hipWidth = (RD.isVec3(lh) && RD.isVec3(rh)) ? dist3(lh, rh) : FALLBACK_HIP_W;
    var torsoHeight = (shoulderMid && hipMid) ? dist3(shoulderMid, hipMid) : FALLBACK_TORSO_H;
    if (torsoHeight < 80) torsoHeight = FALLBACK_TORSO_H;

    var topW = clamp(shoulderWidth * 0.96, hipWidth * 1.02, shoulderWidth * 1.05);
    var botW = clamp(hipWidth * 1.02, topW * 0.52, hipWidth * 1.12);
    if (topW <= botW) topW = botW * 1.12;

    var shRef = shoulderMid || hipMid || [0, 0, 0];
    var hpRef = hipMid || shoulderMid || shRef;
    var torsoTopCenter = lerp3a(shRef, hpRef, 0.05);
    var torsoBottomCenter = lerp3a(shRef, hpRef, 0.945);

    var pelvisH = clamp(torsoHeight * 0.21, 72, torsoHeight * 0.28);
    var gap = clamp(torsoHeight * 0.018, 4, torsoHeight * 0.04);
    var pelvisCenter = add3(torsoBottomCenter, scale3(vert, -(pelvisH * 0.5 + gap)));

    return {
      ml: ml, vert: vert, ap: ap,
      shoulderMid: shoulderMid, hipMid: hipMid, pelvisCenter: pelvisCenter,
      shoulderWidth: shoulderWidth, hipWidth: hipWidth, torsoHeight: torsoHeight,
      torsoTopCenter: torsoTopCenter, torsoBottomCenter: torsoBottomCenter,
      topWidth: topW, bottomWidth: botW,
      topDepth: clamp(topW * 0.30, 48, topW * 0.36),
      bottomDepth: clamp(botW * 0.32, 42, botW * 0.38),
      pelvisWidth: clamp(hipWidth * 1.06, botW * 0.92, hipWidth * 1.14),
      pelvisDepth: clamp(hipWidth * 0.30, 38, hipWidth * 0.40),
      pelvisHeight: pelvisH
    };
  }

  function makeFrustumMesh(def, role) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    geo.setIndex(FRUSTUM_IDX.slice());
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, roleMat({ color: def.color, role: role, opacity: def.opacity }));
    mesh.userData.kind = role === 'pelvis' ? 'pelvis_vol' : 'torso_tapered';
    mesh.userData.boxRole = role;
    mesh.renderOrder = role === 'pelvis' ? 4 : 5;
    return mesh;
  }

  function updateFrustumMesh(mesh, ax) {
    var pos = mesh.geometry.attributes.position.array;
    writeFrustumVerts(pos, 0, ax.torsoTopCenter, ax.torsoBottomCenter, ax.ml, ax.ap,
      ax.topWidth * 0.5, ax.bottomWidth * 0.5, ax.topDepth * 0.5, ax.bottomDepth * 0.5);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.position.set(0, 0, 0);
    mesh.quaternion.set(0, 0, 0, 1);
    mesh.scale.set(1, 1, 1);
    mesh.visible = true;
  }

  function updatePelvisFrustum(mesh, ax) {
    var pc = ax.pelvisCenter;
    var ml = ax.ml, ap = ax.ap, vert = ax.vert;
    var hw = ax.pelvisWidth * 0.5, hd = ax.pelvisDepth * 0.5, hh = ax.pelvisHeight * 0.5;
    var top = add3(pc, scale3(vert, hh));
    var bot = add3(pc, scale3(vert, -hh));
    var pos = mesh.geometry.attributes.position.array;
    writeFrustumVerts(pos, 0, top, bot, ml, ap, hw, hw, hd, hd);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.position.set(0, 0, 0);
    mesh.quaternion.set(0, 0, 0, 1);
    mesh.scale.set(1, 1, 1);
    mesh.visible = true;
  }

  function ensureDebugGroup(procGroup) {
    var g = procGroup.userData.torsoDebugGroup;
    if (g) return g;
    g = new THREE.Group();
    g.visible = false;
    g.renderOrder = 50;
    var mkLine = function (col) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.92 }));
      line.renderOrder = 50;
      g.add(line);
      return line;
    };
    var mkDot = function (col, r) {
      var m = new THREE.Mesh(
        new THREE.SphereGeometry(r || 14, 8, 8),
        new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95 })
      );
      m.renderOrder = 51;
      g.add(m);
      return m;
    };
    g.userData.lines = { ml: mkLine(0xff5555), ap: mkLine(0x55ff88), vert: mkLine(0x5599ff) };
    g.userData.dots = {
      shoulderMid: mkDot(0xffcc00, 16),
      hipMid: mkDot(0xff8800, 16),
      torsoTop: mkDot(0x88ddff, 12),
      torsoBottom: mkDot(0x4488cc, 12),
      pelvisCenter: mkDot(0xd9782a, 14)
    };
    procGroup.add(g);
    procGroup.userData.torsoDebugGroup = g;
    return g;
  }

  function setLineFrom(line, origin, dir, len) {
    var p = line.geometry.attributes.position.array;
    p[0] = origin[0]; p[1] = origin[1]; p[2] = origin[2];
    p[3] = origin[0] + dir[0] * len; p[4] = origin[1] + dir[1] * len; p[5] = origin[2] + dir[2] * len;
    line.geometry.attributes.position.needsUpdate = true;
  }

  function updateTorsoPelvisDebug(procGroup, ax, visible) {
    var g = ensureDebugGroup(procGroup);
    g.visible = !!visible && !!ax;
    if (!g.visible || !ax) return;
    var o = ax.hipMid || ax.pelvisCenter;
    var axisLen = clamp((ax.torsoHeight || 400) * 0.22, 90, 220);
    setLineFrom(g.userData.lines.ml, o, ax.ml, axisLen);
    setLineFrom(g.userData.lines.ap, o, ax.ap, axisLen * 0.85);
    setLineFrom(g.userData.lines.vert, o, ax.vert, axisLen * 0.95);
    function placeDot(key, pt) {
      var d = g.userData.dots[key];
      if (!d || !pt) { if (d) d.visible = false; return; }
      d.visible = true;
      d.position.set(pt[0], pt[1], pt[2]);
    }
    placeDot('shoulderMid', ax.shoulderMid);
    placeDot('hipMid', ax.hipMid);
    placeDot('torsoTop', ax.torsoTopCenter);
    placeDot('torsoBottom', ax.torsoBottomCenter);
    placeDot('pelvisCenter', ax.pelvisCenter);
  }

  function roleMat(def) {
    var color = def.color;
    var role = def.role || '';
    var opacity = def.opacity != null ? def.opacity : 0.94;
    var emissive = 0x000000;
    var emInt = 0;
    if (role === 'pelvis') { emissive = color; emInt = 0.14; opacity = 0.96; }
    else if (role === 'thorax' || role === 'torso') { emissive = color; emInt = 0.1; opacity = def.opacity || 0.88; }
    else if (role === 'head') { emissive = 0xfff8f0; emInt = 0.08; opacity = 0.98; }
    else if (/thigh|shank|foot|upper_arm|forearm|hand/.test(role)) { emissive = color; emInt = 0.06; }
    return new THREE.MeshPhongMaterial({
      color: color,
      emissive: emissive,
      emissiveIntensity: emInt,
      transparent: opacity < 0.99,
      opacity: opacity,
      shininess: 32,
      flatShading: false
    });
  }

  function makeCapsule(color, radius, role) {
    var geo = makeCapsuleGeometry(radius, 1);
    var mesh = new THREE.Mesh(geo, roleMat({ color: color, role: role }));
    mesh.userData.kind = 'capsule';
    mesh.userData.radius = radius;
    return mesh;
  }

  /** 관절 끝 반구 없음 — 겹침 시 검은 동그라미 방지 */
  function makeLimb(color, radius, role) {
    var geo = new THREE.CylinderGeometry(radius, radius, 1, 16);
    var mesh = new THREE.Mesh(geo, roleMat({ color: color, role: role }));
    mesh.userData.kind = 'limb';
    mesh.userData.radius = radius;
    return mesh;
  }

  function makeBar(color, radius, role) {
    var geo = new THREE.CylinderGeometry(radius, radius, 1, 14);
    var mesh = new THREE.Mesh(geo, roleMat({ color: color, role: role }));
    mesh.userData.kind = 'bar';
    mesh.userData.radius = radius;
    return mesh;
  }

  function makeMesh(def) {
    var mesh, geo;
    if (def.kind === 'ellipsoid') {
      geo = new THREE.SphereGeometry(1, 24, 18);
      mesh = new THREE.Mesh(geo, roleMat({ color: def.color, role: 'thorax', opacity: def.opacity || 0.96 }));
      mesh.userData.kind = 'ellipsoid';
      mesh.userData.rx = def.rx || 155;
      mesh.userData.ry = def.ry || 118;
      mesh.userData.rz = def.rz || 82;
      return mesh;
    }
    if (def.kind === 'box') {
      if (def.role === 'pelvis') return makeFrustumMesh(def, 'pelvis');
      if (def.role === 'thorax') return makeFrustumMesh(def, 'thorax');
      geo = new THREE.BoxGeometry(def.width || 200, def.height || 50, def.depth || 120);
      mesh = new THREE.Mesh(geo, roleMat({ color: def.color, role: def.role || 'pelvis' }));
      mesh.userData.kind = 'box';
      mesh.userData.boxRole = def.role || 'pelvis';
      mesh.userData.baseH = def.height || 50;
      return mesh;
    }
    if (def.kind === 'sphere') {
      geo = new THREE.SphereGeometry(def.radius || 55, 18, 16);
      mesh = new THREE.Mesh(geo, roleMat({ color: def.color, role: 'head' }));
      mesh.userData.kind = 'sphere';
      mesh.userData.baseR = def.radius || 55;
      return mesh;
    }
    if (def.kind === 'joint_sphere') {
      geo = new THREE.SphereGeometry(def.radius || 44, 16, 14);
      mesh = new THREE.Mesh(geo, roleMat({ color: def.color, role: 'head' }));
      mesh.userData.kind = 'joint_sphere';
      mesh.userData.baseR = def.radius || 44;
      return mesh;
    }
    if (def.kind === 'foot') {
      /* Y=heel→toe 길이 · Z=두께(14) — quatFromYToDir와 일치 */
      geo = new THREE.BoxGeometry(def.width || 90, def.depth || 220, 14);
      mesh = new THREE.Mesh(geo, roleMat({ color: def.color, role: def.role || 'foot' }));
      mesh.userData.kind = 'foot';
      mesh.userData.baseD = def.depth || 220;
      mesh.userData.footHalfThick = 7;
      return mesh;
    }
    if (def.kind === 'limb') return makeLimb(def.color, def.radius || 12, def.role);
    if (def.kind === 'bar') return makeBar(def.color, def.radius || 12, def.role);
    return makeCapsule(def.color, def.radius || 12, def.role);
  }

  function applyBone(mesh, pose) {
    if (!pose) { mesh.visible = false; return; }
    mesh.visible = true;
    var k = mesh.userData.kind;
    if (k === 'ellipsoid') return;
    if (k === 'joint_sphere' || k === 'head_sphere') {
      mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
      mesh.rotation.set(0, 0, 0);
      mesh.quaternion.set(0, 0, 0, 1);
      mesh.scale.setScalar(1);
      return;
    }
    mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
    var q = pose.quaternion;
    mesh.quaternion.set(q.x, q.y, q.z, q.w);
    if (k === 'capsule') {
      var r = mesh.userData.radius || 12;
      var sy = pose.length / (1 + r * 2);
      mesh.scale.set(1, sy, 1);
    } else if (k === 'bar' || k === 'cylinder' || k === 'limb') {
      mesh.scale.set(1, pose.length, 1);
    } else if (k === 'sphere') {
      var br = mesh.userData.baseR || 55;
      mesh.scale.setScalar(Math.max(0.4, pose.length / (br * 2)));
    } else if (k === 'box') {
      var bh = mesh.userData.baseH || 55;
      mesh.scale.set(1, Math.max(0.2, pose.length / bh), 1);
    } else if (k === 'foot') {
      var bd = mesh.userData.baseD || 220;
      mesh.scale.set(1, Math.max(0.25, pose.length / bd), 1);
      mesh.renderOrder = 16;
    }
  }


  function positionHead(mesh, fr) {
    var hd = fr.head;
    if (!RD.isVec3(hd)) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.position.set(hd[0], hd[1], hd[2]);
    mesh.rotation.set(0, 0, 0);
    var ls = fr.l_shoulder, rs = fr.r_shoulder;
    if (RD.isVec3(ls) && RD.isVec3(rs)) {
      mesh.rotation.y = Math.atan2(rs[0] - ls[0], rs[2] - ls[2]);
    }
    var br = mesh.userData.baseR || 44;
    var neck = fr.neck;
    var headScale = 0.92;
    if (RD.isVec3(neck)) {
      var neckLen = dist3(neck, hd);
      headScale = clamp(neckLen / (br * 2.05), 0.36, 0.52);
    }
    mesh.scale.setScalar(headScale);
  }

  function positionEllipsoid(mesh, fr, key) {
    var pt = fr[key];
    if (!RD.isVec3(pt)) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.position.set(pt[0], pt[1], pt[2]);
    mesh.rotation.set(0, 0, 0);
    mesh.quaternion.set(0, 0, 0, 1);
    var pelvis = fr.pelvis_o, neck = fr.neck, lh = fr.l_shoulder, rh = fr.r_shoulder;
    if (RD.isVec3(lh) && RD.isVec3(rh)) {
      mesh.rotation.y = Math.atan2(rh[0] - lh[0], rh[2] - lh[2]);
    }
    if (RD.isVec3(pelvis) && RD.isVec3(neck)) {
      var lean = Math.atan2(neck[0] - pelvis[0], neck[1] - pelvis[1]);
      mesh.rotation.z = -lean * 0.35;
    }
    mesh.scale.set(mesh.userData.rx, mesh.userData.ry, mesh.userData.rz);
  }

  function sideOfRigId(rigId) {
    if (/_L$/i.test(rigId) || rigId.indexOf('_l') >= 0) return 'l';
    if (/_R$/i.test(rigId) || rigId.indexOf('_r') >= 0) return 'r';
    return null;
  }

  function colorForGlbRow(row, cfg) {
    var A = RD.ANATOMICAL_COLORS;
    var role = row.role;
    var rigId = row.rigId || '';
    if (role === 'pelvis' || role === 'pelvis_mesh') return A.PELVIS;
    if (role === 'thorax' || role === 'ribs' || role === 'torso') return A.TORSO;
    if (role === 'head') return A.HEAD;
    var side = sideOfRigId(rigId);
    if (/upper_arm|forearm|hand/.test(role) && side) {
      return side === cfg.armThrow ? A.THROW : A.GLOVE;
    }
    if (/thigh|shank|foot/.test(role) && side) {
      return side === cfg.legLead ? A.LEAD : A.REAR;
    }
    return A.TORSO;
  }

  function tintGlbBindings(bindings, cfg) {
    if (!bindings) return;
    bindings.forEach(function (row) {
      var mesh = row.flatMesh;
      if (!mesh || !mesh.material) return;
      var color = colorForGlbRow(row, cfg);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(function (m) {
          if (m && m.color) m.color.setHex(color);
          if (m && m.emissive) m.emissive.setHex(color);
          if (m) m.emissiveIntensity = 0.08;
        });
      } else {
        mesh.material.color.setHex(color);
        if (mesh.material.emissive) mesh.material.emissive.setHex(color);
        mesh.material.emissiveIntensity = 0.08;
        mesh.material.transparent = true;
        mesh.material.opacity = roleMat({ color: color, role: row.role }).opacity;
      }
    });
  }

  function create(scene, cfg) {
    var group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    var procGroup = new THREE.Group();
    var feetGroup = new THREE.Group();
    feetGroup.renderOrder = 12;
    var glbGroup = new THREE.Group();
    glbGroup.visible = false;
    group.add(procGroup);
    group.add(feetGroup);
    group.add(glbGroup);

    var ready = false;
    var loadError = null;
    var meshes = {};
    var defs = [];
    var skelBindings = null;
    var glbReady = false;
    var glbLoading = false;
    var glbCoverage = 0;
    var glbSource = 'procedural';
    var pendingFrame = null;
    var MIN_GLB_COVERAGE = 50;
    var axisState = {};

    try {
      defs = RD.anatomicalBoneDefs(cfg);
      defs.forEach(function (def) {
        var mesh = makeMesh(def);
        mesh.visible = false;
        mesh.userData.defId = def.id;
        mesh.userData.defRole = def.role || '';
        if (def.kind === 'foot') feetGroup.add(mesh);
        else procGroup.add(mesh);
        meshes[def.id] = mesh;
      });
      ready = Object.keys(meshes).length > 0;
    } catch (e) {
      loadError = String(e && e.message ? e.message : e);
      ready = false;
    }

    function syncChildVisibility(on) {
      feetGroup.visible = !!on;
      if (!on) {
        procGroup.visible = false;
        glbGroup.visible = false;
        return;
      }
      if (glbReady) {
        procGroup.visible = false;
        glbGroup.visible = true;
      } else {
        procGroup.visible = true;
        glbGroup.visible = false;
      }
    }

    function updateFeetOnly(frame) {
      var poses = RD.computePoses(frame, cfg, 'anatomical');
      ['foot_L', 'foot_R'].forEach(function (id) {
        var mesh = meshes[id];
        if (mesh) applyBone(mesh, poses[id]);
      });
    }

    function updateProcedural(frame) {
      var poses = RD.computePoses(frame, cfg, 'anatomical');
      defs.forEach(function (def) {
        var mesh = meshes[def.id];
        if (!mesh) return;
        if (def.kind === 'joint_sphere') {
          applyBone(mesh, poses[def.id]);
          return;
        }
        applyBone(mesh, poses[def.id]);
      });
    }

    function setTorsoPelvisDebug(on) {
      DEBUG_TORSO_PELVIS = !!on;
      if (DEBUG_TORSO_PELVIS && pendingFrame) updateProcedural(pendingFrame);
      else updateTorsoPelvisDebug(procGroup, axisState._lastAx || null, DEBUG_TORSO_PELVIS);
    }

    function loadGlbAsset() {
      if (glbLoading || glbReady || !ASV || !ASV.loadSkeletonModel) return;
      glbLoading = true;
      ensureGLTFLoader().then(function (GLTFLoader) {
        var urls = ASV.defaultModelUrls ? ASV.defaultModelUrls() : ASV.MODEL_URLS;
        return ASV.loadSkeletonModel(GLTFLoader, urls);
      }).then(function (pack) {
        glbGroup.clear();
        skelBindings = ASV.flattenBindingsToGroup(pack.bindings, THREE, glbGroup);
        var hasMesh = skelBindings.some(function (b) { return b.flatMesh; });
        glbCoverage = pack.coverage.pct;
        var src = pack.sourceUrl || '';
        var isGlbFile = /\.glb$/i.test(src);
        if (shouldUseGlbPack(pack, isGlbFile, hasMesh, glbCoverage)) {
          tintGlbBindings(skelBindings, cfg);
          glbReady = true;
          glbSource = src;
          console.info('Anatomical GLB active:', glbSource, glbCoverage + '%');
          if (group.visible) syncChildVisibility(true);
          if (pendingFrame) updateFrame(pendingFrame);
        } else {
          glbGroup.clear();
          skelBindings = null;
          if (hasMesh && isGlbFile && isPlaceholderGlbPack(pack)) {
            console.info('Anatomical: placeholder skeleton.glb — 박스 procedural 유지 (Mixamo glb 교체 시 자동 전환)');
          } else if (!hasMesh && isGlbFile && glbCoverage >= MIN_GLB_COVERAGE) {
            console.info('Anatomical GLB 본 매핑 ' + glbCoverage + '% — Mixamo 단일 메시(Ch36)는 박스 procedural 유지');
          } else if (hasMesh && glbCoverage >= MIN_GLB_COVERAGE) {
            console.info('Anatomical GLB skipped — procedural box (' + glbCoverage + '%)');
          } else {
            console.warn('Anatomical GLB 미사용 (coverage ' + glbCoverage + '%) — procedural fallback');
          }
        }
      }).catch(function (e) {
        console.warn('Anatomical GLB load failed — procedural fallback', e);
      }).finally(function () {
        glbLoading = false;
      });
    }

    function setVisible(on) {
      if (!ready) return;
      group.visible = !!on;
      syncChildVisibility(!!on);
      if (on && !glbReady && !glbLoading) loadGlbAsset();
    }

    function setMode() { /* anatomical only */ }

    function isReady() { return ready; }

    function getLoadError() { return loadError; }

    function getSkelSource() { return glbReady ? glbSource : 'procedural'; }

    function getSkelCoverage() { return glbReady ? glbCoverage : 0; }

    function countVisibleGlb() {
      var n = 0;
      glbGroup.traverse(function (o) { if (o.isMesh && o.visible) n++; });
      return n;
    }

    function updateFrame(frame) {
      if (!ready || !group.visible || !frame) return;
      pendingFrame = frame;
      updateFeetOnly(frame);
      if (glbReady && skelBindings && ASV.retargetFrame) {
        ASV.retargetFrame(skelBindings, frame, cfg);
        if (countVisibleGlb() < MIN_GLB_VISIBLE) {
          glbReady = false;
          glbGroup.clear();
          skelBindings = null;
          console.info('Anatomical GLB 품질 부족 — 박스 procedural 복귀');
          syncChildVisibility(true);
          updateProcedural(frame);
        }
      } else {
        updateProcedural(frame);
      }
    }

    function getFootVisibility() {
      return {
        footLeadVisible: !!(meshes.foot_L && meshes.foot_L.visible),
        footRearVisible: !!(meshes.foot_R && meshes.foot_R.visible)
      };
    }

    function getAnchoringAudit(frame) {
      if (!frame || !RD.auditSegmentAnchoring) return null;
      return RD.auditSegmentAnchoring(frame, cfg, { warn: false });
    }

    var api = {
      setVisible: setVisible,
      setMode: setMode,
      updateFrame: updateFrame,
      isReady: isReady,
      getLoadError: getLoadError,
      getSkelSource: getSkelSource,
      getSkelCoverage: getSkelCoverage,
      getFootVisibility: getFootVisibility,
      getAnchoringAudit: getAnchoringAudit,
      setTorsoPelvisDebug: setTorsoPelvisDebug,
      group: group,
      anatomicalDefs: RD.anatomicalBoneDefs,
      ANATOMICAL_COLORS: RD.ANATOMICAL_COLORS
    };
    root.SkeletonProRenderer._lastInstance = api;
    return api;
  }

  root.SkeletonProRenderer = {
    create: create,
    setTorsoPelvisDebug: function (on) {
      DEBUG_TORSO_PELVIS = !!on;
      var inst = root.SkeletonProRenderer._lastInstance;
      if (inst && inst.setTorsoPelvisDebug) inst.setTorsoPelvisDebug(on);
    },
    anatomicalDefs: RD.anatomicalBoneDefs,
    skeletonProDefs: RD.anatomicalBoneDefs,
    ANATOMICAL_COLORS: RD.ANATOMICAL_COLORS
  };
  root.AnatomicalSkeletonBetaRenderer = root.SkeletonProRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
