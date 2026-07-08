const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js'];
const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));
const meta=JSON.parse(fs.readFileSync(path.join(ROOT,'data/김범준/meta.json'),'utf8'));
const files=fs.readdirSync(path.join(ROOT,'data/김범준/theia')).filter(x=>/\.txt$/i.test(x)).sort();
let tr=null; for(const f of files){ try{ tr=sb.extractTheia.extractTrial(sb.parseC3DTxt(fs.readFileSync(path.join(ROOT,'data/김범준/theia',f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code}); break; }catch(e){} }
const keys=Object.keys(tr.series||{}), ev=tr.events;
console.log('FP1*:', keys.filter(k=>/^FP1/.test(k)).join(', '));
console.log('FP2*:', keys.filter(k=>/^FP2/.test(k)).join(', '));
console.log('Lead_Knee*:', keys.filter(k=>/^Lead_Knee/.test(k)).join(', '));
function rng(k){var a=tr.series[k];if(!a)return 'none';var lo=1e9,hi=-1e9;for(var i=ev.i_fc;i<=ev.i_br&&i<a.length;i++){if(isFinite(a[i])){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i]);}}return (lo>hi)?'allNaN':lo.toFixed(1)+'~'+hi.toFixed(1);}
console.log('FP1_Z_3:', rng('FP1_Z_3'), '| FP2_Z_3:', rng('FP2_Z_3'), '| Lead_Knee_Angle_Z:', rng('Lead_Knee_Angle_Z'), '| Lead_Hip_Angle_Z:', rng('Lead_Hip_Angle_Z'));
