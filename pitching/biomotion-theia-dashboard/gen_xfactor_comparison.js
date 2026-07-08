/* gen_xfactor_comparison.js — segment Z vs global yaw X-factor 비교 감사 (research_only)
 * 실행: node gen_xfactor_comparison.js
 * 출력: ../../outputs/xfactor_definition_comparison.csv
 *       ../../docs/xfactor_definition_comparison.md
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

const HERE = __dirname, SRC = path.join(HERE, 'src'), ROOT = path.join(HERE, '..', '..');
const OUT_CSV = path.join(ROOT, 'outputs', 'xfactor_definition_comparison.csv');
const OUT_MD = path.join(ROOT, 'docs', 'xfactor_definition_comparison.md');
const ELITE_DIR = [process.argv[2], path.join(HERE, 'Normative_data')].find(p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } });
const HS_DIR = path.join(HERE, 'data');

const MODS = ['tuning_models.js', 'pitch_norms.js', 'parse_c3dtxt.js', 'extract_theia.js', 'extract_rapsodo.js', 'biomotion.js', 'command.js', 'injury_scoring.js', 'energy.js', 'player_report.js', 'phases.js', 'zip_reader.js', 'etdiag.js', 'xfactor_research.js'];
const sb = { console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, Float64Array, Int32Array, Uint8Array, Promise, setTimeout };
sb.self = sb; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
MODS.forEach(r => { try { vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', r), 'utf8'), sb, { filename: r }); } catch (e) { console.error('load', r, e.message); } });
const { extractTheia, parseC3DTxt, phases, xfactorResearch } = sb;

function corr(xs, ys) {
  var n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (var i = 0; i < xs.length; i++) {
    var x = xs[i], y = ys[i];
    if (!isFinite(x) || !isFinite(y)) continue;
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  if (n < 3) return null;
  var num = n * sxy - sx * sy, den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  return den ? +(num / den).toFixed(3) : null;
}

function loadPlayer(dir, cohort) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const td = path.join(dir, 'theia');
  if (!fs.existsSync(td)) return [];
  const files = fs.readdirSync(td).filter(f => /\.txt$/i.test(f)).sort();
  const rows = [];
  files.forEach(f => {
    try {
      const trial = extractTheia.extractTrial(parseC3DTxt(fs.readFileSync(path.join(td, f), 'utf8')), {
        weight_kg: meta.weight_kg, handedness: meta.handedness, delivery: meta.delivery_code, height_m: meta.height_m
      });
      const m = { name: meta.name, height_m: meta.height_m, weight_kg: meta.weight_kg, handedness: meta.handedness, delivery: meta.delivery_code };
      const scalars = (function () {
        var met = {};
        try {
          var st = phases.compute(trial, m, null, [trial], null);
          (st.stages || []).forEach(function (stg) {
            (stg.metrics || []).forEach(function (x) { if (x.key) met[x.key] = x.value; });
          });
        } catch (e) { }
        return met;
      })();
      const rx = xfactorResearch.computeResearchMetrics(trial);
      const vel = trial.rapsodo && trial.rapsodo.velocity_kmh;
      rows.push({
        cohort, player: meta.name, file: f, handedness: meta.handedness,
        x_factor_method: trial.x_factor_method || '',
        segmentZ_peak: rx.xFactorSegmentZPeak,
        segmentZ_peak_signed: rx.xFactorSegmentZPeakSigned,
        globalYaw_peak: rx.xFactorGlobalYawPeak,
        globalYaw_peak_signed: rx.xFactorGlobalYawPeakSigned,
        peak_delta_global_minus_seg: (rx.xFactorGlobalYawPeak != null && rx.xFactorSegmentZPeak != null) ? +(rx.xFactorGlobalYawPeak - rx.xFactorSegmentZPeak).toFixed(2) : null,
        segmentZ_peakFromFC_ms: rx.xFactorSegmentZPeakFromFC,
        globalYaw_peakFromFC_ms: rx.xFactorGlobalYawPeakFromFC,
        segmentZ_atFC: rx.xFactorSegmentZAtFC,
        globalYaw_atFC: rx.xFactorGlobalYawAtFC,
        segmentZ_atBR: rx.xFactorSegmentZAtBR,
        globalYaw_atBR: rx.xFactorGlobalYawAtBR,
        segmentZ_unwindV: rx.xFactorSegmentZUnwindV,
        globalYaw_unwindV: rx.xFactorGlobalYawUnwindV,
        segmentZ_releasedPctByFC: rx.xFactorSegmentZReleasedPctByFC,
        velocity_kmh: vel != null ? vel : null,
        trunkME: scalars.trunkME != null ? scalars.trunkME : null,
        armTransferRatio: scalars.armTransferRatio != null ? scalars.armTransferRatio : null,
        xfPeak_phases: scalars.xfPeak != null ? scalars.xfPeak : null
      });
    } catch (e) { /* skip invalid trial */ }
  });
  return rows;
}

