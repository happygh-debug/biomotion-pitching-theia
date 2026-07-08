/* verify_render.js — Theia 대시보드 "렌더 종단 검증" (영구 도구)
 *
 * 목적: report.engine.js의 온라인 렌더 경로까지 포함해, 4개 출력처를 전 선수로 실제 렌더·검증한다.
 *   ① 온라인 메카닉 요약(_bodyMapHTML)   ② 세부 6단계 변인 점수(_efDetailScores)
 *   ③ 선수 PDF(playerReport.buildPlayerHTML)   ④ 팀 리포트(zipReader.summarize/buildTeamHTML)
 *   + 6단계 점수가 온라인 = PDF = 팀 = mech6 단일소스로 모두 일치하는지 교차검증.
 *
 * 왜 만들었나: 그동안 검증할 때마다 report.engine.js에서 함수를 "골라서" 추출하다 헬퍼를
 *   하나씩 빠뜨려(_efJosa/_efSub/_efSt/_BM_W ...) 같은 누락 에러가 반복됐다. 이 도구는
 *   "최상위 함수·선언을 통째로" 자동 추출하므로 추출 누락이 구조적으로 불가능하다.
 *   → 다음부터 검증은 한 줄: BPR_ROOT=$(pwd) node _분석/scripts/verify_render.js
 *
 * 종료코드: 모두 통과 0 / 하나라도 실패 1 (CI·배포 게이트로 사용 가능)
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.BPR_ROOT || process.cwd();
const SRC = path.join(ROOT, 'src');
// 측정 시스템 자동 감지(폴더명 기준) — Theia / IMU / Uplift 어디서 실행해도 같은 한 파일이 동작한다.
const SYSTEM = /imu/i.test(path.basename(ROOT)) ? 'imu' : /uplift/i.test(path.basename(ROOT)) ? 'uplift' : 'theia';
// 모듈 슈퍼셋(세 시스템 공용 로드 — 사용 안 하는 extract는 무해)
const MODS = ['tuning_models.js','pitch_norms.js','mech5.js','mech6.js','parse_c3dtxt.js','extract_theia.js',
  'extract_uplift.js','extract_imu.js','extract_rapsodo.js','biomotion.js','command.js',
  'injury_scoring.js','energy.js','player_report.js','phases.js','zip_reader.js','etdiag.js'];

// ── report.engine.js에서 "최상위 함수 정의 + 최상위 var/let/const 선언"을 통째 추출 ──
//    (열 0에서 시작하는 선언만 = 최상위. 3D 초기화 등 최상위 "실행문"은 제외. DOM/DATA/ETDIAG 선언도 제외.)
// ── report.engine.js → 최상위 "함수 정의 + 상태 선언"만 AST로 정확히 추출 ──
//  실제 JS 파서(acorn)로 Program.body를 떠서 FunctionDeclaration / VariableDeclaration 노드만 취한다.
//  → 템플릿 리터럴·정규식·중첩 괄호를 100% 정확히 처리(손수 토크나이저의 누락·오인 불가능).
//  최상위 "실행문"(3D 초기화·이벤트 바인딩 등)과 DATA/ETDIAG/DOM 선언은 제외 — 하네스가 주입한다.
let acorn;
try { acorn = require('acorn'); }
catch (e) {
  try { require('child_process').execSync('npm install acorn --no-save --silent', { cwd: ROOT, stdio: 'ignore' }); acorn = require('acorn'); }
  catch (e2) { console.error('[중단] acorn 파서가 필요합니다:  npm install acorn'); process.exit(2); }
}
function extractEngine(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest' });
  const out = [];
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration') {
      out.push(src.slice(node.start, node.end));
    } else if (node.type === 'VariableDeclaration') {
      const names = node.declarations.map(d => (d.id && d.id.name) || '');
      if (names.indexOf('DATA') >= 0 || names.indexOf('ETDIAG') >= 0) continue; // 하네스가 주입
      const text = src.slice(node.start, node.end);
      if (/document|getElementById|localStorage/.test(text)) continue;          // DOM 접근 제외
      out.push(text.replace(/^(const|let)\b/, 'var') + (text.trim().endsWith(';') ? '' : ';')); // const/let→var (재선언·TDZ 회피)
    }
    // 그 외(ExpressionStatement 등 최상위 실행문)는 의도적으로 제외
  }
  return out.join('\n');
}

// ── 컨텍스트 ──
const stub = { style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} };
function newCtx() {
  const sb = { console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Array, Object,
    String, Number, Boolean, RegExp, Error, Map, Set, Float64Array, Int32Array, Uint8Array,
    Promise, setTimeout, encodeURIComponent, decodeURIComponent };
  sb.self = sb; sb.window = sb; sb.globalThis = sb; sb.setPage = function () {};
  sb.document = { getElementById: () => null, createElement: () => Object.create(stub), addEventListener() {} };
  sb.IMG = '';
  // 3D/브라우저 스텁(최상위 선언이 참조할 수 있음 — 렌더 함수 자체는 사용 안 함)
  const THREEp = new Proxy(function () {}, { get: () => THREEp, apply: () => THREEp, construct: () => THREEp });
  sb.THREE = THREEp; sb.devicePixelRatio = 1; sb.requestAnimationFrame = () => 0;
  vm.createContext(sb);
  MODS.forEach(r => vm.runInContext(fs.readFileSync(path.join(SRC, 'modules', r), 'utf8'), sb, { filename: r }));
  return sb;
}
const ENGINE = extractEngine(fs.readFileSync(path.join(SRC, 'report.engine.js'), 'utf8'));

// 계산용 컨텍스트(데이터 조립) — 시스템별 로딩만 다르고 이후 phases→mech6 경로는 동일
const A = newCtx();
const SUBDIR = { theia: 'theia', imu: 'imu', uplift: 'uplift' }[SYSTEM];
function buildDATA(nm) {
  const dir = path.join(ROOT, 'data', nm), meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const sd = path.join(dir, SUBDIR); if (!fs.existsSync(sd)) return null;
  const m = { name: meta.name, height_m: meta.height_m, weight_kg: meta.weight_kg, bmi: meta.bmi, handedness: meta.handedness, max_velocity_kmh: meta.ball_speed_max || meta.max_velocity_kmh, delivery: meta.delivery_code };
  let d;
  if (SYSTEM === 'theia') {
    const files = fs.readdirSync(sd).filter(f => /\.txt$/i.test(f)).sort(); const tr = [];
    files.forEach(f => { try { tr.push({ file: f, trial: A.extractTheia.extractTrial(A.parseC3DTxt(fs.readFileSync(path.join(sd, f), 'utf8')), { weight_kg: meta.weight_kg, handedness: meta.handedness, delivery: meta.delivery_code }) }); } catch (e) {} });
    if (!tr.length) return null;
    d = A.reportData.assemble(tr, null, m, null);
  } else if (SYSTEM === 'imu') {
    const TILT = meta.plate_tilt_deg != null ? meta.plate_tilt_deg : 4.4;
    const files = fs.readdirSync(sd).filter(f => /\.csv$/i.test(f)).sort(); const tr = [];
    files.forEach(f => { try { tr.push({ file: f, trial: A.extractImu.extractTrial(fs.readFileSync(path.join(sd, f), 'utf8'), { weight_kg: meta.weight_kg, handedness: meta.handedness, name: meta.name, plate_tilt_deg: TILT, height_m: meta.height_m }, f) }); } catch (e) {} });
    if (!tr.length) return null;
    d = A.reportData.assemble(tr, null, m, null);
  } else { // uplift
    const files = fs.readdirSync(sd).filter(f => /\.csv$/i.test(f)).sort(); const tr = [];
    files.forEach(f => { try { tr.push(A.extractUplift.extractTrial(fs.readFileSync(path.join(sd, f), 'utf8'), { weight_kg: meta.weight_kg, height_m: meta.height_m, handedness: meta.handedness, name: meta.name, delivery: meta.delivery_code || null }, f)); } catch (e) {} });
    if (!tr.length) return null;
    d = A.reportData.assembleUplift(tr, null, m, null);
  }
  const bi = (d.best_trial_index || 1) - 1;
  d.phases = A.phases.compute(d.trials[bi], m, (SYSTEM === 'uplift' ? null : d.energy_transfer), d.trials, d.command);
  return d;
}

// ── 검증 ──
const DATADIR = path.join(ROOT, 'data');
if (!fs.existsSync(DATADIR)) { console.log('\n[' + SYSTEM.toUpperCase() + '] data/ 폴더 없음 — 검증할 선수 데이터가 없습니다(정상). 데이터 추가 후 다시 실행하세요.'); process.exit(0); }
const players = fs.readdirSync(DATADIR).filter(n => fs.existsSync(path.join(DATADIR, n, 'meta.json')));
let pass = 0, tot = 0, fails = [], anyNA = false;
console.log('\n[' + SYSTEM.toUpperCase() + ' 렌더 종단 검증] 선수 ' + players.length + '명 · ' + new Date().toISOString().slice(0, 10) + (players.length ? '' : '  (data/ 비어있음 — 데이터 추가 시 검증됨)') + '\n');
players.forEach(nm => {
  tot++;
  const d = buildDATA(nm);
  if (!d) { fails.push(nm + ' (데이터 없음)'); console.log('✗ ' + nm + '  데이터 없음'); return; }
  const sb = newCtx();
  // DATA/ETDIAG를 먼저 주입(엔진 최상위 선언이 DATA를 참조하므로 eval 전에 존재해야 함)
  sb.DATA = d; sb.ETDIAG = (sb.etDiag && typeof sb.etDiag.compute === 'function') ? (function () { try { return sb.etDiag.compute(d); } catch (e) { return null; } })() : null;
  vm.runInContext(ENGINE, sb, { filename: 'engine-extract' });
  const R = {};
  // 새 '메카닉 요약' 기능셋(메카닉요약 재작성 + 세부변인 + _weakSub)은 함께 도입됨 → _efDetailScores 존재로 판별.
  // 미도입 대시보드(현재 imu/uplift)는 온라인·세부를 N/A=미적용으로 처리(실패 아님).
  const hasSummary = (typeof sb._efDetailScores === 'function' && typeof sb._bodyMapHTML === 'function');
  // ① 온라인 메카닉 요약
  if (!hasSummary) { R.on = 'na'; }
  else try { const bm = sb._bodyMapHTML(); R.onBox = (bm.match(/(미흡|정상|우수)</g) || []).length; R.onTop3 = /교정 우선순위 TOP/.test(bm); R.on3ax = /메카닉 3축 진단/.test(bm); R.on = (bm.length > 1000 && R.onBox > 0 && R.on3ax); } catch (e) { R.on = false; R.onErr = e.message; }
  // ② 세부 6단계 변인
  if (!hasSummary) { R.det = 'na'; }
  else try { var dc = 0; ['windup','stride','block','knee','trunk','arm'].forEach(k => { dc += (sb._efDetailScores(k, 'x').match(/(미흡|정상|우수)</g) || []).length; }); R.detN = dc; R.det = dc > 0; } catch (e) { R.det = false; R.detErr = e.message; }
  // ③ 선수 PDF (전 시스템 필수)
  try { const ph = sb.playerReport.buildPlayerHTML(d); R.pdf = !!(ph && ph.length > 5000); } catch (e) { R.pdf = false; R.pdfErr = e.message; }
  // ④ 팀 리포트 (전 시스템 필수)
  try { const sm = sb.teamReport.summarize(d); const html = sb.teamReport.buildTeamHTML([sm], {}); R.team = !!(html && html.length > 1000); } catch (e) { R.team = false; R.teamErr = e.message; }
  // ⑤ 단일소스 교차검증: 온라인 6단계(_eliteStage6) == mech6.stage6 (전 시스템 필수)
  const e6 = sb.mech6.stage6(d), comp = sb.mech6.composite(e6);
  let onlineStages = null;
  try { onlineStages = sb._eliteStage6(); } catch (e) {}
  R.consistent = !!(onlineStages && JSON.stringify(onlineStages) === JSON.stringify(e6));
  // 통과 조건: 필수(PDF·팀·일치) 전부 OK + 선택(온라인·세부)은 OK이거나 미적용(na)
  const okOrNa = v => (v === true || v === 'na');
  const ok = okOrNa(R.on) && okOrNa(R.det) && R.pdf && R.team && R.consistent;
  if (R.on === 'na' || R.det === 'na') anyNA = true;
  if (ok) pass++; else fails.push(nm);
  const fmt = (v, okTxt) => v === 'na' ? 'N/A' : (v ? okTxt : 'FAIL');
  console.log((ok ? '✓' : '✗') + ' ' + nm +
    '  온라인=' + (R.on === 'na' ? 'N/A' : (R.on ? 'OK(' + R.onBox + '박스)' : 'FAIL' + (R.onErr ? ':' + R.onErr : ''))) +
    '  세부=' + (R.det === 'na' ? 'N/A' : (R.det ? R.detN : 'FAIL' + (R.detErr ? ':' + R.detErr : ''))) +
    '  PDF=' + fmt(R.pdf, 'OK') + (R.pdfErr ? ':' + R.pdfErr : '') +
    '  팀=' + fmt(R.team, 'OK') + (R.teamErr ? ':' + R.teamErr : '') +
    '  일치=' + fmt(R.consistent, 'OK'));   // [2026-06-03] 점수제 폐지 → 종합점수 표시 제거(밴드 평가). 일치=단일소스 정합성(내부 불변식)
});
if (anyNA) console.log('  · 온라인/세부 N/A = 이 대시보드엔 메카닉 요약·세부변인 기능 미적용(현재 theia 전용). 필수 항목(PDF·팀·일치)만으로 통과 판정.');
console.log('\n=== ' + pass + '/' + tot + ' 통과 ===' + (fails.length ? ('  실패: ' + fails.join(', ')) : ''));
process.exit(fails.length ? 1 : 0);
