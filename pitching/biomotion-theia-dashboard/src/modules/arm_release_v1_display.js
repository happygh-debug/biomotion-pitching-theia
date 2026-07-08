/**
 * arm_release_v1_display.js — 팔 전달·방출 v1 (render-only · 보수 운영)
 * 독립 카드 1개(MER 저장·방출 준비) · low-confidence 차단 · measurement confidence table
 */
(function (root) {
  'use strict';

  var V1_STATUS = ['우수', '보완', '결함'];
  var COACH_MER_INTRO = '공을 던지기 직전 어깨가 뒤로 넘어가며 힘을 저장하는 구간이 적정 범위인지 확인합니다. 팔을 억지로 더 젖히거나 더 빨리 돌리라는 뜻이 아니라, 몸통에서 넘어온 회전 에너지가 어깨에 자연스럽게 저장·방출되는지를 보는 항목입니다.';
  var COACH_OUTPUT_INTRO = '어깨 IR 속도와 손 속도는 최종 출력 결과입니다. 이 값 자체를 교정 목표로 삼지 않고, 몸통 전달·MER·부하와 함께 해석합니다.';
  var OUTPUT_KEYS = { armRotV: 1, humME: 1, handSpeed: 1, releaseSdMm: 1, whipRatio: 1, armSlotSdDeg: 1 };
  var LOAD_LAYER_KEYS = { shGen: 1, elbAbs: 1, scapLoad: 1, armLoad: 1 };
  var FORBIDDEN_CUES = ['더 젖혀', 'lay-back을 더', '팔 회전속도를 더', '손 속도를 높여', '전완을 더 강하게', '팔을 더 빨리'];

  var CONFIDENCE_ROWS = [
    { key: 'merPk', label: 'MER 각도', level: 'high', coachCard: '독립 카드', note: 'shoulder_mer_angle' },
    { key: 'armSlot', label: '팔 슬롯각', level: 'high', coachCard: '—', note: '' },
    { key: 'merTiming', label: 'MER 타이밍', level: 'medium', coachCard: '—', note: 'peak 시점' },
    { key: 'ppTrunkHum', label: '몸통→어깨 peak 간격', level: 'medium', coachCard: '보조 연결', note: '' },
    { key: 'armRotV', label: '어깨 IR 속도', level: 'medium', coachCard: '결과값만', note: '교정 cue 금지' },
    { key: 'handSpeed', label: '손 속도', level: 'low', coachCard: '선수용 독립판정 금지', note: '공 추적 후 재평가' },
    { key: 'forearmRot', label: '전완 장축회전', level: 'low', coachCard: '선수용 독립판정 금지', note: '마커 재검증' },
    { key: 'releaseTiming', label: '릴리스 타이밍/방향', level: 'low', coachCard: '선수용 독립판정 금지', note: '공 추적' },
    { key: 'handPath', label: '손 경로', level: 'low', coachCard: '선수용 독립판정 금지', note: '공 추적' },
    { key: 'armLoad', label: '어깨·팔꿈치 부하', level: 'low', coachCard: '부하 레이어', note: 'shGen·elbAbs·humME' }
  ];

  var STICK_PRESETS = {
    mer_storage_release: {
      displayMode: 'stick', view: 'side', overlay: 'armSlot', helperGraph: 'mer-angle-band',
      phaseKey: 'arm', event: 'MER', repVar: 'merPk', label: 'MER 저장·방출 — 외회전 arc'
    },
    trunk_arm_timing: {
      displayMode: 'stick', view: 'rear', overlay: 'timing', helperGraph: 'trunk-arm-timing-lollipop',
      phaseKey: 'arm', event: 'FC', repVar: 'ppTrunkHum', label: '몸통→팔 타이밍'
    },
    load_cross_link: {
      displayMode: 'stick', view: 'side', overlay: 'loadMarker', helperGraph: 'arm-load-context',
      phaseKey: 'arm', event: 'BR', repVar: 'shGen', label: '부하 레이어'
    }
  };

  var CARD_DEF = {
    id: 'mer_storage_release', title: 'MER 저장·방출 준비', judgmentKey: 'shoulder_mer_angle', proxyKeys: ['merPk'],
    evidence: 'MER 각도 peak',
    cue: '팔을 억지로 뒤로 젖히려 하지 말고, 몸통 회전이 먼저 돌아 나온 뒤 팔이 자연스럽게 늦게 따라오는 느낌을 만듭니다. 저장은 팔로 만드는 것이 아니라 몸통 뒤에 팔이 늦게 따라오며 생기는 것입니다.',
    cueNote: '더 젖혀라·lay-back 키워라·팔/손 속도 올려라·전완 강하게 — 금지',
    drills: ['리듬 분리 캐치볼', '벽 보고 외회전 감각 드릴'],
    drillsMore: ['단계별 2단계 throw'],
    nextGoal: 'MER 각도가 적정 범위 안으로 들어오는지, 그리고 어깨·팔꿈치 부하가 동반 상승하지 않는지 함께 확인합니다.',
    researchTab: 'ed-armball'
  };

  var DIAG_GOOD = '공을 던지기 직전 어깨가 뒤로 넘어가며 힘을 저장하는 구간이 적절합니다. 몸통에서 넘어온 회전 에너지를 어깨에 저장했다가 자연스럽게 방출할 준비가 잘 되어 있습니다.';
  var DIAG_LOW = '어깨 lay-back, 즉 뒤로 젖혀지며 힘을 저장하는 구간이 부족합니다. 내회전근이 충분히 늘어났다 줄어드는 탄성 저장 준비가 약해, 몸통 힘을 공으로 효율적으로 방출하기 어려울 수 있습니다.';
  var DIAG_HIGH = '어깨 lay-back이 과도합니다. 구속에는 유리할 수 있지만 어깨·팔꿈치 부하와 함께 확인이 필요합니다. 부하 레이어를 함께 보세요.';

  function merLevelSublabel(level) {
    if (level === 'low') return '저장 부족';
    if (level === 'high') return '과다 · 부하 확인';
    return '적정';
  }

  function isOutputKey(key) {
    return !!(key && OUTPUT_KEYS[key]);
  }

  function isLoadLayerKey(key) {
    return !!(key && (LOAD_LAYER_KEYS[key] || key === 'humME'));
  }

  function coachMerIntroHtml() {
    return COACH_MER_INTRO;
  }

  function coachOutputPanelHtml(key, m) {
    var val = (m && m.value != null && isFinite(m.value)) ? (m.value + (m.unit || '')) : '—';
    var lbl = (m && m.label) ? m.label : key;
    return COACH_OUTPUT_INTRO
      + (val !== '—' ? (' · 참고 ' + lbl + ' ' + val) : '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mapRangeToV1(bw) {
    if (!bw) return '보완';
    if (bw === '부족' || bw === '미흡') return '결함';
    if (bw === '높음') return '결함';
    if (bw === '우수' || bw === '엘리트 범위') return '우수';
    if (bw === '정상') return '보완';
    return '보완';
  }

  function merLevelFromBand(bw) {
    if (bw === '부족' || bw === '미흡') return 'low';
    if (bw === '높음') return 'high';
    return 'adequate';
  }

  function diagnosisForMer(level, v1) {
    if (v1 === '우수' && level === 'adequate') return DIAG_GOOD;
    if (level === 'low') return DIAG_LOW;
    if (level === 'high') return DIAG_HIGH;
    if (v1 === '우수') return DIAG_GOOD;
    return level === 'high' ? DIAG_HIGH : DIAG_LOW;
  }

  function metricFromDet6(det6, key) {
    if (!det6 || !key) return null;
    var buckets = ['arm', 'trunk', 'block', 'stride'];
    for (var bi = 0; bi < buckets.length; bi++) {
      var arr = det6[buckets[bi]];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].key === key) return arr[i];
      }
    }
    return null;
  }

  function judgeMer(det6, M6, NB) {
    var m = metricFromDet6(det6, 'merPk');
    if (!m || m.value == null || !isFinite(m.value)) {
      return { status: '보완', details: [], merLevel: 'adequate', loadWarning: false };
    }
    var nm = NB && NB.merPk;
    var bw = (M6 && M6.bandWord && nm) ? M6.bandWord(m.value, nm, m.dir || 'range') : null;
    var v1 = mapRangeToV1(bw);
    var level = merLevelFromBand(bw);
    return {
      status: v1,
      merLevel: level,
      loadWarning: level === 'high',
      bandWord: bw,
      details: [{ key: 'merPk', label: 'MER 각도 peak', value: m.value, unit: m.unit || '°', v1Status: v1, bandWord: bw }]
    };
  }

  function buildTrunkArmTiming(det6) {
    var pp = metricFromDet6(det6, 'ppTrunkHum');
    var val = (pp && pp.value != null && isFinite(pp.value)) ? (pp.value + (pp.unit || 'ms')) : null;
    return {
      title: '몸통→팔 전달 타이밍',
      text: '몸통 회전이 팔로 이어지는 타이밍을 함께 확인합니다. 자세한 몸통 전달 평가는 몸통 단계와 연결해서 보세요.',
      value: val,
      independentBadge: false
    };
  }

  function buildCompensationPending(DATA) {
    var P = DATA && DATA.phases;
    var ea = P && P.earlyArm;
    var active = !!(ea && ea.label && ea.label !== 'normal');
    return {
      active: active,
      coachOnly: true,
      text: '몸통에서 팔로 힘이 잘 넘어갔는지, 즉 팔 주도 보상 여부는 현재 마커리스 부하 지표만으로 단정하지 않습니다. 공 추적·마커 기반 부하 검증 후 재평가합니다.',
      label: ea && ea.label === 'risk' ? '조기 장전 신호' : (ea && ea.label === 'warn' ? '조기 장전 주의' : null)
    };
  }

  function buildOutputResults(det6, DATA) {
    var lines = [];
    var armRot = metricFromDet6(det6, 'armRotV');
    if (armRot && armRot.value != null) {
      lines.push({ key: 'armRotV', label: '어깨 IR 속도 peak', value: armRot.value, unit: armRot.unit || '°/s' });
    }
    var hum = metricFromDet6(det6, 'humME');
    if (hum && hum.value != null) {
      lines.push({ key: 'humME', label: '상완 ME peak', value: hum.value, unit: hum.unit || 'J' });
    }
    try {
      var hs = (typeof ETDIAG !== 'undefined' && ETDIAG && ETDIAG.armball) ? ETDIAG.armball.handSpeedPeak : null;
      if (hs != null && isFinite(hs)) lines.push({ key: 'handSpeed', label: '손 속도 peak(참고)', value: hs, unit: 'm/s' });
    } catch (e) {}
    return {
      intro: '최종 출력은 결과값으로만 기록합니다. 그 원인이 몸통 전달인지 팔 보상인지는 부하와 타이밍을 함께 봐야 하므로, 이 값 자체를 교정 대상으로 삼지 않습니다.',
      lines: lines,
      resultOnly: true
    };
  }

  function buildAllCoachCards(det6, M6, NB, DATA) {
    var judgment = judgeMer(det6, M6, NB);
    var card = {
      id: CARD_DEF.id,
      title: CARD_DEF.title,
      judgmentKey: CARD_DEF.judgmentKey,
      diagnosis: diagnosisForMer(judgment.merLevel, judgment.status),
      evidence: 'MER 각도 peak',
      cue: CARD_DEF.cue,
      cueNote: CARD_DEF.cueNote,
      drills: CARD_DEF.drills || [],
      drillsMore: CARD_DEF.drillsMore || [],
      nextGoal: CARD_DEF.nextGoal,
      researchTab: CARD_DEF.researchTab,
      stickPreset: STICK_PRESETS.mer_storage_release,
      v1Status: judgment.status,
      v1StatusLabel: judgment.status,
      metricDetails: judgment.details || [],
      merLevel: judgment.merLevel,
      loadWarning: judgment.loadWarning,
      trunkArmTiming: buildTrunkArmTiming(det6),
      compensationPending: buildCompensationPending(DATA),
      outputResults: buildOutputResults(det6, DATA),
      independent: true,
      visible: true
    };
    return [card];
  }

  function buildCoachCards(det6, M6, NB, DATA) {
    return buildAllCoachCards(det6, M6, NB, DATA);
  }

  function statusStyle(v1) {
    if (v1 === '우수') return 'color:var(--green);font-weight:800';
    if (v1 === '결함') return 'color:var(--red);font-weight:800';
    if (v1 === '보완') return 'color:var(--amber);font-weight:800';
    return 'color:var(--fg2);font-weight:700';
  }

  function trunkArmTimingHtml(timing) {
    if (!timing) return '';
    return '<div class="ar-v1-timing" data-ar-xfer-timing="1">'
      + '<div class="sub2" style="font-weight:700;margin-top:8px;margin-bottom:4px">' + esc(timing.title) + ' <span class="sub2">(연결 · badge 없음)</span></div>'
      + '<div class="note" style="line-height:1.5;font-size:12px">' + esc(timing.text) + '</div>'
      + (timing.value ? ('<div class="sub2" style="margin-top:4px">참고 · ' + esc(timing.value) + '</div>') : '')
      + '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvArmReleaseStickPreset(\'trunk_arm_timing\')" style="font-size:11px;padding:3px 9px">Stick · 타이밍</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-trunk\')" style="font-size:11px;padding:3px 9px">몸통 단계 →</button>'
      + '</div></div>';
  }

  function compensationBadgeHtml(comp, coachMode) {
    if (!comp || !coachMode) return '';
    return '<div class="ar-v1-comp-badge" data-ar-comp-badge="1" data-coach-only="1">'
      + '<span class="ar-v1-pending-badge" style="color:var(--amber);font-weight:800;font-size:11px">추가 확인 필요</span>'
      + ' <span class="sub2">팔 주도 보상 · 현 측정으로 판정 불가</span>'
      + (comp.label ? (' <span class="sub2">· ' + esc(comp.label) + '</span>') : '')
      + '<div class="note" style="margin-top:4px;line-height:1.5;font-size:12px">' + esc(comp.text) + '</div></div>';
  }

  function outputResultsHtml(out, coachMode) {
    if (!out || !out.lines || !out.lines.length) return '';
    var inner = out.lines.map(function (d) {
      return '<li><b>' + esc(d.label) + '</b> · ' + esc(d.value) + esc(d.unit) + ' <span class="sub2">(결과값 · 독립 결함 아님)</span></li>';
    }).join('');
    var wrapStart = coachMode ? '<details class="ar-v1-output-fold">' : '<div class="ar-v1-output">';
    var wrapEnd = coachMode ? '</details>' : '</div>';
    var head = coachMode ? '<summary class="sub2" style="cursor:pointer;font-weight:700;margin-top:8px">출력 결과 · 연구자 링크</summary>' : '<div class="sub2" style="font-weight:700;margin-top:8px">출력 결과</div>';
    return wrapStart + head
      + '<div class="note" style="margin-top:4px;line-height:1.5;font-size:12px">' + esc(out.intro) + '</div>'
      + '<ul class="ar-v1-science-inline" style="margin:6px 0 0;padding-left:18px;font-size:12px">' + inner + '</ul>'
      + wrapEnd;
  }

  function loadCrossLinkHtml(card) {
    if (!card) return '';
    var warn = card.loadWarning ? 'MER 과다·부하 신호 — ' : '';
    return '<div class="ar-v1-load-link" data-ar-load-link="1">'
      + '<div class="sub2" style="font-weight:700;margin-top:8px">부하 레이어 연결</div>'
      + '<div class="note" style="font-size:12px;line-height:1.5">' + warn + '어깨·팔꿈치 부하는 부하 단계에서 확인 · 독립 성능 카드 아님</div>'
      + '<div style="margin-top:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvArmReleaseStickPreset(\'load_cross_link\')" style="font-size:11px;padding:3px 9px;margin-right:6px">Stick · 부하</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'injury\')" style="font-size:11px;padding:3px 9px">부하 단계 →</button>'
      + '</div></div>';
  }

  function coachCardHtml(card, opts) {
    if (!card) return '';
    opts = opts || {};
    var coachMode = !!opts.coachMode;
    var showNums = !!opts.showNumbers;
    var stLbl = card.v1StatusLabel || '보완';
    var merSub = card.merLevel ? (' <span class="ar-v1-mer-sublabel sub2">(' + esc(merLevelSublabel(card.merLevel)) + ')</span>') : '';
    var badge = '<span class="ar-v1-badge" style="' + statusStyle(card.v1Status || stLbl) + '">' + esc(stLbl) + '</span>' + merSub;
    if (card.loadWarning) badge += ' <span class="ar-v1-load-badge" style="color:var(--amber);font-weight:800;font-size:11px">부하 확인</span>';
    var metrics = '';
    if (showNums && card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' ' + esc(d.value) + esc(d.unit) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    } else if (card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' · ' + esc(d.v1Status || '') + (d.bandWord ? (' · ' + esc(d.bandWord)) : '');
      }).join(' · ');
    }
    return '<div class="ar-v1-card" data-ar-card="' + esc(card.id) + '">'
      + '<div class="ar-v1-card-head"><b>' + esc(card.title) + '</b> ' + badge + '</div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55">' + esc(card.diagnosis) + '</div>'
      + (card.evidence ? ('<div class="sub2" style="margin-top:4px">근거 · ' + esc(card.evidence) + '</div>') : '')
      + (metrics ? ('<div class="sub2" style="margin-top:4px">' + metrics + '</div>') : '')
      + trunkArmTimingHtml(card.trunkArmTiming)
      + compensationBadgeHtml(card.compensationPending, coachMode)
      + outputResultsHtml(card.outputResults, coachMode)
      + loadCrossLinkHtml(card)
      + '<div class="note" style="margin-top:6px"><b>cue</b> · ' + esc(card.cue) + '</div>'
      + (card.cueNote ? ('<div class="sub2" style="margin-top:3px">' + esc(card.cueNote) + '</div>') : '')
      + '<div class="note" style="margin-top:4px"><b>드릴</b> · ' + esc((card.drills || []).slice(0, 2).join(' · ')) + '</div>'
      + ((card.drillsMore && card.drillsMore.length && coachMode) ? ('<details class="ar-v1-drills-more" style="margin-top:4px"><summary class="sub2" style="cursor:pointer">추가 드릴</summary><div class="note" style="margin-top:4px">' + esc(card.drillsMore.join(' · ')) + '</div></details>') : '')
      + '<div class="sub2" style="margin-top:4px">다음 측정 · ' + esc(card.nextGoal) + '</div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvArmReleaseStickPreset(\'mer_storage_release\')" style="font-size:11px;padding:4px 9px">Stick preset</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-armball\')" style="font-size:11px;padding:4px 9px">연구자 탭</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'injury\')" style="font-size:11px;padding:4px 9px">부하 레이어</button>'
      + '</div></div>';
  }

  function coachCardsBlockHtml(cards, opts) {
    if (!cards || !cards.length) return '';
    opts = opts || {};
    var card = cards[0];
    return '<div class="ar-v1-block"><div class="sub2" style="font-size:11px;margin-bottom:8px">팔 전달·방출 v1 · 독립 카드=MER 1개 · low confidence 차단 · Stick-only</div>'
      + coachCardHtml(card, opts) + '</div>';
  }

  function confidenceTableHtml() {
    var rows = CONFIDENCE_ROWS.map(function (r) {
      var lowBlock = r.level === 'low' ? ' <span class="sub2">선수용 독립판정 금지</span>' : '';
      return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.level) + '</td><td>' + esc(r.coachCard) + lowBlock + '</td><td class="sub2">' + esc(r.note) + '</td></tr>';
    }).join('');
    return '<div class="ad-sec ar-v1-confidence" data-ar-confidence-table="1"><b>Measurement confidence</b>'
      + '<table class="ar-v1-mini-table"><thead><tr><th>변인</th><th>등급</th><th>coach</th><th>비고</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="sub2" style="margin-top:6px">CV=정밀도≠정확도 · low=공 추적/마커 재검증 후 재평가</p></div>';
  }

  function scienceAccordion(title, bodyHtml, extraClass) {
    return '<details class="ar-v1-science-acc' + (extraClass ? ' ' + extraClass : '') + '">'
      + '<summary class="ar-v1-science-sum">' + esc(title) + '</summary>'
      + '<div class="ar-v1-science-body">' + bodyHtml + '</div></details>';
  }

  function researchScienceAccordionsHtml(cards) {
    var card = (cards && cards[0]) || {};
    var lenses = '<ul>'
      + '<li><b>기능해부학</b> — 회전 cuff·견갑 안정 · MER=저장 not 강제 젖히기</li>'
      + '<li><b>바이오메카닉스</b> — proximal-to-distal · MER 적정 범위 · 과다=부하</li>'
      + '<li><b>근신경역학</b> — SSC · IR 속도=결과 not cue target</li>'
      + '<li><b>모터컨트롤</b> — 외적 cue · rate cue 지양 · 몸통 선행</li></ul>';
    var strat = '<ul><li>스킬·유형 내 kinetic chain · pooled≠개인 인과</li>'
      + '<li>엘리트 내부 드문 신호 — 연구자용</li></ul>';
    var limits = '<ul><li>손·릴리스·전완 low confidence · 공 추적 Theia 후 재평가</li>'
      + '<li>팔 주도 보상 — 현 측정 체계로 판정 불가(보상 없음 단정 금지)</li></ul>';
    var ballTrack = '<ul><li>구속·스핀·릴리스 순간 — ball tracking 도입 후 출력 지표 대체</li>'
      + '<li>marker_revalidation_required 변인 — 고속영상·마커 QC</li></ul>';
    var guard = '<ul><li>독립 evaluation_status=TRUE → merPk only</li>'
      + '<li>owner_layer=load → injury/부하 탭</li></ul>';
    var refs = '<ul><li>Putnam · Fleisig · Wulf — 대표 문헌</li></ul>';
    return scienceAccordion('MER 각도 상세', '<p>' + esc(card.diagnosis || '') + '</p><p class="sub2">양방향 range · 높을수록 좋다 금지</p>', 'ar-v1-science-mer')
      + scienceAccordion('몸통→어깨 전달 타이밍', '<p>' + esc((card.trunkArmTiming && card.trunkArmTiming.text) || '') + '</p>', 'ar-v1-science-timing')
      + scienceAccordion('출력 지표의 한계', '<p>' + esc((card.outputResults && card.outputResults.intro) || '') + '</p>', 'ar-v1-science-output')
      + scienceAccordion('팔 주도 보상 — 판정 보류', '<p>' + esc((card.compensationPending && card.compensationPending.text) || '') + '</p>', 'ar-v1-science-comp')
      + scienceAccordion('공 추적 Theia 재평가', ballTrack, 'ar-v1-science-ball')
      + scienceAccordion('과학근거 4렌즈', lenses, 'ar-v1-science-lenses')
      + scienceAccordion('스킬 / 유형 층화', strat, 'ar-v1-science-strat')
      + scienceAccordion('한계', limits, 'ar-v1-science-limits')
      + scienceAccordion('참고문헌', refs, 'ar-v1-science-refs')
      + scienceAccordion('Cursor 구현 가드레일', guard, 'ar-v1-science-guard');
  }

  function researchOverviewHtml(cards, DATA) {
    cards = cards || [];
    DATA = DATA || (typeof window !== 'undefined' && window.DATA) || null;
    var card = cards[0] || {};
    var rows = cards.map(function (c) {
      return '<tr><td>' + esc(c.title) + '</td><td style="' + statusStyle(c.v1Status) + '">' + esc(c.v1StatusLabel || '—') + '</td><td>' + esc(c.judgmentKey || '') + '</td></tr>';
    }).join('');
    return '<div class="research-expert-title">팔 전달·방출 — kinetic chain expert</div>'
      + '<div class="ad-sec ar-v1-science-top"><b>기능적 의도</b><br>'
      + '몸통 회전 에너지 → MER 저장 → IR·팔꿈치·손 방출 · <b>독립 판정=MER 1개</b> · low confidence=연구자/재검증 · 출력=결과값.</div>'
      + confidenceTableHtml()
      + (rows ? ('<div class="ad-sec"><b>독립 판정 1축</b><table class="ar-v1-mini-table"><thead><tr><th>카드</th><th>상태</th><th>키</th></tr></thead><tbody>' + rows + '</tbody></table></div>') : '')
      + '<div class="ar-v1-science-acc-wrap">' + researchScienceAccordionsHtml(cards) + '</div>'
      + '<div class="ad-sec sub2">팔 v1 · render-only · MER only independent · 계산 SSOT 미변경</div>';
  }

  function getStickPreset(cardId) {
    return STICK_PRESETS[cardId] || null;
  }

  function isLowConfidenceKey(key) {
    for (var i = 0; i < CONFIDENCE_ROWS.length; i++) {
      if (CONFIDENCE_ROWS[i].key === key && CONFIDENCE_ROWS[i].level === 'low') return true;
    }
    if (key === 'humME' || key === 'shGen' || key === 'elbAbs') return true;
    return false;
  }

  root.ARM_RELEASE_V1 = {
    V1_STATUS: V1_STATUS,
    CARD_DEF: CARD_DEF,
    STICK_PRESETS: STICK_PRESETS,
    CONFIDENCE_ROWS: CONFIDENCE_ROWS,
    FORBIDDEN_CUES: FORBIDDEN_CUES,
    COACH_MER_INTRO: COACH_MER_INTRO,
    COACH_OUTPUT_INTRO: COACH_OUTPUT_INTRO,
    OUTPUT_KEYS: OUTPUT_KEYS,
    merLevelSublabel: merLevelSublabel,
    isOutputKey: isOutputKey,
    isLoadLayerKey: isLoadLayerKey,
    coachMerIntroHtml: coachMerIntroHtml,
    coachOutputPanelHtml: coachOutputPanelHtml,
    buildCoachCards: buildCoachCards,
    buildAllCoachCards: buildAllCoachCards,
    coachCardHtml: coachCardHtml,
    coachCardsBlockHtml: coachCardsBlockHtml,
    researchOverviewHtml: researchOverviewHtml,
    confidenceTableHtml: confidenceTableHtml,
    mapRangeToV1: mapRangeToV1,
    getStickPreset: getStickPreset,
    isLowConfidenceKey: isLowConfidenceKey,
    metricFromDet6: metricFromDet6
  };
})(typeof window !== 'undefined' ? window : globalThis);