const allRows = [];
if (ELITE_DIR) {
  fs.readdirSync(ELITE_DIR).forEach(name => {
    const dir = path.join(ELITE_DIR, name);
    if (!fs.existsSync(path.join(dir, 'meta.json'))) return;
    allRows.push(...loadPlayer(dir, 'elite20'));
  });
}
if (fs.existsSync(HS_DIR)) {
  fs.readdirSync(HS_DIR).forEach(name => {
    const dir = path.join(HS_DIR, name);
    if (!fs.existsSync(path.join(dir, 'meta.json'))) return;
    allRows.push(...loadPlayer(dir, 'hs'));
  });
}

function summarize(cohort) {
  const rows = allRows.filter(r => r.cohort === cohort);
  const seg = rows.map(r => r.segmentZ_peak).filter(isFinite);
  const glob = rows.map(r => r.globalYaw_peak).filter(isFinite);
  const delta = rows.map(r => r.peak_delta_global_minus_seg).filter(isFinite);
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  return { n: rows.length, segMed: med(seg), globMed: med(glob), deltaMed: med(delta), r_seg_glob: corr(seg, glob) };
}

function cohortCorr(rows, xk, yk) {
  return corr(rows.map(r => r[xk]).filter(isFinite).length ? rows.map(r => r[xk]) : [], rows.map(r => r[yk]));
}
function cohortCorr2(rows, xk, yk) {
  var xs = [], ys = [];
  rows.forEach(r => { if (isFinite(r[xk]) && isFinite(r[yk])) { xs.push(r[xk]); ys.push(r[yk]); } });
  return corr(xs, ys);
}

const eliteRows = allRows.filter(r => r.cohort === 'elite20');
const hsRows = allRows.filter(r => r.cohort === 'hs');
const sumE = summarize('elite20');
const sumH = summarize('hs');

const rVelSegE = cohortCorr2(eliteRows, 'segmentZ_peak', 'velocity_kmh');
const rVelGlobE = cohortCorr2(eliteRows, 'globalYaw_peak', 'velocity_kmh');
const rTrunkSegE = cohortCorr2(eliteRows, 'segmentZ_peak', 'trunkME');
const rTrunkGlobE = cohortCorr2(eliteRows, 'globalYaw_peak', 'trunkME');
const rArmSegE = cohortCorr2(eliteRows, 'segmentZ_peak', 'armTransferRatio');
const rArmGlobE = cohortCorr2(eliteRows, 'globalYaw_peak', 'armTransferRatio');

const rVelSegH = cohortCorr2(hsRows, 'segmentZ_peak', 'velocity_kmh');
const rVelGlobH = cohortCorr2(hsRows, 'globalYaw_peak', 'velocity_kmh');

