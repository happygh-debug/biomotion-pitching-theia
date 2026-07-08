const fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
function extractEngine(src){const ast=acorn.parse(src,{ecmaVersion:'latest'});const out=[];for(const node of ast.body){if(node.type==='FunctionDeclaration')out.push(src.slice(node.start,node.end));else if(node.type==='VariableDeclaration'){const names=node.declarations.map(d=>(d.id&&d.id.name)||'');if(names.indexOf('DATA')>=0||names.indexOf('ETDIAG')>=0)continue;const t=src.slice(node.start,node.end);if(/document|getElementById|localStorage/.test(t))continue;out.push(t.replace(/^(const|let)\b/,'var')+(t.trim().endsWith(';')?'':';'));}}return out.join('\n');}
const stub={style:{},appendChild(){},setAttribute(){},addEventListener(){}};
function ctx(){const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array,Promise,setTimeout,encodeURIComponent,decodeURIComponent};sb.self=sb;sb.window=sb;sb.globalThis=sb;sb.setPage=function(){};sb.document={getElementById:()=>null,createElement:()=>Object.create(stub),addEventListener(){}};sb.IMG='';const TP=new Proxy(function(){},{get:()=>TP,apply:()=>TP,construct:()=>TP});sb.THREE=TP;sb.devicePixelRatio=1;sb.requestAnimationFrame=()=>0;vm.createContext(sb);MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));return sb;}
const ENGINE=extractEngine(fs.readFileSync(path.join(SRC,'report.engine.js'),'utf8'));
const A=ctx();
const nm='서초율',dir=path.join(ROOT,'data',nm),meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));
const sd=path.join(dir,'theia'),files=fs.readdirSync(sd).filter(f=>/\.txt$/i.test(f)).sort(),tr=[];
files.forEach(f=>{try{tr.push({file:f,trial:A.extractTheia.extractTrial(A.parseC3DTxt(fs.readFileSync(path.join(sd,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code})});}catch(e){}});
const m={name:meta.name,height_m:meta.height_m,weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code};
const d=A.reportData.assemble(tr,null,m,null),bi=(d.best_trial_index||1)-1;
d.phases=A.phases.compute(d.trials[bi],m,d.energy_transfer,d.trials,d.command);
const sb=ctx();sb.DATA=d;try{sb.ETDIAG=sb.etDiag.compute(d);}catch(e){sb.ETDIAG=null;}
vm.runInContext(ENGINE,sb,{filename:'engine'});
const det=sb.mech6.detail6(d), NB=sb.PITCH_NORMS;
['windup','knee'].forEach(k=>{ console.log('['+k+'] '+JSON.stringify(sb.mech6.bandCounts(det[k],NB)));
  (det[k]||[]).forEach(x=>{ if(x.neutral){console.log('   '+x.key+': 참고'); return;} console.log('   '+x.key+'='+x.value+' → '+sb.mech6.band(x.value,NB[x.key],x.dir)); }); });
const bm=sb._bodyMapHTML();
console.log('\n메카닉요약 점 잔존:', (bm.match(/\d+점/g)||[]).length, ' 밴드단어:', (bm.match(/(미흡|정상|우수)/g)||[]).length);
const wd=sb._efDetailScores('windup','x');
console.log('세부(windup) 점 잔존:', (wd.match(/\d+점/g)||[]).length, ' 밴드단어:', (wd.match(/(미흡|정상|우수)/g)||[]).length);
