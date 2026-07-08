/**
 * top20_variable_groups.js — Top20 변인 단계별 그룹 SSOT (coach dropdown)
 */
(function (root) {
  'use strict';
  var GROUPS = [
    {
      id: 'drive',
      label: '드라이브 / 스트라이드',
      items: [
        { key: 'rearProp', label: '뒷발 추진' },
        { key: 'postureMaint', label: '상체 자세 유지' },
        { key: 'strideTime', label: '스트라이드 리듬' },
        { key: 'leadFootAngleFC', label: '착지 발 방향' },
        { key: 'strideLenCV', label: '보폭 반복성' }
      ]
    },
    {
      id: 'blocking',
      label: '블로킹 / 앞다리 지지',
      items: [
        { key: 'apBrakeImpulse', label: '앞발 제동' },
        { key: 'comVelReductionFCBR', label: '전진속도 감소' },
        { key: 'vgrfRetain', label: '앞다리 지지 유지' },
        { key: 'leadVGRFImpulse', label: '앞발 수직 지지' },
        { key: 'kneeCollapse', label: '앞무릎 지지 흔들림' },
        { key: 'blockRiskPenalty', label: '블로킹 위험 조합' }
      ]
    },
    {
      id: 'trunk',
      label: '몸통 / 전달',
      items: [
        { key: 'armTransferRatio', label: '몸통→팔 전달' },
        { key: 'ppTrunkHum', label: '몸통-팔 타이밍' },
        { key: 'torsoRotV', label: '몸통 회전속도' },
        { key: 'trunkME', label: '몸통 에너지' }
      ]
    },
    {
      id: 'arm',
      label: '팔 / 방출',
      items: [
        { key: 'armRotV', label: '팔 회전속도' },
        { key: 'humME', label: '팔 에너지' }
      ]
    },
    {
      id: 'consistency',
      label: '제구 / 반복성',
      items: [
        { key: 'relTimingCvPct', label: '릴리스 타이밍 반복성' },
        { key: 'releaseSdMm', label: '릴리스 위치 흔들림' },
        { key: 'armSlotSdDeg', label: '암슬롯 반복성' }
      ]
    }
  ];
  var LABEL_MAP = {};
  GROUPS.forEach(function (g) {
    (g.items || []).forEach(function (it) { LABEL_MAP[it.key] = it.label; });
  });
  root.TOP20_VAR_GROUPS = {
    groups: GROUPS,
    coachLabel: function (key) { return LABEL_MAP[key] || null; },
    allKeys: function () {
      var out = [];
      GROUPS.forEach(function (g) {
        (g.items || []).forEach(function (it) { if (out.indexOf(it.key) < 0) out.push(it.key); });
      });
      return out;
    },
    groupForKey: function (key) {
      for (var i = 0; i < GROUPS.length; i++) {
        var g = GROUPS[i];
        for (var j = 0; j < (g.items || []).length; j++) {
          if (g.items[j].key === key) return g;
        }
      }
      return null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
