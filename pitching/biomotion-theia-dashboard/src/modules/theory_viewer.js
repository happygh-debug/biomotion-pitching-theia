/**
 * theory_viewer.js — 분석 이론 탭 (Markdown + CSV, 교육/연구용)
 * v2: S1–S13 섹션 · 철학/5단계/평가/한계/보조/사례 네비
 * 계산·판정 로직 변경 없음 · THEORY_MD / THEORY_CSV 빌드 임베드
 */
(function (root) {
  'use strict';

  var MD_FALLBACK = '분석 이론 문서가 아직 연결되지 않았습니다.\n'
    + 'theory/biomotion_kinetic_chain_theory.md 파일을 추가하면 이곳에 표시됩니다.';
  var CSV_FALLBACK = '변인 연결표가 아직 연결되지 않았습니다.\n'
    + 'theory/variable_kinetic_chain_map.csv 파일을 추가하면 이곳에 표시됩니다.';

  var THEORY_NAV = [
    { id: 'philosophy', label: '철학' },
    { id: 'phases5', label: '5단계' },
    { id: 'criteria', label: '평가 기준' },
    { id: 'limits', label: '측정 한계' },
    { id: 'aux', label: '보조 레이어' },
    { id: 'cases', label: '사례', optional: true }
  ];

  var PHASE_CARDS = [
    '와인드업', '드라이브', '블로킹', '몸통', '팔', '부하', '일관성', '체력 연결'
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getMdSource() {
    try {
      if (typeof THEORY_MD === 'string' && THEORY_MD.trim()) return THEORY_MD;
    } catch (e) {}
    return '';
  }

  function getCsvSource() {
    try {
      if (typeof THEORY_CSV === 'string' && THEORY_CSV.trim()) return THEORY_CSV;
    } catch (e) {}
    return '';
  }

  function inlineMd(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function linesToHtml(lines) {
    var out = [];
    var inUl = false;
    function closeUl() {
      if (inUl) { out.push('</ul>'); inUl = false; }
    }
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) { closeUl(); return; }
      var hm = t.match(/^(#{1,3})\s+(.*)$/);
      if (hm) {
        closeUl();
        var lvl = hm[1].length;
        out.push('<h' + lvl + '>' + inlineMd(hm[2]) + '</h' + lvl + '>');
        return;
      }
      if (/^>\s?/.test(t)) {
        closeUl();
        out.push('<blockquote class="theory-blockquote">' + inlineMd(t.replace(/^>\s?/, '')) + '</blockquote>');
        return;
      }
      if (/^[-*]\s+/.test(t)) {
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push('<li>' + inlineMd(t.replace(/^[-*]\s+/, '')) + '</li>');
        return;
      }
      closeUl();
      out.push('<p>' + inlineMd(t) + '</p>');
    });
    closeUl();
    return out.join('\n');
  }

  function mdToHtml(src) {
    if (!src || !src.trim()) {
      return '<p class="theory-fallback">' + esc(MD_FALLBACK).replace(/\n/g, '<br>') + '</p>';
    }
    return linesToHtml(src.replace(/\r\n/g, '\n').split('\n'));
  }

  function sectionNum(sid) {
    var m = String(sid || '').match(/S(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function sectionCategory(sid) {
    var n = sectionNum(sid);
    if (n <= 2) return 'philosophy';
    if (n <= 7) return 'phases5';
    if (n <= 9) return 'criteria';
    if (n <= 11) return 'limits';
    if (n === 12) return 'aux';
    if (n === 13) return 'cases';
    return 'philosophy';
  }

  function parseMdSections(src) {
    if (!src || !src.trim()) return [];
    var lines = src.replace(/\r\n/g, '\n').split('\n');
    var sections = [];
    var current = null;
    lines.forEach(function (line) {
      var hm = line.match(/^##\s+(S\d+[^]*?)$/i);
      if (hm) {
        if (current) sections.push(current);
        var title = hm[1].trim();
        var sid = (title.match(/^(S\d+)/i) || [])[1] || '';
        current = { sid: sid, title: title, category: sectionCategory(sid), lines: [] };
        return;
      }
      if (current) current.lines.push(line);
    });
    if (current) sections.push(current);
    return sections;
  }

  function theoryNavHtml(activeId) {
    var h = '<nav class="theory-nav" aria-label="분석 이론 섹션">';
    THEORY_NAV.forEach(function (item) {
      var cls = 'theory-nav-btn' + (item.id === activeId ? ' on' : '');
      if (item.optional) cls += ' theory-nav-optional';
      h += '<button type="button" class="' + cls + '" data-theory-nav="' + esc(item.id) + '">'
        + esc(item.label) + (item.optional ? ' <span class="theory-nav-tag">선택</span>' : '')
        + '</button>';
    });
    return h + '</nav>';
  }

  function theorySectionsHtml(sections, activeId) {
    if (!sections.length) {
      return '<div class="theory-md-body">' + mdToHtml('') + '</div>';
    }
    var h = '<div class="theory-md-body theory-md-sections">';
    sections.forEach(function (sec) {
      var show = sec.category === activeId;
      var cls = 'theory-md-section' + (show ? ' visible' : '');
      h += '<article class="' + cls + '" id="theory-sec-' + esc(sec.sid) + '" data-category="' + esc(sec.category) + '">'
        + '<h2 class="theory-section-title">' + inlineMd(sec.title) + '</h2>'
        + linesToHtml(sec.lines)
        + '</article>';
    });
    return h + '</div>';
  }

  function parseCsv(text) {
    if (!text || !text.trim()) return { headers: [], rows: [] };
    var rows = [];
    var i = 0, field = '', row = [], inQ = false;
    while (i < text.length) {
      var c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { inQ = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        row.push(field); field = '';
        if (row.length > 1 || row[0]) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      field += c; i++;
    }
    row.push(field);
    if (row.length > 1 || row[0]) rows.push(row);
    if (!rows.length) return { headers: [], rows: [] };
    var headers = rows[0].map(function (h) { return h.trim(); });
    var data = [];
    for (var r = 1; r < rows.length; r++) {
      if (!rows[r].some(function (c) { return String(c).trim(); })) continue;
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = rows[r][idx] != null ? String(rows[r][idx]).trim() : ''; });
      if (obj.variable_key || obj.display_name_kr || obj.phase) data.push(obj);
    }
    return { headers: headers, rows: data };
  }

  function uniqVals(rows, key) {
    var s = {}, a = [];
    rows.forEach(function (r) {
      var v = (r[key] || '').trim();
      if (v && !s[v]) { s[v] = 1; a.push(v); }
    });
    return a.sort();
  }

  function filterSelect(id, label, values, allLabel) {
    var h = '<label class="theory-filter"><span>' + esc(label) + '</span><select id="' + id + '">';
    h += '<option value="">' + esc(allLabel || '전체') + '</option>';
    values.forEach(function (v) { h += '<option value="' + esc(v) + '">' + esc(v) + '</option>'; });
    return h + '</select></label>';
  }

  function phaseCardsHtml(rows) {
    var html = '<div class="theory-phase-cards">';
    PHASE_CARDS.forEach(function (ph) {
      var n = rows.filter(function (r) { return (r.phase || '') === ph; }).length;
      html += '<div class="theory-phase-card" data-phase="' + esc(ph) + '">'
        + '<div class="theory-phase-card-title">' + esc(ph) + '</div>'
        + '<div class="theory-phase-card-meta">' + (n ? (n + '개 변인') : '—') + '</div>'
        + '</div>';
    });
    return html + '</div>';
  }

  function detailPanel(row) {
    if (!row) {
      return '<div class="theory-detail theory-detail-empty">표에서 변인 행을 선택하면 상세가 표시됩니다.</div>';
    }
    function sec(title, val) {
      if (!val) return '';
      return '<div class="theory-detail-sec"><div class="theory-detail-lbl">' + esc(title) + '</div>'
        + '<div class="theory-detail-val">' + esc(val) + '</div></div>';
    }
    return '<div class="theory-detail">'
      + '<div class="theory-detail-head">' + esc(row.display_name_kr || row.variable_key || '—') + '</div>'
      + '<div class="theory-detail-sub">' + esc(row.variable_key || '') + ' · ' + esc(row.phase || '') + '</div>'
      + sec('단계 의도 (chain_intent)', row.chain_intent)
      + sec('진단 질문', row.diagnostic_question)
      + sec('메카닉 개념', row.mechanic_concept)
      + sec('변인 역할', row.variable_role)
      + sec('에너지 역할', row.energy_role)
      + sec('높을 때', row.interpretation_high)
      + sec('낮을 때', row.interpretation_low)
      + sec('실패 패턴', row.failure_pattern)
      + sec('선수·코치 메시지 후보', row.coach_message_candidate)
      + sec('연구자용 해석', row.researcher_interpretation)
      + sec('추천 시각화', row.recommended_visualization)
      + sec('스틱 오버레이', row.stick_overlay)
      + sec('보조 그래프', row.helper_graph)
      + sec('priority', row.priority_status)
      + sec('notes', row.notes)
      + '</div>';
  }

  function tableHtml(headers, rows) {
    if (!rows.length) {
      return '<p class="theory-fallback">' + esc(CSV_FALLBACK).replace(/\n/g, '<br>') + '</p>';
    }
    var show = ['phase', 'variable_key', 'display_name_kr', 'variable_role', 'energy_role', 'priority_status'];
    show = show.filter(function (c) { return headers.indexOf(c) >= 0; });
    if (!show.length) show = headers.slice(0, 6);
    var h = '<div class="theory-table-wrap"><table class="theory-table"><thead><tr>';
    show.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r, idx) {
      h += '<tr class="theory-row" data-idx="' + idx + '" tabindex="0">';
      show.forEach(function (c) { h += '<td>' + esc(r[c] || '') + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  var _parsed = null;
  var _filtered = [];
  var _activeNav = 'philosophy';

  function applyFilters() {
    if (!_parsed) return [];
    var ids = ['theory-f-phase', 'theory-f-vrole', 'theory-f-erole', 'theory-f-coach', 'theory-f-research', 'theory-f-priority'];
    var keys = ['phase', 'variable_role', 'energy_role', 'coach_visible', 'researcher_visible', 'priority_status'];
    var f = {};
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      f[keys[i]] = el ? el.value : '';
    });
    return _parsed.rows.filter(function (r) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], want = f[k];
        if (!want) continue;
        var got = (r[k] || '').toUpperCase();
        if (k === 'coach_visible' || k === 'researcher_visible') {
          if (want.toUpperCase() === 'TRUE' && got !== 'TRUE') return false;
          if (want.toUpperCase() === 'FALSE' && got !== 'FALSE') return false;
        } else if ((r[k] || '') !== want) return false;
      }
      return true;
    });
  }

  function refreshTable() {
    _filtered = applyFilters();
    var host = document.getElementById('theory-table-host');
    var det = document.getElementById('theory-detail-host');
    if (host && _parsed) host.innerHTML = tableHtml(_parsed.headers, _filtered);
    if (det) det.innerHTML = detailPanel(null);
    bindRowClicks();
  }

  function setTheoryNav(catId) {
    _activeNav = catId || 'philosophy';
    document.querySelectorAll('.theory-nav-btn').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-theory-nav') === _activeNav);
    });
    document.querySelectorAll('.theory-md-section').forEach(function (sec) {
      sec.classList.toggle('visible', sec.getAttribute('data-category') === _activeNav);
    });
  }

  function bindRowClicks() {
    document.querySelectorAll('.theory-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        document.querySelectorAll('.theory-row.on').forEach(function (x) { x.classList.remove('on'); });
        tr.classList.add('on');
        var idx = parseInt(tr.getAttribute('data-idx'), 10);
        var det = document.getElementById('theory-detail-host');
        if (det) det.innerHTML = detailPanel(_filtered[idx]);
      });
    });
  }

  function bindFilters() {
    ['theory-f-phase', 'theory-f-vrole', 'theory-f-erole', 'theory-f-coach', 'theory-f-research', 'theory-f-priority']
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', refreshTable);
      });
    document.querySelectorAll('.theory-phase-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var ph = card.getAttribute('data-phase');
        var sel = document.getElementById('theory-f-phase');
        if (sel) { sel.value = ph; refreshTable(); }
      });
    });
    document.querySelectorAll('.theory-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTheoryNav(btn.getAttribute('data-theory-nav'));
      });
    });
  }

  function render() {
    var rootEl = document.getElementById('theory-view-body');
    if (!rootEl) return;
    _parsed = parseCsv(getCsvSource());
    var mdSrc = getMdSource();
    var sections = parseMdSections(mdSrc);
    var phases = uniqVals(_parsed.rows, 'phase');
    var vroles = uniqVals(_parsed.rows, 'variable_role');
    var eroles = uniqVals(_parsed.rows, 'energy_role');
    var prios = uniqVals(_parsed.rows, 'priority_status');

    rootEl.innerHTML = ''
      + '<div class="theory-hero card">'
      + '<h2 class="theory-title">분석 이론</h2>'
      + '<div class="theory-subtitle">키네틱 체인 · 5단계 + 보조 3축 (v2)</div>'
      + '<p class="theory-intro note">연구원·교육용 이론 정리입니다. 선수·코치 기본 화면에는 요약만 노출되며, 점수·판정 SSOT와 분리됩니다.</p>'
      + '</div>'
      + '<div class="card theory-md-card">'
      + '<div class="theory-sec-head">이론 문서</div>'
      + theoryNavHtml(_activeNav)
      + theorySectionsHtml(sections, _activeNav)
      + '</div>'
      + '<div class="card"><div class="theory-sec-head">단계별 의도 요약</div>' + phaseCardsHtml(_parsed.rows) + '</div>'
      + '<div class="card theory-table-card"><div class="theory-sec-head">변인–이론 연결표 (CSV)</div>'
      + '<div class="theory-filters">'
      + filterSelect('theory-f-phase', 'phase', phases.length ? phases : PHASE_CARDS)
      + filterSelect('theory-f-vrole', 'variable_role', vroles)
      + filterSelect('theory-f-erole', 'energy_role', eroles)
      + filterSelect('theory-f-coach', 'coach_visible', ['TRUE', 'FALSE'])
      + filterSelect('theory-f-research', 'researcher_visible', ['TRUE', 'FALSE'])
      + filterSelect('theory-f-priority', 'priority_status', prios)
      + '</div>'
      + '<div id="theory-table-host"></div>'
      + '<div id="theory-detail-host"></div>'
      + '</div>';

    refreshTable();
    bindFilters();
    setTheoryNav(_activeNav);
  }

  root.THEORY_VIEWER = {
    render: render,
    parseCsv: parseCsv,
    mdToHtml: mdToHtml,
    parseMdSections: parseMdSections,
    sectionCategory: sectionCategory
  };
})(typeof window !== 'undefined' ? window : globalThis);
