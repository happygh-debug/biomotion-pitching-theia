/* lower_body_util.js — 투구 하체·상체 활용 진단 (선수·코치용 0-100 점수 + 라벨 + 원인)
 * @SYSTEM=THEIA · dashboard_core SSOT. 목적: "하체/상체를 잘 쓰는가 / 못 쓰면 어디가 원인인가"를 점수+근거로 진단.
 * [2026-08-12] assess(하체) + assessUpper(상체 전달) — 선수·코치 전달력↑ 위해 검증 평가를 0-100 점수판으로(교수 지시).
 *
 * 스펙(pitching_theia_lower_body_energy_flow_implementation_spec.md · de Swart 2022)을 우리 검증 사실에 맞춰 구현.
 * ★스펙과의 의도적 차이(전부 우리 실측 근거 — _분석/obp_validation/):
 *  1. 0-100 종합점수(lowerBodyUtilizationIndex) 도입 — [2026-08-12 교수 원칙A 해제] "필요하면 자유롭게 점수 생성" 승인.
 *     단 스펙 §11의 임의 가중치(0.35/0.25…)는 미사용 → 가중치를 우리 마커리스 검증 구속레버 강도에서 도출(원칙B 준수).
 *     ★이 점수는 하체활용 진단 전용 · mech5 5단계 종합점수와 독립(mech5 불변).
 *  2. leadLegChain '원위→근위 순서 판정' 미사용 — 838trial서 회수(무릎·고관절 사실상 동시·순서충족 13%). 밴드 방식.
 *  3. l5s1Transfer 미도입 — Theia에 L5-S1 채널 없음·골반 dME/dt 프록시 부적합(전진 성분 지배). 정직하게 '미측정'.
 *  4. JFP/STP 원시 재계산 안 함 — V3D가 Force_Power(전달)·Moment_Power(생성)를 이미 산출. 기존 채널·기존 규준 사용.
 *  5. 구속 관계는 우리 마커리스 검증 레버만 근거로(comKEdrop .42·apBrakeImpulse .36·leadHipAbsorb .43·rearProp/driveWork .22~.23).
 *     전달형(leadHipTransfer 등)은 마커계 특이(마커리스 null)라 '구동 근거'로 쓰지 않음.
 *
 * 라벨: 하체 활용 우수 / 부분 활용 / 하체 전달 부족 / 자료 부족. 원인=가장 약한 역할 + feedback_causemap 상류 원인.
 */
