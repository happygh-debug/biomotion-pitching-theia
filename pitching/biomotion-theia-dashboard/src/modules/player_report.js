// player_report.js — 선수용 리포트 (web-port DATA → 라이트테마 HTML, 화면=인쇄 PDF 동일)
//  v2: 메카닉을 '투구 사슬' 심층 분석(드라이브→착지→자세→회전·가속→에너지전달→팔동작)으로 강화(~4p).
//  단일출처=web-port DATA. build_player_report.py 디자인 계승 + 메카닉 분절 분석 추가.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.playerReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function _f(v, d) { d = (d == null ? 1 : d);
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '—';
    return (typeof v === 'number') ? v.toFixed(d) : String(v); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var KMH = 1.609;
  var MET_KO = {
    layback:'어깨 최대 외회전(MER)', elbow_ext_velo:'팔꿈치 신전 속도', shoulder_abd_fp:'FC 시 어깨 외전',
    scap_load_fp:'FC 시 견갑골 후인(스캡 로딩)', shoulder_rot_velo:'어깨 내회전 속도', elbow_flex_fp:'FC 시 팔꿈치 굴곡',
    hip_shoulder_sep_peak:'최대 X-factor(골반–몸통 분리각)', hip_shoulder_sep_fp:'FC 시 X-factor',
    torso_counter_rot:'몸통 역회전(코일)', torso_fwd_tilt_fp:'FC 시 몸통 전방 기울기', torso_rot_fp:'FC 시 몸통 회전',
    torso_side_bend_mer:'MER 시 몸통 측굴', torso_rot_br:'BR 시 몸통 회전',
    torso_rot_velo:'몸통 회전속도', pelvis_rot_velo:'골반 회전속도',
    lead_force_pct:'앞발 지면반력(블로킹)', lead_knee_ext:'앞무릎 신전', stride_length:'스트라이드 길이',
    cog_decel_ae:'COM 감속(기대 대비)', lead_knee_ext_velo:'앞무릎 신전 속도',
    rear_force_pct:'뒷발 지면반력(추진)', cog_decel:'COM 감속', max_cog_velo:'COM 최대 전진 속도' };
  var METRIC_DRILL = {
    layback:'월 익스터널 로테이션 + 슬리퍼 스트레치로 어깨 외회전 가동범위 확보 → 리버스 스로우로 패턴 학습',
    elbow_ext_velo:'리버스 스로우 + 가벼운 플라이오 볼 던지기로 팔 채찍 가속',
    shoulder_abd_fp:'타올 드릴 — 착지 순간 던지는 팔 어깨가 약 90° 되도록 슬롯 점검(거울/영상)',
    scap_load_fp:'밴드 로우·견갑 리트랙션, "W 자세" 드릴로 착지 때 견갑(어깨뼈) 모으기',
    shoulder_rot_velo:'커넥션 볼(겨드랑이에 공) + 리버스 스로우로 팔-몸통 연결·내회전 가속',
    elbow_flex_fp:'착지 때 팔꿈치 약 90° 유지 — 타올 드릴 영상으로 팔꿈치 각 점검',
    hip_shoulder_sep_peak:'허샤이저 드릴 — 골반은 닫고 몸통은 버티며 분리를 만들고, 착지까지 유지하기',
    hip_shoulder_sep_fp:'스텝 비하인드 — 착지 시점까지 분리를 유지하도록 뒷다리에 한 박자 더',
    torso_counter_rot:'스텝 비하인드 — 뒷다리 위에서 골반-어깨를 반대로 감아 꼬임 만들기',
    torso_fwd_tilt_fp:'착지 때 상체를 살짝 홈 방향으로 — 메디신볼 다운워드 슬램으로 전방 기울기 학습',
    torso_rot_fp:'클로즈드 스탠스 셰도우 피칭 — 착지 때 몸통이 너무 일찍 열리지 않게',
    torso_side_bend_mer:'메디신볼 측면 토스 + 글러브팔 당기기로 MER 시 몸통 측면 기울기 학습',
    torso_rot_br:'풀-스루 셰도우 — 릴리스까지 몸통 회전을 끝까지 마무리',
    torso_rot_velo:'메디신볼 사이드 토스(발→골반→몸통→팔 순서) + 밴드 회전 가속으로 몸통 회전 파워 향상',
    pelvis_rot_velo:'골반 회전 스텝 드릴 + 메디신볼 회전 던지기로 골반 회전 속도 향상',
    lead_force_pct:'앞다리 브레이스 — 편측 깊은 런지 5초 홀드(등척성) + 박스 드롭 후 앞다리로 멈춰 버티기',
    lead_knee_ext:'편측 스쿼트 + 앞다리 brace로 착지 후 앞무릎이 무너지지 않고 펴지도록',
    stride_length:'고관절 가동성(런지·90/90 스트레치) + 점진적 보폭 셰도우로 스트라이드 확장',
    cog_decel_ae:'슬라이드 스텝 — 앞발 착지 때 빠르게 멈춰 제동(감속) 학습',
    lead_knee_ext_velo:'박스 드롭 후 앞다리로 빠르게 펴 멈추기(reactive) + 점프 후 착지 stick',
    rear_force_pct:'워킹 와인드업 + 뒷다리 push 강조 스텝으로 뒷발 추진력 향상',
    cog_decel:'슬라이드 스텝 — 체중을 앞으로 보낸 뒤 앞다리로 강하게 멈추기',
    max_cog_velo:'뒷다리 드라이브 강조 스텝 + 슬라이드 스텝으로 체중을 더 빠르게 앞으로'
  };
  var PHASE_DRILL = {
    merPk: METRIC_DRILL.layback,
    xfPeak: METRIC_DRILL.hip_shoulder_sep_peak,
    comVel: METRIC_DRILL.max_cog_velo,
    rearProp: METRIC_DRILL.rear_force_pct,
    leadGrf: METRIC_DRILL.lead_force_pct,
    trunkFlexV: '메디신볼 다운워드 슬램 + 몸통 굴곡 셰도우로 릴리스 시 상체를 홈 방향으로 빠르게 굽히기',
    torsoRotV: METRIC_DRILL.torso_rot_velo,
    armRotV: METRIC_DRILL.shoulder_rot_velo,
    shGen: '커넥션 볼(겨드랑이에 공) + 리버스 스로우로 어깨 가속(에너지 생성) 강화',
    elbAbs: '가벼운 플라이오볼 캐치&스톱(감속 드릴)으로 팔꿈치 감속(에너지 흡수) 학습',
    kneeExtE: METRIC_DRILL.lead_knee_ext,
    pelClose: '스텝 비하인드 + 셋업에서 골반 꼬임(닫힘) 강조로 회전 부하 적재',
    comDecel: METRIC_DRILL.cog_decel,
    vgrfRetain: '앞다리에 체중을 전부 싣고 릴리스까지 버티는 편측 런지 홀드 — 바닥 미는 힘을 끝까지 유지하기(조기 감소 교정)',
    blockConvEff: '앞다리 제동 직후 골반→몸통 회전이 바로 이어지도록 안티로테이션 홀드 후 폭발적 회전 — 받아 멈춘 뒤 몸통·팔 넘기기',
    armTransferRatio: '커넥션 볼(겨드랑이 공) + 몸통 주도 리버스 스로우 — 팔 힘 대신 몸통→팔 연결을 키워 같은 구속을 더 낮은 팔 부담으로',
    trunkRotKE: '발→골반→몸통 순서로 메디신볼 측면 회전 던지기 — 몸통 돌리기 에너지(축회전)를 키우기',
    trunkFlexKE: '메디신볼 다운워드 슬램 + 릴리스에서 갈비뼈를 홈으로 덮는 셰도우 — 앞으로 덮기 에너지 강화',
    trunkLatKE: '글러브측으로 기울이며 던지는 측면 틸트 셰도우 — 옆 기울이기로 팔 높이·릴리스 포인트 확보'
  };
  var HP_TRAIN = {
    strength:'최대 힘 — 풀 스쿼트 홀드·한 발 스플릿 스쿼트(가방 메고)·글루트 브리지 홀드. 천천히 무겁게, 주 3회 5×5.',
    rel_strength:'체중 대비 힘 — 푸시업·풀업(또는 밴드)·플랭크·한 발 스쿼트로 맨몸 근력 향상. 주 3~4회.',
    power:'점프 파워 — 스쿼트 점프·박스 점프·메디신볼 슬램. 최대한 빠르고 높게, 3~5회×4세트(충분히 쉬며).',
    rel_power:'체중 대비 파워 — 카운터무브먼트 점프(팔 휘둘러 최고 높이)·broad jump. 질 위주, 완전 회복 후 반복.',
    reactive:'반응성(짧은 접지로 튕기기) — 라인 양발 홉·포고 점프·낮은 박스 뎁스점프. 땅에 "톡" 짧게 닿아 빠르게 튀기. 주 2회, 푹신한 곳부터.',
    upper_strength:'악력/악력 — 악력기 반복·데드행(철봉 매달리기)·파머스 캐리(무거운 것 들고 걷기)·손가락 푸시업. 주 3회.'
  };
  // 투구 사슬 분절 정의 (시간 순). model = biomotion 모델 키, 또는 _energy(키네매틱 시퀀스).
  var PHASES = [
    { model:'cog',        num:1, title:'드라이브 (체중이동)', accent:'#1f9d8f',
      what:'뒷다리로 마운드를 밀어 몸을 홈 방향으로 보내는 단계입니다. 여기서 만든 전진 운동량이 이후 모든 회전·가속의 연료가 됩니다.',
      cue:'걸으며 와인드업 → 던지기 흐름으로 뒷다리 추진을 키우기' },
    { model:'block',      num:2, title:'착지 · 앞다리 제동', accent:'#e8731a',
      what:'앞발이 닿은 뒤 앞다리가 단단히 버텨, 전진하던 몸을 멈추고 회전축을 세우는 단계입니다. 제동이 강할수록 그 위에서 몸통이 더 빠르게 돕니다.',
      cue:'앞다리에 체중을 전부 싣고 5초 버티기(편측 런지 홀드)' },
    { model:'posture',    num:3, title:'자세 · 분리 (몸통 꼬임)', accent:'#7048e8',
      what:'착지~릴리스 구간에서 골반과 상체를 따로 움직여(분리) 고무줄처럼 에너지를 모으고, 몸통 기울기를 유지하는 능력입니다.',
      cue:'골반은 닫은 채 어깨만 더 여는 느낌으로 분리 키우기(허샤이저 드릴)' },
    { model:'rotation',   num:4, title:'회전과 가속', accent:'#1f6feb',
      what:'골반에서 시작한 회전이 몸통으로 이어지며 채찍의 손잡이를 휘두르는 단계입니다. 몸통 회전속도는 구속과 가장 직접적으로 연결됩니다.',
      cue:'발→골반→몸통→팔 순서로 메드볼을 측면으로 폭발적으로 던지기' },
    { model:'_energy',    num:5, title:'에너지 전달 (분절 ME 흐름 · 시퀀스)', accent:'#2f9e44',
      what:'하지에서 만든 에너지가 골반 → 몸통 → 팔로 올바른 순서·타이밍에 손실 없이 전달돼야 구속이 됩니다. 분절 역학에너지(ME) 흐름과 시퀀스로 전달 효율을 봅니다. (회전속도 자체는 회전과 가속 섹션에서 평가)',
      cue:'회전을 골반부터 시작해, 팔이 가장 늦게 그러나 가장 빠르게 나오도록' },
    { model:'arm_action', num:6, title:'팔동작 (릴리스)', accent:'#c0612b',
      what:'몸통이 만든 속도를 팔이 받아, 어깨 외회전(레이백)에서 내회전으로 빠르게 풀며 공에 전달하는 마지막 단계입니다.',
      cue:'몸통 회전보다 팔이 먼저 뒤로 끝까지 젖혀지도록(리버스 스로우)' }
  ];

  function radarSVG(axes, cap, rings, selfColor, targetKey, targetColor, sz) {
    targetColor = targetColor || '#1f6feb'; sz = sz || 300;
    var n = Math.max(5, axes.length), R = sz*0.34, cx = sz/2, cy = sz/2 + sz*0.02;
    function ang(i){ return -Math.PI/2 + 2*Math.PI*i/n; }
    function pt(i, val){ var r = Math.max(0, Math.min(cap, val||0))/cap*R; return [cx + r*Math.cos(ang(i)), cy + r*Math.sin(ang(i))]; }
    var s = ['<svg viewBox="0 0 '+sz+' '+(sz+34)+'" width="100%" style="max-width:'+sz+'px">'];
    var hiRing = rings.indexOf(100)>=0 ? 100 : rings[Math.floor(rings.length/2)];
    rings.forEach(function(lv){ var pts=[]; for(var i=0;i<n;i++){var p=pt(i,lv);pts.push(p[0].toFixed(1)+','+p[1].toFixed(1));}
      var hi=(lv===hiRing); s.push('<polygon points="'+pts.join(' ')+'" fill="none" stroke="'+(hi?'#9aa7b8':'#d7dee8')+'" stroke-width="'+(hi?1.3:1)+'"'+(hi?'':' stroke-dasharray="2 3"')+'/>'); });
    for(var i=0;i<n;i++){ var e=pt(i,cap); s.push('<line x1="'+cx.toFixed(1)+'" y1="'+cy.toFixed(1)+'" x2="'+e[0].toFixed(1)+'" y2="'+e[1].toFixed(1)+'" stroke="#d7dee8"/>'); }
    if(targetKey){ var tp=[]; axes.forEach(function(a,i){var p=pt(i,a[targetKey]||0);tp.push(p[0].toFixed(1)+','+p[1].toFixed(1));}); s.push('<polygon points="'+tp.join(' ')+'" fill="none" stroke="'+targetColor+'" stroke-width="1.6" stroke-dasharray="6 4"/>'); }
    var mp=[]; axes.forEach(function(a,i){ if(a.score==null) return; var p=pt(i,a.score); mp.push(p[0].toFixed(1)+','+p[1].toFixed(1)); });
    s.push('<polygon points="'+mp.join(' ')+'" fill="'+selfColor+'33" stroke="'+selfColor+'" stroke-width="2.4"/>');
    axes.forEach(function(a,i){ if(a.score==null) return; var p=pt(i,a.score); s.push('<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.6" fill="'+selfColor+'"/>'); });
    axes.forEach(function(a,i){ var p=pt(i,cap*1.17); var anchor=Math.abs(p[0]-cx)<6?'middle':(p[0]>cx?'start':'end');
      s.push('<text x="'+p[0].toFixed(1)+'" y="'+p[1].toFixed(1)+'" text-anchor="'+anchor+'" font-size="11" font-weight="700" fill="#1b2330">'+a.label+'</text>');
      s.push('<text x="'+p[0].toFixed(1)+'" y="'+(p[1]+13).toFixed(1)+'" text-anchor="'+anchor+'" font-size="10" fill="#6b7787">'+_f(a.score,0)+'점</text>'); });
    s.push('</svg>'); return s.join('');
  }
  function bar(label, val, lo, hi, unit, color) {
    if(val==null) return '<div class="bar-row"><span class="bar-lbl">'+label+'</span><div class="bar-na">— 측정값 없음 —</div></div>';
    // 적응형 도메인 — 목표밴드(파랑)와 선수 값을 항상 포함. 세로 바 = 선수 본인 값 위치(범위 밖이면 밴드 좌/우로).
    var span = (hi-lo)||1;
    var domLo = Math.min(lo - span*0.45, val - span*0.30), domHi = Math.max(hi + span*0.45, val + span*0.30);
    var rng = (domHi-domLo)||1;
    var pct = Math.max(2, Math.min(98, (val-domLo)/rng*100));
    var zL = Math.max(0,(lo-domLo)/rng*100), zR = Math.max(0,(domHi-hi)/rng*100);
    var status = val<lo?'낮음':(val>hi?'높음':'적정');
    return '<div class="bar-row"><span class="bar-lbl">'+label+'</span><div class="bar"><div class="bar-track"><div class="bar-zone" style="left:'+zL.toFixed(0)+'%;right:'+zR.toFixed(0)+'%"></div>'
      +'<div class="bar-mark" style="left:'+pct.toFixed(0)+'%;background:'+color+'"></div></div>'
      +'<div class="bar-ax" style="justify-content:center"><span class="mid">목표 '+lo+'~'+hi+unit+'</span></div></div>'
      +'<b class="bar-val" style="color:'+color+'">'+_f(val,0)+'<u>'+unit+'</u> · '+status+'</b></div>';
  }
  // 구속영향(mph) → km/h 칩 (음수=손해/잠재, 양수=강점)
  function impChip(mph){ if(mph==null||!isFinite(mph)) return '<span class="imp imp-0">—</span>';
    var k=mph*KMH; if(k<=-0.3) return '<span class="imp imp-lo">−'+_f(Math.abs(k))+' km/h</span>';
    if(k>=0.3) return '<span class="imp imp-hi">+'+_f(k)+' km/h</span>'; return '<span class="imp imp-0">±0</span>'; }

  function metricsTable(model){
    var ms=(model.metrics||[]).filter(function(m){return m.value!=null&&m.score!=null;}).slice()
      .sort(function(a,b){return (a.mph_contrib==null?0:a.mph_contrib)-(b.mph_contrib==null?0:b.mph_contrib);});
    var rows=ms.map(function(mt){ var nm=MET_KO[mt.key]||((typeof _ezLabel==='function')?_ezLabel(mt.label):mt.label);
      var scol=mt.score>=95?'#2f9e44':(mt.score>=90?'#41506a':'#c0612b');
      return '<tr><td class="evl">'+nm+'</td><td>'+_f(mt.value)+(mt.unit||'')+'</td><td style="color:#1f6feb">'+_f(mt.median_elite)+(mt.unit||'')
        +'</td><td><b style="color:'+scol+'">'+mt.score+'</b></td><td>'+impChip(mt.mph_contrib)+'</td></tr>'; }).join('');
    return '<table class="ev-table"><thead><tr><th class="evl">핵심 변인</th><th>현재</th><th>엘리트</th><th>점수</th><th>구속 영향</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function diagnose(model){
    var ms=(model.metrics||[]).filter(function(m){return m.mph_contrib!=null&&m.value!=null;});
    if(!ms.length) return '측정 변인이 부족해 진단을 생략합니다.';
    var worst=ms.slice().sort(function(a,b){return a.mph_contrib-b.mph_contrib;})[0];
    var best=ms.slice().sort(function(a,b){return b.mph_contrib-a.mph_contrib;})[0];
    var imp=model.mph_contribution!=null?model.mph_contribution*KMH:null;
    var L=[];
    if(imp!=null&&imp<=-0.3) L.push('이 영역은 엘리트 대비 약 <b>'+_f(Math.abs(imp))+' km/h</b> 손해로, 구속을 더 끌어올릴 여지가 큰 구간입니다.');
    else if(imp!=null&&imp>=0.3) L.push('이 영역은 엘리트 이상으로 잘 수행하고 있는 <b>강점</b>입니다.');
    else L.push('이 영역은 엘리트 평균 수준입니다.');
    if(worst&&worst.mph_contrib<=-0.5){ var nw=MET_KO[worst.key]||worst.label;
      L.push('특히 <b>'+nw+'</b>가 현재 '+_f(worst.value)+(worst.unit||'')+'로 엘리트('+_f(worst.median_elite)+(worst.unit||'')+') 대비 낮아 약 <b style="color:#c0612b">+'+_f(Math.abs(worst.mph_contrib*KMH))+' km/h</b> 잠재가 있습니다.'); }
    if(best&&best.mph_contrib>=0.6){ var nb=MET_KO[best.key]||best.label; L.push('<b>'+nb+'</b>는 엘리트 이상으로 이미 좋습니다.'); }
    return L.join(' ');
  }
  function energyBlock(et, ss){
    var info=(et&&et.info)||{};
    var seqPct=ss.sequence_pct_correct;
    var armT=info.arm_transfer_pct, meAmp=info.me_amp_trunk_over_pelvis;
    var ptL=info.lag_pelvis_trunk_ms, taL=info.lag_trunk_arm_ms;
    var pJ=info.me_peak_pelvis_J, tJ=info.me_peak_trunk_J, hJ=info.me_peak_humerus_J;
    // (회전속도 막대 제거 — 회전속도는 '회전과 가속' 섹션에서 Theia best-trial 기준으로만 평가. 중복·집계불일치 방지)
    var mtable = (et&&et.metrics) ? '<div class="diag" style="background:#eef5ff;margin-bottom:8px"><b>에너지 전달 종합 '+(et.score!=null?et.score:'—')+'점</b> — 분절 역학에너지(ME) 흐름·시퀀스·전달 타이밍을 종합한 운동사슬 효율 점수입니다. (회전속도 자체는 \u2018회전과 가속\u2019에서 별도 평가하므로 여기서는 중복 제외)</div>'+'<table class="ev-table" style="margin-bottom:8px"><thead><tr><th class="evl">에너지 지표</th><th>측정</th><th>점수</th></tr></thead><tbody>'+et.metrics.map(function(m){var scol=m.score>=95?'#2f9e44':(m.score>=90?'#41506a':'#c0612b');return '<tr><td class="evl">'+m.label+(m.note?'<div style="font-size:11px;color:#7a8aa0;font-weight:400;margin-top:1px">'+m.note+'</div>':'')+'</td><td>'+_f(m.value)+(m.unit||'')+'</td><td><b style="color:'+scol+'">'+(m.score!=null?m.score:'—')+'</b></td></tr>';}).join('')+'</tbody></table>' : '';
    var meLine = (pJ!=null&&tJ!=null&&hJ!=null) ? '<div class="diag" style="background:#f3f9f4;margin-bottom:8px"><b>분절 에너지 흐름(ME):</b> 골반 <b>'+pJ+'J</b> → 몸통 <b>'+tJ+'J</b> ('+_f(meAmp,2)+'\u00d7 증폭 — 몸통이 하지 에너지를 받아 회전 파워를 키움) → 상완 <b>'+hJ+'J</b>. 몸통→팔 기여비율 <b>'+(armT!=null?armT+'%':'—')+'</b> (상완은 대부분 몸통 회전으로 구동되는 채찍 끝). 골반→몸통은 몸통이 근육으로 에너지를 자체 생성하므로 \u2018전달비\u2019 대신 순서·타이밍으로 평가합니다.</div>' : '';
    var diag;
    var seqOk = seqPct!=null && seqPct>=80;
    if(seqOk) diag='12구 중 <b>'+seqPct+'%</b>가 골반→몸통→팔의 올바른 순서로, 분절 에너지가 근위에서 원위로 순차 전달되는 패턴이 잘 나타납니다. 골반→몸통 지연 <b>'+_f(ptL)+'ms</b> · 몸통→팔 지연 <b>'+_f(taL)+'ms</b> — 두 전이 모두 적정 타이밍 범위입니다.';
    else diag='순서 정확도 '+(seqPct!=null?seqPct+'%':'—')+'. 골반→몸통('+_f(ptL)+'ms)·몸통→팔('+_f(taL)+'ms) 지연을 적정 범위로 다듬어 분절 에너지가 근위→원위로 순차 전달되도록 하면 효율이 올라갑니다.';
    return mtable + meLine
      +'<div class="seqkpi" style="display:flex;flex-direction:row;gap:8px">'
      +'<div class="sk" style="flex:1"><div class="sk-l">올바른 순서</div><div class="sk-v">'+(seqPct!=null?seqPct:'—')+'<u>%</u></div></div>'
      +'<div class="sk" style="flex:1"><div class="sk-l">몸통→팔 연결</div><div class="sk-v">'+(armT!=null?armT:'—')+'<u>%</u></div></div>'
      +'<div class="sk" style="flex:1"><div class="sk-l">ME 증폭(몸통/골반)</div><div class="sk-v">'+_f(meAmp,2)+'<u>×</u></div></div>'
      +'</div>'
      +'<div class="diag" style="margin-top:8px">'+diag+'</div>';
  }

  function buildPlayerHTML(DATA, opts) {
    /* [2026-08-13 ③ P3 §10] 청중 A/B. A형=선수·코치용(기본·방법론·연구자정보 숨김·§11.3)·B형=연구자 내부용. 원점수 무변경. */
    var _AUD = (opts && opts.audience === "B") ? "B" : "A";
    var player=DATA.player||{}, name=player.name||'선수';
    var hpa=DATA.hp_assessment||{}, dl=DATA.biomotion||{}, cmd=DATA.command||{}, vs=DATA.velo_summary||{};
    var ss=(DATA.session_summary||{}).kseq||{}, ce=dl.ceiling||{}, models=dl.models||{}, et=DATA.energy_transfer||null;
    var _phStages=((DATA.phases||{}).stages)||[]; var _phSc=_phStages.filter(function(s){return s.score!=null;}); var _phComp=_phSc.length?Math.round(_phSc.reduce(function(a,s){return a+s.score;},0)/_phSc.length):null; var _phClean=function(s){return (s.label||'').replace(/^\d+\.\s*/,'');}; var _phStrong=_phSc.length?_phSc.reduce(function(a,s){return s.score>a.score?s:a;}):null; var _phWeak=_phSc.length?_phSc.reduce(function(a,s){return s.score<a.score?s:a;}):null;
    // ── 자립형 백분위 (분석 리포트·대시보드 양쪽 창에서 동일 동작 · 전역 규준 있으면 우선 사용) ──
    var _PR_NORMS=(typeof PITCH_NORMS!=='undefined'&&PITCH_NORMS)||(typeof BIOMOTION_NORMS!=='undefined'&&BIOMOTION_NORMS)||(typeof BM_NORMS!=='undefined'&&BM_NORMS)||{};  // [2026-05-26] 단일출처 PITCH_NORMS 우선. 구 n=19 하드코딩 폴백 제거(미로드 시 빈 규준→백분위 미산출, 잘못된 값 방지).
    // [2026-05-26 통합] ends/cdf는 PITCH_STATS 단일 출처로 위임(미로드 시 동일식 폴백).
    function _PRends(dir,p25,p75){ if(typeof PITCH_STATS!=='undefined')return PITCH_STATS.ends(dir,p25,p75); if(dir===-1)return{good:p25,bad:p75}; if(dir==='abs')return Math.abs(p75)>=Math.abs(p25)?{good:p75,bad:p25}:{good:p25,bad:p75}; return{good:p75,bad:p25}; }
    function _PRz(v,nm,dir){ if(typeof PITCH_STATS!=='undefined')return PITCH_STATS.stat(v,nm,dir).z; var e=_PRends(dir,nm.p25,nm.p75); var sig=Math.abs(nm.p75-nm.p25)/1.349||1; var rz=(v-nm.med)/sig; return rz*((e.good>e.bad)?1:-1); }
    function _PRcdf(z){ if(typeof PITCH_STATS!=='undefined')return PITCH_STATS.cdf(z); var t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);var p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p; }
    function _bmPctl(mt){ if(!mt||mt.normNA||mt.value==null||!mt.key||!mt.dir)return null; var nm=_PR_NORMS[mt.key]; if(!nm)return null; return Math.round(Math.max(1,Math.min(99,_PRcdf(_PRz(mt.value,nm,mt.dir))*100))); }
    function _bmStagePctl(st){ var ps=[];(st.metrics||[]).forEach(function(m){if(m.neutral)return;var p=_bmPctl(m);if(p!=null)ps.push(p);});return ps.length?Math.round(ps.reduce(function(a,b){return a+b;},0)/ps.length):null; }
    function _bmCompPctl(){ var ps=[]; _phStages.forEach(function(st){ if(st.key==='consistency')return; (st.metrics||[]).forEach(function(m){ if(m.neutral)return; var p=_bmPctl(m); if(p!=null)ps.push(p); }); }); return ps.length?Math.round(ps.reduce(function(a,b){return a+b;},0)/ps.length):null; }
    // [2026-05-26] 메카닉 완성도 지수 — 강점(≥67)·정상·교정(≤33) 가중 결합(강1·정0.5·교0). teamReport/카드와 동일 산식.
    function _bmCompIndex(){ var ps=[]; _phStages.forEach(function(st){ if(st.key==='consistency')return; (st.metrics||[]).forEach(function(m){ if(m.neutral)return; var p=_bmPctl(m); if(p!=null)ps.push(p); }); }); if(!ps.length)return null; var cs=ps.filter(function(p){return p>=67;}).length, cf=ps.filter(function(p){return p<=33;}).length, cn=ps.length-cs-cf; return Math.round(100*(cs+0.5*cn)/ps.length); }
    // 투구 동작 유형 (드라이브-주도 vs 회전-주도 vs 균형, ±12 임계 · 분석 리포트와 동일)
    function _PRmotion(){ var byk={}; _phStages.forEach(function(st){if(st.key==='consistency')return;(st.metrics||[]).forEach(function(m){if(m.key)byk[m.key]=m;});}); function ap(ks){var ps=[];ks.forEach(function(k){var m=byk[k];if(m){var p=_bmPctl(m);if(p!=null)ps.push(p);}});return ps.length?Math.round(ps.reduce(function(a,b){return a+b;},0)/ps.length):null;} var d=ap(['comVel','driveWork','rearProp','strideLen']),r=ap(['pelvisRotV','torsoRotV','armRotV','xfPeak']); if(d==null||r==null)return null; var diff=d-r; return {type:diff>=12?'드라이브-주도형':(diff<=-12?'회전-주도형':'균형형'),drive:d,rot:r,diff:diff}; }
    var _prMot=_PRmotion();
    function _prChainRole(k,type){ var dr=['drive'],ro=['storage','release','transfer']; if(!type||type==='균형형')return (dr.indexOf(k)>=0||ro.indexOf(k)>=0)?'core':'common'; if(dr.indexOf(k)>=0)return type==='드라이브-주도형'?'core':'minor'; if(ro.indexOf(k)>=0)return type==='회전-주도형'?'core':'minor'; return 'common'; }
    function _prTypeSolutions(){ if(!_prMot)return ''; var core=[],minor=[],strongCore=[];
      _phStages.forEach(function(st){ if(st.key==='consistency')return; var role=_prChainRole(st.key,_prMot.type);
        (st.metrics||[]).forEach(function(m){ if(!m.key||m.neutral)return; var p=_bmPctl(m); if(p==null)return; if(p<33){ (role==='minor'?minor:core).push(m.label); } else if(p>67&&(role==='core'||role==='common')){ strongCore.push(m.label); } }); });
      var dt=null; var tr=_phStages.filter(function(s){return s.key==='transfer';})[0]; if(tr){var dm=(tr.metrics||[]).filter(function(x){return x.key==='driveType';})[0]; if(dm)dt=dm.value;}
      var kneeSol=dt?(String(dt).indexOf('신전')>=0?'앞무릎 <b>신전-vault형(에너지 생성)</b> — 앞무릎을 펴며 만든 신전 에너지를 회전·릴리스로 잇는 패턴. 신전 타이밍·신전일 활용을 키우는 드릴 권장.':'앞무릎 <b>버팀-흡수형(강성 버팀)</b> — 굽은 앞다리 축으로 회전·흡수하는 패턴. 강성 버팀(붕괴 최소화)·받아 멈추고 몸통 넘기기를 강조.'):'';
      var focus=_prMot.type==='드라이브-주도형'?'핵심은 드라이브·블록 체인입니다. 회전 변인이 다소 낮아도 약점이 아니라 유형 특성일 수 있어요 — 드라이브·제동 효율을 끝까지 키우는 데 집중하세요.':_prMot.type==='회전-주도형'?'핵심은 분리(몸통 꼬임)·외회전·회전 속도·시퀀스입니다. 드라이브 변인이 낮아도 부차적이며, 회전 가속·타이밍·채찍 효율을 키우는 데 집중하세요.':'드라이브·회전이 균형적입니다 — 두 체인 모두 핵심이며, 더 낮은 쪽을 먼저 보강하세요.';
      function chips(a,c){return a.length?a.map(function(l){return '<span style="display:inline-block;background:'+c+'1f;color:'+c+';border:1px solid '+c+'55;border-radius:6px;padding:2px 8px;margin:2px;font-size:12px">'+l+'</span>';}).join(''):'<span style="color:#6b7787">해당 없음</span>';}
      return '<div class="card" style="margin-bottom:10px"><b>유형별 맞춤 솔루션 — '+_prMot.type+'</b><div class="lead" style="margin:4px 0 8px">'+focus+'</div>'
        +'<div style="margin-bottom:6px"><div style="color:#6b7787;font-size:12px">우선 향상 (핵심 체인)</div>'+chips(core,'#e8731a')+'</div>'
        +'<div style="margin-bottom:6px"><div style="color:#6b7787;font-size:12px">유형 특성 — 부차(우선순위 낮음)</div>'+chips(minor,'#8893a4')+'</div>'
        +(strongCore.length?'<div style="margin-bottom:6px"><div style="color:#6b7787;font-size:12px">유지·활용 (핵심 강점)</div>'+chips(strongCore,'#2f9e44')+'</div>':'')
        +(kneeSol?'<div class="lead" style="margin-top:4px">'+kneeSol+'</div>':'')
        +'<div class="lead" style="color:#8893a4;margin-top:4px">※ 유형은 우열이 아니라 동력 전략 — 부차 체인의 낮은 값은 결함이 아닐 수 있으니 핵심 체인부터 개선하세요.</div></div>';
    }
    var testDate=hpa.test_date||'';
    // [F-001 2026-08-26 적대검증] 결측을 강점·정상·원인으로 단정 금지 — 데이터 가용성 게이트별 생성(무데이터=강점/처방 문구 0).
    var _hasFit=!!(hpa && (hpa.overall_score!=null || (hpa.axes && hpa.axes.length)));
    var _hasCmd=!!(cmd && (cmd.n>0 || cmd.score!=null || cmd.location_score!=null || cmd.mech_consistency!=null));
    var _hasVelo=!!(vs && vs.n>0);
    var C={
      intro:'체력 '+(hpa.overall_norm_pct!=null?(hpa.overall_norm_pct+'%ile(Driveline HS 대비·중앙 50)'):(hpa.overall_score!=null?hpa.overall_score+'점':'—'))+'입니다(구속 예측 아님). 아래 5단계 진단에서 약한 단계를 다듬는 것이 우선 과제입니다.'+(_hasVelo?' 일반적으로 <b>추가 구속은 에너지 전달 효율</b>에서 나옵니다.':''),
      fitness:(_hasFit?'측정된 체력 항목은 아래 규준 대비 위치로 보세요. 체력이 만든 힘을 공으로 전달하는 <b>동작 효율</b>이 지금의 과제입니다.':'체력(VALD) 검사 데이터가 없습니다 — 검사 입력 시 규준 대비로 표시됩니다.'),
      command:(_hasCmd?'릴리즈 포인트(공 놓는 위치)를 같은 타겟에 반복하는 연습으로 존 적중률을 끌어올릴 수 있습니다.':'제구(랩소도) 데이터가 없습니다 — 입력 시 로케이션 일관성·스트라이크율로 표시됩니다.'),
      closing:'이 리포트는 선수와 코치가 함께 보도록 핵심 분석을 정리한 버전입니다. 정밀 시계열·3D 진단은 분석가용 리포트를 참고하세요. 자가연습 포인트는 가이드이며, 정확한 교정은 코치와 함께 진행하세요.<br>※ 메카닉 점수 규준: 고교 우수투수 20명(Theia 마커리스+포스플레이트+랩소도) 기준 · 100점=엘리트 중앙값, 1 SD당 10점 · 절대 수행지표가 아닌 엘리트 대비 상대 위치입니다.'
    };
    // ── 에너지 전달 진단(메카닉 평가 대체) — 전역 ETDIAG 사용 ──
    var ET=(typeof ETDIAG!=='undefined'&&ETDIAG)?ETDIAG:null;
    if(!ET){ try{ if(typeof etDiag!=='undefined'&&etDiag.compute) ET=etDiag.compute(DATA); }catch(e){ ET=null; } }
    function _edC(s){ return s==='good'?'#2f9e44':(s==='caution'?'#e8731a':(s==='leak'?'#c0612b':'#8893a4')); }
    function _edK(s){ return s==='good'?'양호':(s==='caution'?'주의':(s==='leak'?'병목':'—')); }
    function _edCmt(s){ return s==='good'?'지금 좋아요 — 이 단계는 유지하세요.':(s==='caution'?'조금 더 다듬으면 좋아요.':(s==='leak'?'여기를 먼저 고치면 구속이 올라갑니다.':'')); }
    // 단계별 선수용 쉬운 이름·설명
    var STAGE_EZ={
      windup:['준비 자세 (와인드업)','다리를 들고 몸에 힘을 모으는 단계예요. 여기서 던질 힘을 미리 저장합니다.'],
      xftiming:['골반·상체 비틀기 (몸통 꼬임)','골반과 상체를 서로 반대로 비틀어 고무줄처럼 감았다가, 알맞은 순간에 풀어 큰 힘을 냅니다.'],
      stride:['밀고 나가기 (드라이브)','뒷다리로 땅을 밀어 몸을 홈플레이트 쪽으로 보내며 전진하는 힘을 만듭니다.'],
      blocking:['앞발로 멈추기 (블로킹)','내딛은 앞발로 전진을 세게 받아 멈춰서, 그 위로 몸통과 팔이 앞으로 넘어가게 받쳐 줍니다.'],
      knee:['앞무릎으로 버티기','앞무릎이 무너지지 않고 단단히 버텨야 앞으로 가던 기세를 받아 멈추는 받침이 섭니다.'],
      pelvistrunk:['골반 → 몸통으로 힘 키우기','골반이 만든 회전이 몸통으로 넘어가면서 더 큰 힘으로 증폭됩니다.'],
      trunk:['몸통에서 힘 만들기','몸통의 회전과 앞으로 굽히는 동작으로 투구에서 가장 큰 에너지를 만들어 냅니다.'],
      trunkarm:['몸통 → 팔로 넘기기','몸통이 만든 힘을 팔로 잘 넘겨주면, 팔은 덜 힘들게 더 빠른 공을 던질 수 있습니다.'],
      armball:['팔 → 공에 싣기','팔과 손의 빠른 속도를 공에 효율적으로 실어 구속으로 바꿉니다.']
    };
    var STAGE_DRILL={
      windup:'밸런스 홀드 — 다리를 들고 1~2초 멈춰 흔들림 없이 힘을 모으는 연습.',
      xftiming:'분리 드릴 — 골반만 먼저 돌리고 상체는 버텨 "감았다 푸는" 타이밍 익히기(밴드·수건 활용).',
      stride:'뒷다리 푸시 스트라이드 점프 — 뒷다리로 멀리 밀어 안정적으로 착지하기.',
      blocking:'앞발 스탬프 드릴 — 앞발을 강하게 디뎌 전진을 딱 멈추는 감각 만들기.',
      knee:'한 발 착지 버티기 — 앞무릎이 안쪽으로 무너지지 않게 단단히 버티기.',
      pelvistrunk:'메디신볼 회전 던지기 — 골반 먼저, 몸통 나중 순서로 회전을 전달하기.',
      trunk:'몸통 채찍 회전 — 상체 회전과 굽힘을 빠르게 가속하는 회전 던지기.',
      trunkarm:'커넥션볼 던지기 — 가슴과 팔을 붙여 몸통과 팔이 함께 움직이게 하기.',
      armball:'플라이오케어볼 단계 던지기 — 팔·손 속도를 공에 효율적으로 싣는 연습.'
    };
    var STAGE_SHORT={windup:'와인드업',xftiming:'몸통 꼬임',stride:'드라이브',blocking:'블로킹',knee:'무릎',pelvistrunk:'골반→몸통',trunk:'몸통',trunkarm:'몸통→팔',armball:'팔→공'};
    // 주의/병목일 때 선수용 상세 조언
    var STAGE_FIX={
      windup:'다리 들기에서 흔들림이 있거나 힘이 덜 모입니다. 한 발로 1~2초 멈춰 균형을 잡고, 상체를 무리하게 세우거나 일찍 골반을 열지 마세요.',
      xftiming:'골반·상체 분리를 착지(FC)까지 유지하지 못하거나 푸는 시점이 안 맞습니다. 더 크게 비틀기보다, 만든 분리를 착지 직후에 풀도록 타이밍을 맞추세요.',
      stride:'홈 쪽으로 가는 전진 힘이 부족합니다. 뒷다리로 땅을 더 밀어 보폭·전진속도를 키우되, 너무 넓게 디뎌 균형을 잃지는 마세요.',
      blocking:'앞발로 전진을 멈추는 제동이 약하거나 늦습니다. 착지 직후 앞다리로 세게 받아 멈추고 몸통·팔을 앞으로 넘기세요.',
      knee:'앞무릎이 버티지 못하고 무너지거나, 받은 힘이 골반 회전으로 잘 안 넘어갑니다. 한 발 착지에서 무릎이 안쪽으로 무너지지 않게 단단히 버티는 연습을 하세요.',
      pelvistrunk:'골반 회전이 몸통으로 충분히 커지지 않습니다. 골반을 먼저 돌리고 몸통이 살짝 늦게 따라오는 순서를 지켜, 몸통이 골반 힘을 받아 증폭하게 하세요.',
      trunk:'몸통이 만드는 에너지가 부족합니다. 회전과 앞으로 굽힘을 함께 빠르게 써서 몸통 엔진을 더 키우세요(팔로 때우려 하지 마세요).',
      trunkarm:'몸통 힘이 팔로 잘 넘어가지 않아 팔이 스스로 일하는 경향이 있습니다. 몸통이 최고로 돌아간 직후에 팔이 따라 나오도록 타이밍을 맞추세요.',
      armball:'팔·손 속도가 공으로 나가는 효율이 낮거나 팔 부담이 큽니다. 손 속도가 가장 빠른 순간을 공 놓는 시점에 맞추고, 같은 구속을 더 편한 팔로 던지도록 앞 단계 전달을 개선하세요.'
    };
    // [2026-05-28] 메카닉 섹션을 코칭 뷰 콘텐츠로 대체 — 투구 5시점 그림 + 5 동작 단계(구 에너지 전달 지도 폐기) + 잘되는 부분 + TOP3 우선과제
    // 9단계 카테고리(코칭 뷰와 동일): store/eff/out/out/eff/eff/out/load/load
    var CAT_OF={windup:'store',xftiming:'eff',stride:'out',blocking:'out',knee:'eff',pelvistrunk:'eff',trunk:'out',trunkarm:'load',armball:'load'};
    var CAT_COL={out:'#2563eb',eff:'#1f9d58',store:'#7048e8',load:'#e8731a'};
    var STAGE_PNAME={windup:'와인드업',xftiming:'몸통 꼬임 풀림',stride:'스트라이드',blocking:'앞발 제동',knee:'무릎-골반',pelvistrunk:'골반-몸통',trunk:'몸통 에너지',trunkarm:'몸통-팔',armball:'팔-공'};
    // 단계별 우선과제(선수 언어) — 코칭 뷰의 _PS_PRIO와 동일
    var STAGE_PRIO_LOCAL={
      windup:'와인드업에서 만든 힘 모으기을 착지까지 유지하는 데 집중',
      xftiming:'꼬임을 더 크게 만들기보다 FC까지 유지하고 블로킹 이후 푸는 타이밍 맞추기',
      stride:'전진속도 자체보다 블로킹 가능한 전진 에너지를 홈 방향으로 안정적으로 만들기',
      blocking:'앞발 착지 직후 빠르게 제동을 형성해 몸통·팔이 넘어갈 받침 만들기',
      knee:'앞다리로 받은 힘을 버텨 받침을 빨리 세우기(무릎 흡수·지연 줄이기)',
      pelvistrunk:'골반 회전 직후 몸통이 늦지 않게 따라오도록 타이밍 맞추기',
      trunk:'팔을 더 쓰기보다 몸통 회전+굴곡 에너지 생산을 먼저 키우기',
      trunkarm:'몸통 힘 최고점 직후 어깨 안쪽 회전이 늦지 않게 연결해 몸통 힘을 팔로 넘기기',
      armball:'손끝 속도 최고점을 릴리스에 맞추고 팔 부담 대비 구속 효율 높이기'
    };
    // 각 단계의 약한 세부 변인 — {name, desc} 정확한 변인명 + 짧은 설명. (typeKo 제거)
    function _weakestVarLocal(s){
      if(!s||!ET) return null;
      var R=ET.rep||{}, key=s.key;
      var name='', desc='';
      if(key==='windup'){
        var sub=(ET.windup&&ET.windup.sub)||{};
        var worst=null, worstSc=999;
        Object.keys(sub).forEach(function(k){if(sub[k]!=null&&isFinite(sub[k])&&sub[k]<worstSc){worstSc=sub[k];worst=k;}});
        var WN={hipHinge:['힙힌지','뒷고관절을 접어 골반에 힘을 저장하는 자세'],
                pelvicClosure:['골반 닫힘 유지','와인드업~KH 구간 골반이 일찍 열리지 않고 닫혀 있는 정도'],
                xftiming:['몸통 꼬임 형성 타이밍','꼬임이 형성되기 시작하는 시점'],
                rearHip:['뒷고관절 외회전','뒷다리를 외회전해 골반 회전 준비'],
                rearFoot:['뒷발 토크','뒷발이 마운드를 미는 회전 토크'],
                strideConv:['스트라이드 전환','저장된 힘이 전진 운동량으로 바뀌는 비율']};
        if(worst&&WN[worst]){name=WN[worst][0]+' '+worstSc+'점'; desc=WN[worst][1];}
        else if(ET.windup&&ET.windup.composite!=null){name='와인드업 종합 '+ET.windup.composite+'점'; desc='힙힌지·골반닫힘 등 6개 하위변인 평균';}
      } else if(key==='xftiming'){
        var rs=R.tXfReleaseStart;
        if(rs!=null){name='몸통 꼬임 풀림 시점 착지'+(rs>=0?'+':'')+rs+'ms'; desc='꼬임이 풀리기 시작한 시점(착지=0 · 적정 -10~+15ms)';}
      } else if(key==='stride'){
        if(R.comVelAtFC!=null){name='착지 순간 전진 속도 '+R.comVelAtFC+' m/s'; desc='착지 시점 무게중심 전진 속도(엘리트 ~3.5 m/s)';}
      } else if(key==='blocking'){
        if(R.brakeImpulsePct!=null){name='앞발 제동 임펄스 '+R.brakeImpulsePct+' %BW·s'; desc='착지 후 앞발이 전진 에너지를 멈춘 누적 제동량(MAP score SSOT)';}
      } else if(key==='knee'){
        if(R.kneeNegWork!=null){name='무릎 흡수일 '+R.kneeNegWork+' J'; desc='앞무릎이 받아 멈추며 흡수한 에너지(브레이크 역할 — 많고 적음 자체가 손실의 크기는 아님)';}
        else if(R.kneeNetExt!=null){name='앞무릎 순신전 '+R.kneeNetExt+'°'; desc='착지 후 앞무릎이 펴진 각도(+면 vault, -면 굴곡)';}
      } else if(key==='pelvistrunk'){
        if(R.gapPelvisToTrunkVel!=null){name='골반→몸통 간격 '+R.gapPelvisToTrunkVel+' ms'; desc='골반 회전 속도 최고점에서 몸통 최고점까지 시간차(짧을수록 잘 전달 · 적정 30~60ms)';}
        else if(R.trunkOverPelvisGain!=null){name='골반→몸통 키우는 비율 '+R.trunkOverPelvisGain; desc='몸통 회전 속도 ÷ 골반 회전 속도(>1.2 적정)';}
      } else if(key==='trunk'){
        if(R.trunkEpeak!=null){name='몸통 힘 최고 '+R.trunkEpeak+' J'; desc='몸통이 만든 힘(에너지)의 최댓값(엘리트 중앙 ~500 J)';}
      } else if(key==='trunkarm'){
        if(R.armSelfReliance!=null){name='팔 의존도(ASR) '+R.armSelfReliance; desc='팔 속도 중 몸통 전달 없이 팔이 스스로 만든 비율(낮을수록 좋음)';}
        else if(R.trunkArmOverlap!=null){name='전달 맞물림 '+R.trunkArmOverlap; desc='몸통 힘 최고점과 팔 가속의 시간 겹침(많을수록 잘 넘김)';}
      } else if(key==='armball'){
        if(R.elbowTorque!=null){name='팔꿈치에 걸리는 힘 최고 '+R.elbowTorque+' N·m'; desc='팔꿈치 안쪽 인대(UCL)에 가해지는 부담 지표 — 개인 부상 위험은 검증된 부하 기준으로만 판정';}
        else if(R.shoulderTorque!=null){name='어깨 내회전 토크 peak '+R.shoulderTorque+' N·m'; desc='어깨 관절에 가해지는 부하';}
      }
      if(!name && s.status!=='good' && (STAGE_EZ[s.key]||[s.label||'',''])[0]){ name=(STAGE_EZ[s.key]||[s.label||'',''])[0]; desc=''; }
      return name?{name:name,desc:desc}:null;
    }
    function edSection(){
      if(!ET||!ET.stages||!ET.stages.length){ return '<div class="note">에너지 전달 진단은 지면반력(force plate)+관절파워가 있는 측정에서 표시됩니다.</div>'; }
      // ① 핵심 진단 헤드라인 (있을 때만)
      var headH=ET.headline?('<div class="card" style="border-left:4px solid #1f6feb;margin-bottom:10px"><b>핵심 진단</b><div class="lead" style="margin-top:4px;font-size:13px;color:#1b2330">'+esc(ET.headline)+'</div></div>'):'';
      // ② 에너지 전달 흐름 참고 (3×3 그리드 · 현행 미표시 — 9단계 표시 폐기, 본문은 5동작 _drillSection 사용)
      var flowH='<div class="card" style="margin-bottom:10px"><div style="font-size:13px;font-weight:800;margin-bottom:10px">에너지 전달 흐름 (참고)</div>'
        +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
      ET.stages.forEach(function(s,i){
        var c=_edC(s.status);
        var cat=CAT_OF[s.key]||'eff', catCol=CAT_COL[cat]||'#8893a4';
        var pName=STAGE_PNAME[s.key]||s.key;
        // [2026-05-28] 약한 변인은 병목(leak) 상태에만 표시 — 사용자 피드백(양호·주의에도 보여 어지러움)
        var weak=(s.status==='leak')?_weakestVarLocal(s):null;
        flowH+='<div style="background:#f6f8fb;border-radius:8px;padding:8px 8px 8px 13px;position:relative;page-break-inside:avoid">'
          +'<span style="position:absolute;left:0;top:0;bottom:0;width:5px;background:'+catCol+';border-radius:8px 0 0 8px"></span>'
          +'<div style="font-size:11px;color:#6b7787">'+(i+1)+'. '+esc(pName)+'</div>'
          +'<div style="font-size:12.5px;font-weight:800;color:'+c+';margin-top:3px">'+_edK(s.status)+(s.score==null?'':' '+s.score+'점')+'</div>'
          +(weak?'<div style="font-size:11px;color:#c0612b;margin-top:5px;border-top:1px dashed #e3e9f0;padding-top:4px"><b>'+esc(weak.name)+'</b>'+(weak.desc?'<div style="color:#8893a4;font-weight:400;margin-top:2px">'+esc(weak.desc)+'</div>':'')+'</div>':'')
          +'</div>';
      });
      flowH+='</div>'
        +'<div class="lead" style="margin-top:8px;font-size:11px">색 바 카테고리: <span style="color:'+CAT_COL.store+';font-weight:700">■ 저장</span> · <span style="color:'+CAT_COL.out+';font-weight:700">■ 생성</span> · <span style="color:'+CAT_COL.eff+';font-weight:700">■ 전달</span> · <span style="color:'+CAT_COL.load+';font-weight:700">■ 부하</span> &nbsp;|&nbsp; 상태: <span style="color:#2f9e44;font-weight:700">양호</span> · <span style="color:#e8731a;font-weight:700">주의</span> · <span style="color:#c0612b;font-weight:700">병목</span></div>'
        +'</div>';
      // ③ 잘되는 부분
      var avail=ET.stages.filter(function(s){return s.score!=null;});
      var strongList=avail.filter(function(s){return s.status==='good';}).sort(function(a,b){return b.score-a.score;}).slice(0,3);
      if(!strongList.length) strongList=avail.slice().sort(function(a,b){return b.score-a.score;}).slice(0,2);
      var strengthH=strongList.length?('<div class="card" style="border-left:4px solid #2f9e44;margin-bottom:10px">'
        +'<b style="color:#2f9e44">잘되는 부분</b>'
        +'<div class="lead" style="margin-top:4px">'
        +strongList.map(function(s){var pn=STAGE_PNAME[s.key]||s.key; return '<b>'+esc(pn)+'</b>('+esc((STAGE_EZ[s.key]||[s.label||'',''])[0])+', '+(s.score==null?'–':s.score+'점)');}).join(' · ')
        +' — 이 단계들은 또래 선수 상위 수준으로, 강점을 유지하면서 아래 병목을 개선하면 됩니다.</div></div>'):'';
      // ④ TOP3 우선과제 (이번 주 가장 먼저 고칠 것)
      function _psNat(s){ if(typeof _psNatural==='function'){ try{ var r=_psNatural(s); if(r) return r; }catch(e){} } return STAGE_FIX[s.key]||(s.story&&s.story.meaning)||(s.label||''); }
      var _ord={leak:0,caution:1};
      var probs=ET.stages.filter(function(s){return s.status==='leak'||s.status==='caution';})
        .sort(function(a,b){ if(_ord[a.status]!==_ord[b.status]) return _ord[a.status]-_ord[b.status]; return (a.score==null?999:a.score)-(b.score==null?999:b.score); }).slice(0,3);
      var priH;
      if(probs.length){
        priH='<div class="card" style="border-left:4px solid #7048e8;margin-bottom:10px">'
          +'<b style="color:#7048e8">이번 주 가장 먼저 고칠 것 — TOP '+probs.length+'</b>'
          +probs.map(function(s,i){var c=_edC(s.status),pn=STAGE_PNAME[s.key]||s.key,prio=STAGE_PRIO_LOCAL[s.key]||'';
            return '<div style="margin-top:'+(i?10:8)+'px;padding-left:10px;border-left:3px solid '+c+'">'
              +'<div style="font-size:12.5px;font-weight:700">'+(i+1)+'순위. '+esc(pn)+' <span style="font-size:11px;font-weight:700;color:'+c+';margin-left:4px">'+_edK(s.status)+(s.score==null?'':' '+s.score+'점')+'</span></div>'
              +'<div class="lead" style="margin-top:3px">'+esc(_psNat(s))+'</div>'
              +(prio?'<div class="lead" style="margin-top:3px;color:'+c+';font-weight:600">→ '+esc(prio)+'</div>':'')
              +'</div>'; }).join('')+'</div>';
      } else {
        priH='<div class="note" style="margin-bottom:10px">뚜렷한 병목·주의 단계가 없습니다 — 전 단계가 균형 잡혀 있습니다. 현재 패턴을 유지하세요.</div>';
      }
      // ⑤ 팔 부담 (있을 때만)
      var il=ET.injuryLoad, armH='';
      if(il){ var lc=(il.level==='high')?'#c0612b':((il.level==='moderate')?'#e8731a':'#2f9e44');
        armH='<div class="card" style="border-left:4px solid '+lc+';margin-bottom:10px"><b>팔 부담 · 출력 효율 — '+esc(il.levelKo||il.level||'')+'</b>'
          +'<div class="lead" style="margin-top:4px">'+esc(il.summary||'')+'</div>'
          +(il.basis?('<div class="lead" style="color:#8893a4;margin-top:3px">'+esc(il.basis)+'</div>'):'')+'</div>'; }
      // [교정 우선순위 TOP3·5단계] 저장·생성·효율 각 영역 최약 단계 1개씩 — 변인 옆 카테고리 태그
      function _weakSub(st){ if(!st||!st.sub||!st.sub.length)return null; var arr=st.sub.slice(0,-1); if(!arr.length)arr=st.sub.slice(); var ord={bad:0,warn:1,good:2}; arr=arr.slice().sort(function(x,y){return (ord[x.status]==null?3:ord[x.status])-(ord[y.status]==null?3:ord[y.status]);}); return arr[0]; }
      function _stWord(st){ return st==='good'?'양호':st==='warn'?'주의':'누수'; }
      function _stCol2(st){ return st==='good'?'#2f9e44':st==='warn'?'#e8731a':'#c0612b'; }
      var _axDefs=[{nm:'저장',col:'#7048e8',w:_worst6('store')},
                   {nm:'생성',col:'#2563eb',w:_worst6('gen')},
                   {nm:'효율',col:'#1f9d58',w:_worst6('transfer')}].filter(function(a){return a.w;});
      _axDefs.sort(function(a,b){return (a.w.score==null?999:a.w.score)-(b.w.score==null?999:b.w.score);});
      var corrPriorityH = _axDefs.length ? ('<div class="card" style="border-left:4px solid #7048e8;margin-bottom:10px">'
        +'<b style="color:#7048e8;font-size:15px">교정 우선순위 TOP '+_axDefs.length+'</b>'
        +'<div class="lead" style="margin:3px 0 2px">5단계 흐름에서 저장·생성·효율 각 영역의 가장 약한 단계를 하나씩 골라, 가장 시급한 순서로 정리했습니다.</div>'
        +_axDefs.map(function(a,i){var k=_K6TO9[a.w.key]||a.w.key;
          return '<div style="margin-top:'+(i?12:8)+'px;padding:11px 13px;background:#faf9ff;border-radius:9px;border-left:4px solid '+a.col+';page-break-inside:avoid">'
            +'<div style="font-size:15px;font-weight:800;color:#1b2330"><span style="display:inline-block;background:'+a.col+';color:#fff;font-size:11px;font-weight:800;border-radius:5px;padding:1px 7px;margin-right:6px;vertical-align:middle">'+a.nm+'</span>'+(i+1)+'순위 · '+esc(a.w.name)+(a.w.score!=null?' <span style="color:'+a.col+';font-size:13px">'+a.w.score+'점</span>':'')+'</div>'
            +(function(){var ws=_weakSub(a.w);return ws?'<div style="font-size:13px;color:#41506a;margin-top:5px;line-height:1.55"><b>약한 변인</b> · <b style="color:'+a.col+'">'+esc((typeof _ezLabel==='function')?_ezLabel(ws.label):ws.label)+'</b> '+esc(ws.val||'')+(ws.status?' <span style="color:'+_stCol2(ws.status)+';font-weight:700">'+_stWord(ws.status)+'</span>':'')+'</div>':'';})()
            +'<div style="font-size:13.5px;line-height:1.75;color:#2a3547;margin-top:7px">'+esc(STAGE_FIX[k]||'')+'</div>'
            +(STAGE_PRIO_LOCAL[k]?'<div style="font-size:13px;font-weight:700;color:'+a.col+';margin-top:7px">→ '+esc(STAGE_PRIO_LOCAL[k])+'</div>':'')
            +(STAGE_DRILL[k]?'<div style="font-size:12.5px;color:#1a7f5a;background:#e7f7ef;border-radius:7px;padding:8px 11px;margin-top:8px"><b>이렇게 연습하세요</b> · '+esc(STAGE_DRILL[k])+'</div>':'')
            +(function(){ // [2026-07-11] 상류 원인 자동 제시(OBP within/between 인과지도·feedback_causemap.js) — additive
                var cz=(typeof FEEDBACK_CAUSEMAP!=='undefined'&&FEEDBACK_CAUSEMAP.get)?FEEDBACK_CAUSEMAP.get(k):null; if(!cz)return '';
                var ab={within_lever:['매투구 교정','#1f9d58'],archetype:['자세·폼(선수간)','#e8731a'],fitness:['체력(장기)','#2563eb'],info:['정보만','#8893a4']}[cz.actionability]||['','#8893a4'];
                var cl=(cz.causes&&cz.causes.length)?('<div style="margin-top:3px"><b>상류 원인</b> · '+cz.causes.map(function(c){return esc(c.label)+'('+esc(c.conf)+')';}).join(' › ')+'</div>'):'';
                var ft=cz.fitness?('<div style="margin-top:3px"><b>체력 기반</b> · '+esc(cz.fitness.name)+'</div>'):'';
                var _tcC={check:['채점','#1f9d58'],range:['범위·관찰','#e8731a'],info:['정보','#8893a4']}, _lyC={within:'매투구',fitness:'체력',between:'폼',info:'정보'};
                var clist=(cz.checklist&&cz.checklist.length)?('<div style="margin-top:6px;border-top:1px dashed #cfd8ea;padding-top:5px"><b style="color:#4a5bd8">확인 항목</b> <span style="font-size:10px;color:#8893a4">강점·관찰·보강 포인트</span>'
                  +cz.checklist.map(function(q){var tc=_tcC[q.tier]||['','#8893a4'],ly=_lyC[q.layer]||'';
                    return '<div style="margin-top:4px"><b>'+esc(q.v)+'</b> <span style="font-size:10px;font-weight:700;color:'+tc[1]+';border:1px solid '+tc[1]+';border-radius:4px;padding:0 5px">'+esc(tc[0])+'</span>'+(ly?' <span style="font-size:10px;color:#8893a4">'+esc(ly)+'</span>':'')
                      +'<div style="color:#5a6880;line-height:1.5"><b style="color:#2f9e44">강점</b> '+esc(q.strong)+' · <b style="color:#e8731a">관찰</b> '+esc(q.watch)+' · <b style="color:#4a5bd8">보강</b> '+esc(q.reinforce)+'</div></div>';}).join('')
                  +'</div>'):'';
                return '<div style="font-size:12px;color:#41506a;background:#eef2fb;border-radius:7px;padding:8px 11px;margin-top:8px;line-height:1.6">'
                  +'<b style="color:#4a5bd8">상류 원인 자동 제시</b> <span style="font-size:10px;font-weight:700;color:'+ab[1]+';border:1px solid '+ab[1]+';border-radius:4px;padding:1px 6px">'+esc(ab[0])+'</span> <span style="color:#8893a4">· OBP 데이터·순위/방향·가설</span>'
                  +cl+(cz.message?('<div style="margin-top:3px">'+esc(cz.message)+'</div>'):'')+ft+clist+'</div>'; })()
            +'</div>'; }).join('')+'</div>')
        : '<div class="note" style="margin-bottom:10px">뚜렷한 약점이 없습니다 — 세 영역이 균형 잡혀 있습니다. 현재 패턴을 유지하세요.</div>';
      return corrPriorityH;
    }
    // 메카닉 보완 훈련법 — 점수 낮은(주의·병목) 단계 우선
    function trainSection(){
      if(!ET||!ET.stages||!ET.stages.length) return '';
      var weak=ET.stages.filter(function(s){return s.status==='leak'||s.status==='caution';}).sort(function(a,b){return (a.score==null?999:a.score)-(b.score==null?999:b.score);});
      if(!weak.length) weak=ET.stages.slice().sort(function(a,b){return (a.score==null?999:a.score)-(b.score==null?999:b.score);}).slice(0,4);
      weak=weak.slice(0,5);
      var rows=weak.map(function(s,i){var c=_edC(s.status),ez=(STAGE_EZ[s.key]||[s.label||'',''])[0];
        return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:'+(i?'1px solid #eef2f7':'0')+'">'
          +'<span style="flex:none;background:'+(s.status==='leak'?'#fbe7dd':'#fff4e6')+';color:'+c+';font-weight:800;font-size:11px;border-radius:6px;padding:3px 9px;min-width:48px;text-align:center">'+_edK(s.status)+'</span>'
          +'<div style="flex:1"><div style="font-size:12.5px;font-weight:700">'+esc(ez)+(s.score==null?'':' <span style="color:#8893a4;font-weight:400">'+s.score+'점</span>')+'</div>'
          +'<div class="pri-drill" style="margin-top:5px">'+esc(STAGE_DRILL[s.key]||'발→골반→몸통→팔 시퀀스 점프 + 메디신볼 회전 던지기로 운동사슬 타이밍·전달을 끌어올리기')+'</div></div></div>'; }).join('');
      return '<h2>④ 메카닉 보완 훈련법</h2><div class="lead">위 진단에서 점수가 낮은(주의·병목) 단계를 보완하는 자가 훈련입니다. 통증이 있으면 중단하고 코치·트레이너와 상의하세요.</div>'
        +'<div class="card">'+rows+'</div>'
        +'<div class="note" style="margin-top:8px">각 드릴은 가이드입니다. 주 2~3회, 던지기 전 워밍업으로 동작 패턴을 익힌 뒤 실제 투구에 적용하세요. 정확한 교정은 코치와 함께 진행하는 것이 가장 효과적입니다.</div>';
    }
    function kpi(lbl,val,sub,accent){ return '<div class="kpi" style="border-top:3px solid '+accent+'"><div class="kpi-lbl">'+lbl+'</div><div class="kpi-val">'+val+'</div><div class="kpi-sub">'+sub+'</div></div>'; }
    function qk(l,v,u){ return '<div class="qk"><div class="qk-l">'+l+'</div><div class="qk-v">'+v+(u?'<u>'+u+'</u>':'')+'</div></div>'; }
    function _mcRow(name,score,detail){ var col=(score==null)?'#8893a4':(score>=80?'#2f9e44':(score>=60?'#41506a':'#c0612b')); return '<tr><td class="evl">'+name+'</td><td style="text-align:right"><b style="color:'+col+'">'+(score!=null?score:'—')+'</b></td><td style="text-align:right;color:#8893a4">'+detail+'</td></tr>'; }
    function cmdRow(name,desc,val,unit,sc,extra){ var scol=(sc==null)?'#8893a4':(sc>=80?'#2f9e44':(sc>=60?'#41506a':'#c0612b')); var mv=(val==null?'—':_f(val)+(unit||''))+(extra?' <span style="color:#8893a4">('+extra+')</span>':''); return '<tr><td class="evl">'+name+'<div style="font-size:11px;color:#7a8aa0;font-weight:400;margin-top:1px">'+desc+'</div></td><td style="text-align:right">'+mv+'</td><td style="text-align:right"><b style="color:'+scol+'">'+(sc!=null?sc:'—')+'</b></td></tr>'; }
    // 메카닉 변인 띠 행(라이트) — 엘리트 25–75% 존 + 백분위 마커
    function _bmBarRow(mt){ var p=(typeof _bmPctl==='function')?_bmPctl(mt):null; var mv=(mt.value!=null?_f(mt.value)+(mt.unit||''):'—');
      if(p==null) return '<div class="bar-row"><div class="bar-lbl">'+((typeof _ezLabel==='function')?_ezLabel(mt.label):mt.label)+((typeof _varTagsHTML==='function')?_varTagsHTML(mt.key):'')+'</div><div><div class="bar-na">'+(mt.normNA?'유형상 규준 비교 제외 · 값만':'엘리트 규준 없음 · 값만')+'</div></div><div class="bar-val">'+mv+'</div></div>';
      if(mt.neutral) return '<div class="bar-row"><div class="bar-lbl">'+((typeof _ezLabel==='function')?_ezLabel(mt.label):mt.label)+((typeof _varTagsHTML==='function')?_varTagsHTML(mt.key):'')+'</div>'
        +'<div><div class="bar-track"><div class="bar-zone"></div><div class="bar-mark" style="left:'+p+'%;background:#8893a4"></div></div><div class="bar-ax"><span>하위</span><span class="mid">또래 선수 25–75%</span><span>상위</span></div></div>'
        +'<div class="bar-val"><b style="color:#8893a4">'+p+'</b><u> 백분위 · 위치(우열 아님)</u><br>'+mv+'</div></div>';
      var col=p>=67?'#2f9e44':(p<=33?'#c0612b':'#1f6feb'), word=p>=67?'강점':(p<=33?'교정':'정상');
      return '<div class="bar-row"><div class="bar-lbl">'+((typeof _ezLabel==='function')?_ezLabel(mt.label):mt.label)+((typeof _varTagsHTML==='function')?_varTagsHTML(mt.key):'')+'</div>'
        +'<div><div class="bar-track"><div class="bar-zone"></div><div class="bar-mark" style="left:'+p+'%;background:'+col+'"></div></div><div class="bar-ax"><span>하위</span><span class="mid">엘리트 25–75%</span><span>상위</span></div></div>'
        +'<div class="bar-val"><b style="color:'+col+'">'+p+'</b><u> 백분위 · '+word+'</u><br>'+mv+'</div></div>'; }
    // [5단계 통일] 분석 대시보드와 동일한 5단계(_efPhases식) — ETDIAG 파생. 저장/생성/효율 카테고리.
    var _CAT6={store:['저장','#7048e8'],gen:['생성','#2563eb'],transfer:['효율','#1f9d58']};
    var _K6TO9={windup:'windup',stride:'stride',block:'blocking',knee:'knee',trunk:'trunk',arm:'armball'};
    function _st6(sc){ return sc==null?'warn':(sc>=75?'good':(sc>=60?'warn':'bad')); }
    function _st6Col(st){ return st==='good'?'#2f9e44':(st==='warn'?'#e8731a':'#c0612b'); }
    var _BM_NODES6=[{x:168,y:196},{x:332,y:214},{x:502,y:210},{x:680,y:220},{x:858,y:210},{x:1028,y:206}];
    var _PH6=(function(){
      var CAT={windup:'store',stride:'gen',block:'transfer',knee:'transfer',trunk:'gen',arm:'transfer'};
      if(typeof _efPhases==='function'){ try{ var ep=_efPhases(); if(ep&&ep.length){ return ep.map(function(x){var sc=(x.score!=null&&isFinite(x.score))?Math.round(x.score):null; return {n:x.n,key:x.key,name:x.name,cat:CAT[x.key]||'gen',score:sc,status:_st6(sc),sub:(x.sub||[])}; }); } }catch(e){} }
      if(!ET) return [];
      var W=ET.windup||{},S=ET.stride||{},B=ET.blocking||{},K=ET.knee5||{},T=ET.trunk7||{},AB=ET.armball9||{};
      var a=[{n:1,key:'windup',name:'와인드업',cat:'store',score:W.composite},
             {n:2,key:'stride',name:'드라이브',cat:'gen',score:S.momentumScore},
             {n:3,key:'block',name:'블로킹',cat:'transfer',score:B.functionalScore},
             {n:4,key:'knee',name:'앞다리 버팀',cat:'transfer',score:null},
             {n:5,key:'trunk',name:'몸통',cat:'gen',score:T.prodScore},
             {n:6,key:'arm',name:'팔',cat:'transfer',score:AB.abScore}];
      a.forEach(function(p){p.score=(p.score!=null&&isFinite(p.score))?Math.round(p.score):null; p.status=_st6(p.score);}); return a;
    })();
    function _ax6(cat){ var v=_PH6.filter(function(p){return p.cat===cat&&p.score!=null;}); return v.length?Math.round(v.reduce(function(a,p){return a+p.score;},0)/v.length):null; }
    var _AX6={store:_ax6('store'),gen:_ax6('gen'),transfer:_ax6('transfer')};
    function _worst6(cat){ return _PH6.filter(function(p){return p.cat===cat&&p.score!=null;}).sort(function(a,b){return a.score-b.score;})[0]||null; }
    function _worstAll6(){ return _PH6.filter(function(p){return p.score!=null;}).sort(function(a,b){return a.score-b.score;})[0]||null; }
    var _mechComp6=(function(){var v=_PH6.filter(function(p){return p.score!=null;});return v.length?Math.round(v.reduce(function(a,p){return a+p.score;},0)/v.length):null;})();
    var _effForKpi=_mechComp6;
    var kpis=[
      kpi('구속 (최고/평균)', _f(vs.max_kmh)+'<u> km/h</u>','평균 '+_f(vs.avg_kmh)+' km/h','#e8731a'),
      kpi('회전수',(vs.avg_spin||'—')+'<u> rpm</u>','평균 spin','#1f9d8f'),
      kpi((hpa.overall_norm_pct!=null?'체력 퍼센타일':'체력 점수'),(hpa.overall_norm_pct!=null?(hpa.overall_norm_pct+'<u>%ile</u>'):(hpa.overall_score!=null?hpa.overall_score+'<u> /100</u>':'—')),(hpa.overall_norm_pct!=null?'Driveline HS 대비(중앙 50)':'종합 (근력·파워·반응성 = Driveline 검증축 · 악력은 자체 코호트 참고·OBP 미검증)'),'#2f9e44'),
      kpi('메카닉 점수',(_effForKpi!=null?_effForKpi:'—')+'<u> /100</u>','5단계 종합 점수','#1f9d58'),
      kpi('핵심 누수',esc((_worstAll6()||{}).name||'없음'),'5단계 중 가장 약한 단계','#c0612b')
    ].join('');
    var fitAxes=(hpa.axes||[]).filter(function(a){return a.key!=='upper_power';}).map(function(a){return {label:a.label_kr||a.axis,score:a.score,target:a.elite_score};});
    var fitRadar=fitAxes.length?radarSVG(fitAxes,100,[25,50,75,100],'#e8731a','target','#1f6feb',360):'<div style="height:300px;display:flex;align-items:center;justify-content:center;color:#8893a4">체력 데이터 없음<br>(검사 입력 시 5축 레이더 표시)</div>';
    var weakAx=(hpa.axes||[]).filter(function(a){return a.key!=='upper_power'&&a.score!=null&&a.score<100;}).sort(function(a,b){return a.score-b.score;});
    var fitTrain = weakAx.length
      ? '<div class="train"><div class="train-h">체력 보강 — 스스로 할 수 있는 트레이닝</div>'
        + weakAx.map(function(a){ return HP_TRAIN[a.key] ? '<div class="train-i"><span class="tb">'+a.score+'점</span><span class="td">'+HP_TRAIN[a.key]+'</span></div>' : ''; }).join('')
        + '<div class="train-f">100점 = 엘리트 기준. 위 항목은 엘리트 미만이라 우선 보강 대상입니다. 통증이 있으면 중단하고 코치/트레이너와 상의하세요.</div></div>'
      : '<div class="note">체력 5개 축이 모두 엘리트 기준(100) 이상입니다 — 현재 루틴을 유지하세요.</div>';
    var mechAxes=_PH6.filter(function(p){return p.score!=null;}).map(function(p){return {label:p.name,score:p.score};});
    var mechRadar=mechAxes.length?radarSVG(mechAxes,100,[25,50,75,100],'#2563eb'):'<p>메카닉 데이터 없음</p>';
    // [2026-06-11] (정리) 구 '투구 사슬(chain/_S5)' 블록 제거 — 본문에 삽입되지 않던 죽은 코드였음.
    //   선수 PDF §②의 단계별 표시는 _efPhases(report.engine)→_drillSection(아래 '단계별 세부 점수')로 이미 5동작 렌더.

    var CSS='@page{size:A4;margin:13mm 12mm}*{box-sizing:border-box}'
      +"body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b2330;background:#fff;margin:0;font-size:13px;line-height:1.55}"
      +'.wrap{max-width:820px;margin:0 auto;padding:18px}h1{font-size:23px;margin:0 0 2px}.sub{color:#6b7787;font-size:13px;margin-bottom:14px}'
      +'h2{font-size:16px;margin:22px 0 8px;padding-bottom:5px;border-bottom:2px solid #e8731a;page-break-after:avoid}'
      +'.lead{color:#41506a;font-size:12.5px;margin:-2px 0 10px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}'
      +'.kpi{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;padding:9px 10px}.kpi-lbl{font-size:11px;color:#6b7787}.kpi-val{font-size:19px;font-weight:800}.kpi-val u{font-size:11px;color:#6b7787;font-weight:500;font-style:normal}.kpi-sub{font-size:11px;color:#41506a;margin-top:2px}'
      +'.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:center}.card{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:12px 14px;page-break-inside:avoid}'
      +'.bar-row{display:grid;grid-template-columns:84px 1fr 120px;gap:8px;align-items:center;margin:6px 0}.bar-lbl{font-size:11px;font-weight:600}.bar-track{position:relative;height:9px;background:#eef2f7;border-radius:5px}'
      +'.bar-zone{position:absolute;left:25%;right:25%;top:0;bottom:0;background:#d7e6ff;border-radius:3px}.bar-mark{position:absolute;top:-3px;width:5px;height:15px;border-radius:2px;transform:translateX(-2px)}'
      +'.bar-ax{display:flex;justify-content:space-between;font-size:11px;color:#8893a4;margin-top:2px}.bar-ax .mid{color:#41506a}.bar-val{font-size:11.5px;text-align:right}.bar-val u{font-size:11px;color:#8893a4;font-style:normal}.bar-na{font-size:11px;color:#8893a4;font-style:italic}'
      +'.ceil{display:grid;grid-template-columns:1fr 22px 1.1fr 22px 1.1fr;gap:6px;align-items:center;background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;padding:11px;margin-top:8px}.ceil .c{text-align:center}.ceil .lbl{font-size:11px;color:#6b7787;text-transform:uppercase}.ceil .v{font-size:19px;font-weight:800}.ceil .s{font-size:11px;color:#6b7787}.ceil .ar{text-align:center;color:#9aa7b8}'
      +'.note{font-size:11px;color:#6b7787;background:#f6f8fb;border-radius:6px;padding:8px 10px;margin-top:8px}'
      +'.ib-row{display:grid;grid-template-columns:64px 1fr 86px;gap:8px;align-items:center;margin:5px 0}.ib-l{font-size:11.5px;font-weight:600}.ib-track{position:relative;height:12px;background:#eef2f7;border-radius:6px;overflow:hidden}.ib-fill{position:absolute;left:0;top:0;bottom:0;border-radius:6px}.ib-neg{background:#e8a07a}.ib-pos{background:#7fc6a8}.ib-v{font-size:11px;font-weight:700;text-align:right}'
      +'.phase{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:11px 13px;margin:9px 0;page-break-inside:avoid}'
      +'.ph-sub{margin:8px 0 2px}.ph-sub-t{font-size:11px;font-weight:700;color:#41506a;background:#eef2f7;padding:1px 8px;border-radius:4px;display:inline-block}'
      +'.ph-h{display:flex;align-items:center;gap:8px;margin-bottom:3px}.ph-h b{font-size:14px;flex:1}.ph-sc{color:#fff;font-weight:800;font-size:12px;border-radius:6px;padding:2px 9px}'
      +'.ph-what{font-size:12px;color:#41506a;margin:2px 0 8px}.ph-cue{font-size:11.5px;color:#1a7f5a;background:#e7f7ef;border-radius:6px;padding:6px 9px;margin-top:8px}'
      +'.diag{font-size:12px;color:#2a3547;background:#f8fafc;border-radius:6px;padding:7px 10px;margin-top:7px;line-height:1.6}'
      +'.imp{font-size:11px;font-weight:700;border-radius:5px;padding:1px 7px}.imp-lo{background:#fbe7dd;color:#c0612b}.imp-hi{background:#e3f6ec;color:#1a7f5a}.imp-0{background:#eef2f7;color:#8893a4}'
      +'.ev-table{width:100%;border-collapse:collapse;font-size:11px}.ev-table th,.ev-table td{padding:4px 6px;border-bottom:1px solid #eef2f7;text-align:right}.ev-table thead th{color:#8893a4;font-size:11px;text-transform:uppercase}.ev-table .evl{text-align:left;font-weight:600;color:#1b2330}'
      +'.seqgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:12px;align-items:center}.seqkpi{display:flex;flex-direction:column;gap:6px}.sk{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:7px;padding:6px 9px}.sk-l{font-size:11px;color:#6b7787}.sk-v{font-size:17px;font-weight:800}.sk-v u{font-size:11px;color:#8893a4;font-style:normal;font-weight:500}'
      +'.legend{font-size:11px;color:#6b7787;text-align:center;margin-top:4px}.legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin:0 3px}'
      +'.pri{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.pri li{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;padding:9px 12px;page-break-inside:avoid}.pri-h{font-size:13.5px}.pri-sc{font-size:11px;font-weight:800;color:#e8731a;margin-left:6px}.pri-v{font-size:12px;color:#41506a;margin-top:2px}'
      +'.train{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:12px 14px;margin-top:10px}.train-h{font-weight:700;font-size:13px;margin-bottom:6px}.train-i{display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-top:1px solid #eef2f7}.train-i:first-of-type{border-top:0}.tb{flex:none;background:#fbe7dd;color:#c0612b;font-weight:800;font-size:11px;border-radius:6px;padding:2px 8px;min-width:40px;text-align:center}.td{font-size:12px;color:#2a3547;line-height:1.55}.train-f{font-size:11px;color:#8893a4;margin-top:8px}'
      +'.pri-drill{font-size:11.5px;color:#1a7f5a;background:#e7f7ef;border-radius:6px;padding:6px 9px;margin-top:6px}'
      +'.qgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}.qk{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;padding:7px 9px}.qk-l{font-size:11px;color:#6b7787}.qk-v{font-size:17px;font-weight:800}.qk-v u{font-size:11px;color:#8893a4;font-style:normal;font-weight:500;margin-left:2px}'
      +'html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      +'@media print{.noprint{display:none} *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important} @page{margin:10mm}'
        +' .card,.phase,.two,.train,.train-i,.kpi,.kpis,.qgrid,.qk,.seqgrid,.ceil,.note,.ib-row,.bar-row,.pri li,table,img,svg,canvas{break-inside:avoid;page-break-inside:avoid}'
        +' h1,h2,h3,.ph-h,.train-h{break-after:avoid;page-break-after:avoid}}'
      +'.pr-topbar{position:fixed;left:0;right:0;top:0;z-index:90;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;pointer-events:none}'
      +'.pr-topbar .noprint{pointer-events:auto}'
      +'.dashbackbtn{background:#fff;color:#1b2330;border:1px solid #c5d0de;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.1);font-family:inherit}'
      +'.dashbackbtn:hover{border-color:#1f6feb;color:#1f6feb}'
      +'.pdfbtn{background:#e8731a;color:#fff;border:none;border-radius:8px;padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.18);font-family:inherit}'
      +'body{padding-top:52px}'
      /* [2026-07-19 리포트 개선] 목업 라이트 토큰 + 헤더/오늘의핵심/에너지흐름 6정거장 */
      +':root{--r-ink:#1A2233;--r-ink2:#3B475E;--r-muted:#68748C;--r-faint:#93A0B5;--r-line:#E4E9F1;--r-panel:#F7F9FC;--r-teal:#12907F;--r-good:#149467;--r-warn:#B07A12;--r-bad:#CE4A3C}'
      +'.eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;color:var(--r-teal);text-transform:uppercase;margin-bottom:4px}'
      +'.rhead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid var(--r-line);padding-bottom:12px;margin-bottom:6px}'
      +'.rhead h1{font-size:26px;margin:0;color:var(--r-ink)}.rhead .rtag{font-size:14px;font-weight:600;color:var(--r-muted);margin-left:8px}'
      +'.rhead .rsub{font-size:12px;color:var(--r-muted);margin-top:5px}'
      +'.velo-big{text-align:right;white-space:nowrap}.velo-big .vl{font-size:11px;color:var(--r-muted);letter-spacing:.04em}.velo-big .vv{font-size:34px;font-weight:800;color:var(--r-ink);line-height:1.05}.velo-big .vu{font-size:13px;color:var(--r-muted);font-weight:600;margin-left:2px}'
      +'.keybox{background:var(--r-panel);border-left:4px solid var(--r-teal);border-radius:8px;padding:12px 16px;margin:14px 0 18px}.keybox .kh{font-size:11px;font-weight:800;color:var(--r-teal);margin-bottom:4px}.keybox .kt{font-size:13.5px;color:var(--r-ink2);line-height:1.6}'
      +'.sec-h{font-size:15px;font-weight:800;color:var(--r-ink);margin:18px 0 9px}.sec-h .sh-sub{font-size:12px;font-weight:500;color:var(--r-muted);margin-left:8px}'
      +'.eflow{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}'
      +'.eflow-st{background:var(--r-panel);border:1px solid var(--r-line);border-top:3px solid var(--stc,var(--r-teal));border-radius:9px;padding:11px 8px 12px;text-align:center;page-break-inside:avoid}'
      +'.eflow-n{font-size:12px;font-weight:800;color:var(--r-faint)}.eflow-name{font-size:12.5px;font-weight:700;color:var(--r-ink);margin:3px 0 8px}'
      +'.eflow-pill{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;padding:2px 11px}'
      +'.eflow-pill.good{background:rgba(20,148,103,.12);color:var(--r-good)}.eflow-pill.warn{background:rgba(176,122,18,.15);color:var(--r-warn)}.eflow-pill.bad{background:rgba(206,74,60,.12);color:var(--r-bad)}'
      +'.rtiles{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}'
      +'.rtile{background:var(--r-panel);border:1px solid var(--r-line);border-top:2px solid var(--r-teal);border-radius:9px;padding:10px 11px;page-break-inside:avoid}.rtile .rl{font-size:11px;color:var(--r-muted)}.rtile .rv{font-size:21px;font-weight:800;color:var(--r-ink);line-height:1.1;margin-top:2px}.rtile .rv u{font-size:11px;color:var(--r-muted);font-weight:600;font-style:normal;margin-left:2px}.rtile .rs{font-size:10.5px;color:var(--r-faint);margin-top:2px}'
      +'.issue{background:var(--r-panel);border:1px solid var(--r-line);border-left:4px solid var(--isc,var(--r-teal));border-radius:9px;padding:12px 15px;margin:10px 0;page-break-inside:avoid}'
      +'.issue-top{display:flex;align-items:center;gap:9px;margin-bottom:8px}.issue-badge{flex:none;width:22px;height:22px;border-radius:50%;background:var(--isc,var(--r-teal));color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}'
      +'.issue-title{flex:1;font-size:14px;font-weight:700;color:var(--r-ink)}.issue-stage{flex:none;font-size:11px;font-weight:700;color:var(--isc,var(--r-teal));background:var(--r-panel2);border:1px solid var(--r-line);border-radius:999px;padding:2px 10px}'
      +'.issue-row{display:flex;gap:10px;font-size:12px;line-height:1.5;margin:3px 0}.issue-row .k{flex:none;width:66px;font-size:11px;font-weight:700;color:var(--r-faint)}.issue-row .v{flex:1;color:var(--r-ink2)}'
      +'.vsec{background:var(--r-panel);border:1px solid var(--r-line);border-radius:10px;padding:14px 16px;margin-top:4px;page-break-inside:avoid}.vsec .vsub{font-size:12px;color:var(--r-muted);margin-bottom:13px;line-height:1.55}'
      +'.vbars{display:grid;grid-template-columns:1fr 1fr;gap:11px 24px}.vbar{display:grid;grid-template-columns:96px 1fr 42px;gap:9px;align-items:center}'
      +'.vbar-lbl{font-size:12px;font-weight:700;color:var(--r-ink);line-height:1.2}.vbar-u{font-size:10px;color:var(--r-faint)}'
      +'.vbar-track{position:relative;height:9px;background:var(--r-panel2);border-radius:5px}.vbar-fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.vbar-tick{position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:var(--r-faint);opacity:.55}'
      +'.vbar-rank{font-size:11px;font-weight:800;text-align:right}'
      +'.rfoot{font-size:11px;color:var(--r-muted);line-height:1.6;border-top:1px solid var(--r-line);padding-top:10px;margin-top:20px}';
    var DASH_BACK_SCRIPT = '<script>function bmBackToDashboard(){try{if(window.opener&&!window.opener.closed){window.opener.focus();window.close();return;}}catch(e){}var u=null;try{u=sessionStorage.getItem("bm_dash_return");}catch(e2){}if(u){location.href=u;return;}alert("대시보드 탭을 직접 선택하거나, 대시보드를 다시 열어 주세요.");}<\/script>';
    var DASH_BACK_BAR = '<div class="pr-topbar noprint"><button type="button" class="dashbackbtn" onclick="bmBackToDashboard()">← 대시보드로</button>'
      +'<button type="button" class="pdfbtn" onclick="window.print()">PDF로 저장 / 인쇄</button></div>';

    // Top3 (5단계 전 변인 중 최약)
    var mets=[]; _phStages.forEach(function(st){ if(st.key==='consistency') return; (st.metrics||[]).forEach(function(mt){ var p=(typeof _bmPctl==='function')?_bmPctl(mt):null; if(mt.value!=null&&p!=null) mets.push(Object.assign({},mt,{stageLabel:_phClean(st),_pctl:p})); }); });
    mets.sort(function(a,b){return a._pctl-b._pctl;});
    var pri=mets.slice(0,3).map(function(mt,i){
      return '<li><div class="pri-h"><b>'+(i+1)+'. '+((typeof _ezLabel==='function')?_ezLabel(mt.label):mt.label)+'</b> <span class="pri-sc">'+mt._pctl+' 백분위</span></div>'
        +'<div class="pri-v">'+mt.stageLabel+' 단계 · 현재 <b>'+_f(mt.value)+(mt.unit||'')+'</b></div>'
        +_bmBarRow(mt)
        +'<div class="pri-drill"><b>교정 드릴</b> '+(PHASE_DRILL[mt.key]||'발→골반→몸통→팔 시퀀스 점프 + 메디신볼 회전 던지기로 운동사슬 타이밍·전달을 끌어올리기')+'</div></li>'; }).join('');

    // ── 세 축 진단 (체력 · 메카닉 출력 · 메카닉 효율 → 결과 + 팔부하) [2026-05-28]
    //   체격·체력이 메카닉 점수에 섞이는 문제(SJ JH↔eff r=-0.55) 회피 위해 체력을 별도 축으로 분리.
    //   체력=hpa.overall_score(0~100, 145km/h+ 엘리트 기준) · 출력=생성노드 평균 · 효율=전달노드 평균.
    //   [2026-05-28 재보정] pelvistrunk 임계값 재조정(gap 30/60 작을수록 좋음, etdiag.js) + trunkarm 효율 트랙에서 제거 → 팔 부하 플래그 전용.
    //   새 효율 종합 ↔ 구속 r=+0.54 (n=34, 검증 완료).
    var _threeAxis=(function(){
      if(!ET||!ET.stages||!ET.stages.length) return null;
      var SM={}; ET.stages.forEach(function(s){ SM[s.key]={sc:s.score,status:s.status,label:s.label}; });
      function avg(ks){ var v=ks.map(function(k){return SM[k]&&SM[k].sc;}).filter(function(x){return x!=null&&isFinite(x);}); return v.length?v.reduce(function(a,b){return a+b;},0)/v.length:null; }
      // [2026-05-28 재보정] trunkarm 제거(↔구속 r=+0.09, ↔몸통ME r=-0.20로 효율 신호 아님) → 팔 부하 플래그 전용으로 이전.
      // pelvistrunk는 etdiag.js에서 임계값 재보정됨(gap 작을수록 좋음 30/60 + gain 안전망).
      var GEN=['stride','blocking','trunk'], TR=['knee','pelvistrunk','xftiming'], STORE=['windup'];
      var outSc=avg(GEN), effSc=avg(TR), storeSc=avg(STORE), fitSc=(hpa&&hpa.overall_score!=null&&isFinite(hpa.overall_score))?hpa.overall_score:null;
      if(outSc==null&&effSc==null&&fitSc==null) return null;
      var OUT_BL=[53.3,55.7,57.3,58,59,59.7,60.3,61.3,62,62.7,62.7,63,63.3,63.7,63.7,64,65.7,66,66.3,66.3,67,68,70,71.3,71.7,72.3,73.3,73.7,73.7,75.7,76.3,77.7,78.3,82.7];
      var EFF_BL=[53.0,53.5,58.2,58.2,58.8,60.0,60.3,63.5,64.8,65.2,66.2,66.7,69.8,69.8,70.2,70.5,70.7,71.2,71.2,72.5,72.8,73.7,74.8,75.5,76.0,76.0,76.3,77.0,77.3,78.0,79.0,80.0,81.0,85.3];
      var VELO_BL=[110.4,110.6,118.9,119,121,122.3,127.6,128.4,128.5,129.1,129.2,129.2,133.7,134.7,134.8,138.2,138.4,139.6,140.1,140.1,140.8,140.9,141.2,141.5,141.9,143,143.5,144.7,144.7,145.6,146.3,147.7,148.2,150];
      function pct(arr,v){ if(v==null||!isFinite(v))return null; var c=0; for(var i=0;i<arr.length;i++) if(arr[i]<v)c++; return Math.round(100*c/arr.length); }
      var outPct=pct(OUT_BL,outSc), effPct=pct(EFF_BL,effSc), veloPct=pct(VELO_BL, vs&&vs.max_kmh);
      // 우선과제 = 세 점수 중 최저(같은 0~100 스케일 가정). 체력은 hpa.overall_score, 출력·효율은 ETDIAG 점수.
      var axes=[];
      /* [2026-06-20] 우선과제 비교를 퍼센타일로 통일(혼합 0~100 점수→동일 프레임): 체력=Driveline %ile·출력/효율=baseline %ile. 표시와 정합. */
      if(fitSc!=null) axes.push({k:'fit',sc:((hpa&&hpa.overall_norm_pct!=null)?hpa.overall_norm_pct:fitSc),nm:'체력'});
      if(outSc!=null) axes.push({k:'out',sc:(outPct!=null?outPct:outSc),nm:'메카닉 출력'});
      if(effSc!=null) axes.push({k:'eff',sc:(effPct!=null?effPct:effSc),nm:'메카닉 효율'});
      axes.sort(function(a,b){return a.sc-b.sc;});
      var prio=axes.length?axes[0]:null;
      var typLabel={fit:{t:'체력 1순위 과제형',d:'근력·파워 강화가 가장 큰 개선 여지입니다(웨이트·플라이오메트릭).',c:'#c0612b',b:'#fbe9ea'},
                    out:{t:'생성 메카닉 1순위 과제형',d:'에너지 생성 단계(스트라이드·블로킹·몸통) 메카닉이 1순위 개선 영역입니다.',c:'#c5740f',b:'#fff1e3'},
                    eff:{t:'전달 메카닉 1순위 과제형',d:'시퀀싱·전달 품질(무릎·골반-몸통-팔·타이밍)이 1순위 개선 영역입니다.',c:'#1f7a4d',b:'#e9f6ef'}};
      // 셋 다 70 이상이면 균형형
      var allGood=axes.length>=2 && axes.every(function(a){return a.sc>=70;});
      var typ=allGood?{t:'균형형(완성단계)',d:'세 축 모두 양호 — 현 패턴 유지 + 미세 보완.',c:'#1f7a4d',b:'#e9f6ef'}:(prio?typLabel[prio.k]:null);
      function worst(ks){ return ks.map(function(k){return {k:k,sc:SM[k]&&SM[k].sc};}).filter(function(x){return x.sc!=null&&isFinite(x.sc);}).sort(function(a,b){return a.sc-b.sc;}); }
      var fitWeak=null;
      if(hpa&&hpa.axes){ var wa=hpa.axes.filter(function(a){return a.key!=='upper_power'&&a.score!=null;}).sort(function(a,b){return a.score-b.score;}); if(wa.length) fitWeak=wa[0]; }
      return { fitSc:fitSc, outSc:outSc, effSc:effSc, storeSc:storeSc, outPct:outPct, effPct:effPct, veloPct:veloPct, typ:typ, prio:prio,
        fitWeak:fitWeak, storeWorst:worst(STORE).slice(0,1), genWorst:worst(GEN).slice(0,1), effWorst:worst(TR).slice(0,3), armLoad:ET.injuryLoad||null };
    })();
    function _ttDrill(k){ return STAGE_DRILL[k]||''; }
    function _ttName(k){ return (STAGE_EZ[k]||[k,''])[0]; }
    // [2026-05-28] 체력 축은 ① 체력 섹션에서 이미 다루므로 메카닉 직속 진단은 2축(출력+효율)로 축소.
    //   2축 유형: 출력↔효율 점수 차로 판정(±10 임계). 둘 다 70+ 시 균형형.
    // [3축 진단·5단계] 저장·생성·효율 — 5동작단계 카테고리 평균.
    var _3ax6=[{cat:'store',nm:'저장',sc:_AX6.store,col:'#7048e8',role:'와인드업에서 탄성을 저장'},
               {cat:'gen',nm:'생성',sc:_AX6.gen,col:'#2563eb',role:'드라이브·몸통에서 에너지 생성'},
               {cat:'transfer',nm:'효율',sc:_AX6.transfer,col:'#1f9d58',role:'블로킹·팔로 손실 없이 전달'}].filter(function(a){return a.sc!=null;});
    var _3typ6=(function(){ if(!_3ax6.length) return null;
      if(_3ax6.length>=2 && _3ax6.every(function(a){return a.sc>=70;})) return {t:'균형형(완성단계)',c:'#1f7a4d'};
      var lo=_3ax6.slice().sort(function(a,b){return a.sc-b.sc;})[0]; return {t:lo.nm+' 1순위 과제형',c:lo.col}; })();
    var _axCol6=function(a,last){ var w=_worst6(a.cat);
      return '<div style="padding:13px 14px;'+(last?'':'border-right:1px solid #e3e7ec')+'">'
      +'<div style="font-size:13px;font-weight:800;color:'+a.col+';margin-bottom:6px">'+a.nm+'</div>'
      +'<div style="font-size:12px;color:#6b7684">점수 <b style="color:#1b2330">'+(a.sc!=null?a.sc:'—')+'</b><span style="color:#9aa7b8"> /100</span></div>'
      +'<div style="height:10px;background:#eef1f4;border-radius:6px;overflow:hidden;margin-top:4px"><div style="height:100%;background:'+a.col+';width:'+(a.sc||0)+'%"></div></div>'
      +(w?'<div style="margin-top:10px;font-size:11.5px"><b style="color:'+a.col+'">약한 곳</b><div style="margin-top:3px"><b>'+esc(w.name)+'</b> '+w.score+'점</div></div>':'')
      +'<div style="margin-top:8px;font-size:11px;color:#6b7787">'+a.role+'</div></div>'; };
    var threeAxisHTML = (!_3ax6.length) ? '' :
      '<div class="card" style="padding:0;overflow:hidden;margin-bottom:10px">'
      +'<div style="padding:9px 14px;background:#f6f8fb;border-bottom:1px solid #e3e7ec;display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">'
      +'<div style="font-size:13px;font-weight:800">메카닉 3축 진단 — 저장 · 생성 · 효율</div>'
      +(_3typ6?'<span style="font-size:11.5px;font-weight:800;color:'+_3typ6.c+';padding:2px 8px;border:1px solid '+_3typ6.c+';border-radius:12px">유형: '+_3typ6.t+'</span>':'')
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr">'
      +_3ax6.map(function(a,i){return _axCol6(a,i===_3ax6.length-1);}).join('')
      +'</div>'
      +'<div style="padding:9px 14px;border-top:1px solid #e3e7ec;background:#f8f9fb;font-size:12px"><b>결과</b> 최고 구속 '+(vs&&vs.max_kmh!=null?_f(vs.max_kmh):'—')+' km/h</div>'
      +'<div class="note" style="font-size:11px;margin:8px 14px 12px">5단계 평가 기준 — 저장=와인드업, 생성=드라이브·몸통 평균, 효율=블로킹·팔 평균(앞무릎은 블로킹 내). 분석용 리포트와 동일합니다. 구속 예보가 아니라 개선 방향 지표입니다.</div>'
      +'</div>';
    // 투수 5단계 그림(점수 마커) + 6각 레이더 + 평가
    var _KIMG=(typeof _KSTRIP_URI!=='undefined')?_KSTRIP_URI:'';
    var _BMC={good:'#46c98c',warn:'#e8954e',bad:'#e24b4a'};
    var _smooth6=function(pts){ if(!pts.length) return ''; var d='M'+pts[0].x+' '+pts[0].y; for(var i=0;i<pts.length-1;i++){var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;var c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6,c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;d+=' C'+c1x.toFixed(1)+' '+c1y.toFixed(1)+' '+c2x.toFixed(1)+' '+c2y.toFixed(1)+' '+p2.x.toFixed(1)+' '+p2.y.toFixed(1);} return d; };
    var _wBM=_worstAll6();
    var _pts6=_PH6.map(function(p,i){return _BM_NODES6[i];}).filter(function(n){return n;});
    var _flowPath=_smooth6(_pts6);
    var _figMarks=_PH6.map(function(p,i){ var nd=_BM_NODES6[i]; if(!nd||p.score==null) return '';
      var c=_BMC[p.status]||'#e8954e', sym=(p.status==='good'?'●':p.status==='warn'?'◐':'▲');
      var left=(nd.x/1200*100).toFixed(2), top=(nd.y/512*100).toFixed(2), isW=_wBM&&p.key===_wBM.key;
      return '<div style="position:absolute;left:'+left+'%;top:'+top+'%;transform:translate(-50%,-50%);z-index:2">'
        +(isW?'<div style="position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;background:#e24b4a;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;box-shadow:0 2px 6px rgba(0,0,0,.4)">▲ 병목</div>':'')
        +'<div style="width:32px;height:32px;border-radius:50%;background:rgba(14,18,24,.9);border:3px solid '+c+';box-shadow:0 2px 6px rgba(0,0,0,.35)'+(p.status==='bad'?', 0 0 0 4px rgba(226,75,74,.18)':'')+';display:flex;align-items:center;justify-content:center;color:'+c+';font-size:14px;font-weight:800;margin:0 auto">'+p.n+'</div>'
        +'<div style="position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;background:rgba(14,18,24,.92);border:1px solid '+c+'66;border-radius:7px;padding:2px 7px;text-align:center"><div style="font-size:10.5px;font-weight:700;color:#e8edf4;line-height:1.25">'+esc(p.name)+'</div><div style="font-size:12px;font-weight:800;color:'+c+';line-height:1.15">'+sym+' '+p.score+'</div></div>'
        +'</div>'; }).join('');
    var _figLegend='<div style="display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:11px">'+[['#46c98c','●','양호'],['#e8954e','◐','주의'],['#e24b4a','▲','누수']].map(function(t){return '<span style="color:'+t[0]+';font-weight:700">'+t[1]+' '+t[2]+'</span>';}).join('')+'</div>';
    var _figH=(_KIMG?'<div class="card" style="margin-bottom:10px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">신체 에너지 사슬 <span style="font-weight:500;color:#6b7787;font-size:11.5px">— 동작 시퀀스 좌→우 · 부위별 점수</span></div><div style="position:relative;width:100%;border-radius:8px;overflow:hidden;background:#eef1f4">'
        +'<img src="'+_KIMG+'" alt="투구 5단계" style="display:block;width:100%">'
        +'<svg viewBox="0 0 1200 512" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><path d="'+_flowPath+'" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round"/><path d="'+_flowPath+'" fill="none" stroke="#3f86cf" stroke-width="3.5" stroke-linecap="round"/></svg>'
        +_figMarks
        +'</div>'+_figLegend+'</div>':'');
    var _mechEval=(function(){ if(!_3ax6.length) return ''; var lo=_3ax6.slice().sort(function(a,b){return a.sc-b.sc;})[0]; var hi=_3ax6.slice().sort(function(a,b){return b.sc-a.sc;})[0]; var wa=_worstAll6(); return '<b>'+hi.nm+'</b>('+hi.sc+'점)은 상대적으로 잘 되고, <b style="color:'+lo.col+'">'+lo.nm+'</b>('+lo.sc+'점)이 가장 약합니다.'+(wa?' 5단계 중 <b>'+esc(wa.name)+'</b>('+wa.score+'점)이 핵심 누수입니다.':''); })();
    var _sc2=function(st){return st==='good'?'#2f9e44':st==='warn'?'#e8731a':'#c0612b';};
    var _pdfDet=(typeof _eliteDetail6==='function')?_eliteDetail6():null;
    var _drillH=_PH6.filter(function(p){return p.score!=null;}).map(function(p){ var c=_st6Col(p.status);
      var _it=(_pdfDet&&_pdfDet[p.key]&&_pdfDet[p.key].length)?_pdfDet[p.key]:(p.sub||[]).map(function(s){return {label:s.label,val:s.val,score:(s.score!=null?s.score:null),status:s.status,key:s.key};});  // [2026-06-01] _efPhases가 싣는 점수 사용(폴백도 점수 표시)
      var subs=_it.map(function(sb){ var sc=_sc2(sb.status);
        return '<div style="flex:0 1 calc(20% - 5px);min-width:94px;text-align:center;background:#f6f8fb;border:1px solid #e3e9f0;border-bottom:2px solid '+sc+';border-radius:8px;padding:7px 5px"><div style="font-size:9.5px;color:#6b7787;line-height:1.25;margin-bottom:4px;min-height:24px;overflow:hidden">'+esc((typeof _ezLabel==='function')?_ezLabel(sb.label):sb.label)+((typeof _varTagsHTML==='function')?_varTagsHTML(sb.key):'')+'</div><div style="font-size:12.5px;font-weight:800;color:#1b2330">'+esc(sb.val)+'</div>'+(sb.score!=null?'<div style="font-size:12.5px;font-weight:800;color:'+sc+'">'+sb.score+'점</div>':'')+'<div style="font-size:9px;font-weight:700;color:'+sc+';margin-top:1px">'+(sb.status==='good'?'● 양호':sb.status==='warn'?'◐ 주의':'▲ 누수')+'</div></div>';
      }).join('');
      return '<div class="card" style="margin-bottom:8px;page-break-inside:avoid"><div style="display:flex;align-items:center;gap:8px;margin-bottom:9px"><span style="width:20px;height:20px;border-radius:6px;background:'+c+'22;color:'+c+';display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">'+p.n+'</span><b style="font-size:13.5px">'+esc(p.name)+'</b> <span style="font-size:11.5px;font-weight:700;color:'+c+'">'+(p.status==='good'?'양호':p.status==='warn'?'주의':'누수')+' · '+p.score+'점</span></div><div style="display:flex;flex-wrap:wrap;gap:5px">'+subs+'</div></div>';
    }).join('');
    var _drillSection=_drillH?('<div style="margin-top:6px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">단계별 세부 점수 · 측정치</div><div class="lead" style="margin:-2px 0 8px">각 단계의 핵심 변인을 원인→과정→결과 순으로, 측정치와 진단(양호·주의·누수)을 함께 표시합니다.</div>'+_drillH+'</div>'):'';
    // 메카닉 점수 바로 다음 — 투수 에너지 흐름(골반→몸통→팔 ME) + 전달 종합 점수
    var _gmet=function(k){ var r=null; ((DATA.phases&&DATA.phases.stages)||[]).forEach(function(s){(s.metrics||[]).forEach(function(m){if(m.key===k)r=m;});}); return r; };
    var _extraSeq=[['vgrfPattern','바닥 미는 힘 유지 패턴'],['ppKneeTrunk','앞무릎 관절 파워·몸통 에너지 변화율 정점 시간차'],['ppTrunkHum','몸통·상완 에너지 변화율 정점 시간차'],['ppShoElb','어깨·팔꿈치 관절 파워 정점 시간차']].map(function(x){var m=_gmet(x[0]);return (m&&m.value!=null)?(x[1]+' <b>'+m.value+(m.unit||'')+'</b>'):'';}).filter(Boolean).join(' · ');
    var _extraLine=_extraSeq?'<div class="diag" style="background:#f6f7f9;font-size:11.5px;margin-top:6px"><b>추가 전달 지표(참고 · 코호트 위치, 우열 아님):</b> '+_extraSeq+' — 파워 정점 순서·타이밍과 앞발 수직힘 패턴(파워 기준은 속도 시퀀스와 다를 수 있음).</div>':'';
    var _energyFlowSection=(et&&(et.metrics||et.info))?('<div style="margin-top:12px"><div style="font-size:13px;font-weight:800;margin-bottom:6px">투수 에너지 흐름 <span style="font-weight:500;color:#7a8aa0">골반 → 몸통 → 팔 분절 에너지(ME) · 전달 종합</span></div>'+energyBlock(et,ss)+_extraLine+'</div>'):'';
    var mechFigH = _figH
      +'<div class="two" style="margin-bottom:10px"><div class="card">'+mechRadar+'<div class="legend">5단계 메카닉 점수</div></div>'
      +'<div class="card"><b>메카닉 흐름과 평가</b><div class="lead" style="margin-top:6px">'+_mechEval+'</div></div></div>';

    /* [2026-07-11] Driveline 방식 평가 섹션 — 리포트 전용 매핑(리포트 키 네임스페이스·byk+_bmPctl 백분위). ★격리: Uplift/BBL 미이식·Driveline 원시값 미사용·표시 전용(점수 산식 무변경). React 뷰어 DrivelineTab과 짝(뷰어 키와 일부 상이: comVelReductionFCBR→comDecel, whipRatio 부재→armTransferRatio·ppTrunkHum·ppShoElb). */
    var _drivelineSection=(function(){
      if(!_phStages||!_phStages.length) return '';
      var byk={}; _phStages.forEach(function(st){ if(st.key==='consistency')return; (st.metrics||[]).forEach(function(m){ if(m&&m.key)byk[m.key]=m; }); });
      var MODELS=[
        {en:'Posture',ko:'자세',rank:'Driveline 구속영향 1위',desc:'착지→릴리스 자세 유지 — 상하체 분리·몸통 열림·기울기',keys:['xfPeak','openAng','leanBack']},
        {en:'CoG',ko:'무게중심',rank:'Driveline 구속영향 4위',desc:'몸 전체 이동·감속',keys:['comDecel','comVel']},
        {en:'Rotation',ko:'회전',rank:'Driveline 구속영향 4위',desc:'몸통·골반 회전',keys:['torsoRotV','pelvisRotV']},
        {en:'Block',ko:'블록',rank:'Driveline 구속영향 5위',desc:'앞다리로 전방 운동량 차단·버팀',keys:['kneeExtROM','strideLen']},
        {en:'Arm Action',ko:'팔 동작',rank:'코킹·릴리스·방출',desc:'어깨 최대외회전·원위 전달(전달비·분절 파워)',keys:['merPk','armTransferRatio','ppTrunkHum','ppShoElb']}
      ];
      var anyRow=false;
      var cards=MODELS.map(function(mo){
        var pcs=mo.keys.map(function(k){ return byk[k]; }).filter(function(m){ return m&&!m.neutral; }).map(function(m){ return {m:m,p:_bmPctl(m)}; }).filter(function(x){ return x.p!=null; });
        var strong=pcs.filter(function(x){ return x.p>=67; }).length, weak=pcs.filter(function(x){ return x.p<=33; }).length;
        var vb = pcs.length===0 ? {t:'정보',c:'#8893a4'} : (weak>=1&&weak>=strong ? {t:'보강',c:'#c0612b'} : (weak===0&&strong>=1 ? {t:'강점',c:'#2f9e44'} : {t:'관찰',c:'#e8731a'}));
        if(pcs.length)anyRow=true;
        var rows=pcs.length?pcs.map(function(x){ var c=x.p>=67?'#2f9e44':(x.p<=33?'#c0612b':'#e8731a'), t=x.p>=67?'강점':(x.p<=33?'보강':'관찰'), nm=MET_KO[x.m.key]||((typeof _ezLabel==='function')?_ezLabel(x.m.label):x.m.label);
          return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 0;border-top:1px solid #eef2f7"><span style="font-size:12.5px;color:#2a3547">'+esc(nm)+'</span><span style="display:flex;gap:9px;align-items:baseline"><span style="font-size:12px;color:#41506a">'+_f(x.m.value)+(x.m.unit||'')+'</span><span style="font-size:11px;font-weight:700;color:'+c+'">'+x.p+'p · '+t+'</span></span></div>';
        }).join(''):'<div style="font-size:11.5px;color:#8893a4;padding:3px 0">이 측정엔 해당 모델 변인이 없습니다.</div>';
        return '<div style="border:1px solid #e3e9f0;border-left:4px solid '+vb.c+';border-radius:9px;padding:10px 13px;margin-bottom:8px;page-break-inside:avoid"><div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:14px">'+mo.en+'</b> <span style="font-size:11.5px;color:#6b7787">'+mo.ko+'</span><span style="margin-left:auto;font-size:11px;font-weight:700;color:'+vb.c+';border:1px solid '+vb.c+'66;border-radius:20px;padding:1px 10px">'+vb.t+'</span></div><div style="font-size:10.5px;color:#b7860b;margin-top:1px">'+mo.rank+'</div><div style="font-size:11.5px;color:#6b7787;margin:2px 0 4px">'+mo.desc+'</div>'+rows+'</div>';
      }).join('');
      if(!anyRow) return '';
      return '<div class="card" style="margin-bottom:10px;page-break-inside:avoid"><b>Driveline 방식 평가 <span style="font-size:12px;color:#6b7787;font-weight:400">Mechanical Composite · 5모델 매핑</span></b>'
        +'<div class="lead" style="margin:4px 0 8px">Driveline 역학 복합 평가(Posture·CoG·Rotation·Block·Arm Action) 틀을 우리 테이아 변인·코호트 백분위로 매핑했습니다. 강점(≥67p)·관찰·보강(≤33p) 방향으로 읽으며, 점수 산식은 바뀌지 않습니다. Driveline 원시 점수·엘리트 값은 좌표계가 달라 그대로 비교하지 않고 순위·방향만 봅니다(Est. Ceiling·Per 1mph는 개념만).</div>'
        +cards+'</div>';
    })();

    // [2026-07-19 리포트 개선] 목업 상단 헬퍼 (표시전용·판정권 무관)
    var _stageCol=function(cat){return cat==='store'?'#7048E8':(cat==='gen'?'#2563EB':(cat==='transfer'?'#12907F':'#C97E2E'));};
    var _handLabel=(function(){var h=(player.hand||player.handedness||(DATA.handedness_check&&DATA.handedness_check.hand)||'').toString().toUpperCase();return h.indexOf('L')===0?'좌완':(h.indexOf('R')===0?'우완':(h||''));})();
    var _pitchN=(vs.n||cmd.n||(DATA.trials?DATA.trials.length:null)||null);
    var _eflowStrip='<div class="eflow">'+_PH6.map(function(p){var sw=(p.status==='good'?'양호':(p.status==='bad'?'결함':'주의'));return '<div class="eflow-st" style="--stc:'+_stageCol(p.cat)+'"><div class="eflow-n">'+p.n+'</div><div class="eflow-name">'+esc(p.name)+'</div><span class="eflow-pill '+p.status+'">'+sw+'</span></div>';}).join('')+'</div>';
    var _rheadSub=esc(testDate)+' 측정'+(_handLabel?' · '+_handLabel:'')+(_pitchN!=null?' · 투구 '+_pitchN:'')+' · 정밀 마커리스 동작';
    var _rtile=function(l,v,u,s){var e=(v==null||v==='');return '<div class="rtile"><div class="rl">'+l+'</div><div class="rv">'+(e?'—':v)+((u&&!e)?'<u>'+u+'</u>':'')+'</div>'+(s?'<div class="rs">'+s+'</div>':'')+'</div>';};
    var _rtiles='<div class="rtiles">'+_rtile('구속 최고',(vs.max_kmh!=null?_f(vs.max_kmh):null),'km/h','평균 '+(vs.avg_kmh!=null?_f(vs.avg_kmh):'—'))+_rtile('회전수',(vs.avg_spin!=null?vs.avg_spin:null),'rpm','평균 spin')+_rtile('회전효율',(vs.avg_eff!=null?vs.avg_eff:null),'%','Active Spin')+_rtile('회전축',(vs.spin_dir||null),'시','변화 방향')+_rtile('구종',(vs.pitch_types?Object.keys(vs.pitch_types).length:null),'종',(vs.n||0)+'구 측정')+'</div>';
    // 핵심 문제 카드 (FEEDBACK_SUMMARY.keyIssues 직결 · 판정권 무관·표시전용)
    var _keyIssuesSection=(function(){
      var _FS=(typeof FEEDBACK_SUMMARY!=='undefined'&&FEEDBACK_SUMMARY)||(typeof feedbackSummary!=='undefined'&&typeof feedbackSummary==='object'&&feedbackSummary)||null;
      var ki=(_FS&&_FS.keyIssues)||null; if(!ki||!ki.length)return '';
      var PC={windup:'store',stride:'gen',drive:'gen',block:'transfer',blocking:'transfer',knee:'transfer',trunk:'gen',arm:'transfer',armball:'transfer'};
      var cards=ki.slice(0,2).map(function(k,i){
        var col=_stageCol(PC[k.phase]||'gen'), rows='';
        if(k.eventWindow&&k.eventWindow.label) rows+='<div class="issue-row"><span class="k">구간</span><span class="v">'+esc(k.eventWindow.label)+'</span></div>';
        if(k.why) rows+='<div class="issue-row"><span class="k">왜</span><span class="v">'+esc(k.why)+'</span></div>';
        if(k.downstreamImpact) rows+='<div class="issue-row"><span class="k">다음 단계</span><span class="v">'+esc(k.downstreamImpact)+'</span></div>';
        var rm=(k.relatedMetricsKo&&k.relatedMetricsKo.length)?k.relatedMetricsKo.join(' · '):((k.relatedMetrics&&k.relatedMetrics.length)?k.relatedMetrics.join(' · '):'');
        if(rm) rows+='<div class="issue-row"><span class="k">관련 지표</span><span class="v">'+esc(rm)+'</span></div>';
        return '<div class="issue" style="--isc:'+col+'"><div class="issue-top"><span class="issue-badge">'+(i+1)+'</span><span class="issue-title">'+esc(k.title||k.problem||'')+'</span>'+(k.phaseLabel?'<span class="issue-stage">'+esc(k.phaseLabel)+'</span>':'')+'</div>'+rows+'</div>';
      }).join('');
      return '<div class="sec-h">핵심 문제 <span class="sh-sub">최대 2개 · 오늘 집중</span></div>'+cards;
    })();
    // 체력 VALD 막대 (규준 대비 · 표시전용·판정권 무관) — hp_assessment.axes 직결
    var _valdBars=(function(){
      var ax=(hpa.axes||[]).filter(function(a){return a.key!=='upper_power';});
      if(!ax.length)return '<div class="note">체력(VALD) 측정 데이터 없음 — 검사 입력 시 규준 대비 막대로 표시됩니다.</div>';
      var tier=function(p){return p==null?['—','var(--r-faint)']:(p<34?['하위','var(--r-bad)']:(p<67?['중위','#C97E2E']:['상위','var(--r-good)']));};
      return '<div class="vbars">'+ax.map(function(a){
        var pct=(a.norm_pct!=null?a.norm_pct:(a.score!=null?a.score:null)), t=tier(pct), w=(pct!=null?Math.max(3,Math.min(100,pct)):0);
        var sub=(a.sub_kr||a.sub||a.test||a.axis||'');
        return '<div class="vbar"><div><div class="vbar-lbl">'+esc(a.label_kr||a.axis||'')+'</div>'+(sub?'<div class="vbar-u">'+esc(sub)+'</div>':'')+'</div><div class="vbar-track"><div class="vbar-fill" style="width:'+w.toFixed(0)+'%;background:'+t[1]+'"></div><div class="vbar-tick"></div></div><div class="vbar-rank" style="color:'+t[1]+'">'+t[0]+'</div></div>';
      }).join('')+'</div>';
    })();
    var _rfootnote='<div class="rfoot"><b>해석 한계 · 반증 고려</b><br>'
      +'· 에너지 흐름 = 병목·방향 진단이며 전달량·개인 인과가 아님. 구속 관계는 미검증 꼬리표(측정계 차이·본 데이터 재확인 전 인과 단정 금지).<br>'
      +'· 종합 점수를 쓰지 않고 단계별 역할로 봄. 규준은 수동 발행이며 코호트 값 범위 겹침 확인 후 백분위 해석.<br>'
      +'· 측정 출처·가용성은 위 「측정 기준」 표 참조(채널별·실제 데이터 유무). 상세 근거(이벤트·시간창·시행별 파형·자료 품질·대안 해석)는 대시보드 분석 모드 「근거 작업대」에서 확인.</div>';
    /* [2026-08-14 ③ R-P1-3·Codex P1-3] B형 확대: 측정기준·단계별 변인표·연구자 판정(localStorage)·해석 한계. 가용 데이터만·없는 값(이벤트/필터 파라미터/per-metric 반증)은 근거 작업대로 안내. */
    var _bResearch = (_AUD!=="B") ? "" : (function(){
      var _mh='style="font-weight:800;font-size:12.5px;margin:2px 0 6px;color:#2a3550"';
      /* [2026-08-14 C-P0-2] provenance: 채널→장비 고정(시스템 설계·지표키 추정 아님)·가용성만 실제 데이터 유무. 구속·구질=Rapsodo(velo_summary), 체력=VALD(hp_assessment), 동작=Theia. 지면반력은 세션별(단계 변인표 자료없음 표기 참조). */
      var _pvVelo=!!(vs && (vs.n||0) > 0);
      var _pvFit=!!(hpa && (hpa.overall_score != null || (hpa.axes && hpa.axes.length)));
      /* [2026-08-14 FR-3] 지면반력 가용성 SSOT: 명시 flag → trial.grf(fp1/fp2 peak) 실측 유무. korea 등 미측정 세션은 false. */ var _pvGrf=(function(){ if(DATA.grf_available===true) return true; if(DATA.grf_available===false) return false; try{ return (DATA.trials||[]).some(function(t){ var g=t&&t.grf; return !!(g&&((g.fp1&&g.fp1.peak_z_pct_bw!=null)||(g.fp2&&g.fp2.peak_z_pct_bw!=null))); }); }catch(e){ return false; } })();
      var _basis='<div class="sec-h">연구자 참고 <span class="sh-sub">B형 · 내부용 · 선수·코치용(A형)에는 표시 안 함</span></div>'
        +'<div class="card"><div '+_mh+'>측정 기준 · 원자료 <span class="sh-sub">채널별 출처 · 실제 가용성</span></div><table class="ev-table"><tbody>'
        +'<tr><th class="evl">동작·메카닉</th><td>'+esc(DATA.system||"Theia")+'(마커리스 광학)</td></tr>'
        +'<tr><th class="evl">구속·구질</th><td>'+(_pvVelo?'Rapsodo':'해당 측정 없음')+'</td></tr>'
        +'<tr><th class="evl">체력</th><td>'+(_pvFit?'VALD':'해당 측정 없음')+'</td></tr>'
        +'<tr><th class="evl">지면반력</th><td>'+(_pvGrf?'force plate 실측':'해당 측정 없음')+'</td></tr>'
        +'<tr><th class="evl">사용 시행 수</th><td>'+((DATA.trials||[]).length)+' 구</td></tr>'
        +'<tr><th class="evl">대표 시행</th><td>'+(DATA.best_trial_index||1)+' 번</td></tr>'
        +'</tbody></table>'
        +(_pvFit?('<div class="lead" style="margin-top:6px">체력(VALD) 자료가 있어 하체 출력·코어 안정성이 특정 단계 결함과 <b>연결될 가능성</b>을 함께 검토합니다(개인 인과 단정 아님 · 영상·재측정으로 확인).</div>'):'')
        +'</div>';
      var _rows='';
      _phStages.forEach(function(st){ if(st.key==='consistency')return;
        (st.metrics||[]).forEach(function(m){
          var p=(typeof _bmPctl==='function')?_bmPctl(m):null;
          _rows+='<tr><td>'+esc(_phClean(st))+'</td><td>'+esc(m.label||m.key||'')+'</td>'
            +'<td>'+(m.value!=null?_f(m.value)+esc(m.unit||''):'—')+'</td>'
            +'<td>'+(p!=null?p+' 백분위':'—')+'</td>'
            +'<td>'+(m.neutral?'표시 전용(미검증)':(st.score!=null?'채점':'—'))+'</td></tr>';
        });
      });
      var _mtab=_rows?('<div class="card"><div '+_mh+'>단계별 변인 · 값 · 단위 · 백분위</div><table class="ev-table"><thead><tr><th>단계</th><th>변인</th><th>값</th><th>백분위</th><th>상태</th></tr></thead><tbody>'+_rows+'</tbody></table></div>'):'';
      var _verd=''; try{
        /* [2026-08-14 FR-2] 표면 네임스페이스(dashboard·korea)+레거시 병합 후 player 필터. B리포트는 오프라인이라 sig 매칭 불가 → player 기준. */ var _stj=(function(){ if(typeof localStorage==='undefined') return {}; var out={}; try{ ['dashboard','korea'].forEach(function(sf){ var raw=localStorage.getItem('biomotion:review:theia:'+sf); if(raw){ var ob=JSON.parse(raw); for(var kk in ob){ out[kk]=ob[kk]; } } }); var lg=localStorage.getItem('biomotion:review:theia'); if(lg){ var lo=JSON.parse(lg); for(var k2 in lo){ if(out[k2]==null) out[k2]=lo[k2]; } } }catch(e){} return out; })();
        var _KO={accept:"채택",hold:"보류",reject:"기각",check:"추가 확인"};
        var _vr=''; Object.keys(_stj).forEach(function(k){ var r=_stj[k]; if(r&&r.player===name&&(r.status||r.note)){
          _vr+='<tr><td>'+esc(r.finding||'')+'</td><td>'+(r.status?(_KO[r.status]||r.status):'메모')+'</td><td>'+esc(r.reviewer||'')+'</td><td>'+esc(r.ts||'')+'</td><td>'+esc(r.note||'')+'</td></tr>';
        }});
        _verd=_vr?('<div class="card"><div '+_mh+'>연구자 판정 · 메모 <span class="sh-sub">자동 판정 검토에 저장된 항목</span></div><table class="ev-table"><thead><tr><th>발견</th><th>판정</th><th>판정자</th><th>시각</th><th>메모</th></tr></thead><tbody>'+_vr+'</tbody></table></div>'):'';
      }catch(e){ _verd=''; }
      return _basis+_mtab+_verd;
    })();
    // ── [2026-08-12] 하체·상체 활용 점수판 (lower_body_util · 선수·코치용 0-100) — 라이브 HTML/PDF 리포트 ──
    var _lbUtilH='';
    try{
      if(typeof LOWER_BODY_UTIL!=='undefined'&&LOWER_BODY_UTIL.assess){
        var _lb=null,_up=null; try{_lb=LOWER_BODY_UTIL.assess(DATA,ET);}catch(e){} try{_up=LOWER_BODY_UTIL.assessUpper(DATA,ET);}catch(e){}
        var _mc=(_phComp!=null)?_phComp:null;
        var _cc={good:'#2f9e44',partial:'#2563eb',transfer:'#e8731a',na:'#8893a4'};
        var _tiles=[];
        if(_mc!=null)_tiles.push({t:'메카닉 종합',v:_mc,s:'5단계 평균',c:_mc>=75?'good':(_mc>=60?'partial':'transfer')});
        if(_lb&&_lb.index!=null)_tiles.push({t:'하체 활용',v:_lb.index,s:_lb.label,c:_lb.labelClass});
        if(_up&&_up.index!=null)_tiles.push({t:'상체 전달',v:_up.index,s:_up.label,c:_up.labelClass});
        if(_tiles.length || (_lb&&_lb.lbuScores)){
          var _tileH=_tiles.map(function(x){var col=_cc[x.c]||'#2563eb';return '<div style="flex:1 1 150px;min-width:140px;background:#f6f8fb;border:1px solid #e3e9f0;border-top:4px solid '+col+';border-radius:10px;padding:11px 13px;text-align:center"><div style="font-size:11px;color:#6b7787;font-weight:700">'+x.t+'</div><div style="font-size:30px;font-weight:800;color:'+col+';line-height:1.1;margin:3px 0">'+x.v+'<span style="font-size:12px;color:#8893a4;font-weight:600">/100</span></div><div style="font-size:11px;color:'+col+';font-weight:700">'+esc(x.s)+'</div></div>';}).join('');
          // [2026-08-13 ①b] 하체 3독립 raw J(중립·미검증) 카드 — 우열 종합점수·라벨 미표시(#58)
          function _lbuRawCards(sc){ if(!sc)return ''; function card(x){ if(!x)return ''; var vJ=(x.rawJ!=null?x.rawJ+' J':'—'), vK=(x.jkg!=null?' · '+x.jkg+' J/kg':''); return '<div style="flex:1 1 150px;min-width:140px;background:#fff;border:1px solid #e8edf3;border-top:3px solid #8893a4;border-radius:8px;padding:8px 10px"><div style="font-size:11px;font-weight:800;color:#1b2330">'+esc(x.title)+'</div><div style="font-size:18px;font-weight:800;color:#41506a;margin:2px 0">'+vJ+'<span style="font-size:10px;color:#8893a4;font-weight:600">'+vK+'</span></div><div style="font-size:10px;color:#8893a4">검증 전 · 원시값</div></div>'; } return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+card(sc.driveGen)+card(sc.blockGen)+card(sc.blockAbsorb)+'</div>'; }
          function _roleRows(A){ if(!A||!A.roles)return ''; var RC={good:'#2f9e44',ok:'#2563eb',weak:'#e8731a',na:'#8893a4'};
            return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+A.roles.map(function(r){var c=RC[r.status]||'#8893a4',st=(A.statusKo&&A.statusKo[r.status])||r.status; var rt=(r.rows||[]).filter(function(z){return z.w;}).map(function(z){return esc(z.label)+' '+esc(z.w);}).join(' · '); return '<div style="flex:1 1 150px;min-width:140px;background:#fff;border:1px solid #e8edf3;border-top:3px solid '+c+';border-radius:8px;padding:7px 9px"><div style="font-size:11px;font-weight:800;color:#1b2330">'+esc(r.label)+' <span style="color:'+c+'">'+st+'</span>'+(r._score!=null&&r.status!=='na'?' <span style="color:#8893a4;font-weight:600">'+r._score+'</span>':'')+'</div><div style="font-size:10px;color:#6b7787;margin-top:3px;line-height:1.45">'+(rt||'자료 없음')+'</div></div>';}).join('')+'</div>'; }
          _lbUtilH='<div class="card" style="margin-bottom:10px;page-break-inside:avoid"><div style="font-size:13px;font-weight:800;margin-bottom:2px">하체·상체 활용 점수판 <span style="font-size:11px;color:#8893a4;font-weight:600">메카닉 종합=5단계 · 상체=에너지 활용(mech 독립) · 하체=검증 전 원시값(J)</span></div>'
            +'<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:9px">'+_tileH+'</div>'
            +((_lb&&_lb.lbuScores)?('<div style="margin-top:11px;font-size:12px;font-weight:800;color:#41506a">하체 활용 — 검증 전(원시값)</div><div class="lead" style="margin:3px 0 0;font-size:12px">'+esc(_lb.summary)+'</div>'+_lbuRawCards(_lb.lbuScores)):'')
            +(_up?('<div style="margin-top:12px;font-size:12px;font-weight:800;color:#41506a">상체 전달 — '+esc(_up.label)+'</div><div class="lead" style="margin:3px 0 0;font-size:12px">'+esc(_up.summary)+'</div>'+_roleRows(_up)):'')
            +'</div>';
        }
      }
    }catch(e){ _lbUtilH=''; }
    var _out = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>'+esc(name)+' 선수 리포트</title>'
      +'<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet"><style>'+CSS+'</style>'
      +DASH_BACK_SCRIPT+'</head><body>'
      +DASH_BACK_BAR+'<div class="wrap">'
      +'<div class="rhead"><div><div class="eyebrow">BIOMOTION · THEIA 피칭</div><h1>'+esc(name)+'<span class="rtag">투구 리포트</span><span class="rtag" style="margin-left:6px;background:'+(_AUD==="B"?"#7059aa":"#2f9e44")+';color:#fff">'+(_AUD==="B"?"B형 · 연구자 내부용":"A형 · 선수·코치용")+'</span></h1><div class="rsub">'+_rheadSub+'</div></div>'
      +'<div class="velo-big"><div class="vl">최고 구속</div><div><span class="vv">'+(vs.max_kmh!=null?_f(vs.max_kmh):'—')+'</span><span class="vu">km/h</span></div>'
      /* [케이랩 차용 B·2026-08-26] 지표 정의문 — 큰 숫자 아래 2줄(무엇을 재나·왜 중요한가). 새 산식 없음. */
      +'<div style="font-size:10.5px;color:var(--r-muted);line-height:1.45;max-width:190px;margin-left:auto;margin-top:4px">손을 떠난 순간 공의 속도(결과 지표). 추가 구속은 대개 에너지 전달 효율에서 나옵니다.</div></div></div>'
      +'<div class="keybox"><div class="kh">오늘의 핵심</div><div class="kt">'+C.intro+'</div></div>'
      /* [케이랩 차용 A·2026-08-26] 퍼포먼스 유형 정보 라벨 — 리포트 고유 taxonomy(_prMot 동력 전략) 재사용·새 산식 없음. ★판정·티어 아님(§4-⑤). */
      +(_prMot?('<div style="margin:8px 0;padding:9px 13px;border:1px solid #e2e6ec;border-radius:10px;background:#f7f8fa"><span style="color:#8893a4;font-size:11px;text-transform:uppercase;letter-spacing:.04em">퍼포먼스 유형 · 정보 라벨(판정 아님)</span><div style="margin-top:3px"><b style="color:#1b2330;font-size:15px">'+esc(_prMot.type)+'</b> <span style="color:#8893a4;font-size:12px">— 동력 전략 프로필일 뿐 우열·등급이 아닙니다</span></div></div>'):'')
      +'<div class="sec-h">에너지 흐름 지도 <span class="sh-sub">저장 → 생성 → 제동·전환 → 전달 → 방출</span></div>'
      +_eflowStrip
      +_keyIssuesSection
      +'<div class="sec-h">결과 상세 <span class="sh-sub">'+((vs.n||0)>0?'Rapsodo 실측 · '+vs.n+'구':'자료 없음')+'</span></div>'
      +_rtiles
      +'<h2 style="page-break-before:always">① 체력 — 구속의 바탕</h2><div class="lead">VALD 실측 · 규준 대비. 종합 점수 없이 축별 규준 위치(하위·중위·상위)로 봅니다. 매 투구의 직접 원인이 아닌 몸의 바탕입니다.</div>'
      +'<div class="vsec"><div class="vsub">'+C.fitness+'</div>'+_valdBars+'</div>'+fitTrain
      +'<h2 style="page-break-before:always">② 메카닉 (투구 동작 분석)</h2><div class="lead">와인드업부터 공 방출까지 투구 동작을 5단계로 나눠 "어디서 힘을 만들고(생성) · 어떻게 전달하며(전달) · 어디에 저장하고(저장) · 어디에 부담이 가는지(부하)"를 봅니다. 카드 왼쪽 색 바는 단계 카테고리, 글자색은 상태(초록 양호 · 주황 주의 · 빨강 병목), 숫자는 100점 기준 점수입니다.</div>'
      +mechFigH+threeAxisHTML
      +edSection()
      +_lbUtilH
      +_drillSection
      +_energyFlowSection
      +_drivelineSection
      +'<h2 style="page-break-before:always">③ 제구와 구질 (랩소도)</h2><div class="lead">제구 = 공을 원하는 곳에 <b>반복해서 넣는 능력</b>(랩소도 실측 로케이션·스트라이크% 중심). 구질 = 랩소도로 측정한 공의 속도·회전 특성과 그 <b>반복성(안정성)</b>.</div>'
      +'<div class="card" style="margin-bottom:10px"><b>제구 종합 '+(cmd.score!=null?cmd.score:'—')+'점</b>'+'<div class="lead" style="margin:4px 0">랩소도 로케이션 일관성 '+(cmd.location_score!=null?cmd.location_score:'—')+'(주) · 동작 일관성 '+(cmd.mech_consistency!=null?cmd.mech_consistency:'—')+'(보조) · 스트라이크 '+(cmd.strike_pct!=null?cmd.strike_pct+'%':'—')+'(참고) ('+(cmd.n||0)+'구)</div>'+'<div class="lead">'+C.command+'</div>'
        +'<table class="ev-table" style="margin-top:8px"><thead><tr><th class="evl">랩소도 로케이션 (제구 주지표)</th><th>측정</th><th>점수</th></tr></thead><tbody>'
        +cmdRow('존 로케이션 일관성','스트라이크존 적중 위치 산포 (좌우·상하) — 한 곳에 모일수록 제구 좋음', cmd.loc_sd, ' in', cmd.location_score, '좌우 '+_f(cmd.side_sd)+' / 상하 '+_f(cmd.height_sd)+' in')
        +cmdRow('스트라이크%(참고)','존 통과 비율 — 불펜/랩 캡처는 존 의도가 없어 점수 미반영', cmd.strike_pct, '%', null)
        +'</tbody></table>'
        +'<table class="ev-table" style="margin-top:10px"><thead><tr><th class="evl">동작 일관성 분해</th><th>점수</th><th>측정 산포</th></tr></thead><tbody>'
        +_mcRow('릴리즈 포인트 일관성',cmd.release_score,'SD '+(cmd.release_sd_mm!=null?cmd.release_sd_mm:'—')+' mm')
        +_mcRow('릴리즈 타이밍 일관성',cmd.timing_score,'CV '+(cmd.timing_cv!=null?cmd.timing_cv:'—')+'%')
        +_mcRow('암 슬롯 일관성',cmd.arm_score,'SD '+(cmd.arm_slot_sd!=null?cmd.arm_slot_sd:'—')+'°')
        +_mcRow('스트라이드 일관성',cmd.stride_score,'CV '+(cmd.stride_cv!=null?cmd.stride_cv:'—')+'%')
        +'</tbody></table>'
        +'<div class="lead" style="margin-top:6px">제구는 공이 한 곳에 모이는 정도(랩소도 로케이션 일관성)로 봅니다. 로케이션 일관성이 낮으면 같은 타겟에 반복해 던지는 드릴로 끌어올리세요. (스트라이크%는 불펜 캡처라 참고만)</div></div>'
      +'<div class="card"><b>'+((vs.n||0)>0?'구질 (랩소도 '+vs.n+'구)':'구질 (자료 없음)')+'</b><div class="qgrid">'
        +qk('구속 최고',_f(vs.max_kmh),'km/h')+qk('구속 평균',_f(vs.avg_kmh),'km/h')+qk('회전수',(vs.avg_spin!=null?vs.avg_spin:'—'),'rpm')
        +qk('회전효율',(vs.avg_eff!=null?vs.avg_eff:'—'),'%')+qk('회전축',(vs.spin_dir||'—'),'시계')+qk('구종',(vs.pitch_types?Object.keys(vs.pitch_types).length:'—'),'종')
        +'</div>'
        +'<div style="margin-top:8px;font-size:11.5px;font-weight:700;color:#41506a">구질 안정성 (투구 간 반복성 — 작을수록 일정)</div><div class="qgrid" style="margin-top:4px">'
        +qk('구속 변동(CV)',(vs.velo_cv!=null?vs.velo_cv:'—'),'%')+qk('회전수 변동(CV)',(vs.spin_cv!=null?vs.spin_cv:'—'),'%')+qk('회전효율 산포(SD)',(vs.eff_sd!=null?vs.eff_sd:'—'),'%')
        +'</div><div class="lead" style="margin-top:6px">'+(vs.pitch_types?'측정 구종: '+Object.keys(vs.pitch_types).map(function(k){return k+' '+vs.pitch_types[k]+'구';}).join(', ')+'. ':'')+'회전효율(Active Spin)이 높을수록 회전이 무브먼트로 잘 작용하고, 회전축(시계 방향)은 변화 방향을 결정합니다. 구속·회전 변동(CV)이 작을수록 매 투구 구질이 일정합니다 — 이는 제구가 아니라 구질의 반복성입니다.</div></div>'
      +(_AUD==="B"?(_bResearch+_rfootnote):"")
      +'<div class="note" style="margin-top:14px">'+C.closing+'</div></div></body></html>'; /* [2026-08-13 ③ P3 §11.3] A형=선수·코치용 장비명 순화(no-methodology). */ if (_AUD !== "B") { _out = _out.replace(/Rapsodo/g, "측정").replace(/\uB7A9\uC18C\uB3C4/g, "\uACF5 \uCE21\uC815").replace(/force plate/gi, "\uD798 \uCE21\uC815").replace(/QUALISYS \u00B7 THEIA \u00B7 VISUAL3D/g, "BIOMOTION").replace(/THEIA \uD53C\uCE6D/g, "\uD53C\uCE6D").replace(/Theia|\uD14C\uC774\uC544|Visual3D|Qualisys/g, ""); } return _out;
  }
  return { buildPlayerHTML: buildPlayerHTML };
});
