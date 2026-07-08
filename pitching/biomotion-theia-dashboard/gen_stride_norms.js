/* gen_stride_norms.js — 엘리트 코호트(Normative_data)로 스트라이드 재구성 변인 규준(p25/med/p75) 산출.
 *  [2026-06-03] 스트라이드 재구성: strideLen 규준 통일 + FC 전환·회전 준비 신규 변인.
 *  각 선수의 trial 평균(stageStats.stride .mean)을 대표값으로, 코호트(선수들) 분포 p25/med/p75.
 *  실행: node gen_stride_norms.js   → stride_norms_output.json
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HERE = __dirname, SRC = path.join(HERE, 'src');
const COH = path.join(HERE, 'Normative_data');
if (!fs.existsSync(COH)) { console.error('[중단] Normative_data 없음'); process.exit(1); }

const MODS = ['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','extract_rapsodo.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
const sb = { console: { log(){}, warn(){}, error(){} }, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, Float64Array, Int32Array, Uint8Array, Promise, setTimeout };
sb.self = sb; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
MODS.forEach(r => { try { vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', r), 'utf8'), sb, { filename: r }); } catch (e) { console.error('load fail', r, e.message); } });
const { reportData, extractTheia, parseC3DTxt, phases } = sb;

function assemble(dir) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const td = path.join(dir, 'theia'); if (!fs.existsSync(td)) return null;
  const files = fs.readdirSync(td).filter(f => /\.txt$/i.test(f)).sort();
  const tr = [];
  files.forEach(f => { try { tr.push({ file: f, trial: extractTheia.extractTrial(parseC3DTxt(fs.readFileSync(path.join(td, f), 'utf8')), { weight_kg: meta.weight_kg, handedness: meta.handedness, delivery: meta.delivery_code }) }); } catch (e) {} });
  if (!tr.length) return null;
  const m = { name: meta.name, height_m: meta.height_m, weight_kg: meta.weight_kg, bmi: meta.bmi, handedness: meta.handedness, max_velocity_kmh: meta.ball_speed_max, delivery: meta.delivery_code };
  const d = reportData.assemble(tr, null, m, null);
  try { const bi = (d.best_trial_index || 1) - 1; d.phases = phases.compute(d.trials[bi], m, d.energy_transfer, d.trials, d.command); } catch (e) { console.error('phases fail', meta.name, e.message); }
  return d;
}
function quantile(arr, q) { const a = arr.slice().sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); }

const byKey = {}, labels = {};
fs.readdirSync(COH).forEach(name => {
  const dir = path.join(COH, name); if (!fs.existsSync(path.join(dir, 'meta.json'))) return;
  let d; try { d = assemble(dir); } catch (e) { console.log('  x ' + name + ' ' + e.message); return; }
  const S = d && d.phases && d.phases.stageStats && d.phases.stageStats.stride;
  if (!S) { console.log('  - ' + name + ' (stride stats 없음)'); return; }
  S.forEach(s => { if (s && s.key && s.mean != null && isFinite(s.mean)) { (byKey[s.key] = byKey[s.key] || []).push(s.mean); labels[s.key] = s.label; } });
  console.log('  ok ' + name);
});
const out = {};
console.log('\nkey\tn\tp25\tmed\tp75\t(label)');
Object.keys(byKey).forEach(k => { const a = byKey[k]; out[k] = { p25: +quantile(a, 0.25).toFixed(2), med: +quantile(a, 0.5).toFixed(2), p75: +quantile(a, 0.75).toFixed(2), n: a.length }; console.log(k + '\t' + a.length + '\t' + out[k].p25 + '\t' + out[k].med + '\t' + out[k].p75 + '\t(' + (labels[k] || '') + ')'); });
fs.writeFileSync(path.join(HERE, 'stride_norms_output.json'), JSON.stringify(out, null, 2));
console.log('\n저장: stride_norms_output.json');
