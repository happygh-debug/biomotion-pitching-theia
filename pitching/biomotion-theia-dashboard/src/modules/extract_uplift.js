// extract_uplift.js — Uplift 마커리스 CSV → Theia 키로 매핑된 trial dict (extract_uplift.py + build_report_uplift.remap 포팅)
// 입력: CSV 텍스트. 출력: { meta, events, times, frames, x_factor, series(Theia키), kseq, scalars, snap, inefficiencies }
// GRF/포스플레이트/키네틱 없음 → 다운스트림에서 grf/injury=null → 프런트가 해당 탭 자동 숨김.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.extractUplift = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WINDOW_PRE_S = 2.0, WINDOW_POST_S = 0.5;

  // ── CSV 파서 (따옴표 인식) ──
  function splitCSV(line){ var o=[],cur='',q=false; for(var i=0;i<line.length;i++){var c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
    else { if(c==='"')q=true; else if(c===','){o.push(cur);cur='';} else cur+=c; } } o.push(cur); return o; }
  function parseCSV(text){
    var lines=text.split(/\r?\n/); var hdr=splitCSV(lines[0]).map(function(h){return h.trim();});
    var idx={}; hdr.forEach(function(h,i){idx[h]=i;});
    var rows=[];
    for(var li=1;li<lines.length;li++){ if(!lines[li]||!lines[li].trim()) continue; rows.push(splitCSV(lines[li])); }
    function colNum(name){ var j=idx[name]; if(j===undefined) return null; var out=new Array(rows.length);
      for(var r=0;r<rows.length;r++){ var s=(rows[r][j]||'').trim(); var v=(s===''?NaN:Number(s)); out[r]=isFinite(v)?v:NaN; } return out; }
    function first(name){ var j=idx[name]; if(j===undefined) return null; for(var r=0;r<rows.length;r++){ var s=(rows[r][j]||'').trim(); if(s!=='') return s; } return null; }
    return { hdr:hdr, idx:idx, n:rows.length, has:function(k){return idx[k]!==undefined;}, colNum:colNum, first:first };
  }

  // ── 신호 유틸 (DSP 라이브러리 불필요: Uplift export 는 이미 평활본) ──
  function ffill(a){ var o=a.slice(),last=null,i; for(i=0;i<o.length;i++){ if(isFinite(o[i]))last=o[i]; else if(last!=null)o[i]=last; }
    var nx=null; for(i=o.length-1;i>=0;i--){ if(isFinite(o[i]))nx=o[i]; else if(nx!=null)o[i]=nx; } return o; }
  function movavg(a,w){ w=w||9; var h=Math.floor(w/2),o=new Array(a.length),i,j; for(i=0;i<a.length;i++){var s=0,c=0;
    for(j=i-h;j<=i+h;j++){ if(j>=0&&j<a.length&&isFinite(a[j])){s+=a[j];c++;} } o[i]=c?s/c:NaN; } return o; }
  function grad(a,dt){ var o=new Array(a.length),i; for(i=0;i<a.length;i++){ if(i===0)o[i]=(a[1]-a[0])/dt;
    else if(i===a.length-1)o[i]=(a[i]-a[i-1])/dt; else o[i]=(a[i+1]-a[i-1])/(2*dt); } return o; }
  function argmax(a,lo,hi){ lo=lo||0; hi=(hi==null?a.length-1:hi); var bi=-1,bv=-Infinity,i; for(i=lo;i<=hi&&i<a.length;i++){ if(isFinite(a[i])&&a[i]>bv){bv=a[i];bi=i;} } return bi; }
  function argmaxAbs(a,lo,hi){ lo=lo||0; hi=(hi==null?a.length-1:hi); var bi=-1,bv=-Infinity,i; for(i=lo;i<=hi&&i<a.length;i++){ var v=Math.abs(a[i]); if(isFinite(v)&&v>bv){bv=v;bi=i;} } return bi; }
  function r1(x){ return isFinite(x)?Math.round(x*10)/10:null; }
  function r2(x){ return isFinite(x)?Math.round(x*100)/100:null; }
  function r3(x){ return isFinite(x)?Math.round(x*1000)/1000:null; }

  // ── [2026-05-26] 좌표 스케일 보정 ──────────────────────────────────────────
  // 발견: Uplift 가 좌투수(left) 3D 좌표를 ~½ 스케일로 export(전 분절 균일, 등방).
  //   우투: 분절길이 ≈ 인체측정(s≈1.0) / 좌투: ≈ ½(s≈1.9~2.0). 어깨너비 우0.38m vs 좌0.20m.
  //   결과: 위치미분 선속도가 좌투에서 ~½ → KE(∝v²) ~¼·관절파워 급감(0526 차윤후 붕괴 원인).
  // 보정: 분절길이를 인체측정 기준으로 맞추는 등방 스케일 s 를 3D 위치 채널에만 곱함.
  //   이는 ω×r 재구성과 수학적으로 동일한 속도를 주며(v·L_anthro/L_meas = ω_native·r_anthro),
  //   위치·길이·관성·가속도까지 일관 복원. 각도/각속도 채널은 스케일 불변이라 건드리지 않음.
  //   정상 스케일(s<1.4)은 무보정(s=1.0) → 우투 무회귀. 검증: proto3 좌투 손목속도 7→14~18m/s, 우투 불변.
  function _pct90(a){ var b=a.filter(isFinite).sort(function(x,y){return x-y;}); return b.length?b[Math.floor(b.length*0.9)]:null; }
  function _med(a){ var b=a.filter(isFinite).sort(function(x,y){return x-y;}); return b.length?b[Math.floor(b.length/2)]:null; }
  function _segLenP90(P,j1,j2){ var ax=P.colNum(j1+'_3d_x'),ay=P.colNum(j1+'_3d_y'),az=P.colNum(j1+'_3d_z'),
      bx=P.colNum(j2+'_3d_x'),by=P.colNum(j2+'_3d_y'),bz=P.colNum(j2+'_3d_z'); if(!ax||!bx) return null;
    var d=[],i; for(i=0;i<P.n;i++){ var v=Math.sqrt(Math.pow(ax[i]-bx[i],2)+Math.pow(ay[i]-by[i],2)+Math.pow(az[i]-bz[i],2)); if(isFinite(v))d.push(v); }
    return _pct90(d); }
  function _computeScale(P, throwS, H){
    if(!H) H=1.75;
    // Winter 분절길이/신장 비율 — 신전 시 최대값(90퍼센타일)과 대조
    var segs=[['pelvis','proximal_neck',0.30],[throwS+'_shoulder_jc',throwS+'_elbow_jc',0.186],
      [throwS+'_elbow_jc',throwS+'_wrist_jc',0.146],[throwS+'_hip_jc',throwS+'_knee_jc',0.245],
      [throwS+'_knee_jc',throwS+'_ankle_jc',0.246]];
    var ratios=[],k; for(k=0;k<segs.length;k++){ var meas=_segLenP90(P,segs[k][0],segs[k][1]);
      if(meas&&meas>0.01) ratios.push(segs[k][2]*H/meas); }
    var s=_med(ratios); if(s==null) return 1;
    return s>1.4 ? s : 1.0;   // 압축(좌투) 검출 시만 보정
  }

  // ── [2026-05-26] Uplift→Theia 보정계수 (상동고 14쌍 Theia+GRF 동시측정 검증) ───────────
  // factor = U/T 평균비의 역수(Uplift값×factor ≈ Theia). apply:true=크기변인 series 에 즉시 곱.
  // 각도/불안정/정의차이 변인은 apply:false(기록만 — 각도에 배수 곱하면 왜곡; 나중 검토 후 토글).
  // ut=평균U/T, cv=선수간 변동, grade=일치등급(◎○△✕). 검증 스크립트: outputs/val/*.js
  var CALIB = {
    // ── 적용(크기변인) ──
    'Pitching_Hand_Ang_Vel_X':   {factor:2.00, apply:true,  ut:0.50, cv:0.18, grade:'✕', note:'팔(손)회전속도 — 스케일보정 확실, 개인변별 약함'},
    'Pitching_Humerus_ME_X':     {factor:1.61, apply:true,  ut:0.62, cv:0.19, grade:'△', note:'상완 KE'},
    'Pelvis_ME_X':               {factor:2.86, apply:true,  ut:0.35, cv:0.23, grade:'✕', note:'골반 KE'},
    'Pitching_Elbow_Power_X':    {factor:2.13, apply:true,  ut:0.47, cv:0.47, grade:'✕', note:'팔꿈치 파워 — CV 높음(검토)'},
    'Pitching_Shoulder_Power_X': {factor:3.57, apply:true,  ut:0.28, cv:0.39, grade:'✕', note:'어깨 파워 — 구조적 과소(축회전 한계)'},
    'COM_Velocity_Y':            {factor:1.0,  apply:false, ut:null, grade:'△', note:'전진 COM 속도 — 전진축 자동검출(x/z)로 좌투 축버그 수정됨(2026-05-26). 무보정. 보정계수는 축수정 후 재검증 필요'},
    // ── [2026-05-26b] 상지 직접키네틱(top-down 자체산출). 마커리스가 축회전 성분 과소→모멘트 크게 과소(U/T0.15~) 그러나 비율일관(CV낮음)→계수복원. ★부상부하 추정용·정밀평가는 측정 필요 ──
    'Pitching_Elbow_Torque_X':   {factor:5.29, apply:true,  ut:0.19, cv:0.22, grade:'✕', note:'팔꿈치 모멘트(외반부하) — Theia Pitching_Elbow_Moment 대조. 부상스크리닝 추정용'},
    'Pitching_Shoulder_Torque_X':{factor:6.87, apply:true,  ut:0.15, cv:0.24, grade:'✕', note:'어깨 모멘트(내회전) — 부상스크리닝 추정용'},
    'Pitching_Elbow_Moment_X':   {factor:5.29, apply:true,  ut:0.19, cv:0.22, grade:'✕', note:'팔꿈치 모멘트 표준키(리포트 elbowMoment 용, Torque와 동일)'},
    'Pitching_Shoulder_Moment_X':{factor:6.87, apply:true,  ut:0.15, cv:0.24, grade:'✕', note:'어깨 모멘트 표준키(리포트 shoulderMoment 용)'},
    'Pitching_Elbow_Force_X':    {factor:2.90, apply:true,  ut:0.34, cv:0.18, grade:'✕', note:'팔꿈치 관절반력'},
    'Pitching_Shoulder_Force_X': {factor:1.98, apply:true,  ut:0.50, cv:0.13, grade:'△', note:'어깨 분리력(distraction) — CV 최저(가장 일관)'},
    'Glove_Humerus_ME_X':        {factor:2.08, apply:true,  ut:0.48, cv:0.26, grade:'✕', note:'글러브 상완 KE — r0.69(글러브 중 최고)'},
    'Glove_Shoulder_Power_X':    {factor:2.42, apply:true,  ut:0.41, cv:0.47, grade:'✕', note:'글러브 어깨 파워 — CV 높음(검토)'},
    'Glove_Elbow_Power_X':       {factor:0.69, apply:false, ut:1.45, cv:0.84, grade:'△', note:'글러브 팔꿈치 파워 — 미적용(CV84% 불안정)'},
    // ── 무보정·신뢰(≈1.0) ──
    'Thorax_Ang_Vel_Z':          {factor:1.0,  apply:false, ut:1.10, grade:'◎', note:'몸통회전속도 — 신뢰'},
    'Trunk_ME_X':                {factor:1.0,  apply:false, ut:1.07, grade:'◎', note:'몸통 KE — 신뢰'},
    'Pelvis_Ang_Vel_Z':          {factor:1.0,  apply:false, ut:0.87, grade:'○', note:'골반회전속도 — 신뢰'},
    'Pitching_Shoulder_Angle_Z': {factor:1.0,  apply:false, ut:0.78, grade:'△', note:'MER — 무보정(경계)'},
    'Lead_Knee_Angle_X':         {factor:1.0,  apply:false, ut:0.96, grade:'◎', note:'리드무릎굴곡 — 신뢰'},
    'Back_Hip_Angle_X':          {factor:1.0,  apply:false, ut:1.09, grade:'◎', note:'힙힌지([0,KL]) — 신뢰·변별력 최고(r0.80)'},
    'Pitching_Elbow_Angle_X':    {factor:1.0,  apply:false, ut:1.07, grade:'◎', note:'팔꿈치굴곡각 — 신뢰'},
    // ── 보정 보류/사용주의(각도·불안정·정의차이) ──
    'Trunk_wrt_Pelvis_Angle_Z':  {factor:1.0,  apply:false, ut:1.00, grade:'○', note:'X-Factor SSOT=골반 기준 몸통 Z축 상대회전(Trunk_wrt_Pelvis_Angle_Z)·trial.x_factor. 표시·규준은 PITCH_NORMS.xfPeak'},
    'Pelvis_Angle_Z':            {factor:0.80, apply:false, ut:1.25, grade:'○', note:'골반코일범위 ÷1.25 — 각도라 미적용'},
    'Back_Hip_Angle_Y':          {factor:0.80, apply:false, ut:1.25, grade:'○', note:'뒷고관절내전속도 ÷1.25 — 각도파생 미적용'},
    'Pitching_Shoulder_Ang_Vel_Z':{factor:1.0, apply:false, ut:1.26, cv:1.12, grade:'✕', note:'어깨내회전속도 — 극불안정(Uplift단독 사용금지)'},
    'Pitching_Shoulder_Angle_Y': {factor:1.0,  apply:false, ut:0.48, grade:'✕', note:'어깨수평내전 — 정의차이(사용금지)'},
    'Trunk_Angle_Y':             {factor:1.0,  apply:false, ut:0.61, grade:'△', note:'몸통측면기울기 — 저상관(참고)'}
  };

  var JOINTS = ["mid_head","proximal_neck","pelvis","left_shoulder_jc","right_shoulder_jc",
    "left_elbow_jc","right_elbow_jc","left_wrist_jc","right_wrist_jc","left_hip_jc","right_hip_jc",
    "left_knee_jc","right_knee_jc","left_ankle_jc","right_ankle_jc","left_heel","right_heel","left_mid_toe","right_mid_toe"];
  // Uplift joint → Theia v2 frame marker
  var FRAME_MAP = { head:'mid_head', neck:'proximal_neck', pelvis_o:'pelvis',
    l_shoulder:'left_shoulder_jc', r_shoulder:'right_shoulder_jc', l_elbow:'left_elbow_jc', r_elbow:'right_elbow_jc',
    l_wrist:'left_wrist_jc', r_wrist:'right_wrist_jc', l_hip:'left_hip_jc', r_hip:'right_hip_jc',
    l_knee:'left_knee_jc', r_knee:'right_knee_jc', l_heel:'left_heel', r_heel:'right_heel',
    l_toe:'left_mid_toe', r_toe:'right_mid_toe', l_hand_tip:'left_wrist_jc', r_hand_tip:'right_wrist_jc' };

  function horizAngle(plx,plz,prx,prz){ return Math.atan2(prz-plz, prx-plx)*180/Math.PI; }
  // [2026-06-11 분절축 X-Factor] 3D 벡터 헬퍼 — 골반/몸통 분절 장축 기준 회전각 차이용(글로벌 수직축 가정 제거).
  function _v3sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
  function _v3dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function _v3cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function _v3norm(a){ var n=Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); return n? [a[0]/n,a[1]/n,a[2]/n]:[0,0,0]; }
  function _v3projPerp(v,ax){ var d=_v3dot(v,ax); return [v[0]-ax[0]*d, v[1]-ax[1]*d, v[2]-ax[2]*d]; } // v ⊥ ax (ax 단위)
  // u→w, axis 기준 부호각(deg)
  function _v3signedAngle(u,w,ax){ var un=_v3norm(u),wn=_v3norm(w); var c=Math.max(-1,Math.min(1,_v3dot(un,wn))); var s=_v3dot(_v3cross(un,wn),_v3norm(ax)); return Math.atan2(s,c)*180/Math.PI; }

  function seriesMap(throwS, gloveS){ return {
    'Pelvis_Ang_Vel_Z':           'pelvis_rotational_velocity_with_respect_to_ground',
    'Thorax_Ang_Vel_Z':           'trunk_rotational_velocity_with_respect_to_ground',
    'Pitching_Hand_Ang_Vel_X':    throwS+'_arm_rotational_velocity_with_respect_to_ground',
    'Pitching_Shoulder_Angle_Z':  throwS+'_shoulder_external_rotation',
    'Pitching_Shoulder_Angle_X':  throwS+'_shoulder_flexion',
    'Pitching_Shoulder_Angle_Y':  throwS+'_shoulder_horizontal_adduction',
    'Pitching_Elbow_Angle_X':     throwS+'_elbow_flexion',
    'Pitching_Elbow_Ang_Vel_X':   throwS+'_elbow_flexion_velocity',
    'Pitching_Shoulder_Ang_Vel_Z':throwS+'_shoulder_external_rotation_velocity',
    'Trunk_Angle_X':              'trunk_global_flexion',
    'Trunk_Angle_Y':              'trunk_lateral_flexion_right',
    'Trunk_Angle_Z':              'trunk_global_rotation',
    'Pelvis_Angle_Z':             'pelvis_global_rotation',
    'Lead_Knee_Angle_X':          gloveS+'_knee_extension',
    'Back_Knee_Angle_X':          throwS+'_knee_extension',
    'Back_Hip_Angle_Y':           throwS+'_hip_adduction_with_respect_to_pelvis',  // 외전속도(hipAbd)용: 드라이브중 외전이 활성 (IR은 KL→FC 거의 0)
    // [2026-05-26] 힙힌지(고관절 굴곡)는 GRF 무관 순수 운동학 — Uplift가 직접 제공하므로 매핑(누락됐던 것 복원).
    // (코일=고관절 외회전은 wrt_pelvis가 이 데이터에서 ~0이고 부호규약 모호 → uplift_extra의 '고관절 내회전 ROM/속도(몸통기준)'로 표현.)
    'Back_Hip_Angle_X':           throwS+'_hip_flexion_with_respect_to_trunk'           // 힙 힌지 = 뒷다리 고관절 굴곡
  }; }

  function detectEvents(P, fs, throwS, gloveS){
    var dt=1/fs;
    var wx=movavg(ffill(P.colNum(throwS+'_wrist_jc_3d_x')),9), wy=movavg(ffill(P.colNum(throwS+'_wrist_jc_3d_y')),9), wz=movavg(ffill(P.colNum(throwS+'_wrist_jc_3d_z')),9);
    var gx=grad(wx,dt), gy=grad(wy,dt), gz=grad(wz,dt);
    var speed=wx.map(function(_,i){return Math.sqrt(gx[i]*gx[i]+gy[i]*gy[i]+gz[i]*gz[i]);});
    // [2026-05-26] BR(릴리스) 검출 견고화. 기존: 전 구간 손속도 최대 → 와인드업/팔로스루의
    //   허위 peak 에 조기 검출(0526 보고: i_br 이 팔 회전속도 진짜 peak 보다 이름; 정곤휘 6/12·차윤후 5/12 등).
    //   개선: 팔 회전속도(native) peak 를 릴리스 앵커로 삼고(말단 7% garbage 제외), 손속도 최대는 그 근방
    //   [-60ms,+50ms] 창에서만 탐색 → 진짜 릴리스 순간의 손속도 최대를 잡음. 팔 채널 없으면 기존 방식.
    var nAll=speed.length, hiGuard=Math.floor(nAll*0.93);
    var armV=P.colNum(throwS+'_arm_rotational_velocity_with_respect_to_ground');
    var iArm = armV ? argmaxAbs(armV,0,hiGuard) : -1;
    var iBr;
    if(iArm>0){ var brLo=Math.max(0,iArm-Math.round(0.06*fs)), brHi=Math.min(nAll-1,iArm+Math.round(0.05*fs));
      iBr=argmax(speed,brLo,brHi); }
    else iBr=argmax(speed,0,nAll-1);
    var ltY=movavg(ffill(P.colNum(gloveS+'_mid_toe_3d_y')),9), ltVy=grad(ltY,dt);
    var iKl=argmax(ltY,0,Math.max(1,iBr));
    var mins=[gloveS+'_mid_toe_3d_y',throwS+'_mid_toe_3d_y',gloveS+'_heel_3d_y',throwS+'_heel_3d_y'].map(function(c){var a=P.colNum(c);var m=Infinity;if(a)a.forEach(function(v){if(isFinite(v)&&v<m)m=v;});return m;});
    var groundMin=Math.min.apply(null,mins.filter(isFinite));
    var iFc=null,i;
    for(i=iKl+5;i<iBr-5;i++){ if(ltY[i]<groundMin+0.08 && Math.abs(ltVy[i])<0.5 && ltVy[i]>=ltVy[i-1]){ iFc=i; break; } }
    if(iFc==null){ for(i=iKl+5;i<iBr-5;i++){ if(ltY[i]<groundMin+0.08){ iFc=i; break; } } }
    if(iFc==null) iFc=Math.max(iBr-30,iKl+10);
    // [2026-05-26] 릴리스 견고화 2차: 릴리스는 FC 후 생리적 윈도우(~30~300ms) 내에 발생.
    //   1차(전구간 팔peak)는 팔로스루의 더 큰 허위 팔 각속도 peak를 잡아 i_br 이 늦게(차윤후/손예준 일부 100~121f≈430~506ms) 검출됨
    //   → 손목이 어깨 아래로 내려간 시점=릴리스 산점도 outlier. FC 후 윈도우 내에서 팔peak 재앵커→손속도 최대.
    //   정상 트라이얼(FC→BR 14~56f)은 글로벌 peak가 이미 윈도우 내라 무변.
    if(iFc!=null){
      var rLo=Math.min(nAll-1, iFc+Math.round(0.03*fs)), rHi=Math.min(nAll-1, iFc+Math.round(0.30*fs));
      if(rHi>rLo){
        var iArm2=armV?argmaxAbs(armV,rLo,rHi):-1, bLo,bHi;
        if(iArm2>0){ bLo=Math.max(rLo,iArm2-Math.round(0.06*fs)); bHi=Math.min(rHi,iArm2+Math.round(0.05*fs)); }
        else { bLo=rLo; bHi=rHi; }
        var iBr2=argmax(speed,bLo,bHi);
        // 릴리스 손목은 어깨 부근/위(3/4·오버핸드). 팔로스루로 손목이 어깨보다 크게 내려간 프레임이 잡히면(예 차윤후 s4)
        // 윈도우 내 '손목 ≥ 어깨-0.10m' 인 프레임 중 손속도 최대로 재선택.
        var shY=movavg(ffill(P.colNum(throwS+'_shoulder_jc_3d_y')),9);
        if(isFinite(wy[iBr2])&&isFinite(shY[iBr2])&&wy[iBr2]<shY[iBr2]-0.10){
          var _bv=-Infinity,_bi=-1,_k; for(_k=rLo;_k<=rHi;_k++){ if(isFinite(wy[_k])&&isFinite(shY[_k])&&wy[_k]>=shY[_k]-0.10&&isFinite(speed[_k])&&speed[_k]>_bv){_bv=speed[_k];_bi=_k;} }
          if(_bi>iFc) iBr2=_bi;
        }
        if(iBr2>iFc) iBr=iBr2;
      }
    }
    // [2026-05-27] Uplift 제공 이벤트 우선 사용 — Uplift CSV 자체 검출 이벤트(상대오프셋: 컬럼값 = 현재frame − 이벤트절대frame)
    //   를 절대 행인덱스로 변환해 우선 적용. Theia GRF 기준 교차검증 결과, 발끝 운동학 재검출보다 견고(좌투·사이드암).
    //   비정상(순서 깨짐/범위 밖)이거나 컬럼 없으면 위의 운동학 검출로 폴백.
    var _evSrc='kinematic', _provMer=null;
    (function(){
      var frameCol=P.colNum('frame'); if(!frameCol) return;
      function provIdx(name){
        var c=P.colNum(name); if(!c) return null;
        var ds=[],k; for(k=0;k<frameCol.length;k++){ if(isFinite(frameCol[k])&&isFinite(c[k])) ds.push(frameCol[k]-c[k]); }
        if(!ds.length) return null; ds.sort(function(a,b){return a-b;}); var fa=ds[Math.floor(ds.length/2)];
        var r,bi=-1,bd=Infinity; for(r=0;r<frameCol.length;r++){ var dd=Math.abs(frameCol[r]-fa); if(dd<bd){bd=dd;bi=r;} if(dd===0) return r; }
        return bi>=0?bi:null;
      }
      var pKl=provIdx('max_knee_raise_frame'), pFc=provIdx('foot_contact_frame'),
          pMer=provIdx('max_external_rotation_frame'), pBr=provIdx('ball_release_frame');
      var _natValid = (pKl!=null && pFc!=null && pBr!=null && pKl>=0 && pKl<pFc && pFc<pBr && pBr<nAll);
      // [2026-06-11] 네이티브 이벤트 검증 — Uplift CSV는 전 세션 연속(멀티-투구). 네이티브 오프셋이
      //   정지 구간(비투구)을 가리키는 경우(14명 중 김수겸·김동균 등 2명) 거부하고 운동학 검출(팔각속도 peak=진짜 릴리스) 유지.
      //   판정: 네이티브 BR 의 팔각속도 ≪ 운동학 BR(=팔각속도 peak). 정상 트라이얼은 네이티브 BR≈운동학 BR 이라 통과(기존 동작 불변).
      if(_natValid && armV){ var _avf=ffill(armV);
        var _avNat=Math.abs(_avf[pBr]||0), _avKin=Math.abs(_avf[iBr]||0);
        // 실제 투구의 팔각속도 ~700~2300°/s, 정지 구간 ~10~220°/s 로 명확히 갈림. 절대 임계 500 으로 정지 구간만 거부.
        if(_avKin>800 && _avNat < 500){ _natValid=false; _evSrc='kinematic_armpeak'; }
      }
      if(_natValid){
        iKl=pKl; iFc=pFc; iBr=pBr; _evSrc='uplift_native';
        _provMer=(pMer!=null && pMer>=pFc && pMer<=pBr) ? pMer : null;
      }
    })();
    // [2026-06-11] FC 정밀화 — 앞발(글러브측) 뒤꿈치 높이가 자기최저+3cm 아래로 처음 내려가는 프레임 = FC.
    //   Theia GRF-FC(>10N) 대비 편향 −3ms·SD 7ms·MAE 6ms(14쌍 검증, fc_proxy.js). 벤더 foot_contact_frame·toe폴백보다 정확
    //   (현 FC와 −84~+54ms 차이 교정). 자기최저 기준이라 발크기·스케일 불변. iKl/iBr/MER은 기존 유지, FC만 교체. Uplift 전용→Theia diff=0.
    (function(){
      var hyC=P.colNum(gloveS+'_heel_3d_y'); if(!hyC) return;
      var hy=ffill(hyC);
      var lo=Math.min(iKl+3, iBr-3), hi=iBr-3; if(hi<=lo) return;
      var ymin=Infinity, j; for(j=lo;j<=hi;j++){ if(isFinite(hy[j])&&hy[j]<ymin)ymin=hy[j]; }
      if(!isFinite(ymin)) return;
      var fc3=null; for(j=lo;j<=hi;j++){ if(isFinite(hy[j])&&hy[j]<ymin+0.03){ fc3=j; break; } }
      if(fc3!=null && fc3>iKl && fc3<iBr){ iFc=fc3; _evSrc=_evSrc+'+heel3cm_fc'; }
    })();
    var erCol=P.colNum(throwS+'_shoulder_external_rotation'), iMer;
    if(_provMer!=null) iMer=_provMer;
    else if(erCol){ var er=movavg(ffill(erCol),9); iMer=(iBr-iFc>5)?argmax(er,iFc,iBr):Math.floor((iFc+iBr)/2); }
    else iMer=Math.floor((iFc+iBr)/2);
    return { i_kl_peak:iKl, i_fc:iFc, i_mer:iMer, i_br:iBr, peak_hand_speed_ms:r2(speed[iBr]), events_source:_evSrc };
  }

  function extractTrial(csvText, meta, trialLabel){
    meta = meta||{};
    var P=parseCSV(csvText);
    var fs=Number(P.first('fps'))||240; var dt=1/fs;
    var hand=(P.first('handedness')||meta.handedness||'right').toLowerCase();
    var throwS = hand.charAt(0)==='l' ? 'left':'right';
    var gloveS = throwS==='right' ? 'left':'right';
    var athlete=P.first('athlete_name')||meta.name||'선수';

    // [2026-05-26] 좌표 스케일 보정: 3D 위치 채널에만 등방 스케일 s 적용 (좌투 ½압축 복원). 각도/각속도 불변.
    var _scale=_computeScale(P, throwS, meta.height_m);
    if(_scale!==1){ var _rawColNum=P.colNum;
      P.colNum=function(name){ var a=_rawColNum(name);
        if(a && /(_3d_[xyz]|center_of_mass_[xyz])$/.test(name)) return a.map(function(v){return isFinite(v)?v*_scale:v;});
        return a; }; }

    var ev=detectEvents(P, fs, throwS, gloveS);
    var iKl=ev.i_kl_peak, iFc=ev.i_fc, iBr=ev.i_br;

    // 수직 기준: 셋업 trail-foot 최저점 = ground
    var nRef=Math.min(30,P.n);
    var trailToe=P.colNum(throwS+'_mid_toe_3d_y')||[], trailHeel=P.colNum(throwS+'_heel_3d_y')||[];
    var gmin=Infinity,i; for(i=0;i<nRef;i++){ if(isFinite(trailToe[i])&&trailToe[i]<gmin)gmin=trailToe[i]; if(isFinite(trailHeel[i])&&trailHeel[i]<gmin)gmin=trailHeel[i]; }
    var groundY=isFinite(gmin)?gmin:0;
    // 수평 기준: 셋업 trail-ankle XZ → 원점(고무판 중심)
    var ax=P.colNum(throwS+'_ankle_jc_3d_x')||[], az=P.colNum(throwS+'_ankle_jc_3d_z')||[];
    var sx=0,cx=0,sz=0,cz=0; for(i=0;i<nRef;i++){ if(isFinite(ax[i])){sx+=ax[i];cx++;} if(isFinite(az[i])){sz+=az[i];cz++;} }
    var trailX0=(cx?sx/cx:0)*1000, trailZ0=(cz?sz/cz:0)*1000;

    // 관절 컬럼 캐시
    var jc={}; JOINTS.forEach(function(j){ jc[j]={x:P.colNum(j+'_3d_x'),y:P.colNum(j+'_3d_y'),z:P.colNum(j+'_3d_z')}; });

    // frames (m→mm, 원점/지면 정렬) — Theia v2 마커명으로 매핑(FRAME_MAP) + Dempster COM
    var COM_SEG=[[0.081,'head','neck'],[0.497,'neck','pelvis_o'],[0.028,'l_shoulder','l_elbow'],[0.028,'r_shoulder','r_elbow'],[0.022,'l_elbow','l_wrist'],[0.022,'r_elbow','r_wrist'],[0.100,'l_hip','l_knee'],[0.100,'r_hip','r_knee'],[0.061,'l_knee','l_heel'],[0.061,'r_knee','r_heel']];
    var V2KEYS=Object.keys(FRAME_MAP);
    var frames=[]; for(i=0;i<P.n;i++){ var fr={};
      for(var vi=0;vi<V2KEYS.length;vi++){ var vk=V2KEYS[vi], J=jc[FRAME_MAP[vk]]; if(!J)continue;
        fr[vk]=[ r1((J.x?J.x[i]:NaN)*1000-trailX0), r1(((J.y?J.y[i]:NaN)-groundY)*1000), r1((J.z?J.z[i]:NaN)*1000-trailZ0) ]; }
      var sxc=0,syc=0,szc=0,swc=0; for(var ci=0;ci<COM_SEG.length;ci++){ var pa=fr[COM_SEG[ci][1]], pb=fr[COM_SEG[ci][2]], w=COM_SEG[ci][0];
        if(pa&&pb&&isFinite(pa[0])&&isFinite(pb[0])){ sxc+=w*(pa[0]+pb[0])/2; syc+=w*(pa[1]+pb[1])/2; szc+=w*(pa[2]+pb[2])/2; swc+=w; } }
      if(swc>0.5) fr.com=[r1(sxc/swc),r1(syc/swc),r1(szc/swc)];
      frames.push(fr); }

    // x_factor — [2026-06-11 교수 지시] 분절 수직축 기준 재정의: 글로벌 수직(Y)이 아니라 몸통 장축(pelvis_o→neck) 평면에
    //   골반선(l_hip→r_hip)·어깨선(l_shoulder→r_shoulder)을 투영해 두 선 사이의 부호각 = 몸통-골반 분리. 몸통 측굴/전경 시 글로벌 수평투영 왜곡 제거.
    //   (frames[i]: l_hip·r_hip·l_shoulder·r_shoulder·pelvis_o·neck = 3D mm.) 장축 결손/축퇴 프레임은 글로벌 수평면 폴백.
    var xfactor=[]; for(i=0;i<P.n;i++){
      var F_=frames[i]; var xf;
      var _pel=F_&&F_.pelvis_o, _nk=F_&&F_.neck, _lh=F_&&F_.l_hip, _rh=F_&&F_.r_hip, _ls=F_&&F_.l_shoulder, _rs=F_&&F_.r_shoulder;
      if(_pel&&_nk&&_lh&&_rh&&_ls&&_rs&&isFinite(_pel[0])&&isFinite(_nk[0])&&isFinite(_lh[0])&&isFinite(_rh[0])&&isFinite(_ls[0])&&isFinite(_rs[0])){
        var _ut=_v3norm(_v3sub(_nk,_pel));                       // 몸통 장축(분절 수직축)
        var _hipP=_v3projPerp(_v3sub(_rh,_lh),_ut);              // 골반 횡선 ⊥ 몸통축
        var _shP=_v3projPerp(_v3sub(_rs,_ls),_ut);               // 어깨 횡선 ⊥ 몸통축
        if(Math.hypot(_ut[0],_ut[1],_ut[2])>0 && Math.hypot(_hipP[0],_hipP[1],_hipP[2])>1 && Math.hypot(_shP[0],_shP[1],_shP[2])>1){
          xf=_v3signedAngle(_hipP,_shP,_ut);
        } else { xf=null; }
      } else { xf=null; }
      if(xf==null){ var lhx=jc.left_hip_jc.x[i], lhz=jc.left_hip_jc.z[i], rhx=jc.right_hip_jc.x[i], rhz=jc.right_hip_jc.z[i],
        lsx=jc.left_shoulder_jc.x[i], lsz=jc.left_shoulder_jc.z[i], rsx=jc.right_shoulder_jc.x[i], rsz=jc.right_shoulder_jc.z[i];
        var pa=horizAngle(lhx,lhz,rhx,rhz), sa=horizAngle(lsx,lsz,rsx,rsz); xf=((sa-pa+180)%360+360)%360-180; }
      xfactor.push(xf); }
    (function(){ var lo=iKl||0, hi=(iBr!=null?iBr:xfactor.length-1), bi=-1,bv=-Infinity;
      for(var k=lo;k<=hi&&k<xfactor.length;k++){ var v=Math.abs(xfactor[k]); if(isFinite(v)&&v>bv){bv=v;bi=k;} }
      if(bi>=0 && xfactor[bi]<0){ for(var j=0;j<xfactor.length;j++) xfactor[j]=isFinite(xfactor[j])?-xfactor[j]:xfactor[j]; } })();
    for(i=0;i<xfactor.length;i++) xfactor[i]=r2(xfactor[i]);

    // series remap → Theia 키
    var smap=seriesMap(throwS,gloveS); var series={};
    Object.keys(smap).forEach(function(v2k){ var uk=smap[v2k]; if(P.has(uk)){ series[v2k]=ffill(P.colNum(uk)).map(r2); } });
    // [2026-06-11 교수 지시] armRotV(어깨 내회전 각속도) 재산출 — 벤더 shoulder_external_rotation_velocity 는 극불안정(노이즈 스파이크/과소).
    //   잘 추적된 관절(어깨·팔꿈치·손목)에서 전완을 상완축⊥평면에 투영한 ER각을 직접 미분(MER→팔꿈치 신전피크 구간만; 그 후엔 전완이 상완축과 정렬돼 무효).
    //   Uplift 평탄화로 짧은 peak 가 체계적 축소(상동고 동시측정 중앙 ~0.55×Theia) → 보정 ×_ARM_IR_CAL. 각도 기반이라 좌표 스케일 무관. [[uplift-golden-calibration]]
    (function(){
      var SH=jc[throwS+'_shoulder_jc'], EL=jc[throwS+'_elbow_jc'], WR=jc[throwS+'_wrist_jc'];
      if(!SH||!EL||!WR||!SH.x) return;
      var _ARM_IR_CAL=1.7;  // 동시측정 상동고 4명 보정(중앙 ~0.59× → 1/0.59). 엘리트 동시측정 확보 시 갱신.
      var sx=ffill(SH.x),sy=ffill(SH.y),sz=ffill(SH.z),ex=ffill(EL.x),ey=ffill(EL.y),ez=ffill(EL.z),wx=ffill(WR.x),wy=ffill(WR.y),wz=ffill(WR.z);
      // 전완⊥상완 비율(전완이 축회전 지표로 유효한 정도). 릴리스에 팔꿈치 완전신전 시 0 근처 → 무효.
      function perpFrac(i){ var u=_v3norm([ex[i]-sx[i],ey[i]-sy[i],ez[i]-sz[i]]); var f=[wx[i]-ex[i],wy[i]-ey[i],wz[i]-ez[i]]; var fp=_v3projPerp(f,u); var nf=Math.hypot(f[0],f[1],f[2]); return nf?Math.hypot(fp[0],fp[1],fp[2])/nf:0; }
      function erAngle(i){ if(!isFinite(sx[i])||!isFinite(ex[i])||!isFinite(wx[i]))return NaN;
        var u=_v3norm([ex[i]-sx[i],ey[i]-sy[i],ez[i]-sz[i]]); var f=[wx[i]-ex[i],wy[i]-ey[i],wz[i]-ez[i]];
        var fp=_v3projPerp(f,u); if(Math.hypot(fp[0],fp[1],fp[2])<0.05)return NaN;  // jc=미터(전완~0.25m); ⊥성분 5cm 미만=정렬=무효
        var rp=_v3projPerp([0,1,0],u); var rn=_v3norm(rp),fn=_v3norm(fp);
        return Math.atan2(_v3dot(_v3cross(rn,fn),u),_v3dot(rn,fn))*180/Math.PI; }
      var iMer=ev.i_mer;
      // [MER-3, BR+5] 중 전완⊥상완 유효(>0.4)한 연속 프레임에서만 ER각 미분. (신전피크 한정보다 균일 — 서초율 등 팔꿈치 신전 케이스도 유효구간만 측정)
      var lo2=Math.max(1,(iMer||iFc||1)-3), hi2=Math.min(P.n-2,(iBr!=null?iBr:P.n-2)+5);
      var ir=new Array(P.n); for(var z=0;z<P.n;z++) ir[z]=0;
      var prevA=null, prevI=null;
      for(var i2=lo2;i2<=hi2&&i2<P.n;i2++){
        if(perpFrac(i2)>0.4){ var a2=erAngle(i2);
          if(isFinite(a2)&&prevA!=null&&prevI===i2-1){ var d=a2-prevA; while(d>180)d-=360; while(d<-180)d+=360; var vv=Math.abs(d/dt)*_ARM_IR_CAL; ir[i2]=(vv<15000)?r2(vv):0; }
          if(isFinite(a2)){prevA=a2;prevI=i2;} }
        else { prevA=null; prevI=null; }
      }
      // IR peak(릴리스 무렵)가 조기검출된 BR 직후에 떨어져 phases [FC,BR] 창이 놓치는 산포 해소 → 유효창 peak 를 BR 프레임에 배치(armRotV=peak 크기만 사용·etdiag는 Uplift 미실행이라 타이밍 무영향).
      var irPeak=0; for(var q=lo2;q<=hi2&&q<P.n;q++){ if(ir[q]>irPeak)irPeak=ir[q]; }
      if(iBr!=null && iBr<P.n && irPeak>0) ir[iBr]=irPeak;
      series['Pitching_Shoulder_Ang_Vel_Z']=ir;
    })();
    // 부호: Uplift knee_extension(+신전) → Theia(+굴곡) 반전
    //  [2026-06-11 검토] 무릎각 스무딩(movavg9) 시도했으나 14쌍 무릎 r 무변동(0.64→0.64) — 벤더 무릎각이 이미 충분히 평활,
    //    파생변인(kneeCollapse=윈도우 peak·kneeExtROM=작은 차분) 취약성은 고주파 노이즈가 아니라 구조적(차분·이벤트 민감) → 스무딩 미적용(효과 없는 계산변경 배제).
    //    진짜 강건화 = phases.js 무릎 변인 정의 자체를 강건 추정으로 재작성(UPLIFT 분기·Theia diff=0 필요) — 별도 과제.
    ['Lead_Knee_Angle_X','Back_Knee_Angle_X'].forEach(function(k){ if(series[k]) series[k]=series[k].map(function(v){return (v==null?v:-v);}); });
    // Uplift 내부: global(수평투영) vs segment(Trunk_Angle_Z−Pelvis_Angle_Z) 선택 — 추출 경로만. UI·xfPeak·규준은 정책 SSOT(trial.x_factor) 기준.
    var _xfMethod='global';
    (function(){
      var tz=series['Trunk_Angle_Z'], pz=series['Pelvis_Angle_Z'];
      if(!tz||!pz) return;
      var n=Math.min(tz.length,pz.length), seg=new Array(xfactor.length); for(i=0;i<seg.length;i++) seg[i]=NaN;
      for(i=0;i<n;i++){ if(isFinite(tz[i])&&isFinite(pz[i])){ var d=tz[i]-pz[i]; seg[i]=((d+180)%360+360)%360-180; } }
      // 부호통일(KH→BR 최대 분리 양수)
      var lo=iKl||0, hi=(iBr!=null?iBr:seg.length-1), bi=-1,bv=-Infinity;
      for(var k=lo;k<=hi&&k<seg.length;k++){ var v=Math.abs(seg[k]); if(isFinite(v)&&v>bv){bv=v;bi=k;} }
      if(bi>=0 && seg[bi]<0){ for(var j=0;j<seg.length;j++) seg[j]=isFinite(seg[j])?-seg[j]:seg[j]; }
      var dlv=String((meta&&meta.delivery)||'').toUpperCase(), sidearm=/SH|UH|SIDE|UNDER/.test(dlv);
      var gpk=0; for(k=lo;k<=hi&&k<xfactor.length;k++){ var gv=Math.abs(xfactor[k]); if(isFinite(gv)&&gv>gpk)gpk=gv; }
      if(sidearm || gpk>75){ _xfMethod='segment'; for(i=0;i<xfactor.length;i++) xfactor[i]=r2(seg[i]); }
    })();
    series['Trunk_wrt_Pelvis_Angle_Z']=xfactor.slice();
    // [2026-05-26] COM 전진 속도 — 전진축 자동검출(x/z 중 KL→BR 변위 큰 수평축; 우투=z·좌투=x).
    //   기존 com_z 고정은 좌투(전진=X)에서 엉뚱축(측면) 포착→차윤후 0.76m/s 버그. 부호=전진(+).
    (function(){
      var cX=P.has('whole_body_center_of_mass_x')?ffill(P.colNum('whole_body_center_of_mass_x')):null;
      var cZ=P.has('whole_body_center_of_mass_z')?ffill(P.colNum('whole_body_center_of_mass_z')):null;
      if(!cX && !cZ) return;
      function _exc(a){ if(!a)return -1; var mn=Infinity,mx=-Infinity,kk; for(kk=iKl;kk<iBr&&kk<a.length;kk++){var v=a[kk]; if(isFinite(v)){if(v<mn)mn=v;if(v>mx)mx=v;}} return isFinite(mn)?(mx-mn):-1; }
      var fwd=(_exc(cX)>_exc(cZ))?cX:cZ; if(!fwd) return;
      var vF=grad(fwd,dt), med=[],ii; for(ii=iKl;ii<iBr&&ii<vF.length;ii++) if(isFinite(vF[ii]))med.push(vF[ii]); med.sort(function(a,b){return a-b;});
      if(med.length && med[Math.floor(med.length/2)]<0) vF=vF.map(function(v){return -v;});
      series['COM_Velocity_Y']=movavg(vF,9).map(r3);
    })();
    // 골반 높이(m) — frames pelvis y[mm]→m
    series['PELVIS_O_Z']=frames.map(function(f){ return f.pelvis_o?r3(f.pelvis_o[1]/1000):null; });
    // 스트라이드 길이(m) 시계열 — 일관성(CV) 산출용. uplift stride_length(신장비) × 신장. (키네매틱 자체산출)
    var _strR=Number(P.first('stride_length')); var _strideM=(isFinite(_strR)&&meta.height_m)?_strR*meta.height_m:(isFinite(_strR)?_strR:null);
    if(_strideM!=null){ var _sa=new Array(P.n); for(i=0;i<P.n;i++)_sa[i]=r3(_strideM); series['STRIDE_LENGTH_X']=_sa; }
    // ── 분절 역학에너지(KE 기반: 병진+회전, 키네매틱 추정·참고용) — 포스플레이트 불필요 ──
    // ※ Theia ME 채널과 정의가 달라 절대값은 참고용. 이준우 교차검증: 몸통 KE≈Theia, 상완은 단축ω로 과소.
    function _segKE(prox,dist,massFr,comR,kR,omegaKey){
      var Mb=meta.weight_kg||86, com=new Array(P.n), Lk=new Array(P.n), out=new Array(P.n), ii;
      for(ii=0;ii<P.n;ii++){ var a=frames[ii][prox],b=frames[ii][dist];
        if(!a||!b||!isFinite(a[0])||!isFinite(b[0])){com[ii]=null;Lk[ii]=null;continue;}
        com[ii]=[(a[0]+comR*(b[0]-a[0]))/1000,(a[1]+comR*(b[1]-a[1]))/1000,(a[2]+comR*(b[2]-a[2]))/1000];
        Lk[ii]=Math.sqrt(Math.pow(b[0]-a[0],2)+Math.pow(b[1]-a[1],2)+Math.pow(b[2]-a[2],2))/1000; }
      var w=series[omegaKey]||[];
      for(ii=0;ii<P.n;ii++){ if(!com[ii]){out[ii]=null;continue;}
        var pp=com[ii>0?ii-1:ii], qq=com[ii<P.n-1?ii+1:ii], hh=(ii>0&&ii<P.n-1)?2*dt:dt;
        if(!pp||!qq){out[ii]=null;continue;}
        var vx=(qq[0]-pp[0])/hh, vy=(qq[1]-pp[1])/hh, vz=(qq[2]-pp[2])/hh;
        var mm=massFr*Mb, I=mm*Math.pow(kR*(Lk[ii]||0),2), om=(isFinite(w[ii])?w[ii]*Math.PI/180:0);
        out[ii]=r1(0.5*mm*(vx*vx+vy*vy+vz*vz)+0.5*I*om*om); }
      return out;
    }
    var _sh=(throwS==='right'?'r_shoulder':'l_shoulder'), _el=(throwS==='right'?'r_elbow':'l_elbow'), _wr=(throwS==='right'?'r_wrist':'l_wrist');
    // [2026-05-26] 기하 레이백 — 전완(elbow→wrist)을 상완 장축(shoulder→elbow)⊥ 평면에 투영, 아래(-Y) 기준각.
    //   관절 ER 채널(Pitching_Shoulder_Angle_Z)은 GH각이라 레이백 과소(~140°). 기하각은 ~175~180°로 문헌(MER)과 일치.
    series['Pitching_Layback_X']=(function(){
      function _sb(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];} function _dt(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
      function _nr(a){return Math.sqrt(_dt(a,a))||1;} function _un(a){var n=_nr(a);return [a[0]/n,a[1]/n,a[2]/n];}
      return frames.map(function(fr){ var S=fr[_sh],E=fr[_el],W=fr[_wr];
        if(!S||!E||!W||!isFinite(S[0])||!isFinite(E[0])||!isFinite(W[0]))return null;
        var u=_un(_sb(E,S)), f=_sb(W,E);
        var fp=_sb(f,[u[0]*_dt(f,u),u[1]*_dt(f,u),u[2]*_dt(f,u)]);
        var dn=[0,-1,0], dp=_sb(dn,[u[0]*_dt(dn,u),u[1]*_dt(dn,u),u[2]*_dt(dn,u)]);
        if(_nr(fp)<1e-6||_nr(dp)<1e-6)return null;
        var c=_dt(_un(fp),_un(dp)); return r1(Math.acos(Math.max(-1,Math.min(1,c)))*180/Math.PI); });
    })();
    // [2026-05-26] 어깨 MER/레이백/ER 표시 통일 — 관절 ER 채널(GH각 ~140° 과소)을 기하 레이백으로 대체.
    //   엘리트 규준 merPk(~185°)·문헌 MER(~180°)과 정합. 원 관절 ER 은 Pitching_Shoulder_ER_Joint_X 로 보존.
    if(series['Pitching_Layback_X']){ series['Pitching_Shoulder_ER_Joint_X']=series['Pitching_Shoulder_Angle_Z']; series['Pitching_Shoulder_Angle_Z']=series['Pitching_Layback_X'].slice(); }
    series['Trunk_ME_X']=_segKE('pelvis_o','neck',0.497,0.5,0.5,'Thorax_Ang_Vel_Z');
    series['Pitching_Humerus_ME_X']=_segKE(_sh,_el,0.028,0.436,0.322,'Pitching_Hand_Ang_Vel_X');
    // [2026-05-26] GRF 불필요 분절 에너지 확장 — 관절 위치만으로 골반·전완 KE 자체 산출 → ⑥ 키네틱 체인(상지 에너지 흐름) 완성.
    // 분절 장축(두 끝점) 각속도(°/s): 장축 단위벡터의 시간당 회전각.
    function _segAngVel(prox,dist){ var out=new Array(P.n),pv=null,ii; for(ii=0;ii<P.n;ii++){ var a=frames[ii][prox],b=frames[ii][dist];
      if(!a||!b||!isFinite(a[0])||!isFinite(b[0])){ out[ii]=NaN; pv=null; continue; }
      var dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; var u=[dx/L,dy/L,dz/L];
      if(pv){ var cx=pv[1]*u[2]-pv[2]*u[1],cy=pv[2]*u[0]-pv[0]*u[2],cz=pv[0]*u[1]-pv[1]*u[0]; var s=Math.sqrt(cx*cx+cy*cy+cz*cz),d=pv[0]*u[0]+pv[1]*u[1]+pv[2]*u[2]; out[ii]=Math.atan2(s,d)/dt*180/Math.PI; } else out[ii]=0; pv=u; }
      return movavg(out,9).map(r1); }
    series['Pitching_Humerus_Ang_Vel_Z']=_segAngVel(_sh,_el);   // [2026-05-26] 상완 분절 각속도(누락분 보강 — Theia 대조용)
    series['Pitching_Forearm_Ang_Vel_Z']=_segAngVel(_el,_wr);
    series['Pitching_Forearm_ME_X']=_segKE(_el,_wr,0.022,0.43,0.303,'Pitching_Forearm_Ang_Vel_Z');         // 전완(+손) 분절 KE
    series['Pelvis_ME_X']=_segKE((throwS==='right'?'r_hip':'l_hip'),(gloveS==='right'?'r_hip':'l_hip'),0.142,0.5,0.5,'Pelvis_Ang_Vel_Z'); // 골반 분절 KE
    // ── [2026-05-26] 상지 관절 역동역학 (GRF 불필요: 손 말단 자유 개방사슬, 재귀 Newton-Euler 원위→근위) ──
    // 마커리스 한계: 관절중심 위치만으론 분절 축회전(axial) 미측정 → 횡단면 각운동 위주(어깨 내회전 토크 등 축성분 과소).
    // [2026-05-26b] 함수화: 투구팔·글러브팔 공용(글러브팔도 손 자유단 개방사슬→GRF불필요). 관절력 |R_el|·|R_sh| 노출.
    function _armKinetics(_sh,_el,_wr){
      var Mb=meta.weight_kg||86, G=[0,-9.81,0];
      function vsub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
      function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
      function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
      function nrm(a){return Math.sqrt(dot(a,a));}
      function pos(j,i){ var p=frames[i][j]; return (p&&isFinite(p[0]))?[p[0]/1000,p[1]/1000,p[2]/1000]:null; } // mm→m
      // 분절 운동학: COM, COM가속(a), 각속도(ω=u×u̇), 각가속(α), 길이(L)
      function seg(prox,dist,comR){
        var com=new Array(P.n),u=new Array(P.n),L=new Array(P.n),i;
        for(i=0;i<P.n;i++){ var p=pos(prox,i),d=pos(dist,i); if(!p||!d){com[i]=null;u[i]=null;L[i]=NaN;continue;}
          com[i]=[p[0]+comR*(d[0]-p[0]),p[1]+comR*(d[1]-p[1]),p[2]+comR*(d[2]-p[2])]; var v=vsub(d,p),l=nrm(v)||1; u[i]=[v[0]/l,v[1]/l,v[2]/l]; L[i]=nrm(v); }
        function deriv2(arr,k){ var o=new Array(P.n); for(i=0;i<P.n;i++){ var a=arr[i>0?i-1:i],b=arr[i],c=arr[i<P.n-1?i+1:i]; o[i]=(a&&b&&c)?(a[k]-2*b[k]+c[k])/(dt*dt):NaN; } return movavg(o,11); }
        var acc=[deriv2(com,0),deriv2(com,1),deriv2(com,2)];
        // ω = u × du/dt
        var om=new Array(P.n); for(i=0;i<P.n;i++){ var a=u[i>0?i-1:i],c=u[i<P.n-1?i+1:i]; if(!a||!c||!u[i]){om[i]=[0,0,0];continue;} var du=[(c[0]-a[0])/(2*dt),(c[1]-a[1])/(2*dt),(c[2]-a[2])/(2*dt)]; om[i]=cross(u[i],du); }
        function smk(arr,k){ var s=arr.map(function(v){return v?v[k]:NaN;}); return movavg(s,11); }
        var omx=smk(om,0),omy=smk(om,1),omz=smk(om,2); for(i=0;i<P.n;i++)om[i]=[omx[i]||0,omy[i]||0,omz[i]||0];
        function dk(k){ var o=new Array(P.n); for(i=0;i<P.n;i++){ var a=om[i>0?i-1:i][k],c=om[i<P.n-1?i+1:i][k]; o[i]=(c-a)/(2*dt); } return movavg(o,11); }
        var alx=dk(0),aly=dk(1),alz=dk(2); var al=new Array(P.n); for(i=0;i<P.n;i++)al[i]=[alx[i]||0,aly[i]||0,alz[i]||0];
        return {com:com,acc:acc,om:om,al:al,L:L};
      }
      var FA=seg(_el,_wr,0.43), UA=seg(_sh,_el,0.436);   // 전완(+손), 상완
      var mF=0.022*Mb, mU=0.028*Mb, kF=0.303, kU=0.322;
      var elT=new Array(P.n), elP=new Array(P.n), shT=new Array(P.n), shP=new Array(P.n), elF=new Array(P.n), shF=new Array(P.n), i;
      for(i=0;i<P.n;i++){
        var cF=FA.com[i], cU=UA.com[i], el=pos(_el,i), sh=pos(_sh,i);
        if(!cF||!cU||!el||!sh||!isFinite(FA.acc[0][i])||!isFinite(UA.acc[0][i])||!isFinite(FA.L[i])||!isFinite(UA.L[i])){ elT[i]=NaN;elP[i]=NaN;shT[i]=NaN;shP[i]=NaN;elF[i]=NaN;shF[i]=NaN; continue; }
        var aF=[FA.acc[0][i],FA.acc[1][i],FA.acc[2][i]], aU=[UA.acc[0][i],UA.acc[1][i],UA.acc[2][i]];
        // 전완 근위반력 R_el = mF*(aF - G); 팔꿈치 모멘트 M_el = It*α + (cF-el)×R_el
        var Rel=[mF*(aF[0]-G[0]),mF*(aF[1]-G[1]),mF*(aF[2]-G[2])];
        var ItF=mF*Math.pow(kF*FA.L[i],2);
        var McomF=[ItF*FA.al[i][0],ItF*FA.al[i][1],ItF*FA.al[i][2]];
        var Mel=[McomF[0]+cross(vsub(cF,el),Rel)[0], McomF[1]+cross(vsub(cF,el),Rel)[1], McomF[2]+cross(vsub(cF,el),Rel)[2]];
        // 상완: 원위(팔꿈치)에서 전완이 가하는 힘 -Rel, 모멘트 -Mel. R_sh = mU*(aU-G) + Rel
        var Rsh=[mU*(aU[0]-G[0])+Rel[0], mU*(aU[1]-G[1])+Rel[1], mU*(aU[2]-G[2])+Rel[2]];
        var ItU=mU*Math.pow(kU*UA.L[i],2);
        var McomU=[ItU*UA.al[i][0],ItU*UA.al[i][1],ItU*UA.al[i][2]];
        // M_sh = McomU + (cU-sh)×R_sh_local + (el-sh)×(-Rel) + (-Mel) ; R_sh_local=mU*(aU-G)
        var RsL=[mU*(aU[0]-G[0]),mU*(aU[1]-G[1]),mU*(aU[2]-G[2])];
        var t1=cross(vsub(cU,sh),RsL), t2=cross(vsub(el,sh),[-Rel[0],-Rel[1],-Rel[2]]);
        var Msh=[McomU[0]+t1[0]+t2[0]-Mel[0], McomU[1]+t1[1]+t2[1]-Mel[1], McomU[2]+t1[2]+t2[2]-Mel[2]];
        // 관절 상대 각속도: 팔꿈치=ωFA-ωUA, 어깨=ωUA-ωThorax(근사 0 → ωUA)
        var wRelEl=vsub(FA.om[i],UA.om[i]);
        elT[i]=r1(nrm(Mel)); elP[i]=r1(dot(Mel,wRelEl)); elF[i]=r1(nrm(Rel));
        shT[i]=r1(nrm(Msh)); shP[i]=r1(dot(Msh,UA.om[i])); shF[i]=r1(nrm(Rsh));
      }
      return {elT:elT,elP:elP,shT:shT,shP:shP,elF:elF,shF:shF};
    }
    (function(){
      var _tk=_armKinetics(_sh,_el,_wr);                                 // 투구팔
      series['Pitching_Elbow_Torque_X']=movavg(_tk.elT,7).map(r1);
      series['Pitching_Elbow_Power_X']=movavg(_tk.elP,7).map(r1);
      series['Pitching_Shoulder_Torque_X']=movavg(_tk.shT,7).map(r1);
      series['Pitching_Shoulder_Power_X']=movavg(_tk.shP,7).map(r1);
      series['Pitching_Elbow_Force_X']=movavg(_tk.elF,7).map(r1);        // [2026-05-26b 신] 팔꿈치 관절반력 |R_el|
      series['Pitching_Shoulder_Force_X']=movavg(_tk.shF,7).map(r1);     // [2026-05-26b 신] 어깨 분리력 |R_sh|
      // 표준 키(리포트 phases 의 elbowMoment/shoulderMoment = Pitching_*_Moment 가 읽음. Torque 와 동일 물리량). 팀비교·점수 일관성용.
      series['Pitching_Elbow_Moment_X']=series['Pitching_Elbow_Torque_X'].slice();
      series['Pitching_Shoulder_Moment_X']=series['Pitching_Shoulder_Torque_X'].slice();
      // 글러브팔 (손 자유단 개방사슬 — GRF 불필요, top-down 동일 로직)
      var _gsh=(gloveS==='right'?'r_shoulder':'l_shoulder'), _gel=(gloveS==='right'?'r_elbow':'l_elbow'), _gwr=(gloveS==='right'?'r_wrist':'l_wrist');
      var _gk=_armKinetics(_gsh,_gel,_gwr);
      series['Glove_Elbow_Power_X']=movavg(_gk.elP,7).map(r1);
      series['Glove_Shoulder_Power_X']=movavg(_gk.shP,7).map(r1);
      series['Glove_Humerus_Ang_Vel_Z']=_segAngVel(_gsh,_gel);
      series['Glove_Humerus_ME_X']=_segKE(_gsh,_gel,0.028,0.436,0.322,'Glove_Humerus_Ang_Vel_Z');
    })();
    // [2026-05-26] Uplift→Theia 보정계수 적용 (apply:true 인 크기변인 series 에 즉시 곱). 각도는 미적용.
    var _calibApplied={}; (function(){ var key; for(key in CALIB){ var c=CALIB[key];
      if(c.apply && series[key]){ var f=c.factor; series[key]=series[key].map(function(v){ return (v==null||!isFinite(v))?v:r2(v*f); }); _calibApplied[key]=f; } } })();
    // ── FC 몸통 열림각/뒤젖힘 (기하·플레이트 기준 — Theia 규약 호환) ──
    // 열림각: Uplift 네이티브 trunk_angle_to_plate_foot_contact - 90 (절대 타깃축 필요 → Uplift 제공값 사용)
    var _plate=Number(P.first('trunk_angle_to_plate_foot_contact'));
    var _openFC=isFinite(_plate)?r1(_plate-90):null;
    // 뒤젖힘: 몸통벡터(pelvis_o→neck)의 시상면 각도 (중력수직 + COM진행방향). 검증: Theia와 일치.
    var _leanFC=null;
    if(frames[iKl]&&frames[iKl].com&&frames[iBr]&&frames[iBr].com&&frames[iFc]&&frames[iFc].neck&&frames[iFc].pelvis_o){
      var _c0=frames[iKl].com,_c1=frames[iBr].com,_dx=_c1[0]-_c0[0],_dz=_c1[2]-_c0[2],_mm=Math.hypot(_dx,_dz)||1;
      var _td0=_dx/_mm,_td1=_dz/_mm, _Ff=frames[iFc];
      var _Tx=_Ff.neck[0]-_Ff.pelvis_o[0],_Ty=_Ff.neck[1]-_Ff.pelvis_o[1],_Tz=_Ff.neck[2]-_Ff.pelvis_o[2];
      var _Tf=_Tx*_td0+_Tz*_td1; _leanFC=r1(Math.atan2(-_Tf,_Ty)*180/Math.PI);
    }
    var _trunkFC={ openAng:_openFC, leanBack:_leanFC };
    // ── Uplift 추가 키네매틱 변인 (값만·점수無; Theia 무영향) ──
    function _pkCol(name,lo,hi){ var a=P.colNum(name); if(!a)return null; var bi=argmaxAbs(a,lo,hi); return bi<0?null:a[bi]; }
    function _romCol(name,lo,hi){ var a=P.colNum(name); if(!a)return null; var mn=Infinity,mx=-Infinity,ii; for(ii=lo;ii<=hi&&ii<a.length;ii++){var v=a[ii]; if(isFinite(v)){if(v<mn)mn=v;if(v>mx)mx=v;}} return isFinite(mn)?r1(mx-mn):null; }
    var _Mb=meta.weight_kg||86;
    var _Lt=(frames[iFc]&&frames[iFc].neck&&frames[iFc].pelvis_o)?Math.sqrt(Math.pow(frames[iFc].neck[0]-frames[iFc].pelvis_o[0],2)+Math.pow(frames[iFc].neck[1]-frames[iFc].pelvis_o[1],2)+Math.pow(frames[iFc].neck[2]-frames[iFc].pelvis_o[2],2))/1000:0.5;
    var _It=0.497*_Mb*Math.pow(0.5*_Lt,2);  // 몸통 분절 관성 (Dempster 근사)
    function _rotKE(wkey){ var w=series[wkey]||[]; var bi=argmaxAbs(w,iFc,iBr); if(bi<0)return null; var om=w[bi]*Math.PI/180; return r1(0.5*_It*om*om); }
    var _txd=(function(){ var tx=series['Trunk_Angle_X']||[],d=[],ii; for(ii=0;ii<tx.length;ii++)d.push(ii===0?0:(tx[ii]-tx[ii-1])/dt); var bi=argmaxAbs(d,iFc,iBr); return bi<0?null:d[bi]; })();
    var _uplift_extra={
      hipIR_trunk_rom: _romCol(throwS+'_hip_internal_rotation_with_respect_to_trunk', iKl, iBr),
      hipIR_trunk_vel: (function(){var v=_pkCol(throwS+'_hip_internal_rotation_velocity_with_respect_to_trunk', iKl, iBr); return v==null?null:r1(v);})(),
      trunkRotE: _rotKE('Thorax_Ang_Vel_Z'),
      trunkFlexE: (_txd==null?null:r1(0.5*_It*Math.pow(_txd*Math.PI/180,2))),
      leadKneeExtVel: (function(){var v=_pkCol(gloveS+'_knee_extension_velocity', iFc, iBr); return v==null?null:r1(Math.abs(v));})()
    };

    // kseq (회전속도 wrt ground 의 window peak 순서)
    function pk(arr,lo,hi){ var bi=argmaxAbs(arr||[],lo,hi); return bi<0?{peak_abs:null,frame_rel:null}:{peak_abs:Math.abs(arr[bi]),frame_rel:bi}; }
    var wlo=Math.max(0,iFc-Math.floor(0.3/dt)), whi=Math.min(P.n-1,iBr+Math.floor(0.1/dt));
    var segs={ pelvis:pk(series['Pelvis_Ang_Vel_Z'],wlo,whi), trunk:pk(series['Thorax_Ang_Vel_Z'],wlo,whi), arm:pk(series['Pitching_Hand_Ang_Vel_X'],wlo,whi) };
    var order=Object.keys(segs).sort(function(a,b){return (segs[a].frame_rel==null?1e9:segs[a].frame_rel)-(segs[b].frame_rel==null?1e9:segs[b].frame_rel);});
    var seqOk=JSON.stringify(order)===JSON.stringify(['pelvis','trunk','arm']);
    var deltas={}; if(segs.pelvis.frame_rel!=null&&segs.trunk.frame_rel!=null) deltas.pelvis_to_trunk_ms=r1((segs.trunk.frame_rel-segs.pelvis.frame_rel)*dt*1000);
    if(segs.trunk.frame_rel!=null&&segs.arm.frame_rel!=null) deltas.trunk_to_arm_ms=r1((segs.arm.frame_rel-segs.trunk.frame_rel)*dt*1000);
    var gains={}; if(segs.pelvis.peak_abs&&segs.trunk.peak_abs)gains.trunk_over_pelvis=r2(segs.trunk.peak_abs/segs.pelvis.peak_abs); if(segs.trunk.peak_abs&&segs.arm.peak_abs)gains.arm_over_trunk=r2(segs.arm.peak_abs/segs.trunk.peak_abs);
    var kseq={ segments:segs, deltas:deltas, peak_order:order, sequence_ok:seqOk, gains:gains };

    // 사전계산 스칼라
    function val(c){ var v=P.first(c); return v==null?null:(isFinite(Number(v))?Number(v):v); }
    var scalars={ stride_length:val('stride_length'), max_x_factor:(_xfMethod==='segment'?null:val('max_x_factor')), max_layback_angle:val('max_layback_angle'),
      arm_slot_angle:val('arm_slot_angle'), arm_slot_type:val('arm_slot_type'),
      trunk_lateral_tilt_at_fc:val('trunk_lateral_tilt_at_foot_contact'), trunk_lateral_tilt_at_br:val('trunk_lateral_tilt_at_ball_release'),
      trunk_forward_tilt_at_br:val('trunk_forward_tilt_at_ball_release'), time_to_release:val('time_to_release'),
      kinematic_sequence_order:val('kinematic_sequence_order') };

    // [2026-05-26] X-Factor 헤드라인 값은 Uplift 네이티브 max_x_factor 사용(교수 지시). 위치기반 series(~51°)·회전채널차와
    //   정의가 달라(Uplift 고유 타깃라인 기준 추정·재현불가) 시계열 리스케일은 좌투 wrap 에 취약 → 미적용.
    //   대신 phases/비효율이 scalars.max_x_factor 를 직접 헤드라인으로 사용. x_factor series 는 곡선(타이밍)용으로 유지.

    // 이벤트 스냅샷
    function at(uk,idx){ var a=P.colNum(uk); return (a&&idx!=null&&idx<a.length&&isFinite(a[idx]))?a[idx]:null; }
    var snap={ lead_knee_extension_at_fc:at(gloveS+'_knee_extension',iFc), shoulder_horizontal_adduction_at_fc:at(throwS+'_shoulder_horizontal_adduction',iFc),
      elbow_flexion_at_fc:at(throwS+'_elbow_flexion',iFc), shoulder_external_rotation_at_fc:at(throwS+'_shoulder_external_rotation',iFc),
      lead_knee_extension_at_br:at(gloveS+'_knee_extension',iBr), elbow_flexion_at_br:at(throwS+'_elbow_flexion',iBr), shoulder_external_rotation_at_br:at(throwS+'_shoulder_external_rotation',iBr) };

    // 비효율 10플래그 ("0"/"1"/"Yes"/"No")
    function toBool(v){ if(v==null)return null; var s=String(v).trim().toLowerCase(); if(s==='yes'||s==='true'||s==='1'||s==='y')return true; if(s==='no'||s==='false'||s==='0'||s==='n'||s===''||s==='nan')return false; return null; }
    var INEFF=['sway','hanging_back','closing_front_or_back','flying_open','late_rise','getting_out_in_front','knee_collapse','high_hand','early_release','forearm_flyout'];
    var inefficiencies={}; INEFF.forEach(function(k){ inefficiencies[k]=P.has(k)?toBool(P.first(k)):null; });

    // 윈도우 슬라이스 FC-2.0s ~ FC+0.5s
    var i0=Math.max(0,Math.floor(iFc-WINDOW_PRE_S*fs)), i1=Math.min(P.n,Math.floor(iFc+WINDOW_POST_S*fs)+1), nWin=i1-i0;
    function rmI(idx){ if(idx==null)return null; var n=idx-i0; return (n>=0&&n<nWin)?n:null; }
    var framesW=frames.slice(i0,i1), xfW=xfactor.slice(i0,i1), seriesW={};
    Object.keys(series).forEach(function(k){ seriesW[k]=series[k].slice(i0,i1); });
    var timesW=[]; for(i=0;i<nWin;i++) timesW.push(r3(i*dt));
    // kseq peak_idx remap
    ['pelvis','trunk','arm'].forEach(function(s){ if(kseq.segments[s]&&kseq.segments[s].frame_rel!=null) kseq.segments[s].frame_rel=rmI(kseq.segments[s].frame_rel); });
    var evW={ i_kl_peak:rmI(iKl), i_fc:rmI(iFc), i_mer:rmI(ev.i_mer), i_br:rmI(iBr), peak_hand_speed_ms:ev.peak_hand_speed_ms, events_source:ev.events_source };

    // [2026-06-11] 품질 게이트(Uplift 전용·표시용) — 약투구(비대표 투구) 자동 플래그.
    //  상동고 14쌍: 이준우 3.2m/s(약투구·무릎 추적 동반 붕괴)·정상 12~17m/s. 저속<10은 코호트 변별 약화.
    //  ★한계: 매끄러운 관절 추적편향(지상우류, 손속도·지터 정상인데 관절각만 어긋남)은 자기완결 QC로 불검출 → 정답지(Theia) 필요. 임계 잠정(데이터 확대 시 보정).
    var _hs=ev.peak_hand_speed_ms;
    var _qc={ peak_hand_speed_ms:(_hs!=null?r2(_hs):null),
      level:(_hs==null?'unknown':(_hs<5?'weak':(_hs<10?'low':'ok'))),
      weak_pitch:(_hs!=null&&_hs<5),
      flags:[], note:'매끄러운 관절 추적편향은 미검출(정답지 필요)' };
    if(_hs!=null&&_hs<5)_qc.flags.push('약투구(비대표 — 코호트 제외 권장)');
    else if(_hs!=null&&_hs<10)_qc.flags.push('저속 투구(참고·저신뢰)');

    return {
      qc:_qc,
      trial_label: trialLabel||'Trial',
      meta:{ athlete:athlete, fps:fs, dt:dt, n_frames:nWin, duration_s:r3(nWin*dt), hand:hand, throw_side:throwS, glove_side:gloveS,
        handedness:throwS.charAt(0).toUpperCase(), height_m:meta.height_m||null, weight_kg:meta.weight_kg||null,
        ground_y_m:groundY, axis_up:'Y', window_t_start_in_trial:r3(i0*dt), original_n_frames:P.n,
        scale_correction:r2(_scale), calib_applied:_calibApplied, calib_ref:'CALIB 2026-05-26 (상동고 14쌍 검증)' },
      events:evW, times:timesW, frames:framesW, x_factor:xfW, x_factor_method:_xfMethod, series:seriesW, kseq:kseq,
      scalars:scalars, snap:snap, inefficiencies:inefficiencies, detected_throw_side:throwS, throw_side:throwS, glove_side:gloveS,
      trunk_fc:_trunkFC,
      uplift_extra:_uplift_extra,
      // 검증용(윈도우 전 절대 인덱스)
      _abs:{ i_kl_peak:iKl, i_fc:iFc, i_mer:ev.i_mer, i_br:iBr }
    };
  }

  return { extractTrial:extractTrial, detectEvents:detectEvents };
});
