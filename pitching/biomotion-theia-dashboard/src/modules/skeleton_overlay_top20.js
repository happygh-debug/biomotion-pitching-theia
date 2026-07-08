/**
 * skeleton_overlay_top20.js — Top20 skeleton-first overlay SSOT (browser)
 * Node SSOT: _handover/lib/skeleton_overlay_policy.js TOP20_SKELETON_MAP
 */
(function (root) {
  'use strict';
  var TOP20_SKELETON_MAP = {
    apBrakeImpulse: { category: 'F', overlays: ['blocking', 'grfComponents', 'comPath', 'phaseHighlight'], auxPanel: 'impulseArea', viewHint: 'side', phaseSpan: 'FC-BR' },
    comVelReductionFCBR: { category: 'F', overlays: ['comPath', 'blocking', 'grfComponents', 'phaseHighlight'], auxPanel: 'eventTimeSeries', viewHint: 'side', phaseSpan: 'FC-BR' },
    vgrfRetain: { category: 'F', overlays: ['blocking', 'grfComponents', 'phaseHighlight'], auxPanel: 'bandGaugeVgrfPattern', viewHint: 'side', phaseSpan: 'FC-BR' },
    leadVGRFImpulse: { category: 'F', overlays: ['blocking', 'grfComponents', 'phaseHighlight'], auxPanel: 'impulseArea', viewHint: 'side', phaseSpan: 'FC-BR' },
    kneeCollapse: { category: 'B', overlays: ['kneeAngle', 'blocking', 'grfComponents', 'collapseArrow', 'phaseHighlight'], auxPanel: 'kneeCollapseGauge', viewHint: 'front', phaseSpan: 'FC-BR' },
    blockRiskPenalty: { category: 'B', overlays: ['kneeAngle', 'blocking', 'grfComponents', 'collapseArrow', 'phaseHighlight'], auxPanel: 'riskMatrix', viewHint: 'side', phaseSpan: 'FC-BR' },
    rearProp: { category: 'F', overlays: ['rearGRF', 'propulsion', 'comPath', 'phaseHighlight'], auxPanel: 'impulseArea', viewHint: 'side', phaseSpan: 'KH-FC' },
    postureMaint: { category: 'D', overlays: ['trunkLean', 'pelvisSho', 'thoraxRot', 'phaseHighlight'], auxPanel: 'bandGauge', viewHint: 'side', phaseSpan: 'KH-BR' },
    strideTime: { category: 'G', overlays: ['timing', 'footDirection', 'comPath'], auxPanel: 'timingLollipop', viewHint: 'top', phaseSpan: 'PI-FC' },
    leadFootAngleFC: { category: 'C', overlays: ['footDirection', 'phaseHighlight'], auxPanel: 'none', viewHint: 'top', phaseSpan: 'FC' },
    armTransferRatio: { category: 'A', overlays: ['pelvisSho', 'armSlot', 'thoraxRot', 'phaseHighlight'], auxPanel: 'bandGaugeEnergyFlow', viewHint: 'rear', phaseSpan: 'KH-BR' },
    ppTrunkHum: { category: 'G', overlays: ['timing', 'pelvisSho', 'armSlot', 'phaseHighlight'], auxPanel: 'timingLollipop', viewHint: 'rear', phaseSpan: 'KH-MER' },
    torsoRotV: { category: 'D', overlays: ['thoraxRot', 'pelvisSho', 'trunkLean', 'phaseHighlight'], auxPanel: 'eventTimeSeries', viewHint: 'top', phaseSpan: 'FC-BR' },
    trunkME: { category: 'E', overlays: ['loadMarker', 'armSlot', 'trunkLean', 'phaseHighlight'], auxPanel: 'eventTimeSeries', viewHint: 'side', phaseSpan: 'MER-BR' },
    armRotV: { category: 'E', overlays: ['armSlot', 'handPath', 'phaseHighlight'], auxPanel: 'eventTimeSeries', viewHint: 'rear', phaseSpan: 'MER-BR' },
    humME: { category: 'E', overlays: ['armLoad', 'armSlot', 'phaseHighlight'], auxPanel: 'eventTimeSeries', viewHint: 'rear', phaseSpan: 'MER-BR' },
    relTimingCvPct: { category: 'H', overlays: ['timing', 'consistency'], auxPanel: 'consistencyCard', viewHint: 'side', phaseSpan: 'session' },
    releaseSdMm: { category: 'H', overlays: ['handPath', 'consistency', 'armSlot'], auxPanel: 'consistencyCard', viewHint: 'rear', phaseSpan: 'session' },
    armSlotSdDeg: { category: 'H', overlays: ['armSlot', 'consistency'], auxPanel: 'consistencyCard', viewHint: 'rear', phaseSpan: 'session' },
    strideLenCV: { category: 'H', overlays: ['footDirection', 'consistency', 'comPath'], auxPanel: 'consistencyCard', viewHint: 'top', phaseSpan: 'session' }
  };
  root.SKELETON_TOP20 = {
    map: TOP20_SKELETON_MAP,
    isTop20: function (key) { return !!TOP20_SKELETON_MAP[key]; },
    get: function (key) { return TOP20_SKELETON_MAP[key] || null; },
    overlaysFor: function (key) {
      var m = TOP20_SKELETON_MAP[key];
      return m && m.overlays ? m.overlays.slice() : [];
    },
    auxPanelFor: function (key) {
      var m = TOP20_SKELETON_MAP[key];
      return m ? m.auxPanel : null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
