/**
 * new_eval_display_guard.js — P0 render-only coach/research display policy (registry-aligned)
 * Blocks low-confidence / deferred variables from coach independent cards.
 */
(function (root) {
  'use strict';

  var MECHANIC_BAND_BASIS = '엘리트 정상군 20 고정 IQR 밴드';
  var FITNESS_COHORT_BASIS = '상동고 팀 내부 16명';
  var LOAD_BAND_BASIS = '엘리트20 + robust 백분위 · 개인 baseline 병행 가능';
  var CONSISTENCY_AXIS = '실행 신뢰성 · 반복성';

  var DEFERRED_KEYS = {
    pelvisTrunkGapMs: 1,
    predVelGap: 1,
    earlyArmRisk: 1,
    merTiming: 1
  };

  var EXPLICIT_LOW = {
    handSpeed: 1,
    forearmRot: 1,
    releaseTiming: 1,
    handPath: 1,
    elbAbs: 1,
    blockRiskPenalty: 1,
    blockingType: 1,
    vgrfRetain: 1,
    trunkLatV: 1
  };

  function isCoachIndependentBlocked(key) {
    if (!key) return false;
    try {
      if (typeof COACH_FIELD_V3 !== 'undefined') {
        if (COACH_FIELD_V3.isCoachHiddenFromPlayer && COACH_FIELD_V3.isCoachHiddenFromPlayer(key)) return true;
        if (COACH_FIELD_V3.isMechanismSupportKey && COACH_FIELD_V3.isMechanismSupportKey(key)) return true;
        if (COACH_FIELD_V3.isVisualAidKey && COACH_FIELD_V3.isVisualAidKey(key)) return true;
      }
    } catch (e) {}
    if (key === 'trunkLatV') return true;
    if (key === 'blockRiskPenalty' || key === 'blockingType' || key === 'vgrfRetain') return true;
    if (key === 'armRotV' || key === 'handSpeed' || key === 'forearmRot') return true;
    var Av = root.ARM_RELEASE_V1;
    if (Av) {
      if (Av.isLowConfidenceKey && Av.isLowConfidenceKey(key)) return true;
      if (Av.isOutputKey && Av.isOutputKey(key)) return true;
      if (Av.isLoadLayerKey && Av.isLoadLayerKey(key)) return true;
    }
    if (EXPLICIT_LOW[key] || DEFERRED_KEYS[key]) return true;
    if (key === 'armTransferRatio' || key === 'shGen') return true;
    return false;
  }

  function researchPolicyBadge(key) {
    if (!key) return null;
    if (DEFERRED_KEYS[key]) return { label: '보류', title: 'deferred_rule · 선수·코치 독립 카드 금지' };
    if (isCoachIndependentBlocked(key)) return { label: '재검증 대상', title: 'measurement_confidence=low · 연구자 탐색' };
    return null;
  }

  function researchPolicyBadgeHtml(key) {
    var b = researchPolicyBadge(key);
    if (!b) return '';
    return ' <span class="neg-eval-badge ' + (b.label === '보류' ? 'neg-deferred' : 'neg-low-conf') + '" title="' + b.title + '">' + b.label + '</span>';
  }

  function mechanicBandBadgeHtml() {
    return '<span class="lf-v1-cohort-badge" title="band_source=elite20 · cohort_basis=엘리트 정상군 20">' + MECHANIC_BAND_BASIS + '</span>';
  }

  var LOW_CONF_LABELS = /손\s*속도|handSpeed|전완|forearm|릴리스\s*타이밍|releaseTiming|팔꿈치\s*외반|elbow_valgus|팔\s*주도|arm_dominant|armTransferRatio|블로킹\s*위험|blockRiskPenalty|type_context|수직\s*GRF\s*fallback|vgrfRetain|trunkLat\s*\(\s*signed\s*\)|몸통\s*좌우\s*기울기\s*속도|trunkLatV/i;
  var DEFERRED_LABELS = /예측구속|predVelGap|보상.*원위|pelvisTrunkGap|골반.*몸통\s*시퀀스|팔\s*주도\s*보상|earlyArmRisk/i;

  function collectExpressionSurfaces(mode) {
    mode = mode || 'coach';
    var out = [];
    function push(surface, selector, el, kind) {
      if (!el) return;
      var text = String(el.innerText || '').trim();
      if (!text) return;
      out.push({ surface: surface, selector: selector, kind: kind || 'panel', text: text });
    }
    function pushTitle(surface, el) {
      if (!el) return;
      var t = el.getAttribute('title');
      if (!t || t.length < 3) return;
      out.push({ surface: surface, selector: el.id ? ('#' + el.id) : (el.className || '[title]'), kind: 'tooltip', text: t });
    }
    if (mode === 'coach' || mode === 'all') {
      push('coach', '#page-feedback-view', document.getElementById('page-feedback-view'), 'page');
      push('coach', '#coach-flow-sticky', document.getElementById('coach-flow-sticky'), 'map');
      push('coach', '#coach-phase-detail', document.getElementById('coach-phase-detail'), 'detail');
      push('coach', '.coach-cue-side', document.querySelector('.coach-cue-side'), 'cue');
      push('coach', '[data-lf-load-badge]', document.querySelector('[data-lf-load-badge]'), 'badge');
      push('coach', '[data-lf-fitness-card]', document.querySelector('[data-lf-fitness-card]'), 'fitness');
      document.querySelectorAll('.coach-var-nav-item, .ar-v1-card, .cp-cue, .cp-drill, .cp-problem, .coach-phase-summary').forEach(function (el, i) {
        push('coach', '.coach-var-nav-item|' + i, el, el.classList.contains('cp-cue') ? 'cue' : (el.classList.contains('cp-drill') ? 'drill' : 'panel'));
      });
      document.querySelectorAll('#coach-flow-sticky [title], .coach-cue-side [title], .skeleton-toolbar [title], #stick-fit-view').forEach(function (el) {
        pushTitle('coach', el);
      });
    }
    if (mode === 'research' || mode === 'all') {
      push('research', '#analyst-doc-side', document.getElementById('analyst-doc-side'), 'panel');
      push('research', '#theory-view-body', document.getElementById('theory-view-body'), 'theory');
      document.querySelectorAll('#analyst-doc-side .ad-sec, #analyst-doc-side .research-expert-title').forEach(function (el, i) {
        push('research', '#analyst-doc-side .ad-sec|' + i, el, 'panel');
      });
    }
    return out;
  }

  function runStructuralAudit() {
    var v = [];
    function add(rule, selector, snippet, suggest) {
      v.push({ surface: 'coach', selector_or_function: selector, original_text: snippet, rule: rule, suggested_rewrite: suggest || '' });
    }
    var chips = Array.from(document.querySelectorAll('.coach-phase-chip'));
    chips.forEach(function (c) {
      var t = c.innerText || '';
      if (/^\d+\s*앞무릎|^\d+\s*lead\s*knee/i.test(t)) {
        add('F', '.coach-phase-chip', t.slice(0, 120), '블로킹 · 앞다리 버팀(하위 상세)으로 흡수');
      }
    });
    var windupTxt = '';
    document.querySelectorAll('.coach-phase-chip, #coach-phase-detail, #analyst-doc-side').forEach(function (el) {
      if ((el.innerText || '').indexOf('와인드업') >= 0) windupTxt += el.innerText + '\n';
    });
    if (/x[- ]?factor|엑스팩터|x_factor/i.test(windupTxt) && /와인드업.*(점수|판정|우수|보완|결함)/i.test(windupTxt)) {
      add('F', 'windup+x-factor', 'x-factor in windup scoring context', 'x-factor는 드라이브/몸통 소유 · 와인드업 직접 판정 금지');
    }
    document.querySelectorAll('.coach-var-nav-item[data-var-key], .ar-v1-card[data-var-key]').forEach(function (el) {
      var key = el.getAttribute('data-var-key');
      if (key && isCoachIndependentBlocked(key)) {
        add('D', '[data-var-key=' + key + ']', (el.innerText || '').slice(0, 160), 'low-confidence · 연구자/추가확인만');
      }
    });
    document.querySelectorAll('.ar-v1-card, .coach-var-nav-item').forEach(function (el) {
      var t = el.innerText || '';
      if (DEFERRED_LABELS.test(t) && t.indexOf('보류') < 0 && el.closest('#page-feedback-view')) {
        add('E', el.className, t.slice(0, 120), '보류 항목 · 선수·코치 독립 카드 금지');
      }
    });
    var armCards = Array.from(document.querySelectorAll('.ar-v1-card, #coach-phase-detail'));
    armCards.forEach(function (el) {
      var t = el.innerText || '';
      if (/팔 회전속도|armRotV/i.test(t) && t.indexOf('MER') < 0 && t.indexOf('출력') < 0 && /결함|부족|독립/i.test(t)) {
        add('F', '.ar-v1-card', t.slice(0, 120), '팔 단계 대표=MER 적정 범위 · armRotV는 결과');
      }
    });
    var side = document.getElementById('analyst-doc-side');
    if (side && side.offsetParent !== null) {
      var stxt = side.innerText || '';
      if (stxt.length > 80 && stxt.indexOf('엘리트') < 0 && stxt.indexOf('elite') < 0 && /밴드|백분위|IQR|p25|p75/i.test(stxt)) {
        add('G', '#analyst-doc-side', 'band text without cohort label', MECHANIC_BAND_BASIS);
      }
      if (stxt.length > 120 && !side.querySelector('[data-ar-confidence-table], [data-lf-load-confidence], .lf-v1-mini-table') && /변인|MER|드라이브|회전/i.test(stxt)) {
        add('G', '#analyst-doc-side', 'research panel missing confidence table', '측정 신뢰 등급 high/medium/low 표시');
      }
    }
    return v;
  }

  function runSmokeAudit(mode) {
    var surfaces = collectExpressionSurfaces(mode || 'all');
    var violations = runStructuralAudit();
    return { surfaces: surfaces, structuralViolations: violations, surfaceCount: surfaces.length };
  }

  root.NEW_EVAL_GUARD = {
    MECHANIC_BAND_BASIS: MECHANIC_BAND_BASIS,
    FITNESS_COHORT_BASIS: FITNESS_COHORT_BASIS,
    LOAD_BAND_BASIS: LOAD_BAND_BASIS,
    CONSISTENCY_AXIS: CONSISTENCY_AXIS,
    isCoachIndependentBlocked: isCoachIndependentBlocked,
    researchPolicyBadge: researchPolicyBadge,
    researchPolicyBadgeHtml: researchPolicyBadgeHtml,
    mechanicBandBadgeHtml: mechanicBandBadgeHtml,
    collectExpressionSurfaces: collectExpressionSurfaces,
    runStructuralAudit: runStructuralAudit,
    runSmokeAudit: runSmokeAudit
  };
})(typeof window !== 'undefined' ? window : globalThis);
