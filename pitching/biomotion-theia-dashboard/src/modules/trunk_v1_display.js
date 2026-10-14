/**
 * trunk_v1_display.js — 몸통 v1 표시 레이어 (계산·판정 SSOT 변경 없음)
 * 독립 판정 1축(몸통 각속도 peak) · x-factor 풀림·기울기 부하·팔 연결 보조 · 연구자 패널 · Stick preset
 */
(function (root) {
  'use strict';

  var V1_STATUS = ['우수', '보완', '결함'];
  var FORBIDDEN_CUES = ['더 기울여', '더 빨리 돌려', '허리를 비틀', '측굴을 더', '팔이 먼저'];

  var STICK_PRESETS = {
    trunk_rotation_generation: {
      displayMode: 'stick', view: 'rear', overlay: 'thoraxRot', helperGraph: 'trunk-rotation-velocity-time-series',
      phaseKey: 'trunk', event: 'FC', repVar: 'torsoRotV', label: '몸통 회전 생성 — FC→BR peak'
    },
    xfactor_unwind: {
      displayMode: 'stick', view: 'rear', overlay: 'pelvisSho', helperGraph: 'xfactor-time-series',
      phaseKey: 'trunk', event: 'FC', repVar: 'xfUnwindV', label: 'x-factor 풀림 — FC→BR'
    },
    trunk_lean_load: {
      displayMode: 'stick', view: 'front', overlay: 'trunkLat', helperGraph: 'trunk-lean-delta',
      phaseKey: 'trunk', event: 'BR', repVar: 'trunkLatV', label: '몸통 기울기 — 부하 경고'
    },
    arm_transfer_link: {
      displayMode: 'stick', view: 'rear', overlay: 'armSlot', helperGraph: 'trunk-arm-timing',
      phaseKey: 'trunk', event: 'FC', repVar: 'armTransferRatio', label: '몸통→팔 연결'
    }
  };

  var CARD_DEF = {
    id: 'trunk_rotation_generation', title: '몸통 회전 생성 부족', priority: 1, track: 'generation',
    judgmentKey: 'torsoRotV', proxyKeys: ['torsoRotV'],
    diagnosis: '앞다리에서 만들어진 제동과 회전 준비가 몸통 회전으로 충분히 살아나지 않아, 팔에 넘길 회전 에너지가 부족합니다.',
    evidence: '몸통 각속도 peak',
    cue: '몸통을 억지로 빨리 돌리기보다, 앞발이 버틴 뒤 가슴이 타깃으로 돌아나가며 팔을 끌고 나오게 합니다.',
    cueNote: '더 빨리 돌려라·허리를 비틀어라·측굴을 더 만들어라·팔이 먼저 나오게 — 금지',
    drills: ['앞발 버팀 후 몸통 회전 메디신볼 토스', '골반 먼저-몸통 따라오기 시퀀스', 'step-behind 회전 throw'],
    nextGoal: '몸통 각속도 peak 개선 · 측굴·팔 부하 동반 증가 여부 확인',
    researchTab: 'ed-trunk'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mapBandToV1(bw) {
    if (!bw) return '보완';
    if (bw === '체크필요' || bw === '부족') return '결함';
    if (bw === '우수') return '우수';
    return '보완';
  }

  function selectedTrial(DATA) {
    try {
      if (typeof window !== 'undefined' && typeof _fvSelectedTrial === 'function') return _fvSelectedTrial();
    } catch (e) {}
    var ts = DATA && DATA.trials;
    return (ts && ts.length) ? ts[0] : null;
  }

  function metricFromDet6(det6, key) {
    if (!det6 || !key) return null;
    var buckets = ['trunk', 'block', 'stride', 'arm'];
    for (var bi = 0; bi < buckets.length; bi++) {
      var arr = det6[buckets[bi]];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].key === key) return arr[i];
      }
    }
    return null;
  }

  function metricFromPhases(key, DATA) {
    if (!DATA || !DATA.phases || !DATA.phases.stages) return null;
    for (var si = 0; si < DATA.phases.stages.length; si++) {
      var metrics = DATA.phases.stages[si].metrics || [];
      for (var mi = 0; mi < metrics.length; mi++) {
        if (metrics[mi] && metrics[mi].key === key) return metrics[mi];
      }
    }
    return null;
  }

  function judgeTrunkRotation(det6, M6, NB) {
    var m = metricFromDet6(det6, 'torsoRotV');
    if (!m || m.value == null || !isFinite(m.value)) return { status: '보완', details: [] };
    var nm = NB && NB.torsoRotV;
    var bw = (M6 && M6.bandWord && nm) ? M6.bandWord(m.value, nm, m.dir) : null;
    var v1 = mapBandToV1(bw);
    return {
      status: v1,
      details: [{ key: 'torsoRotV', label: '몸통 각속도 peak', value: m.value, unit: m.unit || '°/s', v1Status: v1, bandWord: bw }]
    };
  }

  function buildXfactorUnwindDescriptor(det6) {
    var m = metricFromDet6(det6, 'xfUnwindV');
    var val = (m && m.value != null && isFinite(m.value)) ? (m.value + (m.unit || '°/s')) : null;
    return {
      key: 'xfUnwindV',
      title: 'x-factor 풀림',
      role: 'mechanism',
      text: '드라이브에서 만든 골반-몸통 분리가 FC 이후 몸통 회전으로 풀리는지 함께 확인합니다.',
      value: val,
      independentBadge: false,
      driveFormationOwner: 'drive',
      unwindingOwner: 'trunk'
    };
  }

  function buildSequenceDescriptors(det6, DATA) {
    var lines = [];
    var pp = metricFromDet6(det6, 'ppTrunkHum');
    if (pp && pp.value != null && isFinite(pp.value)) {
      lines.push({ key: 'ppTrunkHum', label: '골반-몸통 peak 간격(프록시)', value: pp.value, unit: pp.unit || 'ms', researchOnly: true });
    }
    var ct = metricFromDet6(det6, 'chainTiming') || metricFromPhases('chainTiming', DATA);
    if (ct && ct.value != null && isFinite(ct.value)) {
      lines.push({ key: 'chainTiming', label: '체인 타이밍(참고)', value: ct.value, unit: ct.unit || 'ms', researchOnly: true });
    }
    var trial = selectedTrial(DATA);
    if (trial && trial.kseq && trial.kseq.deltas) {
      var d = trial.kseq.deltas;
      if (d.pelvis_to_trunk_ms != null) {
        lines.push({ key: 'pelvis_trunk_peak_interval', label: '골반→몸통 peak 간격', value: d.pelvis_to_trunk_ms, unit: 'ms', researchOnly: true });
      }
      if (trial.kseq.gains && trial.kseq.gains.trunk_over_pelvis != null) {
        lines.push({ key: 'trunk_pelvis_speed_ratio', label: '상하체 속도비', value: trial.kseq.gains.trunk_over_pelvis, unit: '', researchOnly: true });
      }
    }
    return lines;
  }

  function buildArmTransferLink(det6) {
    var m = metricFromDet6(det6, 'armTransferRatio');
    var ref = '';
    if (m && m.value != null && isFinite(m.value)) ref = '몸통→팔 전달 ' + m.value + (m.unit || '%') + ' · ';
    return {
      text: ref + '몸통 회전이 팔로 적시에 넘어갔는지는 팔 전달·방출 단계에서 확인합니다.',
      owner: 'arm',
      repVar: 'armTransferRatio'
    };
  }

  function buildTrunkLeanLoadWarning(det6, M6, NB) {
    var lat = metricFromDet6(det6, 'trunkLatV');
    var abd = metricFromDet6(det6, 'abdSym');
    var warn = false;
    var detail = '';
    if (lat && lat.value != null && isFinite(lat.value) && NB && NB.trunkLatV && M6 && M6.bandWord) {
      var bw = M6.bandWord(lat.value, NB.trunkLatV, lat.dir);
      if (bw === '높음' || bw === '우수') { warn = true; detail = '측굴 속도 상위 · '; }
    }
    if (abd && abd.value != null && isFinite(abd.value) && NB && NB.abdSym && M6 && M6.bandWord) {
      var bw2 = M6.bandWord(abd.value, NB.abdSym, abd.dir);
      if (bw2 === '높음' || bw2 === '우수') { warn = true; detail += '비대칭 기울기 신호 · '; }
    }
    return {
      title: '몸통 기울기 부하 경고',
      role: 'load_warning',
      text: '몸통, 특히 옆으로 기울기로 속도를 보상하는 패턴일 수 있으며, 어깨·팔꿈치 부하와 함께 확인해야 합니다.',
      loadBadge: warn ? '부하 경고' : '참고',
      loadActive: warn,
      detail: detail,
      performanceCard: false
    };
  }

  function buildAllCoachCards(det6, M6, NB, DATA) {
    var judgment = judgeTrunkRotation(det6, M6, NB);
    var card = {
      id: CARD_DEF.id,
      title: CARD_DEF.title,
      priority: CARD_DEF.priority,
      track: CARD_DEF.track,
      judgmentKey: CARD_DEF.judgmentKey,
      diagnosis: CARD_DEF.diagnosis,
      evidence: CARD_DEF.evidence,
      cue: CARD_DEF.cue,
      cueNote: CARD_DEF.cueNote,
      drills: CARD_DEF.drills || [],
      nextGoal: CARD_DEF.nextGoal,
      researchTab: CARD_DEF.researchTab,
      stickPreset: STICK_PRESETS.trunk_rotation_generation,
      visible: true,
      independent: true,
      v1Status: judgment.status,
      v1StatusLabel: judgment.status,
      metricDetails: judgment.details || [],
      xfactorUnwind: buildXfactorUnwindDescriptor(det6),
      trunkLeanLoad: buildTrunkLeanLoadWarning(det6, M6, NB),
      armTransferLink: buildArmTransferLink(det6),
      sequenceDescriptors: buildSequenceDescriptors(det6, DATA)
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

  function xfactorUnwindCoachHtml(xf, cardId) {
    if (!xf) return '';
    return '<div class="tr-v1-xfactor-unwind" data-tr-xfactor-unwind="1" data-tr-parent-card="' + esc(cardId || 'trunk_rotation_generation') + '">'
      + '<div class="sub2" style="font-weight:700;margin-top:8px;margin-bottom:4px">' + esc(xf.title) + ' <span class="sub2" style="font-weight:500">(메커니즘 · badge 없음)</span></div>'
      + '<div class="note" style="line-height:1.5;font-size:12px">' + esc(xf.text) + '</div>'
      + (xf.value ? ('<div class="sub2" style="margin-top:4px">참고값 · ' + esc(xf.value) + ' · 독립 판정 없음</div>') : '')
      + '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvTrunkStickPreset(\'xfactor_unwind\')" style="font-size:11px;padding:3px 9px">Stick · x-factor 풀림</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-stride\')" style="font-size:11px;padding:3px 9px">드라이브 x-factor 형성 →</button>'
      + '</div></div>';
  }

  function trunkLeanLoadCoachHtml(lean) {
    if (!lean) return '';
    var badge = lean.loadActive
      ? '<span class="tr-v1-load-badge" style="color:var(--amber);font-weight:800">' + esc(lean.loadBadge) + '</span>'
      : '<span class="tr-v1-load-badge sub2">' + esc(lean.loadBadge) + '</span>';
    return '<div class="tr-v1-lean-load" data-tr-lean-load="1">'
      + '<div class="sub2" style="font-weight:700;margin-top:8px;margin-bottom:4px">' + esc(lean.title) + ' ' + badge
      + ' <span class="sub2" style="font-weight:500">(성능 카드 아님)</span></div>'
      + '<div class="note" style="line-height:1.5;font-size:12px">' + esc(lean.text) + '</div>'
      + '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvTrunkStickPreset(\'trunk_lean_load\')" style="font-size:11px;padding:3px 9px">Stick · 기울기</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'injury\')" style="font-size:11px;padding:3px 9px">부하 단계 →</button>'
      + '</div></div>';
  }

  function armTransferCrossLinkHtml(link) {
    if (!link) return '';
    return '<div class="tr-v1-crosslink" data-tr-crosslink="arm">'
      + '<div class="sub2" style="font-weight:700;margin-bottom:4px">연결 · 팔 전달로 이어졌는가</div>'
      + '<div class="note" style="line-height:1.5;font-size:12px">' + esc(link.text) + '</div>'
      + '<div style="margin-top:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvTrunkStickPreset(\'arm_transfer_link\')" style="font-size:11px;padding:3px 9px;margin-right:6px">Stick · 연결 확인</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-armball\')" style="font-size:11px;padding:3px 9px">팔 전달·방출 →</button>'
      + '</div></div>';
  }

  function coachCardHtml(card, opts) {
    if (!card) return '';
    opts = opts || {};
    var showNums = !!opts.showNumbers;
    var stLbl = card.v1StatusLabel || '보완';
    var badge = '<span class="tr-v1-badge" style="' + statusStyle(card.v1Status || stLbl) + '">' + esc(stLbl) + '</span>';
    var metrics = '';
    if (showNums && card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' ' + esc(d.value) + esc(d.unit) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    } else if (card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    }
    return '<div class="tr-v1-card" data-tr-card="' + esc(card.id) + '">'
      + '<div class="tr-v1-card-head"><b>' + esc(card.title) + '</b> ' + badge + '</div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55">' + esc(card.diagnosis) + '</div>'
      + (card.evidence ? ('<div class="sub2" style="margin-top:4px">근거 · ' + esc(card.evidence) + '</div>') : '')
      + (metrics ? ('<div class="sub2" style="margin-top:4px">' + metrics + '</div>') : '')
      + xfactorUnwindCoachHtml(card.xfactorUnwind, card.id)
      + trunkLeanLoadCoachHtml(card.trunkLeanLoad)
      + '<div class="note" style="margin-top:6px"><b>cue</b> · ' + esc(card.cue) + '</div>'
      + (card.cueNote ? ('<div class="sub2" style="margin-top:3px">' + esc(card.cueNote) + '</div>') : '')
      + '<div class="note" style="margin-top:4px"><b>드릴</b> · ' + esc((card.drills || []).slice(0, 2).join(' · ')) + '</div>'
      + '<div class="sub2" style="margin-top:4px">다음 측정 · ' + esc(card.nextGoal) + '</div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvTrunkStickPreset(\'trunk_rotation_generation\')" style="font-size:11px;padding:4px 9px">Stick preset</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-trunk\')" style="font-size:11px;padding:4px 9px">연구자 탭</button>'
      + '</div></div>';
  }

  function coachCardsBlockHtml(cards, opts) {
    if (!cards || !cards.length) return '';
    opts = opts || {};
    var card = cards[0];
    var inner = coachCardHtml(card, opts) + armTransferCrossLinkHtml(card && card.armTransferLink);
    return '<div class="tr-v1-block"><div class="sub2" style="font-size:11px;margin-bottom:8px">몸통 v1 · FC→BR · 독립 판정=몸통 각속도 peak · x-factor 풀림=메커니즘 · 기울기=부하</div>'
      + inner + '</div>';
  }

  function scienceAccordion(title, bodyHtml, extraClass) {
    return '<details class="tr-v1-science-acc' + (extraClass ? ' ' + extraClass : '') + '">'
      + '<summary class="tr-v1-science-sum">' + esc(title) + '</summary>'
      + '<div class="tr-v1-science-body">' + bodyHtml + '</div></details>';
  }

  function researchXfactorAccordionHtml(xf) {
    xf = xf || {};
    var body = '<p>드라이브에서 <b>x-factor 형성</b> · 몸통에서 <b>풀림(unwinding)</b> — 동일 값 이중 판정 금지.</p>'
      + '<p>' + esc(xf.text || '') + '</p>'
      + (xf.value ? ('<p class="sub2">xfUnwindV · ' + esc(xf.value) + ' · descriptor</p>') : '')
      + '<p class="sub2">SSC 메커니즘 · badge 없음 · 독립 우수/보완/결함 없음</p>';
    return scienceAccordion('x-factor 풀림 — SSC 메커니즘', body, 'tr-v1-science-xfactor');
  }

  function researchSequenceAccordionHtml(lines) {
    lines = lines || [];
    var rows = lines.length ? lines.map(function (d) {
      return '<tr><td>' + esc(d.label) + '</td><td>' + esc(d.value) + esc(d.unit) + '</td><td class="sub2">연구자 후보 · validity caution</td></tr>';
    }).join('') : '<tr><td colspan="3" class="sub2">마커 기반 재검증 후보 · 개인 인과 단정 금지</td></tr>';
    var body = '<p>골반→몸통 peak 간격·상하체 속도비 — 연구자 레이어 · 독립 coach 판정 승격 없음.</p>'
      + '<table class="tr-v1-mini-table"><thead><tr><th>항목</th><th>값</th><th>역할</th></tr></thead><tbody>' + rows + '</tbody></table>';
    return scienceAccordion('골반→몸통 시퀀스 — 연구자 후보', body, 'tr-v1-science-sequence');
  }

  function researchArmLinkAccordionHtml(link) {
    link = link || {};
    var body = '<p>' + esc(link.text || '') + '</p>'
      + '<p class="sub2">몸통→팔 peak 간격·전달 지수 — 팔 단계 cross-link · armTransferRatio 참고</p>';
    return scienceAccordion('몸통→팔 연결', body, 'tr-v1-science-arm');
  }

  function researchLeanAccordionHtml(lean) {
    lean = lean || {};
    var body = '<p>' + esc(lean.text || '') + '</p>'
      + '<p class="sub2">BR 측방·전방 기울기 — 속도-부하 트레이드오프 · 성능 cue 금지 · '
      + (lean.loadActive ? '현재 trial 부하 경고 신호' : '참고 레이어') + '</p>';
    return scienceAccordion('몸통 기울기 — 속도-부하 트레이드오프', body, 'tr-v1-science-lean');
  }

  function researchScienceAccordionsHtml(cards, DATA) {
    var card = (cards && cards[0]) || {};
    var lenses = '<ul>'
      + '<li><b>기능해부학</b> — 복부·흉곽·견갑 안정 · 회전축 유지</li>'
      + '<li><b>바이오메카닉스</b> — FC→BR 몸통 각속도 peak · x-factor 풀림 메커니즘</li>'
      + '<li><b>근신경역학</b> — proximal-to-distal 순서 · 측굴 보상=부하 가능</li>'
      + '<li><b>모터 컨트롤</b> — 외적 cue(타깃·팔 끌기) · rate cue 지양</li></ul>';
    var strat = '<ul><li><b>스킬 수준</b> — 고교/발달: 회전 생성 · 엘리트: 전달·부하 균형</li>'
      + '<li><b>동작 유형</b> — 유형 내 kinetic chain · pooled 상관≠개인 인과</li>'
      + '<li>엘리트 내부 드문 신호 — 연구자용만</li></ul>';
    var limits = '<ul>'
      + '<li>몸통 각속도 peak — <b>몸통 단계 독립 판정 유일 축</b> · 블로킹 cross-link만</li>'
      + '<li>골반 Z·x-factor 마커리스 validity 한계 · 변화량·순서 위주</li>'
      + '<li>시퀀스·timing CV — 마커 재검증 후보 · coach 독립 판정 없음</li>'
      + '<li>x-factor <b>형성</b>=드라이브 · <b>풀림</b>=몸통 — 중복 판정 금지</li></ul>';
    var follow = '<ul>'
      + '<li><b>블로킹</b> — torsoRotV 독립 판정 없음 · 연결 확인만</li>'
      + '<li><b>팔</b> — armTransferRatio·ppTrunkHum · 방출·부하</li>'
      + '<li>기울기 부하 → injury/부하 탭 cross-link</li></ul>';
    return researchXfactorAccordionHtml(card.xfactorUnwind)
      + researchSequenceAccordionHtml(card.sequenceDescriptors)
      + researchArmLinkAccordionHtml(card.armTransferLink)
      + researchLeanAccordionHtml(card.trunkLeanLoad)
      + scienceAccordion('과학근거 4렌즈', lenses, 'tr-v1-science-lenses')
      + scienceAccordion('층화 분석', strat, 'tr-v1-science-strat')
      + scienceAccordion('데이터 신뢰도·한계', limits, 'tr-v1-science-limits')
      + scienceAccordion('후속 단계 연결', follow, 'tr-v1-science-follow');
  }

  function researchOverviewHtml(cards, DATA) {
    cards = cards || [];
    DATA = DATA || (typeof window !== 'undefined' && window.DATA) || null;
    var card = cards[0] || {};
    var rows = cards.map(function (c) {
      return '<tr><td>' + esc(c.title) + '</td><td style="' + statusStyle(c.v1Status) + '">' + esc(c.v1StatusLabel || '—') + '</td><td>' + esc(c.judgmentKey || '') + '</td></tr>';
    }).join('');
    return '<div class="research-expert-title">몸통 — kinetic chain expert</div>'
      + '<div class="ad-sec tr-v1-science-top"><b>기능적 의도</b><br>'
      + '골반·블로킹에서 넘어온 에너지가 <b>몸통 회전으로 살아나 팔에 넘어갔는가</b> · '
      + '독립 판정은 몸통 각속도 peak 하나 · x-factor 풀림=메커니즘 · 시퀀스=연구자 · 기울기=부하.</div>'
      + '<div class="ad-sec"><b>핵심 질문</b><br>골반에서 받은 회전이 몸통에서 증폭되어 팔로 전달되었는가?</div>'
      + (rows ? ('<div class="ad-sec"><b>독립 판정 1축</b><table class="tr-v1-mini-table"><thead><tr><th>축</th><th>상태</th><th>키</th></tr></thead><tbody>' + rows + '</tbody></table></div>') : '')
      + '<div class="ad-sec"><b>변인 dropdown (연구자)</b><ul class="tr-v1-science-inline">'
      + '<li>몸통 각속도 peak · x-factor 풀림속도 · 골반-몸통 peak 간격 · 상하체 속도비</li>'
      + '<li>몸통→팔 peak 간격 · BR 측방/전방 기울기 · 몸통 timing CV</li></ul></div>'
      + '<div class="tr-v1-science-acc-wrap">' + researchScienceAccordionsHtml(cards, DATA) + '</div>'
      + '<div class="ad-sec sub2">몸통 v1 · render-only · 블로킹=torsoRotV cross-link · 드라이브=x-factor 형성</div>';
  }

  function getStickPreset(cardId) {
    return STICK_PRESETS[cardId] || null;
  }

  function containsForbiddenCue(text) {
    if (!text) return false;
    var s = String(text);
    for (var i = 0; i < FORBIDDEN_CUES.length; i++) {
      if (s.indexOf(FORBIDDEN_CUES[i]) >= 0) return true;
    }
    return false;
  }

  function auditForbiddenCuesInHtml(html) {
    return containsForbiddenCue(html);
  }

  root.TRUNK_V1 = {
    V1_STATUS: V1_STATUS,
    CARD_DEF: CARD_DEF,
    STICK_PRESETS: STICK_PRESETS,
    FORBIDDEN_CUES: FORBIDDEN_CUES,
    buildCoachCards: buildCoachCards,
    buildAllCoachCards: buildAllCoachCards,
    coachCardHtml: coachCardHtml,
    coachCardsBlockHtml: coachCardsBlockHtml,
    researchOverviewHtml: researchOverviewHtml,
    mapBandToV1: mapBandToV1,
    getStickPreset: getStickPreset,
    metricFromDet6: metricFromDet6,
    buildXfactorUnwindDescriptor: buildXfactorUnwindDescriptor,
    buildTrunkLeanLoadWarning: buildTrunkLeanLoadWarning,
    buildArmTransferLink: buildArmTransferLink,
    containsForbiddenCue: containsForbiddenCue,
    auditForbiddenCuesInHtml: auditForbiddenCuesInHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
