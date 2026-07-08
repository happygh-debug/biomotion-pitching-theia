/* build_player_reports_v2_batch.js — offline A/B v2 HTML batch (display metadata · no PITCH_NORMS change)
   Usage (from pitching/biomotion-theia-dashboard):
     node _분석/scripts/build_player_reports_v2_batch.js [data_dir] [out_dir]
   Default: data/ → reports/v2/
*/
const fs = require('fs'), path = require('path'), vm = require('vm');
const { wrap: stampStaticHtml } = require('./html_static_export_stamp.js');
const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DATA_DIR = process.argv[2] || path.join(ROOT, 'data');
const OUT_DIR = process.argv[3] || path.join(ROOT, 'reports', 'v2');
const MODS = [
  'tuning_models.js', 'pitch_norms.js', 'mech6.js', 'parse_c3dtxt.js', 'extract_theia.js',
  'extract_rapsodo.js', 'biomotion.js', 'command.js', 'injury_scoring.js', 'energy.js',
  'phases.js', 'zip_reader.js', 'etdiag.js', 'feedback_summary.js',
  'elite20_band_display_config.js', 'player_report_template_v2.js',
];
function newCtx() {
  const sb = {
    console: { log() {}, warn() {}, error() {} }, Math, JSON, Date, isNaN, isFinite,
    parseInt, parseFloat, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set,
    Float64Array, Int32Array, Uint8Array, Promise, setTimeout,
  };
  sb.self = sb; sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  MODS.forEach(r => vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', r), 'utf8'), sb, { filename: r }));
  return sb;
}
function buildDATA(sb, nm) {
  const dir = path.join(DATA_DIR, nm);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const td = path.join(dir, 'theia');
  const files = fs.readdirSync(td).filter(f => /\.txt$/i.test(f)).sort();
  const tr = [];
  files.forEach(f => {
    try {
      tr.push({
        file: f,
        trial: sb.extractTheia.extractTrial(
          sb.parseC3DTxt(fs.readFileSync(path.join(td, f), 'utf8')),
          { weight_kg: meta.weight_kg, handedness: meta.handedness, delivery: meta.delivery_code }
        ),
      });
    } catch (e) {}
  });
  if (!tr.length) return null;
  const m = {
    name: meta.name, height_m: meta.height_m, weight_kg: meta.weight_kg, bmi: meta.bmi,
    handedness: meta.handedness, max_velocity_kmh: meta.ball_speed_max, delivery: meta.delivery_code,
  };
  const d = sb.reportData.assemble(tr, null, m, null);
  const bi = (d.best_trial_index || 1) - 1;
  d.phases = sb.phases.compute(d.trials[bi], m, d.energy_transfer, d.trials, d.command);
  return d;
}
function buildV2(sb, D, type) {
  const PR = sb.playerReportTemplateV2;
  const FS = sb.feedbackSummary.build(D, sb.etDiag.compute(D));
  const reportType = type === 'B' ? 'B_researcher_explanation' : 'A_summary';
  const data = PR.buildTemplateData(D, FS, {}, reportType, { activeVarKey: '' });
  const html = type === 'B' ? PR.buildReportHTML_B(data) : PR.buildReportHTML_A(data);
  const smoke = PR.copySmoke(html);
  if (!smoke.ok) throw new Error('copy smoke fail: ' + smoke.found.join(','));
  if (type !== 'B' && /결함/.test(html)) throw new Error('A형 결함 라벨');
  return html;
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const sb = newCtx();
let ok = 0, fail = 0;
fs.readdirSync(DATA_DIR).forEach(nm => {
  const dir = path.join(DATA_DIR, nm);
  if (!fs.existsSync(path.join(dir, 'meta.json'))) return;
  let D;
  try { D = buildDATA(sb, nm); } catch (e) { console.log('✗', nm, e.message); fail++; return; }
  if (!D) { console.log('✗', nm, 'no data'); fail++; return; }
  ['A', 'B'].forEach(type => {
    try {
      const html = buildV2(sb, D, type);
      const suffix = type === 'B' ? '_B형_연구원설명.html' : '_A형_선수요약.html';
      const out = path.join(OUT_DIR, nm + suffix);
      fs.writeFileSync(out, stampStaticHtml(html));
      console.log('  ✓', nm, type, Math.round(html.length / 1024) + 'KB');
      ok++;
    } catch (e) {
      console.log('  ✗', nm, type, e.message);
      fail++;
    }
  });
});
console.log('\n완료 v2 batch — 성공', ok, '/ 실패', fail, '→', OUT_DIR);
