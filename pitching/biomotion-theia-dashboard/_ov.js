const fs=require('fs'),path=require('path'),vm=require('vm');const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array,Promise,setTimeout};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));
function metric(d,key){var s=d.phases&&d.phases.stages;if(!s)return null;for(var i=0;i<s.length;i++){var ms=s[i].metrics||[];for(var j=0;j<ms.length;j++)if(ms[j].key===key)return ms[j].value;}return null;}
function assemble(dir){var meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));var td=path.join(dir,'theia');if(!fs.existsSync(td))return null;var files=fs.readdirSync(td).filter(f=>/\.txt$/i.test(f)).sort();var tr=[];files.forEach(f=>{try{tr.push({file:f,trial:sb.extractTheia.extractTrial(sb.parseC3DTxt(fs.readFileSync(path.join(td,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code})});}catch(e){}});if(!tr.length)return null;var m={name:meta.name,height_m:meta.height_m,weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code};var d=sb.reportData.assemble(tr,null,m,null);try{var bi=(d.best_trial_index||1)-1;d.phases=sb.phases.compute(d.trials[bi],m,d.energy_transfer,d.trials,d.command);}catch(e){}return d;}
function rotmean(d,key){var R=d.phases&&d.phases.stageStats&&d.phases.stageStats.windup;if(!R)return null;var a=(R.rot||[]).concat(R.linear||[]);for(var i=0;i<a.length;i++)if(a[i]&&a[i].key===key)return a[i].mean;return null;}
function quant(a,q){a=a.filter(x=>x!=null&&isFinite(x)).slice().sort((x,y)=>x-y);if(!a.length)return null;var i=(a.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);}
function corr(x,y){var n=0,sx=0,sy=0,sxy=0,sx2=0,sy2=0;for(var i=0;i<x.length;i++){if(x[i]==null||y[i]==null||!isFinite(x[i])||!isFinite(y[i]))continue;n++;sx+=x[i];sy+=y[i];sxy+=x[i]*y[i];sx2+=x[i]*x[i];sy2+=y[i]*y[i];}if(n<3)return null;var num=n*sxy-sx*sy,den=Math.sqrt((n*sx2-sx*sx)*(n*sy2-sy*sy));return den?num/den:null;}
const COH={elite:process.argv[2],sangdong:process.argv[3]};
const ROTKEYS=['wuPelClose','wuTrunkClose','wuHSS','wuHSSbuild','wuDriveHipER','wuCoilTq','wuPelVel','wuTrkVel','wuShER'];
const pool={wuPelClose:[],pelClose:[],wuCoilTq:[],freeMo:[],wuHSS:[],xfPeak:[]};const med={};
for(const cn in COH){const dir=COH[cn];if(!dir||!fs.existsSync(dir)){console.log(cn+' 경로 없음:'+dir);continue;}const rows={};ROTKEYS.forEach(k=>rows[k]=[]);let np=0;
  fs.readdirSync(dir).forEach(name=>{const pd=path.join(dir,name);if(!fs.existsSync(path.join(pd,'meta.json')))return;let d;try{d=assemble(pd);}catch(e){return;}if(!d)return;np++;
    ROTKEYS.forEach(k=>{var v=rotmean(d,k);if(v!=null)rows[k].push(v);});
    pool.wuPelClose.push(rotmean(d,'wuPelClose'));pool.pelClose.push(metric(d,'pelClose'));pool.wuCoilTq.push(rotmean(d,'wuCoilTq'));pool.freeMo.push(metric(d,'freeMo'));pool.wuHSS.push(rotmean(d,'wuHSS'));pool.xfPeak.push(metric(d,'xfPeak'));});
  med[cn]={};ROTKEYS.forEach(k=>med[cn][k]=quant(rows[k],0.5));
  console.log('\n['+cn+'] n='+np+' 중앙값:');ROTKEYS.forEach(k=>console.log('  '+k+'='+(med[cn][k]!=null?med[cn][k].toFixed(1):'–')));}
console.log('\n=== 방향 판단(엘리트 med vs 상동고 med) ===');
['wuPelVel','wuTrkVel','wuShER','wuHSSbuild'].forEach(k=>{var e=med.elite[k],s=med.sangdong[k];console.log('  '+k+': 엘리트 '+(e!=null?e.toFixed(1):'–')+' / 상동고 '+(s!=null?s.toFixed(1):'–')+' → '+((e!=null&&s!=null)?(e>s?'엘리트↑ ⇒ 클수록 좋음(+1)':'엘리트↓ ⇒ 작을수록 좋음(-1)'):'?'));});
console.log('\n=== 겹침(상관 r) 신규 vs 기존 ===');
console.log('  wuPelClose ~ pelClose:  r='+((corr(pool.wuPelClose,pool.pelClose)||0).toFixed(2)));
console.log('  wuCoilTq   ~ freeMo:    r='+((corr(pool.wuCoilTq,pool.freeMo)||0).toFixed(2)));
console.log('  wuHSS      ~ xfPeak:    r='+((corr(pool.wuHSS,pool.xfPeak)||0).toFixed(2)));
