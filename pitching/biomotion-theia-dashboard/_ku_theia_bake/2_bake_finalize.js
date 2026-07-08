const vm=require("vm"),fs=require("fs"),path=require("path");
const ROOT="/Users/biomotion/Projects/biomotion-platform-pitching";
const MOD=path.join(ROOT,"pitching/biomotion-theia-dashboard/src/modules"), CORE=path.join(ROOT,"pitching/dashboard_core");
const DATAROOT="/private/tmp/ku_theia/data";
const reuse=JSON.parse(fs.readFileSync("/private/tmp/ku_theia/reuse.json","utf8"));
const sb={};sb.self=sb;sb.window=sb;sb.globalThis=sb;sb.console={log:()=>{},error:()=>{},warn:()=>{}};sb.module=undefined;
var _store={}; const mk=()=>({getItem:k=>_store[k]||null,setItem:(k,v)=>{_store[k]=v;},removeItem:k=>{delete _store[k];}});
sb.localStorage=mk();sb.sessionStorage=mk();sb.Math=Math;sb.JSON=JSON;sb.Date=Date;
vm.createContext(sb);
const run=p=>{try{vm.runInContext(fs.readFileSync(p,"utf8"),sb,{filename:p});}catch(e){console.error("load",path.basename(p),e.message);}};
[`${MOD}/tuning_models.js`,`${MOD}/parse_c3dtxt.js`,`${MOD}/extract_theia.js`,`${MOD}/biomotion.js`,`${MOD}/command.js`,`${MOD}/injury_scoring.js`,`${MOD}/energy.js`,`${MOD}/consistency.js`,`${MOD}/zip_reader.js`,`${CORE}/pitch_norms.js`,`${CORE}/mech5.js`,`${CORE}/phases.js`,`${CORE}/etdiag.js`].forEach(run);
run(path.join(ROOT,"netlify_통합배포/pitching/theia/dashboard/데이터/integ01_dynamic_players.js"));
const ET=sb.extractTheia,parseC3D=sb.parseC3DTxt,reportData=sb.reportData,phases=sb.phases;
const storeTheiaAnalysis=sb.BM_INTEG01.storeTheiaAnalysis;
// GRF-derived / force-power keys → 지면반력 없이는 값이 없음. val==null & !scored인 항목은 제거(오해석 방지).
function cleanPhaseData(pd){ const out={}; let removed=0;
  for(const ph of Object.keys(pd)){ out[ph]=(pd[ph]||[]).filter(r=>{
    if(!r) return false;
    const isType=r.typeCard||r.neutral&&(typeof r.val==='string');
    const hasVal=r.val!=null && r.val!=='';
    if(r.scored) return true;              // 채점된 키네마틱 변인 유지
    if(isType) return true;                // 유형카드 유지
    if(hasVal) return true;                 // 값 있는 참고(neutral) 유지
    removed++; return false;                // 값 없고 미채점 = 지면반력 부재 항목 → 제거
  }); }
  return {pd:out, removed};
}
/* [KU-TRANSFORM 2026-07-07] 연구원 검토의견 반영 — KU 전용 phaseData 후처리(공유 phases.js 무변경·격리).
   설계=HANDOVER_연구원반영_설계_260707.md. 교수 확정: rotKEgain 리네임 거부·wuHSS 유지. */
