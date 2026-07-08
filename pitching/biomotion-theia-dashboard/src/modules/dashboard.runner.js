
(function(){
 var fileEl=document.getElementById('file'),drop=document.getElementById('drop'),msg=document.getElementById('msg'),list=document.getElementById('list'),bar=document.getElementById('bar'),barIn=bar.firstElementChild,teambar=document.getElementById('teambar'),fitfileEl=document.getElementById('fitfile'),fitmsg=document.getElementById('fitmsg');
 var sleep=function(){return new Promise(function(r){setTimeout(r,0);});};

 // ── [2026-05-28] 트랙 격리 게이트 ──
 // 각 트랙 대시보드는 자기 입력만 받고 자기 system 레코드만 표시.
 // localStorage.track = 'Theia' | 'Uplift' | 'IMU' (셸이 설정)
 var __TRACK = (function(){ try{ return localStorage.getItem('track') || 'Theia'; }catch(e){ return 'Theia'; } })();
 // [2026-06-10 DB 완전분리] 앱별 DB 네임스페이스 = 셸이 window.APP_CONFIG로 주입. 미설정 시 기본값(하위호환·무손상).
 //  다른 트랙 앱은 별도 IndexedDB·버킷·테이블을 선언해 물리적으로 분리(런타임 필터 의존 제거). 점수 SSOT 무관.
 var __APP = (function(){ try{ return (typeof window!=='undefined' && window.APP_CONFIG) ? window.APP_CONFIG : {}; }catch(e){ return {}; } })();
 function __trackLabel(){ return __TRACK==='IMU'?'IMU(MR3)':__TRACK; }
 function __isMyTrackPlayer(p){
   if(__TRACK === 'Uplift') return !!p.uplift;
   if(__TRACK === 'IMU')    return !!p.imu;
   /* Theia (default) */    return !p.uplift && !p.imu;
 }
 function __isMyTrackRecord(rec){
   var sys = ((rec&&rec.system)||'').toLowerCase();
   if(__TRACK === 'Uplift') return /uplift/.test(sys);
   if(__TRACK === 'IMU')    return /imu/.test(sys);
   /* Theia */              return !sys || /theia/.test(sys) || !(/uplift|imu/.test(sys));
 }
 function __otherTrackOf(p){ return p.uplift?'Uplift':(p.imu?'IMU(MR3)':'Theia'); }

 function repl(t,k,v){return t.split(k).join(v);}
 /* [2026-06-25] buildReportHTML(인라인 팝업 리포트: report.engine.js+THREE 3D)은 도달불가 죽은 코드였음(호출부 0건 —
    실제 리포트는 아래 openReport()가 React dashboard/ 핸드오프로 엶). __JS/__TPL/__THREE/__ORBIT BLOB과 함께 제거해
    2.3MB 죽은 페이로드가 index.html에 항상 파싱되던 OOM 재발 원인을 구조적으로 제거(build.py measure 참고). */
 /* ── 두 선수 비교: 저장된 다른 선수들의 슬림 데이터(대표 trial·필요 컬럼·frames 제거) 임베드 ── */
 var _NEEDED_COLS=['Pitching_Shoulder_Angle_Z','Pitching_Shoulder_Angle_X','Pelvis_Angle_Z','FP1_Z_3','Back_Hip_Angle_X','Trunk_Angle_Z','Trunk_Angle_X','FP1_Y','COM_Velocity_Y','Back_Hip_Angle_Y','FP2_Z','L_Knee_Moment_X','R_Knee_Moment_X','Lead_Knee_Angle_X','FP2_Y','Lead_Knee_Power_X','Trunk_ME_X','Thorax_Ang_Vel_Z','Pitching_Shoulder_Ang_Vel_Z','Pitching_Humerus_ME_X','Pitching_Elbow_Ang_Vel_X','Pitching_Elbow_Power_X','Pitching_Shoulder_Power_X',
   /* [2026-05-28] 9단계 진단 그래프가 쓰는 시계열 보강 — 선수 비교 시 모든 변인 곡선 표시 */
   'COM_displacement_Y','Back_Hip_Power_X','Pelvis_Ang_Vel_Z','Thorax_Ang_Vel_X','Pitching_Shoulder_Moment_X','Pitching_Elbow_Moment_X'];
 function _seqAgg(D){ var ts=D.trials||[]; var nT=0,nSeq=0,nFlow=0,nW=0,sumW=0,sumD1=0,nD1=0,sumD2=0,nD2=0;
   function meFlow(t){ var S=t.series||{},e=t.events||{}; if(e.i_fc==null||e.i_br==null)return null; function pf(a){if(!a)return null;var bi=null,bv=-Infinity;for(var i=e.i_fc;i<=e.i_br&&i<a.length;i++){var v=Math.abs(a[i]);if(isFinite(v)&&v>bv){bv=v;bi=i;}}return bi;} var tp=pf(S.Trunk_ME_X),hp=pf(S.Pitching_Humerus_ME_X); if(tp==null||hp==null)return null; return tp<=hp; }
   ts.forEach(function(t){ var k=t.kseq||{}; if(!k.deltas)return; nT++; if(k.sequence_ok)nSeq++; var d1=k.deltas.pelvis_to_trunk_ms,d2=k.deltas.trunk_to_arm_ms; if(d1!=null){sumD1+=d1;nD1++;} if(d2!=null){sumD2+=d2;nD2++;} var w=(k.gains&&k.gains.arm_over_trunk); if(w!=null){sumW+=w;nW++;} if(meFlow(t))nFlow++; });
   if(!nT)return null; return {n:nT, seqOk:nSeq, flowOk:nFlow, d1:nD1?Math.round(sumD1/nD1*10)/10:null, d2:nD2?Math.round(sumD2/nD2*10)/10:null, whip:nW?Math.round(sumW/nW*100)/100:null}; }
 function _fastestTrialIndex(D){ if(!D||!D.trials||!D.trials.length) return 0; var best=null,bv=-1,i,t,v; for(i=0;i<D.trials.length;i++){ t=D.trials[i]; v=t.rapsodo&&t.rapsodo.velocity_kmh; if(v!=null&&isFinite(v)&&v>bv){ bv=v; best=i; } } if(best!=null) return best; var bi=(D.best_trial_index||1)-1; return (bi>=0&&bi<D.trials.length)?bi:0; }
 // [fast/slow] trial 속도 점수 — 구속(km/h) 우선, 없으면 손 각속도 peak(|max|) 폴백. 단위 혼합 금지(풀은 전부 velo 또는 전부 hand).
 function _p2TrialSpeed(t){
   if(!t) return null;
   var v=t.rapsodo&&t.rapsodo.velocity_kmh;
   if(v!=null&&isFinite(v)) return {v:+v, src:'velo'};
   var s=t.series||{}, a=s.Pitching_Hand_Ang_Vel_X||s.Pitching_Forearm_Ang_Vel_Z||s.Pitching_Hand_Ang_Vel_Z;
   if(Array.isArray(a)&&a.length){ var pk=0,i,x; for(i=0;i<a.length;i++){ x=Math.abs(+a[i]); if(isFinite(x)&&x>pk)pk=x; } if(pk>0) return {v:pk, src:'hand'}; }
   return null;
 }
 // 최속·최저속 trial 인덱스. velo 태그 trial이 하나라도 있으면 그 풀만 랭크, 없으면 손 peak 풀. n===1 ⇒ 단일.
 function _p2FastSlow(D){
   if(!D||!D.trials||!D.trials.length) return {fast:0, slow:0, n:1, src:null};
   var scored=[], anyVelo=false, i, sc;
   for(i=0;i<D.trials.length;i++){ sc=_p2TrialSpeed(D.trials[i]); if(sc){ if(sc.src==='velo')anyVelo=true; scored.push({i:i, sc:sc}); } }
   var pool = anyVelo ? scored.filter(function(o){return o.sc.src==='velo';}) : scored;
   if(!pool.length){ var bi=(D.best_trial_index||1)-1; bi=(bi>=0&&bi<D.trials.length)?bi:0; return {fast:bi, slow:bi, n:1, src:null}; }
   pool.sort(function(a,b){ return b.sc.v-a.sc.v; });
   var fast=pool[0].i, slow=pool[pool.length-1].i;
   return {fast:fast, slow:slow, n:(fast===slow?1:2), src:pool[0].sc.src};
 }
 function _slimCompare(D){ if(!D||!D.trials||!D.trials.length) return null; var bi=_fastestTrialIndex(D); var t=D.trials[bi]; var ser={}; if(t.series){ _NEEDED_COLS.forEach(function(c){ if(t.series[c]) ser[c]=t.series[c]; }); } var slimT={ meta:(t.meta||{dt:(t.setup&&t.setup.dt)||0.00333}), events:t.events, series:ser, x_factor:t.x_factor||null, frames:(t.frames||null), rapsodo:t.rapsodo||null }; return { name:(D.player&&D.player.name)||'선수', player:{name:(D.player&&D.player.name)||'선수', handedness:(D.player&&D.player.handedness)||'R'}, phases:D.phases||null, trials:[slimT], best_trial_index:1, measured_kmh:D.measured_kmh||null, seq_summary:_seqAgg(D) }; }
 function _stashDashReturn(){ try{ sessionStorage.setItem('bm_dash_return', window.location.href); }catch(e){} }
 // INTEG-01 Phase 1: 신규 Theia 분석을 dashboard 세션 선수로 전달한다. 점수 산식은 재계산하지 않고 phases 출력만 재구성한다.
/* ── [2026-06-18] 엘리트 규준 자동갱신 (Theia) ──────────────────────────────────────────
   판정 규준 = '누적된 엘리트 코호트'의 결정함수. 코호트(클라우드 공유 + 로컬)의 phases.stages 값에서
   변인별 p25/med/p75를 재계산 → 슬림에 eliteNormsLive로 실어 보냄 → 뷰어가 NORM_BANDS를 병합(렌더 시 밴드 재계산).
   연구원이 엘리트를 코호트에 추가 → 재계산(자동/버튼) → 공유 Storage(__elite_norms__/Theia.json) 캐시
   → 모든 대시보드가 로드시 적용. 미성년 보호: 규준은 분위수(집계)만 — 개인 식별 불가. 원천은 401 게이트.
   ※ Uplift와 독립 구현(분리 원칙) — Theia 밴드는 뷰어 NORM_BANDS(렌더타임)라 슬림 병합 방식.            */
var _LIVE_NORMS=null, _LIVE_META=null, _NORM_MIN_N=8;   // 변인별 표본 이 수↑면 라이브 활성(유연 — 작은 코호트도 시작 가능, 많을수록 정밀)
// [2026-06-18 핫픽스] 규준 자동변경 전면 OFF. 데이터 입력/로드/코호트 업로드가 규준을 자동으로 바꾸던 경로(아래 :loadSavedPlayers·:renderCloudPanel·:buildAllData)를
//   전부 이 플래그로 차단 → 검증된 정적 엘리트(n=20) 규준을 기본 사용. 규준 변경은 「엘리트 규준 재계산」 버튼(_recomputeEliteNorms)으로만 명시적 적용(수동 전용).
//   사유: 자동갱신이 전 선수 점수 폭등·평가 동일화(이영하≡문서준) 회귀를 유발. 코호트 정제+최소표본 상향+빌드타임 베이킹 검증 후에만 true 복귀.
var _LIVE_NORMS_AUTO=false;
// [2026-06-18 A안] 규준 발행은 관리자 전용. 연구원은 코호트 수집·저장만 하고, 규준 변경은 관리자가 검증 후 수행(권장: 빌드타임 베이킹).
//   라이브 「엘리트 규준 재계산」 버튼은 아래 _NORM_ADMIN 플래그가 켜진 세션에서만 노출 → 연구원 화면에선 숨김(실수 클릭=공유규준 덮어쓰기 회귀 방지).
//   관리자 활성화: 콘솔에서 localStorage.setItem('bm_norm_admin','1') 또는 URL 끝에 #normadmin 추가 후 새로고침.
var _NORM_ADMIN=(function(){ try{ return (typeof localStorage!=='undefined'&&localStorage.getItem('bm_norm_admin')==='1')||/(?:^|[#&])normadmin(?:\b|=1)/.test((typeof location!=='undefined'&&location.hash)||''); }catch(e){ return false; } })();
function _normRecalcBtnHTML(){ return _NORM_ADMIN ? '<button class="dbtn" style="background:#b8862b;flex:0 0 auto" onclick="_runEliteNormRecompute(this)" title="[관리자 전용] 클라우드 코호트 엘리트 전체로 판정 규준(p25/med/p75)을 재계산해 공유 반영. 검증 후에만 사용.">↻ 엘리트 규준 재계산(관리자)</button>' : ''; }
var _NORM_MARK='__ELITE_NORMS__';                       // 규준 캐시를 가리키는 메타테이블 마커(공유·RLS 불요)
function _NORM_SYS(){ return (typeof __APP!=='undefined'&&__APP.system)||'Theia'; }
function _NORM_PATH(){ return (typeof _SBUSER!=='undefined'&&_SBUSER?(_SBUSER.id+'/'):'')+'__elite_norms__/'+_NORM_SYS()+'.json'; }
function _isCohortGrp(g){ return /코호트|cohort|elite|엘리트|검증/i.test(g||''); }
function _pctile(arr,p){ var a=arr.slice().sort(function(x,y){return x-y;}); if(!a.length)return null; var i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i); return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo); }
// 코호트 풀데이터 → {key:{p25,med,p75,n}} (수치 변인 전부·n≥min — 뷰어 NORM_BANDS가 매칭 키만 사용)
function _computeNormsFromCohort(datas){
  var acc={};
  (datas||[]).forEach(function(D){ if(!D||!D.phases)return; ((D.phases.stages)||[]).forEach(function(s){ ((s.metrics)||[]).forEach(function(m){
    if(!m||!m.key||typeof m.key!=='string'||m.value==null)return; var v=+m.value; if(!isFinite(v))return;
    (acc[m.key]=acc[m.key]||[]).push(v);
  }); }); });
  var out={}; Object.keys(acc).forEach(function(k){ var a=acc[k]; if(a.length<_NORM_MIN_N)return;
    out[k]={p25:Math.round(_pctile(a,0.25)*1000)/1000, med:Math.round(_pctile(a,0.5)*1000)/1000, p75:Math.round(_pctile(a,0.75)*1000)/1000, n:a.length}; });
  return out;
}
// 라이브 규준 보관(window._LIVE_NORMS = 슬림에 실어 뷰어 NORM_BANDS 병합) + PITCH_NORMS 보유키는 제자리 갱신(바이크타임 정합·무해)
function _applyLiveNorms(live, meta){
  _LIVE_NORMS=live||null; _LIVE_META=meta||{}; var applied=0;
  if(typeof window!=='undefined'){
    var PN=window.PITCH_NORMS;
    if(PN){ if(!window.__PN_BASE){ var b={}; Object.keys(PN).forEach(function(k){ if(PN[k]&&typeof PN[k]==='object')b[k]={p25:PN[k].p25,med:PN[k].med,p75:PN[k].p75,n:PN[k].n}; }); window.__PN_BASE=b; }
      var base=window.__PN_BASE; Object.keys(base).forEach(function(k){ if(PN[k]){ PN[k].p25=base[k].p25; PN[k].med=base[k].med; PN[k].p75=base[k].p75; PN[k].n=base[k].n; if(PN[k]._live)delete PN[k]._live; } });
      if(live)Object.keys(live).forEach(function(k){ var lv=live[k]; if(PN[k]&&lv&&lv.n>=_NORM_MIN_N){ PN[k].p25=lv.p25; PN[k].med=lv.med; PN[k].p75=lv.p75; PN[k].n=lv.n; PN[k]._live=true; } }); }
    applied=live?Object.keys(live).length:0;
    _LIVE_META.applied=applied; window._LIVE_NORMS=_LIVE_NORMS; window._LIVE_NORM_META=_LIVE_META;
    try{ var el=document.getElementById('elite-norm-msg'); if(el&&applied){ var src=(_LIVE_META.src==='cloud'?'클라우드 공유':'로컬'); el.innerHTML='<span style="color:#7fd18b">● 라이브 규준 적용중</span> — '+src+' 코호트 n='+(_LIVE_META.cohortN||'?')+' · 변인 '+applied+'개'; } }catch(e){}
  }
  return applied;
}
function _liveNormsFromLocal(cb){
  try{ dbAll(function(err,recs){ if(err||!recs){ cb&&cb(0); return; }
    var sys=_NORM_SYS(), coh=recs.filter(function(r){ return r&&r.group==='cohort'&&r.DATA&&r.system===sys; });  // [2026-06-18 핫픽스] fail-closed: system 정확 일치만(무태그/타시스템 제외) — Theia↔Uplift 규준 누수 차단
    if(coh.length<2){ cb&&cb(0,coh.length); return; }
    var n=_applyLiveNorms(_computeNormsFromCohort(coh.map(function(r){return r.DATA;})),{src:'local',cohortN:coh.length,at:Date.now()});
    cb&&cb(n,coh.length);
  }); }catch(e){ cb&&cb(0); }
}
function _liveNormsFromCloud(cb){
  if(typeof SB==='undefined'||!SB){ cb&&cb(0); return; }
  var sys=_NORM_SYS();
  try{ SB.from(_SB_TABLE).select('*').eq('player_name',_NORM_MARK).order('saved_at',{ascending:false}).then(function(r){
    var rows=((r&&r.data)||[]).filter(function(x){ return x&&x.storage_path&&x.system&&(''+x.system).toLowerCase()===sys.toLowerCase(); });  // [2026-06-18 핫픽스] fail-closed: 정확 시스템 일치만(무태그/이진매칭 제거) — 교차 시스템 규준 로드 차단
    if(!rows.length){ cb&&cb(0); return; }
    SB.storage.from(_SB_BUCKET).download(rows[0].storage_path).then(function(r2){ if(!r2||r2.error||!r2.data){ cb&&cb(0); return; }
      r2.data.text().then(function(t){ try{ var j=JSON.parse(t); var n=_applyLiveNorms(j.norms||j,{src:'cloud',cohortN:j.cohortN,at:j.computedAt}); cb&&cb(n,j.cohortN); }catch(e){ cb&&cb(0); } });
    },function(){ cb&&cb(0); });
  },function(){ cb&&cb(0); }); }catch(e){ cb&&cb(0); }
}
function _recomputeEliteNorms(onMsg, onDone){
  if(typeof SB==='undefined'||!SB||!_SBUSER){ onMsg&&onMsg('클라우드 로그인이 필요합니다(공유 규준 갱신).'); onDone&&onDone('login'); return; }
  var sys=_NORM_SYS(); onMsg&&onMsg('코호트 목록 조회 중…');
  SB.from(_SB_TABLE).select('*').then(function(r){ if(r.error){ onMsg&&onMsg('목록 오류: '+r.error.message); onDone&&onDone(r.error); return; }
    var recs=(r.data||[]).filter(function(rc){ return rc&&rc.storage_path&&_isCohortGrp(rc.grp); });
    if(!recs.length){ onMsg&&onMsg('클라우드에 「코호트(검증용)」로 등록된 '+sys+' 엘리트가 없습니다. 먼저 코호트 그룹으로 업로드하세요.'); onDone&&onDone('empty'); return; }
    var datas=[], i=0;
    (function nx(){ if(i>=recs.length){
        var live=_computeNormsFromCohort(datas), nKeys=Object.keys(live).length;
        if(!nKeys){ onMsg&&onMsg('규준 산출 실패 — 변인별 표본 부족(n<'+_NORM_MIN_N+').'); onDone&&onDone('insufficient'); return; }
        var payload={ system:sys, cohortN:datas.length, computedAt:Date.now(), minN:_NORM_MIN_N, norms:live };
        var npath=_SBUSER.id+'/__elite_norms__/'+sys+'.json';   // 사용자 경로(쓰기 허용·RLS 불요)
        onMsg&&onMsg('규준 업로드 중…(변인 '+nKeys+'개·코호트 '+datas.length+'명)');
        SB.storage.from(_SB_BUCKET).upload(npath, new Blob([JSON.stringify(payload)],{type:'application/json'}), {upsert:true}).then(function(up){ if(up.error){ onMsg&&onMsg('규준 업로드 오류: '+up.error.message); onDone&&onDone(up.error); return; }
          // 메타테이블 마커 갱신(내 이전 마커=같은 storage_path 삭제 후 삽입) → 모든 연구원이 최신 규준을 찾아 읽음(읽기 전체개방)
          function _ins(){ SB.from(_SB_TABLE).insert({ player_name:_NORM_MARK, grp:'__norms__', n_trials:datas.length, system:sys, storage_path:npath }).then(function(){
              var applied=_applyLiveNorms(live,{src:'cloud',cohortN:datas.length,at:payload.computedAt});
              onMsg&&onMsg('엘리트 규준 갱신 — 코호트 '+datas.length+'명·변인 '+nKeys+'개. 모든 연구원/리포트에 재오픈시 자동 반영.');
              onDone&&onDone(null,{cohortN:datas.length,keys:nKeys,applied:applied});
            },function(e){ _applyLiveNorms(live,{src:'cloud',cohortN:datas.length,at:payload.computedAt}); onMsg&&onMsg('규준 저장됨(마커 경고: '+(e&&e.message||e)+')'); onDone&&onDone(null,{cohortN:datas.length,keys:nKeys}); }); }
          SB.from(_SB_TABLE).delete().eq('storage_path',npath).then(_ins,_ins);
        },function(e){ onMsg&&onMsg('규준 업로드 실패: '+(e&&e.message||e)); onDone&&onDone(e); });
        return;
      }
      SB.storage.from(_SB_BUCKET).download(recs[i].storage_path).then(function(r2){ if(!r2.error&&r2.data){ r2.data.text().then(function(t){ try{ datas.push(JSON.parse(t)); }catch(e){} i++; onMsg&&onMsg('코호트 내려받는 중… '+i+'/'+recs.length); nx(); }); } else { i++; nx(); } },function(){ i++; nx(); });
    })();
  },function(e){ onMsg&&onMsg('목록 오류: '+(e&&e.message||e)); onDone&&onDone(e); });
}
function _runEliteNormRecompute(btn){ if(btn)btn.disabled=true; var el=document.getElementById('elite-norm-msg');
  _recomputeEliteNorms(function(t){ if(el)el.textContent=t; }, function(err,res){ if(btn)btn.disabled=false; if(!err&&res&&el){ el.innerHTML='<span style="color:#7fd18b">● 라이브 규준 적용중</span> — 코호트 '+res.cohortN+'명·변인 '+res.keys+'개. 저장된 리포트는 재오픈시 새 규준 반영.'; } }); }
if(typeof window!=='undefined'){ window._recomputeEliteNorms=_recomputeEliteNorms; window._liveNormsFromCloud=_liveNormsFromCloud; window._liveNormsFromLocal=_liveNormsFromLocal; window._runEliteNormRecompute=_runEliteNormRecompute; }

function _dashSessionSlim(DATA){
  DATA=DATA||{};
  return {
    player: DATA.player||{},
    name: (DATA.player&&DATA.player.name)||DATA.playerName||DATA.name||"",
    measured_kmh: DATA.measured_kmh,
    velo_summary: DATA.velo_summary||null,
    phases: DATA.phases||null,
    attractors: DATA.attractors||null,   // [2026-06-19] Theia 네이티브 어트랙터 — 세션 리포트 React 가 _curRec.attractors 로 렌더
    todaysAttractor: DATA.todaysAttractor||null,
    etdiag: (function(){ try{ return (typeof etDiag!=='undefined'&&etDiag.compute)?etDiag.compute(DATA):null; }catch(e){ return null; } })(),   // [2026-06-19] 세션 유형카드(몸통·팔)용 — integ01 applyTypeLayer 가 trunk7/trunkarm8/armball9 읽음
    phaseData: DATA.phaseData||null,
    eliteNormsLive: (typeof window!=='undefined'&&window._LIVE_NORMS)||null,   // [2026-06-18] 라이브 규준 → 뷰어 NORM_BANDS 병합(재오픈시 자동반영)
    _team: DATA._team||DATA.team||"",
    system: DATA.system||"",
    savedAt: Date.now()
  };
}
function _dashSessionStore(DATA){
  try{
    var slim=_dashSessionSlim(DATA);
    var nm=(slim.name||"").trim();
    if(!nm) return false;
    var item={analysis:slim,savedAt:Date.now()};
    function put(store){
      if(!store||!store.getItem||!store.setItem) return;
      var arr=[];
      try{
        var prev=JSON.parse(store.getItem("biomotion:dashboard:session:players")||"{}");
        arr=Array.isArray(prev)?prev:(Array.isArray(prev.players)?prev.players:[]);
      }catch(e){ arr=[]; }
      arr=arr.filter(function(v){
        var a=(v&&v.analysis)?v.analysis:v;
        var name=(a&&((a.player&&a.player.name)||a.name||a.playerName))||"";
        return String(name).trim()!==nm;
      });
      arr.push(item);
      store.setItem("biomotion:dashboard:session:players", JSON.stringify({version:1,savedAt:Date.now(),players:arr}));
    }
    put(window.sessionStorage);
    put(window.localStorage);
    return true;
  }catch(e){
    console.warn("[INTEG-01] dashboard session store failed", e);
    return false;
  }
}
// INTEG-01 Phase 2: 신규 Theia 분석의 동작 frame 을 dashboard 세션에 원본 그대로 저장(변환은 viewer 모듈). 점수 산식 미변경.
function _p2BestTrial(DATA){
  try{
    if(!DATA) return null;
    var tr=DATA.trials;
    if(Array.isArray(tr)&&tr.length){ var bi=(DATA.best_trial_index||1)-1; return tr[bi]||tr[0]; }
    if(DATA.frames) return DATA;
    return null;
  }catch(e){ return null; }
}
function _p2StoreFrames(DATA){
  try{
    var SK="biomotion:dashboard:session:frames", MAX=6;
    var base=(DATA&&DATA.player&&DATA.player.name)||DATA.playerName||DATA.name||""; base=(base||"").trim();
    if(!base) return false;
    var sys=(DATA&&DATA.system)||"Theia";
    var fs=_p2FastSlow(DATA);   // {fast, slow, n, src}
    function buildItem(idx, key, label, fsTag){
      var t=(DATA.trials&&DATA.trials[idx])||_p2BestTrial(DATA);
      if(!t||!t.frames||!t.frames.length) return null;
      var tmeta=t.meta||t.setup||{};
      var n=(t.frames&&t.frames.length)||tmeta.n_frames||tmeta.nFrames||tmeta.n;
      var gy=(DATA.ground_y_m!=null?DATA.ground_y_m:tmeta.ground_y_m);
      var pv=(t.rapsodo&&t.rapsodo.velocity_kmh!=null)?t.rapsodo.velocity_kmh:DATA.measured_kmh;
      var slim={ frames:t.frames, series:t.series||{}, events:t.events||{}, meta:{ dt:tmeta.dt, fps:tmeta.fps, n:n, ground_y_m:gy } };
      var meta={ name:key, label:label, velo:pv, base:base, fastslow:fsTag, fsSrc:fs.src, system:sys,
        hand:(DATA.player&&(DATA.player.handedness||DATA.player.hand)),
        group:(DATA._team||DATA.team||"세션"),
        height_m:(DATA.player&&DATA.player.height_m),
        mass_kg:(DATA.player&&(DATA.player.weight_kg||DATA.player.mass_kg)),
        ground_y_m:(gy!=null?gy:0), fps:tmeta.fps, dt:tmeta.dt, n:n };
      return { name:key, trial:slim, meta:meta, savedAt:Date.now() };
    }
    var items=[];
    // 대표(=빠른) = base 키(기존 단일저장·기본 ?player={base} 호환). 다중 trial이면 느린 = {base}·느린 추가.
    var fastIt=buildItem(fs.fast, base, base, "fast"); if(fastIt) items.push(fastIt);
    if(fs.n===2){ var slowIt=buildItem(fs.slow, base+"·느린", base+" · 느린 구속", "slow"); if(slowIt) items.push(slowIt); }
    if(!items.length) return false;
    var names=items.map(function(it){ return it.name; });
    function readAll(store){ try{ var p=JSON.parse(store.getItem(SK)||"{}"); return Array.isArray(p.players)?p.players:(Array.isArray(p)?p:[]); }catch(e){ return []; } }
    function put(store){
      if(!store||!store.setItem) return;
      var arr=readAll(store).filter(function(v){ return v&&names.indexOf(String(v.name).trim())<0; });
      items.forEach(function(it){ arr.push(it); });
      arr.sort(function(a,b){ return (b.savedAt||0)-(a.savedAt||0); });
      if(arr.length>MAX) arr=arr.slice(0,MAX);
      try{ store.setItem(SK, JSON.stringify({version:1,savedAt:Date.now(),players:arr})); }
      catch(e){ try{ store.setItem(SK, JSON.stringify({version:1,savedAt:Date.now(),players:items.slice()})); }catch(e2){} }
    }
    put(window.localStorage);
    put(window.sessionStorage);
    return true;
  }catch(e){ console.warn("[INTEG-01 P2] fast/slow frame store failed", e); return false; }
}
function _biomotionReportOpen(name){
  var nm=(name||"").trim();
  if(!nm){
    try{ if(typeof msg==="function") msg("선수명이 없어 분석 페이지를 열 수 없습니다."); }catch(e){}
    return;
  }
  window.open("dashboard/?player="+encodeURIComponent(nm),"_blank");
}
function _biomotionReportOpenFromData(DATA){
  var nm=(DATA&&DATA.player&&DATA.player.name)||DATA.playerName||DATA.name||"";
  nm=(nm||"").trim();
  if(!nm){ _biomotionReportOpen(nm); return; }
  _dashSessionStore(DATA);
  try{ _p2StoreFrames(DATA); }catch(e){}
  window.open("dashboard/?player="+encodeURIComponent(nm)+"&src=session","_blank");
}
function openReport(DATA){
  if(DATA&&(DATA.phases||DATA.phaseData)){ _biomotionReportOpenFromData(DATA); return; }
  _biomotionReportOpen((DATA&&DATA.player&&DATA.player.name)||"");
}
function openPlayerReport(DATA){ openReport(DATA); }
 function openPlayerReportPrint(DATA){ openReport(DATA); }
 function _dlHTML(html,fn){ var b=new Blob([html],{type:'text/html'}); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fn; document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); URL.revokeObjectURL(a.href); },300); }
 /* ── 전체 선수 PDF 일괄 출력: 모든 선수용 리포트를 한 문서로 합쳐 인쇄(PDF 저장) ── */
 // 한 선수 full DATA → 섹션 HTML(소형·스칼라만) 추출 + 최초 1회 css 캡처(ctx.css). DATA는 호출측이 즉시 해제.
 function _playerSecFromD(D, ctx){ if(!D||!window.playerReport) return null; var h; try{ h=window.playerReport.buildPlayerHTML(D); }catch(e){ return null; }
   if(ctx.css==null){ var cm=h.match(/<style>([\s\S]*?)<\/style>/); ctx.css=cm?cm[1]:''; }
   var bm=h.match(/<div class="wrap">([\s\S]*)<\/div><\/body>/); return bm?('<section class="wrap" style="page-break-before:always">'+bm[1]+'</section>'):null; }
 function _playersDoc(secs, css){ return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>전체 선수 리포트</title><link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet"><style>'+(css||'')+'\n.pr-topbar .pdfbtn{display:block!important}\nsection.wrap:first-of-type{page-break-before:auto}</style><script>function bmBackToDashboard(){try{if(window.opener&&!window.opener.closed){window.opener.focus();window.close();return;}}catch(e){}var u=null;try{u=sessionStorage.getItem("bm_dash_return");}catch(e2){}if(u){location.href=u;return;}alert("대시보드 탭을 직접 선택하거나, 대시보드를 다시 열어 주세요.");}<\/script></head><body><div class="pr-topbar noprint"><button type="button" class="dashbackbtn" onclick="bmBackToDashboard()">← 대시보드로</button><button type="button" class="pdfbtn" onclick="window.print()">PDF로 저장 / 인쇄 ('+secs.length+'명)</button></div>'+secs.join('')+'</body></html>'; }
 function _allPlayersHTML(list){ if(!window.playerReport){ alert('선수용 리포트 모듈 미로드'); return null; } var ctx={css:null}, secs=[];
   list.forEach(function(D){ var s=_playerSecFromD(D,ctx); if(s)secs.push(s); });
   if(!secs.length)return null; return _playersDoc(secs, ctx.css); }
 function openAllPlayerPDF(list){ var html=_allPlayersHTML(list); if(!html){ msg.innerHTML='<span style="color:#cf6f6c">출력할 선수 리포트가 없습니다</span>'; return; } _stashDashReturn(); var w=window.open('','bm_player_report'); if(!w){ msg.innerHTML='<span style="color:#cf6f6c">팝업 차단됨 — 허용 후 다시</span>'; return; } w.document.open(); w.document.write(html); w.document.close(); setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 1200); }
 // [2026-07-04 OOM v3] 팀 PDF(저장 코호트 100명+): 슬림캐시엔 대용량이 없으므로 선수별 full을 dbGet으로 1건씩 재조회→섹션 HTML(소형)만 누적→DATA 즉시 해제(피크=1건). 이전 _withFullRecs는 N명 full DATA를 동시 상주시켜 대형 팀에서 OOM 위험이었음.
 function openAllPlayerPDFFromRecs(recs){ if(!recs||!recs.length) return; _stashDashReturn(); var w=window.open('','bm_player_report'); if(!w){ if(msg)msg.innerHTML='<span style="color:#cf6f6c">팝업 차단됨 — 허용 후 다시</span>'; return; }
   try{ w.document.open(); w.document.write('<!doctype html><meta charset="utf-8"><body style="font:14px sans-serif;padding:24px;color:#333">리포트 준비 중… 0/'+recs.length+'</body>'); }catch(_){}
   var ctx={css:null}, secs=[], i=0;
   (function nx(){ if(i>=recs.length){ if(!secs.length){ try{ w.document.body.textContent='출력할 리포트가 없습니다'; }catch(_){}; return; } try{ var html=_playersDoc(secs, ctx.css); w.document.open(); w.document.write(html); w.document.close(); setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} },1200); }catch(e){ console.error(e); } return; }
     dbGet(recs[i].id, function(e, full){ var D=(full&&full.DATA)||recs[i].DATA; var s=_playerSecFromD(D,ctx); if(s)secs.push(s); D=null; i++; try{ if(w.document.body) w.document.body.textContent='리포트 준비 중… '+i+'/'+recs.length; }catch(_){}; nx(); }); })(); }
 function openAllPlayerPDFFromUpload(btn){ btn.disabled=true; bar.style.display='block'; barIn.style.width='0'; var DL=[], i=0; (function nx(){ if(i>=PLAYERS.length){ bar.style.display='none'; btn.disabled=false; openAllPlayerPDF(DL); msg.textContent=DL.length+'명 리포트 인쇄(PDF) 준비 완료'; return; } var p=PLAYERS[i]; msg.textContent='리포트 준비… '+(i+1)+'/'+PLAYERS.length; barIn.style.width=Math.round((i+1)/PLAYERS.length*100)+'%'; sleep().then(function(){ try{ if(!p._data)p._data=assemblePlayer(p); DL.push(p._data); }catch(e){ console.error(e); } i++; sleep().then(nx); }); })(); }

 /* ── 분석 결과 저장 (브라우저 IndexedDB) ── */
 var _DB_NAME=(__APP.idb||'biomotion_pitching'), _DB_STORE='players';  // 앱별 IndexedDB(APP_CONFIG.idb) → 트랙 간 로컬 데이터 물리 분리
 function _idb(cb){ try{ var rq=indexedDB.open(_DB_NAME,1); rq.onupgradeneeded=function(e){ var db=e.target.result; if(!db.objectStoreNames.contains(_DB_STORE)) db.createObjectStore(_DB_STORE,{keyPath:'id'}); }; rq.onsuccess=function(e){ cb(null,e.target.result); }; rq.onerror=function(e){ cb(e.target.error); }; }catch(e){ cb(e); } }
 function dbSave(rec,cb){ _idb(function(err,db){ if(err){cb&&cb(err);return;} try{ var tx=db.transaction(_DB_STORE,'readwrite'); tx.objectStore(_DB_STORE).put(rec); tx.oncomplete=function(){cb&&cb(null);}; tx.onerror=function(e){cb&&cb(e.target.error);}; }catch(e){cb&&cb(e);} }); }
 function dbAll(cb){ _idb(function(err,db){ if(err){cb(err);return;} try{ var rq=db.transaction(_DB_STORE,'readonly').objectStore(_DB_STORE).getAll(); rq.onsuccess=function(){cb(null,rq.result||[]);}; rq.onerror=function(e){cb(e.target.error);}; }catch(e){cb(e);} }); }
 // [2026-07-04 OOM 근본수정 v3 — 화이트리스트] 저장선수 목록/카드 렌더는 트라이얼의 어떤 대용량 배열도 불필요
 //   (카드=상위 phases/hp_assessment/velo만 사용, 로드경로에 trials[] 참조 0건 — 감사 검증). 과거 실패=blacklist(frames→series)로
 //   큰 필드를 하나씩 빼다 매번 새 필드를 놓침: v1 frames만→series 잔존 OOM, v2 series까지→**grf.series_hi(오버샘플 지면반력·최대부피)
 //   ·grf.lo·x_factor 잔존** OOM. 근본해결=**역발상 화이트리스트**: 트라이얼에서 렌더에 필요한 소형 필드(meta·events)만 남기고
 //   나머지 전부 제거 → 지금이든 미래든 어떤 대용량 필드가 추가돼도 자동 배제. 상위 frames(일부 레코드에 존재)도 방어적 제외.
 //   대용량이 필요한 소비처=팀 리포트/팀 PDF/리포트열기(전부 버튼 클릭)→그 시점 dbGet으로 선수별 full 재조회(1건씩).
 var _TRIAL_KEEP={ meta:1, events:1 };  // 슬림 트라이얼이 보존할 소형 키(화이트리스트). 그 외(frames·series·grf·x_factor·kseq·rapsodo…)는 전부 제거.
 function _slimSavedDATA(D){ if(!D||typeof D!=='object') return D; var s={}; for(var k in D){ if(k==='trials'||k==='frames') continue; s[k]=D[k]; }
   if(D.trials&&D.trials.map){ s.trials=D.trials.map(function(t){ if(!t||typeof t!=='object') return t; var tt={}; for(var tk in t){ if(_TRIAL_KEEP[tk]) tt[tk]=t[tk]; } return tt; }); }
   return s; }
 // ★★★[2026-07-04 OOM 최종 v5 — 부팅 시 값 0접근] 실측 그라운드트루스(교수 브라우저·키전용 진단): 저장 110명×~10MB(총 ~1.1GB)에서
 //   **값을 '읽는 것' 자체가 OOM** — 커서(v3 프리페치)도, 단건 순차 get(v4·4ms 간격)도 크래시(대용량 역직렬화가 해제보다 빨리 누적).
 //   교수 브라우저서 **오직 getAllKeys(값 미접근)와 '1명만 읽기'만 안전** 확인. 결론: 부팅서 값을 일괄로 읽으면 어떤 방식이든 터진다.
 //   근본해결: **목록은 키(id)에서 이름/팀/그룹만 파싱해 카드 렌더(값 0접근)** → 부팅은 데이터 크기와 무관하게 **절대 OOM 불가**.
 //   개별 선수의 대용량(구속·메카닉·프레임)은 **리포트/팀/PDF를 여는 순간에만** dbGet(단건)로 재조회(교수 브라우저서 '1명 읽기' 안전).
 //   ★대가: 카드 목록의 구속/메카닉 숫자는 즉시 안 뜸(카드를 열면 상세가 나옴) — 값 일괄읽기가 크래시 근원이므로 부팅서 제거.
 //   (후속 개선: 저장 시점에 슬림 요약을 별도 스토어(players_meta)로 함께 저장 → 카드 숫자를 대용량 미접근으로 복원.)
 function _stubFromKey(id){ id=String(id); var p=id.split('::'); var s={ id:id, DATA:null, savedAt:0, n_trials:null, velo:null, spin:null, mech:null, comp:null, _stub:true };
   if(p[0]==='cohort'){ s.group='cohort'; s.name=p[1]||id; s.system=p[2]||'Theia'; s.team='코호트'; }
   else if(p[0]==='team'){ s.group='team'; s.team=p[1]||'기타'; s.name=p[2]||id; s.system=p[3]||'Theia'; }
   else { s.group='team'; s.team='기타'; s.name=id; s.system='Theia'; }
   return s; }
 function dbAllSlim(cb){ _idb(function(err,db){ if(err){cb(err);return;}
   var kq; try{ kq=db.transaction(_DB_STORE,'readonly').objectStore(_DB_STORE).getAllKeys(); }catch(e){ cb(e); return; }
   kq.onerror=function(e){ cb(e.target.error); };
   kq.onsuccess=function(){ var keys=kq.result||[], out=new Array(keys.length); for(var i=0;i<keys.length;i++){ out[i]=_stubFromKey(keys[i]); } cb(null,out); };  /* 값(DATA) 미접근 — 키만 */
 }); }
 // 단건 full DATA 재조회(리포트/뷰어/클라우드 백업 = 프레임 필요할 때만)
 function dbGet(id,cb){ _idb(function(err,db){ if(err){cb(err);return;} try{ var rq=db.transaction(_DB_STORE,'readonly').objectStore(_DB_STORE).get(id); rq.onsuccess=function(){ cb(null,rq.result||null); }; rq.onerror=function(e){cb(e.target.error);}; }catch(e){cb(e);} }); }
 function _openSavedReport(rec){ dbGet(rec.id,function(e,full){ openReport((full&&full.DATA)||rec.DATA); }); }  // 저장카드 리포트=full 재조회 후 열기
 function dbDel(id,cb){ _idb(function(err,db){ if(err){cb&&cb(err);return;} try{ var tx=db.transaction(_DB_STORE,'readwrite'); tx.objectStore(_DB_STORE).delete(id); tx.oncomplete=function(){cb&&cb(null);}; }catch(e){cb&&cb(e);} }); }
 function savePlayerData(D,cb){ try{ var nm=(D.player&&D.player.name)||'선수'; var grp=(_UPLOAD_GROUP||'team'); var team=(D._team||'기타'); var _sys=(D.system||'Theia'); var rec={ id:(grp==='cohort'?('cohort::'+nm+'::'+_sys):('team::'+team+'::'+nm+'::'+_sys)), name:nm, team:team, group:grp, system:_sys, savedAt:Date.now(), n_trials:(D.trials||[]).length, velo:(D.velo_summary&&D.velo_summary.max_kmh!=null)?D.velo_summary.max_kmh:(D.measured_kmh||null), spin:(D.velo_summary&&D.velo_summary.avg_spin!=null)?D.velo_summary.avg_spin:null, mech:_mechComp(D), fit:(D.hp_assessment&&D.hp_assessment.overall_score!=null)?D.hp_assessment.overall_score:null, DATA:D }; dbSave(rec,function(e){ if(e)console.error('DB save',e); cb&&cb(e); }); }catch(e){ console.error(e); cb&&cb(e); } }
 function _sysTag(sys){ sys=sys||'Theia'; return /IMU/i.test(sys)?'IMU+GRF':(/uplift/i.test(sys)?'Uplift(동작)':'Theia+GRF'); }
 function buildSavedCard(rec){ var D=rec.DATA; var card=document.createElement('div'); card.className='pcard'; card._rec=rec;
   card.dataset.name=rec.name||''; card.dataset.team=rec.team||''; card.dataset.velo=(rec.velo!=null?rec.velo:''); card.dataset.mech=(rec.mech!=null?rec.mech:''); card.dataset.date=(rec.savedAt||'');
   var _sub = rec._stub ? (_sysTag(rec.system)+' · '+(rec.team||'')+' · 열면 상세 로드') : (_sysTag(rec.system||(D&&D.system))+' · '+rec.n_trials+'구 · '+new Date(rec.savedAt).toLocaleDateString('ko')+' 저장');
   var _stat = rec._stub ? '<div class="muted" style="font-size:12px;padding:3px 0">구속·메카닉은 「분석 리포트」를 열면 표시됩니다</div>' : _statRow(rec.velo,((typeof _mechComp==="function"&&D&&D.phases)?_mechComp(D):rec.mech),(D&&D.hp_assessment&&D.hp_assessment.overall_norm_pct!=null)?D.hp_assessment.overall_norm_pct:null,rec.spin,rec.comp,'%ile');
   card.innerHTML=_pcHeadHTML(rec.name, _sub, rec.savedAt||Date.now())+_stat   /* [2026-07-04 v5] _stub(키만 로드)이면 값 없이 이름·팀만 표시·상세는 열 때 dbGet */;
   _pcActions(card,[
     {txt:'▶ 분석 리포트', kind:'primary', fn:function(){ _openSavedReport(rec); }},
     {menu:true, txt:(rec.group==='cohort'?'일반으로 이동':'코호트로 이동'), fn:function(){ moveGroup(rec, rec.group==='cohort'?'team':'cohort'); }},
     {menu:true, danger:true, txt:'삭제', fn:function(){ if(confirm(rec.name+' 저장 데이터를 삭제할까요?')){ dbDel(rec.id,function(){ loadSavedPlayers(); }); } }}
   ]);
   return card;
 }
 // 저장된 선수의 그룹(코호트↔일반) 이동 — 재업로드/재분석 없이 IndexedDB 레코드만 재태깅
 function moveGroup(rec,to,cb,noReload){ dbGet(rec.id,function(_e,_full){ var src=_full||rec;  /* [2026-07-04 v5] 목록 레코드는 스텁(DATA=null) — 그대로 저장하면 full 소실 → 이동 전 반드시 full 재조회 */ var _sys=(src.system||(src.DATA&&src.DATA.system)||'Theia'); var nid=(to==='cohort'?('cohort::'+src.name+'::'+_sys):('team::'+(src.team||'기타')+'::'+src.name+'::'+_sys)); var nr={}; for(var k in src) nr[k]=src[k]; nr.group=to; nr.id=nid; nr._stub=false; dbSave(nr,function(){ function done(){ if(!noReload)loadSavedPlayers(); cb&&cb(); } if(nid!==rec.id) dbDel(rec.id,done); else done(); }); }); }
 function bulkMove(recs,to){ if(!recs||!recs.length)return; var i=0; (function nx(){ if(i>=recs.length){ loadSavedPlayers(); return; } moveGroup(recs[i],to,function(){ i++; nx(); },true); })(); }
 // 대시보드 상단 코치용 팀 리포트 — 팀(상동고 등) 선택 → 소속 선수 전체 통합 리포트(유일한 팀 리포트 진입점)
 function _renderTopTeamBar(recs){ var db=document.getElementById('dashbar'); if(!db) return;
   recs=(recs||[]).filter(function(r){return r&&(r.DATA||r.id);});  /* [2026-07-04 v5] 스텁(키만·DATA=null)도 팀바에 포함 — 팀 리포트/PDF는 열 때 dbGet로 선수별 full 재조회 */
   if(!recs.length){ db.innerHTML=''; return; }
   var groups={}; recs.forEach(function(r){ var g=(r.group==='cohort')?'코호트(검증용)':(r.team||'기타'); (groups[g]=groups[g]||[]).push(r); });
   var names=Object.keys(groups).sort(function(a,b){return String(a).localeCompare(String(b),'ko');});
   var opts=names.map(function(n){return '<option value="'+String(n).replace(/"/g,'&quot;')+'">'+n+' ('+groups[n].length+'명)</option>';}).join('');
   db.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:11px 13px;background:rgba(106,166,207,0.12);border:1px solid #3a5a8c;border-radius:10px">'
     +'<b style="font-size:14px"> 팀 리포트</b><span class="muted" style="font-size:12px">코치용 — 팀을 선택하면 소속 선수 전체를 통합한 현황 리포트가 나옵니다</span>'
     +'<select id="top-team-sel" style="padding:5px 9px;border-radius:6px;border:1px solid #384354;background:#1a1f29;color:#e8ecf2;font-size:13px">'+opts+'</select>'
     +'<button class="dbtn" id="top-team-report" style="flex:0 0 auto;background:#6aa6cf"> 팀 리포트 출력</button>'
     +'<button class="dbtn" id="top-team-pdf" style="flex:0 0 auto;background:#7048e8"> 팀 PDF 인쇄</button></div>';
   function pick(){ var s=db.querySelector('#top-team-sel'); return (s&&groups[s.value])||[]; }
   var b=db.querySelector('#top-team-report'); if(b) b.onclick=function(){ var g=pick(); if(!g.length){ alert('선택한 팀에 선수가 없습니다'); return; } savedTeamReport(g); };
   var p=db.querySelector('#top-team-pdf'); if(p) p.onclick=function(){ var g=pick(); if(g.length) openAllPlayerPDFFromRecs(g); };  /* [2026-07-04 OOM v3] 팀 PDF=선수별 full 스트리밍(피크 1건·N명 동시상주 제거) */
 }
 // [2026-07-04 OOM v2] 팀 리포트=series 필요. _SAVED_CACHE는 series를 벗겼으므로 클릭 시 선수별 full을 dbGet으로 1건씩 재조회→summarize(소형 요약) 후 즉시 해제(피크=1건). 팝업은 제스처 끊김 방지 위해 즉시 연다.
 function savedTeamReport(recs){ if(!window.teamReport){ alert('팀 리포트 모듈 미로드'); return; } var w=window.open('','_blank'); if(!w){ alert('팝업 차단됨 — 허용 후 다시'); return; } try{ w.document.open(); w.document.write('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;color:#333">팀 리포트 준비 중… 0/'+recs.length+'</body>'); }catch(_){}
   var SUMM=[], i=0;
   (function nx(){ if(i>=recs.length){ try{ var html=teamReport.buildTeamHTML(SUMM); w.document.open(); w.document.write(html); w.document.close(); }catch(e){ try{ w.document.body.innerHTML='팀 리포트 오류: '+e.message; }catch(_){}; console.error(e); } return; }
     dbGet(recs[i].id, function(e, full){ var D=(full&&full.DATA)||recs[i].DATA; try{ SUMM.push(teamReport.summarize(D)); }catch(_){} D=null; i++; try{ if(w.document.body) w.document.body.textContent='팀 리포트 준비 중… '+i+'/'+recs.length; }catch(_){}; nx(); }); })(); }
 // [2026-06-18] 선수 식별 정규화 — 중복 카드 제거용(공백·대소문자·NFD 차이 흡수)
 function _normName(s){ try{ return (s==null?'':String(s)).normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase(); }catch(e){ return (s==null?'':String(s)).trim().toLowerCase(); } }
 function _normSysKey(s){ s=(s||'').toLowerCase(); return /uplift/.test(s)?'uplift':(/imu/.test(s)?'imu':'theia'); }
 function _playerKey(name,sys){ return _normName(name)+'|'+_normSysKey(sys); }
 function _recName(r){ return (r&&(r.name||r.player_name||(r.DATA&&r.DATA.player&&r.DATA.player.name)))||''; }
 function loadSavedPlayers(){ var box=document.getElementById('saved-box'), cbox=document.getElementById('cohort-box'); if(box)box.innerHTML='<div class="muted" style="padding:6px">저장 선수 불러오는 중…</div>'; dbAllSlim(function(err,recs){ if(err){ if(box)box.innerHTML='<div class="muted" style="padding:6px">저장 DB 오류: '+(err.message||err)+'</div>'; return; } recs=(recs||[]).filter(__isMyTrackRecord); /* [2026-07-02] 트랙 격리: 로컬 IDB 로드에도 클라우드(cloudLoadList)와 동일 행필터 적용 — 공유 DB의 타트랙 레코드 표시/집계 혼입 차단 */ recs.sort(function(a,b){return b.savedAt-a.savedAt;});
   (function(){ var seen={}; recs=(recs||[]).filter(function(r){ var k=_playerKey(_recName(r), r.system||(r.DATA&&r.DATA.system)); if(seen[k])return false; seen[k]=1; return true; }); })();  // [2026-06-18] 로컬 중복 제거(이름+시스템·최신 1개만)
   _SAVED_CACHE=recs||[];
   try{ if(_LIVE_NORMS_AUTO && !(window._LIVE_NORM_META&&window._LIVE_NORM_META.src==='cloud'&&window._LIVE_NORM_META.applied)) _liveNormsFromLocal(function(){}); }catch(e){}  // [2026-06-18] 로컬 코호트 라이브 규준 · [핫픽스] _LIVE_NORMS_AUTO 게이트(기본 OFF·수동전용)
   var cohort=recs.filter(function(r){return r.group==='cohort';}), team=recs.filter(function(r){return r.group!=='cohort';});
   try{ _renderTopTeamBar(recs); }catch(e){}
   // ── 코호트(검증용) 섹션 ──
   if(cbox){ if(!cohort.length){ cbox.innerHTML=''; } else {
     var ct='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 8px"><h3 style="margin:0;color:#7fb0ee"> 코호트 (검증용, '+cohort.length+'명)</h3><span class="muted" style="font-size:12px">우수 투수 규준 · 상동고와 분리 저장</span><button class="dbtn" id="cohort-toteam" style="flex:0 0 auto;background:#5a6678"> 전체 일반으로</button></div>';
     cbox.innerHTML=ct+'<div id="cohort-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px"></div>';
     var cl=cbox.querySelector('#cohort-list'); cohort.forEach(function(rec){ cl.appendChild(buildSavedCard(rec)); });
     var ctt=cbox.querySelector('#cohort-toteam'); if(ctt) ctt.onclick=function(){ if(confirm('코호트 '+cohort.length+'명 전체를 일반(상동고 등)으로 옮길까요?')) bulkMove(cohort,'team'); };
   } }
   // ── 저장된 선수(상동고 등) 섹션 ──
   if(!box) return;
   if(!team.length){ box.innerHTML='<h3 style="margin:18px 0 6px"> 저장된 선수 (DB)</h3><div class="pc-empty"><div class="pe-ic">＋</div><div class="pe-title">아직 저장된 선수가 없습니다</div><div class="pe-desc">위에서 데이터를 업로드·분석하면 이 브라우저에 자동 저장되어, 다음부터는 업로드 없이 바로 리포트를 열 수 있습니다.</div><button class="dbtn" style="background:#5bb6e6;max-width:180px;margin:0 auto" onclick="var f=document.getElementById(\'file\');if(f)f.click();">파일 업로드하기</button></div>'; return; }
   var top='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 8px"><h3 style="margin:0"> 저장된 선수 ('+team.length+'명)</h3><span class="muted" style="font-size:12px">브라우저 DB · 업로드 없이 바로 리포트 · 팀 리포트는 상단에서</span><button class="dbtn" id="saved-tocohort" style="flex:0 0 auto;background:#3a5a8c"> 전체를 코호트로</button></div>';
   var tg={}; team.forEach(function(rec){ var g=rec.team||'미분류'; (tg[g]=tg[g]||[]).push(rec); }); var torder=Object.keys(tg).sort(function(a,b){return a.localeCompare(b);});
   var inner=''; torder.forEach(function(g){ inner+='<div class="team-ghead"><span class="tgh-name">'+g+' <span class="tgh-c">'+tg[g].length+'명</span></span></div><div class="saved-grp" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px"></div>'; });
   box.innerHTML=top+inner;
   var sgs=box.querySelectorAll('.saved-grp'); torder.forEach(function(g,gi){ var cc=sgs[gi]; tg[g].forEach(function(rec){ cc.appendChild(buildSavedCard(rec)); }); });
   var stc=box.querySelector('#saved-tocohort'); if(stc) stc.onclick=function(){ if(confirm('저장된 선수 '+team.length+'명 전체를 코호트(검증용)로 옮길까요?\\n(상동고 선수가 섞여 있으면 개별 카드의 「 코호트로」 버튼을 쓰세요)')) bulkMove(team,'cohort'); };
   try{ _attachFilterBar(box,'saved-grp',torder); }catch(e){}
   try{ _attachBulkBar(box,'saved'); }catch(e){}
 }); }

 /* ── 클라우드 동기화 (Supabase: 이메일 로그인 + Storage + 메타 테이블) ── */
 var SB=null, _SBUSER=null, _SB_BUCKET=(__APP.bucket||'pitching-data'), _SB_TABLE=(__APP.table||'pitching_reports');  // 앱별 버킷/테이블(APP_CONFIG) → 클라우드 물리 분리(같은 프로젝트라도 격리)
 function _sbCfg(){ return { url:(localStorage.getItem('sb_url')||'').trim(), key:(localStorage.getItem('sb_key')||'').trim() }; }
 function _loadSupabase(cb){ if(window.supabase&&window.supabase.createClient){ cb(); return; } var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; s.onload=function(){ cb(); }; s.onerror=function(){ cb('Supabase 라이브러리 로드 실패 — 인터넷 연결을 확인하세요'); }; document.head.appendChild(s); }
 function _sbInit(cb){ var c=_sbCfg(); if(!c.url||!c.key){ cb('Project URL·anon key 를 먼저 설정하세요'); return; } _loadSupabase(function(err){ if(err){ cb(err); return; } try{ if(!SB) SB=window.supabase.createClient(c.url,c.key); cb(null); }catch(e){ cb(e.message); } }); }
 function _sbErr(t){ var s=document.getElementById('cloud-msg'); if(s){ s.innerHTML='<span style="color:#cf6f6c">'+t+'</span>'; } }
 function _sbOk(t){ var s=document.getElementById('cloud-msg'); if(s){ s.style.color='#7d8898'; s.textContent=t; } }
 function cloudLogin(email,pw){ _sbInit(function(err){ if(err){ _sbErr(err); return; } _sbOk('로그인 중…'); SB.auth.signInWithPassword({email:email,password:pw}).then(function(r){ if(r.error){ _sbErr('로그인 실패: '+r.error.message+' (가입이 필요하면 가입 버튼)'); } else { _SBUSER=r.data.user; renderCloudPanel(); } }); }); }
 function cloudSignup(email,pw){ _sbInit(function(err){ if(err){ _sbErr(err); return; } _sbOk('가입 중…'); SB.auth.signUp({email:email,password:pw}).then(function(r){ if(r.error){ _sbErr('가입 실패: '+r.error.message); } else { _sbOk('가입 요청됨 — 이메일 인증 후 로그인하세요(설정에 따라 즉시 로그인될 수도 있음).'); if(r.data.user&&r.data.session){ _SBUSER=r.data.user; renderCloudPanel(); } } }); }); }
 function cloudLogout(){ if(SB) SB.auth.signOut().then(function(){ _SBUSER=null; renderCloudPanel(); }); }
 // 로컬 IndexedDB(저장된 선수)를 클라우드로 일괄 복원/업로드 — 원본 재업로드 없이 복구용
 function cloudSaveLocal(){ if(!SB||!_SBUSER){ _sbErr('로그인 필요'); return; }
   var recs=(_SAVED_CACHE||[]).filter(function(r){return r&&r.DATA;});
   if(!recs.length){ _sbErr('이 브라우저 로컬 DB에 저장된 선수가 없습니다 — 평소 분석하던 브라우저에서 실행하세요'); return; }
   if(!confirm('이 브라우저 로컬 DB의 '+recs.length+'명을 클라우드로 업로드/복원할까요? (같은 이름은 덮어씀)')) return;
   _sbOk('로컬 → 클라우드 저장 중… 0/'+recs.length); var i=0;
   (function next(){ if(i>=recs.length){ _sbOk(recs.length+'명 클라우드 복원 완료 '); cloudLoadList(); return; }
     var rec=recs[i]; dbGet(rec.id,function(_ge,_gf){ var D=(_gf&&_gf.DATA)||rec.DATA; var nm=(D.player&&D.player.name)||rec.name||'선수'; var grp=(rec.team||D._team||'기타');  /* [2026-07-04 OOM] 슬림캐시 → 업로드는 full 재조회(프레임 포함) */
     var path=_SBUSER.id+'/'+((nm||'player').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'player')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+'.json';
     var blob=new Blob([JSON.stringify(D)],{type:'application/json'});
     function _ins(){ SB.storage.from(_SB_BUCKET).upload(path,blob,{upsert:true}).then(function(up){ if(up.error){ _sbErr(nm+' 업로드 오류: '+up.error.message); return; }
       SB.from(_SB_TABLE).insert({ player_name:nm, grp:grp, n_trials:(D.trials||[]).length, velo:(D.velo_summary&&D.velo_summary.max_kmh!=null)?D.velo_summary.max_kmh:(D.measured_kmh||null), spin:(D.velo_summary&&D.velo_summary.avg_spin!=null)?D.velo_summary.avg_spin:null, mech:_mechComp(D), fit:(D.hp_assessment&&D.hp_assessment.overall_score!=null)?D.hp_assessment.overall_score:null, hand:(D.player&&D.player.handedness)||null, system:(D.system||'Theia'), storage_path:path }).then(function(r){ if(r.error){ _sbErr(nm+' 메타 저장 오류: '+r.error.message); return; } i++; _sbOk('로컬 → 클라우드 저장 중… '+i+'/'+recs.length); next(); }); }); }
     SB.from(_SB_TABLE).select('id,storage_path').eq('player_name',nm).eq('grp',grp).eq('system',(D.system||'Theia')).then(function(ex){ var old=(ex&&ex.data)||[]; if(!old.length){ _ins(); return; } var ids=old.map(function(o){return o.id;}); var paths=old.map(function(o){return o.storage_path;}).filter(Boolean); SB.from(_SB_TABLE).delete().in('id',ids).then(function(){ if(paths.length){ SB.storage.from(_SB_BUCKET).remove(paths).then(_ins,_ins); } else { _ins(); } },function(){ _ins(); }); },function(){ _ins(); });
     });  /* dbGet(full) 콜백 닫기 */
   })(); }
 function cloudSaveAll(){ if(!SB||!_SBUSER){ _sbErr('로그인 필요'); return; } var ps=PLAYERS.filter(function(p){return p._data;}); if(!ps.length){ _sbErr('업로드·분석된 선수가 없습니다'); return; } _sbOk('클라우드 저장 중… 0/'+ps.length); var i=0; (function next(){ if(i>=ps.length){ _sbOk(ps.length+'명 클라우드 저장 완료 '); cloudLoadList(); return; } var D=ps[i]._data; var nm=(D.player&&D.player.name)||ps[i].name; var grp=(D._team||'기타'); var path=_SBUSER.id+'/'+((nm||'player').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'player')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+'.json'; var blob=new Blob([JSON.stringify(D)],{type:'application/json'});
   function _ins(){ SB.storage.from(_SB_BUCKET).upload(path,blob,{upsert:true}).then(function(up){ if(up.error){ _sbErr(nm+' 업로드 오류: '+up.error.message); return; }
     SB.from(_SB_TABLE).insert({ player_name:nm, grp:grp, n_trials:(D.trials||[]).length, velo:(D.velo_summary&&D.velo_summary.max_kmh!=null)?D.velo_summary.max_kmh:(D.measured_kmh||null), spin:(D.velo_summary&&D.velo_summary.avg_spin!=null)?D.velo_summary.avg_spin:null, mech:_mechComp(D), fit:(D.hp_assessment&&D.hp_assessment.overall_score!=null)?D.hp_assessment.overall_score:null, hand:(D.player&&D.player.handedness)||null, system:(D.system||'Theia'), storage_path:path }).then(function(r){ if(r.error){ _sbErr(nm+' 메타 저장 오류: '+r.error.message); return; } i++; _sbOk('클라우드 저장 중… '+i+'/'+ps.length); next(); }); }); }
   // [2026-06-01] 같은 선수(이름+시스템) 기존 기록은 팀 이름이 달라도 덮어쓰기 — 중복 누적 차단
   SB.from(_SB_TABLE).select('id,storage_path').eq('player_name',nm).eq('system',(D.system||'Theia')).then(function(ex){ var old=(ex&&ex.data)||[]; if(!old.length){ _ins(); return; } var ids=old.map(function(o){return o.id;}); var paths=old.map(function(o){return o.storage_path;}).filter(Boolean); SB.from(_SB_TABLE).delete().in('id',ids).then(function(){ if(paths.length){ SB.storage.from(_SB_BUCKET).remove(paths).then(_ins,_ins); } else { _ins(); } },function(){ _ins(); }); },function(){ _ins(); }); })(); }
 function cloudLoadList(){ var box=document.getElementById('cloud-list'); if(!box) return; if(!SB||!_SBUSER){ box.innerHTML=''; return; } box.innerHTML='<div class="muted">불러오는 중…</div>'; SB.from(_SB_TABLE).select('*').order('saved_at',{ascending:false}).then(function(r){ if(r.error){ box.innerHTML='<div class="muted" style="color:#cf6f6c">목록 오류: '+r.error.message+'</div>'; return; } var recs=(r.data||[]).filter(__isMyTrackRecord).filter(function(rc){return rc&&rc.player_name!==_NORM_MARK;}); (function(){ var _sn={}; recs=recs.filter(function(rc){ var k=_playerKey(rc.player_name,rc.system); if(_sn[k]) return false; _sn[k]=1; return true; }); })(); /* [2026-06-18] 이름+시스템 정규화 중복제거(최신 1개) */ var _cloudAll=recs.length; (function(){ var _lk={}; (_SAVED_CACHE||[]).forEach(function(r){ if(r) _lk[_playerKey(_recName(r), r.system||(r.DATA&&r.DATA.system))]=1; }); recs=recs.filter(function(rc){ return !_lk[_playerKey(rc.player_name,rc.system)]; }); })(); /* [2026-06-18] 이 브라우저에 이미 있는 선수 제외 → 클라우드=추가 가능한 선수만(중복 표시 제거) */ var _hidLocal=_cloudAll-recs.length; _CLOUD_RECS=recs; if(!recs.length){ box.innerHTML='<div class="pc-empty"><div class="pe-ic"></div><div class="pe-title">'+(_cloudAll?'클라우드의 선수가 모두 이 브라우저에 있습니다':'클라우드에 저장된 선수가 없습니다')+'</div><div class="pe-desc">'+(_cloudAll?('공유된 '+_cloudAll+'명이 모두 아래 「저장된 선수」에 표시됩니다.'):'분석 후 「분석결과 클라우드 저장」을 누르면 여러 기기·연구원이 공유할 수 있습니다.')+'</div></div>'; return; } var groups={}; recs.forEach(function(rec){ var _sysT=(rec.system&&/IMU/i.test(rec.system))?'[IMU(MR3)+GRF] ':((rec.system&&/uplift/i.test(rec.system))?'[Uplift(동작 전용)] ':'[마커리스(Theia+GRF)] '); var g=_sysT+(rec.grp||'미분류'); (groups[g]=groups[g]||[]).push(rec); }); var order=Object.keys(groups).sort(function(a,b){ if(a==='코호트')return 1; if(b==='코호트')return -1; return a.localeCompare(b); }); var html='<div style="margin:6px 0;font-weight:700;cursor:pointer;user-select:none" onclick="cloudToggle()"><span id="cloud-tg">▼ 접기</span> 클라우드에서 가져오기 ('+recs.length+'명 · '+order.length+'팀)'+(_hidLocal?' <span class="muted" style="font-weight:400;font-size:11px">· 이 브라우저에 이미 있는 '+_hidLocal+'명 제외':'')+' <span class="muted" style="font-weight:400;font-size:11px">— 클릭하여 펼치기/접기</span></div><div id="cloud-groups-wrap" style="display:block">'; order.forEach(function(g){ html+='<div onclick="_clTgl(this)" style="cursor:pointer;margin:11px 0 3px;font-weight:700;color:#7fb0ee;user-select:none;border-bottom:1px solid #1f2c45;padding-bottom:3px"><span>▾ </span>'+g+' <span class="muted" style="font-weight:400;font-size:12px">('+groups[g].length+'명)</span></div><div class="cloud-grp" style="display:block"></div>'; }); html+='</div>'; box.innerHTML=html; var grps=box.querySelectorAll('.cloud-grp'); order.forEach(function(g,gi){ var cc=grps[gi]; groups[g].forEach(function(rec){ cc.appendChild(buildCloudCard(rec)); }); }); try{ _attachFilterBar(box,'cloud-grp',order); }catch(e){} /* [2026-07-04 OOM 최종] _loadCloudCompare(recs) 호출 은퇴 — _CLOUD_COMPARE 소비처 0(죽은 기능 잔재)인데
   클라우드 전 선수(107명+) full DATA를 매 목록 로드마다 다운로드·누적(_slimCompare가 frames 유지)해
   수백 MB 상주→"잠깐 떴다가 잠시 후" 탭 OOM의 마지막 원인이었음. 실제 선수 비교=세션 핸드오프(_p2StoreFrames) 경로.
   부수: 카드 점수는 저장 시점 값 표시(리포트는 열 때 재계산) · 목록 로드 즉시 완료·데이터 사용량 대폭 감소. */ }); }
 function buildCloudCard(rec){ var card=document.createElement('div'); card.className='pcard pc-cloud-row'; rec._cardEl=card;
   var _ts=rec.saved_at?new Date(rec.saved_at).getTime():null;
   card.dataset.name=rec.player_name||''; card.dataset.team=rec.grp||''; card.dataset.velo=(rec.velo!=null?rec.velo:''); card.dataset.mech=(rec.mech!=null?rec.mech:''); card.dataset.date=(_ts||'');
   card.innerHTML='<b style="flex:0 0 84px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px">'+(rec.player_name||'-')+'</b><span style="flex:0 0 70px;color:#23c4ac;font-weight:700;font-size:13px">'+(rec.velo!=null?rec.velo:'—')+'<span style="font-size:9px;color:#5f6b8a;font-weight:400"> km/h</span></span><span style="flex:0 0 74px;font-size:13px"><span style="font-size:9px;color:#5f6b8a">메카닉 </span>'+(rec.mech!=null?rec.mech:'—')+'</span><span class="muted" style="flex:1;min-width:0;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_sysTag(rec.system)+' · '+(rec.n_trials||'?')+'구 · '+(rec.saved_at?new Date(rec.saved_at).toLocaleDateString('ko'):'')+'</span>';
   function withDATA(b,fn){ b.disabled=true; SB.storage.from(_SB_BUCKET).download(rec.storage_path).then(function(r){ if(r.error){ _sbErr('다운로드 오류: '+r.error.message); b.disabled=false; return; } r.data.text().then(function(t){ try{ fn(JSON.parse(t)); }catch(e){ _sbErr('파싱 오류: '+e.message); } b.disabled=false; }); }); }
   _pcActions(card,[
     {txt:'▶ 분석 리포트', kind:'primary', fn:function(){ withDATA(this,function(D){ openReport(D); }); }},
     {menu:true, txt:'이 브라우저에 저장(팀 리포트·비교용)', fn:function(){ withDATA(this,function(D){ try{ D._team=rec.grp||D._team||'기타'; savePlayerData(D,function(e){ if(e){ alert('로컬 저장 오류: '+e.message); return; } try{ loadSavedPlayers(); }catch(_){} _sbOk(rec.player_name+' 이 브라우저에 저장됨 — 팀 리포트·비교에서 사용 가능'); }); }catch(e){ alert('저장 오류: '+e.message); } }); }},
     {menu:true, danger:true, txt:'삭제', fn:function(){ if(!confirm(rec.player_name+' 클라우드 데이터를 삭제할까요?'))return; SB.from(_SB_TABLE).delete().eq('id',rec.id).then(function(){ SB.storage.from(_SB_BUCKET).remove([rec.storage_path]).then(function(){ cloudLoadList(); }); }); }}
   ]);
   return card; }
 function renderCloudPanel(){ var box=document.getElementById('cloud-box'); if(!box) return; var c=_sbCfg();
   var head='<h3 style="margin:18px 0 8px"> 클라우드 (Supabase) <span class="muted" style="font-size:12px;font-weight:400">여러 기기·연구원 공유 저장</span></h3><div id="cloud-msg" class="muted" style="margin-bottom:8px">—</div>';
   if(!c.url||!c.key){ box.innerHTML=head+'<div class="muted" style="margin-bottom:6px">Supabase Project URL 과 anon(public) key 를 입력하세요 (Settings → API).</div>'+
     '<div style="display:flex;flex-direction:column;gap:6px;max-width:560px"><input id="cb-url" placeholder="https://xxxx.supabase.co" style="padding:7px 9px;border-radius:6px;border:1px solid #384354;background:#1a1f29;color:#e8ecf2"/><input id="cb-key" placeholder="anon public key (eyJ...)" style="padding:7px 9px;border-radius:6px;border:1px solid #384354;background:#1a1f29;color:#e8ecf2"/><button class="dbtn" style="background:#6aa6cf;max-width:160px" onclick="(function(){localStorage.setItem(\'sb_url\',document.getElementById(\'cb-url\').value);localStorage.setItem(\'sb_key\',document.getElementById(\'cb-key\').value);SB=null;renderCloudPanel();})()">설정 저장</button></div>'; return; }
   if(!_SBUSER){ box.innerHTML=head+'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;max-width:620px"><input id="cb-email" type="email" placeholder="이메일" style="padding:7px 9px;border-radius:6px;border:1px solid #384354;background:#1a1f29;color:#e8ecf2"/><input id="cb-pw" type="password" placeholder="비밀번호" style="padding:7px 9px;border-radius:6px;border:1px solid #384354;background:#1a1f29;color:#e8ecf2"/><button class="dbtn" style="background:#6aa6cf;flex:0 0 auto" onclick="cloudLogin(document.getElementById(\'cb-email\').value,document.getElementById(\'cb-pw\').value)">로그인</button><button class="dbtn" style="background:#4b5563;flex:0 0 auto" onclick="cloudSignup(document.getElementById(\'cb-email\').value,document.getElementById(\'cb-pw\').value)">가입</button><span class="muted" style="font-size:11px;flex-basis:100%">이메일·비밀번호로 데이터베이스에 접속합니다(가입 후 이메일 인증).</span></div>'; return; }
   box.innerHTML=head+'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><span class="muted">로그인: <b style="color:#e8ecf2">'+(_SBUSER.email||'')+'</b></span><button class="dbtn" style="background:#3b6e54;flex:0 0 auto" onclick="cloudSaveAll()">분석결과 클라우드 저장</button>'+_normRecalcBtnHTML()+'<button class="dbtn" style="background:#6aa6cf;flex:0 0 auto" onclick="cloudLoadList()">↻ 새로고침</button><button class="dbtn" style="background:#8a3b3b;flex:0 0 auto" onclick="cloudLogout()">로그아웃</button></div><details style="margin-bottom:8px"><summary style="cursor:pointer;color:#7a8aa0;font-size:12px;user-select:none">고급 (백업·복원)</summary><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="dbtn" style="background:#7048e8;flex:0 0 auto" onclick="cloudSaveLocal()">로컬 DB→클라우드 복원</button><button class="dbtn" style="background:#3a5a8c;flex:0 0 auto" onclick="cloudSaveAllLocal()">클라우드 전체를 이 브라우저에 저장</button></div></details><div id="elite-norm-msg" class="muted" style="margin-bottom:8px;font-size:12px;padding:6px 9px;background:#1a2230;border-radius:6px;border:1px solid #2a3444">규준: 검증된 기본 엘리트(n=20) 적용 중 — 규준 발행은 관리자(검증 후)만 수행합니다. 코호트는 등록·저장만 하면 됩니다.</div><div id="cloud-list"></div>';
   cloudLoadList(); try{ if(_LIVE_NORMS_AUTO) _liveNormsFromCloud(function(n){ if(!n){ try{ _liveNormsFromLocal(function(){}); }catch(e){} } }); }catch(e){} }  // [핫픽스] 클라우드 규준 자동적용 게이트(기본 OFF·수동전용)
 function cloudBoot(){ var c=_sbCfg(); if(!c.url||!c.key){ renderCloudPanel(); return; } _sbInit(function(err){ if(err){ renderCloudPanel(); return; } SB.auth.getUser().then(function(r){ _SBUSER=(r.data&&r.data.user)?r.data.user:null; renderCloudPanel(); }); }); }
 if(typeof window!=='undefined'){ window.cloudLogin=cloudLogin; window.cloudSignup=cloudSignup; window.cloudLogout=cloudLogout; window.cloudSaveAll=cloudSaveAll; window.cloudSaveLocal=cloudSaveLocal; window.cloudLoadList=cloudLoadList; window.renderCloudPanel=renderCloudPanel; window._clTgl=function(h){ try{ var g=h.nextElementSibling; if(!g)return; var o=(g.style.display!=='none'); g.style.display=o?'none':'block'; var s=h.firstChild; if(s)s.textContent=o?'▸ ':'▾ '; }catch(e){} }; try{ if(typeof document!=='undefined'&&!document.getElementById('cl-compact-css')){ var _clst=document.createElement('style'); _clst.id='cl-compact-css'; _clst.textContent='#cloud-list .cloud-grp{display:block}#cloud-list .pc-cloud-row{display:flex!important;flex-direction:row!important;align-items:center;gap:9px;padding:5px 10px!important;margin:2px 0!important;border:1px solid #1b2740;border-radius:7px;background:#0e1730;min-height:0!important}#cloud-list .pc-cloud-row .pc-actions,#cloud-list .pc-cloud-row .pc-menu-wrap{flex:0 0 auto;margin-left:4px}#cloud-list .pc-cloud-row button,#cloud-list .pc-cloud-row .dbtn{padding:3px 9px!important;font-size:12px!important;white-space:nowrap;margin:0 0 0 2px}'; document.head.appendChild(_clst); } }catch(e){} window.cloudToggle=function(){ var w=document.getElementById('cloud-groups-wrap'); if(!w) return; var s=(w.style.display==='none'); w.style.display=s?'':'none'; var t=document.getElementById('cloud-tg'); if(t) t.textContent=s?'▼ 접기':'▶ 펼치기'; }; }
 var PLAYERS=[];
 var _SAVED_CACHE=[];
 var _CLOUD_COMPARE=[];  // 클라우드 선수들의 슬림 비교 데이터(배포 사이트에서 선수 비교용)
 var _CLOUD_RECS=[];     // 클라우드 목록 원본(전체 로컬 저장용)
 // 클라우드 선수 전체를 이 브라우저(로컬 DB)에 저장 — 팀 리포트·비교는 로컬 DB 사용
 function cloudSaveAllLocal(){ if(!SB||!_SBUSER){ _sbErr('로그인 필요'); return; } var recs=(_CLOUD_RECS||[]).filter(function(r){return r&&r.storage_path;}); if(!recs.length){ _sbErr('클라우드 목록을 먼저 불러오세요(↻)'); return; } if(!confirm('클라우드 '+recs.length+'명을 이 브라우저에 저장할까요? 팀 리포트·선수 비교에 쓰입니다.')) return; _sbOk('이 브라우저에 저장 중… 0/'+recs.length); var i=0; (function nx(){ if(i>=recs.length){ _sbOk(recs.length+'명 저장 완료 — 상단 팀 리포트·선수 비교에서 사용 가능'); try{ loadSavedPlayers(); }catch(e){} return; } var rec=recs[i]; SB.storage.from(_SB_BUCKET).download(rec.storage_path).then(function(r){ if(!r.error&&r.data){ r.data.text().then(function(t){ try{ var D=JSON.parse(t); D._team=rec.grp||'기타'; savePlayerData(D); }catch(e){console.error('local save',rec.player_name,e);} i++; _sbOk('이 브라우저에 저장 중… '+i+'/'+recs.length); nx(); }); } else { i++; nx(); } },function(){ i++; nx(); }); })(); }
 if(typeof window!=='undefined') window.cloudSaveAllLocal=cloudSaveAllLocal;
 // 카드 메카닉·체력 점수를 다운로드한 DATA로 현재 공식 재계산해 갱신(저장 시점 옛 점수 → 최신) — (B)
 function _refreshCardScores(rec, D){ try{ if(!rec||!rec._cardEl||!D)return;
   var pl=D.player||{}; var m={name:pl.name,name_en:pl.name_en,height_m:pl.height_m||1.8,weight_kg:pl.weight_kg||86,handedness:pl.handedness||'R',bmi:pl.bmi||0,max_velocity_kmh:(pl.max_velocity_kmh!=null?pl.max_velocity_kmh:D.measured_kmh),ball_speed_max:pl.ball_speed_max,ball_speed_avg:pl.ball_speed_avg,delivery:(pl.delivery_code||pl.delivery||null)}; // [2026-06-01 FIX] 실측 구속 전달(ball_speed_*/measured_kmh)
   if(window.phases && D.trials && D.trials.length){ var bi=(D.best_trial_index||1)-1; if(bi<0||bi>=D.trials.length)bi=0; try{ D.phases=window.phases.compute(D.trials[bi], m, D.energy_transfer, D.trials, D.command); }catch(e){} }
   var mech=(typeof _mechComp==='function')?_mechComp(D):rec.mech;
   var fit=(D.hp_assessment&&D.hp_assessment.overall_norm_pct!=null)?D.hp_assessment.overall_norm_pct:null;   /* [2026-06-20] 카드 체력=Driveline 퍼센타일(저장 rec.fit 점수는 불변) */
   var comp=(typeof _compIdx==='function')?_compIdx(D):rec.comp;
   var sr=rec._cardEl.querySelector('.pc-stats'); if(sr){ var tmp=document.createElement('div'); tmp.innerHTML=_statRow(rec.velo,mech,fit,rec.spin,comp,'%ile'); var nw=tmp.firstChild; if(nw)sr.parentNode.replaceChild(nw,sr); }
   rec.mech=mech; rec.fit=fit; rec.comp=comp;
 }catch(e){} }
 function _loadCloudCompare(recs){ if(!SB||!recs||!recs.length){ _CLOUD_COMPARE=[]; return; } var acc=[], i=0, tot=recs.length;
   // [2026-07-04 OOM 근본수정] 기존 forEach = 전 선수 full DATA(트라이얼 프레임=선수당 수 MB)를 '동시' 다운로드·JSON.parse·phases.compute
   //   → 코호트 클수록 수십 개가 메모리에 동시 상주(수 GB) → 탭 OOM 크래시("Aw Snap 5"). 다른 클라우드 경로는 이미 직렬인데 여기만 동시였음.
   //   해결: 직렬 큐(한 번에 1명만) + 슬림 추출 후 즉시 해제 → 피크 메모리 = O(1 선수)로 상한(코호트 규모 무관).
   function fin2(){ _CLOUD_COMPARE=acc; var s2=document.getElementById('cloud-msg'); if(s2&&(s2.textContent||'').indexOf('오류')<0)_sbOk('비교용 데이터 '+acc.length+'명 준비 완료 — 리포트의 「선수 비교」 사용 가능'); }
   function next(){ if(i>=tot){ fin2(); return; } var rec=recs[i++]; if(!rec||!rec.storage_path){ next(); return; }
     SB.storage.from(_SB_BUCKET).download(rec.storage_path).then(function(r){ if(r&&!r.error&&r.data){ r.data.text().then(function(t){ try{ var D=JSON.parse(t); try{ _refreshCardScores(rec,D); }catch(e){} var s=_slimCompare(D); if(s)acc.push(s); D=null; t=null; /* 슬림만 보관·full DATA 해제(GC) */ }catch(e){} next(); }); } else { next(); } },function(){ next(); }); }
   next(); }
 var _UPLOAD_GROUP='team';  // 'team'=상동고 등 일반 | 'cohort'=검증용 코호트(분리 저장)
 var _UPLOAD_TEAM='기타';   // 클라우드 그룹(팀/학교) 이름 — 업로드 zip 최상위 폴더에서 유도(코호트는 '코호트')
 function assembleUpliftPlayer(p){ var META=p.metaObj||(function(){try{return p.metaText?JSON.parse(p.metaText):{};}catch(e){return {};}})(); var HAND=META.handedness||null; var WT=META.weight_kg||86, HT=META.height_m||1.8; var ut=p.texts.map(function(t){ try{ return extractUplift.extractTrial(t.text,{weight_kg:WT,height_m:HT,handedness:HAND,name:META.name,delivery:(META.delivery_code||null)},t.file); }catch(e){ console.warn("uplift trial skip: "+t.file+" — "+e.message); return null; } }).filter(Boolean); if(!ut.length) throw new Error("유효한 Uplift trial 없음"); var nm=META.name||(ut[0].meta&&ut[0].meta.athlete)||p.name; if(nm){ var _mm=String(nm).match(/^S\d+\s+(.+)$/); if(_mm)nm=_mm[1].trim(); } var hand=(ut[0].throw_side==="left")?"L":"R"; var pitches=p.rapText?extractRapsodo.parse(p.rapText):null; var m={name:nm,name_en:META.name_en||"",height_m:HT,weight_kg:WT,bmi:META.bmi||0,handedness:hand,max_velocity_kmh:META.max_velocity_kmh,system:"Uplift"}; var DATA=reportData.assembleUplift(ut,pitches,m,window.__FITNESS_BY||window.__FITNESS_MANUAL||null); try{ var bt=DATA.trials[(DATA.best_trial_index||1)-1]; DATA.phases=(window.phases)?window.phases.compute(bt,m,null,DATA.trials,DATA.command):null; }catch(e){ console.error("uplift phases",e); } return DATA; }
 function assembleImuPlayer(p){ var META=p.metaObj||(function(){try{return p.metaText?JSON.parse(p.metaText):{};}catch(e){return {};}})(); var WT=META.weight_kg||86, HAND=META.handedness||'R', TILT=4.4; /* [FIX 0525] 앞발(2번) 플레이트 4.4° 내리막 고정 */ var trials=p.texts.map(function(t){ try{ return {file:t.file, trial:extractImu.extractTrial(t.text,{weight_kg:WT,handedness:HAND,name:META.name,plate_tilt_deg:TILT,height_m:META.height_m},t.file)}; }catch(e){ console.warn('IMU trial skip: '+t.file+' — '+e.message); return null; } }).filter(Boolean); if(!trials.length) throw new Error('유효한 IMU(MR3) trial 없음'); /* [FIX 2026-05-25] info.csv에 체중 없으면 포스플레이트 정적 실측 체중을 player 메타로 전파(헤더·BMI·phases %BW 정규화에 사용). */ var _pbw=null; for(var _ti=0;_ti<trials.length;_ti++){ var _g=trials[_ti].trial&&trials[_ti].trial.grf; if(_g&&_g.body_weight_N>300){_pbw=_g.body_weight_N;break;} } if(_pbw&&!META.weight_kg){ WT=Math.round(_pbw/9.80665*10)/10; } var pitches=p.rapText?extractRapsodo.parse(p.rapText):null; var m={name:META.name||p.name,name_en:(META.name_en||''),height_m:META.height_m||1.83,weight_kg:WT,bmi:META.bmi||0,handedness:HAND,max_velocity_kmh:META.max_velocity_kmh,ball_speed_max:META.ball_speed_max,ball_speed_avg:META.ball_speed_avg}; var DATA=reportData.assemble(trials,pitches,m,window.__FITNESS_BY||null); DATA.system='IMU(MR3)'; try{ DATA.phases=(window.phases)?window.phases.compute(DATA.trials[(DATA.best_trial_index||1)-1], m, DATA.energy_transfer, DATA.trials, DATA.command):null; var _bt=DATA.trials[(DATA.best_trial_index||1)-1]; try{ _theiaSequencing(DATA,_bt); }catch(_e){ console.warn('theia seq',_e); } try{ _theiaRepeatability(DATA,DATA.trials); }catch(_e){ console.warn('theia repeat',_e); } try{ _theiaAttractors(DATA); }catch(_e){ console.warn('theia attractors',_e); } }catch(e){ console.error('imu phases',e); } return DATA; }
 // ── [2026-06-19] Theia 네이티브 어트랙터 (GRF·완전 키네마틱 활용) ──
 //   Uplift 어트랙터 구조 차용 + Theia 전용 보정: ①GRF 실측 지표(앞발 제동 임펄스 apBrakeImpulse·전달비 armTransferRatio) 축 편입
 //   ②'측정 불가(지면반력 필요)' 박제 제거 — Theia는 포스플레이트로 실측 ③seqOrder/rotVelCV는 Theia kseq(extract_theia)로 동일 산출.
 //   점수 산식 동일(E·T·St 가중평균). core/phases.js 미접촉(타입카드·격리 가드 무관). Uplift 파일 미참조.
 function _theiaSequencing(DATA, trial){
   if(!DATA||!DATA.phases||!trial||!trial.kseq) return;
   var k=trial.kseq; if(!k.peak_order||!k.peak_order.length) return;
   var ts=(DATA.phases.stages||[]).filter(function(s){return s&&s.key==='transfer';})[0];
   if(!ts) return; ts.metrics=ts.metrics||[];
   if(ts.metrics.some(function(m){return m.key==='seqOrder';})) return;
   var LBL={pelvis:'골반',trunk:'몸통',arm:'팔'};
   var orderTxt=k.peak_order.map(function(s){return LBL[s]||s;}).join('→');
   var correct=(k.sequence_ok===true);
   ts.metrics.push({ key:'seqOrder', label:'운동사슬 순서 (근위→원위)', value:orderTxt, unit:'', score:(correct?90:45), neutral:false, scored:true, band:(correct?'우수':'미흡'), dir:1, _evalTier:'점수(시퀀싱)', status:'score',
     note:'분절 가속 순서(골반→몸통→팔·ordinal). 안정적이면 에너지가 차례로 전달, 끊기면 동시 발화·순서 흔들림.' });
   var vv=ts.metrics.filter(function(m){return m.score!=null && !m.neutral;}).map(function(m){return m.score;});
   if(vv.length) ts.score=Math.round(vv.reduce(function(a,b){return a+b;},0)/vv.length);
 }
 function _theiaRepeatability(DATA, trials){
   if(!DATA||!DATA.phases||!trials||trials.length<3) return;
   var pelv=[],trk=[],arm=[],seqOk=0,seqN=0;
   trials.forEach(function(t){ var k=t&&t.kseq; if(!k)return; var sg=k.segments||{};
     if(sg.pelvis&&sg.pelvis.peak_abs!=null&&isFinite(sg.pelvis.peak_abs))pelv.push(sg.pelvis.peak_abs);
     if(sg.trunk&&sg.trunk.peak_abs!=null&&isFinite(sg.trunk.peak_abs))trk.push(sg.trunk.peak_abs);
     if(sg.arm&&sg.arm.peak_abs!=null&&isFinite(sg.arm.peak_abs))arm.push(sg.arm.peak_abs);
     if(k.sequence_ok!=null){ seqN++; if(k.sequence_ok)seqOk++; } });
   function cv(a){ a=a.filter(function(x){return x!=null&&isFinite(x);}); if(a.length<3)return null;
     if(a.length>=5){ var so=a.slice().sort(function(x,y){return x-y;}); var md=so[Math.floor(so.length/2)]; a=a.slice().sort(function(x,y){return Math.abs(x-md)-Math.abs(y-md);}).slice(0,a.length-1); }
     var m=a.reduce(function(s,v){return s+v;},0)/a.length; if(!m)return null; var sd=Math.sqrt(a.reduce(function(s,v){return s+(v-m)*(v-m);},0)/a.length); return sd/Math.abs(m)*100; }
   var cvs=[cv(pelv),cv(trk),cv(arm)].filter(function(x){return x!=null;});
   var rotCV=cvs.length?cvs.reduce(function(s,v){return s+v;},0)/cvs.length:null;
   var seqPct=seqN?seqOk/seqN*100:null;
   var cs=(DATA.phases.stages||[]).filter(function(s){return s&&s.key==='consistency';})[0];
   if(!cs) return; cs.metrics=cs.metrics||[];
   if(cs.metrics.some(function(m){return m.key==='rotVelCV';})) return;
   if(rotCV!=null){ var sc=Math.max(20,Math.min(100,Math.round(100-(rotCV-1.8)*11))); var b=(rotCV<=3.3?'우수':(rotCV>4.7?'미흡':'정상'));
     cs.metrics.push({ key:'rotVelCV', label:'회전속도 반복성 (투구간)', value:Math.round(rotCV*10)/10, unit:'% CV', score:sc, band:b, scored:true, neutral:false, dir:-1, _evalTier:'점수(반복성)',
       note:'골반·몸통·팔 회전속도 peak의 투구간 robust 변동계수('+trials.length+'구·이상치1 trim). 낮을수록 일관. 엘리트 규준: 우수≤3.3·미흡>4.7.' }); }
   if(seqPct!=null){ var sb=(seqPct>=90?'우수':(seqPct<70?'미흡':'정상'));
     cs.metrics.push({ key:'seqConsist', label:'운동사슬 순서 일관성', value:Math.round(seqPct), unit:'%', score:Math.round(seqPct), band:sb, scored:true, neutral:false, dir:1, _evalTier:'점수(반복성)',
       note:'근위→원위 순서가 유지되는 투구 비율('+seqN+'구).' }); }
   var vv=cs.metrics.filter(function(m){return m.score!=null && !m.neutral;}).map(function(m){return m.score;});
   if(vv.length) cs.score=Math.round(vv.reduce(function(a,b){return a+b;},0)/vv.length);
 }
 var _THEIA_ATTR=[
   {id:'storage',label:'고관절 저장(감아싣기)',phase:'와인드업·드라이브',expr:['comVel','hipAbd','strideLen','pelvisRotV'],tim:['hssBuildKF','strideTime'],wE:0.6,wT:0.4,
     cue:'앞발 닿기 전 뒷엉덩이에 체중을 깊게 싣고 골반을 끝까지 감았다 풀어라 — 다리로 미는 게 아니라 엉덩이에 "감아 저장".',drill:'뒷다리에 앉아 버티기 · 골반 반대로 감기(코일)',blocked:null,effect:'뒷엉덩이에 힘을 충분히 못 실으면 하체에서 만들 추진 에너지 자체가 작아져, 이후 단계가 좋아도 구속 상한이 낮아집니다.'},
   {id:'hiplock',label:'골반 버팀(앞발 착지 잠금)',phase:'블로킹·전환',expr:['hipAbd','comVel','comVelReductionFCBR','apBrakeImpulse'],tim:['pelvisRotV','torsoRotV','hssBuildKF'],wE:0.5,wT:0.5,
     cue:'뒷다리 힘은 쓰는데 앞발 닿는 순간 골반이 "딱" 버텨주질 못해 샌다 — 앞발 닿을 때 뒷엉덩이로 한 박자 버텼다가 몸통을 강하게.',drill:'골반 버팀 연결 · 앞다리 막고 메디신볼 던지기',blocked:null,effect:'앞발 착지 때 골반이 버티지 못하면 하체 힘이 새어 몸통 회전으로 전달되는 에너지가 줄고 제구도 흔들립니다. (앞발 제동 지면반력으로 직접 평가)'},
   {id:'sagittal',label:'옆 무너짐 방지(자세 유지)',phase:'몸통',expr:['torsoRotV'],tim:['seqOrder','comVelReductionFCBR'],wE:0.6,wT:0.4,
     cue:'회전할 때 가슴을 포수 쪽으로 길게 끌고 나가라 — 옆으로 무너지지 말고 돌면서 앞으로 쏟아라.',drill:'옆으로 안 기울이며 회전 · 가슴 정면 유지 던지기',blocked:null,effect:'회전 중 옆으로 무너지면 힘의 방향이 홈플레이트가 아닌 옆으로 분산돼 전달 효율과 제구가 떨어집니다.'},
   {id:'sequencing',label:'엉덩이→몸통→팔 순서(전달)',phase:'전달',expr:['pelvisRotV','torsoRotV','armRotV','armTransferRatio'],tim:['seqOrder'],wE:0.45,wT:0.55,gate:true,
     cue:'엉덩이 먼저, 그 다음 몸통, 마지막에 팔 — 한 박자씩 차례로 넘겨라. 셋이 동시에 터지면 힘이 공까지 안 간다.',drill:'순차 가속(분리 강조) · 스텝-비하인드 순서연습',blocked:null,effect:'엉덩이→몸통→팔 순서가 무너져 동시에 터지면 분절 에너지가 누적되지 못해 채찍 효과가 약해지고 구속이 손실됩니다. (전달비로 직접 평가)'},
   {id:'chestout',label:'가슴 길이 유지(회전 중)',phase:'몸통',expr:['torsoRotV'],tim:['seqOrder'],wE:0.5,wT:0.5,
     cue:'가슴 닫고 접지 말고 — 가슴 열어둔 채 끝까지 돌린 다음 팔로 넘겨.',drill:'가슴 펴고 회전 · 가슴 열고 돌기',blocked:null,effect:'가슴이 일찍 닫히면 회전 가동 범위가 줄어 몸통이 팔로 넘길 에너지가 작아집니다.'},
   {id:'shoulder',label:'어깨 중심 회전(방출)',phase:'팔·방출',expr:['armRotV'],tim:['torsoRotV','seqOrder','comVelReductionFCBR'],wE:0.55,wT:0.45,
     cue:'앞발이 꽉 멈춘 위에서 몸통을 먼저 다 풀어준 다음 팔이 채찍처럼 가장 늦게 따라 나가게 — 팔로 먼저 끌지 말고.',drill:'몸통 먼저-팔 채찍 · 어깨 최대 젖힘(MER) 유지 후 방출',blocked:'어깨 내회전·팔꿈치 안쪽 부하(valgus)는 상지 추정값 — 부상 부하 카드 참조',effect:'몸통보다 팔이 먼저 끌리면 채찍 끝(팔) 속도가 덜 실리고 어깨·팔꿈치 부하가 커져 부상 위험도 올라갑니다.'}
 ];
 function _theiaAttractors(DATA){
   if(!DATA||!DATA.phases) return;
   var byk={}; (DATA.phases.stages||[]).forEach(function(s){ (s.metrics||[]).forEach(function(m){ if(m.key)byk[m.key]=m; }); });
   // [2026-06-19] 교수 결정: 어트랙터 점수는 Theia 에너지 로직과 무관하게 '독립적으로 그대로' 제시(연구자 해석). etDiag 디컨플릭션 미적용.
   function bs(k){ var m=byk[k]; if(!m)return null; if(m.band)return m.band==='우수'?90:(m.band==='미흡'?40:(m.band==='부상'?35:70)); if(m.score!=null&&!m.neutral)return m.score; return null; }
   function axis(ks){ var v=ks.map(bs).filter(function(x){return x!=null;}); return v.length?v.reduce(function(a,b){return a+b;},0)/v.length:null; }
   var seqOK=byk.seqOrder?(byk.seqOrder.band==='우수'):null;
   var hasRepeat=byk.rotVelCV?true:false;
   var out=[];
   _THEIA_ATTR.forEach(function(a){
     var E=axis(a.expr), T=axis(a.tim); if(E==null&&T==null)return;
     if(a.gate&&seqOK===false&&T!=null)T=Math.min(T,45);
     var St=hasRepeat?bs('rotVelCV'):null;
     var score; if(St!=null&&E!=null&&T!=null){ score=Math.round(0.4*E+0.3*T+0.3*St); }
     else if(E!=null&&T!=null){ score=Math.round(a.wE*E+a.wT*T); } else { score=Math.round(E!=null?E:T); }
     var band=score>=75?'STABLE':(score>=55?'PARTIAL':'UNSTABLE'), bandKo=band==='STABLE'?'안정':(band==='PARTIAL'?'보통':'불안정');
     var allv=a.expr.concat(a.tim).map(function(k){return {k:k,s:bs(k),m:byk[k]};}).filter(function(x){return x.s!=null;}).sort(function(x,y){return x.s-y.s;});
     var ev=allv.slice(0,3).map(function(x){return (x.m?(x.m.label||x.k):x.k)+(x.m&&x.m.band?' '+x.m.band:'');});
     var wk=allv.length?allv[0]:null;
     var retest=wk?{ kpi:(wk.m.label||wk.k), unit:(wk.m.unit||''), current:(wk.m.band||'참고'), target:(wk.m.band==='미흡'?'정상 밴드 진입':'정상→우수'), how:'동일 동작 재측정(가능하면 ≥3구)으로 밴드 변화 확인' }:null;
     var graduation='안정도 ≥ 75(안정) 도달 — '+(wk?('핵심지표 "'+(wk.m.label||wk.k)+'" 정상 이상 진입'):'전 지표 정상화');
     out.push({id:a.id,label:a.label,phase:a.phase,score:score,band:band,bandKo:bandKo,expression:E!=null?Math.round(E):null,timing:T!=null?Math.round(T):null,stability:St!=null?Math.round(St):null,evidence:ev,cue:a.cue,drill:a.drill,effect:a.effect,blocked:a.blocked,retest:retest,graduation:graduation});
   });
   out.sort(function(a,b){return a.score-b.score;});
   DATA.attractors=out;
   DATA.todaysAttractor=out.length?out[0]:null;
 }
 function assemblePlayer(p){ if(!__isMyTrackPlayer(p)) throw new Error('['+ __trackLabel() +' 트랙] '+ __otherTrackOf(p) +' 데이터는 이 대시보드에서 처리하지 않습니다 — 해당 트랙 대시보드를 사용하세요'); if(p.uplift) return assembleUpliftPlayer(p); if(p.imu) return assembleImuPlayer(p); var META=p.metaObj||(function(){try{return p.metaText?JSON.parse(p.metaText):{};}catch(e){return {};}})(); var WT=META.weight_kg||86, HAND=META.handedness||'R'; var _DLV=(META.delivery_code||null); var trials=p.texts.map(function(t){ try{ return {file:t.file, trial:extractTheia.extractTrial(parseC3DTxt(t.text),{weight_kg:WT,handedness:HAND,delivery:_DLV})}; }catch(e){ console.warn('trial skip: '+t.file+' — '+e.message); return null; } }).filter(Boolean); if(!trials.length) throw new Error('유효한 trial 없음 (이벤트 태깅 확인)'); var pitches=p.rapText?extractRapsodo.parse(p.rapText):null; var m=Object.assign({},META,{name:META.name||p.name,name_en:META.name_en||'',height_m:META.height_m||1.83,weight_kg:WT,bmi:META.bmi||0,handedness:HAND,max_velocity_kmh:META.max_velocity_kmh,ball_speed_max:META.ball_speed_max,ball_speed_avg:META.ball_speed_avg,delivery:(META.delivery_code||null)}); var DATA=reportData.assemble(trials,pitches,m,window.__FITNESS_BY||null); try{ DATA.phases=(window.phases)?window.phases.compute(DATA.trials[(DATA.best_trial_index||1)-1], m, DATA.energy_transfer, DATA.trials, DATA.command):null; var _bt=DATA.trials[(DATA.best_trial_index||1)-1]; try{ _theiaSequencing(DATA,_bt); }catch(_e){ console.warn('theia seq',_e); } try{ _theiaRepeatability(DATA,DATA.trials); }catch(_e){ console.warn('theia repeat',_e); } try{ _theiaAttractors(DATA); }catch(_e){ console.warn('theia attractors',_e); } }catch(e){ console.error('phases',e); } return DATA; }
 function buildAllData(cb){ var i=0; if(!PLAYERS.length){ if(cb)cb(); return; } bar.style.display='block'; barIn.style.width='0'; (function step(){ if(i>=PLAYERS.length){ bar.style.display='none'; var _grp=_UPLOAD_GROUP; if(_grp==='cohort'){ msg.textContent=PLAYERS.length+'명 코호트(검증용)로 저장 완료 — 아래 「코호트」 섹션에서 확인하세요'; var _cm=document.getElementById('cohortmsg'); if(_cm)_cm.textContent=' '+PLAYERS.length+'명 코호트 저장됨'; try{ if(_LIVE_NORMS_AUTO && typeof SB!=='undefined'&&SB&&_SBUSER&&typeof _recomputeEliteNorms==='function'){ var _enm=document.getElementById('elite-norm-msg'); _recomputeEliteNorms(function(t){ if(_enm)_enm.textContent='[자동 규준 갱신] '+t; },function(){}); } }catch(e){}  /* [2026-06-18] 코호트 업로드 시 규준 자동 재계산 — [핫픽스] _LIVE_NORMS_AUTO 게이트(기본 OFF·수동전용) */ } else { msg.textContent=PLAYERS.length+'명 분석 완료 — 카드에서 리포트를 열거나 저장하세요'; } try{ loadSavedPlayers(); }catch(e){} _UPLOAD_GROUP='team'; if(cb)cb(); return; } var p=PLAYERS[i]; msg.textContent='분석 중… '+(i+1)+'/'+PLAYERS.length+' ('+p.name+')'; barIn.style.width=Math.round((i+1)/PLAYERS.length*100)+'%'; sleep().then(function(){ try{ p._data=assemblePlayer(p); if(p._data)p._data._team=_UPLOAD_TEAM; savePlayerData(p._data); }catch(e){ p._err=e.message; console.error(e); } i++; sleep().then(step); }); })(); }
 // ── 카드 스탯 칩(미니 게이지 + 강점/미달 색 인코딩 — dashboard-handoff ISSUE-01·TLDR-11) ──
 function _chip(l,v,opts){ opts=opts||{}; var tone=opts.tone?(' '+opts.tone):'';
   var g=''; if(opts.gauge!=null){ var w=Math.max(0,Math.min(100,opts.gauge)); g='<div class="pc-gauge"><i class="'+(opts.tone||'')+'" style="width:'+w+'%"></i></div>'; }
   return '<div class="pc-chip'+tone+'"><div class="pc-cl">'+l+'</div><div class="pc-cv">'+v+'</div>'+g+'</div>'; }
 // 점수 → 색 톤(강점=good 초록 / 미달=warn 주황 / 그 외 중립)
 function _scoreTone(v,goodAt,warnAt){ if(v==null)return null; if(v>=goodAt)return 'good'; if(v<=warnAt)return 'warn'; return null; }
 // 4개 스탯 행(구속 강조 + 메카닉·체력 미니게이지) — 3개 카드 빌더 공통
 function _statRow(velo,mech,fit,spin,comp,fitUnit){
   return '<div class="pc-stats">'
     +_chip('최고 구속',velo!=null?velo+'<u>km/h</u>':'—')
     +_chip('회전수',spin!=null?spin+'<u>rpm</u>':'—')
     +_chip('체력',fit!=null?fit+'<u>'+(fitUnit||'점')+'</u>':'—',{gauge:fit,tone:(fitUnit==='%ile'?_scoreTone(fit,67,33):_scoreTone(fit,80,55))})
     +_chip('메카닉',mech!=null?mech+'<u>%ile</u>':'—',{gauge:mech,tone:_scoreTone(mech,67,33)})  // 백분위(50=중앙) — 리포트와 동일
     +'</div>'; }
 // NEW 배지(측정/저장일 ≤ 24h — TLDR-05)
 function _newBadge(ts){ if(!ts)return ''; var d=Date.now()-ts; return (d>=0&&d<=864e5)?'<span class="pc-new">NEW</span>':''; }
 // 카드 헤더(이름 + NEW 배지 + 서브) 공통
 function _pcHeadHTML(name,sub,ts){ return '<div class="pc-head"><div class="pc-htop"><b class="pc-name">'+name+'</b>'+_newBadge(ts)+'</div><span class="pc-sub">'+sub+'</span></div>'; }
 // 카드 액션 행: 분석 리포트=primary, 선수용=ghost, PDF·HTML=아이콘, 그 외·삭제=⋯ 메뉴 (ISSUE-01·TLDR-03/04)
 function _closePcMenus(){ var ms=document.querySelectorAll('.pc-menu.open'); for(var i=0;i<ms.length;i++)ms[i].classList.remove('open'); }
 if(typeof document!=='undefined'){ document.addEventListener('click',_closePcMenus); }
 function _pcActions(card,defs){
   var row=document.createElement('div'); row.className='pc-actions'; var menu=[];
   defs.forEach(function(d){ if(!d)return; if(d.menu){ menu.push(d); return; }
     var b=document.createElement('button'); b.className='pcbtn '+(d.kind||'ghost'); b.innerHTML=d.txt; if(d.title)b.title=d.title; b.onclick=d.fn; row.appendChild(b); });
   if(menu.length){ var wrap=document.createElement('div'); wrap.className='pc-more-wrap';
     var mb=document.createElement('button'); mb.className='pcbtn icon'; mb.textContent='⋯'; mb.title='더 보기';
     var dd=document.createElement('div'); dd.className='pc-menu';
     menu.forEach(function(d){ var mi=document.createElement('button'); mi.className='pc-menu-item'+(d.danger?' danger':''); mi.innerHTML=d.txt; mi.onclick=function(e){ e.stopPropagation(); dd.classList.remove('open'); d.fn.call(mb); }; dd.appendChild(mi); });
     mb.onclick=function(e){ e.stopPropagation(); var op=dd.classList.contains('open'); _closePcMenus(); if(!op)dd.classList.add('open'); };
     wrap.appendChild(mb); wrap.appendChild(dd); row.appendChild(wrap); }
   card.appendChild(row); }
 // 검색·정렬·팀필터 바 (ISSUE-02) — box 안의 .pcard(그리드별)에 클라이언트 필터/정렬 적용
 function _attachFilterBar(box, gridClass, teams){
   if(!box) return; if(box.querySelector(':scope > .pc-filter')) return;
   var multi=teams&&teams.length>1;
   var seg=multi?('<div class="pc-seg"><button class="on" data-t="">전체</button>'+teams.map(function(t){return '<button data-t="'+t.replace(/"/g,'')+'">'+t+'</button>';}).join('')+'</div>'):'';
   var bar=document.createElement('div'); bar.className='pc-filter';
   bar.innerHTML='<div class="pf-search"><span class="ic">⌕</span><input type="text" placeholder="이름·팀으로 검색"></div>'+seg
     +'<select class="pf-sort"><option value="date">최근 측정순</option><option value="velo">구속 높은순</option><option value="mech">메카닉 높은순</option><option value="name">이름순</option></select>';
   box.insertBefore(bar, box.firstChild);
   var input=bar.querySelector('input'), sortSel=bar.querySelector('.pf-sort'), curTeam='';
   function num(c,k){ var v=parseFloat(c.dataset[k]); return isNaN(v)?-Infinity:v; }
   function apply(){
     var q=(input.value||'').trim().toLowerCase(), mode=sortSel.value, shown=0;
     var grids=box.querySelectorAll('.'+gridClass);
     for(var gi=0;gi<grids.length;gi++){ var grid=grids[gi];
       var cards=Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
       cards.sort(function(a,b){ if(mode==='name')return (a.dataset.name||'').localeCompare(b.dataset.name||''); if(mode==='velo')return num(b,'velo')-num(a,'velo'); if(mode==='mech')return num(b,'mech')-num(a,'mech'); return num(b,'date')-num(a,'date'); });
       cards.forEach(function(c){ grid.appendChild(c); });
       var gShown=0;
       cards.forEach(function(c){ var nm=(c.dataset.name||'').toLowerCase(), tm=(c.dataset.team||''); var ok=(!q||nm.indexOf(q)>=0||tm.toLowerCase().indexOf(q)>=0)&&(!curTeam||tm===curTeam); c.style.display=ok?'':'none'; if(ok){gShown++;shown++;} });
       var lbl=grid.previousElementSibling; if(lbl&&lbl.className.indexOf(gridClass)<0&&lbl.className.indexOf('pc-filter')<0){ lbl.style.display=gShown?'':'none'; }
     }
     var nr=box.querySelector('.pc-noresult'); if(!shown){ if(!nr){ nr=document.createElement('div'); nr.className='pc-noresult'; box.appendChild(nr); } nr.textContent='검색 결과가 없습니다 — 다른 이름이나 팀으로 시도해 보세요.'; nr.style.display=''; } else if(nr){ nr.style.display='none'; }
   }
   input.oninput=apply; sortSel.onchange=apply;
   if(multi){ var segb=bar.querySelectorAll('.pc-seg button'); for(var i=0;i<segb.length;i++){ segb[i].onclick=function(){ for(var j=0;j<segb.length;j++)segb[j].classList.remove('on'); this.classList.add('on'); curTeam=this.getAttribute('data-t')||''; apply(); }; } }
   apply();
 }
 // 다중 선택 + 일괄작업 바 (ISSUE-03) — 저장 선수 카드에 체크박스 + 하단 부유 바
 function _bulkSelected(){ var out=[]; var sel=document.querySelectorAll('#saved-box .pcard.sel'); for(var i=0;i<sel.length;i++){ if(sel[i]._rec)out.push(sel[i]._rec); } return out; }
 function _bulkClear(){ var sel=document.querySelectorAll('#saved-box .pcard.sel'); for(var i=0;i<sel.length;i++){ sel[i].classList.remove('sel'); var cb=sel[i].querySelector('.pc-check'); if(cb)cb.checked=false; } _bulkUpdate(); }
 function _makeBulkBar(){ var bar=document.createElement('div'); bar.id='bm-bulkbar'; bar.className='bulkbar'; bar.innerHTML='<span class="bcount"></span>';
   function add(txt,cls,fn){ var b=document.createElement('button'); if(cls)b.className=cls; b.textContent=txt; b.onclick=fn; bar.appendChild(b); }
   add('일괄 선수 PDF','',function(){ var s=_bulkSelected(); if(s.length)openAllPlayerPDF(s.map(function(r){return r.DATA;})); });
   add('코호트로 이동','',function(){ var s=_bulkSelected(); if(s.length&&confirm(s.length+'명을 코호트(검증용)로 옮길까요?'))bulkMove(s,'cohort'); });
   add('일반으로 이동','',function(){ var s=_bulkSelected(); if(s.length&&confirm(s.length+'명을 일반으로 옮길까요?'))bulkMove(s,'team'); });
   add('삭제','danger',function(){ var s=_bulkSelected(); if(s.length&&confirm(s.length+'명 저장 데이터를 삭제할까요?')){ var i=0;(function nx(){ if(i>=s.length){loadSavedPlayers();return;} dbDel(s[i].id,function(){i++;nx();}); })(); } });
   add('×','bclose',function(){ _bulkClear(); });
   document.body.appendChild(bar); return bar; }
 function _bulkUpdate(){ var sel=_bulkSelected(); var bar=document.getElementById('bm-bulkbar')||_makeBulkBar(); var cnt=bar.querySelector('.bcount'); cnt.innerHTML='<b>'+sel.length+'</b>명 선택'; bar.classList.toggle('show', sel.length>=2); }
 function _attachBulkBar(box,kind){ if(kind!=='saved'||!box) return; var cards=box.querySelectorAll('.pcard');
   for(var i=0;i<cards.length;i++){ (function(c){ if(c.querySelector('.pc-check'))return; var cb=document.createElement('input'); cb.type='checkbox'; cb.className='pc-check'; cb.title='선택'; cb.onclick=function(e){ e.stopPropagation(); c.classList.toggle('sel',cb.checked); _bulkUpdate(); }; c.appendChild(cb); })(cards[i]); }
   _bulkUpdate(); }
 // [2026-05-26 FIX] 카드 메카닉 = 엘리트 백분위(50=중앙) — 리포트와 동일 산식(teamReport.summarize). 구 stage.score 평균(레거시 임계)은 리포트와 어긋나 순위 역전 발생했음.
 function _mechSumm(D){ if(!D||!D.phases||!D.phases.stages)return null; try{ if(window.teamReport&&window.teamReport.summarize) return window.teamReport.summarize(D); }catch(e){} return null; }
 function _mechComp(D){ var s=_mechSumm(D); if(s&&s.mech!=null)return s.mech; if(!D||!D.phases||!D.phases.stages)return null; var ss=D.phases.stages.filter(function(x){return x.score!=null;}); return ss.length?Math.round(ss.reduce(function(a,x){return a+x.score;},0)/ss.length):null; }
 function _compIdx(D){ var s=_mechSumm(D); return s&&s.comp_index!=null?s.comp_index:null; }
 function showList(){ list.innerHTML=''; PLAYERS.forEach(function(p,pi){ var D=p._data; var card=document.createElement('div'); card.className='pcard';
   var velo=(D&&D.velo_summary&&D.velo_summary.max_kmh!=null)?D.velo_summary.max_kmh:(D&&D.measured_kmh?D.measured_kmh:null);
   var spin=(D&&D.velo_summary&&D.velo_summary.avg_spin!=null)?D.velo_summary.avg_spin:null;
   var mech=_mechComp(D); var comp=_compIdx(D); var fit=(D&&D.hp_assessment&&D.hp_assessment.overall_norm_pct!=null)?D.hp_assessment.overall_norm_pct:null;
   var hand=(D&&D.player&&D.player.handedness)?D.player.handedness:'';
   card.dataset.name=p.name||''; card.dataset.team=(D&&D._team)||''; card.dataset.velo=(velo!=null?velo:''); card.dataset.mech=(mech!=null?mech:''); card.dataset.date=Date.now();
   card.innerHTML=_pcHeadHTML(p.name, (hand?hand+'HP · ':'')+p.texts.length+'구'+(p.rapText?' · Rapsodo':''), null)+_statRow(velo,mech,fit,spin,comp,'%ile')+(p._err?'<div class="pc-err"> '+p._err+'</div>':'');
   _pcActions(card,[
     {txt:'▶ 분석 리포트', kind:'primary', fn:function(){ buildAndOpen(pi,this,openReport); }}
   ]);
   list.appendChild(card);
 }); renderTeamBar(); }
 function buildAndOpen(pi,btn,opener){ var p=PLAYERS[pi]; if(btn)btn.disabled=true; sleep().then(function(){ try{ if(!p._data)p._data=assemblePlayer(p); var _hc=p._data.handedness_check; if(_hc&&_hc.mismatch){ alert(' 손잡이 불일치: 메타='+(_hc.declared==='right'?'우완':'좌완')+', 감지='+(_hc.detected==='right'?'오른팔':'왼팔')+' — meta handedness 확인'); } (opener||openReport)(p._data); msg.textContent=p.name+' 리포트 열림 '; }catch(e){ msg.innerHTML='<span style="color:#cf6f6c">조립 오류: '+e.message+'</span>'; console.error(e); } if(btn)btn.disabled=false; }); }

 var TEAM_SUMM=[];
 function renderTeamBar(){ if(!teambar) return; teambar.innerHTML=''; var db=document.getElementById('dashbar'); if(db) db.innerHTML=''; if(PLAYERS.length>=1){ teambar.style.display='flex'; teambar.style.flexWrap='wrap'; teambar.style.gap='6px'; var lbl=' ('+PLAYERS.length+'명)'; function tb(txt,bg,mode){ var b=document.createElement('button'); b.className='dbtn'; b.textContent=txt; b.style.background=bg; b.style.flex='0 0 auto'; b.onclick=function(){ buildTeamAndOpen(b,mode); }; teambar.appendChild(b); } tb(' 팀 현황 리포트'+lbl,'#6aa6cf','open'); tb(' 팀 PDF','#b85c1e','print'); tb(' 팀 HTML 저장','#3b6e54','download'); } } // [2026-06-13 전면교체] '전체 선수 리포트 PDF' 버튼 제거(구 선수용 리포트 산출물 차단)
 function buildDashboardAndStore(btn){ btn.disabled=true; bar.style.display='block'; barIn.style.width='0'; var COLL=[]; var pi=0;
   (function nextP(){ if(pi>=PLAYERS.length){ finishDash(); return; } var p=PLAYERS[pi];
     var META={}; if(p.metaObj){ META=p.metaObj; } else { try{ if(p.metaText) META=JSON.parse(p.metaText); }catch(e){} } var WT=META.weight_kg||86, HAND=META.handedness||'R'; var trials=[]; var i=0;
     (function step(){ if(i>=p.texts.length){
         try{ var pitches=p.rapText?extractRapsodo.parse(p.rapText):null; var m={name:META.name||p.name,name_en:META.name_en||'',height_m:META.height_m||1.8,weight_kg:WT,bmi:META.bmi||0,handedness:HAND,max_velocity_kmh:META.max_velocity_kmh,ball_speed_max:META.ball_speed_max,ball_speed_avg:META.ball_speed_avg,delivery:(META.delivery_code||null)}; var DATA=reportData.assemble(trials,pitches,m,window.__FITNESS_BY||window.__FITNESS_MANUAL||null); /* [2026-06-01 FIX] 실측 구속(ball_speed_*) 전달 */ META.name=m.name; META.handedness=HAND; META.height_m=m.height_m; META.weight_kg=WT; COLL.push({meta:META, DATA:DATA}); }
         catch(e){ console.error(e); }
         pi++; barIn.style.width=Math.round(pi/PLAYERS.length*100)+'%'; msg.textContent='대시보드 집계 '+pi+'/'+PLAYERS.length+'명…'; sleep().then(nextP); return; }
       try{ trials.push({file:p.texts[i].file, trial:extractTheia.extractTrial(parseC3DTxt(p.texts[i].text),{weight_kg:WT,handedness:HAND,delivery:(META.delivery_code||null)})}); }catch(e){ console.error(e); }
       i++; sleep().then(step); })();
   })();
   function finishDash(){ try{ var payload=window.dashboardAdapter.buildPayload(COLL); localStorage.setItem('sangdong_dashboard_v1', JSON.stringify(payload)); msg.innerHTML=' 팀 대시보드로 전송됨 ('+payload.players.length+'명). <a href="coach/" target="_blank" style="color:#6aa6cf">코치 대시보드 열기 ↗</a> · <a href="dashboard/" target="_blank" style="color:#6aa6cf">분석가용 ↗</a>'; }catch(e){ msg.innerHTML='<span style="color:#cf6f6c">대시보드 전송 오류: '+e.message+'</span>'; console.error(e); } btn.disabled=false; bar.style.display='none'; } }
 function buildTeamAndOpen(btn,mode){ mode=mode||'open'; btn.disabled=true; bar.style.display='block'; barIn.style.width='0'; TEAM_SUMM=[]; var pi=0;
   (function nextPlayer(){ if(pi>=PLAYERS.length){ finishTeam(); return; } var p=PLAYERS[pi];
     var META={}; if(p.metaObj){ META=p.metaObj; } else { try{ if(p.metaText) META=JSON.parse(p.metaText); }catch(e){} } var WT=META.weight_kg||86, HAND=META.handedness||'R'; var trials=[]; var i=0;
     (function step(){ if(i>=p.texts.length){
         try{ var pitches=p.rapText?extractRapsodo.parse(p.rapText):null; var m={name:META.name||p.name,name_en:META.name_en||'',height_m:META.height_m||1.83,weight_kg:WT,bmi:META.bmi||0,handedness:HAND,max_velocity_kmh:META.max_velocity_kmh,ball_speed_max:META.ball_speed_max,ball_speed_avg:META.ball_speed_avg,delivery:(META.delivery_code||null)}; var DATA=reportData.assemble(trials,pitches,m,window.__FITNESS_BY||null); try{ DATA.phases=(window.phases)?window.phases.compute(DATA.trials[(DATA.best_trial_index||1)-1], m, DATA.energy_transfer, DATA.trials, DATA.command):null; }catch(e){ console.error('phases',e); } TEAM_SUMM.push(teamReport.summarize(DATA)); DATA=null; }
         catch(e){ console.error(e); }
         pi++; barIn.style.width=Math.round(pi/PLAYERS.length*100)+'%'; msg.textContent='팀 집계 '+pi+'/'+PLAYERS.length+'명…'; sleep().then(nextPlayer); return; }
       try{ trials.push({file:p.texts[i].file, trial:extractTheia.extractTrial(parseC3DTxt(p.texts[i].text),{weight_kg:WT,handedness:HAND,delivery:(META.delivery_code||null)})}); }catch(e){ console.error(e); }
       i++; sleep().then(step); })();
   })();
   function finishTeam(){ try{ try{var _nn=function(x){return String(x==null?'':x).replace(/\s+/g,'');};var _have={};TEAM_SUMM.forEach(function(s){if(s&&s.name)_have[_nn(s.name)]=1;});var _FB=window.__FITNESS_BY||{};Object.keys(_FB).forEach(function(nm){ if(_have[_nn(nm)])return; try{ var _hpa=(window.fitness&&window.fitness.hpAssessment)?window.fitness.hpAssessment(nm,_FB):null; if(!_hpa||_hpa.overall_score==null)return; TEAM_SUMM.push(teamReport.summarize({player:{name:nm,handedness:'R'},hp_assessment:_hpa})); }catch(e){console.error('fitness-only summary',nm,e);} }); }catch(e){console.error('fitness-only loop',e);} var html=teamReport.buildTeamHTML(TEAM_SUMM); if(mode==='download'){ _dlHTML(html,'팀_바이오모션_현황리포트.html'); msg.textContent='팀 현황 리포트 HTML 저장됨  ('+TEAM_SUMM.length+'명)'; } else if(mode==='print'){ var wp=window.open('','_blank'); if(!wp){ msg.innerHTML='<span style="color:#cf6f6c">팝업 차단됨 — 허용 후 다시</span>'; } else { wp.document.open(); wp.document.write(html); wp.document.close(); setTimeout(function(){ try{ wp.focus(); wp.print(); }catch(e){} },700); msg.textContent='팀 현황 리포트 인쇄(PDF) '; } } else { var blob=new Blob([html],{type:'text/html'}); var url=URL.createObjectURL(blob); var w=window.open(url,'_blank'); if(!w) msg.innerHTML='<span style="color:#cf6f6c">팝업 차단됨 — 허용 후 다시</span>'; else msg.textContent='팀 현황 리포트 열림  ('+TEAM_SUMM.length+'명)'; } }catch(e){ msg.innerHTML='<span style="color:#cf6f6c">팀 리포트 오류: '+e.message+'</span>'; console.error(e); } btn.disabled=false; bar.style.display='none'; } }
 function fmsg(t){ if(fitmsg) fitmsg.textContent=t; }
 function applyFitness(c){ try{ if(!window.fitness||!Object.keys(c).length){ fmsg('체력 CSV(HJ/SJ/CMJ/IMTP)를 찾지 못함'); return; } var FB=window.fitness.loadFitness(c); var n=Object.keys(FB).length; if(!n){ fmsg('체력 데이터에서 선수를 찾지 못함'); return; } window.__FITNESS_MANUAL=FB; if(window.__FITNESS_BY){ for(var pn in FB){ if(!window.__FITNESS_BY[pn]){window.__FITNESS_BY[pn]=FB[pn];} else { for(var kk in FB[pn]){ if(window.__FITNESS_BY[pn][kk]==null) window.__FITNESS_BY[pn][kk]=FB[pn][kk]; } } } } else { window.__FITNESS_BY=FB; } fmsg('체력 데이터 '+n+'명 로드됨  (이후 리포트에 반영)'); }catch(e){ fmsg('체력 파싱 오류: '+e.message); console.error(e); } }
 function handleFitness(fl){ var files=Array.prototype.slice.call(fl); if(files.length===1 && /\.zip$/i.test(files[0].name)){ var rd=new FileReader(); rd.onload=function(){ zipReader.unzip(rd.result).then(function(zf){ var c={}; for(var path in zf){ var b=path.split('/').pop(); var m=b.match(/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i); if(m) c[m[1].toLowerCase()]=zf[path]; } applyFitness(c); }).catch(function(e){ fmsg('zip 오류: '+e.message); }); }; rd.readAsArrayBuffer(files[0]); return; } if(files.length===1 && /\.csv$/i.test(files[0].name)){ var rdm=new FileReader(); rdm.onload=function(){ var t=rdm.result; var head=(t.split(/\r?\n/)[0]||''); if(/Grip_Strength/i.test(head) && /(Name_kor|CMJ_|IMTP_)/i.test(head)){ try{ var FB=window.fitness.loadMasterFitness(t); var nn=Object.keys(FB).length; if(nn){ window.__FITNESS_MANUAL=FB; if(window.__FITNESS_BY){ for(var pn in FB){ if(!window.__FITNESS_BY[pn]){window.__FITNESS_BY[pn]=FB[pn];} else { for(var kk in FB[pn]){ if(window.__FITNESS_BY[pn][kk]==null) window.__FITNESS_BY[pn][kk]=FB[pn][kk]; } } } } else { window.__FITNESS_BY=FB; } fmsg('통합 체력파일 '+nn+'명 로드됨  (악력 포함 6축)'); return; } }catch(e){ fmsg('통합 체력 파싱 오류: '+e.message); return; } } var m1=files[0].name.match(/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i); var cc={}; if(m1)cc[m1[1].toLowerCase()]=t; applyFitness(cc); }; rdm.readAsText(files[0]); return; } var c={}, n=files.length, done=0; if(!n){ return; } files.forEach(function(f){ var m=f.name.match(/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i); var rd=new FileReader(); rd.onload=function(){ if(m) c[m[1].toLowerCase()]=rd.result; done++; if(done>=n) applyFitness(c); }; rd.readAsText(f); }); }
 function handle(file){ msg.textContent='읽는 중… '+file.name; list.innerHTML='';
   _setManualMeta();
   if(/\.zip$/i.test(file.name)){ var rd=new FileReader(); rd.onload=function(){ zipReader.unzip(rd.result).then(_processFiles).catch(function(e){msg.innerHTML='<span style="color:#cf6f6c">zip 오류: '+e.message+'</span>';console.error(e);}); }; rd.readAsArrayBuffer(file); }
   else{ handleCsvFiles([file]); } }
 /* [FIX 0525] 폼(이름/신장/체중) → window.__MANUAL_META, 파일 업로드 시 player 메타로 사용 */
 function _setManualMeta(){ try{ var n=(document.getElementById('player_name')||{}).value, h=parseFloat((document.getElementById('player_height')||{}).value), w=parseFloat((document.getElementById('player_weight')||{}).value); var m={}; if(n&&String(n).trim())m.name=String(n).trim(); if(isFinite(h)&&h>0)m.height_m=(h>3?h/100:h); if(isFinite(w)&&w>0)m.weight_kg=w; window.__MANUAL_META=(Object.keys(m).length?m:null); }catch(e){} }
 /* [FIX 0525] 개별 CSV(여러 개) 입력 → files 맵 빌드 후 zip과 동일 처리 */
 function handleCsvFiles(fileList){ var arr=Array.prototype.slice.call(fileList).filter(function(f){return /\.(csv|txt|c3d)$/i.test(f.name);}); if(!arr.length){ msg.innerHTML='<span style="color:#cf6f6c">CSV 또는 zip 파일을 넣어주세요</span>'; return; } _setManualMeta(); msg.textContent='읽는 중… '+arr.length+'개 파일'; list.innerHTML=''; var files={}, done=0; arr.forEach(function(f){ var r=new FileReader(); r.onload=function(){ files[f.name]=r.result; if(++done>=arr.length){ try{ _processFiles(files); }catch(e){ msg.innerHTML='<span style="color:#cf6f6c">처리 오류: '+e.message+'</span>'; console.error(e); } } }; r.readAsText(f); }); }
 function _processFiles(files){function _isUpCsv(t){ var h=(t||"").slice(0,5000).split(/\r?\n/)[0]||""; return /(^|,)athlete_name(,|$)/.test(h)&&/_jc_3d_x/.test(h); }
     function _isMr3Csv(t){ var h=(t||"").slice(0,20000); return /Noraxon MyoMotion/.test(h) || (/begin_time/.test(h)&&/frequency/.test(h)&&/Trajectories|Segments/.test(h)); }
     // ── 견고한 그룹핑: meta.json 폴더 기준 → 없으면 최상위 폴더 → 없으면 단일 선수 ──
     function pdir(p){ var a=p.split('/').filter(Boolean); a.pop(); return a.join('/'); }
     var roots=[]; for(var path in files){ var b=path.split('/').pop(); if(/meta\.json$/i.test(b)) roots.push(pdir(path)); }
     var fcsv={}; for(var path in files){ var b2=path.split('/').pop(); var fm=b2.match(/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i); if(fm) fcsv[fm[1].toLowerCase()]=files[path]; }
     var _zf=(window.fitness&&Object.keys(fcsv).length)?window.fitness.loadFitness(fcsv):null; var _man=window.__FITNESS_MANUAL||null; var _mg=_zf||_man; if(_zf&&_man){ for(var pn in _man){ if(!_zf[pn]){_zf[pn]=_man[pn];} else { for(var kk in _man[pn]){ if(_zf[pn][kk]==null) _zf[pn][kk]=_man[pn][kk]; } } } _mg=_zf; } window.__FITNESS_BY=_mg; var rosterById={}; if(typeof XLSX!=='undefined'){ var _rp=null,_mp=null; for(var rpath in files){ if(rpath.indexOf('__MACOSX')>=0)continue; var _bn=rpath.split('/').pop().toLowerCase(); if(_bn==='roster.xlsx')_rp=rpath; if(_bn==='master_fitness.xlsx')_mp=rpath; } var _wbf=function(pp){ try{ return XLSX.read(files[pp],{type:'array'}); }catch(e){ return null; } }; if(_rp){ var _w=_wbf(_rp); if(_w){ XLSX.utils.sheet_to_json(_w.Sheets[_w.SheetNames[0]]).forEach(function(r){ var id=String(r.ID||r.id||'').trim(); if(!id)return; var ty=String(r.Type||'').trim(); var ht=+r.Height; rosterById[id]={name:(r.Name_kor||r.Name_eng||id), handedness:(ty?ty.charAt(0).toUpperCase():'R'), weight_kg:(+r.Mass||null), height_m:(isFinite(ht)?(ht>3?ht/100:ht):null)}; }); } } if(_mp){ var _w2=_wbf(_mp); if(_w2&&window.fitness&&window.fitness.loadMasterFitness){ try{ var _csv=XLSX.utils.sheet_to_csv(_w2.Sheets[_w2.SheetNames[0]]); var _FB=window.fitness.loadMasterFitness(_csv); if(_FB&&Object.keys(_FB).length){ window.__FITNESS_MANUAL=_FB; window.__FITNESS_BY=_FB; } }catch(e){} } } }
     function pkey(path){ if(roots.length){ var best=null; roots.forEach(function(r){ var pre=r?r+'/':''; if(path.indexOf(pre)===0&&(best===null||r.length>best.length)) best=r; }); if(best!==null) return best; } var a=path.split('/').filter(Boolean); a.pop(); var _dt=/^(theia|rapsodo|vald|fitness|c3d|data)$/i, _ix=/^\d+_/; var cand=a.filter(function(x){return !_dt.test(x)&&!_ix.test(x)&&!/theia|rapsodo|vald|fitness/i.test(x);}); return cand.length?cand[cand.length-1]:(a.length?a[a.length-1]:'선수'); }
     var byP={}; for(var path in files){ var b=path.split('/').pop();
       if(/c3d/i.test(path)&&!/rapsodo/i.test(b)){ var k=pkey(path); (byP[k]=byP[k]||{texts:[]}).texts.push({file:b,text:files[path]}); } else if(/\.csv$/i.test(b)&&!/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i.test(b)&&_isUpCsv(files[path])){ var k2=pkey(path); var e2=(byP[k2]=byP[k2]||{texts:[]}); e2.texts.push({file:b,text:files[path]}); e2.uplift=true; } else if(/\.csv$/i.test(b)&&!/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i.test(b)&&_isMr3Csv(files[path])){ var k3=pkey(path); var e3=(byP[k3]=byP[k3]||{texts:[]}); e3.texts.push({file:b,text:files[path]}); e3.imu=true; } }
     for(var path in files){ var b=path.split('/').pop();
       if(/\.csv$/i.test(b)&&!/(CMJ|SJ|IMTP|HJ|GRIP)\.csv$/i.test(b)&&!_isUpCsv(files[path])&&!_isMr3Csv(files[path])&&!/(^|\/)info\.csv$/i.test(b)){ var k=pkey(path); if(byP[k]&&!byP[k].rapText) byP[k].rapText=files[path]; }
       if(/meta\.json$/i.test(b)){ var k=pkey(path); if(byP[k]) byP[k].metaText=files[path]; }
      /* [FIX 0525] info 파일(csv/xls/xlsx) → 신장·체중·앞발 플레이트 경사 파싱(단위 허용 '177cm'/'114kg'/'4.4 deg decline'). IMU 메타로 사용. */
      if(/(^|\/)info\.(csv|xlsx?)$/i.test(b)){ var ik=pkey(path); if(byP[ik]){ try{
        var _hd=[], _vv=[];
        if(/\.csv$/i.test(b)){ var _rr=String(files[path]).split(/\r?\n/); _hd=(_rr[0]||'').split(',').map(function(s){return s.replace(/^﻿/,'').replace(/^"|"$/g,'').trim().toLowerCase();}); _vv=(_rr[1]||'').split(',').map(function(s){return s.replace(/^"|"$/g,'').trim();}); }
        else if(typeof XLSX!=='undefined'){ var _wb=XLSX.read(files[path],{type:'array'}); var _rows=XLSX.utils.sheet_to_json(_wb.Sheets[_wb.SheetNames[0]],{header:1,raw:false}); _hd=(_rows[0]||[]).map(function(s){return String(s==null?'':s).trim().toLowerCase();}); _vv=(_rows[1]||[]).map(function(s){return String(s==null?'':s).trim();}); }
        if(_hd.length){
          var _gv=function(ns){ for(var z=0;z<ns.length;z++){ for(var h2=0;h2<_hd.length;h2++){ if(_hd[h2].indexOf(ns[z])>=0 && _vv[h2]!=null && _vv[h2]!=='') return _vv[h2]; } } return null; };
          var _nm=function(s){ if(s==null)return null; var m=String(s).replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?parseFloat(m[0]):null; };
          var _im=byP[ik]._infoMeta||{};
          var _h=_nm(_gv(['height_cm','height_m','height','신장','키'])); if(_h!=null) _im.height_m=(_h>3?_h/100:_h);
          var _w=_nm(_gv(['weight_kg','mass_kg','weight','mass','체중','몸무게'])); if(_w!=null) _im.weight_kg=_w;
          var _t=_nm(_gv(['slop','slope','tilt','경사','기울'])); if(_t!=null) _im.plate_tilt_deg=Math.abs(_t);
          var _ln=_gv(['last_name']), _fn=_gv(['first_name']); var _nmn=((_ln||'')+(_fn?(' '+_fn):'')).trim(); if(_nmn) _im.name=_nmn;
          byP[ik]._infoMeta=_im;
        }
      }catch(e){} } } }
     (function(){ var _tn=''; try{ var _ti=document.getElementById('teamname'); _tn=_ti?(_ti.value||'').trim():''; }catch(e){} var _topSeg=''; for(var _pp in files){ var _s=_pp.split('/').filter(Boolean)[0]; if(_s){ _topSeg=_s; break; } } _UPLOAD_TEAM=(_UPLOAD_GROUP==='cohort')?'코호트':(_tn||(_topSeg.replace(/_\d{6,8}$/,'').trim())||_topSeg||'기타'); })();
     PLAYERS=Object.keys(byP).filter(function(k){return byP[k].texts.length;}).sort().map(function(k){ var e=byP[k]; var nm=(k.split('/').pop())||'선수'; var mObj=null; try{ if(e.metaText){ var mj=JSON.parse(e.metaText); if(mj.name) nm=mj.name; mObj=mj; } }catch(_){ } if(rosterById[k]){ nm=rosterById[k].name; mObj=Object.assign({}, mObj||{}, rosterById[k]); } if(e._infoMeta){ mObj=Object.assign({}, e._infoMeta, mObj||{}); } if(window.__MANUAL_META){ mObj=Object.assign({}, mObj||{}, window.__MANUAL_META); if(window.__MANUAL_META.name) nm=window.__MANUAL_META.name; } e.texts.sort(function(a,b){return a.file.localeCompare(b.file,undefined,{numeric:true});}); return {name:nm, texts:e.texts, rapText:e.rapText||null, metaText:e.metaText||null, metaObj:mObj, uplift:e.uplift||false, imu:e.imu||false}; }); /* [2026-05-28] 트랙 격리: 다른 트랙 데이터 제거 */ var _rejected=PLAYERS.filter(function(p){return !__isMyTrackPlayer(p);}); PLAYERS=PLAYERS.filter(__isMyTrackPlayer); if(_rejected.length){ var _names=_rejected.map(function(p){return p.name+'('+__otherTrackOf(p)+')';}).join(', '); try{ var _m=document.getElementById('msg'); if(_m){ _m.innerHTML='<span style="color:#e8954e">'+_rejected.length+'명 데이터는 다른 트랙용이라 무시됨 ['+_names+']. 이 대시보드는 '+__trackLabel()+' 전용입니다.</span>'; } }catch(e){} console.warn('['+__trackLabel()+' 트랙] 다른 트랙 데이터 '+_rejected.length+'명 거부:', _names); }
     if(!PLAYERS.length){ msg.innerHTML='<span style="color:#cf6f6c">zip 에서 c3d 파일을 찾지 못했습니다</span>'; return; }
     msg.textContent=PLAYERS.length+'명 로드됨 — 리포트 열기 버튼을 누르세요'; buildAllData(showList);
 }
 fileEl.addEventListener('change',function(e){ var fs=e.target.files; if(!fs||!fs.length)return; if(fs.length===1) handle(fs[0]); else handleCsvFiles(fs); });
 if(fitfileEl)fitfileEl.addEventListener('change',function(e){ if(e.target.files&&e.target.files.length) handleFitness(e.target.files); });
 var cohortEl=document.getElementById('cohortfile'); if(cohortEl) cohortEl.addEventListener('change',function(e){ var f=e.target.files&&e.target.files[0]; if(f){ _UPLOAD_GROUP='cohort'; var cm=document.getElementById('cohortmsg'); if(cm)cm.textContent='코호트 분석 중… (상동고와 분리 저장)'; handle(f); } });
 ['dragenter','dragover'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();drop.classList.add('over');});});
 ['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();drop.classList.remove('over');});});
 drop.addEventListener('drop',function(e){ var fs=e.dataTransfer.files; if(!fs||!fs.length)return; if(fs.length===1) handle(fs[0]); else handleCsvFiles(fs); });
 // [2026-06-18] 코호트 영역도 드래그앤드롭 지원(메인과 동일·_UPLOAD_GROUP='cohort'로 분리 저장)
 (function(){ var cdrop=document.getElementById('cohortrow'); if(!cdrop)return; ['dragenter','dragover'].forEach(function(ev){cdrop.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();cdrop.classList.add('over');});}); ['dragleave','drop'].forEach(function(ev){cdrop.addEventListener(ev,function(e){e.preventDefault();e.stopPropagation();cdrop.classList.remove('over');});}); cdrop.addEventListener('drop',function(e){ var fs=e.dataTransfer.files; if(!fs||!fs.length)return; _UPLOAD_GROUP='cohort'; var cm=document.getElementById('cohortmsg'); if(cm)cm.textContent='코호트 분석 중… (일반과 분리 저장)'; if(fs.length===1) handle(fs[0]); else handleCsvFiles(fs); }); })();
 // [2026-07-04] 빌드 식별 + 실시간 힙 HUD — "지금 어느 빌드가 라이브인가 / 메모리가 얼마나 오르는가"를 화면 좌하단에서 즉시 확인(진단·근본대응 수단).
 var __BM_BUILD='__BUILD_VER__';  // build.py가 빌드시각(BUILD_VER)으로 치환 → 캐시로 옛 빌드를 보고 있으면 여기 시각으로 바로 판별
 (function _bmBuildHUD(){ try{ if(document.getElementById('bm-build-hud'))return; var d=document.createElement('div'); d.id='bm-build-hud';
   d.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#93a6bd;background:rgba(18,24,34,.85);border:1px solid #2a3648;border-radius:6px;padding:3px 8px;pointer-events:none;white-space:nowrap';
   d.textContent=__BM_BUILD;
   (document.body||document.documentElement).appendChild(d);
   function upd(){ try{ var m=window.performance&&performance.memory; d.textContent=__BM_BUILD+(m?(' · 힙 '+Math.round(m.usedJSHeapSize/1048576)+'MB'):''); }catch(_){} }
   upd(); setInterval(upd,2000);
 }catch(e){} })();
 try{ loadSavedPlayers(); }catch(e){}
 try{ cloudBoot(); }catch(e){}
 // ── [개발용 자동 로드] localhost 에서 주소에 ?auto=파일명.zip 이 있으면 그 zip 을 자동으로 가져와 새로 분석(수정사항 즉시 확인). 파일명 생략 시 홍주환_3구.zip. 실배포(netlify)는 호스트가 달라 동작하지 않음. ──
 (function(){ try{
   var H=location.hostname; if(H!=='localhost'&&H!=='127.0.0.1'&&H!=='') return;
   var qs=new URLSearchParams(location.search); if(!qs.has('auto')&&!qs.has('dev')) return;
   var fn=qs.get('auto')||qs.get('dev'); if(!fn||fn==='1'||fn==='true') fn='홍주환_3구.zip';
   msg.textContent='[개발] '+fn+' 자동 분석 중…';
   fetch(encodeURIComponent(fn)).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); })
     .then(function(b){ handle(new File([b],fn,{type:'application/zip'})); })
     .catch(function(e){ msg.innerHTML='<span style="color:#cf6f6c">[개발] 자동 로드 실패: '+(e.message||e)+' — 파일이 폴더에 있는지 확인</span>'; });
 }catch(e){} })();
})();