// handedness: mean peak by R/L
function handEffect(rows) {
  var R = rows.filter(r => String(r.handedness).toUpperCase() !== 'L');
  var L = rows.filter(r => String(r.handedness).toUpperCase() === 'L');
  function med(a, k) { var v = a.map(r => r[k]).filter(isFinite).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; }
  return { R_seg: med(R, 'segmentZ_peak'), L_seg: med(L, 'segmentZ_peak'), R_glob: med(R, 'globalYaw_peak'), L_glob: med(L, 'globalYaw_peak'), nR: R.length, nL: L.length };
}
const handE = handEffect(eliteRows);
const handH = handEffect(hsRows);

// CSV
const headers = Object.keys(allRows[0] || {});
const csv = [headers.join(',')].concat(allRows.map(r => headers.map(h => {
  var v = r[h];
  if (v == null) return '';
  var s = String(v);
  return s.indexOf(',') >= 0 ? '"' + s + '"' : s;
}).join(','))).join('\n');
fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
fs.writeFileSync(OUT_CSV, csv);

const md = `# X-Factor 정의 비교 감사 (segment Z vs global yaw)

생성: \`node gen_xfactor_comparison.js\` · ${new Date().toISOString().slice(0, 10)}

## 요약

| 코호트 | n(trial) | segmentZ peak med | globalYaw peak med | Δ(global−seg) med | r(seg,glob) |
|--------|----------|-------------------|--------------------|--------------------|-------------|
| elite20 | ${sumE.n} | ${sumE.segMed}° | ${sumE.globMed}° | ${sumE.deltaMed}° | ${sumE.r_seg_glob} |
| 상동고(data/) | ${sumH.n} | ${sumH.segMed}° | ${sumH.globMed}° | ${sumH.deltaMed}° | ${sumH.r_seg_glob} |

**현행 SSOT** = segment Z (\`trial.x_factor\`). **global yaw** = research_only 병렬(\`xfactor_research.js\`).

## 상관 (elite20)

| 쌍 | r |
|----|---|
| segmentZ peak ↔ velocity | ${rVelSegE} |
| globalYaw peak ↔ velocity | ${rVelGlobE} |
| segmentZ peak ↔ trunkME | ${rTrunkSegE} |
| globalYaw peak ↔ trunkME | ${rTrunkGlobE} |
| segmentZ peak ↔ armTransferRatio | ${rArmSegE} |
| globalYaw peak ↔ armTransferRatio | ${rArmGlobE} |

## 상관 (상동고)

| 쌍 | r |
|----|---|
| segmentZ peak ↔ velocity | ${rVelSegH} |
| globalYaw peak ↔ velocity | ${rVelGlobH} |

## handedness (peak median, °)

| 코호트 | R segmentZ | L segmentZ | R globalYaw | L globalYaw | nR / nL |
|--------|------------|------------|-------------|-------------|---------|
| elite20 | ${handE.R_seg} | ${handE.L_seg} | ${handE.R_glob} | ${handE.L_glob} | ${handE.nR} / ${handE.nL} |
| hs | ${handH.R_seg} | ${handH.L_seg} | ${handH.R_glob} | ${handH.L_glob} | ${handH.nR} / ${handH.nL} |

현행 코드: **R/L 부호 보정 없음** · peak = max \|값\| · 자세: [\`docs/xfactor_handedness_policy.md\`](xfactor_handedness_policy.md)

## 비교 항목 (trial 단위)

- segmentZ peak / globalYaw peak
- peak timing (FC 기준 ms)
- FC·BR 시점 값
- unwind amount(ReleasedPctByFC) · unwind velocity
- handedness · velocity·trunkME·armTransferRatio 상관

원시 데이터: [\`outputs/xfactor_definition_comparison.csv\`](../outputs/xfactor_definition_comparison.csv)

## 정책

- **score·feedback·xfPeak SSOT 변경 없음**
- global yaw는 research audit 전용
- PITCH_NORMS(med 28.0°) = segment Z 기준 유지

`;

fs.writeFileSync(OUT_MD, md);
console.log('trials:', allRows.length);
console.log('elite20:', sumE.n, 'hs:', sumH.n);
console.log('CSV:', OUT_CSV);
console.log('MD:', OUT_MD);
