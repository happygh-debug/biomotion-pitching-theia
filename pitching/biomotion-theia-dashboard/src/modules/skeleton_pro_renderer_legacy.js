/**
 * DEPRECATED / ARCHIVED:
 * Skeleton β and Anatomical Legacy are removed from production UI.
 * Reason: unstable primitive anchoring and unreliable coach/player interpretation.
 * Production viewer is Stick-only.
 * Do not re-enable without full QA and explicit approval.
 *
 * skeleton_pro_renderer_legacy.js — Anatomical legacy (09ed131 PoC volume rig)
 * THREE r128 · box torso/pelvis · knee→heel · heel→toe foot · GLB 없음
 */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  var RD = root.RigDriver;
  if (!THREE || !RD) return;

  function hexMat(color, opacity, emissive) {
    return new THREE.MeshPhongMaterial({
      color: color,
      emissive: emissive || 0x000000,
      emissiveIntensity: emissive ? 0.1 : 0,
      transparent: opacity < 1,
      opacity: opacity,
      shininess: 28,
      flatShading: false
    });
  }

  function makeCylinder(color, radius) {
    var g = new THREE.CylinderGeometry(radius, radius, 1, 14);
    var m = new THREE.Mesh(g, hexMat(color, 0.96, color));
    m.userData.kind = 'cylinder';
    m.userData.radius = radius;
    return m;
  }

  function makeMesh(def) {
    var mesh, geo;
    if (def.kind === 'box') {
      geo = new THREE.BoxGeometry(def.width || 200, def.height || 50, def.depth || 120);
      mesh = new THREE.Mesh(geo, hexMat(def.color, 0.92, def.color));
      mesh.userData.kind = 'box';
      mesh.userData.boxRole = def.role || 'pelvis';
      mesh.userData.baseH = def.height || 50;
      return mesh;
    }
    if (def.kind === 'sphere') {
      geo = new THREE.SphereGeometry(def.radius || 55, 16, 14);
      mesh = new THREE.Mesh(geo, hexMat(def.color, 0.95));
      mesh.userData.kind = 'sphere';
      mesh.userData.baseR = def.radius || 55;
      return mesh;
    }
    if (def.kind === 'foot') {
      geo = new THREE.BoxGeometry(def.width || 90, 12, def.depth || 220);
      mesh = new THREE.Mesh(geo, hexMat(def.color, 0.9));
      mesh.userData.kind = 'foot';
      mesh.userData.baseD = def.depth || 220;
      return mesh;
    }
    return makeCylinder(def.color, def.radius || 12);
  }

  function applyBone(mesh, pose) {
    if (!pose) { mesh.visible = false; return; }
    mesh.visible = true;
    var k = mesh.userData.kind;
    if (k === 'sphere' && (pose.fixedScale || pose.kind === 'head_sphere')) {
      mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
      mesh.quaternion.set(0, 0, 0, 1);
      mesh.scale.setScalar(1);
      return;
    }
    if (k === 'box' && mesh.userData.boxRole === 'pelvis') {
      mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
      return;
    }
    mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
    var q = pose.quaternion;
    mesh.quaternion.set(q.x, q.y, q.z, q.w);
    if (k === 'cylinder') {
      mesh.scale.set(1, pose.length, 1);
    } else if (k === 'box') {
      var bh = mesh.userData.baseH || 55;
      mesh.scale.set(1, Math.max(0.2, pose.length / bh), 1);
    } else if (k === 'foot') {
      var bd = mesh.userData.baseD || 220;
      mesh.scale.set(1, 1, Math.max(0.2, pose.length / bd));
    }
  }

  function positionPelvisBlock(mesh, fr) {
    var p = fr.pelvis_o, lh = fr.l_hip, rh = fr.r_hip;
    if (!RD.isVec3(p)) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.position.set(p[0], p[1], p[2]);
    mesh.quaternion.set(0, 0, 0, 1);
    mesh.scale.setScalar(1);
    if (RD.isVec3(lh) && RD.isVec3(rh)) mesh.rotation.y = Math.atan2(rh[0] - lh[0], rh[2] - lh[2]);
  }

  function create(scene, cfg) {
    var group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    var ready = false;
    var loadError = null;
    var meshes = {};
    var defs = [];

    try {
      defs = RD.anatomicalLegacyBoneDefs(cfg);
      defs.forEach(function (def) {
        var mesh = makeMesh(def);
        mesh.visible = false;
        mesh.userData.defId = def.id;
        group.add(mesh);
        meshes[def.id] = mesh;
      });
      ready = Object.keys(meshes).length > 0;
    } catch (e) {
      loadError = String(e && e.message ? e.message : e);
      ready = false;
    }

    function setVisible(on) { if (ready) group.visible = !!on; }
    function setMode() { /* anatomical-legacy only */ }
    function isReady() { return ready; }
    function getLoadError() { return loadError; }
    function getSkelSource() { return 'anatomical-legacy'; }

    function getAnchoringAudit(frame, opts) {
      return RD.auditSegmentAnchoring(frame, cfg, Object.assign({ mode: 'anatomical-legacy' }, opts || {}));
    }

    function getFootVisibility() {
      var ll = cfg.legLead, lr = cfg.legRear;
      var leadId = 'foot_' + (ll === 'l' ? 'L' : 'R');
      var rearId = 'foot_' + (lr === 'l' ? 'L' : 'R');
      return {
        footLeadVisible: !!(meshes[leadId] && meshes[leadId].visible),
        footRearVisible: !!(meshes[rearId] && meshes[rearId].visible)
      };
    }

    function updateFrame(frame) {
      if (!ready || !group.visible || !frame) return;
      var fr = RD.resolveFrame(frame);
      var poses = RD.computePoses(frame, cfg, 'anatomical-legacy');
      defs.forEach(function (def) {
        var mesh = meshes[def.id];
        if (!mesh) return;
        if (def.kind === 'box' && def.role === 'pelvis') {
          positionPelvisBlock(mesh, fr);
          return;
        }
        applyBone(mesh, poses[def.id]);
      });
    }

    return {
      setVisible: setVisible,
      setMode: setMode,
      updateFrame: updateFrame,
      isReady: isReady,
      getLoadError: getLoadError,
      getAnchoringAudit: getAnchoringAudit,
      getFootVisibility: getFootVisibility,
      getSkelSource: getSkelSource,
      group: group,
      anatomicalDefs: RD.anatomicalLegacyBoneDefs,
      ANATOMICAL_COLORS: RD.ANATOMICAL_COLORS
    };
  }

  root.SkeletonLegacyRenderer = {
    create: create,
    anatomicalDefs: RD.anatomicalLegacyBoneDefs,
    ANATOMICAL_COLORS: RD.ANATOMICAL_COLORS
  };
})(typeof window !== 'undefined' ? window : globalThis);
