// extract_rapsodo.js — Rapsodo CSV → pitches[] (extract_rapsodo.py 포팅, command 용 핵심 컬럼)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.extractRapsodo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const HEADER_ROW = 3;
  function splitCSV(line) { const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) { const c = line[i];
      if (q) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } }
    out.push(cur); return out; }
  const tf = v => { const s = String(v == null ? '' : v).trim(); if (s === '' || s === '-' || s === '—' || s === 'nan' || s === 'NaN') return null; const f = parseFloat(s); return isNaN(f) ? null : f; };
  const ti = v => { const f = tf(v); return f == null ? null : Math.round(f); };
  const ts = v => { const s = String(v == null ? '' : v).trim(); return (s === '' || s === '-' || s === 'nan') ? null : s; };
  const MAP = { 'No': ['pitch_no', ti], 'Pitch Type': ['pitch_type', ts], 'Is Strike': ['is_strike', v => String(v).trim() === 'Y'],
    'Strike Zone Side': ['sz_side_in', tf], 'Strike Zone Height': ['sz_height_in', tf], 'Velocity': ['velocity_kmh', tf],
    'Total Spin': ['total_spin_rpm', tf], 'Spin Efficiency (release)': ['spin_efficiency_pct', tf], 'Spin Direction': ['spin_direction_clock', ts],
    'Release Height': ['release_height_ft', tf], 'Release Side': ['release_side_ft', tf] };
  function parse(text) {
    const lines = text.split(/\r?\n/);
    // 헤더 행 자동 탐지(Velocity+Total Spin 포함). 못 찾으면 기존 가정(3) 폴백.
    let HR = -1;
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const h = splitCSV(lines[i]).map(x => x.trim());
      if (h.indexOf('Velocity') >= 0 && (h.indexOf('Total Spin') >= 0 || h.indexOf('No') >= 0)) { HR = i; break; }
    }
    if (HR < 0) HR = HEADER_ROW;
    if (lines.length <= HR) return [];
    const headers = splitCSV(lines[HR]).map(h => h.trim());
    const idx = {}; headers.forEach((h, i) => { idx[h] = i; });
    const pitches = [];
    for (let li = HR + 1; li < lines.length; li++) {
      if (!lines[li].trim()) continue;
      const cells = splitCSV(lines[li]);
      if (cells.every(c => !String(c).trim())) continue;
      const rec = {};
      for (const raw in MAP) { const ci = idx[raw]; if (ci === undefined) continue; const [key, cast] = MAP[raw]; rec[key] = cast(cells[ci]); }
      if (rec.pitch_no == null && rec.velocity_kmh == null) continue;
      pitches.push(rec);
    }
    return pitches;
  }
  return { parse };
});
