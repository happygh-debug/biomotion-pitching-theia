// extract_theia.js — extract_theia.py 의 JS 포팅 (점진적). 현재: 이벤트·윈도우 셋업.
// 입력 c3d 는 이미 스무딩본 가정 → 신호처리 없음(이벤트는 EVENT_LABEL 컬럼에서 읽음).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./parse_c3dtxt.js'));
  else root.extractTheia = factory(root.parseC3DTxt);
})(typeof self !== 'undefined' ? self : this, function (parseC3DTxt) {
  const WINDOW_PRE_S = 2.0, WINDOW_POST_S = 0.5;

  function grabEvent(col) {                       // EVENT_LABEL: 첫 finite·non-zero 값(초)
    if (!col) return null;
    for (let i = 0; i < col.length; i++) { const v = col[i]; if (isFinite(v) && v !== 0) return v; }
    return null;
  }
  function tToIdx(t, tArr) {                       // 최근접 프레임 (t<=0/NaN 무시, NaN-safe)
    if (t === null || !isFinite(t) || t <= 0) return null;
    let best = -1, bd = Infinity;
    for (let i = 0; i < tArr.length; i++) { const x = tArr[i]; if (!isFinite(x)) continue; const d = Math.abs(x - t); if (d < bd) { bd = d; best = i; } }
    return best < 0 ? null : best;
  }
  function unwrapDeg(a) {                          // np.unwrap(deg→rad)→deg
    const out = a.slice(); const TWO = 2 * Math.PI; let prev = null, off = 0;
    for (let i = 0; i < out.length; i++) {
      let r = out[i] * Math.PI / 180; if (!isFinite(r)) { continue; }
      if (prev !== null) { let d = r + off - prev; while (d > Math.PI) { off -= TWO; d -= TWO; } while (d < -Math.PI) { off += TWO; d += TWO; } }
      const adj = r + off; out[i] = adj * 180 / Math.PI; prev = adj;
    }
    return out;
  }
  function argmaxAbs(arr, lo, hi) { let bi = -1, bv = -Infinity; for (let i = lo; i <= hi && i < arr.length; i++) { const v = Math.abs(arr[i]); if (isFinite(v) && v > bv) { bv = v; bi = i; } } return bi; }

  // parsed: parseC3DTxt 결과. meta: {height_m, weight_kg, handedness}
  function extractSetup(parsed, meta) {
    const col = parsed.col.bind(parsed);
    const timeFull = col('TIME_X');
    let nKin = 0; for (let i = 0; i < timeFull.length; i++) if (isFinite(timeFull[i])) nKin = i + 1;
    if (!nKin) throw new Error('TIME 컬럼이 모두 NaN');
    const forceOversample = Math.max(1, Math.floor(parsed.nRows / nKin));
    const nTotal = nKin;
    // kinematic 시간축
    const tArr = timeFull.slice(0, nKin);
    let dt = (nTotal > 1) ? (tArr[1] - tArr[0]) : (1 / 300);
    if (!isFinite(tArr[0])) { for (let i = 0; i < nTotal; i++) tArr[i] = i / 300; dt = 1 / 300; }
    const fs = dt > 0 ? 1 / dt : 300;

    // 이벤트 (kinematic 범위에서 읽기)
    const kinCol = (k) => { const c = col(k); return c ? c.slice(0, nKin) : null; };
    const tKL = grabEvent(kinCol('MaxKneeHeight_X')), tFC = grabEvent(kinCol('Footstrike_X')),
          tMER = grabEvent(kinCol('Max_Shoulder_Rot_X')), tBR = grabEvent(kinCol('Release_X')),
          tBR100 = grabEvent(kinCol('Release100msAfter_X'));
    let iKLa = tToIdx(tKL, tArr), iFCa = tToIdx(tFC, tArr), iMERa = tToIdx(tMER, tArr),
          iBRa = tToIdx(tBR, tArr), iBR100a = tToIdx(tBR100, tArr);
    // ── 비정상 태그 sanity (릴리스가 MKH 이전/동일, MER가 MKH 이전 = 손상) → 무효화 후 자동검출 ──
    if (iBRa!=null && iKLa!=null && iBRa<=iKLa) iBRa=null;
    if (iMERa!=null && iKLa!=null && iMERa<iKLa) iMERa=null;
    // ── 이벤트 태깅 누락/무효 시 자동검출 폴백 (연구실 정의; 검증 MAE: MKH0.1·FC0.9·MER6.2·BR2.5ms) ──
    function _amaxKin(key){ var c=kinCol(key); if(!c)return null; var bi=-1,bv=-Infinity,i; for(i=0;i<c.length;i++){ var v=c[i]; if(isFinite(v)&&v>bv){bv=v;bi=i;} } return bi>=0?bi:null; }
    if (iKLa === null) { var _leadKnee=((meta.handedness||'R').toUpperCase()==='L')?'R_KNEE_Z':'L_KNEE_Z'; iKLa=_amaxKin(_leadKnee); if(iKLa!=null)console.warn('MKH 자동검출(리드 무릎 Z)'); }
    if (iMERa === null) { iMERa=_amaxKin('Pitching_Shoulder_Angle_Z'); if(iMERa!=null)console.warn('MER 자동검출(어깨 외회전 최대)'); }
    if (iBRa === null) { iBRa=_amaxKin('Pitching_Hand_Ang_Vel_X'); if(iBRa!=null)console.warn('Release 자동검출(손각속도 최대)'); }
    if (iFCa === null) { var _f1=col('FP1_Z'),_f2=col('FP2_Z');
      function _em(arr){ if(!arr)return Infinity; var s=0,c=0,lim=Math.min(arr.length,forceOversample*Math.max(10,Math.floor(fs*0.5))); for(var j=0;j<lim;j++){var v=Math.abs(arr[j]); if(isFinite(v)){s+=v;c++;}} return c?s/c:Infinity; }
      var _lead=(_em(_f1)<_em(_f2))?_f1:_f2;  // 앞발판=셋업초기 적재 적은 쪽(뒷발이 FP2일 수도)
      if(_lead){ var _lo=(iKLa!=null?iKLa:0)*forceOversample, _i; for(_i=_lo;_i<_lead.length;_i++){ if(isFinite(_lead[_i])&&_lead[_i]>10){ iFCa=Math.min(nKin-1,Math.floor(_i/forceOversample)); break; } } }
      if(iFCa!=null)console.warn('FC 자동검출(MKH 이후 앞발 GRF>10N · 앞발판 자동판별)'); }
    if (iFCa === null || iBRa === null) throw new Error('Footstrike/Release 이벤트 미검출(자동검출도 실패)');
    // [2026-05-26] 퇴화 이벤트 거부: 자동검출 argmax가 신호 결손으로 프레임 시작부(≤3)를 반환하거나 순서가 비정상이면
    //   무효 트라이얼로 throw → 소비자(대시보드/분석)가 건너뜀. (이준우 T9: KL·BR 태그 결손+자동검출 실패로 br=1 → 집계 오염)
    if ((iKLa!=null && iKLa<=3) || iBRa<=3 || iBRa<=iFCa || (iBRa-iFCa) > fs)
      throw new Error('이벤트 검출 실패(KH/릴리스 비정상 — 신호 결손 추정) — 무효 트라이얼 제외');

    const iLo = Math.max(0, iFCa - Math.floor(WINDOW_PRE_S * fs));
    const iHi = Math.min(nTotal - 1, iFCa + Math.floor(WINDOW_POST_S * fs));
    const nFrames = iHi - iLo + 1;
    const a2w = (ia) => (ia === null || ia < iLo || ia > iHi) ? null : (ia - iLo);
    let iKL = a2w(iKLa), iFC = a2w(iFCa), iMER_event = a2w(iMERa), iBR = a2w(iBRa), iBR100 = a2w(iBR100a);

    // MER 재정의: ER(|Z|) peak (입력이 이미 스무딩이므로 unwrap 만, 재스무딩 X)
    let iMER_erpeak = iMER_event;
    const erz = kinCol('Pitching_Shoulder_Angle_Z');
    if (erz && iFC !== null && iBR !== null && iBR > iFC) {
      const w = unwrapDeg(erz.slice(iLo, iHi + 1));
      const bi = argmaxAbs(w, iFC, iBR);
      if (bi >= 0) iMER_erpeak = bi;
    }
    // ── 투구 동작 시작(onset) = 다리 들기 시작: 리드 무릎 수직(Z)이 KH 직전 최저점에서 상승 전환하는 지점 ──
    //   [2026-06-03] 시작 이벤트 정의(이전엔 없어 스틱이 'KH 전 임의 N초'로 시작). 상승속도 임계 후방탐색.
    let iStartA = null;
    (function () {
      if (iKLa == null) return;
      const lkKey = ((meta.handedness || 'R').toUpperCase() === 'L') ? 'R_KNEE_Z' : 'L_KNEE_Z';
      const lk = kinCol(lkKey);
      if (!lk || iKLa - iLo < 3) return;
      const sm = (i) => { let s = 0, c = 0; for (let k = i - 1; k <= i + 1; k++) { if (k >= 0 && k < lk.length && isFinite(lk[k])) { s += lk[k]; c++; } } return c ? s / c : lk[i]; };
      // 들기 범위: [iLo,iKLa]의 최저(베이스) → KH(정점). 베이스에서 10% 상승한 순간 = 본격 상승 시작.
      let base = Infinity; for (let i = iLo; i <= iKLa; i++) { const v = sm(i); if (isFinite(v) && v < base) base = v; }
      const apex = sm(iKLa), rng = apex - base;
      if (!isFinite(rng) || rng <= 0) return;
      const hthr = base + 0.10 * rng;
      let onset = iLo;                       // KH에서 뒤로: 높이가 임계 미만으로 떨어지는 첫 지점(상승 시작 지점)
      for (let i = iKLa; i > iLo; i--) { if (sm(i) < hthr) { onset = i; break; } }
      iStartA = onset;
    })();
    const iStart = a2w(iStartA);
    return {
      nKin, nTotal, nFrames, fs, dt, forceOversample, iLo, iHi,
      events: {
        i_start: iStart, i_kl_peak: iKL, i_fc: iFC, i_mer_event: iMER_event, i_mer_erpeak: iMER_erpeak, i_br: iBR, i_br100: iBR100,
        t_start_s: iStart !== null ? tArr[iLo + iStart] - tArr[iLo] : null,
        t_kl_peak_s: iKL !== null ? tArr[iLo + iKL] - tArr[iLo] : null,
        t_fc_s: iFC !== null ? tArr[iLo + iFC] - tArr[iLo] : null,
        t_br_s: iBR !== null ? tArr[iLo + iBR] - tArr[iLo] : null,
      },
    };
  }

  // ── 유틸 ──
  function ffillbfill(a){ const o=a.slice(); let last=null;
    for(let i=0;i<o.length;i++){ if(isFinite(o[i])) last=o[i]; else if(last!==null) o[i]=last; }
    let nxt=null; for(let i=o.length-1;i>=0;i--){ if(isFinite(o[i])) nxt=o[i]; else if(nxt!==null) o[i]=nxt; } return o; }
  const r3=x=>isFinite(x)?Math.round(x*1000)/1000:NaN;
  const r2=x=>isFinite(x)?Math.round(x*100)/100:NaN;
  function seriesPeak(arr,lo,hi){ if(!arr||!arr.length) return {peak_abs:null,peak_signed:null,frame_rel:null};
    lo=Math.max(0,Math.min(lo,arr.length-1)); hi=Math.max(lo,Math.min(hi,arr.length-1));
    let bi=-1,bv=-Infinity; for(let i=lo;i<=hi;i++){const v=Math.abs(arr[i]); if(isFinite(v)&&v>bv){bv=v;bi=i;}}
    if(bi<0) return {peak_abs:null,peak_signed:null,frame_rel:null};
    return {peak_abs:Math.abs(arr[bi]),peak_signed:arr[bi],frame_rel:bi}; }

  const SKIP_TYPES=new Set(['INDEX','EVENT_LABEL']);
  const SKIP_KEYS=new Set(['_index','FRAMES_X','TIME_X']);
  const WRAP_COLS=new Set(['Pitching_Shoulder_Angle_Z']);

  function buildSeries(parsed,setup){
    const {iLo,iHi}=setup; const series={};
    for(const c of parsed.columns){
      if(SKIP_TYPES.has(c.type)||SKIP_KEYS.has(c.key)) continue;
      const full=parsed.col(c.key); if(!full) continue;
      let w=ffillbfill(full.slice(iLo,iHi+1));
      if(!w.some(isFinite)) continue;
      if(WRAP_COLS.has(c.key)) w=unwrapDeg(w);
      series[c.key]=w.map(r3);
    }
    // [2026-06-20] ME(역학에너지) 합성: 신규 Visual3D export는 분절 ME를 PE+RKE+TKE 3성분으로 분해해서 냄.
    //   엔진(phases.js)은 합본 *_ME_X(humME·trunkME·gloveHumME)를 읽으므로, 합본이 없고 3성분이 있으면 합성한다.
    //   ME = 위치에너지(PE) + 회전운동에너지(RKE) + 병진운동에너지(TKE) — Visual3D 분절 ME 정의·엘리트 코호트 ME 채널과 동일.
    const _peKeys = Object.keys(series).filter(k => /_PE_X$/.test(k));
    for (const peK of _peKeys) {
      const seg = peK.slice(0, -5);                 // strip "_PE_X"
      const meK = seg + '_ME_X', rkeK = seg + '_RKE_X', tkeK = seg + '_TKE_X';
      if (series[meK] || !series[rkeK] || !series[tkeK]) continue;
      const A = series[peK], B = series[rkeK], C = series[tkeK], n = A.length, out = new Array(n);
      for (let i = 0; i < n; i++) { out[i] = (isFinite(A[i]) && isFinite(B[i]) && isFinite(C[i])) ? r3(A[i] + B[i] + C[i]) : NaN; }
      series[meK] = out;
    }
    // [2026-06-23] Power 별칭: 신규 V3D export(force power 추가본)는 관절파워를 Moment_Power(생성·M·ω) + Force_Power(전달·F·v)로 분리.
    //   엔진(phases.js)은 합본 *_Power_X(=옛 V3D Compute Joint Power=moment power)를 읽으므로, 합본 없고 Moment_Power 있으면 별칭(채점 불변).
    //   Force_Power(*_Force_Power_X)는 위 루프서 series에 pass-through됨 → 신규 직접전달 변인서 사용.
    const _mpKeys = Object.keys(series).filter(k => /_Moment_Power_X$/.test(k));
    for (const mpK of _mpKeys) {
      const powerK = mpK.replace(/_Moment_Power_X$/, '_Power_X');
      if (!series[powerK] && series[mpK]) series[powerK] = series[mpK];
    }
    return series;
  }
  // [2026-05-28] X-Factor = 3D 분절 상대축회전(S)을 주 정의로 사용(OBP 검증).
  //   (S) 분절 상대 축회전: Visual3D Trunk_wrt_Pelvis_Angle_Z(골반·몸통 분절좌표계 상대 Z회전) = X-Factor 본래 취지(축중심 상대회전). OBP hip-shoulder separation과 일치(med~30°).
  //   (G) 글로벌 수평면 분리각: 골반선·어깨선을 수평면(인덱스 0,2)에 투영. 전통적 표기지만 몸통 측면기울기가 섞여 ~18° 과대(med~50°) → 참고용(setup._xf_glob_ref)으로만 보관.
  //   seg열(Trunk_wrt_Pelvis_Angle_Z)이 없으면 G로 폴백. setup._xf_method 에 'segment'|'global' 기록. 좌/우투 부호 자동통일.
  function _orientXf(a, ikl, ibr){
    if(!a) return a; var bi=-1,bv=-Infinity,i;
    for(i=ikl;i<=ibr&&i<a.length;i++){ var v=Math.abs(a[i]); if(isFinite(v)&&v>bv){bv=v;bi=i;} }
    if(bi>=0 && a[bi]<0){ for(i=0;i<a.length;i++) a[i]=isFinite(a[i])?-a[i]:a[i]; }
    return a;
  }
  function buildXFactor(frames,setup,parsed,meta){
    const nF=frames.length;
    function hang(p,q){ return (p&&q&&isFinite(p[0])&&isFinite(q[0]))?Math.atan2(q[2]-p[2], q[0]-p[0])*180/Math.PI:NaN; }
    var glob=new Array(nF);
    for(let i=0;i<nF;i++){ const f=frames[i]||{};
      var hip=hang(f.l_hip,f.r_hip), sho=hang(f.l_shoulder,f.r_shoulder);
      glob[i]=(isFinite(hip)&&isFinite(sho))?(((sho-hip+180)%360+360)%360-180):NaN; }
    glob=ffillbfill(glob);
    var segCol=parsed?parsed.col('Trunk_wrt_Pelvis_Angle_Z'):null;
    var seg = segCol ? ffillbfill(segCol.slice(setup.iLo,setup.iHi+1)) : null;
    const ikl=(setup.events&&setup.events.i_kl_peak)||0, ibr=(setup.events&&setup.events.i_br!=null)?setup.events.i_br:nF-1;
    glob=_orientXf(glob,ikl,ibr); if(seg)seg=_orientXf(seg,ikl,ibr);
    function pkAbs(a){ if(!a)return null; var b=0,i; for(i=ikl;i<=ibr&&i<a.length;i++){var v=Math.abs(a[i]);if(isFinite(v)&&v>b)b=v;} return b; }
    var dlv=String((meta&&meta.delivery)||'').toUpperCase();
    var gpk=pkAbs(glob), method='global', sel=glob;
    // [2026-05-28] X-Factor를 3D 분절 상대축회전(S, Trunk_wrt_Pelvis_Angle_Z)으로 재정의.
    //   근거: Driveline OBP hip-shoulder separation과 일치(상동고 S med 29.6°/q1 23.7/q3 34.4 ≈ OBP 32.3°/27.6/36.7).
    //   글로벌 수평투영(G)은 med 49.9°로 ~18° 과대(몸통 측면기울기가 섞임). seg열 없으면 G로 폴백.
    if(seg){ method='segment'; sel=seg; }
    setup._xf_method=method; setup._xf_glob_ref=gpk; // G는 참고용으로만 보관(전통 50±12° 비교)
    return sel.map(r2);
  }
  function extractGRF(parsed,setup,bodyWeightN){
    const {iLo,iHi,nFrames,forceOversample:K,fs}=setup; const fsForce=fs*K, dtForce=1/fsForce;
    const fpFull={}; for(const c of parsed.columns){ if(c.key.startsWith('FP1')||c.key.startsWith('FP2')) fpFull[c.key]=parsed.col(c.key); }
    const anyLen=(Object.values(fpFull)[0]||[]).length;
    const fLo=iLo*K, fHi=Math.min((iHi+1)*K-1, anyLen-1);
    const hi={}, lo={};
    for(const k in fpFull){ const sub=fpFull[k].slice(fLo,fHi+1); hi[k]=sub.map(r2);
      const nkf=Math.floor(sub.length/K); const kin=[];
      for(let j=0;j<nkf;j++){ let sm=0,cn=0; for(let m=0;m<K;m++){const v=sub[j*K+m]; if(isFinite(v)){sm+=v;cn++;}} kin.push(cn?sm/cn:NaN); }
      while(kin.length<nFrames) kin.push(NaN); lo[k]=kin.slice(0,nFrames).map(r2); }
    const ev=setup.events;
    function summ(pre){ const z=hi[pre+'_Z']; const out={}; if(!z||!z.length) return out;
      const zf=z.filter(isFinite); if(!zf.length) return out;
      const peakN=Math.max(...zf.map(Math.abs)); out.peak_z_N=Math.round(peakN*10)/10;
      out.peak_z_pct_bw=bodyWeightN>0?Math.round(peakN/bodyWeightN*1000)/10:null;
      const ifc=ev.i_fc, ibr=ev.i_br;
      if(ifc!=null&&ibr!=null){ const ffc=ifc*K, fbr=ibr*K;
        if(ffc>=0&&ffc<z.length&&ffc<fbr&&fbr<z.length){ let sum=0; for(let i=ffc;i<=fbr;i++) if(isFinite(z[i])) sum+=z[i];
          const imp=sum*dtForce; out.impulse_Ns=Math.round(imp*100)/100; out.impulse_pct_bw_s=bodyWeightN>0?Math.round(imp/bodyWeightN*10000)/100:null; } }
      return out; }
    return { fp1:summ('FP1'), fp2:summ('FP2'), lo, series_hi:hi, fs_force:Math.round(fsForce*10)/10, oversample:K, lead_rear_status:'VERIFIED_BY_DATA', convention_note:'FP1=Rear, FP2=Lead (연구원 확정)', body_weight_N:Math.round(bodyWeightN*10)/10 };
  }
  function kseqAnalyze(series,events,dt){
    const ifc=events.i_fc, ibr=events.i_br;
    if(ifc==null||ibr==null) return {segments:{},deltas:{},peak_order:[],sequence_ok:false,gains:{}};
    const pelvis=series['Pelvis_Ang_Vel_Z']||[], trunk=series['Thorax_Ang_Vel_Z']||[];
    let arm=series['Pitching_Hand_Ang_Vel_X']||[]; if(!arm.length) arm=series['Pitching_Forearm_Ang_Vel_Z']||[];
    function pk(arr,lo,hi){ if(!arr.length) return {peak_abs:null,frame_rel:null};
      lo=Math.max(0,Math.min(lo,arr.length-1)); hi=Math.max(lo,Math.min(hi,arr.length-1));
      let bi=-1,bv=-Infinity; for(let i=lo;i<=hi;i++){const v=Math.abs(arr[i]); if(isFinite(v)&&v>bv){bv=v;bi=i;}}
      return bi<0?{peak_abs:null,frame_rel:null}:{peak_abs:Math.abs(arr[bi]),frame_rel:bi}; }
    const wlo=Math.max(0,ifc-Math.floor(0.3/dt)), whi=Math.min((pelvis.length||1)-1, ibr+Math.floor(0.1/dt));
    const segs={pelvis:pk(pelvis,wlo,whi),trunk:pk(trunk,wlo,whi),arm:pk(arm,wlo,whi)};
    const order=Object.keys(segs).sort((a,b)=>(segs[a].frame_rel??1e9)-(segs[b].frame_rel??1e9));
    const seqOk=JSON.stringify(order)===JSON.stringify(['pelvis','trunk','arm']);
    const deltas={};
    if(segs.pelvis.frame_rel!=null&&segs.trunk.frame_rel!=null) deltas.pelvis_to_trunk_ms=Math.round((segs.trunk.frame_rel-segs.pelvis.frame_rel)*dt*1000*10)/10;
    if(segs.trunk.frame_rel!=null&&segs.arm.frame_rel!=null) deltas.trunk_to_arm_ms=Math.round((segs.arm.frame_rel-segs.trunk.frame_rel)*dt*1000*10)/10;
    const gains={};
    if(segs.pelvis.peak_abs&&segs.trunk.peak_abs) gains.trunk_over_pelvis=Math.round(segs.trunk.peak_abs/segs.pelvis.peak_abs*100)/100;
    if(segs.trunk.peak_abs&&segs.arm.peak_abs) gains.arm_over_trunk=Math.round(segs.arm.peak_abs/segs.trunk.peak_abs*100)/100;
    return {segments:segs,deltas,peak_order:order,sequence_ok:seqOk,gains};
  }
  function buildScalars(series,xfactor,parsed,ev,grf,nFrames){
    const at=(c,i)=>{ const a=series[c]; if(!a||i==null||i>=a.length) return null; const v=a[i]; return isFinite(v)?v:null; };
    const sp=(c,lo,hi,signed)=>{ const r=seriesPeak(series[c]||[],lo||0,hi||0); return signed?r.peak_signed:r.peak_abs; };
    const ifc=ev.i_fc,ibr=ev.i_br,ikl=ev.i_kl_peak;
    const strideFirst=(key)=>{ const full=parsed.col(key); if(!full) return null; for(const v of full){ if(isFinite(v)&&v!==0) return v; } return null; };
    const xfWin=xfactor.slice(ikl||0,(ibr!=null?ibr+1:xfactor.length)).filter(isFinite);
    return {
      shoulder_er_max: sp('Pitching_Shoulder_Angle_Z',ifc||0,ibr||0,true),
      pelvis_rot_velo_peak: sp('Pelvis_Ang_Vel_Z',ikl||0,ibr||0,false),
      trunk_rot_velo_peak: sp('Thorax_Ang_Vel_Z',ikl||0,ibr||0,false),
      elbow_flex_fp: at('Pitching_Elbow_Angle_X',ifc), shoulder_abd_fp: at('Pitching_Shoulder_Angle_Y',ifc), // [CALC-006] 어깨 외전=Angle_Y(OBP 대조: FC 외전 ~90°). Angle_X는 수평외전(scap_load)이므로 X→Y로 정정
      lead_knee_fp: at('Lead_Knee_Angle_X',ifc), lead_knee_br: at('Lead_Knee_Angle_X',ibr), back_knee_fp: at('Back_Knee_Angle_X',ifc),
      x_factor_max: xfWin.length?Math.max(...xfWin):null,
      stride_length: strideFirst('STRIDE_LENGTH_X'),
      grf_fp1_peak_pct_bw: grf.fp1.peak_z_pct_bw, grf_fp2_peak_pct_bw: grf.fp2.peak_z_pct_bw,
      lead_knee_power_peak: sp('Lead_Knee_Power_X',0,nFrames-1,false), back_knee_power_peak: sp('Back_Knee_Power_X',0,nFrames-1,false),
      lead_hip_power_peak: sp('Lead_Hip_Power_X',0,nFrames-1,false), back_hip_power_peak: sp('Back_Hip_Power_X',0,nFrames-1,false),
      elbow_power_peak: sp('Pitching_Elbow_Power_X',0,nFrames-1,false), shoulder_power_peak: sp('Pitching_Shoulder_Power_X',0,nFrames-1,false),
    };
  }

  // ── 3D frames (좌표변환, mm) — extract_theia.py:249 포팅. command 릴리즈 + 3D 스틱용 ──
  const ALL_LM=["PELVIS_O","NECK","HEAD","L_SHOULDER","R_SHOULDER","L_ELBOW","R_ELBOW","L_WRIST","R_WRIST",
                "L_HIP","R_HIP","L_KNEE","R_KNEE","L_HEEL","R_HEEL","L_TOE","R_TOE","L_HAND_TIP","R_HAND_TIP"];
  function _meanSlice(a,n){ let s=0,c=0; for(let i=0;i<n&&i<a.length;i++){const v=a[i]; if(isFinite(v)){s+=v;c++;}} return c?s/c:NaN; }
  function _minSlice(a,n){ let m=Infinity; for(let i=0;i<n&&i<a.length;i++){const v=a[i]; if(isFinite(v)&&v<m)m=v;} return isFinite(m)?m:0; }
  function buildFrames(parsed,setup,throwSide){
    const {iLo,iHi,nFrames,fs}=setup;
    const colW=(key)=>{ const c=parsed.col(key); return c?c.slice(iLo,iHi+1):null; };
    const present=ALL_LM.filter(lm=>parsed.keyIndex[lm+'_X']!==undefined);
    let footRef=(throwSide==='right')?'R_HEEL':'L_HEEL';
    if(parsed.keyIndex[footRef+'_X']===undefined) footRef=present[0];
    const setupN=Math.min(Math.floor(fs*0.5), nFrames-1);
    let axisUp='Z', horiz=['X','Y'];
    if(setupN>1){
      // 수직축 = 셋업에서 '머리(상단)−발' 차이가 가장 큰 축(서 있는 자세에선 키 방향이 지배적).
      // (이전: 발 좌표 최소값 축 → 전후축 원점이 음수면 오검출. 홍주환 등 좌투에서 Y 오검출로 뷰가 90° 틀어지던 버그)
      // 단일 마커(HEAD/HEEL)만 쓰면 마커 누락·노이즈 시 축이 뒤집혀 스틱이 눕는 버그가 재발 → 머리·발 후보를 여러 개 평균해 견고화.
      const topRefs=['HEAD','NECK','PELVIS_O'].filter(r=>parsed.keyIndex[r+'_X']!==undefined);
      const footRefs=['R_HEEL','L_HEEL','R_TOE','L_TOE','R_ANKLE','L_ANKLE'].filter(r=>parsed.keyIndex[r+'_X']!==undefined);
      const tR=topRefs.length?topRefs:['PELVIS_O'], fR=footRefs.length?footRefs:[footRef];
      const spread={};
      for(const a of ['X','Y','Z']){ let acc=0,cnt=0;
        for(const tr of tR){ for(const fr of fR){ const ct=colW(tr+'_'+a), cf=colW(fr+'_'+a);
          if(ct&&cf){ const d=Math.abs(_meanSlice(ct,setupN)-_meanSlice(cf,setupN)); if(isFinite(d)){ acc+=d; cnt++; } } } }
        spread[a]=cnt?acc/cnt:-Infinity; }
      axisUp=['X','Y','Z'].reduce((b,a)=>spread[a]>spread[b]?a:b,'X');
      // Theia 표준은 Z-up. 검출 1·2위 축 차이가 근소(<15%)해 모호하면 표준 Z 로 안전하게 고정.
      const ranked=['X','Y','Z'].filter(a=>isFinite(spread[a])).sort((p,q)=>spread[q]-spread[p]);
      if(ranked.length>=2 && axisUp!=='Z' && isFinite(spread.Z) && spread.Z >= spread[ranked[0]]*0.85) axisUp='Z';
      horiz=['X','Y','Z'].filter(a=>a!==axisUp);
    }
    const upArr=colW(footRef+'_'+axisUp)||[], h0Arr=colW(footRef+'_'+horiz[0])||[], h1Arr=colW(footRef+'_'+horiz[1])||[];
    const ground=_minSlice(upArr,setupN), trailH0=_meanSlice(h0Arr,setupN), trailH1=_meanSlice(h1Arr,setupN);
    const lmArrs={}; for(const lm of present){ lmArrs[lm]={h0:colW(lm+'_'+horiz[0]),up:colW(lm+'_'+axisUp),h1:colW(lm+'_'+horiz[1])}; }
    const com={h0:colW('COM_displacement_'+horiz[0]),up:colW('COM_displacement_'+axisUp),h1:colW('COM_displacement_'+horiz[1])};
    const r1=x=>isFinite(x)?Math.round(x*10)/10:NaN;
    const frames=[];
    for(let i=0;i<nFrames;i++){ const fr={};
      for(const lm of present){ const A=lmArrs[lm];
        fr[lm.toLowerCase()]=[ r1(-((A.h0?A.h0[i]:NaN)-trailH0)*1000), r1(((A.up?A.up[i]:NaN)-ground)*1000), r1(((A.h1?A.h1[i]:NaN)-trailH1)*1000) ]; }
      if(com.h0&&com.up&&com.h1){ const cv=[-(com.h0[i]-trailH0)*1000,(com.up[i]-ground)*1000,(com.h1[i]-trailH1)*1000]; if(cv.every(isFinite)) fr.com=cv.map(r1); }
      frames.push(fr);
    }
    return {frames, ground_y_m:ground, viewer_origin_horiz0_m:trailH0, viewer_origin_horiz1_m:trailH1, axis_up:axisUp, horiz_axes:horiz};
  }

  function _detectThrowSide(parsed){
    function pk(pre){const x=parsed.col(pre+'_X');if(!x)return 0;const y=parsed.col(pre+'_Y'),z=parsed.col(pre+'_Z');let m=0;for(let i=1;i<x.length;i++){const dx=x[i]-x[i-1],dy=y?y[i]-y[i-1]:0,dz=z?z[i]-z[i-1]:0;const s=Math.sqrt(dx*dx+dy*dy+dz*dz);if(isFinite(s)&&s>m)m=s;}return m;}
    const R=Math.max(pk('R_WRIST'),pk('R_HAND_TIP')), L=Math.max(pk('L_WRIST'),pk('L_HAND_TIP'));
    if(!R&&!L) return null; return R>=L?'right':'left';
  }
  function extractTrial(parsed,meta){
    const setup=extractSetup(parsed,meta||{});
    const ev=Object.assign({},setup.events,{i_mer:setup.events.i_mer_erpeak});
    setup.events=ev;
    const throwSide=((meta&&meta.handedness)||'R').toUpperCase().charAt(0)==='L'?'left':'right';
    // [2026-05-26] ★핸드-팔 정합 가드: 이 Theia export는 위치를 R_(문자그대로 오른쪽)로만 내보내는 경우가 있음.
    //   LHP(투구팔=좌)인데 L_WRIST 위치 채널이 없으면 frame.r_wrist는 글러브팔(우) → 위치기반 투구팔 분석(손목속도·팔 역동역학) 무효.
    //   (각도/각속도/파워는 Pitching_* 채널로 투구팔이 올바름.) 소비자가 오인하지 않도록 플래그·경고.
    const _twKey=(throwSide==='right')?'R_WRIST':'L_WRIST';
    const throwing_wrist_pos_available = (parsed.keyIndex && parsed.keyIndex[_twKey+'_X']!==undefined);
    if(!throwing_wrist_pos_available) console.warn('[핸드-팔 경고] 투구팔('+throwSide+') 손목 위치('+_twKey+') 채널 없음 → frame 팔 위치는 글러브팔. 위치기반 투구팔 분석(손목속도·역동역학) 사용 금지(각속도/파워는 Pitching_* 채널 사용).');
    const series=buildSeries(parsed,setup);
    const _fb=buildFrames(parsed,setup,throwSide); const frames=_fb.frames;
    const xfactor=buildXFactor(frames,setup,parsed,meta);
    // [2026-06-05] UI 시계열 SSOT = orient 적용된 x_factor (series 원본과 부호 불일치 방지)
    if(series['Trunk_wrt_Pelvis_Angle_Z']) series['Trunk_wrt_Pelvis_Angle_Z']=xfactor.slice();
    const bw=( (meta&&meta.weight_kg)||80 )*9.81;
    const grf=extractGRF(parsed,setup,bw);
    for(const k in grf.lo) series[k]=grf.lo[k];
    // ── 뒷발 플레이트 자동판별 → FP2가 뒷발이면 FP1↔FP2 스왑 (좌투/셋업 대응; 엔진은 FP1=뒷발 가정) ──
    (function(){
      var z1=series.FP1_Z||[], z2=series.FP2_Z||[], fc=ev.i_fc;
      function nf(a){var n=0,i;for(i=0;i<a.length;i++)if(isFinite(a[i])&&a[i]!==0)n++;return n;}
      if(nf(z1)===0||nf(z2)===0) return;
      var hi=(fc!=null?Math.max(1,fc-1):Math.floor(z1.length/2));
      function ma(a){var s=0,c=0,i;for(i=0;i<=hi&&i<a.length;i++){var v=Math.abs(a[i]);if(isFinite(v)){s+=v;c++;}}return c?s/c:0;}
      if(ma(z2)<=ma(z1)) return;  // FP1=뒷발(정상) → 스왑 안함
      function swap(o){ if(!o)return; Object.keys(o).filter(function(k){return k.indexOf('FP1')===0;}).forEach(function(k1){ var k2='FP2'+k1.slice(3); if(Object.prototype.hasOwnProperty.call(o,k2)){ var tmp=o[k1]; o[k1]=o[k2]; o[k2]=tmp; } }); }
      swap(series); swap(grf.series_hi); swap(grf.lo);
      var tg=grf.fp1; grf.fp1=grf.fp2; grf.fp2=tg;
      grf.lead_rear_status='SWAPPED(FP2=뒷발 검출)'; grf.convention_note='FP2=Rear → FP1로 스왑(자동판별)'; grf.rear_plate_detected='FP2';
      console.warn('포스플레이트 스왑: FP2가 뒷발로 검출 → FP1↔FP2 교체');
    })();
    const kseq=kseqAnalyze(series,ev,setup.dt);
    const scalars=buildScalars(series,xfactor,parsed,ev,grf,setup.nFrames);
    const _gloveSide=throwSide==='right'?'left':'right';
    const grf_metrics=(function(){ var out={}; var A=function(k){return series[k]||[];}; var i_fc=ev.i_fc, i_br=ev.i_br;
      function cc(pre){ var cx=A(pre+'_X_2'),cy=A(pre+'_Y_2'); var lo=i_fc||0, hi=i_br||cx.length, sx=0,sy=0,n=0; for(var i=lo;i<hi&&i<cx.length;i++){ if(isFinite(cx[i])&&isFinite(cy[i])){sx+=cx[i];sy+=cy[i];n++;} } return n?[sx/n,sy/n]:null; }
      var r=cc('FP1'), l=cc('FP2');
      if(r&&l){ var dx=l[0]-r[0], dy=l[1]-r[1]; out.stride_cop_m=Math.round(Math.sqrt(dx*dx+dy*dy)*1000)/1000; out.stride_angle_deg=Math.round(Math.atan2(dx,dy)*1800/Math.PI)/10; }
      // [2026-06-01 FIX] 관용 스트라이드 길이 = 양 발끝(toe) 수평거리 at FC. CoP-CoP 거리는 발판 압력중심 기준이라
      //   발목/발끝 기준보다 ~15%p 과소측정됨(이영하 CoP 77.9% vs 발끝 88.7%=실측 1.7m). 발끝 기준이 관용 정의·문헌과 일치.
      if(frames.length&&i_fc!=null&&i_fc<frames.length){ var _ff=frames[i_fc], _lt=_ff&&_ff.l_toe, _rt=_ff&&_ff.r_toe;
        if(_lt&&_rt){ var _tdx=_lt[0]-_rt[0], _tdz=_lt[2]-_rt[2]; out.stride_toe_m=Math.round(Math.sqrt(_tdx*_tdx+_tdz*_tdz)*1000)/1000; } }
      var sl=A('STRIDE_LENGTH_X').filter(isFinite); if(sl.length){ out.stride_length_m=Math.round(Math.max.apply(null,sl.map(Math.abs))*1000)/1000; }
      function pk(pre){ var z=A(pre+'_Z'),mi=null,mv=-Infinity; for(var i=0;i<z.length;i++){ if(isFinite(z[i])&&z[i]>mv){mv=z[i];mi=i;} } return mi; }
      var irp=pk('FP1'), ilp=pk('FP2');
      if(irp!=null&&i_fc!=null) out.rear_peak_to_fc_ms=Math.round((i_fc-irp)*setup.dt*1000);
      if(ilp!=null&&i_fc!=null) out.fc_to_lead_peak_ms=Math.round((ilp-i_fc)*setup.dt*1000);
      if(i_fc!=null&&i_br!=null) out.fc_to_br_ms=Math.round((i_br-i_fc)*setup.dt*1000);
      var lead=_gloveSide==='left'?'l':'r';
      if(frames.length&&i_br!=null&&i_br<frames.length){ var heel=frames[i_br][lead+'_heel'], toe=frames[i_br][lead+'_toe']; if(heel&&toe){ var dX=-(toe[0]-heel[0]), dY=toe[2]-heel[2]; out.lead_foot_angle_deg=Math.round(Math.atan2(dX,dY)*1800/Math.PI)/10; } }
      return out; })();
    return { setup, events:ev, series, frames, x_factor:xfactor, x_factor_method:(setup._xf_method||'global'), grf, kseq, scalars, grf_metrics:grf_metrics, detected_throw_side:_detectThrowSide(parsed), throw_side:throwSide, glove_side:(throwSide==='right'?'left':'right'), throwing_wrist_pos_available:throwing_wrist_pos_available, ground_y_m:_fb.ground_y_m, viewer_origin_horiz0_m:_fb.viewer_origin_horiz0_m, viewer_origin_horiz1_m:_fb.viewer_origin_horiz1_m, axis_up:_fb.axis_up, horiz_axes:_fb.horiz_axes };
  }

  return { extractSetup, extractTrial };
});
