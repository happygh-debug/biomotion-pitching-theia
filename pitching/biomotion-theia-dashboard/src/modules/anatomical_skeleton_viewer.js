/**
 * DEPRECATED / ARCHIVED:
 * Skeleton β and Anatomical Legacy are removed from production UI.
 * Production viewer is Stick-only. See skeleton_pro_renderer.js.
 *
 * anatomical_skeleton_viewer.js — GLB/GLTF skeleton beta (async · 번들 외부 asset)
 * Theia landmark → bone retarget · rig_driver SSOT
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root.RigDriver);
  else root.AnatomicalSkeletonViewer = factory(root.RigDriver);
})(typeof self !== 'undefined' ? self : this, function (RD) {
  'use strict';

  /** pageBase() 기준 상대 경로 — build.py가 assets/ 동기화 */
  function defaultModelUrls() {
    var base = '';
    try {
      var p = location.pathname || '';
      var i = p.lastIndexOf('/');
      base = i >= 0 ? p.slice(0, i + 1) : './';
    } catch (e) {
      base = './';
    }
    return [
      base + 'assets/models/skeleton.glb',
      base + 'assets/models/skeleton.gltf'
    ];
  }

  const MODEL_URLS = defaultModelUrls();

  const BONE_SEGMENT_MAP = [
    { rigId: 'pelvis_block', role: 'pelvis', kind: 'pelvis', from: 'pelvis_o', to: 'pelvis_o',
      glbNames: ['mixamorig1:Hips', 'mixamorig:Hips', 'Hips', 'Pelvis', 'pelvis', 'hip', 'root'] },
    { rigId: 'spine_lower', role: 'thorax', kind: 'segment', from: 'pelvis_o', to: 'virtual_lumbar',
      glbNames: ['mixamorig1:Spine', 'mixamorig:Spine', 'Spine', 'spine_01', 'spine_02', 'Spine1'] },
    { rigId: 'spine_upper', role: 'thorax', kind: 'segment', from: 'virtual_lumbar', to: 'neck',
      glbNames: ['mixamorig1:Spine1', 'mixamorig:Spine1', 'Spine1', 'mixamorig1:Spine2', 'Spine2', 'Chest', 'thorax'] },
    { rigId: 'head', role: 'head', kind: 'sphere', from: 'neck', to: 'head',
      glbNames: ['mixamorig1:Head', 'mixamorig:Head', 'Head', 'head', 'skull'] },
    { rigId: 'humerus_L', role: 'upper_arm', kind: 'segment', from: 'l_shoulder', to: 'l_elbow',
      glbNames: ['mixamorig1:LeftArm', 'mixamorig:LeftArm', 'LeftArm', 'left_arm', 'upperarm_l', 'LeftShoulder'] },
    { rigId: 'forearm_L', role: 'forearm', kind: 'segment', from: 'l_elbow', to: 'l_wrist',
      glbNames: ['mixamorig1:LeftForeArm', 'mixamorig:LeftForeArm', 'LeftForeArm', 'left_forearm', 'lowerarm_l'] },
    { rigId: 'hand_L', role: 'hand', kind: 'segment', from: 'l_wrist', to: 'l_hand_tip',
      glbNames: ['mixamorig1:LeftHand', 'mixamorig:LeftHand', 'LeftHand', 'left_hand', 'hand_l'] },
    { rigId: 'humerus_R', role: 'upper_arm', kind: 'segment', from: 'r_shoulder', to: 'r_elbow',
      glbNames: ['mixamorig1:RightArm', 'mixamorig:RightArm', 'RightArm', 'right_arm', 'upperarm_r', 'RightShoulder'] },
    { rigId: 'forearm_R', role: 'forearm', kind: 'segment', from: 'r_elbow', to: 'r_wrist',
      glbNames: ['mixamorig1:RightForeArm', 'mixamorig:RightForeArm', 'RightForeArm', 'right_forearm', 'lowerarm_r'] },
    { rigId: 'hand_R', role: 'hand', kind: 'segment', from: 'r_wrist', to: 'r_hand_tip',
      glbNames: ['mixamorig1:RightHand', 'mixamorig:RightHand', 'RightHand', 'right_hand', 'hand_r'] },
    { rigId: 'thigh_L', role: 'thigh', kind: 'segment', from: 'l_hip', to: 'l_knee',
      glbNames: ['mixamorig1:LeftUpLeg', 'mixamorig:LeftUpLeg', 'LeftUpLeg', 'left_thigh', 'femur_l'] },
    { rigId: 'shank_L', role: 'shank', kind: 'segment', from: 'l_knee', to: 'l_heel',
      glbNames: ['mixamorig1:LeftLeg', 'mixamorig:LeftLeg', 'LeftLeg', 'left_shin', 'tibia_l'] },
    { rigId: 'foot_L', role: 'foot', kind: 'segment', from: 'l_heel', to: 'l_toe',
      glbNames: ['mixamorig1:LeftFoot', 'mixamorig:LeftFoot', 'LeftFoot', 'left_foot', 'foot_l'] },
    { rigId: 'thigh_R', role: 'thigh', kind: 'segment', from: 'r_hip', to: 'r_knee',
      glbNames: ['mixamorig1:RightUpLeg', 'mixamorig:RightUpLeg', 'RightUpLeg', 'right_thigh', 'femur_r'] },
    { rigId: 'shank_R', role: 'shank', kind: 'segment', from: 'r_knee', to: 'r_heel',
      glbNames: ['mixamorig1:RightLeg', 'mixamorig:RightLeg', 'RightLeg', 'right_shin', 'tibia_r'] },
    { rigId: 'foot_R', role: 'foot', kind: 'segment', from: 'r_heel', to: 'r_toe',
      glbNames: ['mixamorig1:RightFoot', 'mixamorig:RightFoot', 'RightFoot', 'right_foot', 'foot_r'] },
    { rigId: 'rib_cage', role: 'ribs', kind: 'attach', from: 'virtual_thorax', to: 'virtual_thorax',
      glbNames: ['Ribs', 'ribs', 'ribcage', 'ChestMesh'] },
    { rigId: 'pelvis_mesh', role: 'pelvis_mesh', kind: 'attach', from: 'pelvis_o', to: 'pelvis_o',
      glbNames: ['PelvisMesh', 'pelvis_mesh', 'HipsMesh'] }
  ];

  const PRIORITY_ROLES = ['pelvis', 'thorax', 'upper_arm', 'forearm', 'thigh', 'shank', 'foot', 'head', 'hand', 'ribs'];

  function normName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function isVec3(v) {
    return RD && RD.isVec3 ? RD.isVec3(v) : (v && v.length >= 3 && v.every(function (x) { return isFinite(x); }));
  }

  function indexSceneNodes(rootNode) {
    var map = {};
    rootNode.traverse(function (obj) {
      if (!obj.name) return;
      var k = normName(obj.name);
      if (!map[k]) map[k] = [];
      map[k].push(obj);
    });
    return map;
  }

  function resolveNode(index, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var k = normName(aliases[i]);
      if (index[k] && index[k][0]) return index[k][0];
    }
    return null;
  }

  function buildBindingTable(scene) {
    var index = indexSceneNodes(scene);
    var rows = [];
    BONE_SEGMENT_MAP.forEach(function (seg) {
      var node = resolveNode(index, seg.glbNames);
      rows.push({
        rigId: seg.rigId,
        role: seg.role,
        from: seg.from,
        to: seg.to,
        glbNames: seg.glbNames,
        node: node,
        nodeName: node ? node.name : null,
        bound: !!node
      });
    });
    return rows;
  }

  function bindingCoverage(bindings) {
    var priority = bindings.filter(function (b) {
      return PRIORITY_ROLES.indexOf(b.role) >= 0;
    });
    var hit = priority.filter(function (b) { return b.bound; }).length;
    return { hit: hit, total: priority.length, pct: priority.length ? Math.round(100 * hit / priority.length) : 0 };
  }

  /** placeholder gltf unit box → Theia mm 스케일 */
  var GLB_UNIT_MM = 100;

  function applySegmentPose(obj, pose, seg, fr) {
    if (!obj) return;
    var isGlb = obj.userData && obj.userData.isGlbSegment;
    if (seg.kind === 'pelvis' && isVec3(fr.pelvis_o)) {
      obj.visible = true;
      obj.position.set(fr.pelvis_o[0], fr.pelvis_o[1], fr.pelvis_o[2]);
      if (isVec3(fr.l_hip) && isVec3(fr.r_hip)) {
        var dx = fr.r_hip[0] - fr.l_hip[0], dz = fr.r_hip[2] - fr.l_hip[2];
        obj.rotation.set(0, Math.atan2(dx, dz), 0);
        if (isGlb) {
          var hipW = Math.sqrt(dx * dx + dz * dz) || 220;
          obj.scale.set(hipW / GLB_UNIT_MM, 0.9, 1.4);
        } else obj.scale.set(1, 1, 1);
      }
      return;
    }
    if (seg.kind === 'sphere' && isVec3(fr.head)) {
      obj.visible = true;
      obj.position.set(fr.head[0], fr.head[1], fr.head[2]);
      obj.quaternion.set(0, 0, 0, 1);
      if (isGlb && pose && pose.length) obj.scale.setScalar(Math.max(0.45, pose.length / (GLB_UNIT_MM * 1.1)));
      return;
    }
    if (seg.kind === 'attach' && isVec3(fr[seg.from])) {
      obj.visible = true;
      var p = fr[seg.from];
      obj.position.set(p[0], p[1], p[2]);
      if (isVec3(fr.l_shoulder) && isVec3(fr.r_shoulder)) {
        var dx2 = fr.r_shoulder[0] - fr.l_shoulder[0], dz2 = fr.r_shoulder[2] - fr.l_shoulder[2];
        obj.rotation.set(0, Math.atan2(dx2, dz2), 0);
      }
      if (isGlb && seg.role === 'ribs') obj.scale.set(1.55, 1.2, 0.9);
      return;
    }
    if (!pose) { obj.visible = false; return; }
    obj.visible = true;
    obj.position.set(pose.position[0], pose.position[1], pose.position[2]);
    var q = pose.quaternion;
    obj.quaternion.set(q.x, q.y, q.z, q.w);
    if (seg.kind === 'segment') {
      if (isGlb) obj.scale.set(1, Math.max(0.2, pose.length / GLB_UNIT_MM), 1);
      else obj.scale.set(1, Math.max(0.05, pose.length), 1);
    }
  }

  function flattenBindingsToGroup(bindings, THREE, targetGroup) {
    bindings.forEach(function (row) {
      if (!row.node) return;
      var mesh = row.node;
      if (!mesh.isMesh) {
        mesh.traverse(function (c) { if (c.isMesh && !row.flatMesh) row.flatMesh = c; });
        mesh = row.flatMesh;
      }
      if (!mesh || !mesh.isMesh) return;
      var clone = mesh.clone();
      clone.name = row.nodeName || row.rigId;
      clone.material = mesh.material && mesh.material.clone ? mesh.material.clone() : mesh.material;
      clone.userData.isGlbSegment = true;
      clone.userData.rigId = row.rigId;
      clone.userData.role = row.role;
      targetGroup.add(clone);
      row.flatMesh = clone;
    });
    return bindings;
  }

  function retargetFrame(bindings, frame, cfg) {
    var fr = RD.resolveFrame(frame);
    var poses = RD.computePoses(frame, cfg, 'anatomical');
    bindings.forEach(function (row) {
      var obj = row.flatMesh || row.node;
      if (!obj) return;
      var seg = BONE_SEGMENT_MAP.find(function (s) { return s.rigId === row.rigId; });
      applySegmentPose(obj, poses[row.rigId], seg, fr);
    });
    return { poses: poses, frame: fr };
  }

  function loadSkeletonModel(GLTFLoader, urls, onProgress) {
    urls = urls || defaultModelUrls();
    var loader = new GLTFLoader();
    var lastUrl = '';
    var chain = Promise.reject(new Error('no urls'));
    urls.forEach(function (url) {
      chain = chain.catch(function () {
        lastUrl = url;
        if (onProgress) onProgress('try ' + url);
        return new Promise(function (resolve, reject) {
          loader.load(url, resolve, undefined, reject);
        });
      });
    });
    return chain.then(function (gltf) {
      var scene = gltf.scene || gltf.scenes[0];
      scene.scale.setScalar(1);
      var bindings = buildBindingTable(scene);
      var cov = bindingCoverage(bindings);
      return {
        gltf: gltf,
        scene: scene,
        bindings: bindings,
        coverage: cov,
        sourceUrl: lastUrl
      };
    });
  }

  return {
    MODEL_URLS: MODEL_URLS,
    defaultModelUrls: defaultModelUrls,
    BONE_SEGMENT_MAP: BONE_SEGMENT_MAP,
    PRIORITY_ROLES: PRIORITY_ROLES,
    buildBindingTable: buildBindingTable,
    bindingCoverage: bindingCoverage,
    flattenBindingsToGroup: flattenBindingsToGroup,
    retargetFrame: retargetFrame,
    loadSkeletonModel: loadSkeletonModel
  };
});
