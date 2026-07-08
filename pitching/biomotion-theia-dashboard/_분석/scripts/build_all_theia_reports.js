/* build_all_player_reports.js  (로컬 실행)
   상동고_20260515/ 안의 모든 HS 선수 폴더를 순회해 선수 리포트 HTML을 생성·저장한다.
   사용: 워크폴더 루트에서
     BPR_ROOT=$(pwd) node _분석/scripts/build_all_player_reports.js [코호트_dir] [출력_dir]
   기본값: 코호트=상동고_20260515  출력=리포트_상동고
*/
const fs=require('fs'),path=require('path'),vm=require('vm');
const {wrap:stampStaticHtml}=require('./html_static_export_stamp.js');
const ROOT=process.env.BPR_ROOT||process.cwd();
const SRC=path.join(ROOT,'src');
const COHORT=process.argv[2]||'상동고_20260515';
const OUTDIR=process.argv[3]||'리포트_상동고';
const cohortDir=path.join(ROOT,COHORT);
const outDir=path.join(ROOT,OUTDIR);
if(!fs.existsSync(cohortDir)){console.error('[중단] 코호트 폴더 없음:',cohortDir);process.exit(1);}
if(!fs.existsSync(outDir))fs.mkdirSync(outDir,{recursive:true});
// 모듈 로드
const sb={console,Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
const L=r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r});
['tuning_models.js','pitch_norms.js','parse_c3dtxt.js','extract_theia.js','biomotion.js','command.js','injury_scoring.js','energy.js','phases.js','zip_reader.js','etdiag.js','player_report.js'].forEach(L);
const {reportData,extractTheia,parseC3DTxt,phases,etDiag,playerReport}=sb;
// CSV + Rapsodo (HS 구속용)
function pc(line){const o=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===','&&!q){o.push(c);c='';}else c+=ch;}o.push(c);return o;}
function rapsodo(dir){try{const csv=fs.readdirSync(dir).find(f=>/\.csv$/i.test(f));if(!csv)return null;const L=fs.readFileSync(path.join(dir,csv),'utf8').split(/\r?\n/);let hi=-1;for(let i=0;i<L.length;i++){if(pc(L[i]).includes('Velocity')){hi=i;break;}}if(hi<0)return null;const H=pc(L[hi]);const vi=H.indexOf('Velocity'),pti=H.indexOf('Pitch Type');const vs=[];for(let i=hi+1;i<L.length;i++){const f=pc(L[i]);if(f.length<=vi)continue;if(pti>=0&&f[pti]&&!/fast/i.test(f[pti]))continue;const v=parseFloat(f[vi]);if(isFinite(v)&&v>50&&v<200)vs.push(v);}if(!vs.length)return null;vs.sort((a,b)=>a-b);return{med:vs[vs.length>>1],max:vs[vs.length-1],n:vs.length};}catch(e){return null;}}
function assemble(dir,velo){
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));
  const td=path.join(dir,'theia'); if(!fs.existsSync(td))return null;
  const files=fs.readdirSync(td).filter(f=>/\.txt$/i.test(f)).sort();
  const tr=[];files.forEach(f=>{try{tr.push({file:f,trial:extractTheia.extractTrial(parseC3DTxt(fs.readFileSync(path.join(td,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code})});}catch(e){}});
  if(!tr.length)return null;
  const m={name:meta.name,height_m:meta.height_m,weight_kg:meta.weight_kg,bmi:meta.bmi,handedness:meta.handedness,max_velocity_kmh:(meta.ball_speed_max||velo),delivery:meta.delivery_code};
  const d=reportData.assemble(tr,null,m,null);
  try{const bi=(d.best_trial_index||1)-1;d.phases=phases.compute(d.trials[bi],m,d.energy_transfer,d.trials,d.command);}catch(e){}
  return d;
}
const t0=Date.now();let ok=0,fail=0;
console.log('\n[일괄 빌드 시작] '+cohortDir+' → '+outDir);
fs.readdirSync(cohortDir).forEach(n=>{
  const dir=path.join(cohortDir,n);if(!fs.existsSync(path.join(dir,'meta.json')))return;
  const rv=rapsodo(dir);const velo=rv?rv.max:null;
  let d;try{d=assemble(dir,velo);}catch(e){console.error(' ✗ '+n+' assemble:',e.message);fail++;return;}
  if(!d){console.error(' ✗ '+n+' 데이터 없음');fail++;return;}
  try{sb.ETDIAG=etDiag.compute(d);sb.DATA=d;}catch(e){console.error(' ✗ '+n+' etDiag:',e.message);fail++;return;}
  let html;try{html=playerReport.buildPlayerHTML(d);}catch(e){console.error(' ✗ '+n+' buildHTML:',e.message);fail++;return;}
  const out=path.join(outDir,n+'_선수리포트.html');
  fs.writeFileSync(out,stampStaticHtml(html));
  console.log(' ✓ '+n+' ('+Math.round(html.length/1024)+'KB)');ok++;
});
console.log('\n완료 — 성공 '+ok+' / 실패 '+fail+' ('+Math.round((Date.now()-t0)/1000)+'초)');
