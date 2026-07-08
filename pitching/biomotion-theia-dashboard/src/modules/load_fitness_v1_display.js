/**
 * load_fitness_v1_display.js — 부하·체력 보조 레이어 v1 (render-only)
 * 체력=capacity descriptor · 부하=cost monitoring · 6단계 본체 판정과 분리
 */
(function (root) {
  'use strict';

  var FITNESS_INTRO = '체력 자료는 신체 용량을 보여주는 고신뢰 참고 정보입니다. 메카닉 평가에서 나타난 문제와 함께 확인할 수 있는 신체 요인으로 해석하며, 체력만으로 메카닉 문제를 단정하지 않습니다.';
  var LOAD_INTRO = '부하 신호가 평소 또는 팀 범위를 벗어났습니다. 부상 여부를 단정하지 않으며, 통증·투구량·회복 상태, 메카닉 전달, 체력과 함께 확인합니다.';
  var REF_LABEL = '상동고 팀 내부 16명';
  var MECHANIC_BAND_BASIS = '엘리트 정상군 20 고정 IQR 밴드';
  var LOAD_BAND_BASIS = '엘리트20 + robust 백분위';
  var LOAD_STATUS = ['정상범위', '추가확인', '부하신호상승', '재검증필요'];

  var FORBIDDEN_FITNESS = [
    '체력이 부족해서', 'IMTP가 낮아 구속', 'CMJ가 낮아 블로킹', '예측구속보다 실제가 낮으니 전달 결함'
  ];
  var FORBIDDEN_LOAD = [
    '부상 위험이 높', 'UCL 손상', '어깨 부상 예상', '약하게 던져', '팔꿈치 부하 점수', '부상 확률'
  ];

  var FITNESS_DISPLAY = [
    { keys: ['strength', 'rel_strength'], short: 'IMTP', label: '최대 근력' },
    { keys: ['power', 'rel_power'], short: 'CMJ/SJ', label: '폭발 파워' },
    { keys: ['reactive'], short: 'HJ', label: '반응 강성' }
  ];

  var LOAD_CONFIDENCE = [
    { key: 'shoulder_ir', label: 'Shoulder IR moment', level: 'medium', coachFocus: true },
    { key: 'shoulder_distraction', label: 'Shoulder distraction', level: 'medium', coachFocus: true },
    { key: 'elbow_valgus', label: 'Elbow valgus', level: 'low', coachFocus: false }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function axisByKeys(hpa, keys) {
    if (!hpa || !hpa.axes) return null;
    for (var i = 0; i < keys.length; i++) {
      for (var j = 0; j < hpa.axes.length; j++) {
        if (hpa.axes[j].key === keys[i]) return hpa.axes[j];
      }
    }
    return null;
  }

  function fitnessAxisStatus(score) {
    if (score == null || !isFinite(score)) return '—';
    if (score >= 110) return '강점';
    if (score >= 90) return '보완';
    return '추가 확인';
  }

  function fitnessStatusStyle(lbl) {
    if (lbl === '강점') return 'color:var(--green);font-weight:700';
    if (lbl === '보완') return 'color:var(--amber);font-weight:700';
    if (lbl === '추가 확인') return 'color:var(--fg2);font-weight:700';
    return 'color:var(--fg2)';
  }

  function metricByKey(ir, key) {
    if (!ir || !ir.metrics) return null;
    for (var i = 0; i < ir.metrics.length; i++) {
      if (ir.metrics[i].key === key) return ir.metrics[i];
    }
    return null;
  }

  function loadTierMeta(token) {
    var tier = { ok: 0, check: 1, rise: 2, verify: 3 };
    var t = token || 'ok';
    return { tier: tier[t] != null ? tier[t] : 0, tierCls: 'load-tier-' + t, token: t };
  }

  function mapLoadStatus(ir, FS) {
    var shoulderKeys = ['shoulder_ir', 'shoulder_distraction'];
    var hasUnavail = false;
    var hasDanger = false;
    var hasCaution = false;
    shoulderKeys.forEach(function (k) {
      var m = metricByKey(ir, k);
      if (!m || m.value == null || m.grade === 'unavailable') hasUnavail = true;
      else if (m.grade === 'danger') hasDanger = true;
      else if (m.grade === 'caution') hasCaution = true;
    });
    if (FS && FS.phaseBands && FS.phaseBands.arm) {
      var arm = FS.phaseBands.arm;
      if (arm.loadRisk || arm.bandCode === 'risk') hasDanger = true;
      else if (arm.bandCode === 'caution' || arm.band === '주의') hasCaution = true;
    }
    if (hasUnavail && !hasDanger && !hasCaution) {
      return Object.assign(
        { label: '재검증필요', token: 'verify', cls: 'lf-load-verify', short: '◐ 재검증필요' },
        loadTierMeta('verify')
      );
    }
    if (hasDanger) {
      return Object.assign(
        { label: '부하신호상승', token: 'rise', cls: 'lf-load-rise', short: '▲ 부하신호상승' },
        loadTierMeta('rise')
      );
    }
    if (hasCaution) {
      return Object.assign(
        { label: '추가확인', token: 'check', cls: 'lf-load-check', short: '◐ 추가확인' },
        loadTierMeta('check')
      );
    }
    return Object.assign(
      { label: '정상범위', token: 'ok', cls: 'lf-load-ok', short: '● 정상범위' },
      loadTierMeta('ok')
    );
  }

  function coachFitnessCompactHtml(hpa, DATA) {
    if (!hpa || !hpa.axes || !hpa.axes.length) return '';
    var rows = FITNESS_DISPLAY.map(function (fd) {
      var ax = axisByKeys(hpa, fd.keys);
      var st = fitnessAxisStatus(ax && ax.score);
      var val = (ax && ax.value != null) ? (ax.value + (ax.unit || '')) : '—';
      return '<div class="lf-v1-axis-row"><span class="lf-v1-axis-name">' + esc(fd.short) + ' · ' + esc(fd.label) + '</span>'
        + '<span class="lf-v1-axis-val sub2">' + esc(val) + '</span>'
        + '<span class="lf-v1-axis-st" style="' + fitnessStatusStyle(st) + '">' + esc(st) + '</span></div>';
    }).join('');
    var asym = (hpa.asymmetry_flags && hpa.asymmetry_flags.length)
      ? ('<div class="lf-v1-asym" data-lf-asym-badge="1"><span class="lf-v1-badge-warn">비대칭 · 추가 확인</span></div>')
      : '';
    var qualLinks = '<div class="sub2" style="margin-top:6px;line-height:1.5">관련 메카닉 · 하체 제동 · 회전 파워 · 가동성과 정성 연결만 · 인과 단정 금지</div>';
    return '<div class="card coach-fitness-compact lf-v1-fitness-card" data-lf-fitness-card="1" style="grid-column:1/-1;margin-top:12px">'
      + '<div class="lf-v1-card-head"><b>참고 신체 요인</b> <span class="sub2">capacity · ' + esc(REF_LABEL) + '</span>'
      + ' <span class="lf-v1-cohort-badge" title="cohort_basis=team16 · band_confidence=internal">' + esc(REF_LABEL) + '</span></div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55;font-size:12px">' + esc(FITNESS_INTRO) + '</div>'
      + '<div class="lf-v1-axis-grid" style="margin-top:8px">' + rows + '</div>'
      + asym + qualLinks
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'hpa\')" style="font-size:11px;padding:3px 10px">체력 상세 →</button>'
      + '</div></div>';
  }

  function coachLoadMonitoringHtml(ir, FS, DATA) {
    var st = mapLoadStatus(ir, FS);
    var shoulder = metricByKey(ir, 'shoulder_ir');
    var refVal = (shoulder && shoulder.value != null) ? (shoulder.value + (shoulder.unit || '')) : null;
    return '<div class="card lf-v1-load-monitor" data-lf-load-badge="1" style="grid-column:1/-1;margin-top:10px">'
      + '<div class="lf-v1-card-head"><b>부하 모니터링</b> <span class="sub2">cost · ' + esc(LOAD_BAND_BASIS) + '</span></div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px">'
      + '<span class="lf-v1-load-status lf-load-tier ' + esc(st.cls) + ' ' + esc(st.tierCls || ('load-tier-' + (st.token || 'ok'))) + '">' + esc(st.short || st.label) + '</span>'
      + '<span class="sub2">어깨 부하 신호 · ' + esc(st.label) + '</span>'
      + (refVal ? ('<span class="sub2">참고 IR ' + esc(refVal) + '</span>') : '')
      + '</div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55;font-size:12px">' + esc(LOAD_INTRO) + '</div>'
      + '<div class="sub2" style="margin-top:6px">단일선수 잠정 danger threshold · 주 판정 아님 · outlier=재검증필요</div>'
      + '<div style="margin-top:8px"><button type="button" class="bm-focus-btn" onclick="setPage(\'injury\')" style="font-size:11px;padding:3px 10px">부하 레이어 →</button></div>'
      + '</div>';
  }

  function scienceAccordion(title, bodyHtml, extraClass) {
    return '<details class="lf-v1-science-acc' + (extraClass ? ' ' + extraClass : '') + '">'
      + '<summary class="lf-v1-science-sum">' + esc(title) + '</summary>'
      + '<div class="lf-v1-science-body">' + bodyHtml + '</div></details>';
  }

  function fitnessFpConfidenceHtml() {
    var rows = [
      ['IMTP / CMJ / SJ / HJ', 'high', '힘판 · 점프 · hop'],
      ['악력', 'medium', '보조 앵커'],
      ['예측구속 gap', 'low', '공식 진단 축 보류']
    ].map(function (r) {
      return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td class="sub2">' + esc(r[2]) + '</td></tr>';
    }).join('');
    return '<div class="ad-sec lf-v1-fp-conf" data-lf-fp-confidence="1"><b>Force plate confidence</b>'
      + '<table class="lf-v1-mini-table"><thead><tr><th>측정</th><th>등급</th><th>비고</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function loadConfidenceTableHtml() {
    var rows = LOAD_CONFIDENCE.map(function (r) {
      var hide = r.coachFocus ? '' : ' <span class="sub2">선수 기본 미노출</span>';
      return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.level) + '</td><td class="sub2">' + (r.coachFocus ? 'coach=어깨 중심' : 'research only') + hide + '</td></tr>';
    }).join('');
    return '<div class="ad-sec lf-v1-load-conf" data-lf-load-confidence="1"><b>측정 신뢰 등급</b>'
      + '<table class="lf-v1-mini-table"><thead><tr><th>변인</th><th>등급</th><th>표시</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function researchFitnessOverviewHtml(hpa, DATA) {
    if (!hpa) {
      return '<div class="research-expert-title">체력 · capacity layer</div>'
        + '<div class="ad-sec">체력 평가 데이터 없음 · fitness CSV 입력 후 재빌드</div>';
    }
    var axisRows = (hpa.axes || []).filter(function (a) { return a.key !== 'upper_power'; }).map(function (a) {
      var st = fitnessAxisStatus(a.score);
      return '<tr><td>' + esc(a.label_kr || a.axis) + '</td><td style="text-align:right">' + esc(a.value != null ? a.value + (a.unit || '') : '—') + '</td>'
        + '<td style="' + fitnessStatusStyle(st) + '">' + esc(st) + '</td></tr>';
    }).join('');
    var lenses = '<ul><li><b>기능해부학</b> — 하체·코어 파워 · 제동 근</li>'
      + '<li><b>바이오메카닉스</b> — capacity≠메카닉 인과</li>'
      + '<li><b>근신경역학</b> — RFD·SSC · hop RSI</li>'
      + '<li><b>모터컨트롤</b> — 체력 처방 cue 금지</li></ul>';
    var limits = '<ul><li>기준 · <b>' + esc(REF_LABEL) + '</b></li>'
      + '<li>체력 ∩ 실제구속 = 0 · 체력 ∩ 운동학체인 = 5 (교집합 한계)</li>'
      + '<li>예측구속 gap · 공식 진단 축 보류</li>'
      + '<li>향후 통합측정(힘판+시네+부하) 후 재검증</li></ul>';
    return '<div class="research-expert-title">체력 · capacity descriptor</div>'
      + '<div class="ad-sec lf-v1-capacity-top"><b>역할</b><br>' + esc(FITNESS_INTRO) + '</div>'
      + fitnessFpConfidenceHtml()
      + '<div class="ad-sec"><b>축별 위치 · ' + esc(REF_LABEL) + '</b>'
      + '<table class="lf-v1-mini-table"><thead><tr><th>축</th><th>값</th><th>상태</th></tr></thead><tbody>' + axisRows + '</tbody></table></div>'
      + '<div class="lf-v1-science-wrap">'
      + scienceAccordion('교집합 한계 · 예측구속 gap 보류', limits, 'lf-v1-science-limits')
      + scienceAccordion('과학근거 4렌즈', lenses, 'lf-v1-science-lenses')
      + '</div>'
      + '<div class="ad-sec sub2">체력 v1 · render-only · 6단계 우수/보완/결함 미사용</div>';
  }

  function researchLoadOverviewHtml(ir, DATA) {
    ir = ir || (DATA && DATA.injury_risk) || null;
    var st = mapLoadStatus(ir, DATA && DATA.feedbackSummary);
    var metricRows = LOAD_CONFIDENCE.map(function (r) {
      var m = metricByKey(ir, r.key);
      var val = (m && m.value != null) ? (m.value + (m.unit || '')) : '—';
      var pct = (m && m.danger && m.value != null) ? Math.round(m.value / m.danger * 100) + '% cohort ref' : '—';
      return '<tr><td>' + esc(r.label) + '</td><td>' + esc(r.level) + '</td><td>' + esc(val) + '</td><td class="sub2">' + esc(pct) + '</td></tr>';
    }).join('');
    var comp = '<p>보상→원위부하 · 연구자 탐색 cross-link만 · 팔 주도 보상 단정 금지 · 몸통·블로킹·팔 전달 패널과 교차</p>';
    var guard = '<ul><li>부상 단정·UCL·약하게 던져라 cue 금지</li>'
      + '<li>단일선수 잠정밴드 · 화면 주 판정 아님 · INJURY_THRESHOLDS 계산 미변경</li>'
      + '<li>부하↔구속 · 참조만 · 인과 단정 금지</li></ul>';
    return '<div class="research-expert-title">부하 · cost monitoring</div>'
      + '<div class="ad-sec lf-v1-cost-top"><b>현재 신호</b> · <span class="' + esc(st.cls) + '">' + esc(st.label) + '</span><br>' + esc(LOAD_INTRO)
      + '<div class="sub2" style="margin-top:6px">단일선수 잠정 danger threshold · 주 판정 아님 · outlier=재검증필요</div></div>'
      + loadConfidenceTableHtml()
      + '<div class="ad-sec"><b>코호트 robust percentile · shoulder 중심</b>'
      + '<table class="lf-v1-mini-table"><thead><tr><th>지표</th><th>신뢰</th><th>값</th><th>백분위 참고</th></tr></thead><tbody>' + metricRows + '</tbody></table>'
      + '<p class="sub2" style="margin-top:6px">elbow valgus · low confidence · 선수 기본 화면 강조 금지</p></div>'
      + '<div class="lf-v1-science-wrap">'
      + scienceAccordion('보상→부하 탐색', comp, 'lf-v1-science-comp')
      + scienceAccordion('부상 단정 금지 · 밴드 한계', guard, 'lf-v1-science-guard')
      + scienceAccordion('과학근거 4렌즈', '<ul><li>기능해부학 · 회전 cuff·UCL 맥락</li><li>바이오메카닉스 · ID validity caution</li><li>근신경 · fatigue≠부상 확정</li><li>모터컨트롤 · load cue 금지</li></ul>', 'lf-v1-science-lenses')
      + '</div>'
      + '<div class="ad-sec sub2">부하 v1 · render-only · 정상범위/추가확인/부하신호상승/재검증필요</div>';
  }

  function containsForbidden(text, list) {
    if (!text) return [];
    return list.filter(function (f) { return text.indexOf(f) >= 0; });
  }

  root.LOAD_FITNESS_V1 = {
    FITNESS_INTRO: FITNESS_INTRO,
    LOAD_INTRO: LOAD_INTRO,
    REF_LABEL: REF_LABEL,
    LOAD_STATUS: LOAD_STATUS,
    FORBIDDEN_FITNESS: FORBIDDEN_FITNESS,
    FORBIDDEN_LOAD: FORBIDDEN_LOAD,
    LOAD_CONFIDENCE: LOAD_CONFIDENCE,
    fitnessAxisStatus: fitnessAxisStatus,
    mapLoadStatus: mapLoadStatus,
    loadTierMeta: loadTierMeta,
    coachFitnessCompactHtml: coachFitnessCompactHtml,
    coachLoadMonitoringHtml: coachLoadMonitoringHtml,
    researchFitnessOverviewHtml: researchFitnessOverviewHtml,
    researchLoadOverviewHtml: researchLoadOverviewHtml,
    loadConfidenceTableHtml: loadConfidenceTableHtml,
    fitnessFpConfidenceHtml: fitnessFpConfidenceHtml,
    containsForbidden: containsForbidden
  };
})(typeof window !== 'undefined' ? window : globalThis);
