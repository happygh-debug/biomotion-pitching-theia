/**
 * blocking_v1_display.js — 블로킹 v1 표시 레이어 (계산·판정 SSOT 변경 없음)
 * 우수 / 보완 / 결함 · 3 코치 카드 · 몸통 cross-link · 연구자 패널 · Stick preset
 */
(function (root) {
  'use strict';

  var V1_STATUS = ['우수', '보완', '결함'];
  var FP_BLOCK_KEYS = { apBrakeImpulse: 1, leadVGRFImpulse: 1, lead_cop_path: 1 };

  var STICK_PRESETS = {
    lead_bracing_collapse: {
      displayMode: 'stick', view: 'side', overlay: 'kneeAngle', helperGraph: 'knee-angle-fc-br',
      phaseKey: 'blocking', event: 'FC', repVar: 'kneeCollapse', label: '앞다리 버팀 — FC→BR 무릎 arc'
    },
    direction_leak: {
      displayMode: 'stick', view: 'top', overlay: 'comPath', helperGraph: 'lateral-deviation-blocking',
      phaseKey: 'blocking', event: 'FC', repVar: 'comVelReductionFCBR', label: '방향 누수 — FC→BR COM 경로'
    },
    braking_input: {
      displayMode: 'stick', view: 'side', overlay: 'comDecelArrow', helperGraph: 'com-speed-fc-br',
      phaseKey: 'blocking', event: 'FC', repVar: 'comVelReductionFCBR', label: '제동 입력 — COM 감속'
    },
    trunk_rotation_link: {
      displayMode: 'stick', view: 'rear', overlay: 'pelvisSho', helperGraph: 'trunk-rotation-link',
      phaseKey: 'blocking', event: 'FC', repVar: 'torsoRotV', label: '몸통 회전 연결 — cross-link'
    }
  };

  var CARD_DEFS = [
    {
      id: 'lead_bracing_collapse', title: '앞다리 버팀 부족 / 무릎 붕괴', priority: 1, track: 'bracing',
      judgmentKey: 'lead_knee_flexion_change_fc_br', proxyKeys: ['kneeCollapse'],
      diagnosis: '앞발이 닿은 뒤 앞무릎이 더 접히면서, 앞으로 가던 힘이 회전으로 바뀌지 못하고 흡수됩니다.',
      evidence: '앞무릎 굴곡변화 FC→BR · 앞다리 전략 분류(참고 descriptor)',
      cue: '앞발이 닿으면 그 다리 위에서 몸이 돌아나가게 합니다.',
      cueNote: '무릎을 강제로 펴라는 뜻이 아님 — 무너지지 않는 지렛대 · 버팀형/발산형 우열 없음',
      drills: ['앞다리 착지-버팀 홀드', '벽/허들 앞 블로킹 스텝', '밴드 저항 앞다리 신장성 제동'],
      nextGoal: 'FC→BR 무릎 붕괴 감소 · 흡수형→버팀형 방향 · 강제 신전 금지',
      researchTab: 'ed-blocking'
    },
    {
      id: 'direction_leak', title: '블로킹 방향 누수', priority: 2, track: 'direction',
      judgmentKey: 'lateral_deviation_fc_br', proxyKeys: ['lateral_deviation_fc_br'],
      diagnosis: '앞발에서 막는 힘이 타깃선에서 벗어나, 회전으로 바뀔 힘이 옆으로 샙니다.',
      evidence: '측방 이탈 FC→BR · 드라이브(KH→FC) 방향과 구분',
      cue: '앞발을 디딘 뒤 몸이 홈플레이트 선 위에서 돌아나가게 합니다.',
      cueNote: '예쁜 직선이 목적이 아님 — 전환 효율 손실(방향 누수) 관점',
      drills: ['라인 위 블로킹 스텝', '착지 지점 마커 피드백', '슬라이드보드 직선-회전'],
      nextGoal: 'FC→BR 측방 이탈 감소',
      researchTab: 'ed-blocking'
    },
    {
      id: 'braking_input', title: '제동 입력 부족', priority: 3, track: 'braking', auxiliary: true,
      judgmentKey: 'com_braking_fc_br', proxyKeys: ['comVelReductionFCBR'],
      diagnosis: '앞발에서 전진 속도를 충분히 잡지 못해, 회전으로 바꿀 입력이 약합니다.',
      evidence: 'COM 감속 FC→BR · AP 제동 임펄스는 FP2 QC 통과 시 연구자 보조',
      cue: '앞발이 닿을 때 몸이 계속 밀려가지 않고 그 자리에서 회전으로 바뀌게 합니다.',
      cueNote: '보조 카드 — 많이 멈춤이 목적 아님 · 버팀·방향과 함께 해석',
      drills: ['블로킹 후 회전 연결 드릴', '앞다리 정지-회전 전환', '메디신볼 측면 회전 토스'],
      nextGoal: 'COM 감속 확보 · 버팀·방향과 함께',
      researchTab: 'ed-blocking'
    }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mapBandToV1(bw, judgmentKey, dir) {
    if (!bw) return '보완';
    if (judgmentKey === 'lead_knee_flexion_change_fc_br' || dir === -1) {
      if (bw === '높음' || bw === '체크필요' || bw === '부족') return '결함';
      if (bw === '우수') return '우수';
      return '보완';
    }
    if (dir === 'range') {
      if (bw === '부족' || bw === '체크필요') return '결함';
      if (bw === '높음') return '결함';
      if (bw === '우수' || bw === '엘리트 범위') return '우수';
      return '보완';
    }
    if (bw === '체크필요' || bw === '부족' || bw === '높음') return '결함';
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
    var arr = det6.block || det6.stride || det6.trunk || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].key === key) return arr[i];
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

  function driveTypeLabel(DATA) {
    var dt = metricFromPhases('driveType', DATA);
    if (dt && dt.value != null) return String(dt.value);
    var K = DATA && DATA.phases && DATA.phases.knee5;
    if (K && K.typeKo) return K.typeKo;
    return null;
  }

  function leadKneeExtVelPeak(det6, DATA) {
    var m = metricFromDet6(det6, 'leadKneeVelPk') || metricFromPhases('leadKneeVelPk', DATA);
    if (m && m.value != null && isFinite(m.value)) return m;
    return null;
  }

  function buildLeadKneeDetailDescriptors(det6, M6, NB, DATA) {
    var lines = [];
    var ext = leadKneeExtVelPeak(det6, DATA);
    if (ext) lines.push({ key: 'lead_knee_extension_velocity', label: '앞무릎 신전속도 peak', value: ext.value, unit: ext.unit || '°/s', descriptor: true });
    var dt = driveTypeLabel(DATA);
    if (dt) lines.push({ key: 'lead_leg_strategy_class', label: '전략 유형', value: dt, unit: '', descriptor: true });
    var bt = blockingTypeLabel(DATA);
    if (bt && bt !== dt) lines.push({ key: 'blockingType', label: '블로킹 유형', value: bt, unit: '', descriptor: true });
    var rom = metricFromPhases('kneeExtROM', DATA) || metricFromDet6(det6, 'kneeExtROM');
    if (rom && rom.value != null && isFinite(rom.value)) {
      lines.push({ key: 'kneeExtROM', label: '신전 ROM FC→BR', value: rom.value, unit: rom.unit || '°', descriptor: true });
    }
    return lines;
  }

  function leadKneeDetailCoachHtml(lines) {
    if (!lines || !lines.length) return '';
    var inner = lines.map(function (d) {
      return '<li><b>' + esc(d.label) + '</b> · ' + esc(d.value) + esc(d.unit) + ' <span class="sub2">(descriptor · 독립 판정 없음)</span></li>';
    }).join('');
    return '<div class="blk-v1-lead-knee-detail" data-blk-lead-knee-detail="1">'
      + '<div class="sub2" style="font-weight:700;margin-top:8px;margin-bottom:4px">앞다리 버팀 상세 · 구 앞무릎 전달</div>'
      + '<ul class="blk-v1-science-inline" style="margin:0;padding-left:18px;line-height:1.55;font-size:12px">' + inner + '</ul>'
      + '<div class="sub2" style="margin-top:4px">독립 단계 해제 · 블로킹 카드1 하위 · 전달 타이밍은 연구자 재검증 후보</div></div>';
  }

  function leadKneeDetailResearchHtml(lines) {
    if (!lines || !lines.length) {
      return '<div class="ad-sec blk-v1-lead-knee-detail" id="blk-lead-knee-detail" data-blk-lead-knee-detail="1">'
        + '<b>앞다리 버팀 상세 · 구 앞무릎 전달</b><br>'
        + '독립 단계·독립 우수/보완/결함 해제 · 신전속도·전략 유형·FC/BR 무릎각은 descriptor · 선수·코치는 블로킹 카드1 하위</div>';
    }
    var rows = lines.map(function (d) {
      return '<tr><td>' + esc(d.label) + '</td><td>' + esc(d.value) + esc(d.unit) + '</td><td class="sub2">descriptor</td></tr>';
    }).join('');
    return '<details class="blk-v1-science-acc blk-v1-lead-knee-detail" id="blk-lead-knee-detail" data-blk-lead-knee-detail="1" open>'
      + '<summary class="blk-v1-science-sum">앞다리 버팀 상세 · 구 앞무릎 전달</summary>'
      + '<div class="blk-v1-science-body">'
      + '<p>구 <b>앞무릎 전달</b>은 독립 판정 단계에서 해제 · 블로킹 앞다리 버팀 레이어로 흡수 · 전달 타이밍은 마커 기반 재검증 후보.</p>'
      + '<table class="blk-v1-mini-table"><thead><tr><th>항목</th><th>값</th><th>역할</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '</div></details>';
  }

  function blockingTypeLabel(DATA) {
    var bt = DATA && DATA.phases && DATA.phases.blockingType;
    if (!bt) return null;
    return bt.easy || bt.label || bt.type || null;
  }

  function latDevMaxFcBr(trial) {
    if (!trial) return null;
    try {
      if (typeof _strideLatDevSeries !== 'function') return null;
      var dv = _strideLatDevSeries(trial);
      if (!dv) return null;
      var e = trial.events || {};
      var i0 = e.i_fc != null ? e.i_fc : 0;
      var i1 = e.i_br != null ? e.i_br : dv.length - 1;
      var hi = 0;
      for (var i = i0; i <= i1 && i < dv.length; i++) {
        if (isFinite(dv[i])) hi = Math.max(hi, Math.abs(dv[i]));
      }
      return hi;
    } catch (e) { return null; }
  }

  function judgeBracing(det6, M6, NB, DATA) {
    var m = metricFromPhases('kneeCollapse', DATA) || metricFromDet6(det6, 'kneeCollapse');
    var worst = '우수';
    var details = [];
    if (m && m.value != null && isFinite(m.value)) {
      var nm = NB && NB.kneeCollapse;
      var bw = (M6 && M6.bandWord && nm) ? M6.bandWord(m.value, nm, m.dir != null ? m.dir : -1) : null;
      var v1 = mapBandToV1(bw, 'lead_knee_flexion_change_fc_br', -1);
      worst = v1;
      details.push({ key: 'kneeCollapse', label: '무릎 굴곡 붕괴량', value: m.value, unit: m.unit || '°', v1Status: v1 });
    }
    var bt = blockingTypeLabel(DATA);
    if (bt) details.push({ key: 'blockingType', label: '앞다리 전략', value: bt, unit: '', v1Status: '—', descriptor: true });
    var lkDesc = buildLeadKneeDetailDescriptors(det6, M6, NB, DATA);
    if (lkDesc.length) details = details.concat(lkDesc);
    if (!details.length) worst = '보완';
    return { status: worst, details: details };
  }

  function judgeDirection(det6, M6, NB, DATA) {
    var trial = selectedTrial(DATA);
    var maxM = latDevMaxFcBr(trial);
    var status = '우수';
    if (maxM != null) {
      if (maxM > 0.031) status = '결함';
      else if (maxM > 0.018) status = '보완';
    } else {
      status = '보완';
    }
    var details = [];
    if (maxM != null) {
      details.push({ key: 'latDevFcBr', label: '측방 이탈 peak FC→BR', value: Math.round(maxM * 1000) / 10, unit: 'cm', v1Status: status });
    }
    return { status: status, details: details };
  }

  function judgeBraking(det6, M6, NB) {
    var m = metricFromDet6(det6, 'comVelReductionFCBR');
    if (!m || m.value == null || !isFinite(m.value)) return { status: '보완', details: [] };
    var nm = NB && NB.comVelReductionFCBR;
    var bw = (M6 && M6.bandWord && nm) ? M6.bandWord(m.value, nm, m.dir) : null;
    var v1 = mapBandToV1(bw, 'com_braking_fc_br', m.dir);
    return {
      status: v1,
      details: [{ key: 'comVelReductionFCBR', label: 'COM 전진속도 감소', value: m.value, unit: m.unit || 'm/s', v1Status: v1 }]
    };
  }

  function buildTrunkCrossLink(det6, M6, NB) {
    var m = metricFromDet6(det6, 'torsoRotV');
    var ref = '';
    if (m && m.value != null && isFinite(m.value)) {
      ref = '몸통 각속도 peak ' + m.value + (m.unit || '°/s') + ' · ';
    }
    return {
      text: ref + '블로킹 이후 몸통 회전으로 이어졌는지 확인합니다. 자세한 평가는 몸통 단계에서 봅니다.',
      owner: 'trunk',
      repVar: 'torsoRotV',
      independentBlockingCard: false
    };
  }

  function blockingFpQcPassed(trial, DATA) {
    if (!trial) return false;
    var ts = trial.series || {};
    var fz = ts.FP2_Z;
    if (!fz || !fz.length) return false;
    var ev = trial.events || {};
    var ifc = ev.i_fc != null ? ev.i_fc : 0;
    if (ifc < 0 || ifc >= fz.length) ifc = 0;
    var fzFc = fz[ifc];
    if (fzFc == null || !isFinite(fzFc)) return false;
    var bwN = (trial.grf && trial.grf.body_weight_N) || (((DATA && DATA.player && DATA.player.weight_kg) || 80) * 9.81);
    if (!bwN || bwN <= 0) return false;
    return (Math.abs(fzFc) / bwN) >= 0.8;
  }

  function isFpBlockingVariable(key) {
    return !!(key && FP_BLOCK_KEYS[key]);
  }

  function fpQcMessage() {
    return '접지 QC 미통과 — FP2 탐색 변인(앞발 AP 제동·COP 등)은 연구자 패널·QC 통과 trial에서만';
  }

  function buildAllCoachCards(det6, M6, NB, DATA) {
    var fpQc = blockingFpQcPassed(selectedTrial(DATA), DATA);
    return CARD_DEFS.map(function (def) {
      var judgment = null;
      if (def.judgmentKey === 'lead_knee_flexion_change_fc_br') judgment = judgeBracing(det6, M6, NB, DATA);
      else if (def.judgmentKey === 'lateral_deviation_fc_br') judgment = judgeDirection(det6, M6, NB, DATA);
      else if (def.judgmentKey === 'com_braking_fc_br') judgment = judgeBraking(det6, M6, NB);
      var card = {
        id: def.id,
        title: def.title,
        priority: def.priority,
        track: def.track,
        auxiliary: !!def.auxiliary,
        judgmentKey: def.judgmentKey,
        diagnosis: def.diagnosis,
        evidence: def.evidence,
        cue: def.cue,
        cueNote: def.cueNote || null,
        drills: def.drills || [],
        nextGoal: def.nextGoal,
        researchTab: def.researchTab || 'ed-blocking',
        stickPreset: STICK_PRESETS[def.id] || null,
        fpQcPassed: fpQc,
        visible: true,
        independent: true
      };
      if (judgment) {
        card.v1Status = judgment.status;
        card.v1StatusLabel = judgment.status;
        card.metricDetails = judgment.details || [];
        if (def.id === 'lead_bracing_collapse') {
          card.leadKneeDetail = buildLeadKneeDetailDescriptors(det6, M6, NB, DATA);
        }
      } else {
        card.v1Status = '보완';
        card.v1StatusLabel = '보완';
      }
      return card;
    });
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

  function coachCardHtml(card, opts) {
    if (!card) return '';
    opts = opts || {};
    var showNums = !!opts.showNumbers;
    var coachMode = !!opts.coachMode;
    var stLbl = card.v1StatusLabel || '보완';
    var badge = '<span class="blk-v1-badge" style="' + statusStyle(card.v1Status || stLbl) + '">' + esc(stLbl) + '</span>';
    var metrics = '';
    if (showNums && card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.filter(function (d) { return !d.descriptor; }).map(function (d) {
        return esc(d.label) + ' ' + esc(d.value) + esc(d.unit) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    } else if (card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        if (d.descriptor) return esc(d.label) + ' · ' + esc(d.value);
        return esc(d.label) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    }
    var leadDetail = (card.id === 'lead_bracing_collapse' && card.leadKneeDetail && card.leadKneeDetail.length)
      ? leadKneeDetailCoachHtml(card.leadKneeDetail) : '';
    return '<div class="blk-v1-card" data-blk-card="' + esc(card.id) + '">'
      + '<div class="blk-v1-card-head"><b>' + esc(card.title) + '</b> ' + badge
      + (card.auxiliary ? ' <span class="sub2" style="font-size:10px">보조</span>' : '') + '</div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55">' + esc(card.diagnosis) + '</div>'
      + (card.evidence ? ('<div class="sub2" style="margin-top:4px">근거 · ' + esc(card.evidence) + '</div>') : '')
      + (metrics ? ('<div class="sub2" style="margin-top:4px">' + metrics + '</div>') : '')
      + leadDetail
      + '<div class="note" style="margin-top:6px"><b>cue</b> · ' + esc(card.cue) + '</div>'
      + (card.cueNote ? ('<div class="sub2" style="margin-top:3px">' + esc(card.cueNote) + '</div>') : '')
      + '<div class="note" style="margin-top:4px"><b>드릴</b> · ' + esc((card.drills || []).slice(0, 2).join(' · ')) + '</div>'
      + '<div class="sub2" style="margin-top:4px">다음 측정 · ' + esc(card.nextGoal) + '</div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvBlockingStickPreset(\'' + esc(card.id) + '\')" style="font-size:11px;padding:4px 9px">Stick preset</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-blocking\')" style="font-size:11px;padding:4px 9px">연구자 탭</button>'
      + '</div></div>';
  }

  function trunkCrossLinkHtml(cross, opts) {
    if (!cross) return '';
    return '<div class="blk-v1-crosslink" data-blk-crosslink="trunk">'
      + '<div class="sub2" style="font-weight:700;margin-bottom:4px">연결 · 몸통 회전으로 이어졌는가 (cross-link)</div>'
      + '<div class="note" style="line-height:1.5;font-size:12px">' + esc(cross.text) + '</div>'
      + '<div style="margin-top:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvBlockingStickPreset(\'trunk_rotation_link\')" style="font-size:11px;padding:3px 9px;margin-right:6px">Stick · 연결 확인</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-trunk\')" style="font-size:11px;padding:3px 9px">몸통 단계 →</button>'
      + '</div></div>';
  }

  function coachCardsBlockHtml(cards, opts, cross) {
    if (!cards || !cards.length) return '';
    opts = opts || {};
    cross = cross || null;
    var inner = cards.map(function (c) { return coachCardHtml(c, opts); }).join('');
    return '<div class="blk-v1-block"><div class="sub2" style="font-size:11px;margin-bottom:8px">블로킹 v1 · FC→BR · 전진→회전 전환 · 우수/보완/결함</div>'
      + inner + trunkCrossLinkHtml(cross, opts) + '</div>';
  }

  function scienceAccordion(title, bodyHtml, extraClass) {
    return '<details class="blk-v1-science-acc' + (extraClass ? ' ' + extraClass : '') + '">'
      + '<summary class="blk-v1-science-sum">' + esc(title) + '</summary>'
      + '<div class="blk-v1-science-body">' + bodyHtml + '</div></details>';
  }

  function researchScienceAccordionsHtml(fpQc) {
    var anatomy = '<p>앞다리 = 고정 발 위 <b>강체 지렛대</b>. 대퇴사두·둔근·햄스트링·고관절 외전근이 앞다리 무너짐을 지지 → 골반이 앞 고관절 위로 회전.</p>';
    var lenses = '<ul>'
      + '<li><b>바이오메카닉스</b> — 선운동량→각운동량 전환 · 앞발 제동 모멘트로 골반·몸통 회전</li>'
      + '<li><b>근신경역학</b> — 신장성 브레이싱·SSC · RFD·사전활성이 제동·전환 좌우</li>'
      + '<li><b>모터컨트롤</b> — 버팀형 vs 흡수형 = 협응 전략 차이 · 단일 이상치 강요 금지</li>'
      + '<li><b>기능해부학 연결</b> — 무릎 강제 신전 지시 금지 · 지렛대 유지가 목표</li></ul>';
    var strat = '<ul><li><b>스킬 수준</b> — 고교/발달: 버팀·방향 비중 ↑ · 엘리트: 유형 내 효율·후속 연결</li>'
      + '<li><b>동작 유형</b> — 버팀형/발산형 라벨 · 유형 우열 금지 · 유형 내 전환·부하</li>'
      + '<li>pooled 상관은 그룹 효과 포함 — 개인 인과 단정 금지</li></ul>';
    var limits = '<ul>'
      + '<li>몸통 각속도 peak — <b>몸통 단계 소유</b> · 블로킹 독립 판정 금지</li>'
      + '<li>FP2(' + (fpQc ? 'QC 통과' : 'QC 미통과') + ') — apBrakeImpulse·COP 연구자 보조 · 낮은 Fz=약한 블로킹 해석 금지</li>'
      + '<li>골반 Z 회전 validity 한계 — COM 제동(병진) 신뢰 &gt; 몸통 &gt; 골반 Z</li></ul>';
    var follow = '<ul>'
      + '<li><b>앞무릎 전달</b> — 신전 전략·속도·타이밍은 앞무릎 전달 단계 소유</li>'
      + '<li><b>몸통</b> — torsoRotV 독립 판정은 몸통 단계</li>'
      + '<li>블로킹 실패 → 팔 보상·부하 증가 가능(후속 검증)</li></ul>';
    var refs = '<ul><li>Putnam (1993) · JSCR 2022 PMID 35836313 · PMC11329978 · Wulf (2013)</li></ul>';
    return scienceAccordion('기능해부학 근거', anatomy, 'blk-v1-science-anatomy')
      + scienceAccordion('과학근거 4렌즈', lenses, 'blk-v1-science-lenses')
      + scienceAccordion('층화 분석 원칙', strat, 'blk-v1-science-strat')
      + scienceAccordion('데이터 신뢰도와 한계', limits, 'blk-v1-science-limits')
      + scienceAccordion('후속 단계 연결', follow, 'blk-v1-science-blocking')
      + scienceAccordion('참고문헌', refs, 'blk-v1-science-refs');
  }

  function researchOverviewHtml(cards, fpQc, DATA) {
    cards = cards || [];
    DATA = DATA || (typeof window !== 'undefined' && window.DATA) || null;
    var det6 = null;
    var M6 = null;
    var NB = null;
    try {
      det6 = (typeof mech6 !== 'undefined' && mech6.detail6) ? mech6.detail6(DATA) : null;
      M6 = (typeof mech6 !== 'undefined') ? mech6 : null;
      NB = (typeof BIOMOTION_NORMS !== 'undefined') ? BIOMOTION_NORMS : null;
    } catch (e) {}
    var cross = buildTrunkCrossLink(det6, M6, NB);
    var lkLines = buildLeadKneeDetailDescriptors(det6, M6, NB, DATA);
    var rows = cards.filter(function (c) { return c.independent !== false; }).map(function (c) {
      return '<tr><td>' + esc(c.title) + '</td><td style="' + statusStyle(c.v1Status) + '">' + esc(c.v1StatusLabel || '—') + '</td><td>' + esc(c.judgmentKey || '') + '</td></tr>';
    }).join('');
    return '<div class="research-expert-title">블로킹 — kinetic chain expert</div>'
      + '<div class="ad-sec blk-v1-science-top"><b>기능적 의도</b><br>'
      + '드라이브 전진 운동량을 <b>앞다리 지렛대</b>로 회전 전환 · 독립 판정은 몸통이 빨랐는지가 아니라 '
      + '앞다리 무너짐·방향 누수·전진 속도 제동(보조)을 본다.</div>'
      + '<div class="ad-sec"><b>핵심 질문</b><br>앞발 착지가 전진 에너지를 흡수했는가, 회전으로 바꾸었는가?</div>'
      + (rows ? ('<div class="ad-sec"><b>독립 판정 3축</b><table class="blk-v1-mini-table"><thead><tr><th>축</th><th>상태</th><th>키</th></tr></thead><tbody>' + rows + '</tbody></table></div>') : '')
      + '<div class="ad-sec"><b>전환 확인 — 몸통 회전으로 이어졌는가</b><br>' + esc(cross.text)
      + '<div style="margin-top:6px"><button type="button" class="bm-focus-btn" onclick="setPage(\'ed-trunk\')" style="font-size:11px;padding:3px 9px">몸통 단계에서 자세히 →</button></div></div>'
      + leadKneeDetailResearchHtml(lkLines)
      + '<div class="ad-sec"><b>변인별 해석 (요약)</b><ul class="blk-v1-science-inline">'
      + '<li><b>무릎 굴곡변화</b> — FC→BR 붕괴/버팀 · 최우선 · 강제 신전 금지</li>'
      + '<li><b>측방 이탈</b> — FC→BR만 · 드라이브(KH→FC)와 구분</li>'
      + '<li><b>COM 감속</b> — 보조 · FP2 AP는 QC 통과만' + (fpQc ? '' : ' · 현재 trial 미표시') + '</li>'
      + '<li><b>몸통 각속도</b> — cross-link · 몸통 단계 소유 · 이중 판정 금지</li>'
      + '</ul></div>'
      + '<div class="blk-v1-science-acc-wrap">' + researchScienceAccordionsHtml(fpQc) + '</div>'
      + '<div class="ad-sec sub2">블로킹 v1 · render-only · 계산 SSOT 미변경</div>';
  }

  function getStickPreset(cardId) {
    return STICK_PRESETS[cardId] || null;
  }

  function shouldShowFpVariable(key, trial, DATA) {
    if (!isFpBlockingVariable(key)) return true;
    return blockingFpQcPassed(trial || selectedTrial(DATA), DATA);
  }

  root.BLOCKING_V1 = {
    V1_STATUS: V1_STATUS,
    CARD_DEFS: CARD_DEFS,
    STICK_PRESETS: STICK_PRESETS,
    buildCoachCards: buildCoachCards,
    buildAllCoachCards: buildAllCoachCards,
    buildTrunkCrossLink: buildTrunkCrossLink,
    buildLeadKneeDetailDescriptors: buildLeadKneeDetailDescriptors,
    leadKneeDetailResearchHtml: leadKneeDetailResearchHtml,
    coachCardHtml: coachCardHtml,
    coachCardsBlockHtml: coachCardsBlockHtml,
    researchOverviewHtml: researchOverviewHtml,
    mapBandToV1: mapBandToV1,
    blockingFpQcPassed: blockingFpQcPassed,
    isFpBlockingVariable: isFpBlockingVariable,
    shouldShowFpVariable: shouldShowFpVariable,
    fpQcMessage: fpQcMessage,
    getStickPreset: getStickPreset
  };
})(typeof window !== 'undefined' ? window : globalThis);
