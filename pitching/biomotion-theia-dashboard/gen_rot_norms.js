/* gen_rot_norms.js — 엘리트 코호트(Normative_data)로 와인드업 신규 변인(회전 저장 + 선운동) 규준(p25/med/p75) 산출.
 *
 * 실행(엘리트 원자료가 읽히는 PC에서):
 *   node gen_rot_norms.js                  # 기본: ./Normative_data
 *   node gen_rot_norms.js /경로/Normative_data
 *   BPR_NORM_DIR=/경로 node gen_rot_norms.js
 *
 * 가정 구조: <Normative_data>/<이름>/{meta.json, theia/*.txt}
 * 출력: 콘솔 표 + rot_norms_output.json (각 변인 {p25,med,p75,n}).
 *   → 이 JSON을 개발자(클로드)에게 전달하면 pitch_norms.js 에 반영해 밴드(미흡/정상/우수) 평가를 켭니다.
 *
 * 변인(키): 선운동 wuDur·wuHcm·wuHpct·wuKneeAP·wuKneeML / 회전 wuPelClose·wuTrunkClose·wuHSS·wuHSSbuild·wuDriveHipER·wuCoilTq·wuPelVel·wuTrkVel·wuShER
 * 각 선수의 트라이얼 평균(stageStats)을 그 선수 대표값으로, 코호트(선수들) 분포의 p25/med/p75 산출.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HERE = __dirname, SRC = path.join(HERE, 'src');
const CANDS = [process.argv[2], process.env.BPR_NORM_DIR, path.join(HERE, 'Normative_data'), path.join(HERE, '..', '..', 'Normative_data'), path.join(HERE, 'data', '_normative')].filter(Boolean);
const COH = CANDS.find(p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } });
if (!COH) { console.error('[중단] Normative_data 폴더를 못 찾음. 경로 인자로 지정: node gen_rot_norms.js /경로/Normative_data'); process.exit(1); }
console.log('[엘리트 코호트] ' + COH);

const MODS = ['tuning_models.js','pitch_norms.js','mech6.js','parse_c3dtxt.js','extract_theia.js','extract_rapsodo.js','biomotion.js','command.js','injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];
const sb = { console: { log(){}, warn(){}, error(){} }, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, Float64Array, Int32Array, Uint8Array, Promise, setTimeout };
sb.self = sb; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
MODS.forEach(r => { try { vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', r), 'utf8'), sb, { filename: r }); } catch (e) {} });
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
  try { const bi = (d.best_trial_index || 1) - 1; d.phases = phases.compute(d.trials[bi], m, d.energy_transfer, d.trials, d.command); } catch (e) {}
  return d;
}
function quantile(arr, q) { const a = arr.slice().sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); }

const byKey = {};   // key -> [선수대표값...]
const labels = {};
fs.readdirSync(COH).forEach(name => {
  const dir = path.join(COH, name); if (!fs.existsSync(path.join(dir, 'meta.json'))) return;
  let d; try { d = assemble(dir); } catch (e) { console.log('  ✗ ' + name + ' ' + e.message); return; }
  const W = d && d.phases && d.phases.stageStats && d.phases.stageStats.windup;
  if (!W) { console.log('  – ' + name + ' (windup stats 없음)'); return; }
  const all = (W.linear || []).concat(W.rot || []);
  all.forEach(s => { if (s && s.key && s.mean != null && isFinite(s.mean)) { (byKey[s.key] = byKey[s.key] || []).push(s.mean); labels[s.key] = s.label; } });
  console.log('  ✓ ' + name);
});
const out = {};
console.log('\n변인\t\tn\tp25\tmed\tp75');
Object.keys(byKey).forEach(k => { const a = byKey[k]; out[k] = { p25: +quantile(a, 0.25).toFixed(2), med: +quantile(a, 0.5).toFixed(2), p75: +quantile(a, 0.75).toFixed(2), n: a.length }; console.log(k + '\t' + a.length + '\t' + out[k].p25 + '\t' + out[k].med + '\t' + out[k].p75 + '\t(' + (labels[k] || '') + ')'); });
fs.writeFileSync(path.join(HERE, 'rot_norms_output.json'), JSON.stringify(out, null, 2));
console.log('\n저장: rot_norms_output.json — 이 파일을 개발자에게 전달하면 pitch_norms.js 에 반영합니다.');