const KU_RENAME = { wuPelCoil:'골반 닫힌 양 (다리 들기~무릎 최고점)', wuTrunkCoil:'몸통 닫힌 양 (다리 들기~무릎 최고점)', whipRatio:'팔 가속 효과', armRotV:'어깨 내회전 속도' };  /* [2026-07-07] 라벨 명확화: armRotV=어깨 관절(Pitching_Shoulder_Ang_Vel_Z) IR속도 — 상완분절(Humerus)과 구분(원본 txt 대조 검증) */
const KU_MOVE = { hipHinge:'drive', leadKneeFlexFC:'block', openAng:'drive', xfPeak:'drive', leanBack:'trunk', xfReleasedPctByFC:'trunk', xfUnwindV:'trunk', armRotV:'arm', humME:'arm', humME_kg:'arm', elbowExtV:'arm', efDeltaHumME:'arm' };
const KU_HIDE = new Set(['windupType','wuDriveHipER','wuShER','efBalanceML','efStoredPE','strideType','hipAbd','comVelFC','trunkLeanChange','driveKneeFlexKF','strideTime','hssBuildKF','pelOpenKF','blockingType','leadKneeFlexionBR','blockRiskPenalty','linRotRatio','efEtaE','efLeadHipHinge','분절 에너지 흐름','seqPct','chainTiming','driveType','trunkRotKE','trunkFlexKE','trunkLatKE','efDeltaTrunkME']);
const KU_DESCORE = new Set(['pelClose','wuPelCloseKH','wuPelCoil','wuTrunkCloseKH','wuTrunkCoil','wuHSS','wuPelVel','wuTrkVel','wuHSSbuild','strideLen']);
function _stridePctFromRaw(txt){ const rows=txt.split('\n').slice(0,6).map(r=>r.split('\t')); if(rows.length<6) return null; const c=rows[1].indexOf('STRIDE_LENGTH_PERCENT'); if(c<0) return null; const v=parseFloat(rows[5][c]); return isFinite(v)?Math.round(v*10)/10:null; }
// 규준 밴드 추출(_NB_BAKED과 동일 소스=integ01) + 렌더와 동일한 z→정규CDF pos 산출.
// stride 정식값 오버라이드 시 pos가 옛(인플레) 값 기준으로 남아 슬라이더 마커가 오배치되는 버그 방지.
const _INTEG_SRC = fs.readFileSync(path.join(ROOT,"netlify_통합배포/pitching/theia/dashboard/데이터/integ01_dynamic_players.js"),"utf8");
function _bandOf(key){ const m=_INTEG_SRC.match(new RegExp(key+'"\\s*:\\s*\\{([^}]*)\\}')); if(!m) return null; const g=k=>{ const mm=m[1].match(new RegExp('"'+k+'"\\s*:\\s*(-?[0-9.]+)')); return mm?parseFloat(mm[1]):null; }; return {p25:g('p25'),p75:g('p75'),med:g('med'),dir:g('dir')}; }
function _posFromBand(val, nb){ if(!(nb&&nb.p25!=null&&nb.p75!=null)||val==null) return null; const med=(nb.med!=null)?nb.med:(nb.p25+nb.p75)/2; const sig=Math.abs(nb.p75-nb.p25)/1.349||1; const z=(val-med)/sig*(nb.dir===-1?-1:1); const t=1/(1+0.2316419*Math.abs(z)), dn=0.3989423*Math.exp(-z*z/2); const p=dn*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return Math.max(1,Math.min(99,Math.round((z>0?1-p:p)*100))); }
const KU_STRIDE_BAND = _bandOf('strideLen') || {p25:88.925,p75:94.325,med:90.85,dir:1};
function _kuPhaseTransform(pd, tr, strideRaw){
  const S=(tr&&tr.series)||{}, ev=(tr&&tr.events)||{}; const ikl=ev.i_kl_peak, ibr=ev.i_br;
  const dt=(tr&&tr.setup&&tr.setup.dt)||(tr&&tr.meta&&tr.meta.dt)||0.004;
  const PH=Object.keys(pd);
  // 1) HIDE
  PH.forEach(ph=>{ pd[ph]=pd[ph].filter(m=>!(m&&((m.key&&KU_HIDE.has(m.key))||(m.name&&KU_HIDE.has(m.name))))); });
  // 2) MOVE (key 유지, phase 재배정)
  const moved={};
  PH.forEach(ph=>{ pd[ph]=pd[ph].filter(m=>{ if(m&&m.key&&KU_MOVE[m.key]){ (moved[KU_MOVE[m.key]]=moved[KU_MOVE[m.key]]||[]).push(m); return false; } return true; }); });
  Object.keys(moved).forEach(t=>{ pd[t]=(pd[t]||[]).concat(moved[t]); });
  // 3) DESCORE (점수화→참고)
  PH.forEach(ph=>pd[ph].forEach(m=>{ if(m&&m.key&&KU_DESCORE.has(m.key)){ m.scored=false; m.neutral=true; m.st=null; } }));
  // 4) RENAME (표시명)
  PH.forEach(ph=>pd[ph].forEach(m=>{ if(m&&m.key&&KU_RENAME[m.key]) m.name=KU_RENAME[m.key]; }));
  // 5) STRIDE 정식값(c3d STRIDE_LENGTH_PERCENT)
  const sp=strideRaw!=null?_stridePctFromRaw(strideRaw):null;
  if(sp!=null) PH.forEach(ph=>pd[ph].forEach(m=>{ if(m&&m.key==='strideLen'){ m.val=sp; m.unit='%'; m.pos=_posFromBand(sp,KU_STRIDE_BAND); } }));
  // 6) NEW — 니하이 몸통 앞뒤/좌우 기울기, 힙힌지 최대 시점. cat=형제 상속(없으면 PhaseTab 렌더 누락).
  const catW=((pd.windup||[]).find(m=>m&&m.cat)||{}).cat||null, catD=((pd.drive||[]).find(m=>m&&m.cat)||{}).cat||null;
  const nW=[], nD=[];
  // [2026-07-07] 밴드=엘리트 n=20(pitch_norms trunkKH_fwd/lat·NORM_BANDS). dir='range'(자세·범위형·판정 안 함·위치만). 드라이브 몸통 조기개방 연관 체크신호는 렌더타임(index.html _kuWindupLinked)에서 phaseData로 판정 — 여기서 baked 플래그 불필요.
  if(ikl!=null&&S.Trunk_Angle_X&&isFinite(S.Trunk_Angle_X[ikl])) nW.push({key:'trunkKH_fwd',name:'니하이 몸통 앞뒤 기울기',val:Math.round(S.Trunk_Angle_X[ikl]*10)/10,unit:'°',scored:false,neutral:true,st:null,dir:'range',cat:catW});
  if(ikl!=null&&S.Trunk_Angle_Y&&isFinite(S.Trunk_Angle_Y[ikl])) nW.push({key:'trunkKH_lat',name:'니하이 몸통 좌우 기울기',val:Math.round(S.Trunk_Angle_Y[ikl]*10)/10,unit:'°',scored:false,neutral:true,st:null,dir:'range',cat:catW});
  if(ikl!=null&&ibr!=null&&S.Back_Hip_Angle_X){ let bI=null,bV=-Infinity; for(let i=ikl;i<=ibr&&i<S.Back_Hip_Angle_X.length;i++){ const v=S.Back_Hip_Angle_X[i]; if(isFinite(v)&&Math.abs(v)>bV){bV=Math.abs(v);bI=i;} } if(bI!=null) nD.push({key:'hipHingePkT',name:'힙힌지 최대 시점 (니하이 기준)',val:Math.round((bI-ikl)*dt*1000),unit:'ms',scored:false,neutral:true,st:null,cat:catD}); }
  if(nW.length) pd.windup=(pd.windup||[]).concat(nW);
  if(nD.length) pd.drive=(pd.drive||[]).concat(nD);
  return pd;
}
const PLAYERS={}, VELO={}, FIT={}; const PLAYER_ORDER=[]; let totRemoved=0;
for(const folder of Object.keys(reuse)){
  const x=reuse[folder], dir=path.join(DATAROOT,folder,"theia");
  const files=fs.readdirSync(dir).filter(f=>/\.txt$/i.test(f)).sort();
  const m={name:x.name,handedness:x.handedness,height_m:x.height_m,weight_kg:x.weight_kg,delivery:"OH",max_velocity_kmh:x.velo,ball_speed_max:x.velo,ball_speed_avg:x.velo};
  const kept=[];
  for(const f of files){ try{ const tr=ET.extractTrial(parseC3D(fs.readFileSync(path.join(dir,f),"utf8")),{weight_kg:m.weight_kg,handedness:m.handedness,delivery:m.delivery}); if(tr)kept.push({trial:tr,file:f}); }catch(e){} }
  if(!kept.length) continue;
  const DATA=reportData.assemble(kept,null,m,null); const bi=(DATA.best_trial_index||1)-1;
  DATA.phases=phases.compute(DATA.trials[bi],m,DATA.energy_transfer,DATA.trials,DATA.command);
  DATA.name=x.name;DATA.hand=m.handedness;DATA.handedness=m.handedness;DATA.group="고려대";DATA.velo=x.velo;
  const full=storeTheiaAnalysis(DATA,{group:"고려대"});
  if(!full||!full.phaseData) continue;
  const {pd,removed}=cleanPhaseData(full.phaseData); totRemoved+=removed;
  /* [KU-TRANSFORM] 연구원 반영 후처리 — 대표 trial(bi) 원문에서 STRIDE_LENGTH_PERCENT + series 기반 신규변인 */
  let strideRaw=null; try{ const rf=(kept[bi]&&kept[bi].file); if(rf) strideRaw=fs.readFileSync(path.join(dir,rf),"utf8"); }catch(e){}
  _kuPhaseTransform(pd, DATA.trials[bi], strideRaw);
  PLAYERS[x.name]={name:x.name,group:"고려대",hand:(m.handedness||"R").toUpperCase().charAt(0),velo:x.velo,n_trials:kept.length,grf_absent:true,phaseData:pd};
  PLAYER_ORDER.push(x.name);
  if(x.velo!=null) VELO[x.name]={avg:x.velo,max:x.velo,hand:PLAYERS[x.name].hand,group:"고려대"};
  // __FITNESS_ASSESS = KU Uplift hp_assessment 재사용(6축 값+점수). Theia __fitCards가 score기반 등급으로 렌더.
  if(x.hp_assessment){ const hp=x.hp_assessment;
    FIT[x.name]={ overall_score:hp.overall_score, axes:(hp.axes||[]).map(a=>({key:a.key,label_kr:a.label_kr,value:a.value,unit:a.unit,score:a.score,elite_target:(a.elite_target!=null?a.elite_target:''),norm_pct:(a.norm_pct!=null?a.norm_pct:null),velo_group:(a.velo_group||'')})), source:'고려대 VALD(0628)' };
  }
}
// 파일 출력
const D=path.join(ROOT,"netlify_통합배포/pitching/theia/korea/데이터"); fs.mkdirSync(D,{recursive:true});
fs.writeFileSync(path.join(D,"players.js"), "window.PLAYERS = "+JSON.stringify(PLAYERS)+";\nwindow.PLAYER_ORDER = "+JSON.stringify(PLAYER_ORDER)+";\n");
fs.writeFileSync(path.join(D,"normative_velo.js"), "window.NORMATIVE_VELO = "+JSON.stringify(VELO)+";\n");
fs.writeFileSync(path.join(D,"fitness.js"), "window.__FITNESS_ASSESS = "+JSON.stringify(FIT)+";\nwindow.RAPSODO = {};\n");
console.log("완료 · PLAYERS "+Object.keys(PLAYERS).length+" · VELO "+Object.keys(VELO).length+" · FIT "+Object.keys(FIT).length+" · 제거된 지면반력항목 총 "+totRemoved);
console.log("PLAYER_ORDER:", PLAYER_ORDER.join(", "));
console.log("players.js:", Math.round(fs.statSync(path.join(D,"players.js")).size/1024)+"KB");
