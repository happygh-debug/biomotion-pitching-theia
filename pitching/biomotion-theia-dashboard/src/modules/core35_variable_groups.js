/**
 * core35_variable_groups.js — Core35 핵심 코칭 변인 단계별 그룹 SSOT (통합 35)
 */
(function (root) {
  'use strict';
  var CORE35_KEYS = [
    'apBrakeImpulse', 'comVelReductionFCBR', 'vgrfRetain', 'leadVGRFImpulse', 'kneeCollapse', 'blockRiskPenalty',
    'rearProp', 'postureMaint', 'strideTime', 'leadFootAngleFC', 'armTransferRatio', 'ppTrunkHum', 'torsoRotV',
    'trunkME', 'armRotV', 'humME', 'relTimingCvPct', 'releaseSdMm', 'armSlotSdDeg', 'strideLenCV',
    'hipHinge', 'earlyArmRisk', 'hssBuildKF', 'xfReleasedPctByFC', 'xfUnwindV', 'hssFC', 'openAng', 'trkOpenKF',
    'leadKneeFlexFC', 'leadKneeFlexionBR', 'leadKneeExtROM', 'strideLen', 'strideDirection', 'blockingType', 'armSlot'
  ];
  var GROUPS = [
    {
      id: 'windup',
      label: '와인드업 / 준비',
      items: [
        { key: 'hipHinge', label: '고관절 접힘' },
        { key: 'earlyArmRisk', label: '팔 조기 준비' },
        { key: 'hssBuildKF', label: '골반-몸통 분리 쌓임' }
      ]
    },
    {
      id: 'drive',
      label: '드라이브',
      items: [
        { key: 'rearProp', label: '뒷발 추진' },
        { key: 'postureMaint', label: '상체 자세 유지' }
      ]
    },
    {
      id: 'stride',
      label: '스트라이드',
      items: [
        { key: 'strideTime', label: '스트라이드 리듬' },
        { key: 'leadFootAngleFC', label: '착지 발 방향' },
        { key: 'strideLen', label: '보폭' },
        { key: 'strideDirection', label: '스트라이드 방향' },
        { key: 'strideLenCV', label: '보폭 반복성' }
      ]
    },
    {
      id: 'blocking',
      label: '블로킹',
      items: [
        { key: 'apBrakeImpulse', label: '앞발 제동' },
        { key: 'comVelReductionFCBR', label: '전진속도 감소' },
        { key: 'blockRiskPenalty', label: '블로킹 위험 조합' },
        { key: 'blockingType', label: '블로킹 유형' }
      ]
    },
    {
      id: 'leadleg',
      label: '앞다리 지지',
      items: [
        { key: 'vgrfRetain', label: '앞다리 지지 유지' },
        { key: 'leadVGRFImpulse', label: '앞발 수직 지지' },
        { key: 'kneeCollapse', label: '앞무릎 지지 흔들림' },
        { key: 'leadKneeFlexFC', label: '착지 무릎 굴곡' },
        { key: 'leadKneeFlexionBR', label: '릴리스 무릎 굴곡' },
        { key: 'leadKneeExtROM', label: '무릎 전략' }
      ]
    },
    {
      id: 'trunkgen',
      label: '몸통 생성',
      items: [
        { key: 'torsoRotV', label: '몸통 회전속도' },
        { key: 'trunkME', label: '몸통 에너지' },
        { key: 'xfReleasedPctByFC', label: 'FC 전 분리 풀림' },
        { key: 'xfUnwindV', label: '분리 풀림 속도' },
        { key: 'hssFC', label: 'FC 분리각' },
        { key: 'openAng', label: '몸통 조기 열림' },
        { key: 'trkOpenKF', label: 'KH~FC 몸통 열림' }
      ]
    },
    {
      id: 'trunkarm',
      label: '몸통-팔 전달',
      items: [
        { key: 'armTransferRatio', label: '몸통→팔 전달' },
        { key: 'ppTrunkHum', label: '몸통-팔 타이밍' }
      ]
    },
    {
      id: 'arm',
      label: '팔 / 방출',
      items: [
        { key: 'armRotV', label: '팔 회전속도' },
        { key: 'humME', label: '팔 에너지' },
        { key: 'armSlot', label: '암슬롯' },
        { key: 'armSlotSdDeg', label: '암슬롯 반복성' }
      ]
    },
    {
      id: 'consistency',
      label: '제구 / 반복성',
      items: [
        { key: 'relTimingCvPct', label: '릴리스 타이밍 반복성' },
        { key: 'releaseSdMm', label: '릴리스 위치 흔들림' }
      ]
    }
  ];
  var LABEL_MAP = {};
  GROUPS.forEach(function (g) {
    (g.items || []).forEach(function (it) { LABEL_MAP[it.key] = it.label; });
  });
  function api() {
    return {
      groups: GROUPS,
      core35Keys: CORE35_KEYS,
      coachLabel: function (key) { return LABEL_MAP[key] || null; },
      isCore35: function (key) { return CORE35_KEYS.indexOf(key) >= 0; },
      allKeys: function () { return CORE35_KEYS.slice(); },
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
  }
  var inst = api();
  root.CORE35_VAR_GROUPS = inst;
  root.TOP20_VAR_GROUPS = inst;
})(typeof window !== 'undefined' ? window : globalThis);
