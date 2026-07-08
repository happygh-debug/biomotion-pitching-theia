// player_report_template_v2.js — 선수 리포트 2형태 v2 (표현 layer only)
// A형=선수 요약(soft label) · B형=연구원 설명(official label)
// 계산 SSOT: feedback_summary · mech5 · phases · pitch_norms — 재계산 금지
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.playerReportTemplateV2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REPORT_VERSION = 'player_report_v2';
  var DEV_FRAMING = '본 리포트는 현재 선수를 엘리트 기준과 비교해 “현재 발달 위치”를 확인하기 위한 자료입니다.\n'
    + '15세 선수에게 프로/엘리트 밴드를 그대로 요구한다는 뜻이 아닙니다.\n'
    + '훈련 방향과 다음 측정 목표를 정하기 위한 기준으로 해석해야 합니다.';
  var CONF_FRAMING = '측정 환경·trial 수·변인별 신뢰도에 따라 일부 지표는 참고 수준으로만 해석합니다. '
    + '저신뢰 변인은 단정 결론보다 재측정·연구자 확인을 우선합니다.';
  var BAND_PLACEHOLDER = '엘리트 밴드 수치는 엔진 산식 재확인 후 확정됩니다. 아래 p25–p75는 elite20 코호트 참고값(display metadata)이며 선수 판정값이 아닙니다.';
  var BAND_COHORT_NOTE = '참고 · elite20 p25–p75 (display metadata)';
  var LOAD_SAFETY = '부하 신호는 추가 확인용 참고입니다. 부상 단정·확정 표현은 사용하지 않습니다.';
  var PROHIBITED_CUE = '코칭 cue는 에너지 전달·순서 중심으로 안내합니다. 속도·각도·부상 단정형 지시는 사용하지 않습니다.';

  var FORBIDDEN_PATTERNS = [
    /팔\s*더\s*빨리/i, /손\s*속도\s*올려/i, /더\s*젖혀/i, /MER\s*더\s*키워/i,
    /약하게\s*던져/i, /부상\s*확정/i, /UCL\s*손상\s*위험\s*확정/i,
    /체력\s*부족\s*때문에/i, /팔로\s*만\s*던져/i, /팔이\s*메움/i, /팔로\s*만\s*던짐/i
  ];

  var LOW_CONF_KEYS = {
    wuPelCoil: 1, hipCoil: 1, shGen: 1, elbAbs: 1, armRotV: 1, handSpeed: 1,
    forearmRot: 1, releasePoint: 1, elbowValgus: 1, vgrfRetain: 1
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function copySmoke(text) {
    var found = [];
    FORBIDDEN_PATTERNS.forEach(function (re) {
      if (re.test(text)) found.push(re.source);
    });
    return { ok: !found.length, found: found };
  }

  function softFromBandCode(code, leak, loadRisk) {
    if (loadRisk) return '추가 확인';
    if (code === 'strong') return '강점';
    if (code === 'weak' || leak) return '약한 고리';
    if (code === 'caution') return '보완';
    if (code === 'na') return '재확인 필요';
    return '보완';
  }

  function officialFromBandCode(code, leak, loadRisk, bandText) {
    if (loadRisk) return '보완';
    if (code === 'strong') return '우수';
    if (code === 'weak' || leak || bandText === '결함') return '결함';
    return '보완';
  }

  function confForKey(key) {
    if (LOW_CONF_KEYS[key]) return { level: 'low', label: '재확인 필요' };
    return { level: 'medium', label: '참고 가능' };
  }

  function pickStrengths(energyFlowMap) {
    var out = [];
    (energyFlowMap || []).forEach(function (n) {
      if (out.length >= 3) return;
      if (n.bandCode === 'strong' || (!n.leak && !n.loadRisk && (n.bandCode === 'ok' || n.band === '양호'))) {
        out.push(n.label + ' · ' + (n.role || '') + ' 흐름 양호');
      }
    });
    if (!out.length && energyFlowMap && energyFlowMap[0]) {
      out.push(energyFlowMap[0].label + ' 구간부터 순서 확인');
    }
    return out.slice(0, 3);
  }

  function pickWeakLinksSoft(energyFlowMap) {
    var out = [];
    (energyFlowMap || []).forEach(function (n) {
      if (out.length >= 2) return;
      if (n.leak || n.bandCode === 'weak' || n.isMainLeak) {
        out.push(n.label + ' · ' + softFromBandCode(n.bandCode, n.leak, n.loadRisk));
      }
    });
    return out.slice(0, 2);
  }

  function priorityFromIssue(issue, idx, FS) {
    if (!issue) return null;
    var goals = (FS && FS.nextMeasurementGoals) || [];
    return {
      title: issue.title || issue.problem || ('우선순위 ' + (idx + 1)),
      phase: issue.phaseLabel || issue.phase || '',
      variableKeys: issue.relatedMetrics || [],
      chainMeaning: issue.why || (issue.downstreamImpact || ''),
      playerCue: issue.correction || ((FS && FS.highlight && FS.highlight.coachingCue) || ''),
      recommendedDrills: issue.correction ? [issue.correction] : [],
      nextMeasurementGoal: (goals[idx] && goals[idx].goal) || (goals[idx] && goals[idx].phaseLabel) || '동일 구간 재측정',
      caution: issue.loadRisk ? '부하 신호 — 추가 확인' : undefined
    };
  }

  function mapEnergyPhases(energyFlowMap, mode) {
    return (energyFlowMap || []).map(function (n) {
      var dict = (typeof feedbackSummary !== 'undefined' && feedbackSummary.PHASE_DICT)
        ? feedbackSummary.PHASE_DICT[n.key] : null;
      var soft = softFromBandCode(n.bandCode, n.leak, n.loadRisk);
      var official = officialFromBandCode(n.bandCode, n.leak, n.loadRisk, n.band);
      return {
        phaseKey: n.key === 'arm' ? 'arm_release' : n.key,
        displayName: n.label,
        statusOfficial: official,
        statusSoft: soft,
        energyRole: dict ? dict.energyRole : (n.role || ''),
        shortMessage: dict ? (n.leak ? dict.issuePattern : dict.goodPattern) : n.band,
        variableKeys: []
      };
    });
  }

  function getDisplayBandMeta(mechKey) {
    var cfg = (typeof elite20BandDisplayConfig !== 'undefined' && elite20BandDisplayConfig.getDisplayBand)
      ? elite20BandDisplayConfig.getDisplayBand(mechKey) : null;
    return cfg || null;
  }

  function mapBandGauges(FS, activeVarKey) {
    var raw = (FS && FS.bandGauges) || [];
    var out = [];
    var metaCount = 0;
    raw.forEach(function (g) {
      if (out.length >= 6 || !g || !g.key) return;
      var c = confForKey(g.key);
      var meta = getDisplayBandMeta(g.key);
      if (meta) metaCount++;
      var bandNote = g.bandWord || g.band || '—';
      if (meta && meta.bandValues) {
        var cohortLbl = (meta.bandConfidence === 'provisional' || meta.bandSource === 'pilot34')
          ? ('잠정 밴드 · n=' + (meta.validN || 34) + ' · 데이터 확대 시 갱신')
          : BAND_COHORT_NOTE;
        bandNote = cohortLbl + ' · p25 ' + meta.bandValues.p25 + '–p75 ' + meta.bandValues.p75 + (meta.unit ? ' ' + meta.unit : '');
      }
      out.push({
        variableKey: g.key,
        displayName: g.labelKo || g.key,
        value: null,
        unit: meta ? meta.unit : '',
        direction: meta ? meta.direction : 'pending_engine_verification',
        bandSource: meta ? meta.bandSource : 'pending_engine_verification',
        bandValues: meta ? meta.bandValues : null,
        bandConfidence: meta ? meta.bandConfidence : 'pending',
        displayMetadataOnly: !!(meta && meta.displayMetadataOnly),
        registryKey: meta ? meta.registryKey : '',
        statusOfficial: g.band === '우수' ? '우수' : (g.band === '미흡' ? '결함' : '보완'),
        statusSoft: g.band === '우수' ? '강점' : (g.band === '미흡' ? '약한 고리' : '보완'),
        measurementConfidence: c.level,
        confidenceLabel: c.label,
        engineVerified: false,
        displayNote: bandNote,
        pos: g.pos != null ? g.pos : 0.5,
        syncHighlight: !!(activeVarKey && activeVarKey === g.key)
      });
    });
    while (out.length < 4) {
      out.push({
        variableKey: 'pending_' + out.length,
        displayName: '엔진 재확인 대기',
        value: null,
        bandSource: 'pending_engine_verification',
        bandValues: null,
        measurementConfidence: 'medium',
        confidenceLabel: '참고 가능',
        engineVerified: false,
        displayNote: BAND_PLACEHOLDER,
        pos: 0.5,
        statusOfficial: '보완',
        statusSoft: '보완'
      });
    }
    if (metaCount === 0) {
      var fallbackKeys = [activeVarKey];
      ((FS && FS.keyIssues) || []).forEach(function (k) {
        (k.relatedMetrics || []).forEach(function (rk) { if (rk) fallbackKeys.push(rk); });
      });
      for (var fi = 0; fi < fallbackKeys.length && metaCount === 0; fi++) {
        var fk = fallbackKeys[fi];
        var fmeta = fk ? getDisplayBandMeta(fk) : null;
        if (!fmeta) continue;
        out[0] = {
          variableKey: fk,
          displayName: fk,
          value: null,
          unit: fmeta.unit,
          direction: fmeta.direction,
          bandSource: fmeta.bandSource,
          bandValues: fmeta.bandValues,
          bandConfidence: fmeta.bandConfidence,
          displayMetadataOnly: true,
          registryKey: fmeta.registryKey,
          statusOfficial: '보완',
          statusSoft: '보완',
          measurementConfidence: confForKey(fk).level,
          confidenceLabel: confForKey(fk).label,
          engineVerified: false,
          displayNote: BAND_COHORT_NOTE + ' · p25 ' + fmeta.bandValues.p25 + '–p75 ' + fmeta.bandValues.p75 + (fmeta.unit ? ' ' + fmeta.unit : ''),
          pos: 0.5,
          syncHighlight: !!(activeVarKey && activeVarKey === fk)
        };
        metaCount++;
      }
    }
    return { gauges: out.slice(0, 6), metaCount: metaCount };
  }

  function mapCaptures(caps) {
    caps = caps || {};
    function slot(name) {
      var c = caps[name];
      if (!c) return null;
      return {
        variableKey: c.variableKey || '',
        phase: c.phase || '',
        imagePath: c.dataUrl || c.imagePath || '',
        caption: c.caption || '',
        frameEvent: c.frameEvent || 'custom',
        overlayPreset: c.overlayPreset || '',
        qaPassed: !!c.qaPassed
      };
    }
    return {
      primaryIssue: slot('capture_primary_issue'),
      secondaryIssue: slot('capture_secondary_issue'),
      armRelease: slot('capture_arm_or_release'),
      loadOrAux: slot('capture_optional_load')
    };
  }

  function buildTemplateData(DATA, FS, captures, reportType, opts) {
    reportType = reportType || 'A_summary';
    opts = opts || {};
    FS = FS || (DATA && DATA.feedbackSummary) || null;
    var player = (DATA && DATA.player) || {};
    var overall = (FS && FS.overall) || {};
    var energyFlowMap = (FS && FS.energyFlowMap) || [];
    var keyIssues = (FS && FS.keyIssues) || [];
    var activeVarKey = opts.activeVarKey || '';
    var bandPack = mapBandGauges(FS, activeVarKey);
    var phases = mapEnergyPhases(energyFlowMap, reportType);
    var p1 = priorityFromIssue(keyIssues[0], 0, FS);
    var p2 = priorityFromIssue(keyIssues[1], 1, FS);

    return {
      reportVersion: REPORT_VERSION,
      reportType: reportType,
      athlete: {
        name: player.name || '선수',
        hand: (player.handedness || 'R').toUpperCase(),
        height: player.height_m,
        weight: player.weight_kg,
        measurementDate: (DATA && DATA.test_date) || (FS && FS.meta && FS.meta.generatedAt && FS.meta.generatedAt.slice(0, 10)) || '',
        trialCount: (DATA && DATA.trials && DATA.trials.length) || 0,
        maxVelocity: DATA && DATA.measured_kmh
      },
      summary: {
        oneLine: overall.headline || '오늘 투구 에너지 흐름 요약',
        strengths: pickStrengths(energyFlowMap),
        weakLinks: pickWeakLinksSoft(energyFlowMap),
        priority1: p1 || { title: '우선 확인 구간', phase: '', variableKeys: [], chainMeaning: '', playerCue: '', recommendedDrills: [], nextMeasurementGoal: '다음 측정에서 동일 구간 재확인' },
        priority2: p2
      },
      energyChain: {
        phases: phases,
        auxiliaryLayers: {
          load: { displayName: '부하', status: '참고', message: LOAD_SAFETY, visibleInA: true, visibleInB: true },
          fitness: { displayName: '체력', status: '함께 확인', message: '체력은 투구 메카닉과 별도로 함께 봅니다.', visibleInA: false, visibleInB: true },
          consistency: { displayName: '일관성', status: '참고', message: (FS && FS.consistencyCoachCard && FS.consistencyCoachCard.note) || 'trial 간 변동 확인', visibleInA: false, visibleInB: true }
        }
      },
      bandGauges: bandPack.gauges,
      captures: mapCaptures(captures),
      syncContext: {
        activeVariableKey: activeVarKey || '',
        dashboardLinked: !!activeVarKey
      },
      labels: {
        labelMode: reportType === 'A_summary' ? 'soft_player' : 'official_researcher',
        useDefectLabel: reportType !== 'A_summary',
        developmentFramingRequired: true,
        measurementConfidenceRequired: true
      },
      disclaimers: {
        development: DEV_FRAMING,
        measurementConfidence: CONF_FRAMING,
        loadSafety: LOAD_SAFETY,
        prohibitedCue: PROHIBITED_CUE
      },
      engineBandStatus: {
        bandValuesVerifiedByEngine: false,
        elite20DisplayMetadataAttached: bandPack.metaCount > 0,
        displayMetadataOnly: true,
        pendingKeys: (FS && FS.bandGauges || []).map(function (g) { return g.key; }),
        note: BAND_PLACEHOLDER
      },
      phaseCardsEasy: (FS && FS.phaseCards || []).slice(0, 5).map(function (c) {
        return { label: c.label || c.key, message: c.summary || c.headline || c.oneLine || '—' };
      }),
      drills: ((FS && FS.drillsOrCues) || []).slice(0, 2),
      cues: [((FS && FS.highlight && FS.highlight.coachingCue) || ''), (keyIssues[0] && keyIssues[0].correction) || ''].filter(Boolean).slice(0, 2),
      nextMeasurementGoals: ((FS && FS.nextMeasurementGoals) || []).slice(0, 3),
      explanationScript: (FS && FS.explanationScript) || {}
    };
  }

  var CSS = ''
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:Pretendard,-apple-system,sans-serif;background:#f4f6f9;color:#1b2330;line-height:1.55;font-size:13px}'
    + '.wrap{max-width:820px;margin:0 auto;padding:28px 22px 40px}'
    + 'h1{font-size:22px;font-weight:800;margin-bottom:4px}'
    + 'h2{font-size:15px;font-weight:800;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #dce3ec}'
    + '.sub{font-size:12px;color:#6b7787;margin-bottom:14px}'
    + '.badge{display:inline-block;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;margin-right:6px}'
    + '.badge-a{background:#e8f4ec;color:#2f7a4f}.badge-b{background:#e8eef8;color:#1f4a8a}'
    + '.card{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:14px 16px;margin-bottom:10px}'
    + '.lead{font-size:12.5px;color:#41506a}'
    + '.chain{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}'
    + '.chain-node{flex:1 1 120px;min-width:110px;border-radius:8px;border:1px solid #e3e9f0;padding:8px 10px;background:#fafbfc}'
    + '.chain-node .nm{font-weight:800;font-size:12px}'
    + '.chain-node .st{font-size:11px;font-weight:700;margin-top:4px}'
    + '.st-strong{color:#2f9e44}.st-weak{color:#c0612b}.st-ok{color:#1f6feb}.st-extra{color:#7048e8}'
    + '.prio{border-left:4px solid #e8731a;padding-left:12px;margin:10px 0}'
    + '.gauge-row{display:grid;grid-template-columns:1fr;gap:8px}'
    + '.gauge{border:1px solid #e3e9f0;border-radius:8px;padding:10px 12px;background:#fff}'
    + '.gauge-bar{height:8px;border-radius:4px;background:linear-gradient(90deg,#e24b4a 0%,#e8954e 35%,#46c98c 65%,#46c98c 100%);margin:8px 0 4px;position:relative}'
    + '.gauge-dot{position:absolute;top:-3px;width:12px;height:12px;border-radius:50%;background:#1b2330;border:2px solid #fff;transform:translateX(-50%)}'
    + '.note{font-size:11.5px;color:#566578;background:#f6f8fb;border:1px dashed #cfd8e3;border-radius:8px;padding:10px 12px;margin-top:10px}'
    + '.cap-box{margin:12px 0;border-radius:10px;overflow:hidden;border:1px solid #2a3340;background:#0e1218}'
    + '.cap-box img{display:block;width:100%;height:auto}'
    + '.cap-cap{padding:8px 12px;font-size:11px;color:#c8d2df;background:#141a22}'
    + '.cap-pending{border:2px dashed #e8731a;border-radius:10px;padding:16px;text-align:center;font-weight:700;color:#a65a12;background:#fff8f0}'
    + '.tag{font-size:10px;font-weight:700;color:#6b7787}'
    + '.page-break{page-break-before:always}'
    + '@media print{.noprint{display:none!important}body{background:#fff}}';

  function captureHtml(cap, label) {
    if (cap && cap.imagePath) {
      return '<div class="cap-box"><img src="' + esc(cap.imagePath) + '" alt="' + esc(label) + '"/>'
        + '<div class="cap-cap">' + esc(cap.caption || label) + '</div></div>';
    }
    return '<div class="cap-pending">캡처 재확인 필요 · ' + esc(label) + '</div>';
  }

  function chainHtml(phases, soft) {
    return '<div class="chain">' + phases.map(function (p) {
      var st = soft ? p.statusSoft : p.statusOfficial;
      var cls = st === '강점' || st === '우수' ? 'st-strong' : ((st === '약한 고리' || st === '결함') ? 'st-weak' : (st === '추가 확인' ? 'st-extra' : 'st-ok'));
      return '<div class="chain-node"><div class="nm">' + esc(p.displayName) + '</div>'
        + '<div class="st ' + cls + '">' + esc(st) + '</div>'
        + '<div class="tag" style="margin-top:4px">' + esc(p.energyRole) + '</div></div>';
    }).join('') + '</div>';
  }

  function gaugeHtml(gauges, soft) {
    return '<div class="gauge-row">' + gauges.map(function (g) {
      var st = soft ? g.statusSoft : g.statusOfficial;
      var pos = (g.pos != null && isFinite(g.pos)) ? Math.max(0, Math.min(1, g.pos)) : 0.5;
      var hi = g.syncHighlight ? ' border:2px solid #e8731a;background:#fffaf3' : '';
      var bandRef = '';
      if (g.bandValues && g.bandValues.p25 != null && g.bandValues.p75 != null) {
        var span = Math.max(g.bandValues.p75 - g.bandValues.p25, 1e-6);
        var lo = g.bandValues.p25, hiV = g.bandValues.p75;
        var pLo = 0.15, pHi = 0.85;
        bandRef = '<div style="position:relative;height:8px;border-radius:4px;background:#eef1f4;margin:6px 0 2px">'
          + '<div style="position:absolute;left:' + (pLo * 100).toFixed(1) + '%;width:' + ((pHi - pLo) * 100).toFixed(1)
          + '%;top:0;bottom:0;background:rgba(70,201,140,.35);border-radius:4px"></div></div>'
          + '<div class="tag">' + esc(BAND_COHORT_NOTE) + ' · p25 ' + lo + ' · p75 ' + hiV + (g.unit ? ' ' + esc(g.unit) : '') + '</div>';
      }
      return '<div class="gauge" style="' + hi + '"><div style="display:flex;justify-content:space-between;gap:8px">'
        + '<b>' + esc(g.displayName) + '</b><span class="tag">' + esc(g.confidenceLabel || '') + (g.syncHighlight ? ' · 대시보드 동기' : '') + '</span></div>'
        + bandRef
        + '<div class="gauge-bar"><div class="gauge-dot" style="left:' + (pos * 100).toFixed(1) + '%"></div></div>'
        + '<div class="lead">' + esc(g.displayNote) + ' · <b>' + esc(st) + '</b></div></div>';
    }).join('') + '</div>';
  }

  function priorityBlock(p, n) {
    if (!p) return '';
    return '<div class="prio"><div style="font-weight:800;margin-bottom:4px">' + n + '순위 · ' + esc(p.title) + '</div>'
      + '<div class="lead">단계 · ' + esc(p.phase) + '</div>'
      + (p.chainMeaning ? '<div class="lead" style="margin-top:4px">→ ' + esc(p.chainMeaning) + '</div>' : '')
      + (p.playerCue ? '<div class="lead" style="margin-top:4px">cue · ' + esc(p.playerCue) + '</div>' : '')
      + (p.nextMeasurementGoal ? '<div class="lead" style="margin-top:4px">다음 측정 · ' + esc(p.nextMeasurementGoal) + '</div>' : '')
      + '</div>';
  }

  function buildReportHTML_A(data) {
    data = data || {};
    var a = data.athlete || {};
    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(a.name) + ' 선수요약리포트 A형</title>'
      + '<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">'
      + '<style>' + CSS + '</style></head><body><div class="wrap">'
      + '<span class="badge badge-a">A형 · 선수 요약</span>'
      + '<h1>' + esc(a.name) + ' · 오늘의 투구 요약</h1>'
      + '<div class="sub">' + esc(a.hand) + 'HP · Max ' + (a.maxVelocity != null ? a.maxVelocity.toFixed(1) : '—') + ' km/h · Trials ' + (a.trialCount || 0)
      + (a.measurementDate ? ' · ' + esc(a.measurementDate) : '') + '</div>'
      + ((data.syncContext && data.syncContext.dashboardLinked) ? '<div class="note">대시보드에서 선택 중인 변인 · ' + esc(data.syncContext.activeVariableKey) + '</div>' : '')
      + '<h2>오늘의 한 줄</h2><div class="card lead"><b>' + esc((data.summary && data.summary.oneLine) || '') + '</b></div>'
      + '<h2>에너지 사슬 미니맵</h2>' + chainHtml((data.energyChain && data.energyChain.phases) || [], true)
      + '<div class="card"><b>오늘의 강점</b><ul style="margin:8px 0 0 18px">' + ((data.summary && data.summary.strengths) || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'
      + '<div class="card"><b>오늘의 보완</b><ul style="margin:8px 0 0 18px">' + ((data.summary && data.summary.weakLinks) || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>'
      + '<h2>Stick overlay</h2>' + captureHtml(data.captures && data.captures.primaryIssue, 'primary issue')
      + '<h2>오늘의 우선순위</h2>' + priorityBlock(data.summary && data.summary.priority1, 1) + priorityBlock(data.summary && data.summary.priority2, 2)
      + '<div class="page-break"></div>'
      + '<h2>엘리트 밴드 (구조 미리보기)</h2><div class="note">' + esc(BAND_PLACEHOLDER) + '</div>' + gaugeHtml(data.bandGauges || [], true)
      + '<h2>단계별 쉬운 설명</h2>' + ((data.phaseCardsEasy || []).map(function (c) {
        return '<div class="card"><b>' + esc(c.label) + '</b><div class="lead" style="margin-top:4px">' + esc(c.message) + '</div></div>';
      }).join(''))
      + '<h2>선수 cue · 추천 드릴</h2><div class="card"><ul style="margin-left:18px">' + (data.cues || []).concat(data.drills || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'
      + '<h2>다음 측정 목표</h2><div class="card"><ul style="margin-left:18px">' + (data.nextMeasurementGoals || []).map(function (g) {
        return '<li>' + esc(g.phaseLabel || g.goal || g.label || '—') + '</li>';
      }).join('') + '</ul></div>'
      + '<div class="note">' + esc(DEV_FRAMING) + '</div>'
      + '<div class="note" style="margin-top:8px">' + esc(CONF_FRAMING) + '</div>'
      + '</div></body></html>';
    return html;
  }

  function buildReportHTML_B(data) {
    data = data || {};
    var a = data.athlete || {};
    var html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(a.name) + ' 연구원설명리포트 B형</title>'
      + '<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">'
      + '<style>' + CSS + '</style></head><body><div class="wrap">'
      + '<span class="badge badge-b">B형 · 연구원 설명</span>'
      + '<h1>에너지 사슬 기반 투구 분석 리포트</h1>'
      + '<div class="sub">' + esc(a.name) + ' · ' + esc(a.hand) + 'HP · Max ' + (a.maxVelocity != null ? a.maxVelocity.toFixed(1) : '—') + ' km/h</div>'
      + ((data.syncContext && data.syncContext.dashboardLinked) ? '<div class="note">대시보드 동기 변인 · ' + esc(data.syncContext.activeVariableKey) + '</div>' : '')
      + '<div class="note">이 문서는 연구원이 선수·코치에게 설명하며 함께 보는 자료입니다.</div>'
      + '<h2>오늘의 한 줄</h2><div class="card lead"><b>' + esc((data.summary && data.summary.oneLine) || '') + '</b></div>'
      + '<h2>에너지 사슬 다이어그램</h2>' + chainHtml((data.energyChain && data.energyChain.phases) || [], false)
      + '<div class="card lead">보조 · 부하 / 체력 / 일관성은 메인 사슬과 분리해 참고합니다.</div>'
      + captureHtml(data.captures && data.captures.primaryIssue, 'primary issue')
      + '<div class="page-break"></div>'
      + '<h2>엘리트 정상군 20명 기준 · 밴드 게이지</h2><div class="note">' + esc(BAND_PLACEHOLDER) + '</div>' + gaugeHtml(data.bandGauges || [], false)
      + '<h2>단계별 공식 판정</h2><table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:#eef1f4"><th style="text-align:left;padding:8px;border:1px solid #dce3ec">단계</th>'
      + '<th style="padding:8px;border:1px solid #dce3ec">판정</th><th style="padding:8px;border:1px solid #dce3ec">역할</th></tr></thead><tbody>'
      + ((data.energyChain && data.energyChain.phases) || []).map(function (p) {
        return '<tr><td style="padding:8px;border:1px solid #dce3ec">' + esc(p.displayName) + '</td>'
          + '<td style="padding:8px;border:1px solid #dce3ec;font-weight:800">' + esc(p.statusOfficial) + '</td>'
          + '<td style="padding:8px;border:1px solid #dce3ec">' + esc(p.energyRole) + '</td></tr>';
      }).join('') + '</tbody></table>'
      + '<div class="note" style="margin-top:10px">' + esc(CONF_FRAMING) + '</div>'
      + '<div class="page-break"></div>'
      + '<h2>종합 해석 · 우선순위</h2>'
      + priorityBlock(data.summary && data.summary.priority1, 1) + priorityBlock(data.summary && data.summary.priority2, 2)
      + '<h2>체력 · 부하 · 일관성 참고</h2><div class="card lead">' + esc(LOAD_SAFETY) + '</div>'
      + '<h2>측정 한계 · 안전</h2><div class="note">' + esc(DEV_FRAMING) + '</div>'
      + '<div class="note" style="margin-top:8px">' + esc(PROHIBITED_CUE) + '</div>'
      + '</div></body></html>';
    return html;
  }

  return {
    REPORT_VERSION: REPORT_VERSION,
    DEV_FRAMING: DEV_FRAMING,
    BAND_PLACEHOLDER: BAND_PLACEHOLDER,
    copySmoke: copySmoke,
    softFromBandCode: softFromBandCode,
    officialFromBandCode: officialFromBandCode,
    buildTemplateData: buildTemplateData,
    buildReportHTML_A: buildReportHTML_A,
    buildReportHTML_B: buildReportHTML_B
  };
});
