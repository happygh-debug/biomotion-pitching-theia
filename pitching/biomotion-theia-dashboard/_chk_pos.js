const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js'];
const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));
const meta=JSON.parse(fs.readFileSync(path.join(ROOT,'data/서초율/meta.json'),'utf8'));
const files=fs.readdirSync(path.join(ROOT,'data/서초율/theia')).filter(x=>/\.txt$/i.test(x)).sort();
let tr=null;for(const f of files){try{tr=sb.extractTheia.extractTrial(sb.parseC3DTxt(fs.readFileSync(path.join(ROOT,'data/서초율/theia',f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code});break;}catch(e){}}
const S=tr.series,e=tr.events,ik=e.i_kl_peak,is=e.i_start,ifc=e.i_fc,dt=tr.meta?tr.meta.dt:0.0033;
const lead='R_KNEE',rear='L_HEEL'; // LHP
function at(k,i){var a=S[k];return (a&&isFinite(a[i]))?a[i]:null;}
console.log('LHP 서초율 · dt='+dt.toFixed(4)+' is='+is+' ik='+ik+' ifc='+ifc);
console.log('PI→KH '+((ik-is)*dt).toFixed(2)+'s · PI→FC '+((ifc-is)*dt).toFixed(2)+'s · KH%(PI~FC)='+Math.round((ik-is)/(ifc-is)*100)+'%');
console.log('R_KNEE @KH  X='+at('R_KNEE_X',ik)+' Y='+at('R_KNEE_Y',ik)+' Z='+at('R_KNEE_Z',ik));
console.log('L_HEEL @KH  X='+at('L_HEEL_X',ik)+' Y='+at('L_HEEL_Y',ik)+' Z='+at('L_HEEL_Z',ik));
console.log('R_KNEE Z @start='+at('R_KNEE_Z',is)+'  @KH='+at('R_KNEE_Z',ik)+'  (키 '+meta.height_m+'m)');
console.log('AP(홈Y) 무릎-뒤꿈치 = '+((at('R_KNEE_Y',ik)-at('L_HEEL_Y',ik))*100).toFixed(1)+'cm | ML(X) = '+((at('R_KNEE_X',ik)-at('L_HEEL_X',ik))*100).toFixed(1)+'cm');
console.log('무릎높이 @KH: 절대 '+(at('R_KNEE_Z',ik)*100).toFixed(1)+'cm ('+Math.round(at('R_KNEE_Z',ik)/meta.height_m*100)+'%키) | 들기(시작대비) '+((at('R_KNEE_Z',ik)-at('R_KNEE_Z',is))*100).toFixed(1)+'cm');
// COM_Velocity_Y 부호로 홈 방향 확인
var cvy=S.COM_Velocity_Y; var mx=0;for(var i=ik;i<ifc&&i<cvy.length;i++)if(isFinite(cvy[i])&&Math.abs(cvy[i])>Math.abs(mx))mx=cvy[i];
console.log('COM_Vel_Y peak(KH~FC) = '+mx.toFixed(2)+' (양수면 +Y=홈방향)');
