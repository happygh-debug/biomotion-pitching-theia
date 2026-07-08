// mech6.js — 엘리트 6단계 메카닉 점수 단일 소스 (single source of truth)
//  와인드업·드라이브·블로킹·앞무릎·몸통·팔 6단계 점수와 변인별 상세를 한 곳에서만 계산한다.
//  규준: 고교 우수투수 20명(173 trial) 엘리트 규준. 100=엘리트 중앙값, 밴드 15/SD.
//  ⚠ 이 파일이 6단계 점수의 유일한 정의처다. report.engine.js·zip_reader.js·player_report.js 모두 여기를 호출한다.
//  로직을 바꾸면 모든 출력처(온라인 요약/세부/PDF/팀)에 동시에 반영된다 — 페이지마다 복제하지 말 것.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.mech6 = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // 단계 → 변인(phases.stages metric key) 묶음
  //  ⚠ [2026-06-02] 단계 구분 기준을 "에너지 역할(저장→생성→전달)"에서 "동작 단계(motion phase)"로 전환.
  //     선수/코치 이해도 우선 — 각 변인을 실제로 일어나는 투구 동작 단계에 배치하고, 단계 내부도 동작 시간 흐름순.
  //     이동: MER·견갑로딩→팔(코킹) / 착지 뒤젖힘·열림·FC분리상태(분리크기·FC풀림%)→스트라이드 / X-Factor 풀림→몸통(골반 고정·몸통 회전).
  var MAP = {
    // 1 와인드업(셋업~KH 이전 코일): 힙힌지 → 뒷발 꼬임 토크 → 골반 코일
    windup: ['hipHinge', 'wuPelCloseKH', 'wuPelCoil', 'wuTrunkCloseKH', 'wuTrunkCoil', 'wuHSS', 'wuHSSbuild', 'wuDriveHipER', 'wuCoilTq', 'wuPelVel', 'wuTrkVel'],   // [2026-06-03 v2] 선운동(hipHinge,+1)+회전 preload(dir=range). [2026-06-03 v3] wuShER(어깨 외회전@KH) 제거 — "KH 팔 조기 장전 위험"(phases.earlyArm)으로 재분류, 우수 점수 제외·위험 신호로만 표시(개발지침서).
    // 2 드라이브(KH→FC): [2026-06-03 재구성 v3 · 개발지침서] 3기능(전진 에너지 생성·회전 preload 전개·FC 블로킹 입력) — 점수=4모듈 핵심 5변인.
    //   A 생성: propImpPct(핵심·임펄스 중심)·rearProp / B 자세·COM: postureMaint(optimal) / D 결과: strideLen(optimal) / C 회전준비: hssBuildKF(부분 반영).
    //   FC 블로킹 입력(leadKneeFlexFC·leadFootAngleFC·hssFC)·회전 전개(pelOpenKF·trkOpenKF)·맥락(comVDrop·comVel·driveWork 등)은 참고/전환/위험으로 화면 표시(neutral·점수 제외). 해석타입=mech6.STRIDE_INTERP.
    stride: ['propImpPct', 'rearProp', 'postureMaint', 'strideLen', 'hssBuildKF', 'backHipTransfer', 'backKneeTransfer', 'trkOpenKF'],   // [2026-07-03] mech5 동기화(직접전달 + trkOpenKF 조기열림 감점 점수화).
    // 3 블로킹(FC→BR): 제동 임펄스 → COM 전진속도 제어 → 앞다리 지지 유지. kneeCollapse는 평균 변인이 아니라 조건부 risk penalty.
    //   apBrake peak는 규준 스케일 불일치로 score 제외(deprecated context), blockConvEff는 Trunk와 중복되어 bridge context.
    block:  ['apBrakeImpulse', 'comVelReductionFCBR', 'leadVGRFImpulse', 'leadKneeVelPk', 'leadHipTransfer', 'leadKneeTransfer'],  // [2026-07-03] mech5 동기화: vgrfRetain→leadVGRFImpulse/leadKneeVelPk(6-14/21 드리프트) + 직접전달.
    // 4 앞무릎 전략·전달 보조(FC→BR): [2026-06-03 K5-A] pelvisRotV 제거(릴리스 단계·중복). MAP 비움 → stage6.knee=null.
    //   kneeTransfer 점수 복귀·FC→MER 재산출·score 재구성은 후속 Task. detail6는 KNEE_CONTEXT로 참고 변인만 표시.
    knee:   [],
    // 5 몸통(FC→BR): ★저장-생성-전달 — ①저장(FC 분리·자세: 분리크기[참고]·flying open·뒤젖힘·열림) → ②생성(총ME·X-factor 풀림·회전/굴곡/측굴 속도, KE분해 참고) → ③전달(몸통→팔 전달비율·타이밍)
    //   [2026-06-02 교수 지시] FC 자세·분리(블로킹)를 몸통 '저장'으로 이동 → X-factor가 저장(크기·풀림%)→방출(풀림속도)→생성으로 한 단계에서 일관.
    trunk:  ['xfReleasedPctByFC', 'leanBack', 'openAng', 'trunkME', 'trunkME_kg', 'xfUnwindV', 'torsoRotV', 'trunkFlexV', 'trunkLatV', 'armTransferRatio', 'ppTrunkHum', 'whipRatio'],   // [2026-07-03] mech5 동기화: +trunkME_kg(6-21)·+whipRatio(6-15) 드리프트 정합.
    // 6 팔 전달·방출 [2026-06-03 A5]: band=armRotV·humME만 remap. 나머지는 ARM_CONTEXT(몸통 전달·부하·타이밍·risk).
    arm:    ['armRotV', 'humME', 'humME_kg', 'shForceTransfer', 'elForceTransfer']   // [2026-07-03] mech5 동기화: +humME_kg(6-21) + 직접전달 배선.
  };

  // 단계 순서·표시명·3축(저장/생성/효율) 카테고리 — 표시 메타도 단일 소스로 통일
  var ORDER = ['windup', 'stride', 'block', 'knee', 'trunk', 'arm'];
  var STAGE_META = {
    windup: { n: 1, name: '와인드업', cat: 'store' },
    stride: { n: 2, name: '드라이브', cat: 'gen' },
    block:  { n: 3, name: '블로킹', cat: 'transfer' },
    knee:   { n: 4, name: '앞무릎 전달', en: 'Lead Knee Transfer', cat: 'transfer' },
    trunk:  { n: 5, name: '몸통', cat: 'gen' },
    arm:    { n: 6, name: '팔 전달·방출', en: 'Arm Delivery & Release', cat: 'transfer' }
  };

  // 와인드업 저장 전략 4유형(rule-based v1.0) — 표시명/쉬운이름/색 단일 소스. 분류 계산은 phases.windupType.
  //  [2026-06-03 유형별 평가 지침서] "엘리트 평균과 다르다=나쁘다" 금지 → 전략 유형으로 먼저 해석.
  var WINDUP_TYPES = {
    high_lift:     { name: 'High Lift / Rhythm',           easy: '큰 리듬형',   color: '#5bb6e6', desc: '긴 리듬·높은 무릎으로 저장 준비' },
    compact:       { name: 'Compact / Quick',              easy: '빠른 전환형', color: '#46c98c', desc: '짧고 빠른 lift 후 스트라이드에서 생성' },
    coil_dominant: { name: 'Coil-Dominant',                easy: '회전 코일형', color: '#b98cff', desc: '골반·몸통 닫힘·축발 coil 회전 preload' },
    linear_load:   { name: 'Linear Drift / Drive-Leg Load', easy: '축발 적재형', color: '#e0a06a', desc: '힙 힌지·COM 이동·축발 적재 중심' }
  };

  // 스트라이드 전략 5유형(rule-based v1.0) — 표시명/쉬운이름/색 단일 소스. 분류 계산=phases.strideType. [2026-06-03 개발지침서]
  //  "모든 투수를 한 기준으로" 금지 → soft 분류(확률형)로 전략 먼저 해석.
  var STRIDE_TYPES = {
    long_power:    { name: 'Long Stride / Power',    easy: '긴 보폭형',   color: '#5bb6e6', desc: '긴 보폭·큰 추진 임펄스로 전진 에너지 생성(긴 가속 경로)' },
    compact_quick: { name: 'Compact / Quick',        easy: '빠른 템포형', color: '#46c98c', desc: '짧고 빠른 스트라이드로 효율·반복성(보폭 작아도 정상)' },
    low_drop:      { name: 'Low Posture / Drop',     easy: '깊은 낙하형', color: '#e0a06a', desc: 'COM 낙하·낮은 자세 유지 중심(강한 블로킹 준비)' },
    rot_ready:     { name: 'Rotational Readiness',    easy: '회전 준비형', color: '#b98cff', desc: '골반 열림·HSS 빌드업·몸통 버팀으로 회전 전달 준비' },
    linear_drift:  { name: 'Linear Drift',           easy: '미끄러짐형', color: '#d98c9d', desc: '큰 추진 없이 COM이 길게 이동(부드러운 리듬·전환 약화 주의)' }
  };
  // 스트라이드 변인 해석타입(개발지침서 TABLE 11) — 점수 방향(dir)보다 해석타입 우선. report 시각화·문구 분기.
  //  performance(클수록↑·미흡/정상/우수) / optimal(엘리트 범위 적정·dir=range·부족/범위/높음) / risk(클수록 위험) / transition(블로킹과 함께 해석).
  var STRIDE_INTERP = {
    propImpPct: 'performance', rearProp: 'performance', hssBuildKF: 'performance',
    strideLen: 'optimal', postureMaint: 'optimal', comVDrop: 'optimal', comVelFC: 'optimal', strideTime: 'optimal', propPeakTiming: 'optimal', driveKneeFlexKF: 'optimal', leadKneeFlexFC: 'optimal',
    trkOpenKF: 'risk',
    pelOpenKF: 'transition', hssFC: 'transition', leadFootAngleFC: 'transition', trunkResistRatio: 'transition'
  };
  // 스트라이드 4모듈(개발지침서 TABLE 5) — report 패널 그룹 표시. smod 키와 일치.
  // 앞무릎 단계 상세(점수 미집계) — phases SSOT·context만. score 복귀·FC→MER는 K5-B.
  var KNEE_CONTEXT = ['kneeTransfer', 'kneeTrunkLag', 'ppKneeTrunk', 'kneeExtE', 'kneeContribPct', 'kneeAbs', 'kneeAbsE', 'driveType'];
  // 몸통 참고·연구 변인 — MAP 점수 집계 제외, detail6 표시만
  var TRUNK_CONTEXT = ['xfPeak', 'trunkRotKE', 'trunkFlexKE', 'trunkLatKE'];
  var _TRUNK_CTX = {};
  TRUNK_CONTEXT.forEach(function (k) { _TRUNK_CTX[k] = 1; });
  // 팔 단계 상세(점수 미집계) — trunk SSOT 전달·부하·타이밍·코킹 맥락. score=armRotV·humME만 MAP.arm.
  var ARM_CONTEXT = [
    'armTransferRatio', 'ppTrunkHum', 'scapLoad', 'merPk', 'elbowExtV',
    'shGen', 'elbAbs', 'whipRatio', 'seqPct', 'chainTiming', 'ppShoElb'
  ];
  var _ARM_CTX = {};
  ARM_CONTEXT.forEach(function (k) { _ARM_CTX[k] = 1; });

  var STRIDE_MODULES = {
    gen:     { name: 'A. 전진 에너지 생성', desc: '얼마나 잘 밀어 전진 운동량을 만들었나' },
    posture: { name: 'B. 자세·COM 관리',    desc: '낮은 자세·힙힌지를 잃지 않고 이동했나' },
    rot:     { name: 'C. 회전 준비',        desc: '와인드업 preload가 회전 준비로 이어졌나' },
    fcinput: { name: 'D. 착지(FC) 블로킹 입력', desc: '스트라이드 결과 = 블로킹이 가능한 조건을 만들었나' }
  };

  // 상동고 sc(0-100)점수 → 엘리트 규준 점수(100=중앙값, 15/SD). 밴드 상수는 여기 한 곳에만 존재.
  function remap(s) {
    return (s == null || !isFinite(s)) ? null : Math.max(20, Math.min(100, Math.round(3 * s - 175.325)));
  }

  // 엘리트 점수 → 상태(양호/주의/누수)
  function status(es) {
    if (es == null) return 'na';
    return es >= 75 ? 'good' : (es >= 60 ? 'warn' : 'bad');
  }

  // DATA.phases.stages → 변인key별 엘리트 remap 점수 맵
  function _remappedByKey(D) {
    if (!D || !D.phases || !D.phases.stages) return null;
    var ks = {};
    D.phases.stages.forEach(function (st) {
      (st.metrics || []).forEach(function (m) {
        if (m.key && m.score != null && !m.neutral) ks[m.key] = remap(m.score);
      });
    });
    return ks;
  }

  function _metricByKey(D, key) {
    if (!D || !D.phases || !D.phases.stages) return null;
    for (var i = 0; i < D.phases.stages.length; i++) {
      var ms = D.phases.stages[i].metrics || [];
      for (var j = 0; j < ms.length; j++) if (ms[j] && ms[j].key === key) return ms[j];
    }
    return null;
  }

  // 6단계 점수: {windup,stride,block,knee,trunk,arm} (없으면 null)
  function stage6(D) {
    var ks = _remappedByKey(D);
    if (!ks) return null;
    var out = {}, any = false;
    for (var s in MAP) {
      var v = MAP[s].map(function (k) { return ks[k]; }).filter(function (x) { return x != null; });
      out[s] = v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
      if (s === 'block' && out[s] != null) {
        var pen = _metricByKey(D, 'blockRiskPenalty');
        var pv = pen && pen.value != null && isFinite(pen.value) ? pen.value : 0;
        out[s] = Math.max(20, Math.min(100, out[s] - pv));
      }
      if (out[s] != null) any = true;
    }
    return any ? out : null;
  }

  // 단계별 변인 상세: {windup:[{label,val,score,status}], ...}
  function detail6(D) {
    if (!D || !D.phases || !D.phases.stages) return null;
    var byk = {};
    D.phases.stages.forEach(function (st) {
      (st.metrics || []).forEach(function (m) { if (m.key) byk[m.key] = m; });
    });
    var out = {};
    for (var sk in MAP) {
      var keys = MAP[sk].length ? MAP[sk].slice() : (sk === 'knee' ? KNEE_CONTEXT : []);
      if (sk === 'arm') keys = MAP.arm.concat(ARM_CONTEXT);
      else if (sk === 'trunk') keys = MAP.trunk.concat(TRUNK_CONTEXT);
      out[sk] = keys.map(function (k) {
        var m = byk[k];
        if (!m) return null;
        var ctxOnly = (sk === 'arm' && _ARM_CTX[k]) || (sk === 'trunk' && _TRUNK_CTX[k]);
        if (m.neutral || ctxOnly) {
          if (m.value == null || !isFinite(m.value)) return null;
          var row = { label: m.label, val: (m.value) + (m.unit || ''), score: null, status: 'neutral', key: k, value: m.value, dir: m.dir, unit: m.unit, neutral: true };
          if (ctxOnly && _G && _G.PITCH_NORMS) {
            var nm = _G.PITCH_NORMS[k];
            if (nm) {
              var bb = band(m.value, nm, m.dir, k);
              if (bb) { row.bandLabel = bb; row.bandWord = bandWord(m.value, nm, m.dir); }
            }
          }
          return row;
        }
        if (m.score == null) return null;
        var es = remap(m.score);
        if (es == null) return null;
        return { label: m.label, val: (m.value == null ? '–' : m.value) + (m.unit || ''), score: es, status: status(es), key: k, value: m.value, dir: m.dir, unit: m.unit };
      }).filter(function (x) { return x; });
    }
    return out;
  }

  // ── 엘리트 코호트 백분위 밴드 (점수제 대체) ──
  // 미흡 <p25(나쁜쪽) / 정상 p25~p75 / 우수 ≥p75(좋은쪽). 방향(dir)은 SSOT가 자동 반영.
  // 분류는 PITCH_STATS.stat(SSOT, 게이지·밴드SVG와 동일)에 위임 → 임계값 중복·드리프트 차단.
  // 프로·개인 선수 확장 시 규준 코호트(PITCH_NORMS)만 교체하면 그대로 적용.
  // dir==='range': "엘리트 범위 적합" — 클수록 좋음이 아니라 p25~p75 안이 정상, 벗어나면 부족/높음. 카운트는 부족=미흡, 그 외=정상.
  function band(value, nm, dir) {
    if (value == null || !isFinite(value) || !nm || nm.p25 == null || nm.p75 == null) return null;
    if (dir === 'range') { var rlo = Math.min(nm.p25, nm.p75); return value < rlo ? '미흡' : '정상'; }
    var S = _G && _G.PITCH_STATS;
    if (S && S.stat) {
      var st = S.stat(value, nm, dir).status;   // strong / normal / flag
      return st === 'strong' ? '우수' : (st === 'flag' ? '미흡' : '정상');
    }
    var lo = Math.min(nm.p25, nm.p75), hi = Math.max(nm.p25, nm.p75);  // SSOT 미로드 시 폴백
    if (dir < 0) { if (value < lo) return '우수'; if (value <= hi) return '정상'; return '미흡'; }
    if (value > hi) return '우수'; if (value >= lo) return '정상'; return '미흡';
  }
  // 표시 라벨 — range는 부족/엘리트 범위/높음, 그 외는 미흡/정상/우수.
  function bandWord(value, nm, dir) {
    if (value == null || !isFinite(value) || !nm || nm.p25 == null || nm.p75 == null) return null;
    if (dir === 'range') { var lo = Math.min(nm.p25, nm.p75), hi = Math.max(nm.p25, nm.p75); return value < lo ? '부족' : (value <= hi ? '엘리트 범위' : '높음'); }
    return band(value, nm, dir);
  }
  // 색·글리프는 게이지(strong=green▲ / normal=cyan● / flag=amber▼)와 동일하게.
  var _BAND_META = {
    '우수': { label: '우수', color: 'var(--green)', dot: '▲' },
    '정상': { label: '정상', color: 'var(--cyan)', dot: '●' },
    '미흡': { label: '미흡', color: 'var(--amber)', dot: '▼' },
    '엘리트 범위': { label: '엘리트 범위', color: 'var(--green)', dot: '●' },
    '부족': { label: '부족', color: 'var(--amber)', dot: '▼' },
    '높음': { label: '높음', color: '#b98cff', dot: '▲' }
  };
  function bandMeta(b) { return _BAND_META[b] || { label: '참고', color: '#8a96a6', dot: '○' }; }
  // 단계 상세배열 → {우수,정상,미흡} 개수 (참고/neutral 제외)
  //  [2026-06-03 유형별 평가 지침서] dir==='range'(엘리트 범위 적합) 변인은 유형 의존 → '부족'을 단독 감점(미흡)으로 세지 않음.
  //  부족=유형 차이(예: compact형의 낮은 무릎/닫힘)일 뿐 결함 아님. 위험은 별도 공통 위험 신호로 경고. 범위/높음만 정상 카운트.
  function bandCounts(arr, norms) {
    var c = { 우수: 0, 정상: 0, 미흡: 0 };
    (arr || []).forEach(function (x) {
      if (!x || x.neutral) return;
      var nm = norms && norms[x.key];
      if (x.dir === 'range') {  // 유형 의존 변인: 부족은 미카운트(neutral), 범위/높음은 정상
        var b = band(x.value, nm, x.dir);
        if (b === '정상') c.정상++;
        return;
      }
      var bb = band(x.value, nm, x.dir, x.key);
      if (bb && c[bb] != null) c[bb]++;
    });
    return c;
  }

  // 종합 메카닉 점수 = 6단계 평균 (stage6 객체 또는 DATA 둘 다 허용)
  function composite(arg) {
    var st = (arg && arg.windup !== undefined) ? arg : stage6(arg);
    if (!st) return null;
    var v = ORDER.map(function (k) { return st[k]; }).filter(function (x) { return x != null; });
    return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
  }

  // ── 공유 라벨/태그(선수가 이해하기 쉬운 변인명 + 구속/전달/제구/부상 태그) — 온라인·선수용·팀 리포트 공용 ──
  var _VAR_TAG={
    humME:['velo2','transfer'], armRotV:['velo2'], kneeCollapse:['velo2'], blockConvEff:['velo2','transfer'], comVDrop:['velo2'], trunkLatKE:['velo2','transfer'], elbowExtV:['velo2'], kneeExtROM:['velo2'],
    rearProp:['velo1'], torsoRotV:['velo1','transfer'], merPk:['velo1'], strideLen:['velo1'], propImpPct:['velo1'], scapLoad:['velo1'], comKEdrop:['transfer'], leadGrf:['velo1'], hipAbd:['velo1'], rotKEgain:['transfer'], linRotRatio:['transfer'],
    seqPct:['transfer'], whipRatio:['transfer'], chainTiming:['transfer'], armTransferRatio:['transfer','injury'], trunkME:['transfer'], shGen:['transfer'], trunkRotKE:['transfer'], trunkFlexKE:['transfer'], ppKneeTrunk:['transfer'], ppTrunkHum:['transfer'], ppShoElb:['transfer'],
    openAng:['command'], leanBack:['command'], xfReleasedPctByFC:['command'], pelClose:['command'],
    shoulderMoment:['injury'], shoulderForce:['injury'], elbowMoment:['injury'], elbowForce:['injury'], elbAbs:['injury','velo1'], kneeAbsE:['injury']
  };
  var _VAR_TAG_M={velo2:['구속↑↑','#f0883e'],velo1:['구속↑','#e0a06a'],transfer:['전달','#46c98c'],command:['제구','#5bb6e6'],injury:['부상','#e0726f']};
  var _EZ_LABEL={
    '힙 힌지 (뒷고관절 굴곡)':'힙힌지','골반 닫힘각 (코일)':'골반 감기(닫힘)','뒷발 지면반력 꼬임 토크':'뒷발 비트는 힘',
    '어깨 MER (최대 외회전)':'어깨 최대 젖힘(뒤로)','견갑골 로딩 (프록시)':'날개뼈 모으기',
    'FC 몸통 뒤젖힘각':'착지 때 몸통 뒤로 젖힘','FC 몸통 열림 각도':'착지 때 몸통 열림',
    '뒷발 추진 임펄스':'뒷발 미는 힘 누적','뒷발 추진 최대힘':'뒷발 미는 힘(최대)','뒷다리 고관절 내전 속도':'뒷다리 모으는 속도',
    '뒷다리 신전 일 (드라이브)':'뒷다리 펴는 힘(에너지)','COM 수직 낙하 (KH→FC)':'무게중심 내려가기','COM 운동에너지 감소량 (블록)':'무게중심 전진 에너지 감소',
    '무게중심 전진 속도 (피크)':'무게중심 전진 속도','스트라이드 시간 (양발 GRF peak 간격)':'스트라이드 시간(양발 지면반력 간격)','제동 가속도 (피크)':'멈추는 가속도',
    '앞발 수직 GRF (피크)':'앞발 수직 지면반력','앞발 AP 제동력 (피크)':'앞발 멈추는 힘',
    '앞무릎 신전 (FC→릴리스)':'앞무릎 펴기(착지~릴리스)','앞무릎 버팀 모멘트 (FC→BR)':'앞무릎 버티는 힘','앞무릎 흡수 에너지 (FC→BR)':'앞무릎 충격 흡수',
    '앞무릎 굴곡 붕괴량 (FC→BR)':'앞무릎 굽힘(무너짐)','앞무릎 각속도 peak (블로킹)':'앞무릎 도는 속도','앞무릎 모멘트 (결과)':'앞무릎 관절 회전 힘',
    '앞고관절 모멘트 (결과)':'앞쪽 엉덩이 관절 회전 힘','뒷고관절 모멘트 (결과)':'뒤쪽 엉덩이 관절 회전 힘','앞무릎 관절력':'앞무릎 관절 누르는 힘',
    '앞고관절 일 (FC→BR)':'앞쪽 엉덩이 펴는 힘(에너지)','뒷고관절 일 (KH→FC)':'뒤쪽 엉덩이 미는 힘(에너지)',
    '몸통 굴곡 속도':'몸통 앞으로 굽히는 속도','몸통 측굴 속도':'몸통 옆으로 기울이는 속도',
    '몸통 ME 피크':'몸통 부위 에너지','상완 ME 피크':'윗팔 부위 에너지','전신 회전 KE 피크 (골반+몸통)':'몸 전체 회전 에너지',
    '팔꿈치 신전 속도':'팔꿈치 펴는 속도','어깨 에너지 생성':'어깨가 만든 에너지','팔꿈치 에너지 흡수':'팔꿈치 충격 흡수',
    '어깨 관절 모멘트 (결과)':'어깨 관절 회전 힘','팔꿈치 관절 모멘트 (결과)':'팔꿈치 관절 회전 힘','어깨 분리력 (distraction)':'어깨 당겨지는 힘','어깨 관절 모멘트':'어깨 관절 회전 힘',
    '운동사슬 타이밍':'힘 전달 타이밍','채찍 가속 (팔/몸통)':'채찍 효과(팔/몸통)','시퀀스 정확도':'순서 정확도','몸통→팔 전달비율':'몸통→팔 전달 비율',
    '무릎 신전 에너지':'무릎 펴는 에너지','무릎 신전 기여 비율':'무릎 펴기 기여 비율','무릎 신전–몸통 회전 타이밍 지연':'무릎 펴기–몸통 돌기 타이밍 차',
    '무릎→몸통 파워 타이밍':'무릎→몸통 힘 타이밍','몸통→상완 파워 타이밍':'몸통→윗팔 힘 타이밍','어깨→팔꿈치 파워 타이밍':'어깨→팔꿈치 힘 타이밍',
    '앞무릎 활용 유형':'앞무릎 쓰는 방식','몸통 돌리기 에너지':'몸통 돌리기(참고)','몸통 앞으로 덮기 에너지':'몸통 덮기(참고)','몸통 옆 기울이기 에너지':'몸통 옆 기울이기(참고)'
  };
  function _ezLabel(s){ if(s==null)return s; return _EZ_LABEL.hasOwnProperty(s)?_EZ_LABEL[s]:s; }
  function _varTagsHTML(key){ var T=key&&_VAR_TAG[key]; if(!T||!T.length)return ''; return ' '+T.map(function(t){ var m=_VAR_TAG_M[t]; return m?'<span title="구속 상관/역할 태그" style="display:inline-block;font-size:9px;font-weight:700;line-height:1.5;padding:0 5px;margin-left:2px;border-radius:8px;background:'+m[1]+'22;color:'+m[1]+';border:1px solid '+m[1]+'55;vertical-align:middle;white-space:nowrap">'+m[0]+'</span>':''; }).join(''); }
  function _varTagLegend(){ return '<span style="font-size:10px;color:#8a96a6"> · 태그: <b style="color:#f0883e">구속↑↑/↑</b>=구속 상관(34명 검증) · <b style="color:#46c98c">전달</b>=에너지전달 · <b style="color:#5bb6e6">제구</b>=방향/조기열림 · <b style="color:#e0726f">부상</b>=관절 부담</span>'; }
  var _G=(typeof self!=='undefined')?self:(typeof globalThis!=='undefined'?globalThis:(typeof window!=='undefined'?window:this));
  if(_G){ _G._ezLabel=_ezLabel; _G._varTagsHTML=_varTagsHTML; _G._varTagLegend=_varTagLegend; _G._EZ_LABEL=_EZ_LABEL; _G._VAR_TAG=_VAR_TAG; _G._VAR_TAG_M=_VAR_TAG_M; }

  return {
    MAP: MAP,
    KNEE_CONTEXT: KNEE_CONTEXT,
    TRUNK_CONTEXT: TRUNK_CONTEXT,
    ARM_CONTEXT: ARM_CONTEXT,
    ORDER: ORDER,
    STAGE_META: STAGE_META,
    WINDUP_TYPES: WINDUP_TYPES,
    STRIDE_TYPES: STRIDE_TYPES,
    STRIDE_INTERP: STRIDE_INTERP,
    STRIDE_MODULES: STRIDE_MODULES,
    remap: remap,
    status: status,
    stage6: stage6,
    detail6: detail6,
    composite: composite,
    band: band,
    bandWord: bandWord,
    bandMeta: bandMeta,
    bandCounts: bandCounts,
    ezLabel: _ezLabel,
    varTagsHTML: _varTagsHTML,
    varTagLegend: _varTagLegend
  };
});
