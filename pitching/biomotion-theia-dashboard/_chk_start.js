const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=process.cwd(),SRC=path.join(ROOT,'src');
const MODS=['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js'];
const sb={console:{log(){},warn(){},error(){}},Math,JSON,Date,isNaN,isFinite,parseInt,parseFloat,Array,Object,String,Number,Boolean,RegExp,Error,Map,Set,Float64Array,Int32Array,Uint8Array};
sb.self=sb;sb.window=sb;sb.globalThis=sb;vm.createContext(sb);
MODS.forEach(r=>vm.runInContext(fs.readFileSync(path.join(SRC,'modules',r),'utf8'),sb,{filename:r}));
fs.readdirSync(path.join(ROOT,'data')).forEach(nm=>{ const dir=path.join(ROOT,'data',nm); if(!fs.existsSync(path.join(dir,'meta.json')))return;
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));
  const sd=path.join(dir,'theia'); if(!fs.existsSync(sd))return;
  const f=fs.readdirSync(sd).filter(x=>/\.txt$/i.test(x)).sort()[0]; if(!f)return;
  try{ const setup=sb.extractTheia.extractSetup(sb.parseC3DTxt(fs.readFileSync(path.join(sd,f),'utf8')),{weight_kg:meta.weight_kg,handedness:meta.handedness,delivery:meta.delivery_code});
    const e=setup.events, dt=setup.dt;
    console.log(nm.padEnd(8), 'start='+e.i_start, 'KH='+e.i_kl_peak, 'FC='+e.i_fc, 'BR='+e.i_br,
      '| 시작→KH '+(e.i_kl_peak!=null&&e.i_start!=null?((e.i_kl_peak-e.i_start)*dt).toFixed(2)+'s':'–'),
      '| 시작 t='+(e.t_start_s!=null?e.t_start_s.toFixed(2)+'s':'–')+' (창내)');
  }catch(err){ console.log(nm,'ERR',err.message); }
});
