const fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const {wrap:stampStaticHtml}=require('./html_static_export_stamp.js');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const FITDIR=process.env.FIT_DIR||path.join(ROOT,'data','_fitness');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','extract_rapsodo.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
function extractEngine(src){const ast=acorn.parse(src,{ecmaVersion:'latest'});const out=[];for(const node of ast.body){if(node.type==='FunctionDeclaration')out.push(src.slice(node.start,node.end));else if(node.type==='VariableDeclaration'){const names=node.declarations.map(d=>(d.id&&d.id.name)||'');if(names.indexOf('DATA')>=0||names.indexOf('ETDIAG')>=0)continue;const text=src.slice(node.start,node.end);if(/document|getElementById|localStorage/.test(text))continue;out.push(text.replace(/^(const|let)\b/,'var')+(text.trim().endsWith(';')?'':';'));}}return out.join('\n');}
const stub={style:{},appendChild(){},setAttribute(){},addEventListener(){}};
function newCtx(){const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array,Promise,setTimeout,encodeURIComponent,decodeURIComponent};
  sb.self=sb;sb.window=sb;sb.globalThis=sb;sb.setPage=function(){};sb.document={getElementById:()=>null,createElement:()=>Object.create(stub),addEventListener(){}};sb.IMG='';
  const TP=new Proxy(function(){},{get:()=>TP,apply:()=>TP,construct:()=>TP});sb.THREE=TP;sb.devicePixelRatio=1;sb.requestAnimationFrame=()=>0;
  vm.createContext(sb);MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));return sb;}
const ENGINE=extractEngine(fs.readFileSync(path.join(SRC,'report.engine.js'),'utf8'));
const A=newCtx();
// 체력 1회 로드
let fitBy=null; try{ const rd=k=>{const p=path.join(FITDIR,k+'.csv');return fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;};
  fitBy=A.fitness.loadFitness({hj:rd('HJ'),sj:rd('SJ'),cmj:rd('CMJ'),imtp:rd('IMTP'),grip:rd('Grip')}); }catch(e){console.log('fitness load fail',e.message);}
function rapsodoCsv(dir){const f=fs.readdirSync(dir).find(x=>/\.csv$/i.test(x));return f?fs.readFileSync(path.join(dir,f),'utf8'):null;}
function buildDATA(nm){const dir=path.join(ROOT,'data',nm),meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));
  const sd=path.join(dir,'theia');const files=fs.readdirSync(sd).filter(f=>/\.txt$/i.test(f)).sort();const tr=[];
  files.forEach(f=>{try{tr.push({file:f,trial:A.extractTheia.extractTrial(A.parseC3DTxt(fs.readFileSync(path.join(sd,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code})});}catch(e){}});
  if(!tr.length)return null;
  const m={name:meta.name,height_m:meta.height_m,weight_kg:meta.weight_kg,bmi:meta.bmi,handedness:meta.handedness,max_velocity_kmh:meta.ball_speed_max,delivery:meta.delivery_code};
  const d=A.reportData.assemble(tr,null,m,null);const bi=(d.best_trial_index||1)-1;d.phases=A.phases.compute(d.trials[bi],m,d.energy_transfer,d.trials,d.command);
  // 랩소도 → velo_summary
  try{const cs=rapsodoCsv(dir);if(cs){const pr=A.extractRapsodo.parse(cs);const pit=(pr&&pr.pitches)?pr.pitches:(Array.isArray(pr)?pr:null);if(pit&&pit.length){d.velo_summary=A.reportData.veloSummary(pit);if(d.velo_summary&&d.velo_summary.max_kmh!=null)d.measured_kmh=d.velo_summary.max_kmh;}}}catch(e){console.log(nm+' rapsodo:',e.message);}
  // 체력 → hp_assessment
  try{if(fitBy){const cn=A.fitness.cleanName(meta.name);const hpa=A.fitness.hpAssessment(cn,fitBy);if(hpa)d.hp_assessment=hpa;}}catch(e){console.log(nm+' fitness:',e.message);}
  return d;}
const outDir=path.join(ROOT,'reports');let ok=0;
fs.readdirSync(path.join(ROOT,'data')).forEach(nm=>{const dir=path.join(ROOT,'data',nm);if(!fs.existsSync(path.join(dir,'meta.json')))return;
  const d=buildDATA(nm);if(!d){console.log('✗ '+nm);return;}
  const sb=newCtx();sb.DATA=d;try{sb.ETDIAG=sb.etDiag.compute(d);}catch(e){sb.ETDIAG=null;}
  vm.runInContext(ENGINE,sb,{filename:'engine'});
  let html;try{html=sb.playerReport.buildPlayerHTML(d);}catch(e){console.log('✗ '+nm+' build:',e.message);return;}
  fs.writeFileSync(path.join(outDir,nm+'_선수리포트.html'),stampStaticHtml(html));ok++;
  console.log('  ✓ '+nm+' ('+Math.round(html.length/1024)+'KB) velo='+(d.velo_summary?d.velo_summary.max_kmh+'/'+d.velo_summary.avg_spin+'rpm':'없음')+' 체력='+(d.hp_assessment?d.hp_assessment.overall_score+'점':'없음'));});
console.log('재생성 '+ok+'/5 (report.engine 컨텍스트 포함)');
