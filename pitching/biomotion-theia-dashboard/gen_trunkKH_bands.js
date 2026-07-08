/* gen_trunkKH_bands.js — 엘리트 코호트(Normative_data)로 니하이 몸통 기울기 규준(p25/med/p75) 산출.
 *   trunkKH_fwd = Trunk_Angle_X[i_kl_peak]  (앞뒤·시상면 기울기, 거울 불변 → 원시 풀링)
 *   trunkKH_lat = Trunk_Angle_Y[i_kl_peak]  (좌우·관상면 기울기)
 * KU 베이크(_ku_theia_bake/2_bake_finalize.js)의 trunkKH_fwd/lat 정의와 동일. gen_rot_norms.js와 동일 엔진.
 *
 * 실행(엘리트 원자료가 읽히는 PC에서):
 *   node gen_trunkKH_bands.js                 # 기본: ./Normative_data
 *   node gen_trunkKH_bands.js /경로/Normative_data
 * 가정 구조: <Normative_data>/<이름>/{meta.json, theia/*.txt}
 * 출력: 콘솔 표 + 좌/우투 부호 진단 + trunkKH_norms_output.json.
 *   → pitch_norms.js(N) + korea/index.html(NORM_BANDS) 에 반영해 밴드(위치·범위형) 표시.
 *
 * [부호 검증 2026-07-07] L·R 원시 Trunk_Angle_Y 평균이 같은 부호대로 겹침(거울대칭 아님)
 *   → 파이프라인이 손잡이 정합 좌표 제공 → 원시 풀링이 정답(부호 정규화 불필요, L*-1 하면 오히려 어긋남).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const HERE = __dirname, SRC = path.join(HERE, 'src');
const CANDS = [process.argv[2], process.env.BPR_NORM_DIR, path.join(HERE, 'Normative_data'), path.join(HERE, '..', '..', 'Normative_data')].filter(Boolean);
const COH = CANDS.find(p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } });
if (!COH) { console.error('[중단] Normative_data 폴더를 못 찾음. 경로 인자로 지정: node gen_trunkKH_bands.js /경로/Normative_data'); process.exit(1); }
console.log('[엘리트 코호트] ' + COH);

const MODS = ['tuning_models.js', 'pitch_norms.js', 'mech6.js', 'parse_c3dtxt.js', 'extract_theia.js', 'extract_rapsodo.js', 'biomotion.js', 'command.js', 'injury_scoring.js', 'energy.js', 'player_report.js', 'phases.js', 'zip_reader.js', 'etdiag.js'];
const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, Float64Array, Int32Array, Uint8Array, Promise, setTimeout };
sb.self = sb; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
MODS.forEach(r => { try { vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', r), 'utf8'), sb, { filename: r }); } catch (e) {} });
const { extractTheia, parseC3DTxt } = sb;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
function quantile(arr, q) { const a = arr.slice().sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); }

const rows = [];
fs.readdirSync(COH).forEach(name => {
  const dir = path.join(COH, name), mp = path.join(dir, 'meta.json');
  if (!fs.existsSync(mp)) return;
  const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const td = path.join(dir, 'theia'); if (!fs.existsSync(td)) return;
  const files = fs.readdirSync(td).filter(f => /\.txt$/i.test(f)).sort();
  const ap = [], lat = [];
  files.forEach(f => {
    try {
      const tr = extractTheia.extractTrial(parseC3DTxt(fs.readFileSync(path.join(td, f), 'utf8')), { weight_kg: meta.weight_kg, handedness: meta.handedness, delivery: meta.delivery_code });
      const S = tr.series || {}, ikl = tr.events && tr.events.i_kl_peak;
      if (ikl == null) return;
      if (S.Trunk_Angle_X && isFinite(S.Trunk_Angle_X[ikl])) ap.push(S.Trunk_Angle_X[ikl]);
      if (S.Trunk_Angle_Y && isFinite(S.Trunk_Angle_Y[ikl])) lat.push(S.Trunk_Angle_Y[ikl]);
    } catch (e) {}
  });
  if (ap.length || lat.length) rows.push({ name, hand: meta.handedness, apMean: ap.length ? +mean(ap).toFixed(2) : null, latMean: lat.length ? +mean(lat).toFixed(2) : null, nT: files.length });
});

console.log('name\thand\tAP(fwd)\tLAT(raw)\tnTrials');
rows.forEach(r => console.log(`${r.name}\t${r.hand}\t${r.apMean}\t${r.latMean}\t${r.nT}`));

const R = rows.filter(r => r.hand === 'R' && r.latMean != null).map(r => r.latMean);
const L = rows.filter(r => r.hand === 'L' && r.latMean != null).map(r => r.latMean);
console.log('\n=== LAT 좌/우투 부호 진단 (겹치면 원시 풀링 정답) ===');
console.log('R-hand LAT: mean', R.length ? +mean(R).toFixed(2) : '-', 'n', R.length);
console.log('L-hand LAT: mean', L.length ? +mean(L).toFixed(2) : '-', 'n', L.length);

function band(vals) { return { p25: +quantile(vals, 0.25).toFixed(2), med: +quantile(vals, 0.5).toFixed(2), p75: +quantile(vals, 0.75).toFixed(2), n: vals.length }; }
const out = {
  trunkKH_fwd: band(rows.filter(r => r.apMean != null).map(r => r.apMean)),
  trunkKH_lat: band(rows.filter(r => r.latMean != null).map(r => r.latMean))
};
console.log('\n=== BANDS ===');
console.log('trunkKH_fwd (AP, pooled L+R):', JSON.stringify(out.trunkKH_fwd));
console.log('trunkKH_lat (raw pooled):', JSON.stringify(out.trunkKH_lat));
fs.writeFileSync(path.join(HERE, 'trunkKH_norms_output.json'), JSON.stringify(out, null, 2));
console.log('\n저장: trunkKH_norms_output.json — pitch_norms.js + korea/index.html(NORM_BANDS) 에 반영.');
