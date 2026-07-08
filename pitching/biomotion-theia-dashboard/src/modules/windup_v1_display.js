/**
 * windup_v1_display.js — 와인드업 v1 표시 레이어 (계산·판정 SSOT 변경 없음)
 * 우수 / 보완 / 결함 · 4 코치 카드 · 연구자 패널 · Stick preset · FP 접지 QC
 */
(function (root) {
  'use strict';

  var V1_STATUS = ['우수', '보완', '결함'];
  var FP_WINDUP_KEYS = { freeMo: 1, wuCoilTq: 1, rear_foot_free_moment_windup_peak: 1, windup_vertical_grf_peak_bw: 1 };

  var STICK_PRESETS = {
    early_uncoiling: {
      displayMode: 'stick', view: 'rear', overlay: 'pelvisSho', helperGraph: 'rotation-onset-time-series',
      phaseKey: 'windup', event: 'KH', repVar: 'wuPelVel', label: '조기풀림 — 골반·어깨 조기개방'
    },
    counter_rotation: {
      displayMode: 'stick', view: 'top', overlay: 'pelvisSho', helperGraph: 'closed-angle-band',
      phaseKey: 'windup', event: 'KH', repVar: 'wuPelCloseKH', label: '반대회전 — 닫힘각'
    },
    rear_hip_coil: {
      displayMode: 'stick', view: 'rear', overlay: 'hipCoil', helperGraph: 'hip-coil-time-series',
      phaseKey: 'windup', event: 'KH', repVar: 'wuDriveHipER', label: '뒷고관절 코일'
    },
    potential_energy: {
      displayMode: 'stick', view: 'side', overlay: 'comPath', helperGraph: 'COM-height-and-transition',
      phaseKey: 'windup', event: 'KH', repVar: 'hipHinge', label: '위치에너지 — COM 전환 준비'
    }
  };

  var CARD_DEFS = [
    {
      id: 'early_uncoiling', title: '조기풀림', priority: 1, track: 'rotation',
      judgmentKey: 'early_uncoiling_index', proxyKeys: ['wuPelVel', 'wuTrkVel'],
      diagnosis: '무릎이 정점에 가기 전에 가슴과 골반이 먼저 열려, 착지 후 써야 할 회전 에너지가 미리 새고 있습니다.',
      evidence: '조기풀림 지수 · pre-KH 골반/몸통 회전속도',
      cue: 'KH까지 가슴을 닫아두고, 앞발이 나가기 시작할 때 자연스럽게 풀어냅니다.',
      cueNote: '과하게 닫아두면 팔 타이밍·스트라이드가 막힐 수 있음 — 먼저 열리지 않게까지만.',
      drills: ['월 드릴(앞 어깨가 벽 향한 채 니하이까지 유지)', '카운트 슬로우 와인드업(정점까지 천천히)', '커넥션볼 유지'],
      nextGoal: '조기풀림지수 ↓ · pre-KH 회전속도 ≈0',
      researchTab: 'ed-windup'
    },
    {
      id: 'counter_rotation', title: '반대회전 부족', priority: 2, track: 'rotation',
      judgmentKey: 'kh_closed_angle_combined', proxyKeys: ['wuPelCloseKH', 'wuTrunkCloseKH'],
      diagnosis: '무릎을 들 때 몸이 충분히 감기지 않아, 착지 후 풀어 쓸 회전 여유가 작습니다.',
      evidence: 'KH 상하체 동시 닫힘각 (접지 QC 통과 시 프리모먼트 보조)',
      cue: '정점에서 글러브 어깨와 골반을 살짝 닫아둡니다 — 머리와 중심은 그대로.',
      cueNote: '과회전·시선이탈 금지. 과한 wrap은 스트라이드 방향을 해침.',
      drills: ['메디신볼 반대-감았다 던지기', '밴드 카운터로테이션 홀드(2초)', '거울 와인드업'],
      nextGoal: 'KH 닫힘각 코호트 중앙값 도달',
      researchTab: 'ed-windup'
    },
    {
      id: 'rear_hip_coil', title: '뒷고관절 코일 부족', priority: 3, track: 'rotation',
      judgmentKey: 'windup_coil_rom_start_to_kh', proxyKeys: ['wuPelCoil', 'wuDriveHipER'],
      diagnosis: '뒷다리에 앉기는 하지만, 고관절에 회전 로딩이 충분히 걸리지 않아 드라이브에서 골반이 힘 있게 열릴 준비가 부족합니다.',
      evidence: '와인드업 코일 가동폭 · 뒷고관절 힌지(전제) · 리드 고관절 회전 동작(처방 단서)',
      cue: '허리를 비트는 게 아니라, 뒷고관절 안쪽에 힘이 감기게 앉습니다.',
      cueNote: '코일 부족 시: 들어올린 앞다리 고관절을 같이 돌려 골반을 함께 감습니다. 리드 고관절 회전은 독립 평가 항목 아님.',
      drills: ['뒷다리 단일지지 힙 내회전 로딩(벽 짚고)', '밴드 힙 코일 홀드(2초)', '메디신볼 힙턴 throw(고강도)'],
      nextGoal: '와인드업 코일 가동폭 ↑(힌지 유지한 채)',
      researchTab: 'ed-windup'
    },
    {
      id: 'potential_energy', title: '위치에너지 전환 준비 부족', priority: 4, track: 'pe',
      judgmentKey: null, proxyKeys: ['hipHinge'],
      descriptorOnly: true,
      diagnosis: '정점에서 만든 높이와 중심이 다음 드라이브의 전방-하강 움직임으로 연결될 준비가 부족합니다.',
      evidence: 'KH COM 높이 · 리드 대퇴 들어올림 · KH COM 수직속도 · KH COM 전후 적재',
      cue: '정점에서 높이를 만드는 것보다, 그 높이를 앞으로 떨어지며 드라이브로 연결하는 느낌이 중요합니다.',
      cueNote: '몸을 뒷다리 위에 잘 실어 마운드 경사를 타고 전방-하강으로. "더 높이"·"땅을 더 세게" 메시지 금지.',
      drills: ['밸런스 홀드(정점 통제)', '뒷고관절 적재 후 전방-하강 드릴', '정점→드라이브 연결 분절 드릴'],
      nextGoal: 'KH COM 전후 적재(뒷발 위) · 전환은 드라이브(낙하→전진)에서 확인',
      researchTab: 'ed-windup'
    }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function mapBandToV1(bw, judgmentKey) {
    if (!bw) return '보완';
    if (judgmentKey === 'early_uncoiling_index') {
      if (bw === '높음' || bw === '미흡' || bw === '부족') return '결함';
      if (bw === '우수') return '우수';
      return '보완';
    }
    if (judgmentKey === 'kh_closed_angle_combined') {
      if (bw === '부족' || bw === '미흡' || bw === '높음') return '결함';
      if (bw === '우수') return '우수';
      return '보완';
    }
    if (judgmentKey === 'windup_coil_rom_start_to_kh') {
      if (bw === '부족' || bw === '미흡') return '결함';
      if (bw === '우수' || bw === '높음') return '우수';
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
    if (!det6 || !det6.windup || !key) return null;
    var arr = det6.windup;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].key === key) return arr[i];
    }
    return null;
  }

  function judgeProxyKeys(det6, M6, NB, proxyKeys, judgmentKey) {
    var worst = '우수';
    var details = [];
    (proxyKeys || []).forEach(function (key) {
      var m = metricFromDet6(det6, key);
      if (!m || m.value == null || !isFinite(m.value)) return;
      var nm = NB && NB[key];
      var bw = (M6 && M6.bandWord && nm) ? M6.bandWord(m.value, nm, m.dir) : null;
      var v1 = mapBandToV1(bw, judgmentKey);
      worst = worstV1(worst, v1);
      details.push({ key: key, label: m.label || key, value: m.value, unit: m.unit || '', bandWord: bw, v1Status: v1 });
    });
    return { status: worst, details: details };
  }

  function judgeEarlyUncoiling(det6, M6, NB, DATA) {
    var j = judgeProxyKeys(det6, M6, NB, ['wuPelVel', 'wuTrkVel'], 'early_uncoiling_index');
    try {
      var ph = DATA && DATA.phases;
      var ea = ph && ph.earlyArm;
      if (ea && ea.label && ea.label !== 'normal') {
        j.status = worstV1(j.status, ea.label === 'risk' ? '결함' : '보완');
        j.earlyArmNote = ea.label === 'risk' ? 'KH 팔 조기 장전 위험' : 'KH 팔 조기 장전 주의';
      }
    } catch (e) {}
    return j;
  }

  function windupFpQcPassed(trial, DATA) {
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
    var pct = fzKh / bwN;
    return pct >= 0.8;
  }

  function selectedTrial(DATA) {
    try {
      if (typeof window !== 'undefined' && typeof _fvSelectedTrial === 'function') return _fvSelectedTrial();
    } catch (e) {}
    var ts = DATA && DATA.trials;
    return (ts && ts.length) ? ts[0] : null;
  }

  function isFpWindupVariable(key) {
    return !!(key && FP_WINDUP_KEYS[key]);
  }

  function fpQcMessage() {
    return '접지 QC 미통과로 표시 제외 — 윈드업 뒷발 완전 접지 trial에서만 FP 변인 표시';
  }

  function buildCoachCards(det6, M6, NB, DATA) {
    var trial = selectedTrial(DATA);
    var fpQc = windupFpQcPassed(trial, DATA);
    return CARD_DEFS.map(function (def) {
      var judgment = null;
      if (def.judgmentKey === 'early_uncoiling_index') judgment = judgeEarlyUncoiling(det6, M6, NB, DATA);
      else if (def.judgmentKey) judgment = judgeProxyKeys(det6, M6, NB, def.proxyKeys, def.judgmentKey);
      var card = {
        id: def.id,
        title: def.title,
        priority: def.priority,
        track: def.track,
        judgmentKey: def.judgmentKey,
        descriptorOnly: !!def.descriptorOnly,
        diagnosis: def.diagnosis,
        evidence: def.evidence,
        cue: def.cue,
        cueNote: def.cueNote,
        drills: def.drills || [],
        nextGoal: def.nextGoal,
        researchTab: def.researchTab || 'ed-windup',
        stickPreset: STICK_PRESETS[def.id] || null,
        fpQcPassed: fpQc
      };
      if (def.descriptorOnly) {
        card.v1Status = null;
        card.v1StatusLabel = '별도 트랙';
      } else if (judgment) {
        card.v1Status = judgment.status;
        card.v1StatusLabel = judgment.status;
        card.metricDetails = judgment.details || [];
        card.earlyArmNote = judgment.earlyArmNote || null;
      } else {
        card.v1Status = '보완';
        card.v1StatusLabel = '보완';
      }
      return card;
    });
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
    var stLbl = card.descriptorOnly ? (card.v1StatusLabel || '별도 트랙') : (card.v1StatusLabel || '보완');
    var badge = '<span class="wu-v1-badge" style="' + statusStyle(card.v1Status || stLbl) + '">' + esc(stLbl) + '</span>';
    var metrics = '';
    if (showNums && card.metricDetails && card.metricDetails.length) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' ' + esc(d.value) + esc(d.unit) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    } else if (card.metricDetails && card.metricDetails.length && !card.descriptorOnly) {
      metrics = card.metricDetails.map(function (d) {
        return esc(d.label) + ' · ' + esc(d.v1Status || '');
      }).join(' · ');
    }
    var html = '<div class="wu-v1-card" data-wu-card="' + esc(card.id) + '">'
      + '<div class="wu-v1-card-head"><b>' + esc(card.title) + '</b> ' + badge + '</div>'
      + '<div class="note" style="margin-top:6px;line-height:1.55">' + esc(card.diagnosis) + '</div>'
      + (card.evidence ? ('<div class="sub2" style="margin-top:4px">근거 · ' + esc(card.evidence) + '</div>') : '')
      + (metrics ? ('<div class="sub2" style="margin-top:4px">' + metrics + '</div>') : '')
      + (card.earlyArmNote ? ('<div class="sub2" style="margin-top:4px;color:var(--amber)">' + esc(card.earlyArmNote) + '</div>') : '')
      + '<div class="note" style="margin-top:6px"><b>cue</b> · ' + esc(card.cue) + '</div>'
      + (card.cueNote ? ('<div class="sub2" style="margin-top:3px">' + esc(card.cueNote) + '</div>') : '')
      + '<div class="note" style="margin-top:4px"><b>드릴</b> · ' + esc((card.drills || []).slice(0, 2).join(' · ')) + '</div>'
      + '<div class="sub2" style="margin-top:4px">다음 측정 · ' + esc(card.nextGoal) + '</div>'
      + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">'
      + '<button type="button" class="bm-focus-btn" onclick="window._fvWindupStickPreset(\'' + esc(card.id) + '\')" style="font-size:11px;padding:4px 9px">Stick preset</button>'
      + '<button type="button" class="bm-focus-btn" onclick="setPage(\'ed-windup\')" style="font-size:11px;padding:4px 9px">연구자 탭</button>'
      + '</div></div>';
    return html;
  }

  function coachCardsBlockHtml(cards, opts) {
    if (!cards || !cards.length) return '';
    var inner = cards.map(function (c) { return coachCardHtml(c, opts); }).join('');
    return '<div class="wu-v1-block"><div class="sub2" style="font-size:11px;margin-bottom:8px">와인드업 v1 · 회전 저장(1~3) · 위치에너지(4) 분리 · 우수/보완/결함</div>'
      + inner + '</div>';
  }

  function scienceAccordion(title, bodyHtml, extraClass) {
    return '<details class="wu-v1-science-acc' + (extraClass ? ' ' + extraClass : '') + '">'
      + '<summary class="wu-v1-science-sum">' + esc(title) + '</summary>'
      + '<div class="wu-v1-science-body">' + bodyHtml + '</div></details>';
  }

  function playerStratificationNote(DATA) {
    var tier = '';
    var windupType = '';
    try {
      var FS = (typeof FEEDBACK_SUMMARY !== 'undefined') ? FEEDBACK_SUMMARY : (DATA && DATA.feedbackSummary);
      if (FS && FS.playerTier) tier = FS.playerTier;
      var X = (typeof ETDIAG !== 'undefined') ? ETDIAG : null;
      if (X && X.windup && X.windup.typeKo) windupType = X.windup.typeKo;
    } catch (e) {}
    var parts = [];
    if (tier) parts.push('스킬 수준 · ' + tier);
    if (windupType) parts.push('와인드업 유형 · ' + windupType);
    return parts.length ? parts.join(' · ') : '스킬 수준·동작 유형 — 세션 메타 확인';
  }

  function researchScienceAccordionsHtml(fpQc, DATA) {
    var stratNote = esc(playerStratificationNote(DATA));
    var anatomy = '<p>힌지는 뒷고관절 코일의 <b>전제 조건</b> — 코일을 직접 보장하지는 않음.</p>'
      + '<ul><li>뒷고관절 코일 — 고정 대퇴 위 골반 회전 로딩 · 후방사슬·둔부 협응</li>'
      + '<li>리드 고관절 — 코일 형성 <b>전략</b>일 수 있음 · 독립 평가 항목 아님 · 과회전 시 stride direction 교차확인</li>'
      + '<li>프리토크 — 접지 QC 통과 trial에서만 탐색적 보조 · 코일 대체 지표 아님</li></ul>';
    var lenses = '<ul>'
      + '<li><b>기능해부학</b> — 반대회전·코일 = 고관절·골반·몸통·리드 다리 협응 · 후방사슬 신장성 로딩</li>'
      + '<li><b>바이오메카닉스</b> — 와인드업은 시퀀싱 <b>준비</b> 단계 · x_factor는 드라이브 후반 산물</li>'
      + '<li><b>근신경역학</b> — 힌지·코일 = 고관절 신전·외회전 계열 사전부하 가능성 · 조기풀림 = 사전부하 조기 소실 패턴</li>'
      + '<li><b>모터컨트롤</b> — 스킬·유형에 따라 힌지-코일 결합 방식 상이 · 단일 이상치 강요 지양</li></ul>';
    var strat = '<p class="sub2" style="margin:0 0 6px">' + stratNote + '</p>'
      + '<ul><li><b>스킬 수준</b> — 발달/고교: 저장·코일 형성 강조 · 엘리트: 후속 연결·반복성·유형 내 효율</li>'
      + '<li><b>동작 유형</b> — 유형 간 우열보다 <b>유형 내</b> kinetic chain 의도 달성 여부</li>'
      + '<li>pooled 상관·코호트 비교는 그룹 효과를 포함 — 개인 인과처럼 단정하지 않음</li></ul>';
    var limits = '<ul>'
      + '<li>마커리스 장축 회전(코일 등) — 체계적 편향 가능성 · 영상·보조 지표 교차확인</li>'
      + '<li>FP 변인(' + (fpQc ? '현재 trial QC 통과' : '현재 trial QC 미통과') + ') — '
      + (fpQc ? '탐색 표시 가능' : '값 미표시·임퓨테이션 없음') + ' · 낮은 Fz를 힘 부족/결함으로 해석하지 않음</li>'
      + '<li>위치에너지 높이 자체 ≠ 우수 · KH→FC 전방-하강 전환은 드라이브에서 확인</li>'
      + '<li>문헌·pooled 분석은 <b>정합·지지·가능성</b> 수준으로 서술 — 확정 인과 회피</li></ul>';
    var refs = '<ul>'
      + '<li>Putnam (1993) — proximal-to-distal sequencing · <span class="sub2">대표 문헌</span></li>'
      + '<li>Fleisig et al. — pitching kinematics/kinetics · <span class="sub2">대표 문헌</span></li>'
      + '<li>Kibler et al. — kinetic chain · <span class="sub2">대표 문헌</span></li>'
      + '<li>상세·확인 필요 문헌 — 분석 이론 메뉴 「와인드업 — 회전 저장과 위치에너지 준비」</li></ul>';
    return scienceAccordion('기능해부학 근거', anatomy, 'wu-v1-science-anatomy')
      + scienceAccordion('과학근거 4렌즈', lenses, 'wu-v1-science-lenses')
      + scienceAccordion('층화 분석 원칙', strat, 'wu-v1-science-strat')
      + scienceAccordion('데이터 한계와 해석 주의', limits, 'wu-v1-science-limits')
      + scienceAccordion('참고문헌', refs, 'wu-v1-science-refs');
  }

  function researchOverviewHtml(cards, fpQc, DATA) {
    cards = cards || [];
    DATA = DATA || (typeof window !== 'undefined' && window.DATA) || null;
    var rows = cards.filter(function (c) { return !c.descriptorOnly; }).map(function (c) {
      return '<tr><td>' + esc(c.title) + '</td><td style="' + statusStyle(c.v1Status) + '">' + esc(c.v1StatusLabel || '—') + '</td><td>' + esc(c.judgmentKey || 'descriptor') + '</td></tr>';
    }).join('');
    var peCard = cards.filter(function (c) { return c.descriptorOnly; })[0];
    return '<div class="research-expert-title">와인드업 — kinetic chain expert</div>'
      + '<div class="ad-sec wu-v1-science-top"><b>기능적 의도</b><br>'
      + '와인드업은 드라이브·착지 후 회전 전환을 위한 <b>저장 단계</b>. '
      + '반대회전+뒷고관절 코일로 드라이브 후반 x_factor 형성 조건을 준비 · '
      + '위치에너지는 KH→FC 전방-하강 전환 준비 descriptor. '
      + '<b>x_factor는 와인드업 산물이 아님</b>(드라이브 후반 산물).</div>'
      + '<div class="ad-sec"><b>독립 판정 3축</b><br>① 조기풀림 ② KH 상하체 동시 닫힘각(반대회전) ③ 와인드업 코일 가동폭 — 우수/보완/결함</div>'
      + (rows ? ('<div class="ad-sec"><b>현재 선수 — 독립 판정</b><table class="wu-v1-mini-table"><thead><tr><th>진단</th><th>상태</th><th>키</th></tr></thead><tbody>' + rows + '</tbody></table></div>') : '')
      + '<div class="ad-sec"><b>descriptor / 전략 / 탐색</b><ul class="wu-v1-science-inline">'
      + '<li><b>위치에너지</b> — KH COM·전후 적재 · 독립 우/보/결 없음</li>'
      + '<li><b>리드 고관절 회전</b> — 코일 형성 전략 · stride direction과 교차확인</li>'
      + '<li><b>프리모먼트·수직 GRF</b> — FP 탐색 · QC 통과 trial만' + (fpQc ? '' : ' · 현재 trial 미표시') + '</li>'
      + (peCard ? ('<li><b>' + esc(peCard.title) + '</b> — 별도 트랙 descriptor</li>') : '')
      + '</ul></div>'
      + '<div class="ad-sec"><b>후속 드라이브 연결</b><br>저장 → 드라이브 후반 x_factor · FC 직후 최대 · 낙하→전진은 드라이브 평가</div>'
      + '<div class="wu-v1-science-acc-wrap">' + researchScienceAccordionsHtml(fpQc, DATA) + '</div>'
      + '<div class="ad-sec sub2">과학근거 v2 · render-only · 계산·판정 SSOT 미변경 · 상세는 분석 이론 메뉴</div>';
  }

  function getStickPreset(cardId) {
    return STICK_PRESETS[cardId] || null;
  }

  function shouldShowFpVariable(key, trial, DATA) {
    if (!isFpWindupVariable(key)) return true;
    return windupFpQcPassed(trial || selectedTrial(DATA), DATA);
  }

  root.WINDUP_V1 = {
    V1_STATUS: V1_STATUS,
    CARD_DEFS: CARD_DEFS,
    STICK_PRESETS: STICK_PRESETS,
    buildCoachCards: buildCoachCards,
    coachCardHtml: coachCardHtml,
    coachCardsBlockHtml: coachCardsBlockHtml,
    researchOverviewHtml: researchOverviewHtml,
    researchScienceAccordionsHtml: researchScienceAccordionsHtml,
    scienceAccordion: scienceAccordion,
    mapBandToV1: mapBandToV1,
    windupFpQcPassed: windupFpQcPassed,
    isFpWindupVariable: isFpWindupVariable,
    shouldShowFpVariable: shouldShowFpVariable,
    fpQcMessage: fpQcMessage,
    getStickPreset: getStickPreset,
    metricFromDet6: metricFromDet6
  };
})(typeof window !== 'undefined' ? window : globalThis);