(function (root) {
  var M6 = root.mech5 || root.mech6 || null;
  var NORMS = root.PITCH_NORMS || null;
  var CAUSE = root.FEEDBACK_CAUSEMAP || null;

  // phaseData(stages) → key별 {value,dir,score,neutral}
  function _byKey(DATA) {
    var out = {};
    if (!DATA || !DATA.phases || !DATA.phases.stages) return out;
    DATA.phases.stages.forEach(function (st) {
      (st.metrics || []).forEach(function (m) { if (m && m.key) out[m.key] = m; });
    });
    return out;
  }
  // 변인 → 밴드워드(우수/정상/미흡/부족/…) + 상태(+1/0/-1/na). band 방향은 phaseData dir·규준 SSOT.
  //  ★dir==='range'(유형 의존·전략형): '부족'은 결함 아님(mech5.bandCounts 철학) → s=0(neutral). 우수/정상만 반영.
  function _band(byk, key) {
    var m = byk[key]; if (!m || m.value == null || !isFinite(m.value)) return { w: null, s: 'na' };
    var nm = NORMS && NORMS[key]; if (!nm) return { w: null, s: 'na' };
    var w = M6 && M6.bandWord ? M6.bandWord(m.value, nm, m.dir) : null;
    var b = M6 && M6.band ? M6.band(m.value, nm, m.dir) : null;   // 우수/정상/미흡(range=정상/미흡)
    var s;
    if (m.dir === 'range') s = (b === '정상' ? 0 : (w === '높음' ? 1 : 'na'));   // 부족=미카운트(neutral)·범위=정상·높음=+
    else s = b === '우수' ? 1 : (b === '미흡' ? -1 : (b === '정상' ? 0 : 'na'));
    return { w: w, s: s, val: m.value, unit: m.unit, band: b };
  }
  // 역할 = 구성 변인 밴드 집계. good(우수 우세·미흡 0) / ok / weak(미흡 우세) / na(값 없음). ctx=표시만·상태 미반영.
  function _role(byk, key, label, members, note) {
    var rows = members.map(function (mk) { var b = _band(byk, mk.key); return { key: mk.key, label: mk.label, w: b.w, s: b.s, val: b.val, unit: b.unit, lever: mk.lever || false, ctx: mk.ctx || false }; });
    var avail = rows.filter(function (r) { return r.s !== 'na' && !r.ctx; });   // ctx는 상태 계산 제외(표시만)
    if (!avail.length) return { key: key, label: label, status: 'na', rows: rows, note: note };
    var good = avail.filter(function (r) { return r.s === 1; }).length;
    var weak = avail.filter(function (r) { return r.s === -1; }).length;
    var status;
    if (weak > good && weak >= 1) status = 'weak';
    else if (good >= 1 && weak === 0) status = 'good';
    else status = 'ok';
    return { key: key, label: label, status: status, rows: rows, good: good, weak: weak, n: avail.length, note: note };
  }

  var _CAUSE_OF = {   // 역할 약함 → feedback_causemap 상류 원인 키
    drive: 'stride', leadchain: 'blocking', stability: 'blocking', pelvis: 'pelvistrunk', timing: 'trunkarm'
  };
  var _STATUS_KO = { good: '양호', ok: '보통', weak: '보강 필요', na: '자료 없음' };

  // ── 역할 가중치 — 우리 마커리스 구속레버 강도(rho)에서 도출(원칙B). 스펙 임의값 미사용 ──
  //  stability=우리 최상위 3레버(comKEdrop .42·apBrake .36·leadHipAbsorb .43) · drive=중간(rearProp/driveWork .22~.23)
  //  pelvis=rotKEgain(별도 n34 r .49)·pelvisRotV · leadchain/timing=구조검증O·구속 마커리스 미검증(전달형)→낮게.
  var _ROLE_W = { stability: 0.30, drive: 0.25, pelvis: 0.20, leadchain: 0.15, timing: 0.10 };
  // 밴드워드 → 0-100 (엘리트 밴드 위치). range 부족은 결함 아님(약한 감점만).
  function _memScore(r) {
    if (r.s === 'na') return null;
    var w = r.w;
    if (w === '우수') return 90; if (w === '정상') return 72; if (w === '미흡') return 48;
    if (w === '높음') return 84; if (w === '엘리트 범위') return 72; if (w === '부족') return 66;   // range(유형) — 부족도 크게 안 깎음
    return r.s === 1 ? 88 : (r.s === -1 ? 50 : 70);   // 폴백(밴드워드 없을 때)
  }
  function _roleScore(role) {
    var vals = (role.rows || []).filter(function (r) { return !r.ctx; }).map(_memScore).filter(function (x) { return x != null; });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
  }

  // 메인: DATA(phaseData) + X(etdiag.compute 결과) → 하체 활용 진단
  function assess(DATA, X) {
    var byk = _byKey(DATA);
    // ── 티어: 역동역학(GRF/force-power) 채널 유무 ──
    var hasKinetic = (byk.apBrakeImpulse && byk.apBrakeImpulse.value != null) || (byk.leadHipAbsorb && byk.leadHipAbsorb.value != null);
    var tier = hasKinetic ? 'full' : 'proxy';   // full=역동역학 기반 · proxy=운동학 프록시(속도·회전KE)

    // ── 역할 5종 (검증 변인·밴드) ──
    var roles = [];
    roles.push(_role(byk, 'drive', '뒷다리 구동 (에너지 생성)', [
      { key: 'rearProp', label: '뒷발 미는 힘', lever: true }, { key: 'driveWork', label: '드라이브 관절 일', lever: true }, { key: 'backHipNet', label: '뒷다리 → 골반 순 에너지 전달', ctx: true }
    ], '축발(뒷다리)이 미는 엔진 — 고관절 중심 생성. 구속 검증 레버: rearProp·driveWork(뒷다리 → 골반 순 에너지 전달=방향 참고 · 2026-10-11 옛 「뒷고관절 전달」 대신).'));

    // 앞다리 상향 전달 = lowerChainSeq 밴드(순서 아님·타이밍 정상범위)
    var lc = X && X.lowerChain;
    var leadchain;
    if (lc && lc.nodes && lc.nodes.some(function (n) { return n.present; })) {
      var nb = lc.nodes.filter(function (n) { return n.present && n.band; });
      var g = nb.filter(function (n) { return n.band.s === 'good'; }).length, w = nb.filter(function (n) { return n.band.s === 'leak'; }).length;
      leadchain = { key: 'leadchain', label: '앞다리 상향 전달', status: nb.length ? (w > g ? 'weak' : (g >= 1 && w === 0 ? 'good' : 'ok')) : 'na',
        rows: lc.nodes.map(function (n) { return { key: n.key, label: n.label, w: n.present && n.band ? n.band.label : '데이터 없음', s: n.present && n.band ? (n.band.s === 'good' ? 1 : (n.band.s === 'leak' ? -1 : 0)) : 'na' }; }),
        note: '앞다리 발목·무릎·고관절 전달 타이밍이 그룹 밴드 정상범위인지(순서 판정 아님 — 838trial서 동시성 확인).' };
    } else {
      leadchain = { key: 'leadchain', label: '앞다리 상향 전달', status: 'na', rows: [], note: '하지 force-power 채널 없음(GRF 미측정 세션) — 타이밍 밴드 판정 불가.' };
    }
    roles.push(leadchain);

    roles.push(_role(byk, 'stability', '앞다리 안정·블로킹', [
      { key: 'comKEdrop', label: '무게중심 감속', lever: true }, { key: 'apBrakeImpulse', label: '앞발 제동 임펄스', lever: true }, { key: 'leadHipAbsorb', label: '앞고관절 관절력 유입(앞대퇴→골반)', lever: true }
    ], '앞다리가 받아내 단단한 축(안정 기저) — 우리 최상위 구속 레버 3종. 흡수는 클수록 좋음(연구 추측과 반대·우리 실측 r=+.43).'));

    roles.push(_role(byk, 'pelvis', '골반 통합·회전', [
      { key: 'pelvisRotV', label: '골반 회전속도' }, { key: 'rotKEgain', label: '회전 KE 증가' }
    ], '양다리 기여가 골반 회전으로 모이는지. (L5-S1 몸통 전달은 Theia 채널 부재로 미측정 — 아래 참고.)'));

    // 하체→상체 타이밍 = 기존 powerSeq efficiency(코호트 밴드)
    var ps = X && X.powerSeq;
    var timingStatus = 'na', timingRows = [];
    if (ps && ps.efficiency != null) {
      timingStatus = ps.efficiency >= 75 ? 'good' : (ps.efficiency >= 50 ? 'ok' : 'weak');
      timingRows = [{ key: 'powerSeqEff', label: '파워 시퀀스 타이밍 적합도', w: ps.efficiency + '점', s: timingStatus === 'good' ? 1 : (timingStatus === 'weak' ? -1 : 0) }];
    }
    roles.push({ key: 'timing', label: '하체→상체 타이밍', status: timingStatus, rows: timingRows, note: '하체·골반·몸통·팔 파워 정점이 순차적인지(기존 피크 파워 시퀀스).' });
    if (ps && ps.efficiency != null) roles[roles.length - 1]._score = Math.max(20, Math.min(100, Math.round(ps.efficiency)));

    // ── 역할별 0-100 + 가중 종합점수(가용 역할만 가중치 재정규화) ──
    roles.forEach(function (r) { if (r._score == null) r._score = _roleScore(r); });
    var wsum = 0, acc = 0;
    roles.forEach(function (r) { var w = _ROLE_W[r.key]; if (w != null && r._score != null && r.status !== 'na') { acc += w * r._score; wsum += w; } });
    var index = wsum > 0 ? Math.round(acc / wsum) : null;

    // ── [2026-08-13 ①b] 현행 우열 종합점수(index)·우열 라벨('하체 활용 우수' 등) 차단 — #58 표현적합성·설계 v1.2 §5 ──
    //   미검증 임의 가중치 합성(0-100 index)·우열 verdict·causemap 원인 링크는 노출하지 않는다. 대신 ①a 3독립 raw J(중립·미검증)만 표시.
    //   밴드 진단(roles·per-변인 규준 밴드)은 내부 보존(참고 데이터)하되 종합 verdict·원인은 미노출. (index·label 계산은 위에서 죽은 값 — 반환 안 함)
    var _lbuEng = (DATA && DATA.phases && DATA.phases.lowerBodyUtil) || null;
    function _rawCard(seg, ttl) {
      if (!seg) return null;
      return { title: ttl, rawJ: seg.rawJ, jkg: seg.jkg, displayEligible: seg.displayEligible, reason: seg.reason, qualityStatus: seg.qualityStatus };
    }
    var lbuScores = _lbuEng ? {
      driveGen: _rawCard(_lbuEng.driveGen, '드라이브 생성'),
      blockGen: _rawCard(_lbuEng.blockGen, '블록 생성'),
      blockAbsorb: _rawCard(_lbuEng.blockAbsorb, '블록 흡수'),
      scoreVersion: _lbuEng.scoreVersion, massValid: _lbuEng.massValid
    } : null;
    var _neutralSummary = lbuScores
      ? '하체 관절이 만든/받아낸 일(J)입니다. 검증 전이라 우열 점수는 내지 않고 원시값만 표시합니다(블록 흡수는 방향 미확정).'
      : '하체 활용 원시값 산출 자료가 없습니다.';
    return {
      tier: tier, unvalidated: true,
      label: '하체 활용 (검증 전 · 원시값)', labelClass: 'na', summary: _neutralSummary,
      index: null,                    // ★차단: 우열 종합점수 미노출(#58·종합=value:null)
      lbuScores: lbuScores,           // ①a 3독립 raw J(드라이브 생성·블록 생성·블록 흡수) 중립
      roles: roles, weakLink: null, cause: null,   // 밴드 진단은 내부 보존·우열 원인 링크는 미노출
      l5s1: { available: false, note: 'L5-S1(허리-골반) 몸통 전달은 Theia에 관절 채널이 없어 측정하지 못합니다. 골반 회전으로 대체 관찰합니다(스펙의 l5s1TransferIndex 미도입).' },
      version: 'lower-body-util-v2-neutral', statusKo: _STATUS_KO
    };
  }
  function _find(arr, k) { for (var i = 0; i < arr.length; i++) if (arr[i].key === k) return arr[i]; return null; }

  // ══ 상체 전달 활용 (몸통→팔→공) — 하체와 동일 기계로 0-100 + 라벨 + 원인 ══
  //  검증 레버: humME(.53)·trunkME(.37)·trunkRotKE(.35) — 마커·마커리스 양쪽 상위. 전달형(whipRatio 등)은 참고/타이밍.
  var _UP_W = { trunkgen: 0.35, armout: 0.35, handoff: 0.30 };
  function assessUpper(DATA, X) {
    var byk = _byKey(DATA);
    var roles = [];
    roles.push(_role(byk, 'trunkgen', '몸통 에너지 (생성)', [
      { key: 'trunkME', label: '몸통 총 에너지', lever: true }, { key: 'trunkRotKE', label: '몸통 회전 KE', lever: true }, { key: 'torsoRotV', label: '몸통 회전속도' }
    ], '몸통(코어)이 회전 에너지를 만드는가 — 구속 검증 레버: trunkME·trunkRotKE.'));
    roles.push(_role(byk, 'armout', '팔 방출 (상완)', [
      { key: 'humME', label: '상완 총 에너지', lever: true }, { key: 'armRotV', label: '어깨 내회전 속도' }
    ], '몸통에서 받은 에너지가 상완으로 방출되는가 — humME는 우리 최강 구속 상관(.53).'));
    roles.push(_role(byk, 'handoff', '몸통–팔 연결(속도비·타이밍)', [
      { key: 'whipRatio', label: '채찍 가속비' }, { key: 'ppTrunkHum', label: '몸통→상완 타이밍' }, { key: 'seqPct', label: '시퀀스 정확도', ctx: true }
    ], '몸통 최고점 이후 팔로 넘기는 타이밍·증폭(채찍). 전달형이라 참고 비중.'));

    roles.forEach(function (r) { if (r._score == null) r._score = _roleScore(r); });
    var wsum = 0, acc = 0;
    roles.forEach(function (r) { var w = _UP_W[r.key]; if (w != null && r._score != null && r.status !== 'na') { acc += w * r._score; wsum += w; } });
    var index = wsum > 0 ? Math.round(acc / wsum) : null;

    var avail = roles.filter(function (r) { return r.status !== 'na'; });
    var weakRoles = avail.filter(function (r) { return r.status === 'weak'; });
    var goodRoles = avail.filter(function (r) { return r.status === 'good'; });
    var trunkR = _find(roles, 'trunkgen'), armR = _find(roles, 'armout');
    var label, labelClass;
    if (avail.length < 2 || index == null) { label = '자료 부족'; labelClass = 'na'; }
    else if (weakRoles.length === 0 && index >= 75) { label = '상체 전달 우수'; labelClass = 'good'; }
    else if (armR && armR.status !== 'weak' && armR.status !== 'na' && trunkR && trunkR.status === 'weak') { label = '팔 의존형'; labelClass = 'transfer'; }   // 팔 방출은 되나 몸통 생성 약함=팔로 만드는 유형
    else { label = '부분 활용'; labelClass = 'partial'; }

    weakRoles.sort(function (a, b) { return (b.weak || 1) - (a.weak || 1); });
    var weakLink = weakRoles.length ? weakRoles[0] : null;
    var cause = null;
    var _UCAUSE = { trunkgen: 'trunk', armout: 'armball', handoff: 'trunkarm' };
    if (weakLink && CAUSE && CAUSE.get) { var c = CAUSE.get(_UCAUSE[weakLink.key]); if (c) cause = { role: weakLink.label, message: c.message, fitness: c.fitness }; }

    var summary;
    if (label === '자료 부족') summary = '몸통·팔 에너지 자료가 부족해 상체 전달을 평가할 수 없습니다.';
    else if (label === '상체 전달 우수') summary = '몸통이 만든 에너지가 팔로 잘 전달·증폭되어 손끝으로 이어지는 패턴입니다.';
    else if (label === '팔 의존형') summary = '팔 방출은 있으나 몸통 에너지가 약해, 몸통보다 팔에 의존하는 유형으로 보입니다. 몸통 회전과 몸통–팔 연결을 먼저 확인합니다.';
    else { var st = goodRoles.length ? goodRoles[0].label + '은 양호하나 ' : ''; summary = st + (weakLink ? weakLink.label + '이(가) 약합니다.' : '일부가 약합니다.') + (cause && cause.message ? ' ' + cause.message : ''); }

    return { tier: 'full', label: label, labelClass: labelClass, summary: summary, index: index,
      roles: roles, weakLink: weakLink ? weakLink.key : null, cause: cause, version: 'upper-transfer-util-v1', statusKo: _STATUS_KO };
  }

  var api = { assess: assess, assessUpper: assessUpper };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LOWER_BODY_UTIL = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));
