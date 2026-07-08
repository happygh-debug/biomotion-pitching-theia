const fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','extract_rapsodo.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
function extractEngine(src){const ast=acorn.parse(src,{ecmaVersion:'latest'});const out=[];for(const n of ast.body){if(n.type==='FunctionDeclaration')out.push(src.slice(n.start,n.end));else if(n.type==='VariableDeclaration'){const names=n.declarations.map(d=>(d.id&&d.id.name)||'');if(names.indexOf('DATA')>=0||names.indexOf('ETDIAG')>=0)continue;const t=src.slice(n.start,n.end);if(/document|getElementById|localStorage/.test(t))continue;out.push(t.replace(/^(const|let)\b/,'var')+(t.trim().endsWith(';')?'':';'));}}return out.join('\n');}
const stub={style:{},appendChild(){},setAttribute(){},addEventListener(){}};
let kneeHTML='';
function ctx(){const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array,Promise,setTimeout};sb.self=sb;sb.window=sb;sb.globalThis=sb;sb.setPage=function(){};
  sb.document={getElementById:function(id){ if(id==='ed-body-knee'){ return {set innerHTML(v){kneeHTML=v;}, get innerHTML(){return kneeHTML;}}; } return null; },createElement:()=>Object.create(stub),addEventListener(){},querySelector:()=>null};sb.IMG='';
  const TP=new Proxy(function(){},{get:()=>TP,apply:()=>TP,construct:()=>TP});sb.THREE=TP;sb.devicePixelRatio=1;sb.requestAnimationFrame=()=>0;
  vm.createContext(sb);MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));return sb;}
const ENGINE=extractEngine(fs.readFileSync(path.join(SRC,'report.engine.js'),'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(ROOT,'data/김범준/meta.json'),'utf8'));
const A=ctx();const sd=path.join(ROOT,'data/김범준/theia'),files=fs.readdirSync(sd).filter(f=>/\.txt$/i.test(f)).sort(),tr=[];
files.forEach(f=>{try{tr.push({file:f,trial:A.extractTheia.extractTrial(A.parseC3DTxt(fs.readFileSync(path.join(sd,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code})});}catch(e){}});
const m={name:meta.name,height_m:meta.height_m,weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code};
const d=A.reportData.assemble(tr,null,m,null),bi=(d.best_trial_index||1)-1;d.phases=A.phases.compute(d.trials[bi],m,d.energy_transfer,d.trials,d.command);
const sb=ctx();sb.DATA=d;try{sb.ETDIAG=sb.etDiag.compute(d);}catch(e){sb.ETDIAG=null;}
vm.runInContext(ENGINE,sb,{filename:'engine'});
try{ sb.renderEdKnee(); }catch(e){ console.log('renderEdKnee ERROR:', e.message); }
console.log('앞무릎 innerHTML 길이:', kneeHTML.length, '| edc-knee-lr 포함:', kneeHTML.indexOf('edc-knee-lr')>=0, '| 앞다리 꼬기 포함:', kneeHTML.indexOf('앞다리 꼬기')>=0);
