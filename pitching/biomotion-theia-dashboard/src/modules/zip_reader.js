// zip_reader.js — 라이브러리 없이 zip 해제 (네이티브 DecompressionStream). 브라우저/Node22+.
// zip_reader.js — 라이브러리 없이 zip 해제 (네이티브 DecompressionStream). 브라우저/Node22+.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.zipReader = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const ab = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(ab);
  }
  // ArrayBuffer → { path: text }
  function _defaultKeep(name){ if(/__MACOSX/.test(name))return false; var base=name.split('/').pop(); if(base.charAt(0)==='.')return false;
    return /c3d/i.test(name) || /\.csv$/i.test(base)
      || /meta\.json$/i.test(name) || /\.xlsx?$/i.test(base); }
  async function unzip(arrayBuffer, keep) {
    keep = keep || _defaultKeep;
    const dv = new DataView(arrayBuffer), bytes = new Uint8Array(arrayBuffer), N = arrayBuffer.byteLength;
    let eocd = -1;
    for (let i = N - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('zip 형식이 아닙니다 (EOCD 없음)');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const entries = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const flag = dv.getUint16(p + 8, true);
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const dec = new TextDecoder((flag & 0x800) ? 'utf-8' : 'utf-8');
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name, method, compSize, lho });
      p += 46 + nameLen + extraLen + commentLen;
    }
    const out = {};
    for (const e of entries) {
      if (e.name.endsWith('/')) continue;
      if (!keep(e.name)) continue;
      const lhNameLen = dv.getUint16(e.lho + 26, true);
      const lhExtraLen = dv.getUint16(e.lho + 28, true);
      const dataStart = e.lho + 30 + lhNameLen + lhExtraLen;
      const comp = bytes.subarray(dataStart, dataStart + e.compSize);
      let raw;
      if (e.method === 0) raw = comp;
      else if (e.method === 8) raw = await inflateRaw(comp);
      else throw new Error('미지원 압축 method=' + e.method + ' (' + e.name + ')');
      out[e.name] = /\.xlsx?$/i.test(e.name) ? raw : new TextDecoder('utf-8').decode(raw);
    }
    return out;
  }
  // { path: text } → { players: [{name, trials:[{file,text}]}] }
  function groupPlayers(files) {
    const byPlayer = {};
    for (const path in files) {
      if (!/c3d/i.test(path)) continue;
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === '__MACOSX' || parts[parts.length - 1].startsWith('.')) continue;
      if (!/c3d|theia|fastball/i.test(parts[parts.length - 1]) && !/\.c3d\.txt$/i.test(path) && parts.length < 2) {
        // 단일 c3d 도 허용 — 위 필터가 너무 빡세면 통과
      }
      let player, file;
      if (parts.length >= 2) { player = parts[parts.length - 2]; file = parts[parts.length - 1]; }
      else { player = '선수'; file = parts[0]; }
      (byPlayer[player] = byPlayer[player] || []).push({ file, text: files[path] });
    }
    const players = Object.keys(byPlayer).sort().map(name => ({
      name, trials: byPlayer[name].sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }))
    }));
    return { players };
  }
  return { unzip, groupPlayers };
});// fitness.js — ForceDecks CSV → HP Assessment (extract_fitness.py 포팅: 5축·overall·예측구속·비대칭)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tuning_models.json'));
  else root.fitness = factory(root.TUNING_MODELS);
})(typeof self !== 'undefined' ? self : this, function (T) {
  const HS = T.HP_AXIS_HS_AVG, PV = T.PREDICTED_VELO, G = 9.80665;
  function cleanName(s) { if (!s) return ''; s = String(s).trim().replace(/^"|"$/g, '').trim(); const m = s.match(/^S\d+\s+(.+)$/); return m ? m[1].trim() : s; }
  function toFloat(v) { if (v == null) return null; if (typeof v === 'number') return v; let s = String(v).trim().replace(/^"|"$/g, ''); if (s === '' || /^(nan|n\/a|na)$/i.test(s)) return null; const m = s.match(/^([\-\d.]+)\s*[RL]?\s*$/); if (m) { const f = parseFloat(m[1]); return isNaN(f) ? null : f; } const f = parseFloat(s); return isNaN(f) ? null : f; }
  function splitCSV(line) { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } } out.push(cur); return out; }
  function readCSV(text) { const lines = text.replace(/^﻿/, '').split(/\r?\n/); if (!lines.length) return []; const header = splitCSV(lines[0]).map(h => h.trim().replace(/^"|"$/g, '')); const rows = []; for (let i = 1; i < lines.length; i++) { if (!lines[i].trim()) continue; const c = splitCSV(lines[i]); if (c.every(v => v === '')) continue; const rec = {}; header.forEach((h, j) => { rec[h] = j < c.length ? c[j] : ''; }); rows.push(rec); } return rows; }
  const G_ = (r, k) => (r[k] !== undefined ? r[k] : null);
  function ext_hj(rows) { const o = {}; rows.forEach(r => { const n = cleanName(r['Name']); if (!n) return; o[n] = { bw_kg: toFloat(r['BW [KG]']), test_date: (r['Date'] || '').trim(), jump_height_cm: toFloat(r['Jump Height (Flight Time) [cm]']), active_stiffness_n_m: toFloat(r['Mean Active Stiffness [N/m]']), mean_peak_power_w: toFloat(r['Mean Peak Power [W]']), rsi_m_s: toFloat(r['Mean RSI (Jump Height/Contact Time) [m/s]']) }; }); return o; }
  function ext_sj(rows) { const o = {}; rows.forEach(r => { const n = cleanName(r['Name']); if (!n) return; o[n] = { bw_kg: toFloat(r['BW [KG]']), test_date: (r['Date'] || '').trim(), jump_height_cm: toFloat(r['Jump Height (Flight Time) [cm]']), peak_power_w: toFloat(r['Peak Power [W]']), peak_power_w_kg: toFloat(r['Peak Power / BM [W/kg]']), concentric_rfd_n_s: toFloat(r['Concentric RFD [N/s]']), rsi_modified_m_s: toFloat(r['RSI-modified [m/s]']), asym_force_pct: toFloat(r['Concentric Mean Force % (Asym) (%)']), asym_rfd_pct: toFloat(r['Concentric RFD % (Asym) (%)']) }; }); return o; }
  function ext_cmj(rows) { const o = {}; rows.forEach(r => { const n = cleanName(r['Name']); if (!n) return; o[n] = { bw_kg: toFloat(r['BW [KG]']), test_date: (r['Date'] || '').trim(), jump_height_cm: toFloat(r['Jump Height (Flight Time) [cm]']), peak_power_w: toFloat(r['Peak Power [W]']), peak_power_w_kg: toFloat(r['Peak Power / BM [W/kg]']), concentric_rfd_n_s: toFloat(r['Concentric RFD [N/s]']), concentric_peak_force_n_kg: toFloat(r['Concentric Peak Force / BM [N/kg]']), rsi_modified_m_s: toFloat(r['RSI-modified [m/s]']), asym_force_pct: toFloat(r['Concentric Peak Force % (Asym) (%)']), asym_rfd_pct: toFloat(r['Concentric RFD % (Asym) (%)']) }; }); return o; }
  function ext_imtp(rows) { const o = {}; rows.forEach(r => { const n = cleanName(r['Name']); if (!n) return; o[n] = { bw_kg: toFloat(r['BW [KG]']), test_date: (r['Date'] || '').trim(), peak_force_n: toFloat(r['Peak Vertical Force [N]']), peak_force_n_kg: toFloat(r['Peak Vertical Force / BM [N/kg]']), rfd_50ms_n_s: toFloat(r['RFD - 50ms [N/s]']), rfd_100ms_n_s: toFloat(r['RFD - 100ms [N/s]']), rfd_150ms_n_s: toFloat(r['RFD - 150ms [N/s]']), rfd_200ms_n_s: toFloat(r['RFD - 200ms [N/s]']), asym_force_pct: toFloat(r['Peak Vertical Force % (Asym) (%)']) }; }); return o; }
  // csvs: {hj, sj, cmj, imtp} 텍스트 → by_player
  function loadFitness(csvs) {
    const by = {};
    [['hj', csvs.hj, ext_hj], ['sj', csvs.sj, ext_sj], ['cmj', csvs.cmj, ext_cmj], ['imtp', csvs.imtp, ext_imtp]].forEach(function (t) {
      if (!t[1]) return; const data = t[2](readCSV(t[1]));
      for (const n in data) { const e = by[n] || (by[n] = {}); e[t[0]] = data[n]; if (data[n].bw_kg != null) e.bw_kg = data[n].bw_kg; if (data[n].test_date) e.test_date = data[n].test_date; }
    });
    // 악력(Grip) — 별도 grip CSV (Name/Name_kor + Grip_Strength/악력/Grip) 또는 기존 CSV의 grip 컬럼
    if (csvs.grip) { readCSV(csvs.grip).forEach(function(r){ const n=cleanName(r['Name']||r['Name_kor']||r['이름']); if(!n)return;
      const g=toFloat(r['Grip_Strength']!=null?r['Grip_Strength']:(r['악력']!=null?r['악력']:(r['Grip']!=null?r['Grip']:r['grip_kg']))); if(g!=null){ const e=by[n]||(by[n]={}); e.grip_kg=g; } }); }
    return by;
  }
  function hpAssessment(name, by) {
    const d = by[name]; if (!d) return null; const bw = d.bw_kg; if (!bw) return null;
    const imtp_n = (d.imtp || {}).peak_force_n, imtp_bm = (d.imtp || {}).peak_force_n_kg,
          sj_bm = (d.sj || {}).peak_power_w_kg, cmj_bm = (d.cmj || {}).peak_power_w_kg, rsi = (d.hj || {}).rsi_m_s, sj_pp = (d.sj || {}).peak_power_w;
    const grip_kg = (d.grip_kg != null ? d.grip_kg : null);
    const hpScore = (v, a) => (v == null || !a) ? null : Math.max(0, Math.min(100, Math.round(v / a * 100)));
    const veloGroup = (v, refs) => v == null ? null : Object.keys(refs).reduce((b, g) => Math.abs(v - refs[g]) < Math.abs(v - refs[b]) ? g : b, Object.keys(refs)[0]);
    /* [2026-06-20] 체력 퍼센타일: Driveline HS 규준(mean+std·HP Assessment PDF) 대비 정규CDF. reactive(RSI) 제외=한국 RSI 평균1.49 vs Driveline2.37(~2.3SD↓)·KR프로토콜 차이 확정 → 점수/밴드(KR기준)만. */
    const _DLHS = { strength:{m:2413,s:508}, rel_strength:{m:3.09,s:0.60,g:9.80665}, power:{m:50,s:8} };
    const _ncdfF = z => { const t = 1/(1+0.2316419*Math.abs(z)), d = 0.3989423*Math.exp(-z*z/2); const p = d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z>0?1-p:p; };
    const _axPctF = (k, v) => { const n = _DLHS[k]; if (!n || v == null || !n.s) return null; const vv = n.g ? v/n.g : v; return Math.max(1, Math.min(99, Math.round(_ncdfF((vv-n.m)/n.s)*100))); };
    const HP6 = [
      ['strength', 'Strength', '최대 힘', 'IMTP Net Peak Force', 'N', 0.18, imtp_n, HS.strength, { '<80': 1900, '80-85': 2400, '85-90': 2750, '90+': 2940 }],
      ['rel_strength', 'Relative Strength', '체중 대비 힘', 'IMTP Peak Force / BM', 'N/kg', 0.18, imtp_bm, HS.rel_strength, { '<80': 24.4, '80-85': 28.1, '85-90': 32.0, '90+': 33.7 }],
      ['power', 'Power', '점프 파워', 'Squat Jump Peak Power / BM', 'W/kg', 0.18, sj_bm, HS.power, { '<80': 40, '80-85': 50, '85-90': 58, '90+': 65 }],
      ['rel_power', 'Relative Power', '체중 대비 파워', 'CMJ Peak Power / BM', 'W/kg', 0.20, cmj_bm, HS.rel_power, { '<80': 38, '80-85': 45, '85-90': 52, '90+': 60 }],
      ['reactive', 'Reactive Strength', '반응성 강도', 'Hop Test RSI (KR 보정)', 'm/s', 0.16, rsi, HS.reactive, { '<80': 1.5, '80-85': 1.8, '85-90': 2.0, '90+': 2.15 }],
    ];
    const axes = HP6.map(function (a) { const key = a[0], value = a[6], hs = a[7], velo = a[8]; const et = velo['90+']; const score = hpScore(value, (et||hs));
      return { key: key, axis: a[1], label_kr: a[2], sub: a[3], unit: a[4], value: value == null ? null : Math.round(value * 100) / 100, score: score, hs_avg: hs, weight: a[5],
        velo_group: veloGroup(value, velo), velo_group_refs: velo, elite_target: et, elite_score: et ? 100 : null, cohort_pct: null, norm_pct: _axPctF(key, value), norm_pct_in_overall: !(_DLHS[key] && _DLHS[key].excl), norm_metric: null, not_measured: value == null }; });
    // 6번째 축: 악력 기반 악력. 코호트(KR 속도군 grip_kg): 미달50/평균55(=100점)/우수60/Elite65. velo_norms.js VELO_GROUP_NORMS.
    var GRIP_REF = { '<80': 50, '80-85': 55, '85-90': 60, '90+': 65 }, GRIP_HS = 55;
    axes.push({ key: 'upper_strength', axis: 'Upper Body Strength', label_kr: '악력', sub: '악력 (Grip Strength)', unit: 'kg',
      value: grip_kg == null ? null : Math.round(grip_kg * 10) / 10, score: hpScore(grip_kg, GRIP_REF['90+']), hs_avg: GRIP_HS, weight: 0.10,
      velo_group: veloGroup(grip_kg, GRIP_REF), velo_group_refs: GRIP_REF, elite_target: GRIP_REF['90+'], elite_score: 100,
      cohort_pct: null, norm_pct: null, norm_metric: null, not_measured: grip_kg == null });
    let wsum = 0, ws = 0; axes.forEach(a => { if (a.score != null && !a.not_measured) { wsum += a.weight; ws += a.score * a.weight; } });
    const overall = wsum > 0 ? Math.round(ws / wsum) : null;
    let _npw = 0, _nps = 0; axes.forEach(a => { if (a.norm_pct != null && a.norm_pct_in_overall && !a.not_measured) { _npw += a.weight; _nps += a.norm_pct * a.weight; } });
    const overall_norm_pct = _npw > 0 ? Math.round(_nps / _npw) : null;
    let pv = null; if (sj_pp != null) pv = Math.round((PV.low_mph + (sj_pp - PV.low_w) * (PV.high_mph - PV.low_mph) / (PV.high_w - PV.low_w)) * 10) / 10;
    const pvk = pv ? Math.round(pv * 1.609 * 10) / 10 : null;
    const asym = [];
    [['cmj', 'asym_force_pct', 'CMJ Force Asym'], ['cmj', 'asym_rfd_pct', 'CMJ RFD Asym'], ['sj', 'asym_force_pct', 'SJ Force Asym'], ['sj', 'asym_rfd_pct', 'SJ RFD Asym'], ['imtp', 'asym_force_pct', 'IMTP Force Asym']].forEach(function (x) {
      const v = (d[x[0]] || {})[x[1]]; if (v != null && Math.abs(v) >= 15) asym.push({ label: x[2], value: v, threshold: 15 }); else if (v != null && Math.abs(v) >= 10) asym.push({ label: x[2], value: v, threshold: 10, note: '주의 (10-15%)' }); });
    return { name: name, bw_kg: Math.round(bw * 10) / 10, bw_lbs: Math.round(bw * 2.2046 * 10) / 10, test_date: d.test_date, axes: axes,
      overall_score: overall, overall_basis: 'dl6_hsavg', overall_norm_pct: overall_norm_pct, overall_cohort_pct: null,
      predicted_velo_mph: pv, predicted_velo_kmh: pvk, asymmetry_flags: asym };
  }
  function loadMasterFitness(text){
    const rows = readCSV(text); const by = {};
    rows.forEach(function(r){
      const n = cleanName(r['Name_kor'] || r['Name_eng'] || r['Name'] || r['이름']); if(!n) return;
      const num = function(k){ return toFloat(r[k]); };
      const e = by[n] || (by[n] = {});
      e.bw_kg = num('Mass'); e.test_date = (r['Test_date']||'').toString().trim();
      e.imtp = { peak_force_n: num('IMTP_Peak Vertical Force [N]'), peak_force_n_kg: num('IMTP_Peak Vertical Force / BM [N/kg]'),
                 rfd_50ms_n_s: num('IMTP_RFD - 50ms [N/s]'), rfd_100ms_n_s: num('IMTP_RFD - 100ms [N/s]'), rfd_150ms_n_s: num('IMTP_RFD - 150ms [N/s]'), rfd_200ms_n_s: num('IMTP_RFD - 200ms [N/s]'),
                 asym_force_pct: num('IMTP_Peak Vertical Force % (Asym) (%)') };
      e.sj = { peak_power_w: num('SJ_Peak Power [W]'), peak_power_w_kg: num('SJ_Peak Power / BM [W/kg]'), jump_height_cm: num('SJ_Jump Height (Flight Time) [cm]'),
               concentric_rfd_n_s: num('SJ_Concentric RFD [N/s]'), rsi_modified_m_s: num('SJ_RSI-modified [m/s]'),
               asym_force_pct: num('SJ_Concentric Mean Force % (Asym) (%)'), asym_rfd_pct: num('SJ_Concentric RFD % (Asym) (%)') };
      e.cmj = { peak_power_w: num('CMJ_Peak Power [W]'), peak_power_w_kg: num('CMJ_Peak Power / BM [W/kg]'), jump_height_cm: num('CMJ_Jump Height (Flight Time) [cm]'),
                concentric_rfd_n_s: num('CMJ_Concentric RFD [N/s]'), concentric_peak_force_n_kg: num('CMJ_Concentric Peak Force / BM [N/kg]'), rsi_modified_m_s: num('CMJ_RSI-modified [m/s]'),
                asym_force_pct: num('CMJ_Concentric Peak Force % (Asym) (%)'), asym_rfd_pct: num('CMJ_Concentric RFD % (Asym) (%)') };
      e.hj = { contact_time_ms: num('HJ_Contact Time [ms]'), jump_height_cm: num('HJ_Jump Height (Flight Time) [cm]'), active_stiffness_n_m: num('HJ_Mean Active Stiffness [N/m]'),
               mean_peak_power_w: num('HJ_Mean Peak Power [W]'), rsi_m_s: num('HJ_Mean RSI (Jump Height/Contact Time) [m/s]') };
      const g = num('Grip_Strength'); if(g!=null) e.grip_kg = g;
    });
    return by;
  }
  return { loadFitness, hpAssessment, cleanName, loadMasterFitness };
});
// reportdata.js — JS 추출 trial들 + rapsodo → DATA 페이로드 (build_report_theia.py payload 조립 포팅)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./tuning_models.json'), require('./biomotion.js'), require('./command.js'), require('./injury.js'), require('./fitness.js'), require('./energy.js'), require('./consistency.js'));
  else root.reportData = factory(root.TUNING_MODELS, root.biomotion, root.command, root.injury, root.fitness, root.energy, root.consistency);
})(typeof self !== 'undefined' ? self : this, function (T, biomotion, command, injury, fitness, energy, consistencyMod) {
  const MODELS = T.BIOMOTION_5_MODELS;
  function idmap() { const o = {}; for (const mk in MODELS) for (const k in MODELS[mk].metrics) o[k] = k; return o; }
  const IDMAP = idmap();
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const pstdev = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
  const r1 = x => x == null ? null : Math.round(x * 10) / 10;
  function veloSummary(pitches) { if (!pitches || !pitches.length) return { max_kmh: null, avg_kmh: null, avg_spin: null, avg_eff: null, spin_dir: null, pitch_types: null, n: 0 };
    const vs = pitches.map(p => p.velocity_kmh).filter(v => v != null); const sp = pitches.map(p => p.total_spin_rpm).filter(v => v != null);
    const ef = pitches.map(p => p.spin_efficiency_pct).filter(v => v != null);
    const dirs = {}; pitches.forEach(p => { if (p.spin_direction_clock) dirs[p.spin_direction_clock] = (dirs[p.spin_direction_clock] || 0) + 1; });
    const dir = Object.keys(dirs).sort((a, b) => dirs[b] - dirs[a])[0] || null;
    const types = {}; pitches.forEach(p => { const t = p.pitch_type || '기타'; types[t] = (types[t] || 0) + 1; });
    // 구질 안정성(투구 간 변동) — 구속/회전수 CV(%), 회전효율 SD. 제구가 아니라 '구질'의 반복성 지표.
    const cv = a => (a.length > 1 && mean(a)) ? Math.round(pstdev(a) / mean(a) * 1000) / 10 : null;
    return { max_kmh: vs.length ? r1(Math.max.apply(null, vs)) : null, avg_kmh: vs.length ? r1(mean(vs)) : null, avg_spin: sp.length ? Math.round(mean(sp)) : null,
      avg_eff: ef.length ? Math.round(mean(ef) * 10) / 10 : null, spin_dir: dir, pitch_types: types, n: pitches.length,
      velo_cv: cv(vs), spin_cv: cv(sp), eff_sd: ef.length > 1 ? r1(pstdev(ef)) : null }; }
  // [Sprint2 PoC] trial 파일명 숫자 ↔ Rapsodo pitch_no — command_good_vs_poor 축용(표현 layer)
  function commandOutcomeBucket(rp) {
    if (!rp) return null;
    if (rp.is_strike === true) return 'good';
    if (rp.is_strike === false) return 'poor';
    return null;
  }
  function trialRapsodoFromPitch(no, rp) {
    if (!rp) return null;
    return {
      pitch_no: no, velocity_kmh: rp.velocity_kmh, total_spin_rpm: rp.total_spin_rpm,
      pitch_type: rp.pitch_type, spin_eff: rp.spin_efficiency_pct, spin_dir: rp.spin_direction_clock,
      is_strike: rp.is_strike, sz_side_in: rp.sz_side_in, sz_height_in: rp.sz_height_in,
      command_outcome: commandOutcomeBucket(rp)
    };
  }

  function _savg(vs){ vs = vs.filter(function(v){return v!=null && isFinite(v);}); return vs.length ? Math.round(mean(vs)*10)/10 : null; }
  function _ssd(vs){ vs = vs.filter(function(v){return v!=null && isFinite(v);}); if (vs.length<2) return 0; var m=mean(vs); return Math.round(Math.sqrt(vs.reduce(function(s,x){return s+(x-m)*(x-m);},0)/vs.length)*10)/10; }
  // 12gu session aggregate (build_report_theia.py session_summary_v2 port) - kinematic sequence tab reads this
  function sessionSummary(trials) {
    var n = trials.length || 1;
    var pelvis=[], trunk=[], arm=[], tpg=[], atg=[], pt=[], ta=[], xf=[], stp=[], stm=[], okc=0;
    trials.forEach(function (t) {
      var k=t.kseq||{}, segs=k.segments||{}, d=k.deltas||{}, g=k.gains||{}, sc=t.scalars||{};
      if (k.sequence_ok) okc++;
      if (segs.pelvis && segs.pelvis.peak_abs) pelvis.push(segs.pelvis.peak_abs);
      if (segs.trunk  && segs.trunk.peak_abs)  trunk.push(segs.trunk.peak_abs);
      if (segs.arm    && segs.arm.peak_abs)    arm.push(segs.arm.peak_abs);
      if (g.trunk_over_pelvis != null) tpg.push(g.trunk_over_pelvis);
      if (g.arm_over_trunk    != null) atg.push(g.arm_over_trunk);
      if (d.pelvis_to_trunk_ms != null) pt.push(d.pelvis_to_trunk_ms);
      if (d.trunk_to_arm_ms    != null) ta.push(d.trunk_to_arm_ms);
      if (sc.x_factor_max != null) xf.push(Math.abs(sc.x_factor_max));
      if (sc.stride_length_pct != null) stp.push(sc.stride_length_pct);
      if (sc.stride_length     != null) stm.push(sc.stride_length);
    });
    return {
      n_pitches: trials.length,
      kseq: {
        sequence_pct_correct: Math.round(100 * okc / n),
        most_common_order: 'Pelvis → Trunk → Arm',
        pelvis_avg: _savg(pelvis), trunk_avg: _savg(trunk), arm_avg: _savg(arm),
        trunk_over_pelvis_gain_avg: _savg(tpg),
        pelvis_to_trunk_ms_avg: _savg(pt),
        trunk_to_arm_ms_avg: _savg(ta),
        arm_over_trunk_gain_avg: _savg(atg)
      },
      x_factor: { max_avg: _savg(xf), max_sd: _ssd(xf) },
      stride: { pct_height_avg: _savg(stp), length_m_avg: _savg(stm) }
    };
  }
  // [2026-06-03 GPT inbox v1·P2] trial 메타 — phases B평균·stageStats는 valid_for_score trial만(전부 제외 시 폴백). effort·스파이크 gate = 후속.
  /** bl1/fm1 meta.json ingestion — PoC · 자동 baseline 생성·점수 반영 없음 */
  function validateBl1(bl) {
    if (!bl || bl.version !== 'bl1') return { ok: false, reason: 'version_not_bl1' };
    if (!bl.session_date || !bl.established_at) return { ok: false, reason: 'missing_date_fields' };
    var hasMechanicsSummary = bl.stages || bl.mech5_summary || bl.mech6_summary;
    if (!hasMechanicsSummary) return { ok: false, reason: 'no_stages_or_mech5' };
    return { ok: true };
  }
  function validateFm1(fm) {
    if (!fm || fm.version !== 'fm1') return { ok: false, reason: 'version_not_fm1' };
    var hasWin = function (w) {
      return w && ((w.trial_indices && w.trial_indices.length) || (w.pitch_nos && w.pitch_nos.length));
    };
    if (!hasWin(fm.fresh_window) && !hasWin(fm.fatigued_window)
      && !(fm.trial_tags && fm.trial_tags.length)) {
      return { ok: false, reason: 'no_fatigue_windows' };
    }
    return { ok: true };
  }
  function ingestConditionMeta(meta) {
    meta = meta || {};
    var audit = { bl1: null, fm1: null, ingested: [] };
    var out = {};
    if (meta.baseline) {
      audit.bl1 = validateBl1(meta.baseline);
      if (audit.bl1.ok) {
        out.baseline = meta.baseline;
        out.storedBaseline = meta.baseline;
        out.baselineEstablished = true;
        audit.ingested.push('baseline');
      }
    } else if (meta.baselineEstablished) {
      out.baselineEstablished = true;
      audit.bl1 = { ok: false, reason: 'flag_only_no_bl1' };
    }
    var fatigue = (meta.session_meta && meta.session_meta.fatigue) || meta.fatigue;
    if (fatigue) {
      audit.fm1 = validateFm1(fatigue);
      if (audit.fm1.ok) {
        out.session_meta = Object.assign({}, meta.session_meta || {}, { fatigue: fatigue });
        audit.ingested.push('fatigue');
      }
    }
    out.condition_meta_ingestion = audit;
    return out;
  }

  function annotateTrialValidity(events) {
    var ev = events || {}, reasons = [];
    var is = ev.i_start, ik = ev.i_kl_peak, ifc = ev.i_fc;
    var im = (ev.i_mer != null && isFinite(ev.i_mer)) ? ev.i_mer : ev.i_mer_erpeak;
    var ibr = ev.i_br;
    function ord(a, b, tag) {
      if (a == null || b == null || !isFinite(a) || !isFinite(b)) { reasons.push(tag + '_missing'); return false; }
      if (!(a < b)) { reasons.push(tag + '_order'); return false; }
      return true;
    }
    var ok = ord(is, ik, 'PI_KH') & ord(ik, ifc, 'KH_FC') & ord(ifc, im, 'FC_MER') & ord(im, ibr, 'MER_BR');
    return {
      valid_trial: true,
      valid_for_display: true,
      valid_for_score: !!ok,
      exclusion_reasons: reasons
    };
  }
  function assemble(playerTrials, pitches, meta, fitnessByPlayer) {
    meta = meta || {}; const handed = meta.handedness || 'R'; const wt = meta.weight_kg || 86;
    const trials = playerTrials.map(function (pt, i) {
      const t = pt.trial; const m = (pt.file.match(/(\d+)/) || [])[1]; const no = m ? parseInt(m) : (i + 1);
      const rp = pitches ? pitches.find(function (p) { return p.pitch_no === no; }) : null;
      var row = {
        meta: { trial_label: 'Trial ' + no, dt: t.setup.dt, fps: Math.round(1 / t.setup.dt), n_frames: t.setup.nFrames, weight_kg: wt, handedness: handed, throw_side: t.throw_side, glove_side: t.glove_side, ground_y_m: t.ground_y_m, viewer_origin_horiz0_m: t.viewer_origin_horiz0_m, viewer_origin_horiz1_m: t.viewer_origin_horiz1_m, axis_up: t.axis_up, horiz_axes: t.horiz_axes },
        events: t.events, times: Array.from({ length: t.setup.nFrames }, function (_, j) { return Math.round(j * t.setup.dt * 1000) / 1000; }),
        frames: t.frames, x_factor: t.x_factor, series: t.series, kseq: t.kseq, grf: t.grf, scalars: t.scalars,
        rapsodo: trialRapsodoFromPitch(no, rp),
        inefficiencies: {}, grf_metrics: t.grf_metrics || {}, fitness: {}, index: i, throwing_wrist_pos_available: t.throwing_wrist_pos_available
      };
      row.validity = annotateTrialValidity(t.events);
      return row;
    });
    var nScore = 0; trials.forEach(function (tr) { if (tr.validity && tr.validity.valid_for_score) nScore++; });
    var trial_validity_summary = { n_trials: trials.length, n_valid_for_score: nScore, n_flagged: trials.length - nScore, policy: 'GPT_v1_event_order_2026-06-03' };
    var _detected = playerTrials.map(function (pt) { return pt.trial.detected_throw_side; }).filter(Boolean);
    var _detSide = null; if (_detected.length) { var _rc = _detected.filter(function (x) { return x === 'right'; }).length; _detSide = _rc >= (_detected.length - _rc) ? 'right' : 'left'; }
    var _declSide = (handed || 'R').toUpperCase().charAt(0) === 'L' ? 'left' : 'right';
    var handedness_check = _detSide ? { declared: _declSide, detected: _detSide, mismatch: _detSide !== _declSide } : null;
    const comps = trials.map(function (t) { return biomotion.diagnose(biomotion.buildInputVector(t), IDMAP, null).composite_score; });
    let bi = 0; for (let i = 1; i < comps.length; i++) if (comps[i] > comps[bi]) bi = i;
    // [2026-06-01 FIX] 실측 구속: 메타 필드명이 ball_speed_max/avg 인데 코드가 max_velocity_kmh(없는 필드)만 봐서
    //   항상 하드코딩 135.6 으로 떨어졌음 → 모든 Theia 선수 구속이 가짜 135.6, 릴리스구속/출력효율 거짓 누수.
    //   규준(AB_NORM.ballV)도 meta.ball_speed_max 기반이므로 동일 필드를 읽고, 없으면 null(가짜 점수 방지).
    const vs = veloSummary(pitches);
    const measured = vs.max_kmh || meta.ball_speed_max || meta.ball_speed_avg || meta.max_velocity_kmh || null;
    const driv = biomotion.diagnose(biomotion.buildInputVector(trials[bi]), IDMAP, measured); driv.input_vector = biomotion.buildInputVector(trials[bi]);
    const cv = comps.length > 1 && mean(comps) ? r1(pstdev(comps) / mean(comps) * 100) : null;
    const cmd = trials.length ? command.compute(pitches, trials, handed) : null;
    const inj = injury.compute(trials, wt * 9.81);
    let hpa = null;
    if (fitnessByPlayer && fitness && (meta.name || '선수')) {
      try { hpa = fitness.hpAssessment(meta.name || '선수', fitnessByPlayer); } catch (e) { hpa = null; }
      if (hpa && hpa.overall_score == null) hpa = null;
    }
    // psummary(선수요약) 첫 탭. 메카닉 평가(biomotion)·증거(ph-*)·레거시(summary/detail)는 제거 — 진단이 자체 시계열·게이지를 인라인 보유(교수 지시 2026-05-27). 에너지흐름·부상(진단기반)만 유지.
    var order = ['feedback-view', 'psummary', 'ed-windup', 'ed-stride', 'ed-blocking', 'ed-knee', 'ed-trunk', 'ed-armball'];
    if (cmd && cmd.mechanicsConsistency) order.push('command');
    if (hpa) order.splice(1, 0, 'hpa');
    var condMeta = ingestConditionMeta(meta);
    return Object.assign({
      version: 'web-port', player: { name: meta.name || '선수', name_en: meta.name_en || '', height_m: meta.height_m || 1.8, weight_kg: wt, bmi: meta.bmi || 0, handedness: handed },
      trials: trials, best_trial_index: bi + 1, measured_kmh: measured, composite_cv: cv,
      biomotion: driv, command: cmd, injury_risk: inj, velo_summary: vs,
      hp_assessment: hpa, handedness_check: handedness_check, session_summary: sessionSummary(trials), trial_validity_summary: trial_validity_summary, energy_transfer: (energy ? energy.energyTransfer(trials) : null), inefficiency_summary: null,
      consistency: (consistencyMod && consistencyMod.compute) ? consistencyMod.compute(trials, { height_m: meta.height_m || 1.8, handedness: handed, weight_kg: wt }) : null,
      tab_config: { order: order,
        sep_after: ['feedback-view', 'ed-armball'], labels: { 'feedback-view': '오늘의 요약', psummary: '메카닉 요약', etdiag: '개요', 'ed-windup': '와인드업', 'ed-xftiming': '몸통 꼬임', 'ed-stride': '드라이브', 'ed-blocking': '블로킹', 'ed-knee': '앞다리 버팀', 'ed-pelvistrunk': '골반→몸통', 'ed-trunk': '몸통', 'ed-trunkarm': '몸통→팔', 'ed-armball': '팔', biomotion: '메카닉 평가', energyflow: '에너지 흐름', command: '제구/일관성', injury: '부상 위험', hpa: '체력 참고', detail: '디테일', summary: '요약', 'ph-windup': '증거① 와인드업', 'ph-drive': '증거② 드라이브', 'ph-blocking': '증거③ 블로킹', 'ph-storage': '증거④ 몸통 (저장)', 'ph-release': '증거⑤ 몸통 (생성)', 'ph-transfer': '증거⑥ 몸통 (전달)', 'ph-consistency': '증거⑦ 반복성·제구', 'ph-balance': '증거⑧ 밸런스' } }
    }, condMeta);
  }
  // ── Uplift 조립 (build_report_uplift.py 포팅 · GRF/키네틱 없음 → grf/injury=null, 프런트가 해당 탭 자동 숨김) ──
  var _UP_INEFF = {sway:'스웨이 (뒤로 빠짐)',hanging_back:'행잉백 (체중 뒤쪽)',closing_front_or_back:'클로징 (어깨/골반 기울음)',flying_open:'너무 일찍 열림 (조기 회전)',late_rise:'레이트 라이즈 (FC 시 손 위치 늦음)',getting_out_in_front:'게팅 아웃 인 프론트 (상체 선행)',knee_collapse:'무릎 콜랩스 (앞무릎 무너짐)',high_hand:'하이 핸드 (MER 시 손 높음)',early_release:'얼리 릴리스 (조기 공 놓기)',forearm_flyout:'포어암 플라이아웃 (팔꿈치 외반 부하)'};
  function _upPeakWin(a,lo,hi){ var b=null,i; for(i=lo;i<=hi&&i<((a||[]).length);i++){var v=a[i]; if(v!=null&&isFinite(v)&&(b==null||Math.abs(v)>Math.abs(b)))b=v;} return b; }
  function _upAt(a,i){ return (a&&i!=null&&i<a.length&&a[i]!=null&&isFinite(a[i]))?a[i]:null; }
  function _upScalars(t, heightM){
    var s=t.series||{}, ev=t.events||{}, u=t.scalars||{}; var fc=ev.i_fc||0, br=ev.i_br||0, kl=ev.i_kl_peak||0;
    var xf=s.Trunk_wrt_Pelvis_Angle_Z||[]; var xfmax=_upPeakWin(xf,kl,br); if(xfmax==null)xfmax=u.max_x_factor;
    var seg=(t.kseq&&t.kseq.segments)||{};
    return { shoulder_er_max:_upPeakWin(s.Pitching_Shoulder_Angle_Z,fc,br), lead_knee_fp:_upAt(s.Lead_Knee_Angle_X,fc), lead_knee_br:_upAt(s.Lead_Knee_Angle_X,br),
      x_factor_max:xfmax, stride_length:(u.stride_length!=null&&heightM)?Math.round(u.stride_length*heightM*1000)/1000:u.stride_length,
      pelvis_rot_velo_peak:(seg.pelvis||{}).peak_abs, trunk_rot_velo_peak:(seg.trunk||{}).peak_abs,
      arm_slot_angle:u.arm_slot_angle, trunk_forward_tilt_at_br:u.trunk_forward_tilt_at_br, trunk_lateral_tilt_at_br:u.trunk_lateral_tilt_at_br };
  }
  function assembleUplift(upTrials, pitches, meta, fitnessByPlayer){
    meta=meta||{}; var handed=meta.handedness||'R'; var wt=meta.weight_kg||86; var ht=meta.height_m||1.8;
    var trials=upTrials.map(function(ut,i){
      var no=i+1; var rp=pitches?pitches.find(function(p){return p.pitch_no===no;}):null;
      return { meta:{ trial_label:ut.trial_label||('Trial '+no), dt:ut.meta.dt, fps:Math.round(ut.meta.fps), n_frames:ut.meta.n_frames, weight_kg:wt, handedness:handed, throw_side:ut.throw_side, glove_side:ut.glove_side, ground_y_m:ut.meta.ground_y_m, axis_up:'Y' },
        events:ut.events, times:ut.times, frames:ut.frames, x_factor:ut.x_factor, series:ut.series, kseq:ut.kseq,
        grf:null, grf_metrics:{}, scalars:_upScalars(ut,ht),
        rapsodo: trialRapsodoFromPitch(no, rp),
        inefficiencies:ut.inefficiencies, trunk_fc:ut.trunk_fc, uplift_extra:ut.uplift_extra, fitness:{}, index:i };
    });
    var bi=0; for(var i=1;i<upTrials.length;i++){ var a=(upTrials[i].events||{}).peak_hand_speed_ms||0, b=(upTrials[bi].events||{}).peak_hand_speed_ms||0; if(a>b)bi=i; }
    var vs=veloSummary(pitches); var measured=vs.max_kmh||meta.ball_speed_max||meta.ball_speed_avg||meta.max_velocity_kmh||null; // [2026-06-01 FIX] 위와 동일(ball_speed_* 필드)
    var cmd=trials.length?command.compute(pitches,trials,handed):null;
    var ks=trials.map(function(t){return t.kseq||{};});
    var seqOk=ks.map(function(k){return k.sequence_ok;});
    var _avg=function(a){a=a.filter(function(v){return v!=null&&isFinite(v);});return a.length?Math.round(mean(a)*10)/10:null;};
    var _sd=function(a){a=a.filter(function(v){return v!=null&&isFinite(v);});return a.length>1?Math.round(pstdev(a)*10)/10:0;};
    var segv=function(s){return ks.map(function(k){return ((k.segments||{})[s]||{}).peak_abs;});};
    var delv=function(f){return ks.map(function(k){return (k.deltas||{})[f];});};
    var gnv=function(f){return ks.map(function(k){return (k.gains||{})[f];});};
    var xfm=trials.map(function(t){return t.scalars.x_factor_max;});
    var strM=trials.map(function(t){return t.scalars.stride_length;});
    var strP=strM.map(function(s){return (s&&ht)?s/ht*100:null;});
    var ieRates={}, iePer={}; Object.keys(_UP_INEFF).forEach(function(k){ var per=upTrials.map(function(t){return !!((t.inefficiencies||{})[k]);}); iePer[k]=per; ieRates[k]={rate_pct:per.length?Math.round(100*per.filter(Boolean).length/per.length):0}; });
    var PHK={wind_up:['sway','hanging_back'],foot_contact:['closing_front_or_back','flying_open','late_rise','getting_out_in_front'],ball_release:['knee_collapse','high_hand','early_release','forearm_flyout']};
    var phaseEff={}; Object.keys(PHK).forEach(function(ph){ var clean=upTrials.filter(function(t){return !PHK[ph].some(function(k){return (t.inefficiencies||{})[k];});}).length; phaseEff[ph]=upTrials.length?Math.round(100*clean/upTrials.length):null; });
    var session_summary={ n_pitches:trials.length,
      kseq:{ sequence_pct_correct:seqOk.length?Math.round(100*seqOk.filter(Boolean).length/seqOk.length):null, most_common_order:'Pelvis → Trunk → Arm',
        pelvis_avg:_avg(segv('pelvis')), trunk_avg:_avg(segv('trunk')), arm_avg:_avg(segv('arm')),
        trunk_over_pelvis_gain_avg:_avg(gnv('trunk_over_pelvis')), pelvis_to_trunk_ms_avg:_avg(delv('pelvis_to_trunk_ms')), trunk_to_arm_ms_avg:_avg(delv('trunk_to_arm_ms')), arm_over_trunk_gain_avg:_avg(gnv('arm_over_trunk')) },
      x_factor:{ max_avg:_avg(xfm), max_sd:_sd(xfm) }, stride:{ pct_height_avg:_avg(strP), length_m_avg:_avg(strM) },
      inefficiency_rates:ieRates, inefficiency_per_pitch:iePer, phase_efficiency_pct:phaseEff };
    var ineff_flags=Object.keys(_UP_INEFF).map(function(k){ var fl=trials.filter(function(t){return (t.inefficiencies||{})[k];}).map(function(t){return t.index+1;}); return {key:k, ko:_UP_INEFF[k], n:fl.length, trials:fl}; });
    var inefficiency_summary={ flags:ineff_flags, n_trials:trials.length };
    var driv=null; try{ driv=biomotion.diagnose(biomotion.buildInputVector(trials[bi]), IDMAP, measured); driv.input_vector=biomotion.buildInputVector(trials[bi]); }catch(e){ driv=null; }
    var hpa=null; if(fitnessByPlayer&&fitness){ var _cands=[meta.name,meta.name_en].filter(Boolean); for(var _ci=0;_ci<_cands.length&&!hpa;_ci++){ try{ var _h=fitness.hpAssessment(_cands[_ci],fitnessByPlayer); if(_h&&_h.overall_score!=null)hpa=_h; }catch(e){} } }
    return { version:'web-port-uplift', system:'Uplift',
      player:{ name:meta.name||'선수', name_en:(meta.name_en||'')+' · Uplift', height_m:ht, weight_kg:wt, bmi:meta.bmi||0, handedness:handed },
      trials:trials, best_trial_index:bi+1, measured_kmh:measured, composite_cv:null,
      biomotion:driv, command:cmd, injury_risk:null, velo_summary:vs, hp_assessment:hpa,
      session_summary:session_summary, inefficiency_summary:inefficiency_summary, energy_transfer:null, uplift_xcheck:null,
      coach_gauge_overrides:{ arm:{ label:'팔 회전 (IMU)', max:2200, elite:null } } };
  }
  return { assemble, assembleUplift, veloSummary, ingestConditionMeta, validateBl1, validateFm1 };
});
// teamreport.js — 전체 투수 현황 코치 리포트 (phases 5단계 메카닉 + 투수 간 비교) v2
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.teamReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // [2026-05-28] 팀 리포트 메카닉 = 개별 리포트와 동일한 5단계 동작(메카닉) 점수 (mech5 SSOT)
  var PH_KEYS=['windup','stride','block','knee','trunk','arm'];
  var PH_SHORT={windup:'와인드업',stride:'드라이브',block:'블로킹',knee:'앞다리 버팀',trunk:'몸통',arm:'팔'};
  var PH_FULL={windup:'와인드업(저장)',stride:'드라이브(전진 에너지)',block:'블로킹(제동·앞무릎)',knee:'앞다리 버팀(블로킹 내·전략·연결)',trunk:'몸통(회전 증폭)',arm:'팔(릴리스)'};
  var CAT6={windup:'store',stride:'gen',block:'transfer',knee:'transfer',trunk:'gen',arm:'transfer'};
  function sCol6(s){ if(s==null)return '#8893a4'; return s>=75?'#2f9e44':(s>=60?'#e8731a':'#c0612b'); }
  function sBg6(s){ if(s==null)return '#eef2f7'; return s>=75?'#e3f6ec':(s>=60?'#fff3e0':'#fbe7dd'); }
  function _f(v,d){ d=(d==null?1:d); if(v==null||(typeof v==='number'&&!isFinite(v)))return '—'; return typeof v==='number'?v.toFixed(d):String(v); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function mean(a){ a=a.filter(function(x){return x!=null&&isFinite(x);}); return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null; }
  function sCol(s){ if(s==null)return '#8893a4'; return s>=67?'#2f9e44':(s>=33?'#1f6feb':'#c0612b'); }
  function sBg(s){ if(s==null)return '#eef2f7'; return s>=67?'#e3f6ec':(s>=33?'#e7f0ff':'#fbe7dd'); }
  function cntChip(c){ if(!c)return ''; return '<span style="font-size:11px;white-space:nowrap"><b style="color:#2f9e44">강'+c.strong+'</b>·<b style="color:#1f6feb">정'+c.normal+'</b>·<b style="color:#c0612b">교'+c.flag+'</b></span>'; }

  function radarSVG(axes, cap, rings, selfColor, targetKey, sz){
    sz=sz||260; var n=Math.max(5,axes.length), R=sz*0.34, cx=sz/2, cy=sz/2+sz*0.02;
    function ang(i){return -Math.PI/2+2*Math.PI*i/n;}
    function pt(i,val){var r=Math.max(0,Math.min(cap,val||0))/cap*R;return [cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))];}
    var s=['<svg viewBox="0 0 '+sz+' '+(sz+30)+'" width="100%" style="max-width:'+sz+'px">'];
    var hiRing=rings.indexOf(100)>=0?100:rings[Math.floor(rings.length/2)];
    rings.forEach(function(lv){var pts=[];for(var i=0;i<n;i++){var p=pt(i,lv);pts.push(p[0].toFixed(1)+','+p[1].toFixed(1));}var hi=(lv===hiRing);s.push('<polygon points="'+pts.join(' ')+'" fill="none" stroke="'+(hi?'#9aa7b8':'#d7dee8')+'" stroke-width="'+(hi?1.3:1)+'"'+(hi?'':' stroke-dasharray="2 3"')+'/>');});
    for(var i=0;i<n;i++){var e=pt(i,cap);s.push('<line x1="'+cx.toFixed(1)+'" y1="'+cy.toFixed(1)+'" x2="'+e[0].toFixed(1)+'" y2="'+e[1].toFixed(1)+'" stroke="#d7dee8"/>');}
    if(targetKey){var tp=[];axes.forEach(function(a,i){var p=pt(i,a[targetKey]||0);tp.push(p[0].toFixed(1)+','+p[1].toFixed(1));});s.push('<polygon points="'+tp.join(' ')+'" fill="none" stroke="#1f6feb" stroke-width="1.4" stroke-dasharray="6 4"/>');}
    var mp=[];axes.forEach(function(a,i){if(a.score==null)return;var p=pt(i,a.score);mp.push(p[0].toFixed(1)+','+p[1].toFixed(1));});
    s.push('<polygon points="'+mp.join(' ')+'" fill="'+selfColor+'33" stroke="'+selfColor+'" stroke-width="2.2"/>');
    axes.forEach(function(a,i){if(a.score==null)return;var p=pt(i,a.score);s.push('<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="'+selfColor+'"/>');});
    axes.forEach(function(a,i){var p=pt(i,cap*1.16);var anc=Math.abs(p[0]-cx)<6?'middle':(p[0]>cx?'start':'end');s.push('<text x="'+p[0].toFixed(1)+'" y="'+p[1].toFixed(1)+'" text-anchor="'+anc+'" font-size="10" font-weight="700" fill="#1b2330">'+a.label+'</text>');s.push('<text x="'+p[0].toFixed(1)+'" y="'+(p[1]+12).toFixed(1)+'" text-anchor="'+anc+'" font-size="9" fill="#6b7787">'+_f(a.score,0)+'</text>');});
    s.push('</svg>'); return s.join('');
  }

  // ── 엘리트 규준 단일출처: PITCH_NORMS(dashboard_core/pitch_norms.js) SSOT. [2026-06-20] 구 하드코딩 폴백 제거(report.engine.js BIOMOTION_NORMS와 동일 정책).
  //   스코프에서 shell이 pitch_norms.js를 먼저 INCLUDE → PITCH_NORMS 항상 정의됨. 미로드 시 {}(백분위 미산출=정직 공백, 잘못된 stale값 방지). player_report.js _PR_NORMS 선례와 동일. ──
  var BM_NORMS=(typeof PITCH_NORMS!=='undefined'&&PITCH_NORMS)||{};
  function _ncdf(z){ if(typeof PITCH_STATS!=='undefined')return PITCH_STATS.cdf(z); var t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2);var p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;}
  function _bEnds(dir,p25,p75){ if(typeof PITCH_STATS!=='undefined')return PITCH_STATS.ends(dir,p25,p75); if(dir===-1)return{good:p25,bad:p75};if(dir==='abs')return Math.abs(p75)>=Math.abs(p25)?{good:p75,bad:p25}:{good:p25,bad:p75};return{good:p75,bad:p25};}
  function _zOf(m){if(m.normNA||m.neutral)return null;var nm=BM_NORMS[m.key];if(!nm||m.value==null||!m.dir)return null;var e=_bEnds(m.dir,nm.p25,nm.p75);var sig=Math.abs(nm.p75-nm.p25)/1.349||1;var gh=e.good>e.bad;return (m.value-nm.med)/sig*(gh?1:-1);}
  function _statOf(m){if(m.normNA||m.neutral)return null;var nm=BM_NORMS[m.key];if(!nm||m.value==null||!m.dir)return null;var e=_bEnds(m.dir,nm.p25,nm.p75);var g=(m.value-e.bad)/((e.good-e.bad)||1);return g>=1?'strong':(g<=0?'flag':'normal');}
  function _pctlOf(m){var z=_zOf(m);return z==null?null:Math.round(Math.max(1,Math.min(99,_ncdf(z)*100)));}
  // ── DATA → 팀 요약 (phases 5단계 메카닉 · 엘리트 백분위/카운트 기반) ──
  function summarize(DATA){
    DATA=DATA||{}; var pl=DATA.player||{}, vs=DATA.velo_summary||{}, hp=DATA.hp_assessment, cmd=DATA.command;
    var ED=null; try{ if(typeof etDiag!=='undefined'&&etDiag.compute) ED=etDiag.compute(DATA); }catch(e){ ED=null; }
    function _rs(v){ return (v!=null&&isFinite(v))?Math.round(v):null; }
    var W=(ED&&ED.windup)||{},S=(ED&&ED.stride)||{},B=(ED&&ED.blocking)||{},K=(ED&&ED.knee5)||{},T=(ED&&ED.trunk7)||{},AB=(ED&&ED.armball9)||{};
    // [2026-05-31] 엘리트 규준 5단계(고교 우수투수20·100=중앙·10/SD) — phases.js 변인점수 재매핑·재그룹
    // 엘리트 5단계 점수는 modules/mech5.js 단일 소스에서만 계산한다 (온라인·PDF와 동일 값 보장). [[unify-calc-modules-single-source]]
    var _E6=(typeof mech5!=='undefined'&&mech5)?mech5.stage6(DATA):null;
    function _e6or(k,fb){ return (_E6&&_E6[k]!=null)?_E6[k]:_rs(fb); }
    // [2026-06-20 퍼센타일 전환] 단계점수 = 엘리트 n=20 규준 대비 변인 퍼센타일 평균(PITCH_STATS.pctl, z→정규CDF, 중앙=50).
    //   기존 mech5.stage6 remap(3s-175.325)은 엘리트 중앙값을 ~100점에 매핑 → 전원 90+ 포화·변별 소실. 퍼센타일로 변별 회복.
    //   적정범위(dir==='range')·neutral·미채점 변인 제외(상한 초과를 '우수'로 오판 방지). 코어(mech5/phases/pitch_norms) 불변 — 표시단만 전환.
    //   PITCH_STATS 부재 시 기존 remap 단계점수로 전부 폴백(스케일 혼합 금지).
    var _PS=(typeof PITCH_STATS!=='undefined'&&PITCH_STATS&&PITCH_STATS.pctl)?PITCH_STATS:null;
    var _det6=(_PS&&mech5&&mech5.detail6)?mech5.detail6(DATA):null;
    function _stagePctl(sk){ if(!_det6||!_det6[sk])return null;
      var ps=_det6[sk].map(function(r){ return (!r||r.neutral||r.score==null||r.dir==='range')?null:_PS.pctl({key:r.key,value:r.value,dir:r.dir}); }).filter(function(x){return x!=null;});
      return ps.length?Math.round(ps.reduce(function(a,b){return a+b;},0)/ps.length):null; }
    var _scoreOf=_det6?function(sk,fb){return _stagePctl(sk);}:function(sk,fb){return _e6or(sk,fb);};
    var _PCTILE=!!_det6;   // 퍼센타일 모드 플래그(임계 분기용)
    var PH6=[{key:'windup',name:'와인드업',cat:'store',score:_scoreOf('windup',W.composite)},
             {key:'stride',name:'드라이브',cat:'gen',score:_scoreOf('stride',S.momentumScore)},
             {key:'block',name:'블로킹',cat:'transfer',score:_scoreOf('block',B.functionalScore)},
             {key:'knee',name:'앞다리 버팀',cat:'transfer',score:_scoreOf('knee',null)},
             {key:'trunk',name:'몸통',cat:'gen',score:_scoreOf('trunk',T.prodScore)},
             {key:'arm',name:'팔',cat:'transfer',score:_scoreOf('arm',AB.abScore)}];
    // 상태색 임계: 퍼센타일 모드=우수≥60·정상 40~60·미흡<40(중앙50). remap 폴백 모드=구 75/60.
    var _thG=_PCTILE?60:75, _thW=_PCTILE?40:60;
    PH6.forEach(function(p){p.status=(p.score==null?null:(p.score>=_thG?'good':(p.score>=_thW?'warn':'bad')));});
    var phaseScores={}, allP=[], counts={strong:0,normal:0,flag:0};
    PH6.forEach(function(p){ phaseScores[p.key]=p.score; if(p.score!=null){allP.push(p.score); if(p.status==='good')counts.strong++; else if(p.status==='warn')counts.normal++; else counts.flag++;} });
    var mech=allP.length?Math.round(allP.reduce(function(a,b){return a+b;},0)/allP.length):null;
    var tot=counts.strong+counts.normal+counts.flag;
    var compIndex=tot>0?Math.round(100*(counts.strong+0.5*counts.normal)/tot):null;
    var weak=null; PH6.forEach(function(p){ if((p.status==='warn'||p.status==='bad')&&p.score!=null){ if(weak==null||p.score<weak.score)weak={key:p.key,name:p.name,score:p.score,status:(p.status==='bad'?'leak':'caution')}; } });
    function _wc(cat){ return PH6.filter(function(p){return p.cat===cat&&p.score!=null;}).sort(function(a,b){return a.score-b.score;})[0]||null; }
    var corr3=[['store','저장','#7048e8'],['gen','생성','#2563eb'],['transfer','효율','#1f9d58']].map(function(c){var w=_wc(c[0]);return w?{nm:c[1],col:c[2],name:w.name,score:w.score,key:w.key}:null;}).filter(Boolean).sort(function(a,b){return a.score-b.score;});
    var hpAxes=(hp&&hp.axes?hp.axes:[]).filter(function(a){return a.key!=='upper_power';}).map(function(a){return {key:a.key,label:a.label_kr||a.axis,score:a.score,target:a.elite_score};});
    return {
      name:pl.name||'선수', arm:pl.handedness||'R', grade:pl.grade!=null?pl.grade:(DATA.grade!=null?DATA.grade:null),
      height_cm:pl.height_m?Math.round(pl.height_m*1000)/10:null, weight_kg:pl.weight_kg||null,
      mech:mech, comp_index:compIndex, phaseScores:phaseScores, counts:counts, weak:weak, corr3:corr3,
      max_kmh:vs.max_kmh!=null?Math.round(vs.max_kmh*10)/10:(DATA.measured_kmh!=null?Math.round(DATA.measured_kmh*10)/10:null),
      avg_kmh:vs.avg_kmh!=null?Math.round(vs.avg_kmh*10)/10:null,
      spin:vs.avg_spin!=null?vs.avg_spin:null,
      hp_overall:hp&&hp.overall_score!=null?hp.overall_score:null,
      pv_kmh:hp&&hp.predicted_velo_kmh!=null?Math.round(hp.predicted_velo_kmh*10)/10:null,
      command:cmd&&cmd.score!=null?cmd.score:null,
      hp_axes:hpAxes,
      fitness_only:(allP.length===0)
    };
  }

  function topList(summaries, field, n, desc){
    var arr=summaries.filter(function(s){return s[field]!=null&&isFinite(s[field]);}).slice();
    arr.sort(function(a,b){return desc?(b[field]-a[field]):(a[field]-b[field]);});
    return arr.slice(0,n||3);
  }

  function buildTeamHTML(summaries, opts){
    opts=opts||{}; var date=opts.date||'2026-05-15'; var team=opts.team||'상동고 투수';
    summaries=summaries||[]; var N=summaries.length;
    var pitchers=summaries.filter(function(s){return !s.fitness_only;}); var Np=pitchers.length;
    var fitOnly=N-Np;

    var velos=summaries.filter(function(s){return s.max_kmh!=null;}).map(function(s){return s.max_kmh;});
    var avgV=mean(velos), maxV=velos.length?Math.max.apply(null,velos):null, minV=velos.length?Math.min.apply(null,velos):null;
    var avgM=mean(summaries.map(function(s){return s.mech;})), avgH=mean(summaries.map(function(s){return s.hp_overall;}));
    var boost=summaries.filter(function(s){return s.counts&&s.counts.flag>0;}).length;

    var teamMech=PH_KEYS.map(function(k){return {key:k,label:PH_SHORT[k], score:(function(){var _m=mean(summaries.map(function(s){return s.phaseScores[k];}));return _m==null?null:Math.round(_m);})()};});

    var hpKeys=[]; summaries.forEach(function(s){ s.hp_axes.forEach(function(a){ if(hpKeys.indexOf(a.key)<0)hpKeys.push(a.key); }); });
    var teamFit=hpKeys.map(function(k){ var lab=null; summaries.forEach(function(s){var a=s.hp_axes.find(function(x){return x.key===k;}); if(a&&!lab)lab=a.label;});
      return {label:lab||k, score:(function(){var _m=mean(summaries.map(function(s){var a=s.hp_axes.find(function(x){return x.key===k;});return a?a.score:null;}));return _m==null?null:Math.round(_m);})()}; });

    var byName=function(a,b){return String(a.name).localeCompare(String(b.name),'ko');};
    var rows=summaries.slice().sort(byName);

    function kpi(l,v,u,sub,cls){ return '<div class="kpi"><div class="kl">'+l+'</div><div class="kv '+(cls||'')+'">'+v+'<u>'+(u||'')+'</u></div><div class="ks">'+sub+'</div></div>'; }
    var avgSpin=mean(summaries.map(function(s){return s.spin;}));
    var kpis='<div class="kpis">'
      +kpi('팀 평균 구속',_f(avgV),' km/h','최고 '+_f(maxV)+' / 최저 '+_f(minV),'')
      +kpi('팀 평균 회전수',_f(avgSpin,0),' rpm','평균 spin','')
      +kpi('팀 평균 체력',_f(avgH,0),'/100','HP Assessment','')
      +kpi('팀 평균 메카닉',_f(avgM,0),'/100','5단계 종합 점수','')+'</div>';

    // ① 로스터
    var roster='<table class="tbl"><thead><tr><th>#</th><th class="l">이름</th><th>학년</th><th>투</th><th>키</th><th>몸무게</th><th>구속</th><th>회전수</th><th>체력</th><th>메카닉<br><span style="font-weight:400;font-size:11px;color:#8893a4">/100</span></th><th class="l">교정 우선순위 TOP 3</th></tr></thead><tbody>'
      +rows.map(function(s,i){
        var w=(s.corr3&&s.corr3.length)?s.corr3.map(function(c){return '<div style="white-space:nowrap;line-height:1.5"><span style="display:inline-block;min-width:30px;color:'+c.col+';font-weight:700">'+c.nm+'</span> '+esc(c.name)+' <b style="color:'+sCol6(c.score)+'">'+c.score+'</b></div>';}).join(''):(s.fitness_only?'<span class="muted2">체력만 측정</span>':'<span class="ok">안정적</span>');
        return '<tr><td>'+(i+1)+'</td><td class="l b">'+esc(s.name)+'</td><td>'+(s.grade!=null?'고'+s.grade:'—')+'</td><td>'+(s.arm==='L'?'좌':'우')+'</td><td>'+(s.height_cm!=null?s.height_cm:'—')+'</td><td>'+(s.weight_kg!=null?s.weight_kg:'—')+'</td>'
        +'<td class="b">'+(s.max_kmh!=null?s.max_kmh:'—')+'</td><td>'+(s.spin!=null?s.spin:'—')+'</td><td style="color:'+sCol(s.hp_overall)+'">'+(s.hp_overall!=null?s.hp_overall:'—')+'</td><td class="b" style="color:'+sCol6(s.mech)+'">'+(s.mech!=null?s.mech:'—')+'</td>'
        +'<td class="l">'+w+'</td></tr>';
      }).join('')+'</tbody></table>';

    // ② 메카닉 매트릭스 (선수 × 5단계)
    var matrix='<table class="tbl mtx"><thead><tr><th class="l">선수</th>'+PH_KEYS.map(function(k){return '<th>'+PH_SHORT[k]+'</th>';}).join('')+'<th>종합</th></tr></thead><tbody>'
      +rows.map(function(s){ return '<tr><td class="l b">'+esc(s.name)+'</td>'+PH_KEYS.map(function(k){var sc=s.phaseScores[k];return '<td class="cell" style="background:'+sBg6(sc)+';color:'+sCol6(sc)+'">'+(sc!=null?sc:'—')+'</td>';}).join('')+'<td class="cell b" style="background:'+sBg6(s.mech)+';color:'+sCol6(s.mech)+'">'+(s.mech!=null?s.mech:'—')+'</td></tr>'; }).join('')
      +'<tr class="avg"><td class="l b">팀 평균</td>'+teamMech.map(function(m){return '<td class="cell b" style="color:'+sCol6(m.score)+'">'+(m.score!=null?m.score:'—')+'</td>';}).join('')+'<td class="cell b" style="color:'+sCol6(Math.round(avgM))+'">'+_f(avgM,0)+'</td></tr>'
      +'</tbody></table>';

    // ③ 투수 간 비교 — 카테고리 순위 + 5단계별 강점/보강 투수
    function rankCard(title,unit,list){
      return '<div class="cmp-card"><div class="cmp-h">'+title+'</div><div class="rk">'+
        (list.length?list.map(function(s,i){return '<div class="rk-i r'+(i+1)+'"><span class="rk-n">'+(i+1)+'</span><span class="rk-nm">'+esc(s.name)+'</span><span class="rk-v" style="color:'+sCol(typeof s.__v==='number'&&(unit==='/100'||unit===' 백분위')?s.__v:null)+'">'+s.__v+'<u>'+unit+'</u></span></div>';}).join(''):'<div class="muted2">데이터 없음</div>')+
        '</div></div>';
    }
    function withV(list,f){ return list.map(function(s){var o=Object.create(s);o.__v=f(s);return o;}); }
    var cmpGrid='<div class="cmp-grid">'
      +rankCard('구속 Top','km/h', withV(topList(summaries,'max_kmh',3,true),function(s){return s.max_kmh;}))
      +rankCard('메카닉 Top','/100', withV(topList(summaries,'mech',3,true),function(s){return s.mech;}))
      +rankCard('체력 Top','/100', withV(topList(summaries,'hp_overall',3,true),function(s){return s.hp_overall;}))
      +rankCard('제구 Top','/100', withV(topList(summaries,'command',3,true),function(s){return s.command;}))
      +'</div>';
    // 5단계별 최고/보강 투수 (투구 측정자 기준)
    function bestWorst(k){
      var arr=pitchers.filter(function(s){return s.phaseScores[k]!=null;}).slice();
      if(!arr.length)return {best:null,worst:null};
      arr.sort(function(a,b){return b.phaseScores[k]-a.phaseScores[k];});
      return {best:arr[0],worst:arr[arr.length-1]};
    }
    var stageCmp='<table class="tbl"><thead><tr><th class="l">메카닉 단계</th><th>팀 평균</th><th class="l">최고 투수</th><th class="l">보강 필요</th></tr></thead><tbody>'
      +PH_KEYS.map(function(k){ var bw=bestWorst(k); var tm=teamMech.find(function(x){return x.key===k;});
        var b=bw.best?esc(bw.best.name)+' <b style="color:'+sCol6(bw.best.phaseScores[k])+'">'+bw.best.phaseScores[k]+'</b>':'—';
        var w=bw.worst?esc(bw.worst.name)+' <b style="color:'+sCol6(bw.worst.phaseScores[k])+'">'+bw.worst.phaseScores[k]+'</b>':'—';
        return '<tr><td class="l b">'+PH_SHORT[k]+' <span class="muted2">'+PH_FULL[k]+'</span></td><td class="b" style="color:'+sCol6(tm.score)+'">'+(tm.score!=null?tm.score:'—')+'</td><td class="l">'+b+'</td><td class="l">'+w+'</td></tr>';
      }).join('')+'</tbody></table>';

    // ④ 팀 공통 보강 단계 (가장 많은 선수의 최우선 약점 단계)
    var weakCount={}; pitchers.forEach(function(s){ if(s.weak){ weakCount[s.weak.key]=(weakCount[s.weak.key]||0)+1; } });
    var weakRank=Object.keys(weakCount).map(function(k){return {key:k,count:weakCount[k],avg:Math.round(mean(pitchers.map(function(s){return s.phaseScores[k];}))||0)};}).sort(function(a,b){return b.count-a.count;});
    var weakBox=weakRank.length?'<div class="wk">'+weakRank.map(function(w,i){return '<div class="wk-i"><div class="wk-r">'+(i+1)+'</div><div class="wk-b"><div class="wk-n">'+PH_SHORT[w.key]+' <span class="muted2">'+PH_FULL[w.key]+'</span></div><div class="wk-m">최우선 보강 대상 <b>'+w.count+'명</b> (투구 측정 '+Np+'명 중)</div></div><div class="wk-g">'+w.avg+'<u>팀평균</u></div></div>';}).join('')+'</div>':'<div class="okbox"> 공통 보강 단계 없음 — 메카닉 전반 안정</div>';

    // ⑤ 체력 매트릭스
    var fitMatrix='<table class="tbl mtx"><thead><tr><th class="l">선수</th>'+teamFit.map(function(a){return '<th>'+esc(a.label)+'</th>';}).join('')+'<th>종합</th></tr></thead><tbody>'
      +rows.map(function(s){ return '<tr><td class="l b">'+esc(s.name)+'</td>'+hpKeys.map(function(k){var a=s.hp_axes.find(function(x){return x.key===k;});var sc=a?a.score:null;return '<td class="cell" style="background:'+sBg(sc)+';color:'+sCol(sc)+'">'+(sc!=null?sc:'—')+'</td>';}).join('')+'<td class="cell b" style="background:'+sBg(s.hp_overall)+';color:'+sCol(s.hp_overall)+'">'+(s.hp_overall!=null?s.hp_overall:'—')+'</td></tr>'; }).join('')+'</tbody></table>';

    // ⑥ 예측-실측 갭
    var gapRows=rows.map(function(s){ if(s.pv_kmh==null||s.max_kmh==null)return ''; var gap=Math.round((s.max_kmh-s.pv_kmh)*10)/10; var pos=gap>=0; var w=Math.min(100,Math.abs(gap)/8*100);
      return '<div class="gap-row"><span class="gap-n">'+esc(s.name)+'</span><span class="gap-num">실측 '+s.max_kmh+' / 기대 '+s.pv_kmh+'</span><div class="gap-tr"><div class="gap-f '+(pos?'gp':'gn')+'" style="width:'+w.toFixed(0)+'%"></div></div><span class="gap-v" style="color:'+(pos?'#2f9e44':'#c0612b')+'">'+(pos?'+':'')+gap+' km/h</span></div>'; }).join('');

    // ⑦ 선수별 메카닉 프로파일 (6축, 투구 측정자만)
    var profiles='<div class="prof-grid">'+pitchers.slice().sort(byName).map(function(s){ var ax=PH_KEYS.map(function(k){return {label:PH_SHORT[k],score:s.phaseScores[k]};});
      return '<div class="prof"><div class="prof-h"><b>'+esc(s.name)+'</b><span class="prof-c" style="color:'+sCol6(s.mech)+'">'+(s.mech!=null?s.mech:'—')+'</span></div>'
        +radarSVG(ax,100,[25,50,75,100],'#1f6feb')+'<div class="prof-t">'+(s.weak?'보강: '+PH_SHORT[s.weak.key]:'안정적')+'</div></div>'; }).join('')+'</div>';

    // ⑧ 훈련 그룹 (최우선 보강 단계별)
    var groups={}; PH_KEYS.forEach(function(k){groups[k]={key:k,members:[]};});
    var un=[]; pitchers.forEach(function(s){ if(s.weak&&groups[s.weak.key])groups[s.weak.key].members.push(s); else un.push(s); });
    var groupGrid='<div class="grp-grid">'+PH_KEYS.filter(function(k){return groups[k].members.length;}).map(function(k){var G=groups[k];return '<div class="grp"><div class="grp-h"><b>'+PH_SHORT[k]+'</b><span class="grp-c">'+G.members.length+'명</span></div><div class="grp-d">'+PH_FULL[k]+' 보강 우선</div><div class="grp-m">'+G.members.map(function(s){return '<span class="pill">'+esc(s.name)+'</span>';}).join('')+'</div></div>';}).join('')+'</div>'+(un.length?'<div class="note">그룹 미배정 '+un.length+'명(안정적 또는 메카닉 미측정)</div>':'');

    // ③용 — 투수 5단계 사진(팀 평균 점수 + 양호/주의/누수)
    var _KIMG_T=(typeof _KSTRIP_URI!=='undefined')?_KSTRIP_URI:'';
    var _NODES6=[{x:168,y:196},{x:332,y:214},{x:502,y:210},{x:680,y:220},{x:858,y:210},{x:1028,y:206}];
    var _BMC_T={good:'#2f9e44',warn:'#e8731a',bad:'#c0612b'};
    function _smT(pts){ if(!pts.length)return''; var d='M'+pts[0].x+' '+pts[0].y; for(var i=0;i<pts.length-1;i++){var p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;var c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6,c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;d+=' C'+c1x.toFixed(1)+' '+c1y.toFixed(1)+' '+c2x.toFixed(1)+' '+c2y.toFixed(1)+' '+p2.x.toFixed(1)+' '+p2.y.toFixed(1);} return d; }
    var _tmS=teamMech.map(function(m,i){return {i:i,key:m.key,name:m.label,score:m.score,status:(m.score==null?null:(m.score>=75?'good':(m.score>=60?'warn':'bad')))};});
    var _tmWorst=_tmS.filter(function(p){return p.score!=null;}).sort(function(a,b){return a.score-b.score;})[0];
    var _tmPts=_tmS.map(function(p){return _NODES6[p.i];});
    var _tmMarks=_tmS.map(function(p){ if(p.score==null)return''; var c=_BMC_T[p.status],sym=(p.status==='good'?'●':p.status==='warn'?'◐':'▲'),left=(_NODES6[p.i].x/1200*100).toFixed(2),top=(_NODES6[p.i].y/512*100).toFixed(2),isW=_tmWorst&&p.key===_tmWorst.key;
      return '<div style="position:absolute;left:'+left+'%;top:'+top+'%;transform:translate(-50%,-50%);z-index:2">'
        +(isW?'<div style="position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;background:#c0612b;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px">▲ 팀 병목</div>':'')
        +'<div style="width:30px;height:30px;border-radius:50%;background:rgba(14,18,24,.9);border:3px solid '+c+';display:flex;align-items:center;justify-content:center;color:'+c+';font-size:13px;font-weight:800;margin:0 auto">'+(p.i+1)+'</div>'
        +'<div style="position:absolute;left:50%;top:calc(100% + 4px);transform:translateX(-50%);white-space:nowrap;background:rgba(14,18,24,.92);border:1px solid '+c+'66;border-radius:7px;padding:2px 7px;text-align:center"><div style="font-size:10.5px;font-weight:700;color:#e8edf4;line-height:1.25">'+esc(p.name)+'</div><div style="font-size:12px;font-weight:800;color:'+c+';line-height:1.15">'+sym+' '+p.score+'</div></div>'
        +'</div>'; }).join('');
    var teamFigH=(_KIMG_T?'<div class="card" style="margin-bottom:12px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">투수 메카닉 5단계 — 팀 평균 <span style="font-weight:500;color:#6b7787;font-size:11.5px">· 단계별 팀 평균 점수와 진단</span></div><div style="position:relative;width:100%;border-radius:8px;overflow:hidden;background:#eef1f4"><img src="'+_KIMG_T+'" alt="투수 5단계" style="display:block;width:100%"><svg viewBox="0 0 1200 512" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><path d="'+_smT(_tmPts)+'" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round"/><path d="'+_smT(_tmPts)+'" fill="none" stroke="#3f86cf" stroke-width="3.5" stroke-linecap="round"/></svg>'+_tmMarks+'</div><div style="display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:11px"><span style="color:#2f9e44;font-weight:700">● 양호</span><span style="color:#e8731a;font-weight:700">◐ 주의</span><span style="color:#c0612b;font-weight:700">▲ 누수</span></div></div>':'');
    var CSS='@page{size:A4;margin:12mm 11mm}*{box-sizing:border-box}'
      +"body{font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b2330;background:#fff;margin:0;font-size:12.5px;line-height:1.5}"
      +'.wrap{max-width:900px;margin:0 auto;padding:18px}h1{font-size:23px;margin:0}.sub{color:#6b7787;font-size:13px;margin:2px 0 14px}'
      +'h2{font-size:16px;margin:20px 0 8px;padding-bottom:5px;border-bottom:2px solid #1f6feb;page-break-after:avoid}'
      +'.lead{color:#41506a;font-size:12px;margin:-2px 0 10px}.muted2{color:#8893a4;font-size:11px}'
      +'.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px}.kpi{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:10px;padding:11px 13px}.kl{font-size:11px;color:#6b7787}.kv{font-size:26px;font-weight:800}.kv u{font-size:11px;color:#6b7787;font-style:normal;font-weight:500;margin-left:3px}.ks{font-size:11px;color:#41506a;margin-top:3px}.kv.warn{color:#c0612b}.kv.good{color:#2f9e44}'
      +'.tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:4px}.tbl th{background:#f0f3f8;color:#41506a;font-weight:700;padding:7px 5px;text-align:center;font-size:11px;border-bottom:1px solid #e3e9f0}.tbl td{padding:6px 5px;border-bottom:1px solid #eef2f7;text-align:center}.tbl th.l,.tbl td.l{text-align:left}.tbl .b{font-weight:800}.tbl .loss{color:#c0612b;font-weight:700}.tbl .ok{color:#2f9e44}'
      +'.mtx td.cell{font-weight:700;border-radius:4px}'
      +'.cmp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.cmp-card{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:10px;padding:10px 12px}.cmp-h{font-size:11px;color:#6b7787;font-weight:700;margin-bottom:6px}.rk{display:flex;flex-direction:column;gap:4px}.rk-i{display:flex;align-items:center;gap:6px;font-size:11.5px}.rk-n{width:15px;height:15px;border-radius:4px;display:inline-grid;place-items:center;font-size:11px;font-weight:800;color:#fff;background:#8893a4;flex:0 0 auto}.rk-i.r1 .rk-n{background:#1f6feb}.rk-i.r2 .rk-n{background:#4a8af0}.rk-i.r3 .rk-n{background:#86b0f5}.rk-nm{flex:1;font-weight:600}.rk-v{font-weight:800}.rk-v u{font-size:11px;color:#8893a4;font-style:normal;font-weight:500;margin-left:1px}'
      +'.card{background:#fff;border:1px solid #e3e9f0;border-radius:10px;padding:12px 14px}.two{display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:center}'
      +'.wk{display:flex;flex-direction:column;gap:8px}.wk-i{display:flex;align-items:center;gap:12px;background:#f6f8fb;border:1px solid #e3e9f0;border-radius:9px;padding:9px 13px}.wk-r{font-size:17px;font-weight:800;color:#8893a4;width:20px;text-align:center}.wk-b{flex:1}.wk-n{font-weight:700}.wk-m{font-size:11px;color:#6b7787}.wk-g{font-size:16px;font-weight:800;color:#1f6feb}.wk-g u{font-size:11px;color:#8893a4;font-style:normal;font-weight:500;margin-left:3px}'
      +'.okbox{padding:16px;background:#e3f6ec;border-radius:8px;color:#2f9e44;text-align:center;font-weight:700}'
      +'.gap-row{display:grid;grid-template-columns:70px 130px 1fr 78px;gap:8px;align-items:center;margin:5px 0;font-size:11.5px}.gap-n{font-weight:700}.gap-num{color:#6b7787;font-size:11px}.gap-tr{position:relative;height:9px;background:#eef2f7;border-radius:5px}.gap-f{position:absolute;top:0;bottom:0;left:0;border-radius:5px}.gap-f.gp{background:#7fc6a8}.gap-f.gn{background:#e8a07a}.gap-v{font-weight:700;text-align:right}'
      +'.prof-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:10px}.prof{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:10px;padding:9px;page-break-inside:avoid}.prof-h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}.prof-h b{font-size:13px}.prof-c{font-size:15px;font-weight:800}.prof-t{font-size:11px;color:#41506a;margin-top:3px;text-align:center}'
      +'.grp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px}.grp{background:#f6f8fb;border:1px solid #e3e9f0;border-radius:10px;padding:11px}.grp-h{display:flex;align-items:center;gap:7px}.grp-h b{font-size:13px}.grp-c{margin-left:auto;color:#6b7787;font-size:11px}.grp-d{font-size:11px;color:#6b7787;margin:5px 0 7px}.grp-m{display:flex;flex-wrap:wrap;gap:5px}.pill{background:#fff;border:1px solid #e3e9f0;border-radius:13px;padding:2px 9px;font-size:11px}.ok{color:#2f9e44;font-size:11px}'
      +'.note{font-size:11px;color:#6b7787;margin-top:8px}.foot{font-size:11px;color:#8893a4;margin-top:6px}'
      +'@media print{.noprint{display:none}}.pdfbtn{position:fixed;right:16px;top:14px;background:#1f6feb;color:#fff;border:none;border-radius:8px;padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.18)}';

    var subnote=N+'명'+(fitOnly>0?' (투구 측정 '+Np+'명 · 체력만 '+fitOnly+'명)':'');
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>'+esc(team)+' 팀 현황 리포트</title>'
      +'<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet"><style>'+CSS+'</style></head><body>'
      +'<button class="pdfbtn noprint" onclick="window.print()"> PDF로 저장 / 인쇄</button><div class="wrap">'
      +'<h1>'+esc(team)+' 팀 현황 리포트</h1><div class="sub">국민대학교 바이오메카닉스 연구실 · '+subnote+' · 측정일 '+esc(date)+'</div>'
      +kpis
      +'<h2>① 전체 투수 로스터</h2><div class="lead">구속=측정 최고(km/h) · 회전수=평균 rpm · 체력=HP /100 · 메카닉=5단계 종합 점수 · 교정 우선순위 TOP 3은 저장·생성·효율 각 영역의 가장 약한 단계입니다.</div>'+roster
      +'<h2 style="page-break-before:always">② 팀 체력 현황</h2><div class="lead">왼쪽 레이더는 팀 평균 체력축. 매트릭스는 선수별 축 점수(체력만 측정한 선수 포함).</div>'
      +'<div class="two"><div class="card">'+radarSVG(teamFit,100,[25,50,75,100],'#e8731a')+'<div class="prof-t">팀 평균 체력</div></div><div>'+fitMatrix+'</div></div>'
      +'<h2 style="page-break-before:always">③ 팀 메카닉 현황 (5단계)</h2><div class="lead">먼저 투수 5단계 그림에 단계별 <b>팀 평균 점수</b>와 진단(양호·주의·누수)을 표시하고, 이어 5단계 레이더·선수별 매트릭스를 제시합니다. <b style="color:#2f9e44">초록 ≥75 양호</b> · <b style="color:#e8731a">주황 60~74 주의</b> · <b style="color:#c0612b">빨강 &lt;60 누수</b>.</div>'
      +teamFigH
      +'<div class="two"><div class="card">'+radarSVG(teamMech,100,[25,50,75,100],'#1f6feb')+'<div class="prof-t">팀 평균 메카닉</div></div><div>'+matrix+'</div></div>'
      +'<h2 style="page-break-before:always">④ 선수별 메카닉 프로파일</h2><div class="lead">선수별 5단계 점수 형태 — 찌그러진 방향이 그 선수의 약점입니다(투구 측정자 '+Np+'명).</div>'+profiles
      +'<h2 style="page-break-before:always">⑤ 투수 간 비교</h2><div class="lead">카테고리별 상위 투수와, 단계별 메카닉 최고/보강 필요 투수입니다 — 팀 내 상대 위치 파악·짝 훈련 배정에 활용하세요.</div>'+cmpGrid+stageCmp
      +'<h2>⑥ 훈련 그룹 분류</h2><div class="lead">최우선 보강 단계가 같은 투수끼리 묶었습니다 — 같은 그룹은 함께 훈련하면 효율적입니다.</div>'+groupGrid
      +'<h2 style="page-break-before:always">⑦ 팀 공통 보강 단계</h2><div class="lead">여러 투수가 공통으로 최우선 보강이 필요한 단계입니다(우선 팀 훈련 대상).</div>'+weakBox
      +'<div class="foot">본 리포트는 web-port 분석 결과 단일 출처에서 생성되며, 5단계 메카닉 점수는 개별 선수 리포트·메카닉 요약과 일치합니다. 규준: 고교 우수투수 20명(Theia+포스플레이트+랩소도) · 100=엘리트 중앙값·1 SD당 10점(엘리트 대비 상대 위치).</div>'
      +'</div></body></html>';
  }
  return { summarize:summarize, buildTeamHTML:buildTeamHTML };
});
