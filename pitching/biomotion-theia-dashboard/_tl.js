const fs=require('fs'),path=require('path'),vm=require('vm');const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js'];
const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));
function one(base,name){const dir=path.join(base,name);const meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));const td=path.join(dir,'theia');const files=fs.readdirSync(td).filter(f=>/\.txt$/i.test(f)).sort();let tr=null;for(const f of files){try{tr=sb.extractTheia.extractTrial(sb.parseC3DTxt(fs.readFileSync(path.join(td,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code});break;}catch(e){}}if(!tr)return;const S=tr.series,e=tr.events,tx=S.Trunk_Angle_X,bh=S.Back_Hip_Angle_X;
  console.log(name+': TrunkX KH='+(tx&&tx[e.i_kl_peak]!=null?tx[e.i_kl_peak].toFixed(1):'–')+' FC='+(tx&&tx[e.i_fc]!=null?tx[e.i_fc].toFixed(1):'–')+' | BackHipX KH='+(bh&&bh[e.i_kl_peak]!=null?bh[e.i_kl_peak].toFixed(1):'–')+' FC='+(bh&&bh[e.i_fc]!=null?bh[e.i_fc].toFixed(1):'–'));}
one(path.join(ROOT,'data'),'서초율');
['이영하','문서준','홍주환'].forEach(n=>{try{one(path.join(ROOT,'Normative_data'),n);}catch(e){console.log(n,'err');}});
