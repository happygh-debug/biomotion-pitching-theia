// 미리보기 분석 대시보드 빌더 — 특정 선수의 "분석 리포트" 페이지(report.template.html)를
// 엔진·모듈·DATA로 채워 즉시 열리는 단일 HTML 생성(선수 목록/클릭 불필요).
// 사용: node _분석/scripts/preview_dashboard.js [선수명]
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const PLAYER=process.argv[2]||'서초율';
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','extract_rapsodo.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array,Promise,setTimeout};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));
// ── DATA 조립 ──
const dir=path.join(ROOT,'data',PLAYER),meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));
const sd=path.join(dir,'theia'),files=fs.readdirSync(sd).filter(f=>/\.txt$/i.test(f)).sort(),tr=[];
files.forEach(f=>{try{tr.push({file:f,trial:sb.extractTheia.extractTrial(sb.parseC3DTxt(fs.readFileSync(path.join(sd,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code})});}catch(e){}});
const m={name:meta.name,height_m:meta.height_m,weight_kg:meta.weight_kg,bmi:meta.bmi,handedness:meta.handedness,max_velocity_kmh:meta.ball_speed_max,delivery:meta.delivery_code};
var pitches=null;
try{const cf=fs.readdirSync(dir).find(x=>/\.csv$/i.test(x));if(cf){const pr=sb.extractRapsodo.parse(fs.readFileSync(path.join(dir,cf),'utf8'));pitches=(pr&&pr.pitches)?pr.pitches:(Array.isArray(pr)?pr:null);}}catch(e){}
const d=sb.reportData.assemble(tr,pitches,m,null);const bi=(d.best_trial_index||1)-1;
d.phases=sb.phases.compute(d.trials[bi],m,d.energy_transfer,d.trials,d.command);
d._landing='feedback-view'; // 선수·코치 피드백 탭 기본 착지(GPT·로컬 검토용)
try{if(pitches&&pitches.length){d.velo_summary=sb.reportData.veloSummary(pitches);if(d.velo_summary&&d.velo_summary.max_kmh!=null)d.measured_kmh=d.velo_summary.max_kmh;}}catch(e){}
const DATA_JSON=JSON.stringify(d);
// ── 분석 템플릿 채우기 (셸의 "분석 리포트" 생성과 동일) ──
const R=f=>fs.readFileSync(path.join(SRC,f),'utf8');
const BLOBS={ '__CSS_BLOB__':'report.styles.css', '__JS_BLOB__':'report.engine.js',
  '__NORMS_JS_BLOB__':'modules/pitch_norms.js', '__PLAYER_JS_BLOB__':'modules/player_report.js',
  '__ETDIAG_JS_BLOB__':'modules/etdiag.js', '__MECH6_JS_BLOB__':'modules/mech6.js', '__PHASES_JS_BLOB__':'modules/phases.js',
  '__COACHRX_JS_BLOB__':'modules/load_coaching_prescription.js',
  '__FEEDBACK_JS_BLOB__':'modules/feedback_summary.js',
  '__VARVIS_JS_BLOB__':'modules/variable_visual_registry.js',
  '__VARCOPY_JS_BLOB__':'modules/variable_copy_registry.js',
  '__VAM_JS_BLOB__':'modules/visual_asset_map.js',
  '__P1VIZ_JS_BLOB__':'modules/variable_detail_p1_viz.js',
  '__SKELPLATFORM_JS_BLOB__':'modules/skeleton_overlay_platform.js',
  '__CORE35GROUPS_JS_BLOB__':'modules/core35_variable_groups.js',
  '__STICKVIEW_JS_BLOB__':'modules/stick_view_coords.js',
  '__RIGDRIVER_JS_BLOB__':'modules/rig_driver.js',
  '__SKELVIEW_JS_BLOB__':'modules/anatomical_skeleton_viewer.js',
  '__SKELLEG_JS_BLOB__':'modules/skeleton_pro_renderer_legacy.js',
  '__SKELPRO_JS_BLOB__':'modules/skeleton_pro_renderer.js',
  '__HPA_JS_BLOB__':'lib/hp_assessment.js', '__INJURY_JS_BLOB__':'lib/injury.js', '__SPLITTER_JS_BLOB__':'lib/splitter.js',
  '__THREE_BLOB__':'lib/three.min.js', '__ORBIT_BLOB__':'lib/orbitcontrols.js' };
let html=R('report.template.html');
for(const ph in BLOBS){ html=html.split(ph).join(R(BLOBS[ph])); }
html=html.split('__DATA_BLOB__').join(DATA_JSON);
const velo=(d.velo_summary&&d.velo_summary.max_kmh!=null)?d.velo_summary.max_kmh:(meta.ball_speed_max||'—');
const HDR={ '__PLAYER_NAME_EN__':meta.name_en||'', '__PLAYER_NAME__':meta.name||PLAYER,
  '__HEIGHT__':(meta.height_m!=null?Number(meta.height_m).toFixed(2):'—'),
  '__WEIGHT__':(meta.weight_kg!=null?Number(meta.weight_kg).toFixed(1):'—'),
  '__BMI__':(meta.bmi!=null?meta.bmi:'—'), '__HAND__':(meta.handedness||'—'),
  '__MAX_VELO__':velo, '__N_TRIALS__':files.length,
  '__BUILD_VER__':'미리보기('+PLAYER+') · '+new Date().toISOString().slice(0,16).replace('T',' ') };
for(const ph in HDR){ html=html.split(ph).join(String(HDR[ph])); }
const leftover=html.match(/__[A-Z_]+__/g); if(leftover){ console.error('미치환 잔존:',Array.from(new Set(leftover)).join(',')); }
const outName='미리보기_'+PLAYER+'_분석.html';
const outPaths=[path.join(ROOT,outName)];
if(PLAYER==='서초율'){
  outPaths.push(path.join(ROOT,'preview_seochoyul.html'));
  outPaths.push(path.join(ROOT,'GPT검토_서초율_선수코치피드백.html'));
}
const reviewNote='<!-- GPT검토: 서초율 Theia GRF+파워 내장 · 기본탭=선수·코치 피드백 · 코치모드 기본 -->\n';
outPaths.forEach(p=>fs.writeFileSync(p,reviewNote+html));
console.log('생성: '+outPaths.map(p=>path.basename(p)).join(', ')+' ('+Math.round(html.length/1024)+'KB) · 트라이얼 '+d.trials.length+'/'+files.length+' · velo='+velo+'km/h · 잔존='+(leftover?leftover.length:0));
