/**
 * drive_v1_display.js — 드라이브 v1 표시 레이어 (계산·판정 SSOT 변경 없음)
 * 우수 / 보완 / 결함 · 4 코치 카드 · 연구자 패널 · Stick preset · 중복 방지
 */
(function (root) {
  'use strict';

  var V1_STATUS = ['우수', '보완', '결함'];
  var T1_KEYS = ['strideLen', 'comVDrop', 'comVelFC'];
  var FP_DRIVE_KEYS = { rearProp: 1, propImpPct: 1, drive_vertical_grf_peak_bw: 1 };

  var STICK_PRESETS = {
    forward_drop_drive: {
      displayMode: 'stick', view: 'side', overlay: 'comPath', helperGraph: 'COM-displacement-velocity',
      phaseKey: 'drive', event: 'FC', repVar: 'comVelFC', label: '전방-하강 — COM 전진·낙하'
    },
    trunk_early_opening: {
      displayMode: 'stick', view: 'rear', overlay: 'pelvisSho', helperGraph: 'trunk-rotation-kh-fc',
      phaseKey: 'drive', event: 'KH', repVar: 'trkOpenKF', label: '몸통 조기개방 — 골반·어깨선'
    },
    xfactor_formation: {
      displayMode: 'stick', view: 'rear', overlay: 'pelvisSho', helperGraph: 'xfactor-time-series',
      phaseKey: 'drive', event: 'FC', repVar: 'hssBuildKF', label: 'x-factor 형성 — KH→FC 분리'
    },
    direction_deviation: {
      displayMode: 'stick', view: 'top', overlay: 'comPath', helperGraph: 'lateral-deviation-stride',
      phaseKey: 'drive', event: 'FC', repVar: 'strideLen', label: '방향 이탈 — COM 경로·착지선'
    }
  };

  var CARD_DEFS = [
    {
      id: 'forward_drop_drive', title: '전방-하강 드라이브 부족', priority: 1, track: 'energy',
      judgmentKey: 'forward_drop_drive_group', proxyKeys: T1_KEYS, grouped: true,
      diagnosis: '무릎을 든 뒤 몸이 충분히 앞·아래로 이동하지 못해, 앞발에서 막고 회전으로 바꿀 입력 에너지가 부족합니다.',
      evidence: '전진 이동·수직 낙하·FC 전방속도 (한 카드로 묶음 · 개별 결함 나열 없음)',
      cue: '정점에서 마운드 경사를 타고 홈 방향으로 낮아지며 길게 이동합니다 — 몸이 무너지는 게 아니라 중심이 타깃 방향으로 길게 가는 느낌.',
      cueNote: '전방속도가 크더라도 방향·자세가 무너지면 제동이 어려움 — 방향 이탈 카드와 함께 해석.',
      drills: ['경사 활용 드롭-스텝 드라이브', '뒷다리 푸시로 타깃 향해 거리 늘리기', '메디신볼 전방 체스트패스'],
      nextGoal: '전진거리/신장 · 낙하/신장 · FC 전방속도 — 코호트 중앙값 접근',
      researchTab: 'ed-stride'
    },
    {
      id: 'trunk_early_opening', title: '몸통 조기개방', priority: 2, track: 'rotation',
      judgmentKey: 'trkOpenKF', proxyKeys: ['trkOpenKF'],
      diagnosis: '골반이 열리는 것은 자연스럽지만, 가슴이 함께 먼저 열리면 착지 무렵 몸통에 저장될 회전 여유가 줄어듭니다.',
      evidence: '몸통 조기개방(KH→FC) · 골반 조기개방은 참고만(결함 아님)',
      cue: '앞발이 나가는 동안 글러브 어깨가 너무 빨리 타깃으로 열리지 않게 두고, 골반만 먼저 보냅니다.',
      cueCoach: '우투는 3루·좌투는 1루 쪽으로 가슴을 조금 더 남기는 느낌.',
      cueNote: '골반을 막으라는 뜻이 아님 — 골반 선행은 정상, 가슴 지연이 핵심.',
      drills: ['골반-가슴 분리 드릴', '밴드 흉부 지연', '월/거울로 골반 먼저 시퀀스 확인'],
      nextGoal: '몸통 조기개방 감소',
      researchTab: 'ed-stride'
    },
    {
      id: 'xfactor_formation', title: 'x-factor 형성 부족', priority: 3, track: 'rotation',
      judgmentKey: 'hssBuildKF', proxyKeys: ['hssBuildKF'], suppressWhenTrunkBad: true,
      diagnosis: '드라이브 중 골반은 먼저 열리되 몸통이 남아 있어야 하는데, 착지 무렵 풀어 쓸 분리가 충분히 만들어지지 않습니다.',
      evidence: 'x-factor 변화(KH→FC) · FC x-factor는 보조',
      cue: '골반은 타깃으로 먼저, 가슴은 늦게 따라가 둘 사이를 벌립니다.',
      drills: ['골반 선행-몸통 지연 시퀀스 드릴', '메디신볼 힙턴', '커넥션볼로 가슴 조기개방 억제'],
      nextGoal: 'x-factor 변화량 ↑ · FC~FC직후 최대 형성',
      researchTab: 'ed-stride'
    },
    {
      id: 'direction_deviation', title: '드라이브 방향 이탈', priority: 4, track: 'direction',
      judgmentKey: 'direction_deviation', proxyKeys: ['direction_deviation'],
      diagnosis: '앞으로 나가는 힘이 타깃선에서 벗어나, 착지 후 앞발이 그 힘을 회전으로 바꾸기 어려운 자세로 진입합니다.',
      evidence: '측방 이탈(KH→FC) · 스트라이드 방향·FC 자세는 참고/연구자용',
      cue: '홈플레이트 한 점을 향해 일직선으로 떨어집니다.',
      drills: ['라인 드릴', '슬라이드보드 직선 이동', '착지 지점 마커 피드백'],
      nextGoal: '측방 이탈 감소',
      researchTab: 'ed-stride'
    }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mapBandToV1(bw, judgmentKey, dir) {
    if (!bw) return '보완';
    if (judgmentKey === 'trkOpenKF' || dir === -1) {
      if (bw === '높음' || bw === '미흡' || bw === '부족') return '결함';
      if (bw === '우수') return '우수';
      return '보완';
    }
    if (dir === 'range') {
      if (bw === '부족' || bw === '미흡') return '결함';
      if (bw === '높음') return '결함';
      if (bw === '우수' || bw === '엘리트 범위') return '우수';
      return '보완';
    }
    if (bw === '미흡' || bw === '부족' || bw === '높음') return '결함';
    if (bw === '우수') return '우수';
    return '보완';
  }

  function v1Rank(s) {
    if (s === '결함') return 0;
    if (s === '보완') return 1;
    return 2;
  }

  function worstV1(a, b) {
    return v1Rank(a) <= v1Rank(b) ? a : b;
  }

  function metricFromDet6(det6, key) {
    if (!det6 || !det6.stride || !key) return null;
    if (key === 'direction_deviation') return null;
    var arr = det6.stride;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].key === key) return arr[i];
    }
    return null;
  }

  function selectedTrial(DATA) {
    try {
      if (typeof window !== 'undefined' && typeof _fvSelectedTrial === 'function') return _fvSelectedTrial();
    } catch (e) {}
    var ts = DATA && DATA.trials;
    return (ts && ts.length) ? ts[0] : null;
  }

  function latDevMaxM(trial) {
    if (!trial) return null;
    try {
      if (typeof _strideLatDevSeries === 'function') {
        var dv = _strideLatDevSeries(trial);
        var e = trial.events || {};
        var i0 = e.i_kl_peak != null ? e.i_kl_peak : 0;
        var i1 = e.i_fc != null ? e.i_fc : (dv ? dv.length - 1 : 0);
        if (!dv) return null;
        var hi = 0;
        for (var i = i0; i <= i1 && i < dv.length; i++) {
          if (isFinite(dv[i])) hi = Math.max(hi, Math.abs(dv[i]));
        }
        return hi;
      }
    } catch (e) {}
    return null;
  }

  function judgeDirection(det6, M6, NB, DATA) {
    var dirErr = null;
    try {
      var sl = (typeof ETDIAG !== 'undefined' && ETDIAG) ? ETDIAG.stride : null;
      if (sl && sl.geometry && sl.geometry.dirErrorDeg != null) dirErr = sl.geometry.dirErrorDeg;
    } catch (e) {}
    var trial = selectedTrial(DATA);
    var maxM = latDevMaxM(trial);
    var status = '우수';
    if (dirErr != null) {
      if (dirErr > 15) status = '결함';
      else if (dirErr > 8) status = '보완';
    } else if (maxM != null) {
      if (maxM > 0.05) status = '결함';
      else if (maxM > 0.03) status = '보완';
    } else {
      status = '보완';
    }
    var details = [];
    if (dirErr != null) details.push({ key: 'dirErrorDeg', label: '착지 방향 오차', value: dirErr, unit: '°', v1Status: status });
    if (maxM != null) details.push({ key: 'latDevMax', label: '측방 이탈 peak', value: Math.round(maxM * 1000) / 10, unit: 'cm', v1Status: status });
    return { status: status, details: details, maxM: maxM, dirErr: dirErr };
  }

  function judgeProxyKeys(det6, M6, NB, proxyKeys, judgmentKey) {
    var worst = '우수';
    var details = [];
    (proxyKeys || []).forEach(function (key) {
      var m = metricFromDet6(det6, key);
      if (!m || m.value == null || !isFinite(m.value)) return;
      var nm = NB && NB[key];
      var bw = (M6 && M6.bandWord && nm) ? M6.bandWord(m.value, nm, m.dir) : null;
      var v1 = mapBandToV1(bw, judgmentKey, m.dir);
      worst = worstV1(worst, v1);
      details.push({ key: key, label: m.label || key, value: m.value, unit: m.unit || '', bandWord: bw, v1Status: v1 });
    });
    return { status: worst, details: details };
  }

  function judgeT1Group(det6, M6, NB) {
    return judgeProxyKeys(det6, M6, NB, T1_KEYS, 'forward_drop_drive_group');
  }

  function driveFpQcPassed(trial, DATA) {
    if (!trial) return false;
    var ts = trial.series || {};
    var fz = ts.FP1_Z;
    if (!fz || !fz.length) return false;
    var ev = trial.events || {};
    var ik = ev.i_kl_peak != null ? ev.i_kl_peak : 0;
    if (ik < 0 || ik >= fz.length) ik = 0;
    var fzKh = fz[ik];
    if (fzKh == null || !isFinite(fzKh)) return false;
    var bwN = (trial.grf && trial.grf.body_weight_N) || (((DATA && DATA.player && DATA.player.weight_kg) || 80) * 9.81);
    if (!bwN || bwN <= 0) return false;
    return (fzKh / bwN) >= 0.8;
  }

  function isFpDriveVariable(key) {
    return !!(key && FP_DRIVE_KEYS[key]);
  }

  function fpQcMessage() {
    return '접지 QC 미통과 — 드라이브 FP 탐색 변인(수직 GRF 등)은 연구자 패널·QC 통과 trial에서만';
  }

  function buildAllCoachCards(det6, M6, NB, DATA) {
    var fpQc = driveFpQcPassed(selectedTrial(DATA), DATA);
    var raw = CARD_DEFS.map(function (def) {
      var judgment = null;
      if (def.judgmentKey === 'forward_drop_drive_group') judgment = judgeT1Group(det6, M6, NB);
      else if (def.judgmentKey === 'direction_deviation') judgment = judgeDirection(det6, M6, NB, DATA);
      else if (def.judgmentKey) judgment = judgeProxyKeys(det6, M6, NB, def.proxyKeys, def.judgmentKey);
      var card = {
        id: def.id,
        title: def.title,
        priority: def.priority,
        track: def.track,
        judgmentKey: def.judgmentKey,
        grouped: !!def.grouped,
        suppressWhenTrunkBad: !!def.suppressWhenTrunkBad,
        diagnosis: def.diagnosis,
        evidence: def.evidence,
        cue: def.cue,
        cueCoach: def.cueCoach || null,
        cueNote: def.cueNote || null,
        drills: def.drills || [],
        nextGoal: def.nextGoal,
        researchTab: def.researchTab || 'ed-stride',
        stickPreset: STICK_PRESETS[def.id] || null,
        fpQcPassed: fpQc,
        visible: true,
        independent: true
      };
      if (judgment) {
        card.v1Status = judgment.status;
        card.v1StatusLabel = judgment.status;
        card.metricDetails = judgment.details || [];
      } else {
        card.v1Status = '보완';
        card.v1StatusLabel = '보완';
      }
      return card;
    });
    var trunk = raw.filter(function (c) { return c.id === 'trunk_early_opening'; })[0];
    var xf = raw.filter(function (c) { return c.id === 'xfactor_formation'; })[0];
    if (trunk && xf && trunk.v1Status !== '우수') {
      xf.independent = false;
      xf.visible = false;
      xf.suppressedByTrunk = true;
      xf.linkedNote = '몸통 조기개방과 연결 — 독립 결함 카드로 중복 표시하지 않음 · 연구자 패널에서 x-factor 변화 확인';
      trunk.xfactorLinkedNote = 'x-factor 형성은 몸통 조기개방과 원인 공유 가능 — 분리 변화량은 연구자 패널 참고';
    }
    return raw;
  }

  function buildCoachCards(det6, M6, NB, DATA) {
    return buildAllCoachCards(det6, M6, NB, DATA).filter(function (c) { return c.visible !== false; });
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
    var badge = '<span class="dr-v1-badge" style="' + statusStyle(card.v1Status || stLbl) + '">' + esc(stLbl) + '</span>';
    var cue = (coachMode && card.cueCoach) ? card.cueCoach : card.cue;
    var metrics = '';
    if (showNums && card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' ' + esc(d.value) + esc(d.unit) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    } else if (card.grouped) {
      metrics = '세 변인 통합 판정 · 개별 수치는 연구자 패널';
    } else if (card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    }
    return '<div class="dr-v1-card" data-dr-card="' + esc(card.id) + '">'
      + '<div class="dr-v1-card-head"><b>' + esc(card.title) + '</b> ' + badge + '</div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55">' + esc(card.diagnosis) + '</div>'
      + (card.evidence ? ('<div class="sub2" style="margin-top:4px">근거 · ' + esc(card.evidence) + '</div>') : '')
      + (metrics ? ('<div class="sub2" style="margin-top:4px">' + metrics + '</div>') : '')
      + (card.xfactorLinkedNote ? ('<div class="sub2" style="margin-top:4px;color:var(--cyan)">' + esc(card.xfactorLinkedNote) + '</div>') : '')
      + '<div class="note" style="margin-top:6px"><b>cue</b> · ' + esc(cue) + '</div>'
      + (card.cueNote ? ('<div class="sub2" style="margin-top:3px">' + esc(card.cueNote) + '</div>') : '')
      + '<div class="note" style="margin-top:4px"><b>드릴</b> · ' + esc((card.drills || []).slice(0, 2).join(' · ')) + '</div>'
      + '<div class="sub2" style="margin-top:4px">다음 측정 · ' + esc(card.nextGoal) + '</div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvDriveStickPreset(\'' + esc(card.id) + '\')" style="font-size:11px;padding:4px 9px">Stick preset</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-stride\')" style="font-size:11px;padding:4px 9px">연구자 탭</button>'
      + '</div></div>';
  }

  function coachCardsBlockHtml(cards, opts) {
    if (!cards || !cards.length) return '';
    var inner = cards.map(function (c) { return coachCardHtml(c, opts); }).join('');
    return '<div class="dr-v1-block"><div class="sub2" style="font-size:11px;margin-bottom:8px">드라이브 v1 · KH→FC · 우수/보완/결함 · x-factor는 와인드업이 아닌 드라이브 산물</div>'
      + inner + '</div>';
  }

  function scienceAccordion(title, bodyHtml, extraClass) {
    return '<details class="dr-v1-science-acc' + (extraClass ? ' ' + extraClass : '') + '">'
      + '<summary class="dr-v1-science-sum">' + esc(title) + '</summary>'
      + '<div class="dr-v1-science-body">' + bodyHtml + '</div></details>';
  }

  function playerStratificationNote(DATA) {
    var tier = '';
    var driveType = '';
    try {
      var FS = (typeof FEEDBACK_SUMMARY !== 'undefined') ? FEEDBACK_SUMMARY : (DATA && DATA.feedbackSummary);
      if (FS && FS.playerTier) tier = FS.playerTier;
      var X = (typeof ETDIAG !== 'undefined') ? ETDIAG : null;
      if (X && X.stride && X.stride.typeKo) driveType = X.stride.typeKo;
    } catch (e) {}
    var parts = [];
    if (tier) parts.push('스킬 수준 · ' + tier);
    if (driveType) parts.push('드라이브 유형 · ' + driveType);
    return parts.length ? parts.join(' · ') : '스킬 수준·동작 유형 — 세션 메타 확인';
  }

  function researchScienceAccordionsHtml(fpQc, DATA) {
    var stratNote = esc(playerStratificationNote(DATA));
    var anatomy = '<p>뒷다리 삼연 신전·고관절 외회전이 COM 전방 추진의 <b>근거</b> — 앞다리는 착지 후 브레이싱 전환.</p>'
      + '<ul><li>골반 선행 개방은 정상 체인 — <b>몸통 조기개방</b>만 결함 후보</li>'
      + '<li>리드 고관절·FC 자세 — 방향·자세 카드와 교차확인</li></ul>';
    var lenses = '<ul>'
      + '<li><b>기능해부학</b> — 뒷다리 추진·앞다리 브레이싱 · 골반-몸통 분리 협응</li>'
      + '<li><b>바이오메카닉스</b> — KH→FC 전진·낙하 크기 · 드라이브 후반 x-factor 형성(와인드업 산물 아님)</li>'
      + '<li><b>근신경역학</b> — SSC 단축 방출 가능성 · 앞무릎 전략은 유형·준비도 의존</li>'
      + '<li><b>모터 컨트롤</b> — drop-and-drive vs tall-and-fall 등 유형 내 효율 · 단일 정답 강요 지양</li></ul>';
    var strat = '<p class="sub2" style="margin:0 0 6px">' + stratNote + '</p>'
      + '<ul><li><b>스킬 수준</b> — 크기·몸통 조기개방 = 고교/발달 변별 · 엘리트 = 후속 연결·반복성</li>'
      + '<li><b>동작 유형</b> — 유형 간 우열보다 <b>유형 내</b> kinetic chain 의도</li>'
      + '<li>pooled 상관은 그룹 효과 포함 — 개인 인과처럼 단정하지 않음</li></ul>';
    var limits = '<ul>'
      + '<li>마커리스 x-factor·장축 회전 — validity 한계 · <b>변화량·순서</b> 위주 해석</li>'
      + '<li>드라이브 수직 GRF(' + (fpQc ? 'QC 통과 trial 탐색' : 'QC 미통과 · 미표시') + ') — 선수·코치 노출 없음 · 낮은 Fz=힘 부족 결함 아님</li>'
      + '<li>스트라이드 방향·FC 몸통 기울기·골반-몸통 onset — 산식·기준 미확정(확인 필요)</li>'
      + '<li>COM 감속·제동은 <b>블로킹</b> 단계 — 드라이브는 FC 인계물 설명</li></ul>';
    var blocking = '<p>FC 전방속도 → 앞발 제동(COM 감속) → 회전 전환 · x-factor 변화 → 몸통 회전 · 방향·자세 → 블로킹 품질.</p>';
    var refs = '<ul>'
      + '<li>Putnam (1993) — proximal-to-distal sequencing · <span class="sub2">대표 문헌</span></li>'
      + '<li>Hirashima et al. — sequencing/x-factor · <span class="sub2">대표 문헌</span></li>'
      + '<li>앞무릎 신전 PMC11329978 · <span class="sub2">유형·준비도 의존</span></li>'
      + '<li>Wulf (2013) — 외적 초점 cue · <span class="sub2">대표 문헌</span></li></ul>';
    return scienceAccordion('기능해부학 근거', anatomy, 'dr-v1-science-anatomy')
      + scienceAccordion('과학근거 4렌즈', lenses, 'dr-v1-science-lenses')
      + scienceAccordion('층화 분석 원칙', strat, 'dr-v1-science-strat')
      + scienceAccordion('데이터 신뢰도와 한계', limits, 'dr-v1-science-limits')
      + scienceAccordion('후속 블로킹 연결', blocking, 'dr-v1-science-blocking')
      + scienceAccordion('참고문헌', refs, 'dr-v1-science-refs');
  }

  function researchOverviewHtml(cards, fpQc, DATA) {
    cards = cards || [];
    DATA = DATA || (typeof window !== 'undefined' && window.DATA) || null;
    var rows = cards.map(function (c) {
      return '<tr><td>' + esc(c.title) + '</td><td style="' + statusStyle(c.v1Status) + '">' + esc(c.v1StatusLabel || '—') + '</td><td>' + esc(c.judgmentKey || '') + '</td></tr>';
    }).join('');
    return '<div class="research-expert-title">드라이브 — kinetic chain expert</div>'
      + '<div class="ad-sec dr-v1-science-top"><b>기능적 의도</b><br>'
      + 'KH→FC 구간 — 와인드업에서 준비한 위치에너지·회전 준비를 <b>전방 운동량</b>으로 전환 · '
      + 'FC에서 블로킹이 회전으로 전환할 <b>방향·자세·x-factor 형성 조건</b>을 넘기는 인계 단계.</div>'
      + '<div class="ad-sec"><b>핵심 질문</b><br>FC에 ① 막을 전진 운동량 ② 블로킹 가능한 방향·자세 ③ 풀어낼 분리(x-factor)를 넘겼는가?</div>'
      + '<div class="ad-sec"><b>독립 판정 4축</b><br>① 전진 에너지(전진·낙하·FC속도 묶음) ② 몸통 조기개방 ③ x-factor 변화 ④ 측방 이탈</div>'
      + (rows ? ('<div class="ad-sec"><b>현재 선수 — 독립 판정</b><table class="dr-v1-mini-table"><thead><tr><th>축</th><th>상태</th><th>키</th></tr></thead><tbody>' + rows + '</tbody></table></div>') : '')
      + '<div class="ad-sec"><b>변인별 해석 (요약)</b><ul class="dr-v1-science-inline">'
      + '<li><b>전진·낙하·FC속도</b> — 드라이브 크기 · T1 카드 통합 · 개별 coach 카드 없음</li>'
      + '<li><b>몸통 조기개방</b> — trkOpenKF · 골반 조기개방 중립</li>'
      + '<li><b>x-factor 변화</b> — hssBuildKF · 와인드업 평가 아님 · 몸통 조기개방 우선 시 연구자 연결</li>'
      + '<li><b>측방 이탈</b> — COM 경로 · 방향은 이 축만</li>'
      + '<li><b>FC x-factor·스트라이드 방향</b> — descriptor/보조 · stride direction 기준 보류</li>'
      + '<li><b>드라이브 수직 GRF</b> — 연구자 탐색 · QC 통과만' + (fpQc ? '' : ' · 현재 trial 미표시') + '</li>'
      + '</ul></div>'
      + '<div class="dr-v1-science-acc-wrap">' + researchScienceAccordionsHtml(fpQc, DATA) + '</div>'
      + '<div class="ad-sec sub2">드라이브 v1 · render-only · x-factor는 와인드업 산물 아님 · COM 감속은 블로킹</div>';
  }

  function getStickPreset(cardId) {
    return STICK_PRESETS[cardId] || null;
  }

  function shouldShowFpVariable(key, trial, DATA) {
    if (!isFpDriveVariable(key)) return true;
    return driveFpQcPassed(trial || selectedTrial(DATA), DATA);
  }

  root.DRIVE_V1 = {
    V1_STATUS: V1_STATUS,
    CARD_DEFS: CARD_DEFS,
    STICK_PRESETS: STICK_PRESETS,
    T1_KEYS: T1_KEYS,
    buildCoachCards: buildCoachCards,
    buildAllCoachCards: buildAllCoachCards,
    coachCardHtml: coachCardHtml,
    coachCardsBlockHtml: coachCardsBlockHtml,
    researchOverviewHtml: researchOverviewHtml,
    mapBandToV1: mapBandToV1,
    driveFpQcPassed: driveFpQcPassed,
    isFpDriveVariable: isFpDriveVariable,
    shouldShowFpVariable: shouldShowFpVariable,
    fpQcMessage: fpQcMessage,
    getStickPreset: getStickPreset,
    metricFromDet6: metricFromDet6,
    judgeDirection: judgeDirection
  };
})(typeof window !== 'undefined' ? window : globalThis);
