// extract_imu.js — Noraxon MR3 IMU+GRF CSV → Theia 리포트 계약(extract_theia.extractTrial 동형) 매핑
// 입력: MR3 CSV 텍스트. 출력: { setup, events, series(Theia키), frames, x_factor, grf, kseq, scalars, grf_metrics, throw_side, glove_side, ... }
// 설계 원칙: IMU(자이로·가속도) 직접측정은 마커기반 역동역학보다 신뢰도 높음 → 에너지/운동역학을 적극 산출.
//   · 어깨 외회전(ER)=관절 채널 Rotation Int 부호반전(GH, ~70-80°). (레이백 아님)
//   · Theia 미제공 변인을 IMU 고유 채널로 추가: 뒷다리 고관절 IR/ER 각도·각속도·토크추정, 손목 요측·굴곡.
//   · 토크는 분절관성×각가속도(I·α) 추정 — '측정' 아님, 'IMU 추정' 라벨.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.extractImu = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WINDOW_PRE_S = 2.0, WINDOW_POST_S = 0.5, TARGET_HZ = 250; // 리포트 blob 경량화용 데시메이션 목표

  function unq(s){ return (s||'').replace(/^﻿/,'').replace(/^"|"$/g,'').trim(); }
  // ── MR3 CSV 파서: 1행 메타헤더, 2행 메타값, (공백), 채널헤더('time' 시작), 데이터 ──
  function parseMR3(text){
    var lines=text.split(/\r?\n/);
    var meta=(lines[1]||'').split(',').map(unq);
    var fps=parseFloat(meta[2])||1000;
    var lastName=meta[7]||'';
    var hi=-1; for(var i=0;i<6&&i<lines.length;i++){ if(unq((lines[i].split(',')[0]))==='time'){ hi=i; break; } }
    if(hi<0) hi=3;
    var cols=lines[hi].split(',').map(unq); var idx={}; cols.forEach(function(c,i){ idx[c]=i; });
    // [FIX 2026-05-25] AMTI 명명 export 별칭: 'AMTI lead 2'→'Force plate 2', 'AMTI trail'→'Force plate'.
    // (Noraxon export 프로파일에 따라 포스플레이트 채널명이 'AMTI ...' 또는 'Force plate ...'로 다름)
    Object.keys(idx).forEach(function(k){
      if(k.indexOf('AMTI lead 2')>=0){ var a=k.split('AMTI lead 2').join('Force plate 2'); if(idx[a]==null) idx[a]=idx[k]; }
      else if(k.indexOf('AMTI trail')>=0){ var b=k.split('AMTI trail').join('Force plate'); if(idx[b]==null) idx[b]=idx[k]; }
    });
    var tIdx=(idx['time']!=null)?idx['time']:0;
    var rows=[]; for(var r=hi+1;r<lines.length;r++){ var ln=lines[r]; if(!ln) continue; var f=ln.split(','); if(f.length<10) continue; rows.push(f); }
    function colNum(name){ var j=idx[name]; if(j==null) return null; var out=new Array(rows.length);
      for(var r=0;r<rows.length;r++){ var s=(rows[r][j]||'').trim(); var v=(s===''?NaN:Number(s)); out[r]=isFinite(v)?v:NaN; } return out; }
    var t=new Array(rows.length); for(var k=0;k<rows.length;k++){ var s=(rows[k][tIdx]||'').trim(); var v=Number(s); t[k]=isFinite(v)?v:k/fps; }
    return { fps:fps, lastName:lastName, n:rows.length, t:t, has:function(nm){return idx[nm]!=null;}, colNum:colNum };
  }

  // ── DSP 유틸 ──
  function ffill(a){ var o=a.slice(),last=null,i; for(i=0;i<o.length;i++){ if(isFinite(o[i]))last=o[i]; else if(last!=null)o[i]=last; }
    var nx=null; for(i=o.length-1;i>=0;i--){ if(isFinite(o[i]))nx=o[i]; else if(nx!=null)o[i]=nx; } return o; }
  function movavg(a,w){ w=w||9; var h=w>>1,o=new Array(a.length),i,j; for(i=0;i<a.length;i++){ var s=0,c=0; for(j=i-h;j<=i+h;j++){ if(j>=0&&j<a.length&&isFinite(a[j])){s+=a[j];c++;} } o[i]=c?s/c:NaN; } return o; }
  function grad(a,dt){ var o=new Array(a.length),i; for(i=0;i<a.length;i++){ if(i===0)o[i]=(a[1]-a[0])/dt; else if(i===a.length-1)o[i]=(a[i]-a[i-1])/dt; else o[i]=(a[i+1]-a[i-1])/(2*dt); } return o; }
  function argmax(a,lo,hi){ lo=lo||0; hi=(hi==null?a.length-1:hi); var bi=-1,bv=-Infinity,i; for(i=lo;i<=hi&&i<a.length;i++){ if(isFinite(a[i])&&a[i]>bv){bv=a[i];bi=i;} } return bi; }
  function argmin(a,lo,hi){ lo=lo||0; hi=(hi==null?a.length-1:hi); var bi=-1,bv=Infinity,i; for(i=lo;i<=hi&&i<a.length;i++){ if(isFinite(a[i])&&a[i]<bv){bv=a[i];bi=i;} } return bi; }
  function argmaxAbs(a,lo,hi){ lo=lo||0; hi=(hi==null?a.length-1:hi); var bi=-1,bv=-Infinity,i; for(i=lo;i<=hi&&i<a.length;i++){ var v=Math.abs(a[i]); if(isFinite(v)&&v>bv){bv=v;bi=i;} } return bi; }
  function r1(x){ return isFinite(x)?Math.round(x*10)/10:NaN; }
  function r2(x){ return isFinite(x)?Math.round(x*100)/100:NaN; }
  function r3(x){ return isFinite(x)?Math.round(x*1000)/1000:NaN; }
  function neg(a){ return a?a.map(function(v){return isFinite(v)?-v:NaN;}):null; }

  // ── MR3 채널명 헬퍼 ──
  function TRAJ(j){ return 'Noraxon MyoMotion-Trajectories-'+j; }
  function GYRO(seg,ax){ return 'Noraxon MyoMotion-Segments-'+seg+'-Gyroscope-'+ax+' (deg/s)'; }
  function ACC(seg,ax){ return 'Noraxon MyoMotion-Segments-'+seg+'-Acceleration-'+ax+' (mG)'; }
  function ORI(seg,ax){ return 'Noraxon MyoMotion-Segments-'+seg+'-Orientation-'+ax; }
  // 쿼터니언(x,y,z,w) 로 벡터 회전 (segment-local → MR3 global)
  function qrot(q,v){ var x=q[0],y=q[1],z=q[2],w=q[3], vx=v[0],vy=v[1],vz=v[2];
    var r00=1-2*(y*y+z*z),r01=2*(x*y-w*z),r02=2*(x*z+w*y),r10=2*(x*y+w*z),r11=1-2*(x*x+z*z),r12=2*(y*z-w*x),r20=2*(x*z-w*y),r21=2*(y*z+w*x),r22=1-2*(x*x+y*y);
    return [r00*vx+r01*vy+r02*vz, r10*vx+r11*vy+r12*vz, r20*vx+r21*vy+r22*vz]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function vsub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
  function vdot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function vmag(a){ return Math.sqrt(vdot(a,a)); }
  function vunit(a){ var m=vmag(a)||1; return [a[0]/m,a[1]/m,a[2]/m]; }
  // Dempster 분절 파라미터 [질량비, COM비(근위), 횡관성 회전반경비]
  var SEGP={ hand:[0.006,0.506,0.297], forearm:[0.016,0.430,0.303], upperarm:[0.028,0.436,0.322],
             foot:[0.0145,0.50,0.475], shank:[0.0465,0.433,0.302], thigh:[0.100,0.433,0.323], trunk:[0.497,0.50,0.50] };
  // 트래젝토리 조인트 → Theia frame 마커(소문자)
  var FRAME_MAP = {
    pelvis_o:'Pelvis', neck:'7th cervical vertebrae', head:'Head front RT',
    l_shoulder:'Shoulder LT', r_shoulder:'Shoulder RT', l_elbow:'Elbow LT', r_elbow:'Elbow RT',
    l_wrist:'Ulnar styloid process LT', r_wrist:'Ulnar styloid process RT',
    l_hip:'Hip LT', r_hip:'Hip RT', l_knee:'Knee LT', r_knee:'Knee RT',
    l_heel:'Heel LT', r_heel:'Heel RT', l_toe:'Foot toe LT', r_toe:'Foot toe RT',
    l_hand_tip:'Hand tip LT', r_hand_tip:'Hand tip RT'
  };

  function getXYZ(P,joint){ return { x:P.colNum(TRAJ(joint)+'-x (mm)'), y:P.colNum(TRAJ(joint)+'-y (mm)'), z:P.colNum(TRAJ(joint)+'-z (mm)') }; }

  // ── 이벤트 검출 (mr3 뷰어 로직 포팅; 절대 인덱스, 풀레이트) ──
  function detectEvents(P, fps, throwS, gloveS){
    var dt=1/fps, n=P.n;
    var A=(throwS==='right')?'RT':'LT', G=(gloveS==='right')?'RT':'LT';
    // BR = 손끝 속도 peak (없으면 전완 자이로 peak)
    var hand=getXYZ(P,'Hand tip '+A);
    var sp=new Array(n).fill(0);
    if(hand.x){ for(var i=1;i<n;i++){ var dx=hand.x[i]-hand.x[i-1],dy=hand.y[i]-hand.y[i-1],dz=hand.z[i]-hand.z[i-1]; var d=Math.sqrt(dx*dx+dy*dy+dz*dz)/dt/1000; sp[i]=isFinite(d)?d:0; } }
    sp=movavg(sp,7);
    var foreZ=P.colNum(GYRO('Forearm '+A,'z'))||[];
    var iBr=(hand.x)?argmax(sp,0,n-1):argmaxAbs(foreZ,0,n-1); if(iBr<0)iBr=argmaxAbs(foreZ,0,n-1);
    // FC = 앞발 수직 GRF(Force plate 2 우선; 자동판별)
    var fz1=P.colNum('Force plate Fz (N)')||[], fz2=P.colNum('Force plate 2 Fz (N)')||[];
    function pkv(a){ var m=0; for(var i=0;i<a.length;i++){var v=Math.abs(a[i]); if(isFinite(v)&&v>m)m=v;} return m; }
    var lead=fz2, lpk=pkv(fz2); if(pkv(fz2)<pkv(fz1)){ /* 앞발이 fp1? 잘 없음 */ }
    var thr=Math.max(50,lpk*0.15), iFc=-1;
    for(var i2=0;i2<n;i2++){ if(isFinite(lead[i2])&&Math.abs(lead[i2])>thr){ var ok=true; for(var k=i2;k<Math.min(n,i2+Math.floor(0.03*fps));k++){ if(!(Math.abs(lead[k])>thr*0.6)){ok=false;break;} } if(ok){iFc=i2;break;} } }
    // KH = FC 이전 앞다리 무릎 수직(z) 최고
    var lk=getXYZ(P,'Knee '+G); var kz=(lk&&lk.z)||[];
    var iKl=argmax(kz,0,(iFc>0?iFc:n-1));
    // MER = [FC-0.2s, BR] 어깨 Rotation Int 최소(=최대 외회전)
    var sho=P.colNum('Noraxon MyoMotion-Joints-Shoulder '+A+'-Rotation Int (deg)')||[];
    var lo=Math.max(0,(iFc>=0?iFc-Math.floor(0.2*fps):0)), hi2=(iBr>=0?iBr:n-1);
    var iMer=argmin(sho,lo,hi2); if(iMer<0)iMer=Math.floor((((iFc>=0?iFc:0))+iBr)/2);
    return { i_kl_peak:iKl, i_fc:iFc, i_mer:iMer, i_br:iBr, peak_hand_speed_ms:r2(sp[iBr]) };
  }

  // ── 투구팔 역동역학 (Newton-Euler, 전역좌표; IMU orientation+gyro+accel) ──
  // 반환: 팔꿈치/어깨 모멘트·관절힘·파워·분절KE 채널(데시메이션 풀길이). 토크는 IMU 추정(역동역학).
  function _armID(P, dec, throwS, dtD, Mb){
    var A=(throwS==='right')?'RT':'LT';
    function dseg(seg){ var o={}; ['x','y','z'].forEach(function(ax){ o['g'+ax]=dec(ffill(P.colNum(GYRO(seg,ax))||[])); o['a'+ax]=dec(ffill(P.colNum(ACC(seg,ax))||[])); }); ['x','y','z','w'].forEach(function(ax){ o['q'+ax]=dec(ffill(P.colNum(ORI(seg,ax))||[])); }); return o; }
    function dpos(joint){ var J=getXYZ(P,joint); return { x:J.x?dec(J.x):null, y:J.y?dec(J.y):null, z:J.z?dec(J.z):null }; }
    var HAND=dseg('Hand '+A), FORE=dseg('Forearm '+A), UARM=dseg('Upper arm '+A), THOR=dseg('Upper spine');
    var pSho=dpos('Shoulder '+A), pElb=dpos('Elbow '+A), pWri=dpos('Ulnar styloid process '+A), pTip=dpos('Hand tip '+A);
    var nD=(HAND.gx||[]).length; if(!nD){ return {}; }
    var g=[0,0,-9.81];
    function omegaLoc(S,i){ return [(S.gx[i]||0)*Math.PI/180,(S.gy[i]||0)*Math.PI/180,(S.gz[i]||0)*Math.PI/180]; }
    function quat(S,i){ return [S.qx[i]||0,S.qy[i]||0,S.qz[i]||0,(S.qw[i]==null?1:S.qw[i])]; }
    function accInertial(S,i){ var al=[(S.ax[i]||0)*9.81/1000,(S.ay[i]||0)*9.81/1000,(S.az[i]||0)*9.81/1000]; var ag=qrot(quat(S,i),al); return [ag[0]+g[0],ag[1]+g[1],ag[2]+g[2]]; }
    function pos(p,i){ return [(p.x?p.x[i]:NaN)/1000,(p.y?p.y[i]:NaN)/1000,(p.z?p.z[i]:NaN)/1000]; }
    function segInertia(seg,L){ var m=SEGP[seg][0]*Mb, It=m*Math.pow(SEGP[seg][2]*L,2), Il=m*Math.pow(0.12*L,2); return {m:m,It:It,Il:Il}; }
    // 분절 net moment(전역) = R*(I*αloc + ωloc×(I*ωloc))
    function segMomentGlobal(S,i,inert){ var wl=omegaLoc(S,i); var wlp=omegaLoc(S,Math.max(0,i-1)), wln=omegaLoc(S,Math.min(nD-1,i+1)); var hh=(i>0&&i<nD-1)?2*dtD:dtD;
      var al=[(wln[0]-wlp[0])/hh,(wln[1]-wlp[1])/hh,(wln[2]-wlp[2])/hh];
      var I=[inert.It,inert.It,inert.Il];
      var Iw=[I[0]*wl[0],I[1]*wl[1],I[2]*wl[2]]; var gyro=cross(wl,Iw);
      var Ml=[I[0]*al[0]+gyro[0], I[1]*al[1]+gyro[1], I[2]*al[2]+gyro[2]];
      return qrot(quat(S,i),Ml); }
    function comAcc(S,i){ return accInertial(S,i); }
    function vcom(prox,dist,comR,i){ function C(j){ var p=pos(prox,j),d=pos(dist,j); return [p[0]+comR*(d[0]-p[0]),p[1]+comR*(d[1]-p[1]),p[2]+comR*(d[2]-p[2])]; } var hh=(i>0&&i<nD-1)?2*dtD:dtD; var a=C(Math.max(0,i-1)),b=C(Math.min(nD-1,i+1)); return [(b[0]-a[0])/hh,(b[1]-a[1])/hh,(b[2]-a[2])/hh]; }
    var out={ Pitching_Elbow_Moment_X:[],Pitching_Elbow_Moment_Y:[],Pitching_Elbow_Moment_Z:[],
      Pitching_Shoulder_Moment_X:[],Pitching_Shoulder_Moment_Y:[],Pitching_Shoulder_Moment_Z:[],
      Pitching_Shoulder_Force_X:[],Pitching_Shoulder_Force_Y:[],Pitching_Shoulder_Force_Z:[],
      Pitching_Elbow_Power_X:[],Pitching_Shoulder_Power_X:[],Pitching_Forearm_ME_X:[],Pitching_Humerus_ME_X:[] };
    for(var i=0;i<nD;i++){
      var Wri=pos(pWri,i),Elb=pos(pElb,i),Sho=pos(pSho,i),Tip=pos(pTip,i);
      var Lf=vmag(vsub(Wri,Elb))||0.25, Lu=vmag(vsub(Elb,Sho))||0.30, Lh=vmag(vsub(Tip,Wri))||0.18;
      var iH=segInertia('hand',Lh), iF=segInertia('forearm',Lf), iU=segInertia('upperarm',Lu);
      // 손
      var Ch=[Wri[0]+0.506*(Tip[0]-Wri[0]),Wri[1]+0.506*(Tip[1]-Wri[1]),Wri[2]+0.506*(Tip[2]-Wri[2])];
      var aH=comAcc(HAND,i); var Fp_h=[iH.m*aH[0]-iH.m*g[0], iH.m*aH[1]-iH.m*g[1], iH.m*aH[2]-iH.m*g[2]];
      var Mh=segMomentGlobal(HAND,i,iH); var Mp_h=vsub(vsub(Mh,[0,0,0]),cross(vsub(Wri,Ch),Fp_h));
      // 전완
      var Cf=[Elb[0]+0.430*(Wri[0]-Elb[0]),Elb[1]+0.430*(Wri[1]-Elb[1]),Elb[2]+0.430*(Wri[2]-Elb[2])];
      var aF=comAcc(FORE,i); var Fd_f=[-Fp_h[0],-Fp_h[1],-Fp_h[2]]; var Md_f=[-Mp_h[0],-Mp_h[1],-Mp_h[2]];
      var Fp_f=[iF.m*aF[0]-Fd_f[0]-iF.m*g[0], iF.m*aF[1]-Fd_f[1]-iF.m*g[1], iF.m*aF[2]-Fd_f[2]-iF.m*g[2]];
      var Mf=segMomentGlobal(FORE,i,iF);
      var Mp_f=vsub(vsub(vsub(Mf,Md_f),cross(vsub(Elb,Cf),Fp_f)),cross(vsub(Wri,Cf),Fd_f));
      // 상완
      var Cu=[Sho[0]+0.436*(Elb[0]-Sho[0]),Sho[1]+0.436*(Elb[1]-Sho[1]),Sho[2]+0.436*(Elb[2]-Sho[2])];
      var aU=comAcc(UARM,i); var Fd_u=[-Fp_f[0],-Fp_f[1],-Fp_f[2]]; var Md_u=[-Mp_f[0],-Mp_f[1],-Mp_f[2]];
      var Fp_u=[iU.m*aU[0]-Fd_u[0]-iU.m*g[0], iU.m*aU[1]-Fd_u[1]-iU.m*g[1], iU.m*aU[2]-Fd_u[2]-iU.m*g[2]];
      var Mu=segMomentGlobal(UARM,i,iU);
      var Mp_u=vsub(vsub(vsub(Mu,Md_u),cross(vsub(Sho,Cu),Fp_u)),cross(vsub(Elb,Cu),Fd_u));
      // 축 분해
      var ufa=vunit(vsub(Wri,Elb)), uhum=vunit(vsub(Elb,Sho));
      var elAx=vdot(Mp_f,ufa), elBendV=vsub(Mp_f,[ufa[0]*elAx,ufa[1]*elAx,ufa[2]*elAx]);
      var shIR=vdot(Mp_u,uhum), shBendV=vsub(Mp_u,[uhum[0]*shIR,uhum[1]*shIR,uhum[2]*shIR]);
      var distr=vdot(Fp_u,uhum); // 상완 장축 성분: 음수=견인(distraction)
      out.Pitching_Elbow_Moment_X.push(r1(elAx)); out.Pitching_Elbow_Moment_Y.push(r1(vmag(elBendV))); out.Pitching_Elbow_Moment_Z.push(r1(0));
      out.Pitching_Shoulder_Moment_X.push(r1(vmag(shBendV))); out.Pitching_Shoulder_Moment_Y.push(r1(0)); out.Pitching_Shoulder_Moment_Z.push(r1(shIR));
      out.Pitching_Shoulder_Force_X.push(r1(Fp_u[0])); out.Pitching_Shoulder_Force_Y.push(r1(Math.abs(distr))); out.Pitching_Shoulder_Force_Z.push(r1(Fp_u[2]));
      // 파워 = M·ω_rel
      var wFA=qrot(quat(FORE,i),omegaLoc(FORE,i)), wUA=qrot(quat(UARM,i),omegaLoc(UARM,i)), wTH=qrot(quat(THOR,i),omegaLoc(THOR,i));
      out.Pitching_Elbow_Power_X.push(r1(vdot(Mp_f,vsub(wFA,wUA))));
      out.Pitching_Shoulder_Power_X.push(r1(vdot(Mp_u,vsub(wUA,wTH))));
      // 에너지 KE = 0.5 m v² + 0.5 ωloc·Iωloc
      var vF=vcom(pElb,pWri,0.430,i), wlF=omegaLoc(FORE,i); out.Pitching_Forearm_ME_X.push(r1(0.5*iF.m*vdot(vF,vF)+0.5*(iF.It*(wlF[0]*wlF[0]+wlF[1]*wlF[1])+iF.Il*wlF[2]*wlF[2])));
      var vU=vcom(pSho,pElb,0.436,i), wlU=omegaLoc(UARM,i); out.Pitching_Humerus_ME_X.push(r1(0.5*iU.m*vdot(vU,vU)+0.5*(iU.It*(wlU[0]*wlU[0]+wlU[1]*wlU[1])+iU.Il*wlU[2]*wlU[2])));
    }
    return out;
  }
  // ── 다리 역동역학 (GRF 기반 bottom-up Newton-Euler) → 무릎·고관절 모멘트·파워(버팀·흡수) ──
  // GRF 벡터=포스플레이트 Fx/Fy/Fz(랩축=궤적축), 적용점=발 접지중심(heel+toe)/2, 지렛대=골반상대 궤적(축 일치).
  function _legID(P, dec, SIDE, FP, dtD, Mb, fcIdx){
    function dseg(seg){ var o={}; ['x','y','z'].forEach(function(ax){ o['g'+ax]=dec(ffill(P.colNum(GYRO(seg,ax))||[])); o['a'+ax]=dec(ffill(P.colNum(ACC(seg,ax))||[])); }); ['x','y','z','w'].forEach(function(ax){ o['q'+ax]=dec(ffill(P.colNum(ORI(seg,ax))||[])); }); return o; }
    function dpos(joint){ var J=getXYZ(P,joint); return { x:J.x?dec(J.x):null, y:J.y?dec(J.y):null, z:J.z?dec(J.z):null }; }
    var FOOT=dseg('Foot '+SIDE), SHANK=dseg('Shank '+SIDE), THIGH=dseg('Thigh '+SIDE), PELV=dseg('Pelvis');
    function accI(S,i){ if(!S.ax)return [0,0,0]; var al=[(S.ax[i]||0)*9.81/1000,(S.ay[i]||0)*9.81/1000,(S.az[i]||0)*9.81/1000]; var ag=qrot([S.qx[i]||0,S.qy[i]||0,S.qz[i]||0,(S.qw[i]==null?1:S.qw[i])],al); return [ag[0],ag[1],ag[2]-9.81]; }
    var pHip=dpos('Hip '+SIDE), pKnee=dpos('Knee '+SIDE), pAnk=dpos('Ankle '+SIDE), pHeel=dpos('Heel '+SIDE), pToe=dpos('Foot toe '+SIDE);
    var Fx=dec(ffill(P.colNum(FP+' Fx (N)')||[])), Fy=dec(ffill(P.colNum(FP+' Fy (N)')||[])), Fz=dec(ffill(P.colNum(FP+' Fz (N)')||[])), Mz=dec(ffill(P.colNum(FP+' Mz (N*m)')||[]));
    // CoP (플레이트별, mm) — 발목 정합용 이동량
    var COPx=dec(ffill(P.colNum('Force plate group-Force plates-'+FP+'-Center of pressure-x (mm)')||[]));
    var COPy=dec(ffill(P.colNum('Force plate group-Force plates-'+FP+'-Center of pressure-y (mm)')||[]));
    var nD=(THIGH.gx||[]).length; if(!nD||!Fz){ return {}; }
    // FC 시점 CoP 기준값(이때 CoP≈발목 아래로 가정) → 이후 CoP 이동량만 발목에 더함(랩↔골반 원점 불일치 제거)
    var fcD=(fcIdx!=null&&fcIdx>=0&&fcIdx<nD)?fcIdx:Math.floor(nD*0.4);
    var cop0x=(COPx&&isFinite(COPx[fcD]))?COPx[fcD]:0, cop0y=(COPy&&isFinite(COPy[fcD]))?COPy[fcD]:0;
    var g=[0,0,-9.81];
    function omega(S,i){ var wl=[(S.gx[i]||0)*Math.PI/180,(S.gy[i]||0)*Math.PI/180,(S.gz[i]||0)*Math.PI/180]; return qrot([S.qx[i]||0,S.qy[i]||0,S.qz[i]||0,(S.qw[i]==null?1:S.qw[i])],wl); }
    function pos(p,i){ return [(p.x?p.x[i]:NaN)/1000,(p.y?p.y[i]:NaN)/1000,(p.z?p.z[i]:NaN)/1000]; }
    function inert(seg,L){ var m=SEGP[seg][0]*Mb; return {m:m,It:m*Math.pow(SEGP[seg][2]*L,2),Il:m*Math.pow(0.12*L,2)}; }
    function segMom(S,i,it){ var wl=[(S.gx[i]||0)*Math.PI/180,(S.gy[i]||0)*Math.PI/180,(S.gz[i]||0)*Math.PI/180];
      var wp=[(S.gx[Math.max(0,i-1)]||0)*Math.PI/180,(S.gy[Math.max(0,i-1)]||0)*Math.PI/180,(S.gz[Math.max(0,i-1)]||0)*Math.PI/180];
      var wn=[(S.gx[Math.min(nD-1,i+1)]||0)*Math.PI/180,(S.gy[Math.min(nD-1,i+1)]||0)*Math.PI/180,(S.gz[Math.min(nD-1,i+1)]||0)*Math.PI/180];
      var hh=(i>0&&i<nD-1)?2*dtD:dtD; var al=[(wn[0]-wp[0])/hh,(wn[1]-wp[1])/hh,(wn[2]-wp[2])/hh];
      var I=[it.It,it.It,it.Il], Iw=[I[0]*wl[0],I[1]*wl[1],I[2]*wl[2]], gy=cross(wl,Iw);
      return qrot([S.qx[i]||0,S.qy[i]||0,S.qz[i]||0,(S.qw[i]==null?1:S.qw[i])],[I[0]*al[0]+gy[0],I[1]*al[1]+gy[1],I[2]*al[2]+gy[2]]); }
    function comAccTraj(prox,dist,comR,i){ function C(j){ var p=pos(prox,j),d=pos(dist,j); return [p[0]+comR*(d[0]-p[0]),p[1]+comR*(d[1]-p[1]),p[2]+comR*(d[2]-p[2])]; } var hh=(i>0&&i<nD-1)?2*dtD:dtD; var a=C(Math.max(0,i-1)),b=C(i),c=C(Math.min(nD-1,i+1)); return [(a[0]-2*b[0]+c[0])/(hh*hh/4),(a[1]-2*b[1]+c[1])/(hh*hh/4),(a[2]-2*b[2]+c[2])/(hh*hh/4)]; }
    var out={ knee_moment:[], hip_moment:[], knee_power:[], hip_power:[] };
    for(var i=0;i<nD;i++){
      var Hip=pos(pHip,i),Knee=pos(pKnee,i),Ank=pos(pAnk,i),Heel=pos(pHeel,i),Toe=pos(pToe,i);
      // GRF 적용점 = 발목 + (CoP 이동량, m). 발목 아래 지면 높이로 투영(수직은 발끝/뒤꿈치 평균).
      var copDx=(COPx&&isFinite(COPx[i]))?(COPx[i]-cop0x)/1000:0, copDy=(COPy&&isFinite(COPy[i]))?(COPy[i]-cop0y)/1000:0;
      var groundZ=Math.min(Heel[2],Toe[2]);
      var footMid=[Ank[0]+copDx, Ank[1]+copDy, groundZ];
      var Lf=vmag(vsub(Toe,Ank))||0.20, Ls=vmag(vsub(Ank,Knee))||0.40, Lt=vmag(vsub(Knee,Hip))||0.40;
      var iF=inert('foot',Lf), iS=inert('shank',Ls), iT=inert('thigh',Lt);
      var GRF=[Fx[i]||0,Fy[i]||0,Fz[i]||0], Tgrf=[0,0,Mz?Mz[i]||0:0];
      // 발 (지면반력=원위 외력)
      var Cf=[Ank[0]+0.5*(Toe[0]-Ank[0]),Ank[1]+0.5*(Toe[1]-Ank[1]),Ank[2]+0.5*(Toe[2]-Ank[2])];
      var aF=accI(FOOT,i); if(!isFinite(aF[0]))aF=[0,0,0];
      var Fp_f=[iF.m*aF[0]-GRF[0]-iF.m*g[0], iF.m*aF[1]-GRF[1]-iF.m*g[1], iF.m*aF[2]-GRF[2]-iF.m*g[2]];
      var Mf=segMom(FOOT,i,iF);
      var Mp_f=vsub(vsub(vsub(Mf,Tgrf),cross(vsub(Ank,Cf),Fp_f)),cross(vsub(footMid,Cf),GRF));
      // 정강이
      var Cs=[Knee[0]+0.433*(Ank[0]-Knee[0]),Knee[1]+0.433*(Ank[1]-Knee[1]),Knee[2]+0.433*(Ank[2]-Knee[2])];
      var aS=accI(SHANK,i); if(!isFinite(aS[0]))aS=[0,0,0];
      var Fd_s=[-Fp_f[0],-Fp_f[1],-Fp_f[2]], Md_s=[-Mp_f[0],-Mp_f[1],-Mp_f[2]];
      var Fp_s=[iS.m*aS[0]-Fd_s[0]-iS.m*g[0], iS.m*aS[1]-Fd_s[1]-iS.m*g[1], iS.m*aS[2]-Fd_s[2]-iS.m*g[2]];
      var Ms=segMom(SHANK,i,iS);
      var Mp_s=vsub(vsub(vsub(Ms,Md_s),cross(vsub(Knee,Cs),Fp_s)),cross(vsub(Ank,Cs),Fd_s)); // 무릎 모멘트
      // 대퇴
      var Ct=[Hip[0]+0.433*(Knee[0]-Hip[0]),Hip[1]+0.433*(Knee[1]-Hip[1]),Hip[2]+0.433*(Knee[2]-Hip[2])];
      var aT=accI(THIGH,i); if(!isFinite(aT[0]))aT=[0,0,0];
      var Fd_t=[-Fp_s[0],-Fp_s[1],-Fp_s[2]], Md_t=[-Mp_s[0],-Mp_s[1],-Mp_s[2]];
      var Fp_t=[iT.m*aT[0]-Fd_t[0]-iT.m*g[0], iT.m*aT[1]-Fd_t[1]-iT.m*g[1], iT.m*aT[2]-Fd_t[2]-iT.m*g[2]];
      var Mt=segMom(THIGH,i,iT);
      var Mp_t=vsub(vsub(vsub(Mt,Md_t),cross(vsub(Hip,Ct),Fp_t)),cross(vsub(Knee,Ct),Fd_t)); // 고관절 모멘트
      // 신전/버팀 모멘트 = 시상면(ML=전역 X축) 성분 — 무릎 신전 근처에서도 안정(cross-product blowup 회피)
      out.knee_moment.push(r1(Mp_s[0]));
      out.hip_moment.push(r1(Mp_t[0]));
      var wSh=omega(SHANK,i), wTh=omega(THIGH,i), wPe=omega(PELV,i);
      out.knee_power.push(r1(vdot(Mp_s,vsub(wSh,wTh))));   // 음수=흡수(eccentric)
      out.hip_power.push(r1(vdot(Mp_t,vsub(wTh,wPe))));
    }
    return out;
  }
  function extractTrial(csvText, meta, trialLabel){
    meta=meta||{};
    var P=parseMR3(csvText);
    var fps=P.fps||1000, dt=1/fps, n=P.n;
    var hand=(meta.handedness||'R').toUpperCase().charAt(0)==='L'?'left':'right';
    var throwS=hand, gloveS=(throwS==='right')?'left':'right';
    var A=(throwS==='right')?'RT':'LT', G=(gloveS==='right')?'RT':'LT';
    var athlete=P.lastName||meta.name||'선수';

    var ev=detectEvents(P,fps,throwS,gloveS);
    var iKl=ev.i_kl_peak, iFc=ev.i_fc, iBr=ev.i_br, iMer=ev.i_mer;
    if(iFc<0) iFc=Math.max(0,iBr-Math.floor(0.4*fps));

    // 데시메이션 계수 (≈250Hz)
    var K=Math.max(1,Math.round(fps/TARGET_HZ)); var dtD=dt*K;
    function dec(a){ if(!a)return null; var o=[]; for(var i=0;i<a.length;i+=K)o.push(a[i]); return o; }
    function decIdx(i){ return (i==null||i<0)?null:Math.round(i/K); }

    // ── frames (mm; MR3 x=ML,y=AP,z=vert → Theia [h0,up,h1]=[ML, vert, AP]) ──
    var jc={}; Object.keys(FRAME_MAP).forEach(function(lm){ jc[lm]=getXYZ(P,FRAME_MAP[lm]); });
    // 셋업(앞 0.5s) 기준: 지면=뒷발 heel/toe 수직 최저, 원점=뒷발 ankle ML·AP 평균
    var nRef=Math.min(Math.floor(fps*0.5),n);
    var trail=(throwS==='right')?'RT':'LT';
    var th=getXYZ(P,'Heel '+trail), tt=getXYZ(P,'Foot toe '+trail);
    var gmin=Infinity,i; for(i=0;i<nRef;i++){ [th,tt].forEach(function(P2){ if(P2&&P2.z&&isFinite(P2.z[i])&&P2.z[i]<gmin)gmin=P2.z[i]; }); }
    var groundZ=isFinite(gmin)?gmin:0;
    var ta=getXYZ(P,'Ankle '+trail); var sx=0,cx=0,sy=0,cy=0;
    for(i=0;i<nRef;i++){ if(ta&&ta.x&&isFinite(ta.x[i])){sx+=ta.x[i];cx++;} if(ta&&ta.y&&isFinite(ta.y[i])){sy+=ta.y[i];cy++;} }
    var trailX=cx?sx/cx:0, trailY=cy?sy/cy:0;
    var frames=[];
    for(i=0;i<n;i+=K){ var fr={};
      Object.keys(FRAME_MAP).forEach(function(lm){ var J=jc[lm]; if(!J||!J.x)return;
        fr[lm]=[ r1(-((J.x[i])-trailX)), r1((J.z[i])-groundZ), r1((J.y[i])-trailY) ]; });
      var cm=getXYZ(P,'Body center of mass'); if(cm&&cm.x&&isFinite(cm.x[i])) fr.com=[ r1(-(cm.x[i]-trailX)), r1(cm.z[i]-groundZ), r1(cm.y[i]-trailY) ];
      frames.push(fr); }
    // [FIX 0525] 전진 병진 보정(시각화): MyoMotion은 골반을 원점에 고정(root-anchored)해 몸 전체 전진이 0 → 스틱이 "제자리에서 던지는" 것처럼 보임.
    // 실측 앞발(글러브측) 스트라이드 전진 폭의 절반만큼 몸 전체를 KL→FC 동안 전진시켜 시각화(스트라이드 기반 추정 — 측정 전역병진이 아님).
    (function(){
      var leadHeel=(gloveS==='right')?'r_heel':'l_heel';
      var k0=decIdx(iKl), k1=decIdx(iFc);
      if(k0==null||k1==null||k1<=k0||!frames[k0]||!frames[k1]) return;
      var p0=frames[k0][leadHeel], p1=frames[k1][leadHeel];
      if(!p0||!p1||!isFinite(p0[2])||!isFinite(p1[2])) return;
      var Dmax=0.5*(p1[2]-p0[2]); // 앞발 전진 폭의 절반 (전진=index2)
      if(!isFinite(Dmax)||Math.abs(Dmax)<1) return;
      for(var f=0;f<frames.length;f++){ var prog; if(f<=k0)prog=0; else if(f>=k1)prog=1; else { var x=(f-k0)/(k1-k0); prog=x*x*(3-2*x); }
        var d=Dmax*prog; if(!d)continue; var fo=frames[f];
        Object.keys(fo).forEach(function(lm){ var pp=fo[lm]; if(pp&&isFinite(pp[2])) pp[2]=r1(pp[2]+d); }); }
    })();

    // ── x_factor (직접 채널) ──
    var xfFull=ffill(P.colNum('X-Factor (deg)')||P.colNum('X-factor (deg)')||new Array(n).fill(NaN)); // [FIX 0525] export별 대/소문자 차이(X-Factor vs X-factor) 대응
    var xfactor=dec(xfFull).map(r2);

    // ── series (Theia 키) ──
    function mvD(name,sgn){ var a=P.colNum(name); if(!a)return null; a=movavg(ffill(a),7); if(sgn)a=a.map(function(v){return isFinite(v)?sgn*v:v;}); return dec(a).map(r3); }
    // [0525 표준] 여러 후보 채널명 순차 시도 — export 프로파일(0518 풀네임 vs 0525 단축)차이 대응
    function mvDx(names,sgn){ for(var qi=0;qi<names.length;qi++){ var a=P.colNum(names[qi]); if(a&&a.some(isFinite)){ a=movavg(ffill(a),7); if(sgn)a=a.map(function(v){return isFinite(v)?sgn*v:v;}); return dec(a).map(r3); } } return null; }
    // [0525 표준] 위치기반 뒷다리 고관절 굴곡(시상면) — 관절각 채널이 없는 export에서 폴백. 허벅지(hip→knee) 벡터의 수직 대비 편향각.
    // (쿼터니언 상대 Euler는 MR3 세그먼트 프레임이 해부학축과 안 맞고 짐벌이 생겨 신뢰 불가 → 위치기반만 사용)
    function _hipFlexPos(){ var hip=getXYZ(P,'Hip '+A), knee=getXYZ(P,'Knee '+A); if(!hip||!hip.x||!knee||!knee.x) return null;
      var n2=hip.x.length, out=new Array(n2);
      for(var i2=0;i2<n2;i2++){ var vx=knee.x[i2]-hip.x[i2], vy=knee.y[i2]-hip.y[i2], vz=knee.z[i2]-hip.z[i2]; var L=Math.sqrt(vx*vx+vy*vy+vz*vz);
        out[i2]=(L>0)?Math.acos(Math.max(-1,Math.min(1,(-vz)/L)))*180/Math.PI:NaN; }
      return dec(movavg(out,7)).map(r2); }
    var series={};
    series['Pelvis_Ang_Vel_Z']=mvD(GYRO('Pelvis','z'));
    series['Thorax_Ang_Vel_Z']=mvD(GYRO('Upper spine','z'));
    series['Pitching_Hand_Ang_Vel_X']=mvD(GYRO('Upper arm '+A,'z'));
    series['Pitching_Forearm_Ang_Vel_Z']=mvD(GYRO('Forearm '+A,'z'));
    series['Pitching_Shoulder_Angle_Z']=mvD('Noraxon MyoMotion-Joints-Shoulder '+A+'-Rotation Int (deg)',-1); // ER=GH(70-80)
    series['Pitching_Shoulder_Angle_X']=mvD('Noraxon MyoMotion-Joints-Shoulder '+A+'-Abduction Hrz (deg)'); // [FIX 0525] 어깨 수평외전(견갑 로딩 프록시) — 풀네임
    series['Pitching_Elbow_Angle_X']=mvDx([A.slice(0,2)+' Elbow Flexion (deg)','Noraxon MyoMotion-Joints-Elbow '+A+'-Extension (deg)']);
    series['Trunk_Angle_X']=mvDx(['Noraxon MyoMotion-Segments-Upper spine-Tilt Fwd (deg)','Thoracic Flexion Fwd (deg)','Torso-Pelvic Flexion Fwd (deg)']); // 몸통 전후 기울기(수직축 대비) — leanBack·trunkFlexV
    series['Trunk_Angle_Y']=mvDx([A.slice(0,2)+' Thoracic Flexion Lat (deg)']);
    series['Trunk_Angle_Z']=mvDx([A.slice(0,2)+' Thoracic Axial (deg)']);
    series['Pelvis_Angle_Z']=mvDx(['Noraxon MyoMotion-Segments-Pelvis-'+A+' Rotation (deg)', A.slice(0,2)+' Pelvic Rotation (deg)']); // 골반 회전 — export별 명칭 차이 대응
    series['Lead_Knee_Angle_X']=mvD(G.slice(0,2)+' Knee Flexion (deg)');
    series['Back_Knee_Angle_X']=mvD(A.slice(0,2)+' Knee Flexion (deg)');
    series['Trunk_wrt_Pelvis_Angle_Z']=xfactor.slice();
    // 어깨 외회전 각속도 = ER 시계열 미분
    if(series['Pitching_Shoulder_Angle_Z']){ var erv=grad(series['Pitching_Shoulder_Angle_Z'],dtD); series['Pitching_Shoulder_Ang_Vel_Z']=erv.map(r2); }
    // CoM 전진속도 — [FIX 2026-05-25] 기존엔 수직축(cmAP.y, axis_up=Y)을 미분해 "전진속도"로 썼음(버그).
    // 전진(AP)은 수평 이동이 가장 큰 축 = cmAP.x (검증: CoM가 X로 0.29m, 다른 축 0.11m 이동). 따라서 cmAP.x를 미분. (KL~BR 전진=+ 부호보정 유지)
    var cmAP=getXYZ(P,'Body center of mass'); if(cmAP&&cmAP.x){ var cy2=ffill(cmAP.x); var vz=grad(cy2,dt); var med=[]; for(i=iKl;i<iBr&&i<vz.length;i++) if(isFinite(vz[i]))med.push(vz[i]); med.sort(function(a,b){return a-b;}); if(med.length&&med[med.length>>1]<0)vz=vz.map(function(v){return -v;}); series['COM_Velocity_Y']=dec(movavg(vz,9)).map(function(v){return r3(v/1000);}); }
    // ── IMU 고유(테이아 미제공) 변인 ── 뒷다리 고관절 IR/ER, 손목
    // [FIX 2026-05-25] 풀네임 관절 채널 사용(짧은 이름 'RT Hip Rotation Ext (deg)'는 이 export에 없어 null이었음).
    series['Back_Hip_Rotation_X']=mvD('Noraxon MyoMotion-Joints-Hip '+A+'-Rotation Ext (deg)');           // 뒷다리 고관절 외회전(+)
    if(series['Back_Hip_Rotation_X']){ series['Back_Hip_Rot_Vel_X']=grad(series['Back_Hip_Rotation_X'],dtD).map(r2); }
    series['Pitching_Wrist_Radial_X']=mvD('Noraxon MyoMotion-Joints-Wrist '+A+'-Radial (deg)');
    series['Pitching_Wrist_Flexion_X']=mvD('Noraxon MyoMotion-Joints-Wrist '+A+'-Flexion (deg)');
    // ── 역동역학 채널 병합 (전역 Newton-Euler; 토크·관절힘·파워·팔 에너지) ──
    try{ var _kin=_armID(P, dec, throwS, dtD, meta.weight_kg||80); Object.keys(_kin).forEach(function(kk){ if(_kin[kk]&&_kin[kk].length){ var sm=movavg(_kin[kk],15); series[kk]=sm.map(r1); } }); }catch(eKin){ /* 역동역학 실패 시 해당 채널 생략 */ }
    // ── 다리 역동역학: 앞발(Lead=글러브측, Force plate 2)·뒷발(Back=투구측, Force plate) → 버팀 모멘트·흡수에너지 ──
    try{ var _leadSeg=(gloveS==='right')?'RT':'LT', _backSeg=(throwS==='right')?'RT':'LT';
      var _lead=_legID(P,dec,_leadSeg,'Force plate 2',dtD,meta.weight_kg||80,decIdx(iFc));
      var _back=_legID(P,dec,_backSeg,'Force plate',dtD,meta.weight_kg||80,decIdx(iFc));
      if(_lead.knee_power&&_lead.knee_power.length){ series['Lead_Knee_Power_X']=movavg(_lead.knee_power,15).map(r1); series['Lead_Hip_Power_X']=movavg(_lead.hip_power,15).map(r1); series['Lead_Knee_Moment_X']=movavg(_lead.knee_moment,15).map(r1); series['Lead_Hip_Moment_X']=movavg(_lead.hip_moment,15).map(r1); }
      if(_back.knee_power&&_back.knee_power.length){ series['Back_Knee_Power_X']=movavg(_back.knee_power,15).map(r1); series['Back_Hip_Power_X']=movavg(_back.hip_power,15).map(r1); series['Back_Knee_Moment_X']=movavg(_back.knee_moment,15).map(r1); series['Back_Hip_Moment_X']=movavg(_back.hip_moment,15).map(r1); }
    }catch(eLeg){ /* 다리 역동역학 실패 시 생략 */ }
    // ── 엔진 계약 보완 채널 (Theia 리포트가 읽는 미산출분) ──
    // [FIX 0525] 뒷다리 고관절 관절각 — 풀네임(짧은 이름은 이 export에 없어 null이었음 → 힙힌지 등 산출불가의 원인)
    series['Back_Hip_Angle_X']=mvDx(['Noraxon MyoMotion-Joints-Hip '+A+'-Flexion (deg)'])||_hipFlexPos(); // [0525] 관절채널 없으면 위치기반 고관절 굴곡(힙힌지)
    series['Back_Hip_Angle_Y']=mvD('Noraxon MyoMotion-Joints-Hip '+A+'-Abduction (deg)');
    series['Back_Hip_Angle_Z']=mvD('Noraxon MyoMotion-Joints-Hip '+A+'-Rotation Ext (deg)');
    if(series['Pitching_Elbow_Angle_X']) series['Pitching_Elbow_Ang_Vel_X']=grad(series['Pitching_Elbow_Angle_X'],dtD).map(r2);
    (function(){ var cm=getXYZ(P,'Body center of mass'); if(cm&&cm.y) series['COM_displacement_Y']=dec(ffill(cm.y)).map(function(v){return r3(v/1000);}); if(cm&&cm.x) series['COM_displacement_X']=dec(ffill(cm.x)).map(function(v){return r3(v/1000);}); })();
    series['FP1_X']=dec(ffill(P.colNum('Force plate Fx (N)')||[])).map(r2);
    series['FP2_X']=dec(ffill(P.colNum('Force plate 2 Fx (N)')||[])).map(r2);
    series['FP1_X_2']=dec(ffill(P.colNum('Force plate group-Force plates-Force plate-Center of pressure-x (mm)')||[])).map(r1);
    series['FP1_Y_2']=dec(ffill(P.colNum('Force plate group-Force plates-Force plate-Center of pressure-y (mm)')||[])).map(r1);
    series['FP2_X_2']=dec(ffill(P.colNum('Force plate group-Force plates-Force plate 2-Center of pressure-x (mm)')||[])).map(r1);
    series['FP2_Y_2']=dec(ffill(P.colNum('Force plate group-Force plates-Force plate 2-Center of pressure-y (mm)')||[])).map(r1);
    // [FIX 2026-05-25] 뒷발 자유모멘트(꼬임 토크). 기존엔 수직력 Fz(N)를 잘못 대입(→비물리적 -760N·m).
    // 진짜 자유모멘트 Tz = Mz − (CoPx·Fy − CoPy·Fx). CoP는 mm→m. 물리적으로 ~수십 N·m 범위여야 함(마찰한계 ≤ μ·Fz·r).
    // [재빌드 검증 필요] CoP 좌표계(플레이트원점 기준 vs 글로벌)에 따라 전달항 부호/크기 확인할 것.
    (function(){
      var Mzr=ffill(P.colNum('Force plate Mz (N*m)')||[]);
      var Fxr=ffill(P.colNum('Force plate Fx (N)')||[]), Fyr=ffill(P.colNum('Force plate Fy (N)')||[]);
      var Cxr=ffill(P.colNum('Force plate group-Force plates-Force plate-Center of pressure-x (mm)')||[]);
      var Cyr=ffill(P.colNum('Force plate group-Force plates-Force plate-Center of pressure-y (mm)')||[]);
      var Tz=new Array(n);
      for(var i=0;i<n;i++){
        var mz=isFinite(Mzr[i])?Mzr[i]:0, fx=isFinite(Fxr[i])?Fxr[i]:0, fy=isFinite(Fyr[i])?Fyr[i]:0;
        var cx=(isFinite(Cxr[i])?Cxr[i]:0)/1000, cy=(isFinite(Cyr[i])?Cyr[i]:0)/1000;
        Tz[i]=mz-(cx*fy-cy*fx);
      }
      series['FP1_Z_3']=dec(Tz).map(r2);
    })();
    series['PELVIS_O_Z']=frames.map(function(f){ return (f&&f.pelvis_o&&isFinite(f.pelvis_o[1]))?r3(f.pelvis_o[1]/1000):NaN; });
    (function(){ var leadAbbr=(gloveS==='right')?'R':'L', backAbbr=(throwS==='right')?'R':'L';
      if(series['Lead_Knee_Moment_X']){ series[leadAbbr+'_Knee_Moment_X']=series['Lead_Knee_Moment_X'].slice(); if(series['Lead_Hip_Moment_X'])series[leadAbbr+'_Hip_Moment_X']=series['Lead_Hip_Moment_X'].slice(); series['Knee_Moment_X']=series['Lead_Knee_Moment_X'].slice(); }
      if(series['Back_Knee_Moment_X']){ series[backAbbr+'_Knee_Moment_X']=series['Back_Knee_Moment_X'].slice(); if(series['Back_Hip_Moment_X'])series[backAbbr+'_Hip_Moment_X']=series['Back_Hip_Moment_X'].slice(); } })();

    // ── GRF (FP1=뒷발, FP2=앞발) ── Theia grf 객체 동형
    var bwN=(meta.weight_kg||80)*9.81;
    function grfCol(name){ return ffill(P.colNum(name)||new Array(n).fill(NaN)); }
    var fz1=grfCol('Force plate Fz (N)'), fz2=grfCol('Force plate 2 Fz (N)');
    var fy1=grfCol('Force plate Fy (N)'), fy2=grfCol('Force plate 2 Fy (N)');
    // [FIX 2026-05-25] 앞발(FP2=AMTI lead 2) 플레이트 경사 보정 → ML축 회전으로 실험실좌표 복원. 경사도=info 파일의 'force plate 2 slop'(meta.plate_tilt_deg, 기본 4.4°).
    // 수직력 일부가 AP로 누설된 것을 제거: Fy_lab = Fy·cos − Fz·sin, Fz_lab = Fy·sin + Fz·cos. (뒷발 FP1은 비경사 → 미적용)
    (function(){ var _tiltDeg=(meta&&meta.plate_tilt_deg!=null&&isFinite(meta.plate_tilt_deg))?meta.plate_tilt_deg:4.4; var th=_tiltDeg*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
      for(var i=0;i<fz2.length;i++){ var fy=isFinite(fy2[i])?fy2[i]:0, fz=isFinite(fz2[i])?fz2[i]:0;
        fy2[i]=fy*c - fz*s; fz2[i]=fy*s + fz*c; } })();
    series['FP1_Z']=dec(fz1).map(r2); series['FP2_Z']=dec(fz2).map(r2);
    series['FP1_Y']=dec(fy1).map(r2); series['FP2_Y']=dec(fy2).map(r2);
    // [FIX 2026-05-25] 체중을 입력 메타(오류 86kg) 대신 플레이트 정적 수직력으로 산출(실측 ~118kg).
    // 초기 정지 구간(앞 0.3s) ΣFz 평균 = 체중(N). %BW 정규화·KE·역동역학 질량(아래 Mb)에 사용.
    var bwMeasN=0; (function(){ var qN=Math.min(fz1.length, Math.max(20,Math.floor(0.3*fps))), s=0,c=0;
      for(var qi=0;qi<qN;qi++){ var zt=(isFinite(fz1[qi])?fz1[qi]:0)+(isFinite(fz2[qi])?fz2[qi]:0); if(zt>200){s+=zt;c++;} }
      bwMeasN=c?s/c:0; if(bwMeasN>300){ bwN=bwMeasN; } })();
    function grfSumm(z,fcD,brD){ var out={}; var zf=z.filter(isFinite); if(!zf.length)return out;
      var pk=Math.max.apply(null,zf.map(Math.abs)); out.peak_z_N=Math.round(pk*10)/10; out.peak_z_pct_bw=bwN>0?Math.round(pk/bwN*1000)/10:null;
      if(fcD!=null&&brD!=null&&brD>fcD){ var s=0; for(var i=fcD;i<=brD&&i<z.length;i++) if(isFinite(z[i]))s+=z[i]; var imp=s*dtD; out.impulse_Ns=Math.round(imp*100)/100; out.impulse_pct_bw_s=bwN>0?Math.round(imp/bwN*10000)/100:null; } return out; }
    var fcD=decIdx(iFc), brD=decIdx(iBr);
    var grf={ fp1:grfSumm(series['FP1_Z'],fcD,brD), fp2:grfSumm(series['FP2_Z'],fcD,brD),
      lo:{ FP1_Z:series['FP1_Z'], FP2_Z:series['FP2_Z'], FP1_Y:series['FP1_Y'], FP2_Y:series['FP2_Y'] }, series_hi:{},
      fs_force:Math.round(fps*10)/10, oversample:1, lead_rear_status:'IMU(MR3) 듀얼 플레이트', convention_note:'FP1=Rear(Force plate), FP2=Lead(Force plate 2)', body_weight_N:Math.round(bwN*10)/10 };

    // ── 윈도우 슬라이스 (FC-2.0s ~ FC+0.5s, 데시메이션 인덱스 기준) ──
    var nD=frames.length;
    var i0=Math.max(0, fcD-Math.floor(WINDOW_PRE_S*fps/K)), i1=Math.min(nD-1, fcD+Math.floor(WINDOW_POST_S*fps/K));
    if(i1<=i0){ i0=0; i1=nD-1; }
    var nWin=i1-i0+1;
    function sl(a){ return a?a.slice(i0,i1+1):a; }
    var seriesW={}; Object.keys(series).forEach(function(k){ if(series[k])seriesW[k]=sl(series[k]); });
    var grfW={ fp1:grf.fp1, fp2:grf.fp2, lo:{}, series_hi:{}, fs_force:grf.fs_force, oversample:1, lead_rear_status:grf.lead_rear_status, convention_note:grf.convention_note, body_weight_N:grf.body_weight_N };
    Object.keys(grf.lo).forEach(function(k){ grfW.lo[k]=sl(grf.lo[k]); seriesW[k]=grfW.lo[k]; });
    var framesW=frames.slice(i0,i1+1), xfW=xfactor.slice(i0,i1+1);
    function rmI(iAbs){ var iD=decIdx(iAbs); if(iD==null)return null; var w=iD-i0; return (w>=0&&w<nWin)?w:null; }
    var evW={ i_kl_peak:rmI(iKl), i_fc:rmI(iFc), i_mer:rmI(iMer), i_mer_event:rmI(iMer), i_br:rmI(iBr), i_br100:null,
      t_kl_peak_s:null, t_fc_s:null, t_br_s:null, peak_hand_speed_ms:ev.peak_hand_speed_ms };

    // ── kseq ──
    var kseq=(function(){ var ifc=evW.i_fc, ibr=evW.i_br; if(ifc==null||ibr==null)return {segments:{},deltas:{},peak_order:[],sequence_ok:false,gains:{}};
      function pk(arr){ if(!arr||!arr.length)return {peak_abs:null,frame_rel:null}; var wlo=Math.max(0,ifc-Math.floor(0.3/dtD)), whi=Math.min(arr.length-1,ibr+Math.floor(0.1/dtD)); var bi=argmaxAbs(arr,wlo,whi); return bi<0?{peak_abs:null,frame_rel:null}:{peak_abs:Math.abs(arr[bi]),frame_rel:bi}; }
      var segs={ pelvis:pk(seriesW['Pelvis_Ang_Vel_Z']), trunk:pk(seriesW['Thorax_Ang_Vel_Z']), arm:pk(seriesW['Pitching_Hand_Ang_Vel_X']) };
      var order=Object.keys(segs).sort(function(a,b){return (segs[a].frame_rel==null?1e9:segs[a].frame_rel)-(segs[b].frame_rel==null?1e9:segs[b].frame_rel);});
      var seqOk=JSON.stringify(order)===JSON.stringify(['pelvis','trunk','arm']);
      var deltas={}; if(segs.pelvis.frame_rel!=null&&segs.trunk.frame_rel!=null)deltas.pelvis_to_trunk_ms=Math.round((segs.trunk.frame_rel-segs.pelvis.frame_rel)*dtD*1000*10)/10;
      if(segs.trunk.frame_rel!=null&&segs.arm.frame_rel!=null)deltas.trunk_to_arm_ms=Math.round((segs.arm.frame_rel-segs.trunk.frame_rel)*dtD*1000*10)/10;
      var gains={}; if(segs.pelvis.peak_abs&&segs.trunk.peak_abs)gains.trunk_over_pelvis=Math.round(segs.trunk.peak_abs/segs.pelvis.peak_abs*100)/100; if(segs.trunk.peak_abs&&segs.arm.peak_abs)gains.arm_over_trunk=Math.round(segs.arm.peak_abs/segs.trunk.peak_abs*100)/100;
      return {segments:segs,deltas:deltas,peak_order:order,sequence_ok:seqOk,gains:gains}; })();

    // ── 에너지(KE 기반: 병진+회전, IMU 각속도 직접측정 → 신뢰도↑) ──
    // [FIX 2026-05-25] 분절 관성·KE·역동역학 질량도 플레이트 실측 체중 사용(메타 86kg 오류 방지). 폴백=메타.
    var Mb=(typeof bwMeasN!=='undefined'&&bwMeasN>300)?(bwMeasN/9.81):(meta.weight_kg||80);
    function segKE(prox,dist,massFr,comR,kR,omegaKey){
      var w=seriesW[omegaKey]||[], out=new Array(nWin).fill(null), ii;
      for(ii=0;ii<nWin;ii++){ var a=framesW[ii]&&framesW[ii][prox], b=framesW[ii]&&framesW[ii][dist];
        if(!a||!b||!isFinite(a[0])||!isFinite(b[0])){ out[ii]=null; continue; }
        var pa=framesW[ii>0?ii-1:ii], qa=framesW[ii<nWin-1?ii+1:ii];
        var pA=pa&&pa[prox], pB=pa&&pa[dist], qA=qa&&qa[prox], qB=qa&&qa[dist];
        // 분절 com (mm→m)
        var cx=(a[0]+comR*(b[0]-a[0]))/1000, cyy=(a[1]+comR*(b[1]-a[1]))/1000, cz=(a[2]+comR*(b[2]-a[2]))/1000;
        var pcx=pA&&pB?(pA[0]+comR*(pB[0]-pA[0]))/1000:cx, pcy=pA&&pB?(pA[1]+comR*(pB[1]-pA[1]))/1000:cyy, pcz=pA&&pB?(pA[2]+comR*(pB[2]-pA[2]))/1000:cz;
        var qcx=qA&&qB?(qA[0]+comR*(qB[0]-qA[0]))/1000:cx, qcy=qA&&qB?(qA[1]+comR*(qB[1]-qA[1]))/1000:cyy, qcz=qA&&qB?(qA[2]+comR*(qB[2]-qA[2]))/1000:cz;
        var hh=(ii>0&&ii<nWin-1)?2*dtD:dtD; var vx=(qcx-pcx)/hh, vy=(qcy-pcy)/hh, vz2=(qcz-pcz)/hh;
        var L=Math.sqrt(Math.pow(b[0]-a[0],2)+Math.pow(b[1]-a[1],2)+Math.pow(b[2]-a[2],2))/1000;
        var m=massFr*Mb, I=m*Math.pow(kR*L,2), om=(isFinite(w[ii])?w[ii]*Math.PI/180:0);
        out[ii]=r1(0.5*m*(vx*vx+vy*vy+vz2*vz2)+0.5*I*om*om);
      } return out;
    }
    // 몸통·골반 분절 KE (energy_transfer 흐름순서용; 팔 ME는 _armID가 산출)
    seriesW['Trunk_ME_X']=segKE('pelvis_o','neck',0.497,0.5,0.5,'Thorax_Ang_Vel_Z');
    seriesW['Pelvis_ME_X']=segKE((throwS==='right'?'r_hip':'l_hip'),(gloveS==='right'?'r_hip':'l_hip'),0.142,0.5,0.5,'Pelvis_Ang_Vel_Z');
    // [FIX 2026-05-25] 손 분절 ME(키네틱 체인 말단) — 병진 KE 지배(릴리스 손속도). 회전항은 전완 ω로 근사.
    seriesW['Pitching_Hand_ME_X']=segKE((throwS==='right'?'r_wrist':'l_wrist'),(throwS==='right'?'r_hand_tip':'l_hand_tip'),0.006,0.506,0.297,'Pitching_Forearm_Ang_Vel_Z');

    // ── 토크/힘 요약 (역동역학 채널 peak; FC~BR) — '측정' 아닌 IMU 역동역학 추정 ──
    var imu_torque={};
    (function(){ var lo=evW.i_fc||0, hi=(evW.i_br!=null?evW.i_br+5:nWin-1);
      function pkw(key){ var a=seriesW[key]||[]; var bi=argmaxAbs(a,lo,Math.min(hi,a.length-1)); return bi<0?null:Math.abs(a[bi]); }
      imu_torque.elbow_varus_Nm=pkw('Pitching_Elbow_Moment_Y');
      imu_torque.shoulder_ir_Nm=pkw('Pitching_Shoulder_Moment_Z');
      imu_torque.shoulder_distraction_N=pkw('Pitching_Shoulder_Force_Y');
      imu_torque.elbow_power_W=pkw('Pitching_Elbow_Power_X');
      imu_torque.shoulder_power_W=pkw('Pitching_Shoulder_Power_X');
    })();

    // ── scalars ── (Theia 키 + IMU 추가)
    function at(key,iD){ var a=seriesW[key]; return (a&&iD!=null&&iD<a.length&&isFinite(a[iD]))?a[iD]:null; }
    function spk(key,lo,hi,signed){ var a=seriesW[key]||[]; var bi=argmaxAbs(a,lo||0,hi||a.length-1); if(bi<0)return null; return signed?a[bi]:Math.abs(a[bi]); }
    var ifc=evW.i_fc, ibr=evW.i_br, ikl=evW.i_kl_peak, imer=evW.i_mer;
    var xfWin=xfW.slice(ikl||0,(ibr!=null?ibr+1:xfW.length)).filter(isFinite);
    var scalars={
      shoulder_er_max: spk('Pitching_Shoulder_Angle_Z',ifc||0,ibr||0,true),
      pelvis_rot_velo_peak: spk('Pelvis_Ang_Vel_Z',ikl||0,ibr||0,false),
      trunk_rot_velo_peak: spk('Thorax_Ang_Vel_Z',ikl||0,ibr||0,false),
      elbow_flex_fp: at('Pitching_Elbow_Angle_X',ifc), shoulder_abd_fp: at('Pitching_Shoulder_Angle_X',ifc),
      lead_knee_fp: at('Lead_Knee_Angle_X',ifc), lead_knee_br: at('Lead_Knee_Angle_X',ibr), back_knee_fp: at('Back_Knee_Angle_X',ifc),
      x_factor_max: xfWin.length?Math.max.apply(null,xfWin):null,
      stride_length: null,
      grf_fp1_peak_pct_bw: grf.fp1.peak_z_pct_bw, grf_fp2_peak_pct_bw: grf.fp2.peak_z_pct_bw,
      // IMU 고유
      back_hip_er_max: spk('Back_Hip_Rotation_X',ikl||0,ibr||0,true),
      back_hip_rot_vel_peak: spk('Back_Hip_Rot_Vel_X',ikl||0,ibr||0,false),
      wrist_radial_br: at('Pitching_Wrist_Radial_X',ibr), wrist_flexion_br: at('Pitching_Wrist_Flexion_X',ibr),
      // 역동역학(IMU 추정) 토크·파워 peak
      elbow_valgus_torque: imu_torque.elbow_varus_Nm, shoulder_ir_torque: imu_torque.shoulder_ir_Nm, shoulder_distraction_N: imu_torque.shoulder_distraction_N,
      elbow_power_peak: imu_torque.elbow_power_W, shoulder_power_peak: imu_torque.shoulder_power_W
    };

    // ── grf_metrics (CoP 없음 → 타이밍 위주) ──
    var grf_metrics={};
    (function(){ var z1=seriesW['FP1_Z']||[], z2=seriesW['FP2_Z']||[];
      var ir=argmaxAbs(z1,0,z1.length-1), il=argmaxAbs(z2,0,z2.length-1);
      if(ir>=0&&ifc!=null)grf_metrics.rear_peak_to_fc_ms=Math.round((ifc-ir)*dtD*1000);
      if(il>=0&&ifc!=null)grf_metrics.fc_to_lead_peak_ms=Math.round((il-ifc)*dtD*1000);
      if(ifc!=null&&ibr!=null)grf_metrics.fc_to_br_ms=Math.round((ibr-ifc)*dtD*1000);
    })();

    return {
      setup:{ dt:dtD, nFrames:nWin, fs:Math.round(1/dtD), iLo:i0, iHi:i1 },
      events:evW, series:seriesW, frames:framesW, x_factor:xfW, grf:grfW, kseq:kseq, scalars:scalars, grf_metrics:grf_metrics,
      detected_throw_side:throwS, throw_side:throwS, glove_side:gloveS,
      ground_y_m:0, viewer_origin_horiz0_m:0, viewer_origin_horiz1_m:0, axis_up:'Y', horiz_axes:['X','Z'],
      imu_torque:imu_torque, system:'IMU(MR3)', trial_label:trialLabel||'Trial',
      meta:{ athlete:athlete, fps:Math.round(1/dtD), dt:dtD, n_frames:nWin, hand:hand, throw_side:throwS, glove_side:gloveS, handedness:throwS.charAt(0).toUpperCase() }
    };
  }

  return { extractTrial:extractTrial, detectEvents:detectEvents, parseMR3:parseMR3 };
});
